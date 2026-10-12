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

pub fn sanitize_app_data(data: &mut AppData) -> bool {
    let mut changed = false;
    let mut seen_task_ids = std::collections::HashSet::new();
    let mut seen_session_ids = std::collections::HashSet::new();

    for task in &mut data.tasks {
        if task.id.is_empty() || seen_task_ids.contains(&task.id) {
            task.id = crate::watcher::unique_id("task");
            changed = true;
        }
        seen_task_ids.insert(task.id.clone());

        for session in &mut task.sessions {
            if session.id.is_empty() || seen_session_ids.contains(&session.id) {
                session.id = crate::watcher::unique_id("sess");
                changed = true;
            }
            seen_session_ids.insert(session.id.clone());
        }
    }

    changed
}

pub fn load_app_data(app: &AppHandle) -> AppData {
    let mut data: AppData = data_dir(app)
        .and_then(|d| read_json(d.join("app_data.json")))
        .unwrap_or_default();
    if sanitize_app_data(&mut data) {
        let _ = save_app_data(app, &data);
    }
    data
}

pub fn save_app_data(app: &AppHandle, data: &AppData) -> Result<(), String> {
    let dir = data_dir(app)?;
    write_json(&dir.join("app_data.json"), data)
}

pub fn load_settings(app: &AppHandle) -> AppSettings {
    data_dir(app)
        .and_then(|d| read_json(d.join("settings.json")))
        .unwrap_or_default()
}

pub fn save_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let dir = data_dir(app)?;
    write_json(&dir.join("settings.json"), settings)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RawAccelBackup {
    pub output_dpi: Option<f64>,
    pub scale_whole: Option<f64>,
    pub scale_vert: Option<f64>,
    pub last_written_output_dpi: Option<f64>,
    pub last_written_scale: Option<f64>,
    pub saved_at: String,
}

pub fn load_rawaccel_backup(app: &AppHandle) -> Option<RawAccelBackup> {
    data_dir(app).ok().and_then(|d| read_json(d.join("rawaccel_backup.json")).ok())
}

pub fn save_rawaccel_backup(app: &AppHandle, backup: &RawAccelBackup) -> Result<(), String> {
    let dir = data_dir(app)?;
    write_json(&dir.join("rawaccel_backup.json"), backup)
}

fn read_json<T: serde::de::DeserializeOwned>(path: PathBuf) -> Result<T, String> {
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

fn write_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Session, Task};

    #[test]
    fn test_sanitize_app_data_deduplicates_tasks_and_sessions() {
        let mut data = AppData {
            active_task_id: Some("task_1".into()),
            tasks: vec![
                Task {
                    id: "task_dupe".into(),
                    name: "Task A".into(),
                    category: "Clicking".into(),
                    subcategory: "Precision".into(),
                    sessions: vec![
                        Session {
                            id: "sess_dupe".into(),
                            date: "2026-10-10".into(),
                            sens: 50.0,
                            pb: 100.0,
                            threshold: 90.0,
                            source_file: None,
                        },
                    ],
                },
                Task {
                    id: "task_dupe".into(),
                    name: "Task B".into(),
                    category: "Clicking".into(),
                    subcategory: "Precision".into(),
                    sessions: vec![
                        Session {
                            id: "sess_dupe".into(),
                            date: "2026-10-10".into(),
                            sens: 50.0,
                            pb: 110.0,
                            threshold: 95.0,
                            source_file: None,
                        },
                    ],
                },
            ],
            playlists: vec![],
        };

        let changed = sanitize_app_data(&mut data);
        assert!(changed);
        assert_ne!(data.tasks[0].id, data.tasks[1].id);
        assert_ne!(data.tasks[0].sessions[0].id, data.tasks[1].sessions[0].id);
        assert_eq!(data.tasks[0].id, "task_dupe");
        assert!(data.tasks[1].id.starts_with("task_"));
    }
}