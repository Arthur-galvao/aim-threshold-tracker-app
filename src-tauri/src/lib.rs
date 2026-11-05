mod data_commands;
mod errors;
mod data_store;
mod kovaaak;
mod migrations;
mod model;
mod parser;
mod randomizer;
mod roll_plan;
mod storage;
mod watcher;
mod sens_ledger;
mod aimlab;
pub mod sampler;

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use tauri::menu::{MenuBuilder, MenuItem, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

use crate::errors::{err, err_d};
use model::{AppSettings, ImportStats, RandomizerSettings, RandomizerState, ScenarioMeta, WatcherStatus};

/// Acima disso o re-parse dos CSVs da migração v2 roda em background.
const MAX_SYNC_REPARSE: usize = 500;

pub struct AppState {
    /// Única fonte da verdade do `AppData` (Plano 02). Toda mutação via `data_commands::mutate`.
    pub data: Arc<data_store::DataCore>,
    pub persister: data_store::Persister,
    pub settings: Mutex<AppSettings>,
    pub watcher: Mutex<Option<watcher::WatcherHandle>>,
    pub emitted: Mutex<HashSet<String>>,
    pub randomizer_state: Mutex<RandomizerState>,
    pub sampler: Mutex<sampler::SamplerState>,
    /// Contadores da sessao de treino do randomizer v2 (Plano 05), persistidos com o sampler.
    pub roll_session: Mutex<roll_plan::RollSessionState>,
    /// Cache do RawAccel (REV-10): (pasta, driver ok). O hot path nunca re-checa tasklist/disco.
    pub rawaccel_cache: Mutex<Option<(std::path::PathBuf, bool)>>,
    pub roll_lock: Mutex<()>,
    /// Metadados por cenário (centro + categoria/subcategoria), chave = nome normalizado (Plano 05).
    pub scenario_meta: Mutex<HashMap<String, ScenarioMeta>>,
    /// true enquanto o runner executa um passo de medição: o randomizer fica pausado (Plano 05/07).
    pub measuring: Mutex<bool>,
    pub upcoming_scenario: Mutex<Option<String>>,
    pub load_report: Mutex<Option<storage::LoadReport>>,
}

#[tauri::command]
fn get_load_report(state: State<'_, AppState>) -> Result<Option<storage::LoadReport>, String> {
    Ok(state.load_report.lock().unwrap().clone())
}

#[tauri::command]
fn detect_kovaak_path() -> Result<Option<String>, String> {
    Ok(kovaaak::detect_kovaak_path().map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn get_aimlab_playlists(_state: State<'_, AppState>) -> Result<Vec<crate::model::GamePlaylist>, String> {
    Ok(crate::aimlab::load_all_aimlab_playlists())
}
#[tauri::command]
fn get_kovaak_playlists(state: State<'_, AppState>) -> Result<Vec<crate::model::GamePlaylist>, String> {
    let stats_path = {
        let settings = state.settings.lock().unwrap();
        settings.kovaak_stats_path.clone()
    };
    Ok(kovaaak::load_all_kovaak_playlists(stats_path.as_deref()))
}

#[tauri::command]
fn get_playlist_in_progress(state: State<'_, AppState>) -> Result<Option<crate::model::GamePlaylist>, String> {
    let stats_path = {
        let settings = state.settings.lock().unwrap();
        settings.kovaak_stats_path.clone()
    };
    Ok(kovaaak::detect_playlist_in_progress(stats_path.as_deref()))
}

/// Itens do menu da bandeja, guardados para trocar os textos ao mudar o idioma (T8.6).
pub struct TrayItems {
    pub open: MenuItem<tauri::Wry>,
    pub quit: MenuItem<tauri::Wry>,
}

#[tauri::command]
fn set_tray_labels(state: State<'_, TrayItems>, open: String, quit: String) -> Result<(), String> {
    state.open.set_text(open).map_err(|e| err_d("tray_labels_failed", e))?;
    state.quit.set_text(quit).map_err(|e| err_d("tray_labels_failed", e))?;
    Ok(())
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    Ok(state.settings.lock().unwrap().clone())
}

#[tauri::command]
fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    mut settings: AppSettings,
) -> Result<(), String> {
    settings.randomizer.mouse_dpi = settings.mouse_dpi;
    storage::save_settings(&app, &settings)?;
    *state.settings.lock().unwrap() = settings.clone();
    let _ = app.emit("randomizer_settings_updated", &settings.randomizer);
    let _ = app.emit("settings_updated", &settings);

    if settings.randomizer.enabled {
        let (avail, found_dir, _, _) = randomizer::refresh_rawaccel_cache(&state, settings.randomizer.rawaccel_dir.as_deref());
        if avail {
            if let Some(ref dir) = found_dir {
                let current_mult = state.randomizer_state.lock().unwrap().active_mult;
                let _ = randomizer::update_and_apply_scale(&app, dir, current_mult, settings.mouse_dpi);
            }
        }
    }

    Ok(())
}

#[tauri::command]
fn set_stats_path(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<(), String> {
    if let Some(mut handle) = state.watcher.lock().unwrap().take() {
        handle.stop();
    }

    {
        let mut settings = state.settings.lock().unwrap();
        settings.kovaak_stats_path = Some(path);
        settings.watcher_active = false;
    }
    let settings = state.settings.lock().unwrap().clone();
    storage::save_settings(&app, &settings)
}

#[tauri::command]
fn start_watcher(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let path = {
        let settings = state.settings.lock().unwrap();
        settings
            .kovaak_stats_path
            .clone()
            .or_else(|| {
                aimlab::find_active_aimlab_replay_dir()
                    .map(|p| p.to_string_lossy().to_string())
            })
            .ok_or_else(|| err("game_dir_not_found"))?
    };

    if state.watcher.lock().unwrap().is_some() {
        return Ok(());
    }

    let dir = std::path::Path::new(&path);
    if !dir.exists() || !dir.is_dir() {
        return Err(err_d("dir_not_exists", &path));
    }

    let handle = watcher::spawn(app.clone(), std::path::PathBuf::from(&path))?;
    *state.watcher.lock().unwrap() = Some(handle);

    let catch_up_app = app.clone();
    std::thread::spawn(move || {
        if let Err(e) = watcher::catch_up_import(&catch_up_app) {
            eprintln!("[watcher] catch-up import falhou: {e}");
        }
    });

    let mut settings = state.settings.lock().unwrap();
    settings.watcher_active = true;
    let settings_clone = settings.clone();
    drop(settings);
    storage::save_settings(&app, &settings_clone)
}

#[tauri::command]
fn stop_watcher(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(mut handle) = state.watcher.lock().unwrap().take() {
        handle.stop();
    }

    let mut settings = state.settings.lock().unwrap();
    settings.watcher_active = false;
    let settings_clone = settings.clone();
    drop(settings);
    storage::save_settings(&app, &settings_clone)
}

#[tauri::command]
fn get_watcher_status(state: State<'_, AppState>) -> Result<WatcherStatus, String> {
    let active = state.watcher.lock().unwrap().is_some();
    let settings = state.settings.lock().unwrap();
    Ok(WatcherStatus {
        active,
        path: settings.kovaak_stats_path.clone(),
        error: None,
    })
}

#[tauri::command]
fn import_existing_csvs(app: AppHandle) -> Result<ImportStats, String> {
    watcher::import_existing(&app)
}

#[tauri::command]
fn check_rawaccel_available(state: State<'_, AppState>) -> Result<RandomizerState, String> {
    let (configured_dir, base_cm) = {
        let s = state.settings.lock().unwrap();
        (s.randomizer.rawaccel_dir.clone(), s.randomizer.base_sens_cm)
    };
    let (avail, _, err_msg, gui_running) = randomizer::refresh_rawaccel_cache(&state, configured_dir.as_deref());
    let mut r_state = state.randomizer_state.lock().unwrap();
    r_state.available = avail;
    r_state.rawaccel_gui_running = gui_running;
    if r_state.active_sens_cm <= 0.0 {
        r_state.active_sens_cm = base_cm;
    }
    r_state.error_message = err_msg;
    Ok(r_state.clone())
}

#[tauri::command]
fn get_randomizer_settings(state: State<'_, AppState>) -> Result<RandomizerSettings, String> {
    Ok(state.settings.lock().unwrap().randomizer.clone())
}

#[tauri::command]
fn save_randomizer_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: RandomizerSettings,
) -> Result<RandomizerState, String> {
    if settings.base_sens_cm < 10.0 || settings.base_sens_cm > 200.0 {
        return Err(err_d("invalid_base_sens", "10-200"));
    }
    if settings.spread_percent < 1.0 || settings.spread_percent > 90.0 {
        return Err(err_d("invalid_spread", "1-90"));
    }
    if settings.mouse_dpi < 100.0 || settings.mouse_dpi > 32000.0 {
        return Err(err_d("invalid_dpi", "100-32000"));
    }

    let (was_enabled, prev_dpi) = {
        let s = state.settings.lock().unwrap();
        (s.randomizer.enabled, s.randomizer.mouse_dpi)
    };
    let is_enabled = settings.enabled;

    {
        let mut app_settings = state.settings.lock().unwrap();
        app_settings.mouse_dpi = settings.mouse_dpi;
        app_settings.randomizer = settings.clone();
    }
    let app_settings = state.settings.lock().unwrap().clone();
    storage::save_settings(&app, &app_settings)?;
    let _ = app.emit("randomizer_settings_updated", &settings);

    let (avail, found_dir, err_msg, gui_running) = randomizer::refresh_rawaccel_cache(&state, settings.rawaccel_dir.as_deref());
    {
        let mut r_state = state.randomizer_state.lock().unwrap();
        r_state.available = avail;
        r_state.rawaccel_gui_running = gui_running;
        r_state.error_message = err_msg;
    }

    if !was_enabled && is_enabled && avail {
        return randomizer::apply_next_sens(
            &app,
            randomizer::RollContext {
                finished_scenario: None,
                reason: "toggle".into(),
            },
        );
    } else if was_enabled && !is_enabled && avail {
        if let Some(ref dir) = found_dir {
            let _ = randomizer::restore_base_sens(&app, dir);
        }
        let now_iso = chrono::Local::now().to_rfc3339();
        let base_cm = if settings.base_sens_cm > 0.0 { settings.base_sens_cm } else { 40.0 };
        let new_state = {
            let mut r_state = state.randomizer_state.lock().unwrap();
            r_state.active_sens_cm = base_cm;
            r_state.active_mult = 1.0;
            r_state.last_updated = Some(now_iso);
            r_state.clone()
        };
        let _ = app.emit("sens_updated", &new_state);
    } else if !is_enabled {
        let base_cm = if settings.base_sens_cm > 0.0 { settings.base_sens_cm } else { 40.0 };
        let new_state = {
            let mut r_state = state.randomizer_state.lock().unwrap();
            r_state.active_sens_cm = base_cm;
            r_state.active_mult = 1.0;
            r_state.clone()
        };
        let _ = app.emit("sens_updated", &new_state);
        return Ok(new_state);
    } else if is_enabled && avail && (prev_dpi - settings.mouse_dpi).abs() > 0.01 {
        if let Some(ref dir) = found_dir {
            let current_mult = state.randomizer_state.lock().unwrap().active_mult;
            let _ = randomizer::update_and_apply_scale(&app, dir, current_mult, settings.mouse_dpi);
        }
    }

    Ok(state.randomizer_state.lock().unwrap().clone())
}

#[tauri::command]
fn get_randomizer_state(state: State<'_, AppState>) -> Result<RandomizerState, String> {
    Ok(state.randomizer_state.lock().unwrap().clone())
}

#[tauri::command]
fn preview_sens_range(settings: RandomizerSettings, center_cm: Option<f64>) -> Result<randomizer::RangePreview, String> {
    Ok(randomizer::preview_sens_range_calc(&settings, center_cm))
}

#[tauri::command]
fn set_scenario_meta(
    state: State<'_, AppState>,
    meta: HashMap<String, ScenarioMeta>,
) -> Result<(), String> {
    let mut normalized = HashMap::with_capacity(meta.len());
    for (k, v) in meta {
        normalized.insert(k.trim().to_lowercase(), v);
    }
    *state.scenario_meta.lock().unwrap() = normalized;
    Ok(())
}

/// Chamado pelo runner da playlist: passo de medicao ativo = randomizer pausado.
/// Ao mudar o valor com o randomizer ligado, refaz o plano da proxima run (sem consumir a sessao).
#[tauri::command]
fn set_measuring(app: AppHandle, state: State<'_, AppState>, measuring: bool) -> Result<(), String> {
    let changed = {
        let mut m = state.measuring.lock().unwrap();
        let changed = *m != measuring;
        *m = measuring;
        changed
    };
    let enabled = state.settings.lock().unwrap().randomizer.enabled;
    if changed && enabled {
        let _ = randomizer::apply_next_sens(
            &app,
            randomizer::RollContext { finished_scenario: None, reason: "measuring".into() },
        );
    }
    Ok(())
}

#[tauri::command]
fn set_upcoming_scenario(
    app: AppHandle,
    state: State<'_, AppState>,
    name: Option<String>,
    reroll: bool,
) -> Result<RandomizerState, String> {
    let norm_name = name.map(|n| n.trim().to_string());
    *state.upcoming_scenario.lock().unwrap() = norm_name.clone();

    if reroll {
        let (enabled, base_cm, scenario_ideal, center_overrides, rawaccel_dir) = {
            let s = state.settings.lock().unwrap();
            (
                s.randomizer.enabled,
                s.randomizer.base_sens_cm,
                s.randomizer.scenario_ideal_cm,
                s.randomizer.center_overrides.clone(),
                s.randomizer.rawaccel_dir.clone(),
            )
        };

        let (avail, _, _) = randomizer::cached_availability(&state, rawaccel_dir.as_deref());
        let last_center = state.sampler.lock().unwrap().last_roll_center_cm;

        if enabled && avail {
            if let Some(last) = last_center {
                let new_center = norm_name.as_ref().and_then(|scen| {
                    let norm = scen.to_lowercase();
                    center_overrides.get(&norm).copied()
                        .or_else(|| state.scenario_meta.lock().unwrap().get(&norm).map(|m| m.center_cm))
                }).or(scenario_ideal).unwrap_or(if base_cm > 0.0 { base_cm } else { 40.0 });

                if new_center > 0.0 && last > 0.0 {
                    let ratio = new_center / last;
                    let log_drift = ratio.ln().abs();
                    let threshold = 1.03_f64.ln();
                    if log_drift > threshold {
                        return randomizer::apply_next_sens(
                            &app,
                            randomizer::RollContext {
                                finished_scenario: None,
                                reason: "reroll".into(),
                            },
                        );
                    }
                }
            }
        }
    }

    Ok(state.randomizer_state.lock().unwrap().clone())
}

#[tauri::command]
fn trigger_randomize_now(app: AppHandle) -> Result<RandomizerState, String> {
    randomizer::apply_next_sens(
        &app,
        randomizer::RollContext {
            finished_scenario: None,
            reason: "manual".into(),
        },
    )
}

#[tauri::command]
fn detect_rawaccel_path(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let configured = state.settings.lock().unwrap().randomizer.rawaccel_dir.clone();
    let detected = randomizer::detect_rawaccel_dir(configured.as_deref());
    Ok(detected.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn test_rawaccel_writer(app: AppHandle, state: State<'_, AppState>, path: Option<String>) -> Result<String, String> {
    let target_dir = match path {
        Some(p) if !p.trim().is_empty() => std::path::PathBuf::from(p),
        _ => {
            let s = state.settings.lock().unwrap();
            randomizer::detect_rawaccel_dir(s.randomizer.rawaccel_dir.as_deref())
                .ok_or_else(|| err("rawaccel_not_found"))?
        }
    };

    if !randomizer::is_valid_rawaccel_dir(&target_dir) {
        return Err(err_d("invalid_rawaccel_dir", target_dir.display()));
    }

    let current_mult = state.randomizer_state.lock().unwrap().active_mult;
    let mouse_dpi = state.settings.lock().unwrap().randomizer.mouse_dpi;
    randomizer::update_and_apply_scale(&app, &target_dir, current_mult, mouse_dpi)?;
    let configured = state.settings.lock().unwrap().randomizer.rawaccel_dir.clone();
    let _ = randomizer::refresh_rawaccel_cache(&state, configured.as_deref());
    Ok("Comunicação com o driver RawAccel testada com sucesso!".to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let (mut data, data_report) = storage::load_app_data(app.handle());
            let (mut settings, settings_report) = storage::load_settings(app.handle());
            // DPI único (REV-24): AppSettings.mouse_dpi é a fonte; o espelho do randomizer segue ela.
            settings.randomizer.mouse_dpi = settings.mouse_dpi;

            if let Ok(dir) = storage::data_dir(app.handle()) {
                if data_report.kind == "loaded" {
                    if let Err(e) = storage::rotate_backups(&dir, storage::APP_DATA_FILE, storage::APP_DATA_BACKUPS) {
                        eprintln!("[storage] falha ao rotacionar backups de app_data: {e}");
                    }
                }
                if settings_report.kind == "loaded" {
                    if let Err(e) = storage::rotate_backups(&dir, storage::SETTINGS_FILE, storage::SETTINGS_BACKUPS) {
                        eprintln!("[storage] falha ao rotacionar backups de settings: {e}");
                    }
                }
            }
            if settings_report.kind == "recovered" {
                eprintln!("[storage] settings.json recuperado: {settings_report:?}");
            }

            // Migração versionada (T3.6): roda uma vez por versão de schema, antes do AppState.
            let mut backfill: Option<(Vec<String>, std::path::PathBuf, f64)> = None;
            match storage::data_dir(app.handle()) {
                Ok(dir) => {
                    let ledger = sens_ledger::SensLedger::load(
                        &storage::sens_ledger_path(app.handle()).unwrap_or_else(|_| dir.join("sens_ledger.json")),
                    );
                    let lookup = |sf: &str| ledger.get(sf).cloned();
                    let emit_handle = app.handle().clone();
                    let progress = move |done: usize, total: usize| {
                        let _ = emit_handle.emit("migration_progress", serde_json::json!({ "done": done, "total": total }));
                    };
                    let dpi = if settings.mouse_dpi > 0.0 { settings.mouse_dpi } else { 800.0 };
                    let hook = |d: &mut model::AppData| aimlab::migrate_existing_aimlab_tasks(d);
                    let ctx = migrations::MigrationCtx {
                        data_dir: &dir,
                        stats_dir: settings.kovaak_stats_path.as_deref().map(std::path::PathBuf::from),
                        fallback_dpi: dpi,
                        ledger_lookup: &lookup,
                        progress: &progress,
                        max_sync_reparse: MAX_SYNC_REPARSE,
                        pre_dedupe_hook: Some(&hook),
                    };
                    let report = migrations::run_migrations(&mut data, &ctx);
                    if let Some(e) = &report.error {
                        eprintln!("[migrations] abortada (dados intactos): {e}");
                    } else if report.changed {
                        if let Err(e) = storage::save_app_data(app.handle(), &data) {
                            eprintln!("[migrations] falha ao salvar após migrar: {e}");
                        }
                    }
                    if report.deferred_reparse {
                        if let Some(sd) = ctx.stats_dir.clone() {
                            backfill = Some((migrations::reparse_candidates(&data, &sd), sd, dpi));
                        }
                    }
                }
                Err(e) => eprintln!("[migrations] sem pasta de dados, migração adiada: {e}"),
            }

            let (avail, found_dir, err_msg, gui_running) = randomizer::check_rawaccel_availability(settings.randomizer.rawaccel_dir.as_deref());
            let initial_rawaccel_cache = found_dir.clone().map(|dir| (dir, avail));
            let sampler_snapshot = storage::load_sampler_state(app.handle());

            if settings.randomizer.rawaccel_dir.is_none() {
                if let Some(ref dir) = found_dir {
                    settings.randomizer.rawaccel_dir = Some(dir.to_string_lossy().to_string());
                    let _ = storage::save_settings(app.handle(), &settings);
                }
            }

            let initial_r_state = RandomizerState {
                available: avail,
                rawaccel_gui_running: gui_running,
                active_sens_cm: if settings.randomizer.base_sens_cm > 0.0 { settings.randomizer.base_sens_cm } else { 40.0 },
                active_mult: 1.0,
                last_run_scenario: None,
                last_run_score: None,
                last_updated: None,
                error_message: err_msg,
                last_roll_reason: None,
                ..RandomizerState::default()
            };

            let is_randomizer_enabled = settings.randomizer.enabled;

            let core = Arc::new(data_store::DataCore::new(data));
            let persist_handle = app.handle().clone();
            let persister = data_store::Persister::spawn(
                core.clone(),
                data_store::PERSIST_DEBOUNCE,
                move |snapshot| storage::save_app_data(&persist_handle, snapshot),
            );

            app.manage(AppState {
                data: core,
                persister,
                settings: Mutex::new(settings),
                watcher: Mutex::new(None),
                emitted: Mutex::new(HashSet::new()),
                randomizer_state: Mutex::new(initial_r_state),
                sampler: Mutex::new(sampler_snapshot.sampler),
                roll_session: Mutex::new(sampler_snapshot.roll_session),
                rawaccel_cache: Mutex::new(initial_rawaccel_cache),
                roll_lock: Mutex::new(()),
                scenario_meta: Mutex::new(HashMap::new()),
                measuring: Mutex::new(false),
                upcoming_scenario: Mutex::new(None),
                load_report: Mutex::new(Some(data_report)),
            });

            // Backfill dos CSVs (passo c da migração v2) fora do caminho de boot: parse em thread,
            // aplicação numa única mutação.
            if let Some((files, stats_dir, dpi)) = backfill {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    let h = handle.clone();
                    let progress = move |done: usize, total: usize| {
                        let _ = h.emit("migration_progress", serde_json::json!({ "done": done, "total": total }));
                    };
                    let parsed = migrations::collect_reparse(&files, &stats_dir, dpi, &progress);
                    if let Err(e) = data_commands::mutate(&handle, |d| Ok(migrations::apply_reparse(d, &parsed))) {
                        eprintln!("[migrations] backfill falhou: {e}");
                    }
                    let _ = handle.emit("migration_progress", serde_json::json!({ "done": files.len(), "total": files.len() }));
                });
            }

            if is_randomizer_enabled && avail {
                let handle = app.handle().clone();
                let _ = randomizer::apply_next_sens(
                    &handle,
                    randomizer::RollContext {
                        finished_scenario: None,
                        reason: "toggle".into(),
                    },
                );
            } else if !is_randomizer_enabled && avail {
                if let Some(ref dir) = found_dir {
                    if let Some(backup) = storage::load_rawaccel_backup(app.handle()) {
                        if let Ok(content) = std::fs::read_to_string(dir.join("settings.json")) {
                            if let Ok((live_dpi, _, _)) = randomizer::parse_rawaccel_live_values(&content) {
                                if live_dpi.is_some() && live_dpi == backup.last_written_output_dpi && live_dpi != backup.output_dpi {
                                    let _ = randomizer::restore_from_backup(app.handle(), dir);
                                }
                            }
                        }
                    }
                }
            }

            let open_item = MenuItemBuilder::with_id("open", "Abrir Aim Threshold Tracker").build(app)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Sair").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&open_item, &separator, &quit_item])
                .build()?;
            app.manage(TrayItems {
                open: open_item.clone(),
                quit: quit_item.clone(),
            });

            let mut tray_builder = TrayIconBuilder::new()
                .tooltip("Aim Threshold Tracker")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "open" => {
                            let window = app.get_webview_window("main")
                                .or_else(|| app.webview_windows().values().next().cloned());
                            if let Some(w) = window {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        let window = app.get_webview_window("main")
                            .or_else(|| app.webview_windows().values().next().cloned());
                        if let Some(w) = window {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.unminimize();
                                let _ = w.set_focus();
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            let _tray = tray_builder.build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let close_to_tray = {
                    let state: Option<State<AppState>> = window.try_state();
                    if let Some(s) = state {
                        s.settings.lock().unwrap().close_to_tray
                    } else {
                        true
                    }
                };
                if close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            data_commands::get_app_data,
            data_commands::create_task,
            data_commands::update_task_meta,
            data_commands::delete_task,
            data_commands::set_active_task,
            data_commands::add_manual_sessions,
            data_commands::delete_session,
            data_commands::upsert_playlist,
            data_commands::delete_playlist,
            data_commands::sync_game_playlists,
            data_commands::replace_all_data,
            data_commands::import_json_backup,
            data_commands::export_app_data,
            set_tray_labels,
            get_load_report,
            detect_kovaak_path,
            get_kovaak_playlists,
            get_playlist_in_progress,
            get_aimlab_playlists,
            get_settings,
            save_settings,
            set_stats_path,
            start_watcher,
            stop_watcher,
            get_watcher_status,
            import_existing_csvs,
            check_rawaccel_available,
            get_randomizer_settings,
            save_randomizer_settings,
            get_randomizer_state,
            preview_sens_range,
            set_scenario_meta,
            set_measuring,
            data_commands::set_session_focus,
            set_upcoming_scenario,
            trigger_randomize_now,
            detect_rawaccel_path,
            test_rawaccel_writer,
            aimlab::sync_aimlab_sqlite,
            aimlab::import_aimlab_csv,
        ])
        .build(tauri::generate_context!())
        .expect("erro ao construir o aplicativo Tauri")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                data_commands::flush_now(app);
                randomizer::restore_on_exit(app);
            }
        });
}
