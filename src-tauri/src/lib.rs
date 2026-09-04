mod kovaaak;
mod model;
mod parser;
mod storage;
mod watcher;

use std::collections::HashSet;
use std::sync::Mutex;

use tauri::{AppHandle, Manager, State};

use model::{AppData, AppSettings, ImportStats, WatcherStatus};

pub struct AppState {
    pub data: Mutex<AppData>,
    pub settings: Mutex<AppSettings>,
    pub watcher: Mutex<Option<watcher::WatcherHandle>>,
    pub emitted: Mutex<HashSet<String>>,
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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let data = storage::load_app_data(app.handle());
            let settings = storage::load_settings(app.handle());
            app.manage(AppState {
                data: Mutex::new(data),
                settings: Mutex::new(settings),
                watcher: Mutex::new(None),
                emitted: Mutex::new(HashSet::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_app_data,
            save_app_data,
            import_json_backup,
            detect_kovaak_path,
            get_settings,
            save_settings,
            set_stats_path,
            start_watcher,
            stop_watcher,
            get_watcher_status,
            import_existing_csvs,
            open_url,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o aplicativo Tauri");
}