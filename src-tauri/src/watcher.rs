use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use notify::{Event, EventKind, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::model::{ImportStats, KovaakRun};
use crate::parser;
use crate::sens_ledger;
use crate::storage;
use crate::AppState;

pub struct WatcherHandle {
    shutdown: Arc<AtomicBool>,
    thread: Option<thread::JoinHandle<()>>,
}

impl WatcherHandle {
    pub fn stop(&mut self) {
        self.shutdown.store(true, Ordering::Relaxed);
        if let Some(handle) = self.thread.take() {
            let _ = handle.join();
        }
    }
}

pub fn spawn(app: AppHandle, path: PathBuf) -> Result<WatcherHandle, String> {
    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_loop = shutdown.clone();

    let thread = thread::Builder::new()
        .name("kovaak-watcher".into())
        .spawn(move || {
            let (tx, rx) = mpsc::channel::<Event>();

            let mut watcher = match notify::recommended_watcher(
                move |res: Result<Event, notify::Error>| {
                    if let Ok(event) = res {
                        let _ = tx.send(event);
                    }
                },
            ) {
                Ok(w) => w,
                Err(e) => {
                    let _ = app.emit("watcher_error", format!("Falha ao criar watcher: {e}"));
                    return;
                }
            };

            let mut watched_any = false;
            if path.exists() && path.is_dir() {
                if let Err(e) = watcher.watch(&path, RecursiveMode::NonRecursive) {
                    let _ = app.emit(
                        "watcher_error",
                        format!("Falha ao observar a pasta {}: {e}", path.display()),
                    );
                } else {
                    watched_any = true;
                }
            }

            if let Some(aimlab_replay_dir) = crate::aimlab::find_active_aimlab_replay_dir() {
                if aimlab_replay_dir != path && aimlab_replay_dir.exists() && aimlab_replay_dir.is_dir() {
                    if watcher
                        .watch(&aimlab_replay_dir, RecursiveMode::NonRecursive)
                        .is_ok()
                    {
                        watched_any = true;
                    }
                }
            }

            if !watched_any {
                return;
            }

            while !shutdown_loop.load(Ordering::Relaxed) {
                match rx.recv_timeout(Duration::from_millis(500)) {
                    Ok(event) => handle_event(&app, event),
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => break,
                }
            }
        })
        .map_err(|e| format!("Falha ao iniciar thread do watcher: {e}"))?;

    Ok(WatcherHandle {
        shutdown,
        thread: Some(thread),
    })
}

fn handle_event(app: &AppHandle, event: Event) {
    if !matches!(event.kind, EventKind::Create(_)) {
        return;
    }
    for path in event.paths {
        if is_stats_csv(&path) {
            let app = app.clone();
            thread::spawn(move || {
                let _ = process_new_csv(&app, &path);
            });
        } else if is_aimlab_replay_json(&path) {
            let app = app.clone();
            thread::spawn(move || {
                let _ = process_new_aimlab_replay(&app, &path);
            });
        }
    }
}

fn is_stats_csv(path: &Path) -> bool {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    name.ends_with(".csv") && name.contains("stats")
}

pub fn is_aimlab_replay_json(path: &Path) -> bool {
    let is_json = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.eq_ignore_ascii_case("json"))
        .unwrap_or(false);
    if !is_json {
        return false;
    }
    path.parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .map(|n| n.eq_ignore_ascii_case("replay"))
        .unwrap_or(false)
}

fn process_new_aimlab_replay(app: &AppHandle, path: &Path) -> Result<bool, String> {
    let state: State<AppState> = app.state();
    let file_name = file_name_of(path);

    // 1. Dedupe by replay filename before any side effect
    if !state.emitted.lock().unwrap().insert(format!("aimlab_replay_{file_name}")) {
        return Ok(false);
    }

    // 2. Snapshot sensitivity used during the finished run
    let (is_randomizer_enabled, active_sens, mouse_dpi) = {
        let s = state.settings.lock().unwrap();
        let r = state.randomizer_state.lock().unwrap();
        (s.randomizer.enabled, r.active_sens_cm, s.mouse_dpi)
    };
    let roll_center = state.sampler.lock().unwrap().last_roll_center_cm;

    // 3. Wait for replay JSON flush and parse
    let name_map = crate::aimlab::build_aimlab_scenario_map();
    let mut parsed_run: Option<KovaakRun> = None;
    for _ in 0..8 {
        thread::sleep(Duration::from_millis(350));
        if let Some(r) = crate::aimlab::parse_aimlab_replay_file(path, &name_map, mouse_dpi) {
            parsed_run = Some(r);
            break;
        }
    }

    let mut run = match parsed_run {
        Some(r) => r,
        None => return Err(format!("Não foi possível ler o Replay do Aim Lab: {}", path.display())),
    };

    // 4. Ledger ANTES do sorteio da próxima sens
    record_run_end_sens(app, &file_name, is_randomizer_enabled, active_sens, roll_center);

    // 5. Roll next sensitivity via RawAccel serialized by roll_lock
    if is_randomizer_enabled {
        let _ = crate::randomizer::apply_next_sens(
            app,
            crate::randomizer::RollContext {
                finished_scenario: Some(run.scenario.clone()),
                reason: "run_end".into(),
            },
        );
    }

    apply_sens_ledger(app, &file_name, &mut run);

    // Dedupe por source_file dentro do lock do store; `None` = run já registrada.
    if crate::data_commands::record_run(app, &run)?.is_none() {
        return Ok(false);
    }

    if is_randomizer_enabled {
        crate::randomizer::record_last_run(app, &run.scenario, run.score);
    }

    Ok(true)
}

fn process_new_csv(app: &AppHandle, path: &Path) -> Result<bool, String> {
    let state: State<AppState> = app.state();
    let file_name = file_name_of(path);

    // 1. dedupe por nome de arquivo ANTES de qualquer efeito colateral (evita rolar duas vezes)
    if !state.emitted.lock().unwrap().insert(file_name.clone()) {
        return Ok(false);
    }

    // 2. snapshot da sens usada na run que acabou e do cenario que acabou
    let (is_randomizer_enabled, active_sens, stats_path, auto_detect_playlist, mouse_dpi) = {
        let s = state.settings.lock().unwrap();
        let r = state.randomizer_state.lock().unwrap();
        (
            s.randomizer.enabled,
            r.active_sens_cm,
            s.kovaak_stats_path.clone(),
            s.auto_detect_playlist,
            s.mouse_dpi,
        )
    };
    let roll_center = state.sampler.lock().unwrap().last_roll_center_cm;
    let finished = crate::parser::scenario_from_file_name(&file_name);

    // 3. ledger da run que acabou (antes do sorteio), depois rolar a proxima sens
    record_run_end_sens(app, &file_name, is_randomizer_enabled, active_sens, roll_center);
    if is_randomizer_enabled {
        let _ = crate::randomizer::apply_next_sens(
            app,
            crate::randomizer::RollContext {
                finished_scenario: finished.clone(),
                reason: "run_end".into(),
            },
        );
    }

    // 4. parsear (sem reescrever o CSV do jogo) e aplicar o ledger
    let mut run = match wait_for_parse(path, mouse_dpi) {
        Ok(r) => r,
        Err(e) => {
            let _ = app.emit(
                "run_import_failed",
                serde_json::json!({ "file": file_name, "error": e }),
            );
            return Err(e);
        }
    };

    apply_sens_ledger(app, &file_name, &mut run);

    // Dedupe por source_file dentro do lock do store; `None` = run já registrada.
    if crate::data_commands::record_run(app, &run)?.is_none() {
        return Ok(false);
    }

    if auto_detect_playlist {
        if let Some(playlist) = crate::kovaaak::detect_playlist_in_progress(stats_path.as_deref()) {
            let _ = app.emit("kovaak_playlist_active", &playlist);
        }
    }

    if is_randomizer_enabled {
        crate::randomizer::record_last_run(app, &run.scenario, run.score);
    }

    Ok(true)
}

fn file_name_of(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default()
}

/// Grava no ledger a sens usada na run que acabou. Erro vira log: não bloqueia a run.
fn record_run_end_sens(
    app: &AppHandle,
    file_name: &str,
    randomizer_enabled: bool,
    active_sens: f64,
    roll_center: Option<f64>,
) {
    let now = sens_ledger::now_ms();
    let entry = sens_ledger::entry_for_run(randomizer_enabled, active_sens, roll_center, now);
    let result = storage::sens_ledger_path(app)
        .and_then(|p| sens_ledger::record_and_save(&p, file_name, entry, now));
    if let Err(e) = result {
        eprintln!("[Watcher] Falha ao gravar sens_ledger para {file_name}: {e}");
    }
}

/// Sobrepõe sens/role/centro/k da run com a entrada do ledger (se houver).
fn apply_sens_ledger(app: &AppHandle, file_name: &str, run: &mut KovaakRun) {
    let entry = storage::sens_ledger_path(app)
        .ok()
        .and_then(|p| sens_ledger::lookup(&p, file_name));
    sens_ledger::apply_to_run(entry.as_ref(), run);
}

/// Backoff do parse: a run só é válida quando o parser devolve Score + tabela de armas.
const PARSE_BACKOFF_MS: [u64; 6] = [100, 200, 400, 800, 1600, 3200];

fn wait_for_parse(path: &Path, fallback_dpi: f64) -> Result<KovaakRun, String> {
    for delay in PARSE_BACKOFF_MS {
        thread::sleep(Duration::from_millis(delay));
        if let Some(run) = parser::parse_stats_file_with_fallback_dpi(path, fallback_dpi) {
            return Ok(run);
        }
    }
    Err(format!("Não foi possível ler o CSV: {}", path.display()))
}

/// Lista os CSVs de stats de uma pasta, em ordem.
fn list_stats_csvs(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("Falha ao ler a pasta {}: {e}", dir.display()))?;
    let mut csvs: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| is_stats_csv(p))
        .collect();
    csvs.sort();
    Ok(csvs)
}

fn modified_ms(path: &Path) -> Option<i64> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    let d = modified.duration_since(std::time::UNIX_EPOCH).ok()?;
    Some(d.as_millis() as i64)
}

/// Parse (IO pesado, sem lock) + lote único no store. `reason` vai no evento `import_complete`.
fn import_paths(
    app: &AppHandle,
    paths: &[PathBuf],
    mouse_dpi: f64,
    reason: &str,
) -> Result<ImportStats, String> {
    let total = paths.len();
    let mut unparsed = 0usize;
    let mut runs: Vec<KovaakRun> = Vec::with_capacity(total);
    for path in paths {
        match parser::parse_stats_file_with_fallback_dpi(path, mouse_dpi) {
            Some(mut run) => {
                apply_sens_ledger(app, &file_name_of(path), &mut run);
                runs.push(run);
            }
            None => unparsed += 1,
        }
    }

    // Lote inteiro numa única mutação (uma revisão por import) + flush.
    // Run já importada: corrige a sens só se estava gravada como sens do jogo (< 2.5).
    let outcome = crate::data_commands::import_runs(
        app,
        &runs,
        |session, run| {
            if session.sens > 0.0 && session.sens < 2.5 && run.sens >= 2.5 {
                session.sens = run.sens;
                true
            } else {
                false
            }
        },
        |_| {},
    )?;

    let stats = ImportStats {
        total,
        new: outcome.new,
        skipped: outcome.skipped + unparsed,
    };
    app.emit(
        "import_complete",
        serde_json::json!({
            "total": stats.total,
            "new": stats.new,
            "skipped": stats.skipped,
            "reason": reason,
        }),
    )
    .map_err(|e| e.to_string())?;
    Ok(stats)
}

pub fn import_existing(app: &AppHandle) -> Result<ImportStats, String> {
    let state: State<AppState> = app.state();

    let (dir, mouse_dpi) = {
        let settings = state.settings.lock().unwrap();
        let path = settings
            .kovaak_stats_path
            .clone()
            .ok_or_else(|| "Nenhuma pasta do KovaaK's configurada".to_string())?;
        (PathBuf::from(path), settings.mouse_dpi)
    };

    let csvs = list_stats_csvs(&dir)?;
    import_paths(app, &csvs, mouse_dpi, "manual")
}

/// Margem para trás no `last_import_scan_at`: arquivos recém-criados (ainda sendo escritos)
/// são reconsiderados na próxima varredura. Duplicatas são descartadas pelo store.
const CATCH_UP_MARGIN_MS: i64 = 5 * 60 * 1000;

/// Importa os CSVs de stats modificados desde a última varredura (ou todos, se nunca houve).
/// Atualiza `last_import_scan_at` e emite `import_complete` com `reason: "catch_up"`.
pub fn catch_up_import(app: &AppHandle) -> Result<ImportStats, String> {
    let state: State<AppState> = app.state();
    let scan_started_ms = sens_ledger::now_ms();

    let (dir, mouse_dpi, since) = {
        let settings = state.settings.lock().unwrap();
        let path = settings
            .kovaak_stats_path
            .clone()
            .ok_or_else(|| "Nenhuma pasta do KovaaK's configurada".to_string())?;
        (PathBuf::from(path), settings.mouse_dpi, settings.last_import_scan_at)
    };

    // Arquivos que o watcher ao vivo já assumiu (`emitted`) são dele: catch-up não os importa,
    // para não parsear antes de o ledger da run ser gravado.
    let claimed_by_live = state.emitted.lock().unwrap().clone();
    let pending: Vec<PathBuf> = list_stats_csvs(&dir)?
        .into_iter()
        .filter(|p| !claimed_by_live.contains(&file_name_of(p)))
        .filter(|p| match (since, modified_ms(p)) {
            (Some(since), Some(modified)) => modified > since,
            _ => true,
        })
        .collect();

    let stats = import_paths(app, &pending, mouse_dpi, "catch_up")?;

    let snapshot = {
        let mut settings = state.settings.lock().unwrap();
        settings.last_import_scan_at = Some(scan_started_ms - CATCH_UP_MARGIN_MS);
        settings.clone()
    };
    storage::save_settings(app, &snapshot)?;
    Ok(stats)
}

static ID_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

pub fn unique_id(prefix: &str) -> String {
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let count = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    let rand_val: u32 = rand::random();
    format!("{prefix}_{millis}_{count}_{rand_val:x}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_aimlab_replay_json() {
        let p1 = Path::new(r"C:\Users\Test\AppData\LocalLow\Statespace\aimlab_tb\Users\123\Replay\8699003e.json");
        let p2 = Path::new(r"C:\Users\Test\AppData\LocalLow\Statespace\aimlab_tb\Users\123\Playlists\warmup.json");
        let p3 = Path::new(r"C:\Users\Test\AppData\LocalLow\Statespace\aimlab_tb\Users\123\Replay\thumb.jpg");
        assert!(is_aimlab_replay_json(p1));
        assert!(!is_aimlab_replay_json(p2));
        assert!(!is_aimlab_replay_json(p3));
    }

    #[test]
    fn test_unique_id_no_collision() {
        use std::collections::HashSet;
        let mut set = HashSet::new();
        for _ in 0..10_000 {
            let id = unique_id("task");
            assert!(set.insert(id), "Colisão detectada na geração de IDs únicos");
        }
        assert_eq!(set.len(), 10_000);
    }

    #[test]
    fn test_scenario_from_file_name() {
        let name = "VT 1w4ts - Challenge - 2026.10.12-14.30.22 Stats.csv";
        let parsed = crate::parser::scenario_from_file_name(name);
        assert_eq!(parsed, Some("VT 1w4ts".to_string()));

        let dash_name = "VT Pasu - Small - Challenge - 2026.10.12-14.30.22 Stats.csv";
        let parsed_dash = crate::parser::scenario_from_file_name(dash_name);
        assert_eq!(parsed_dash, Some("VT Pasu - Small".to_string()));
    }
}
