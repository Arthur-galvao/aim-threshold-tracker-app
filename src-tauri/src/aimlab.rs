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

#[tauri::command]
pub fn sync_aimlab_sqlite(app: AppHandle) -> Result<ImportStats, String> {
    let local_app_data = std::env::var("LOCALAPPDATA").map_err(|_| "LOCALAPPDATA not found".to_string())?;
    let aimlab_dir = PathBuf::from(&local_app_data).join("Low").join("Statespace").join("aimlab_tb").join("Users");
    
    if !aimlab_dir.exists() {
        return Err("Aim Lab users folder not found".to_string());
    }

    let mut db_path = None;
    if let Ok(entries) = fs::read_dir(&aimlab_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let p = entry.path().join("LocalDB").join("Klutch.bytes");
                if p.exists() {
                    db_path = Some(p);
                    break;
                }
            }
        }
    }

    let db_path = db_path.ok_or_else(|| "Klutch.bytes not found".to_string())?;

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
                source_file: "AimLab_SQLite".to_string(), // we might want a unique source_file ID!
            })
        }).map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut parsed_runs = Vec::new();
        for (i, run) in runs_iter.enumerate() {
            if let Ok(mut r) = run {
                // Aim Lab SQLite creates duplicate tasks if we just use "AimLab_SQLite".
                // KovaaK uses CSV filenames. For SQLite, we can use "AimLab_SQLite_index" but wait, index changes!
                // Best is "AimLab_" + datetime + score
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
