use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use rusqlite::{Connection, OpenFlags};
use chrono::NaiveDateTime;
use tauri::{AppHandle, Manager, State, Emitter};

use crate::model::{KovaakRun, ImportStats};
use crate::watcher::{has_source_file, add_session_to_data};
use crate::{AppState, storage};

#[derive(Debug, Serialize, Deserialize)]
pub struct AimlabCsvRecord {
    #[serde(rename = "TaskName")]
    pub task_name: String,
    #[serde(rename = "Score")]
    pub score: f64,
    #[serde(rename = "Sens")]
    pub sens: Option<f64>,
    #[serde(rename = "CreateDate")]
    pub create_date: String,
}

fn process_runs(app: &AppHandle, runs: Vec<KovaakRun>) -> Result<ImportStats, String> {
    let state: State<AppState> = app.state();
    let total = runs.len();
    let mut new = 0usize;
    let mut skipped = 0usize;

    for run in runs {
        let already = {
            let data = state.data.lock().unwrap();
            has_source_file(&data.tasks, &run.source_file)
        };

        if already {
            skipped += 1;
            continue;
        }

        add_session_to_data(&state, &run);
        new += 1;
    }

    if new > 0 {
        let data = state.data.lock().unwrap().clone();
        storage::save_app_data(app, &data).map_err(|e| e.to_string())?;
    }

    let stats = ImportStats { total, new, skipped };
    let _ = app.emit("import_complete", &stats);
    
    Ok(stats)
}

pub fn get_aimlab_users_dir() -> Option<PathBuf> {
    let mut candidates = Vec::new();

    // 1. Check USERPROFILE -> AppData\LocalLow\Statespace\aimlab_tb\Users
    if let Ok(profile) = std::env::var("USERPROFILE") {
        candidates.push(PathBuf::from(&profile).join("AppData").join("LocalLow").join("Statespace").join("aimlab_tb").join("Users"));
    }

    // 2. Check LOCALAPPDATA parent -> ..\LocalLow\Statespace\aimlab_tb\Users
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let local_path = PathBuf::from(&local_app_data);
        if let Some(parent) = local_path.parent() {
            candidates.push(parent.join("LocalLow").join("Statespace").join("aimlab_tb").join("Users"));
        }
        // Legacy fallback
        candidates.push(local_path.join("Low").join("Statespace").join("aimlab_tb").join("Users"));
    }

    // 3. Check APPDATA parent -> ..\LocalLow\Statespace\aimlab_tb\Users
    if let Ok(app_data) = std::env::var("APPDATA") {
        let app_path = PathBuf::from(&app_data);
        if let Some(parent) = app_path.parent() {
            candidates.push(parent.join("LocalLow").join("Statespace").join("aimlab_tb").join("Users"));
        }
    }

    for candidate in candidates {
        if candidate.exists() && candidate.is_dir() {
            return Some(candidate);
        }
    }

    None
}

pub fn find_best_aimlab_db(aimlab_dir: &std::path::Path) -> Option<PathBuf> {
    let mut found_dbs = Vec::new();

    if let Ok(entries) = fs::read_dir(aimlab_dir) {
        for entry in entries.flatten() {
            let user_dir = entry.path();
            if user_dir.is_dir() {
                let is_default = user_dir
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.eq_ignore_ascii_case("default"))
                    .unwrap_or(false);

                let local_db = user_dir.join("LocalDB");
                for fname in &["Klutch.bytes", "klutch.bytes", "Klutch.db", "klutch.db"] {
                    let candidate = local_db.join(fname);
                    if candidate.exists() && candidate.is_file() {
                        let metadata = candidate.metadata().ok();
                        let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                        let modified = metadata
                            .as_ref()
                            .and_then(|m| m.modified().ok())
                            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                        found_dbs.push((candidate, !is_default, size, modified));
                        break;
                    }
                }
            }
        }
    }

    // Sort: 1. Non-default users first, 2. Largest file first, 3. Most recently modified first
    found_dbs.sort_by(|a, b| {
        b.1.cmp(&a.1)
            .then_with(|| b.2.cmp(&a.2))
            .then_with(|| b.3.cmp(&a.3))
    });

    found_dbs.into_iter().next().map(|(path, _, _, _)| path)
}

#[tauri::command]
pub fn sync_aimlab_sqlite(app: AppHandle) -> Result<ImportStats, String> {
    let aimlab_dir = get_aimlab_users_dir().ok_or_else(|| {
        "Pasta Users do Aim Lab não encontrada (%USERPROFILE%\\AppData\\LocalLow\\Statespace\\aimlab_tb\\Users)".to_string()
    })?;

    let db_path = find_best_aimlab_db(&aimlab_dir).ok_or_else(|| {
        "Arquivo Klutch.bytes não encontrado na pasta de usuários do Aim Lab".to_string()
    })?;

    let temp_db_path = std::env::temp_dir().join(format!("temp_klutch_{}.bytes", chrono::Utc::now().timestamp_millis()));
    fs::copy(&db_path, &temp_db_path).map_err(|e| format!("Failed to copy DB: {}", e))?;

    let runs_result = (|| -> Result<Vec<KovaakRun>, String> {
        let conn = Connection::open_with_flags(&temp_db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| format!("Failed to open DB: {}", e))?;

        let mut stmt = conn.prepare("SELECT taskName, score, createDate, performance FROM TaskData")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let runs_iter = stmt.query_map([], |row| {
            let task_name: String = row.get(0)?;
            let score: f64 = row.get(1)?;
            let create_date: String = row.get(2)?;
            Ok(KovaakRun {
                scenario: task_name,
                score,
                sens: 0.0,
                fov: 0.0,
                datetime: create_date,
                source_file: "AimLab_SQLite".to_string(),
            })
        }).map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut parsed_runs = Vec::new();
        for (_i, run) in runs_iter.enumerate() {
            if let Ok(mut r) = run {
                r.source_file = format!("AimLab_{}_{}_{}", r.scenario, r.score, r.datetime).replace(" ", "_");
                
                if let Ok(ndt) = NaiveDateTime::parse_from_str(&r.datetime, "%Y-%m-%d %H:%M:%S") {
                    r.datetime = ndt.format("%Y-%m-%dT%H:%M:%SZ").to_string();
                }
                parsed_runs.push(r);
            }
        }
        Ok(parsed_runs)
    })();

    let _ = fs::remove_file(temp_db_path);

    process_runs(&app, runs_result?)
}

#[tauri::command]
pub fn import_aimlab_csv(app: AppHandle, path: String) -> Result<ImportStats, String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .from_path(&path)
        .map_err(|e| format!("Falha ao ler CSV: {}", e))?;

    let mut parsed_runs = Vec::new();
    let file_name = PathBuf::from(&path).file_name().unwrap_or_default().to_string_lossy().into_owned();

    for (i, result) in reader.deserialize::<AimlabCsvRecord>().enumerate() {
        if let Ok(record) = result {
            let mut datetime = record.create_date;
            if let Ok(ndt) = NaiveDateTime::parse_from_str(&datetime, "%Y-%m-%d %H:%M:%S") {
                datetime = ndt.format("%Y-%m-%dT%H:%M:%SZ").to_string();
            }

            parsed_runs.push(KovaakRun {
                scenario: record.task_name,
                score: record.score,
                sens: record.sens.unwrap_or(0.0),
                fov: 0.0,
                datetime,
                source_file: format!("CSV_{}_{}", file_name, i),
            });
        }
    }

    process_runs(&app, parsed_runs)
}

fn scan_aimlab_playlist_dir(dir: &std::path::Path, playlists: &mut Vec<crate::model::GamePlaylist>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_aimlab_playlist_dir(&path, playlists);
            } else if path.extension().and_then(|s| s.to_str()).map(|s| s.eq_ignore_ascii_case("json")) == Some(true) {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(parsed) = serde_json::from_str::<crate::model::GamePlaylist>(&content) {
                        if !parsed.playlist_name.trim().is_empty() && !parsed.scenario_list.is_empty() {
                            if !playlists.iter().any(|p| p.playlist_id == parsed.playlist_id && p.playlist_name == parsed.playlist_name) {
                                playlists.push(parsed);
                            }
                        }
                    }
                }
            }
        }
    }
}

pub fn load_all_aimlab_playlists() -> Vec<crate::model::GamePlaylist> {
    let mut playlists = Vec::new();
    
    let users_dir = match get_aimlab_users_dir() {
        Some(dir) => dir,
        None => return playlists,
    };
    
    if let Ok(entries) = fs::read_dir(&users_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let user_dir = entry.path();
                scan_aimlab_playlist_dir(&user_dir.join("Playlists"), &mut playlists);
                scan_aimlab_playlist_dir(&user_dir.join("PathProgression"), &mut playlists);
            }
        }
    }
    
    playlists.sort_by(|a, b| a.playlist_name.to_lowercase().cmp(&b.playlist_name.to_lowercase()));
    playlists
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_aimlab_playlist() {
        let sample = r#"{
          "playlistName": "Warm-up pessoal",
          "playlistId": "940af050-d2ab-412f-8f37-2ad74a28d161",
          "playlist": [
            {
              "taskName": "VT Wrist Smoothness Entry",
              "repetitions": 2
            }
          ]
        }"#;
        
        let parsed: crate::model::GamePlaylist = serde_json::from_str(sample).expect("failed to parse playlist");
        assert_eq!(parsed.playlist_name, "Warm-up pessoal");
        assert_eq!(parsed.scenario_list.len(), 1);
        assert_eq!(parsed.scenario_list[0].scenario_name, "VT Wrist Smoothness Entry");
        assert_eq!(parsed.scenario_list[0].play_count, 2.0);
    }

    #[test]
    fn test_aimlab_users_dir_detection() {
        if let Some(dir) = get_aimlab_users_dir() {
            assert!(dir.exists(), "Detected Aim Lab dir must exist on disk");
            assert!(dir.is_dir(), "Detected Aim Lab path must be a directory");
            assert!(
                dir.to_string_lossy().to_lowercase().contains("users"),
                "Detected Aim Lab dir must contain 'Users'"
            );
        }
    }

    #[test]
    fn test_find_best_aimlab_db_when_installed() {
        if let Some(dir) = get_aimlab_users_dir() {
            if let Some(best_db) = find_best_aimlab_db(&dir) {
                assert!(best_db.exists(), "Detected Aim Lab DB file must exist");
                let path_str = best_db.to_string_lossy().to_lowercase();
                assert!(
                    path_str.ends_with(".bytes") || path_str.ends_with(".db"),
                    "Detected DB file must end with .bytes or .db"
                );
            }
        }
    }

    #[test]
    fn test_load_all_aimlab_playlists_when_installed() {
        if get_aimlab_users_dir().is_some() {
            let playlists = load_all_aimlab_playlists();
            assert!(!playlists.is_empty(), "Should load playlists when Aim Lab is installed");
        }
    }
}
