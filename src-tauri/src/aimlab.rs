use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use rusqlite::{Connection, OpenFlags};
use chrono::NaiveDateTime;
use tauri::{AppHandle, Manager, State, Emitter};

use crate::model::{KovaakRun, ImportStats, AppData};
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
        let mut data = state.data.lock().unwrap().clone();
        migrate_existing_aimlab_tasks(&mut data);
        *state.data.lock().unwrap() = data.clone();
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

pub fn find_aimlab_workshop_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    let base_candidates = [
        PathBuf::from(r"C:\Program Files (x86)\Steam"),
        PathBuf::from(r"C:\Program Files\Steam"),
    ];

    for base in &base_candidates {
        let workshop_dir = base.join("steamapps").join("workshop").join("content").join("714010");
        if workshop_dir.exists() && workshop_dir.is_dir() && !dirs.contains(&workshop_dir) {
            dirs.push(workshop_dir);
        }

        let cache_maps = base
            .join("steamapps")
            .join("common")
            .join("Aim Lab")
            .join("aimlab_tb_Data")
            .join("StreamingAssets")
            .join("WorkshopCache")
            .join("maps");
        if cache_maps.exists() && cache_maps.is_dir() && !dirs.contains(&cache_maps) {
            dirs.push(cache_maps);
        }

        let lib_vdf = base.join("steamapps").join("libraryfolders.vdf");
        if lib_vdf.exists() {
            if let Ok(content) = fs::read_to_string(&lib_vdf) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("\"path\"") {
                        if let Some(path_str) = trimmed.split('"').nth(3) {
                            let custom_ws = PathBuf::from(path_str)
                                .join("steamapps")
                                .join("workshop")
                                .join("content")
                                .join("714010");
                            if custom_ws.exists() && custom_ws.is_dir() && !dirs.contains(&custom_ws) {
                                dirs.push(custom_ws);
                            }
                        }
                    }
                }
            }
        }
    }

    dirs
}

fn scan_playlist_files_for_mapping(dir: &std::path::Path, map: &mut HashMap<String, String>) {
    if !dir.exists() {
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_playlist_files_for_mapping(&path, map);
            } else if path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("json")) == Some(true) {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(arr) = val.get("playlist").and_then(|p| p.as_array()) {
                            for item in arr {
                                let task_name = item.get("taskName").and_then(|v| v.as_str()).map(|s| s.trim());
                                if let Some(name) = task_name {
                                    if !name.is_empty() && !name.starts_with("CsLevel") {
                                        if let Some(cid) = item.get("csContentId").and_then(|v| v.as_str()) {
                                            map.insert(cid.trim().to_string(), name.to_string());
                                        }
                                        if let Some(pid) = item.get("publishFileId").and_then(|v| v.as_str()) {
                                            map.insert(pid.trim().to_string(), name.to_string());
                                        }
                                        if let Some(tid) = item.get("TaskID").and_then(|v| v.as_str()) {
                                            map.insert(tid.trim().to_string(), name.to_string());
                                        }
                                        if let Some(tp) = item.get("taskPath").and_then(|v| v.as_str()) {
                                            let clean_tp = tp.trim().trim_end_matches(['/', '\\']);
                                            if let Some(last_seg) = clean_tp.split(['/', '\\']).last() {
                                                if !last_seg.is_empty() {
                                                    map.insert(last_seg.to_string(), name.to_string());
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

pub fn build_aimlab_scenario_map() -> HashMap<String, String> {
    let mut map = HashMap::new();

    // 1. Scan Steam Workshop directories
    for workshop_dir in find_aimlab_workshop_dirs() {
        if let Ok(entries) = fs::read_dir(&workshop_dir) {
            for entry in entries.flatten() {
                let item_dir = entry.path();
                if !item_dir.is_dir() {
                    continue;
                }

                let folder_id = item_dir
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or_default()
                    .to_string();

                let mut real_name: Option<String> = None;

                let xml_path = item_dir.join("WorkshopItemInfo.xml");
                if xml_path.exists() {
                    if let Ok(xml_content) = fs::read_to_string(&xml_path) {
                        if let Some(start) = xml_content.find("<Name>") {
                            if let Some(end) = xml_content[start + 6..].find("</Name>") {
                                let name = xml_content[start + 6..start + 6 + end].trim();
                                if !name.is_empty() {
                                    real_name = Some(name.to_string());
                                }
                            }
                        }
                    }
                }

                if let Some(name) = real_name {
                    if !folder_id.is_empty() {
                        map.insert(folder_id, name.clone());
                    }

                    let levels_dir = item_dir.join("Levels");
                    if levels_dir.exists() && levels_dir.is_dir() {
                        if let Ok(level_entries) = fs::read_dir(&levels_dir) {
                            for lvl in level_entries.flatten() {
                                if let Some(lvl_name) = lvl.file_name().to_str() {
                                    map.insert(lvl_name.to_string(), name.clone());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Scan Aim Lab User Playlists and PathProgression
    if let Some(users_dir) = get_aimlab_users_dir() {
        if let Ok(user_entries) = fs::read_dir(&users_dir) {
            for u in user_entries.flatten() {
                if !u.path().is_dir() {
                    continue;
                }
                for subfolder in &["Playlists", "PathProgression"] {
                    let sub_dir = u.path().join(subfolder);
                    scan_playlist_files_for_mapping(&sub_dir, &mut map);
                }
            }
        }
    }

    map
}

pub fn clean_aimlab_task_name(raw: &str, map: &HashMap<String, String>) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    // 1. Direct match in lookup map
    if let Some(clean) = map.get(trimmed) {
        if !clean.is_empty() {
            return clean.clone();
        }
    }

    // 2. Structured dotted pattern: CsLevel.<author>.<scenario>.<hash/code>
    // e.g. CsLevel.Lowgravity56.VT Suave.RX1H0T -> "VT Suave"
    // e.g. CsLevel.VT Empyrean.VT Float.QZWM5U -> "VT Float"
    // e.g. CsLevel.morcaillionaire.rA Twosh.RCGDKY -> "rA Twosh"
    if trimmed.starts_with("CsLevel.") {
        let parts: Vec<&str> = trimmed.split('.').collect();
        if parts.len() >= 4 {
            let middle_parts = &parts[2..parts.len() - 1];
            let middle = middle_parts.join(".").trim().to_string();
            if !middle.is_empty() {
                return middle;
            }
        } else if parts.len() == 3 {
            let middle = parts[1].trim();
            if !middle.is_empty() {
                return middle.to_string();
            }
        }
    }

    // 3. UUID or simple prefix: CsLevel<guid> -> remove CsLevel prefix
    if trimmed.starts_with("CsLevel") {
        let stripped = trimmed
            .strip_prefix("CsLevel")
            .unwrap_or(trimmed)
            .trim_start_matches(|c| c == '-' || c == '_' || c == '.')
            .trim();
        if !stripped.is_empty() {
            return stripped.to_string();
        }
    }

    trimmed.to_string()
}

pub fn migrate_existing_aimlab_tasks(data: &mut AppData) -> bool {
    let has_cs_level = data.tasks.iter().any(|t| t.name.starts_with("CsLevel"));
    if !has_cs_level {
        return false;
    }

    let map = build_aimlab_scenario_map();
    let mut changed = false;

    // 1. Rename tasks
    for task in &mut data.tasks {
        if task.name.starts_with("CsLevel") {
            let clean = clean_aimlab_task_name(&task.name, &map);
            if clean != task.name {
                task.name = clean;
                changed = true;
            }
        }
    }

    // 2. Deduplicate tasks that now have identical names (case-insensitive)
    let mut deduplicated: Vec<crate::model::Task> = Vec::new();
    let mut id_redirects: HashMap<String, String> = HashMap::new();

    for task in data.tasks.drain(..) {
        if let Some(existing) = deduplicated.iter_mut().find(|t| t.name.eq_ignore_ascii_case(&task.name)) {
            id_redirects.insert(task.id, existing.id.clone());
            for sess in task.sessions {
                let is_dup = existing.sessions.iter().any(|s| {
                    (s.source_file.is_some() && s.source_file == sess.source_file)
                        || (s.date == sess.date && (s.pb - sess.pb).abs() < f64::EPSILON)
                });
                if !is_dup {
                    existing.sessions.push(sess);
                }
            }
            changed = true;
        } else {
            deduplicated.push(task);
        }
    }
    data.tasks = deduplicated;

    // 3. Update active_task_id if redirected
    if let Some(ref current_id) = data.active_task_id {
        if let Some(target_id) = id_redirects.get(current_id) {
            data.active_task_id = Some(target_id.clone());
        }
    }

    // 4. Update playlists item taskIds
    for pl in &mut data.playlists {
        for item in &mut pl.items {
            if let Some(target_id) = id_redirects.get(&item.task_id) {
                item.task_id = target_id.clone();
            }
        }
    }

    changed
}

#[tauri::command]
pub fn sync_aimlab_sqlite(app: AppHandle) -> Result<ImportStats, String> {
    let aimlab_dir = get_aimlab_users_dir().ok_or_else(|| {
        "Pasta Users do Aim Lab não encontrada (%USERPROFILE%\\AppData\\LocalLow\\Statespace\\aimlab_tb\\Users)".to_string()
    })?;

    let db_path = find_best_aimlab_db(&aimlab_dir).ok_or_else(|| {
        "Arquivo Klutch.bytes não encontrado na pasta de usuários do Aim Lab".to_string()
    })?;

    let name_map = build_aimlab_scenario_map();

    let temp_db_path = std::env::temp_dir().join(format!("temp_klutch_{}.bytes", chrono::Utc::now().timestamp_millis()));
    fs::copy(&db_path, &temp_db_path).map_err(|e| format!("Failed to copy DB: {}", e))?;

    let runs_result = (|| -> Result<Vec<KovaakRun>, String> {
        let conn = Connection::open_with_flags(&temp_db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| format!("Failed to open DB: {}", e))?;

        let mut stmt = conn.prepare("SELECT taskName, score, createDate, performance FROM TaskData")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let runs_iter = stmt.query_map([], |row| {
            let raw_task_name: String = row.get(0)?;
            let cleaned_task_name = clean_aimlab_task_name(&raw_task_name, &name_map);
            let score: f64 = row.get(1)?;
            let create_date: String = row.get(2)?;
            Ok(KovaakRun {
                scenario: cleaned_task_name,
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

    let name_map = build_aimlab_scenario_map();
    let mut parsed_runs = Vec::new();
    let file_name = PathBuf::from(&path).file_name().unwrap_or_default().to_string_lossy().into_owned();

    for (i, result) in reader.deserialize::<AimlabCsvRecord>().enumerate() {
        if let Ok(record) = result {
            let mut datetime = record.create_date;
            if let Ok(ndt) = NaiveDateTime::parse_from_str(&datetime, "%Y-%m-%d %H:%M:%S") {
                datetime = ndt.format("%Y-%m-%dT%H:%M:%SZ").to_string();
            }

            let cleaned_task_name = clean_aimlab_task_name(&record.task_name, &name_map);

            parsed_runs.push(KovaakRun {
                scenario: cleaned_task_name,
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

    #[test]
    fn test_clean_aimlab_task_name() {
        let mut map = HashMap::new();
        map.insert("CsLevel.VT Empyrean.VT Float.QZWM5U".to_string(), "VT Floating Dots".to_string());
        map.insert("2912101821".to_string(), "VT Siniclick Valorant".to_string());

        // 1. Direct map resolution
        assert_eq!(clean_aimlab_task_name("CsLevel.VT Empyrean.VT Float.QZWM5U", &map), "VT Floating Dots");

        // 2. Structured dotted fallback
        assert_eq!(clean_aimlab_task_name("CsLevel.Lowgravity56.VT Suave.RX1H0T", &map), "VT Suave");
        assert_eq!(clean_aimlab_task_name("CsLevel.morcaillionaire.rA Twosh.RCGDKY", &map), "rA Twosh");
        assert_eq!(clean_aimlab_task_name("CsLevel.Lowgravity56.Mini's H.RVK2R3", &map), "Mini's H");

        // 3. Simple GUID / UUID prefix
        assert_eq!(clean_aimlab_task_name("CsLevel2ea08b52-c743-4474-82f1-c965bf42d35f", &map), "2ea08b52-c743-4474-82f1-c965bf42d35f");

        // 4. Clean names kept as-is
        assert_eq!(clean_aimlab_task_name("1w2ts Pasu", &map), "1w2ts Pasu");
        assert_eq!(clean_aimlab_task_name("SpiderShot", &map), "SpiderShot");
    }

    #[test]
    fn test_migrate_existing_aimlab_tasks_deduplicates() {
        use crate::model::{AppData, Task, Session};

        let mut data = AppData {
            active_task_id: Some("task_legacy".into()),
            tasks: vec![
                Task {
                    id: "task_clean".into(),
                    name: "VT Suave".into(),
                    category: "Flick Tech".into(),
                    subcategory: "Speed".into(),
                    sessions: vec![
                        Session {
                            id: "s1".into(),
                            date: "2026-10-01".into(),
                            sens: 45.0,
                            pb: 1000.0,
                            threshold: 950.0,
                            source_file: Some("s1.csv".into()),
                        }
                    ],
                },
                Task {
                    id: "task_legacy".into(),
                    name: "CsLevel.Lowgravity56.VT Suave.RX1H0T".into(),
                    category: "Click Timing".into(),
                    subcategory: "Precision".into(),
                    sessions: vec![
                        Session {
                            id: "s2".into(),
                            date: "2026-10-02".into(),
                            sens: 45.0,
                            pb: 1050.0,
                            threshold: 980.0,
                            source_file: Some("s2.csv".into()),
                        }
                    ],
                },
            ],
            playlists: vec![],
        };

        let changed = migrate_existing_aimlab_tasks(&mut data);
        assert!(changed);
        assert_eq!(data.tasks.len(), 1);
        assert_eq!(data.tasks[0].name, "VT Suave");
        assert_eq!(data.tasks[0].sessions.len(), 2);
        assert_eq!(data.active_task_id, Some("task_clean".into()));
    }
}
