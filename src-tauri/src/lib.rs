mod kovaaak;
mod model;
mod parser;
mod randomizer;
mod storage;
mod watcher;

use std::collections::HashSet;
use std::sync::Mutex;

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

use model::{AppData, AppSettings, ImportStats, RandomizerSettings, RandomizerState, WatcherStatus};

pub struct AppState {
    pub data: Mutex<AppData>,
    pub settings: Mutex<AppSettings>,
    pub watcher: Mutex<Option<watcher::WatcherHandle>>,
    pub emitted: Mutex<HashSet<String>>,
    pub randomizer_state: Mutex<RandomizerState>,
}

#[tauri::command]
fn load_app_data(state: State<'_, AppState>) -> Result<AppData, String> {
    Ok(state.data.lock().unwrap().clone())
}

#[tauri::command]
fn save_app_data(
    app: AppHandle,
    state: State<'_, AppState>,
    data: AppData,
) -> Result<(), String> {
    storage::save_app_data(&app, &data)?;
    *state.data.lock().unwrap() = data;
    Ok(())
}

#[tauri::command]
fn import_json_backup(
    app: AppHandle,
    state: State<'_, AppState>,
    json: String,
) -> Result<AppData, String> {
    let data: AppData = serde_json::from_str(&json).map_err(|e| format!("JSON inválido: {e}"))?;
    storage::save_app_data(&app, &data)?;
    *state.data.lock().unwrap() = data.clone();
    Ok(data)
}

#[tauri::command]
fn detect_kovaak_path() -> Result<Option<String>, String> {
    Ok(kovaaak::detect_kovaak_path().map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn get_kovaak_playlists(state: State<'_, AppState>) -> Result<Vec<kovaaak::KovaakPlaylist>, String> {
    let stats_path = {
        let settings = state.settings.lock().unwrap();
        settings.kovaak_stats_path.clone()
    };
    Ok(kovaaak::load_all_kovaak_playlists(stats_path.as_deref()))
}

#[tauri::command]
fn get_playlist_in_progress(state: State<'_, AppState>) -> Result<Option<kovaaak::KovaakPlaylist>, String> {
    let stats_path = {
        let settings = state.settings.lock().unwrap();
        settings.kovaak_stats_path.clone()
    };
    Ok(kovaaak::detect_playlist_in_progress(stats_path.as_deref()))
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    Ok(state.settings.lock().unwrap().clone())
}

#[tauri::command]
fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    storage::save_settings(&app, &settings)?;
    *state.settings.lock().unwrap() = settings;
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
            .ok_or_else(|| "Pasta do KovaaK's não configurada".to_string())?
    };

    if state.watcher.lock().unwrap().is_some() {
        return Ok(());
    }

    let dir = std::path::Path::new(&path);
    if !dir.exists() || !dir.is_dir() {
        return Err(format!("A pasta não existe: {path}"));
    }

    let handle = watcher::spawn(app.clone(), std::path::PathBuf::from(&path))?;
    *state.watcher.lock().unwrap() = Some(handle);

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
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| format!("Erro ao abrir link: {e}"))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        #[cfg(target_os = "macos")]
        let cmd = "open";
        #[cfg(not(target_os = "macos"))]
        let cmd = "xdg-open";
        std::process::Command::new(cmd)
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Erro ao abrir link: {e}"))?;
        Ok(())
    }
}

#[tauri::command]
fn check_rawaccel_available(state: State<'_, AppState>) -> Result<RandomizerState, String> {
    let (configured_dir, base_cm) = {
        let s = state.settings.lock().unwrap();
        (s.randomizer.rawaccel_dir.clone(), s.randomizer.base_sens_cm)
    };
    let (avail, _, err_msg, gui_running) = randomizer::check_rawaccel_availability(configured_dir.as_deref());
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
    let was_enabled = {
        let s = state.settings.lock().unwrap();
        s.randomizer.enabled
    };
    let is_enabled = settings.enabled;

    {
        let mut app_settings = state.settings.lock().unwrap();
        app_settings.randomizer = settings.clone();
    }
    let app_settings = state.settings.lock().unwrap().clone();
    storage::save_settings(&app, &app_settings)?;

    let (avail, found_dir, err_msg, gui_running) = randomizer::check_rawaccel_availability(settings.rawaccel_dir.as_deref());
    {
        let mut r_state = state.randomizer_state.lock().unwrap();
        r_state.available = avail;
        r_state.rawaccel_gui_running = gui_running;
        r_state.error_message = err_msg;
    }

    if !was_enabled && is_enabled && avail {
        return randomizer::apply_next_sens(&app, None, None);
    } else if was_enabled && !is_enabled && avail {
        if let Some(ref dir) = found_dir {
            let _ = randomizer::restore_base_sens(dir);
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
        return Ok(new_state);
    }

    Ok(state.randomizer_state.lock().unwrap().clone())
}

#[tauri::command]
fn get_randomizer_state(state: State<'_, AppState>) -> Result<RandomizerState, String> {
    Ok(state.randomizer_state.lock().unwrap().clone())
}

#[tauri::command]
fn trigger_randomize_now(app: AppHandle) -> Result<RandomizerState, String> {
    randomizer::apply_next_sens(&app, None, None)
}

#[tauri::command]
fn detect_rawaccel_path(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let configured = state.settings.lock().unwrap().randomizer.rawaccel_dir.clone();
    let detected = randomizer::detect_rawaccel_dir(configured.as_deref());
    Ok(detected.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn test_rawaccel_writer(_app: AppHandle, state: State<'_, AppState>, path: Option<String>) -> Result<String, String> {
    let target_dir = match path {
        Some(p) if !p.trim().is_empty() => std::path::PathBuf::from(p),
        _ => {
            let s = state.settings.lock().unwrap();
            randomizer::detect_rawaccel_dir(s.randomizer.rawaccel_dir.as_deref())
                .ok_or_else(|| "Nenhum diretório do RawAccel encontrado para teste".to_string())?
        }
    };

    if !randomizer::is_valid_rawaccel_dir(&target_dir) {
        return Err(format!("Diretório inválido: writer.exe ou settings.json ausentes em {}", target_dir.display()));
    }

    let current_mult = state.randomizer_state.lock().unwrap().active_mult;
    randomizer::update_and_apply_scale(&target_dir, current_mult)?;
    Ok("Comunicação com o driver RawAccel testada com sucesso!".to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let mut data = storage::load_app_data(app.handle());
            let mut settings = storage::load_settings(app.handle());

            if watcher::migrate_existing_sensitivities(&mut data, settings.kovaak_stats_path.as_deref()) {
                let _ = storage::save_app_data(app.handle(), &data);
            }

            let (avail, found_dir, err_msg, gui_running) = randomizer::check_rawaccel_availability(settings.randomizer.rawaccel_dir.as_deref());

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
            };

            let is_randomizer_enabled = settings.randomizer.enabled;

            app.manage(AppState {
                data: Mutex::new(data),
                settings: Mutex::new(settings),
                watcher: Mutex::new(None),
                emitted: Mutex::new(HashSet::new()),
                randomizer_state: Mutex::new(initial_r_state),
            });

            if is_randomizer_enabled && avail {
                let handle = app.handle().clone();
                let _ = randomizer::apply_next_sens(&handle, None, None);
            }

            let open_item = MenuItemBuilder::with_id("open", "Abrir Aim Threshold Tracker").build(app)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Sair").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&open_item, &separator, &quit_item])
                .build()?;

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
            load_app_data,
            save_app_data,
            import_json_backup,
            detect_kovaak_path,
            get_kovaak_playlists,
            get_playlist_in_progress,
            get_settings,
            save_settings,
            set_stats_path,
            start_watcher,
            stop_watcher,
            get_watcher_status,
            import_existing_csvs,
            open_url,
            check_rawaccel_available,
            get_randomizer_settings,
            save_randomizer_settings,
            get_randomizer_state,
            trigger_randomize_now,
            detect_rawaccel_path,
            test_rawaccel_writer,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o aplicativo Tauri");
}