use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use notify::{Event, EventKind, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::model::{
    AppData, ImportStats, KovaakRun, Session, Task, DEFAULT_CATEGORY, DEFAULT_SUBCATEGORY,
};
use crate::parser;
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

#[allow(dead_code)]
pub fn plan_roll(enabled: bool, dedupe_hit: bool) -> bool {
    enabled && !dedupe_hit
}

fn process_new_aimlab_replay(app: &AppHandle, path: &Path) -> Result<bool, String> {
    let state: State<AppState> = app.state();
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

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

    // 4. Roll next sensitivity via RawAccel serialized by roll_lock
    if is_randomizer_enabled {
        let _ = crate::randomizer::apply_next_sens(
            app,
            crate::randomizer::RollContext {
                finished_scenario: Some(run.scenario.clone()),
                reason: "run_end".into(),
            },
        );
    }

    let already_imported = {
        let data = state.data.lock().unwrap();
        has_source_file(&data.tasks, &run.source_file)
    };
    if already_imported {
        return Ok(false);
    }

    if is_randomizer_enabled && active_sens > 0.0 {
        run.sens = active_sens;
    }

    app.emit("new_run", &run).map_err(|e| e.to_string())?;

    if is_randomizer_enabled {
        crate::randomizer::record_last_run(app, &run.scenario, run.score);
    }

    Ok(true)
}

fn process_new_csv(app: &AppHandle, path: &Path) -> Result<bool, String> {
    let state: State<AppState> = app.state();
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

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
    let finished = crate::parser::scenario_from_file_name(&file_name);

    // 3. rolar a proxima sens agora, sincrono, serializado por roll_lock
    if is_randomizer_enabled {
        let _ = crate::randomizer::apply_next_sens(
            app,
            crate::randomizer::RollContext {
                finished_scenario: finished.clone(),
                reason: "run_end".into(),
            },
        );
    }

    // 4. reescrever CSV com used_cm e parsear (com override de sens)
    if is_randomizer_enabled && active_sens > 0.0 {
        let mut updated = false;
        for _ in 0..5 {
            thread::sleep(Duration::from_millis(300));
            if let Ok(()) = update_kovaak_csv_sensitivity(path, active_sens) {
                updated = true;
                break;
            }
        }
        if !updated {
            if let Err(e) = update_kovaak_csv_sensitivity(path, active_sens) {
                eprintln!("[Watcher] Erro ao atualizar sensibilidade no CSV: {e}");
            }
        }
    }

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

    let already_imported = {
        let data = state.data.lock().unwrap();
        has_source_file(&data.tasks, &run.source_file)
    };
    if already_imported {
        return Ok(false);
    }

    if is_randomizer_enabled && active_sens > 0.0 {
        run.sens = active_sens;
    }

    app.emit("new_run", &run).map_err(|e| e.to_string())?;

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

pub fn update_kovaak_csv_sensitivity(path: &Path, sens_cm: f64) -> Result<(), String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Falha ao ler arquivo CSV para atualização: {e}"))?;

    let sens_str = format!("{:.2}", sens_cm);
    let mut new_lines = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        let lower = trimmed.to_lowercase();

        if lower.starts_with("horiz sens:") || lower.starts_with("horizsens:") {
            new_lines.push(format!("Horiz Sens:,{sens_str}"));
        } else if lower.starts_with("vert sens:") || lower.starts_with("vertsens:") {
            new_lines.push(format!("Vert Sens:,{sens_str}"));
        } else if lower.starts_with("sens scale:") || lower.starts_with("sensscale:") {
            new_lines.push("Sens Scale:,cm/360".to_string());
        } else {
            new_lines.push(line.to_string());
        }
    }

    let updated = new_lines.join("\r\n");
    fs::write(path, updated)
        .map_err(|e| format!("Falha ao gravar arquivo CSV atualizado: {e}"))?;

    Ok(())
}

fn wait_for_parse(path: &Path, fallback_dpi: f64) -> Result<KovaakRun, String> {
    let mut attempts = 0;
    loop {
        thread::sleep(Duration::from_millis(1000));
        if let Some(run) = parser::parse_stats_file_with_fallback_dpi(path, fallback_dpi) {
            return Ok(run);
        }
        attempts += 1;
        if attempts >= 10 {
            return Err(format!("Não foi possível ler o CSV: {}", path.display()));
        }
    }
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

    let entries = fs::read_dir(&dir).map_err(|e| format!("Falha ao ler a pasta {}: {e}", dir.display()))?;
    let mut csvs: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| is_stats_csv(p))
        .collect();
    csvs.sort();

    let total = csvs.len();
    let mut new = 0usize;
    let mut skipped = 0usize;

    for path in &csvs {
        let run = match parser::parse_stats_file_with_fallback_dpi(path, mouse_dpi) {
            Some(r) => r,
            None => {
                skipped += 1;
                continue;
            }
        };

        let already = {
            let data = state.data.lock().unwrap();
            has_source_file(&data.tasks, &run.source_file)
        };
        if already {
            // Update session sensitivity only if it was stored as an unconverted in-game sensitivity (< 2.5)
            let mut data = state.data.lock().unwrap();
            for task in &mut data.tasks {
                for session in &mut task.sessions {
                    if session.source_file.as_deref() == Some(&run.source_file)
                        && session.sens > 0.0
                        && session.sens < 2.5
                        && run.sens >= 2.5
                    {
                        session.sens = run.sens;
                        new += 1;
                    }
                }
            }
            skipped += 1;
            continue;
        }

        add_session_to_data(&state, &run);
        new += 1;
    }

    if new > 0 {
        let data = state.data.lock().unwrap().clone();
        storage::save_app_data(app, &data)?;
    }

    let stats = ImportStats {
        total,
        new,
        skipped,
    };
    app.emit("import_complete", &stats).map_err(|e| e.to_string())?;
    Ok(stats)
}

pub fn migrate_existing_sensitivities(data: &mut AppData, stats_dir: Option<&str>, mouse_dpi: f64) -> bool {
    let mut updated = false;
    let base_dir = stats_dir.map(PathBuf::from);
    let effective_dpi = if mouse_dpi > 0.0 { mouse_dpi } else { 800.0 };

    for task in &mut data.tasks {
        for session in &mut task.sessions {
            // Any sensitivity < 2.5 is clearly an in-game sens rather than physical cm/360
            if session.sens > 0.0 && session.sens < 2.5 {
                let mut converted = false;

                // Try to re-parse from source file if available
                if let (Some(ref dir), Some(ref file_name)) = (&base_dir, &session.source_file) {
                    let csv_path = dir.join(file_name);
                    if csv_path.exists() {
                        if let Some(run) = parser::parse_stats_file_with_fallback_dpi(&csv_path, effective_dpi) {
                            if run.sens > 2.5 {
                                session.sens = run.sens;
                                converted = true;
                                updated = true;
                            }
                        }
                    }
                }

                // If source file not found or couldn't be parsed, fallback to Valorant conversion
                if !converted {
                    session.sens = parser::convert_sens_to_cm(session.sens, Some("Valorant"), effective_dpi);
                    updated = true;
                }
            }
        }
    }

    updated
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

pub fn has_source_file(tasks: &[Task], source_file: &str) -> bool {
    tasks
        .iter()
        .any(|t| t.sessions.iter().any(|s| s.source_file.as_deref() == Some(source_file)))
}

pub fn add_session_to_data(state: &State<AppState>, run: &KovaakRun) {
    let date = run.datetime.get(..10).unwrap_or("").to_string();
    let session = Session {
        id: unique_id("sess"),
        date,
        sens: run.sens,
        pb: run.score,
        threshold: 0.0,
        source_file: Some(run.source_file.clone()),
    };

    let mut data = state.data.lock().unwrap();

    if let Some(task) = data
        .tasks
        .iter_mut()
        .find(|t| t.name.eq_ignore_ascii_case(&run.scenario))
    {
        task.sessions.push(session);
        return;
    }

    let task = Task {
        id: unique_id("task"),
        name: run.scenario.clone(),
        category: DEFAULT_CATEGORY.to_string(),
        subcategory: DEFAULT_SUBCATEGORY.to_string(),
        sessions: vec![session],
    };

    if data.active_task_id.is_none() {
        data.active_task_id = Some(task.id.clone());
    }
    data.tasks.push(task);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_kovaak_csv_sensitivity() {
        let tmp_path = std::env::temp_dir().join("test_update_sens.csv");
        let initial_content = "Score:,940.0\r\nScenario:,WALLHACK - VBRClick Easy\r\nSens Scale:,cm/360\r\nHoriz Sens:,50.0\r\nVert Sens:,50.0\r\nDPI:,800\r\nFOV:,103.0\r\n";
        std::fs::write(&tmp_path, initial_content).unwrap();

        let result = update_kovaak_csv_sensitivity(&tmp_path, 108.35);
        assert!(result.is_ok());

        let updated_content = std::fs::read_to_string(&tmp_path).unwrap();
        assert!(updated_content.contains("Horiz Sens:,108.35"));
        assert!(updated_content.contains("Vert Sens:,108.35"));
        assert!(updated_content.contains("Sens Scale:,cm/360"));

        let _ = std::fs::remove_file(tmp_path);
    }

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
    fn test_migrate_preserves_randomized_and_cm_sens() {
        let mut data = AppData {
            active_task_id: Some("t1".into()),
            tasks: vec![Task {
                id: "t1".into(),
                name: "1w2ts Pasu".into(),
                category: "Clicking".into(),
                subcategory: "Dynamic".into(),
                sessions: vec![
                    Session {
                        id: "s1".into(),
                        date: "2026-09-18".into(),
                        sens: 75.0,
                        pb: 120.0,
                        threshold: 110.0,
                        source_file: Some("run1.csv".into()),
                    },
                    Session {
                        id: "s2".into(),
                        date: "2026-09-18".into(),
                        sens: 50.0,
                        pb: 115.0,
                        threshold: 110.0,
                        source_file: Some("run2.csv".into()),
                    },
                ],
            }],
            playlists: Vec::new(),
        };

        let changed = migrate_existing_sensitivities(&mut data, None, 800.0);
        assert!(!changed, "Sensitividades em cm/360 não devem ser modificadas");
        assert_eq!(data.tasks[0].sessions[0].sens, 75.0);
        assert_eq!(data.tasks[0].sessions[1].sens, 50.0);
    }

    #[test]
    fn test_migrate_converts_legacy_in_game_sens() {
        let mut data = AppData {
            active_task_id: Some("t1".into()),
            playlists: Vec::new(),
            tasks: vec![Task {
                id: "t1".into(),
                name: "1w2ts Pasu".into(),
                category: "Clicking".into(),
                subcategory: "Dynamic".into(),
                sessions: vec![Session {
                    id: "s1".into(),
                    date: "2026-09-18".into(),
                    sens: 0.24,
                    pb: 120.0,
                    threshold: 110.0,
                    source_file: None,
                }],
            }],
        };

        let changed = migrate_existing_sensitivities(&mut data, None, 800.0);
        assert!(changed, "Sensitividade legada (< 2.5) deve ser migrada");
        assert_eq!(data.tasks[0].sessions[0].sens, 68.0);
    }

    #[test]
    fn test_has_source_file() {
        let tasks = vec![Task {
            id: "t1".into(),
            name: "Scenario".into(),
            category: "Clicking".into(),
            subcategory: "Dynamic".into(),
            sessions: vec![Session {
                id: "s1".into(),
                date: "2026-09-18".into(),
                sens: 75.0,
                pb: 100.0,
                threshold: 90.0,
                source_file: Some("target_run.csv".into()),
            }],
        }];

        assert!(has_source_file(&tasks, "target_run.csv"));
        assert!(!has_source_file(&tasks, "other_run.csv"));
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
    fn test_plan_roll_decisions() {
        assert!(plan_roll(true, false));
        assert!(!plan_roll(true, true), "Dedupe hit prevents re-roll");
        assert!(!plan_roll(false, false), "Disabled randomizer prevents roll");
        assert!(!plan_roll(false, true));
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
