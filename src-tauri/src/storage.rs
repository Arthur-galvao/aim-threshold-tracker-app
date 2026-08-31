use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::model::{AppData, AppSettings};

pub fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Falha ao resolver app_data_dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Falha ao criar app_data_dir: {e}"))?;
    Ok(dir)
}

pub fn load_app_data(app: &AppHandle) -> AppData {
    match data_dir(app).and_then(|d| read_json(d.join("app_data.json"))) {
        Ok(data) => data,
        Err(_) => AppData::default(),
    }
}

pub fn save_app_data(app: &AppHandle, data: &AppData) -> Result<(), String> {
    let dir = data_dir(app)?;
    write_json(&dir.join("app_data.json"), data)
}

pub fn load_settings(app: &AppHandle) -> AppSettings {
    match data_dir(app).and_then(|d| read_json(d.join("settings.json"))) {
        Ok(s) => s,
        Err(_) => AppSettings::default(),
    }
}

pub fn save_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let dir = data_dir(app)?;
    write_json(&dir.join("settings.json"), settings)
}

fn read_json<T: serde::de::DeserializeOwned>(path: PathBuf) -> Result<T, String> {
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

fn write_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}