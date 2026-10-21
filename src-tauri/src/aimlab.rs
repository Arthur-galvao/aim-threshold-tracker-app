use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use rusqlite::{Connection, OpenFlags};
use chrono::{DateTime, NaiveDateTime, Utc};
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
            if run.sens > 0.0 {
                let mut data = state.data.lock().unwrap();
                let mut updated_sens = false;
                for task in &mut data.tasks {
                    for session in &mut task.sessions {
                        if session.source_file.as_deref() == Some(&run.source_file)
                            && session.sens <= 0.0
                        {
                            session.sens = run.sens;
                            updated_sens = true;
                        }
                    }
                }
                if updated_sens {
                    new += 1;
                    continue;
                }
            }
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

pub fn find_best_aimlab_db(aimlab_dir: &Path) -> Option<PathBuf> {
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

pub fn find_active_aimlab_replay_dir() -> Option<PathBuf> {
    let users_dir = get_aimlab_users_dir()?;
    if let Some(best_db) = find_best_aimlab_db(&users_dir) {
        if let Some(user_dir) = best_db.parent().and_then(|p| p.parent()) {
            let replay_dir = user_dir.join("Replay");
            if replay_dir.exists() && replay_dir.is_dir() {
                return Some(replay_dir);
            }
        }
    }

    if let Ok(entries) = fs::read_dir(&users_dir) {
        for entry in entries.flatten() {
            let replay_dir = entry.path().join("Replay");
            if replay_dir.exists() && replay_dir.is_dir() {
                return Some(replay_dir);
            }
        }
    }

    None
}

pub fn parse_hipfire_sens_cm(
    hipfire_json: Option<&str>,
    dpi: Option<f64>,
    game_profile: Option<&str>,
    fallback_dpi: f64,
) -> f64 {
    let raw_str = match hipfire_json {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => return 0.0,
    };

    let raw_sens = if let Ok(val) = serde_json::from_str::<serde_json::Value>(raw_str) {
        val.get("x")
            .and_then(|v| v.as_f64())
            .or_else(|| val.get("y").and_then(|v| v.as_f64()))
            .or_else(|| val.as_f64())
            .unwrap_or(0.0)
    } else {
        raw_str.parse::<f64>().unwrap_or(0.0)
    };

    if raw_sens <= 0.0 {
        return 0.0;
    }

    let effective_dpi = dpi
        .filter(|&d| d > 0.0)
        .unwrap_or(if fallback_dpi > 0.0 { fallback_dpi } else { 800.0 });
    let profile = game_profile.filter(|p| !p.trim().is_empty()).or(Some("Valorant"));

    crate::parser::convert_sens_to_cm(raw_sens, profile, effective_dpi)
}

pub fn read_aimlab_profile_defaults(users_dir: &Path, fallback_dpi: f64) -> (f64, String, f64) {
    let mut settings_files = Vec::new();

    if let Ok(entries) = fs::read_dir(users_dir) {
        for entry in entries.flatten() {
            let user_dir = entry.path();
            if user_dir.is_dir() {
                let is_default = user_dir
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.eq_ignore_ascii_case("default"))
                    .unwrap_or(false);
                let p = user_dir.join("WindowsPlayer_PlayerSettingsData.json");
                if p.exists() && p.is_file() {
                    let modified = p
                        .metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                    settings_files.push((p, !is_default, modified));
                }
            }
        }
    }

    settings_files.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| b.2.cmp(&a.2)));

    for (path, _, _) in settings_files {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(cs) = val.get("controlSettings") {
                    let game_profile = cs
                        .get("gameProfile")
                        .and_then(|v| v.as_str())
                        .unwrap_or("VALORANT")
                        .to_string();
                    let dpi = cs
                        .get("mouseCounts")
                        .and_then(|v| v.as_f64())
                        .filter(|&d| d > 0.0)
                        .unwrap_or(if fallback_dpi > 0.0 { fallback_dpi } else { 800.0 });
                    let sens_x = cs
                        .get("mouseSensitivityX")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0);
                    let fov = cs
                        .get("fieldOfView")
                        .and_then(|v| v.as_f64())
                        .unwrap_or(70.53);
                    let cm = crate::parser::convert_sens_to_cm(sens_x, Some(&game_profile), dpi);
                    if cm > 0.0 {
                        return (cm, game_profile, fov);
                    }
                }
            }
        }
    }

    (0.0, "VALORANT".to_string(), 70.53)
}

pub fn build_replay_sens_map(users_dir: &Path, fallback_dpi: f64) -> HashMap<String, (f64, f64)> {
    let mut map = HashMap::new();

    if let Ok(user_entries) = fs::read_dir(users_dir) {
        for u in user_entries.flatten() {
            let replay_dir = u.path().join("Replay");
            if !replay_dir.is_dir() {
                continue;
            }
            if let Ok(files) = fs::read_dir(&replay_dir) {
                for f in files.flatten() {
                    let p = f.path();
                    if p.extension().and_then(|e| e.to_str()).map(|s| s.eq_ignore_ascii_case("json")) != Some(true) {
                        continue;
                    }
                    let play_id = p
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or_default()
                        .to_string();
                    if play_id.is_empty() {
                        continue;
                    }
                    if let Ok(content) = fs::read_to_string(&p) {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(cs) = val.get("userSettings").and_then(|us| us.get("controlSettings")) {
                                let profile = cs.get("gameProfile").and_then(|v| v.as_str()).unwrap_or("VALORANT");
                                let dpi = cs
                                    .get("mouseCounts")
                                    .and_then(|v| v.as_f64())
                                    .filter(|&d| d > 0.0)
                                    .unwrap_or(if fallback_dpi > 0.0 { fallback_dpi } else { 800.0 });
                                let sens_x = cs.get("mouseSensitivityX").and_then(|v| v.as_f64()).unwrap_or(0.0);
                                let fov = cs.get("fieldOfView").and_then(|v| v.as_f64()).unwrap_or(70.53);
                                let cm = crate::parser::convert_sens_to_cm(sens_x, Some(profile), dpi);
                                if cm > 0.0 {
                                    map.insert(play_id, (cm, fov));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    map
}

pub fn parse_aimlab_replay_file(
    path: &Path,
    map: &HashMap<String, String>,
    fallback_dpi: f64,
) -> Option<KovaakRun> {
    let content = fs::read_to_string(path).ok()?;
    let val: serde_json::Value = serde_json::from_str(&content).ok()?;

    let score = val.get("score").and_then(|v| v.as_f64())?;
    let raw_task_id = val.get("taskId").and_then(|v| v.as_str()).unwrap_or_default();
    let raw_task_name = val.get("taskName").and_then(|v| v.as_str()).unwrap_or_default().trim();

    let scenario = if !raw_task_name.is_empty()
        && !raw_task_name.eq_ignore_ascii_case("TASK NOT FOUND")
        && !raw_task_name.starts_with("CsLevel")
    {
        raw_task_name.to_string()
    } else if !raw_task_id.is_empty() {
        clean_aimlab_task_name(raw_task_id, map)
    } else {
        return None;
    };

    if scenario.is_empty() {
        return None;
    }

    let (sens, fov) = val
        .get("userSettings")
        .and_then(|us| us.get("controlSettings"))
        .map(|cs| {
            let profile = cs.get("gameProfile").and_then(|v| v.as_str()).unwrap_or("VALORANT");
            let dpi = cs
                .get("mouseCounts")
                .and_then(|v| v.as_f64())
                .filter(|&d| d > 0.0)
                .unwrap_or(if fallback_dpi > 0.0 { fallback_dpi } else { 800.0 });
            let sens_x = cs.get("mouseSensitivityX").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let fov_val = cs.get("fieldOfView").and_then(|v| v.as_f64()).unwrap_or(70.53);
            let cm = crate::parser::convert_sens_to_cm(sens_x, Some(profile), dpi);
            (cm, fov_val)
        })
        .unwrap_or((0.0, 70.53));

    // Extract timestamp matching AimLab SQLite createDate ("YYYY-MM-DD HH:MM:SS") when possible
    let mut db_datetime_str: Option<String> = None;
    if let Some(create_date_str) = val
        .get("userSkills")
        .and_then(|us| us.get("create_date"))
        .and_then(|v| v.as_str())
    {
        if let Ok(ndt) = NaiveDateTime::parse_from_str(create_date_str.trim(), "%m/%d/%Y %H:%M:%S") {
            db_datetime_str = Some(ndt.format("%Y-%m-%d %H:%M:%S").to_string());
        }
    }

    if db_datetime_str.is_none() {
        if let Some(ended_ms) = val
            .get("endedAt")
            .and_then(|v| v.as_i64())
            .or_else(|| val.get("sentAt").and_then(|v| v.as_i64()))
        {
            if let Some(dt) = DateTime::<Utc>::from_timestamp_millis(ended_ms) {
                db_datetime_str = Some(dt.format("%Y-%m-%d %H:%M:%S").to_string());
            }
        }
    }

    let raw_dt = db_datetime_str.unwrap_or_else(|| Utc::now().format("%Y-%m-%d %H:%M:%S").to_string());
    let iso_dt = NaiveDateTime::parse_from_str(&raw_dt, "%Y-%m-%d %H:%M:%S")
        .map(|ndt| ndt.format("%Y-%m-%dT%H:%M:%SZ").to_string())
        .unwrap_or_else(|_| raw_dt.clone());

    let source_file = format!("AimLab_{}_{}_{}", scenario, score, raw_dt).replace(' ', "_");

    Some(KovaakRun {
        scenario,
        score,
        sens,
        fov,
        datetime: iso_dt,
        source_file,
    })
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

fn scan_playlist_files_for_mapping(dir: &Path, map: &mut HashMap<String, String>) {
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
                                            if let Some(last_seg) = clean_tp.split(['/', '\\']).next_back() {
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

fn extract_xml_name(xml_path: &Path) -> Option<String> {
    if !xml_path.exists() {
        return None;
    }
    let xml_content = fs::read_to_string(xml_path).ok()?;
    let start = xml_content.find("<Name>")?;
    let end = xml_content[start + 6..].find("</Name>")?;
    let name = xml_content[start + 6..start + 6 + end].trim();
    if name.is_empty() {
        None
    } else {
        Some(name.to_string())
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

                if let Some(name) = extract_xml_name(&item_dir.join("WorkshopItemInfo.xml")) {
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

    // 2. Scan Aim Lab root & User directories (AcademyTasks, CreatorStudio, Playlists, PathProgression, Notifications, Replay)
    if let Some(users_dir) = get_aimlab_users_dir() {
        if let Some(aimlab_root) = users_dir.parent() {
            // 2a. AcademyTasks
            let academy_dir = aimlab_root.join("AcademyTasks");
            if academy_dir.is_dir() {
                if let Ok(entries) = fs::read_dir(&academy_dir) {
                    for entry in entries.flatten() {
                        let task_dir = entry.path();
                        if !task_dir.is_dir() {
                            continue;
                        }
                        let fallback_folder_name = task_dir
                            .file_name()
                            .and_then(|n| n.to_str())
                            .map(|s| s.trim().to_string());
                        let real_name = extract_xml_name(&task_dir.join("WorkshopItemInfo.xml"))
                            .or(fallback_folder_name);
                        if let Some(name) = real_name {
                            if !name.is_empty() {
                                let levels_dir = task_dir.join("Levels");
                                if let Ok(lvl_entries) = fs::read_dir(&levels_dir) {
                                    for lvl in lvl_entries.flatten() {
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

            // 2b. CreatorStudio Levels (level.es3)
            let cs_levels_dir = aimlab_root.join("CreatorStudio").join("Levels");
            if cs_levels_dir.is_dir() {
                if let Ok(entries) = fs::read_dir(&cs_levels_dir) {
                    for entry in entries.flatten() {
                        let level_es3 = entry.path().join("level.es3");
                        if level_es3.is_file() {
                            if let Ok(content) = fs::read_to_string(&level_es3) {
                                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                                    if let Some(meta) = val
                                        .get("level")
                                        .and_then(|l| l.get("value"))
                                        .and_then(|v| v.get("contentMetadata"))
                                    {
                                        let id = meta.get("id").and_then(|v| v.as_str()).map(str::trim);
                                        let label = meta.get("label").and_then(|v| v.as_str()).map(str::trim);
                                        if let (Some(i), Some(l)) = (id, label) {
                                            if !i.is_empty() && !l.is_empty() && !l.starts_with("CsLevel") {
                                                map.insert(i.to_string(), l.to_string());
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

        if let Ok(user_entries) = fs::read_dir(&users_dir) {
            for u in user_entries.flatten() {
                let user_path = u.path();
                if !user_path.is_dir() {
                    continue;
                }
                for subfolder in &["Playlists", "PathProgression"] {
                    let sub_dir = user_path.join(subfolder);
                    scan_playlist_files_for_mapping(&sub_dir, &mut map);
                }

                // 2c. Notifications.json (LevelId -> Task)
                let notif_path = user_path.join("Notifications.json");
                if notif_path.is_file() {
                    if let Ok(content) = fs::read_to_string(&notif_path) {
                        if let Ok(serde_json::Value::Array(arr)) = serde_json::from_str(&content) {
                            for item in arr {
                                if let Some(payload) = item.get("payload") {
                                    let level_id = payload.get("LevelId").and_then(|v| v.as_str()).map(str::trim);
                                    let task = payload.get("Task").and_then(|v| v.as_str()).map(str::trim);
                                    if let (Some(lid), Some(tname)) = (level_id, task) {
                                        if !lid.is_empty() && !tname.is_empty() && !tname.starts_with("CsLevel") {
                                            map.insert(lid.to_string(), tname.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // 2d. Replay/*.json (taskId -> taskName)
                let replay_dir = user_path.join("Replay");
                if replay_dir.is_dir() {
                    if let Ok(rep_entries) = fs::read_dir(&replay_dir) {
                        for rep in rep_entries.flatten() {
                            let p = rep.path();
                            if p.extension().and_then(|e| e.to_str()).map(|s| s.eq_ignore_ascii_case("json")) == Some(true) {
                                if let Ok(content) = fs::read_to_string(&p) {
                                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                                        let tid = val.get("taskId").and_then(|v| v.as_str()).map(str::trim);
                                        let tname = val.get("taskName").and_then(|v| v.as_str()).map(str::trim);
                                        if let (Some(id), Some(name)) = (tid, tname) {
                                            if !id.is_empty()
                                                && !name.is_empty()
                                                && !name.eq_ignore_ascii_case("TASK NOT FOUND")
                                                && !name.starts_with("CsLevel")
                                            {
                                                map.insert(id.to_string(), name.to_string());
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

    map
}

pub fn clean_aimlab_task_name_with_workshop(
    raw: &str,
    workshop_id: Option<&str>,
    map: &HashMap<String, String>,
) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    // 1. Direct match in lookup map by raw taskName
    if let Some(clean) = map.get(trimmed) {
        if !clean.is_empty() {
            return clean.clone();
        }
    }

    // 2. Match by workshopId when provided
    if let Some(wid) = workshop_id.map(str::trim).filter(|w| !w.is_empty()) {
        if let Some(clean) = map.get(wid) {
            if !clean.is_empty() {
                return clean.clone();
            }
        }
    }

    // 3. Structured dotted pattern: CsLevel.<author>.<scenario>.<hash/code>
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

    // 4. UUID or simple prefix: CsLevel<guid> -> remove CsLevel prefix
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

pub fn clean_aimlab_task_name(raw: &str, map: &HashMap<String, String>) -> String {
    clean_aimlab_task_name_with_workshop(raw, None, map)
}

fn load_sqlite_sens_and_name_lookup(
    map: &HashMap<String, String>,
    fallback_dpi: f64,
) -> HashMap<String, (f64, String)> {
    let mut lookup = HashMap::new();
    let users_dir = match get_aimlab_users_dir() {
        Some(d) => d,
        None => return lookup,
    };
    let db_path = match find_best_aimlab_db(&users_dir) {
        Some(p) => p,
        None => return lookup,
    };

    let (default_sens_cm, game_profile, _) = read_aimlab_profile_defaults(&users_dir, fallback_dpi);
    let replay_sens_map = build_replay_sens_map(&users_dir, fallback_dpi);

    let temp_db_path = std::env::temp_dir().join(format!(
        "temp_klutch_mig_{}.bytes",
        Utc::now().timestamp_millis()
    ));
    if fs::copy(&db_path, &temp_db_path).is_err() {
        return lookup;
    }

    if let Ok(conn) = Connection::open_with_flags(&temp_db_path, OpenFlags::SQLITE_OPEN_READ_ONLY) {
        let query = "SELECT t.taskName, t.score, t.createDate, t.workshopId, t.playId, s.Hipfire, s.DPI
                     FROM TaskData t
                     LEFT JOIN SensData s ON t.playId = s.PlayID AND s.Type = 0";
        if let Ok(mut stmt) = conn.prepare(query) {
            if let Ok(rows) = stmt.query_map([], |row| {
                let raw_name: String = row.get(0)?;
                let score: f64 = row.get(1)?;
                let create_date: String = row.get(2)?;
                let workshop_id: Option<String> = row.get(3).ok();
                let play_id: Option<String> = row.get(4).ok();
                let hipfire: Option<String> = row.get(5).ok();
                let dpi: Option<f64> = row.get(6).ok();
                Ok((raw_name, score, create_date, workshop_id, play_id, hipfire, dpi))
            }) {
                for r in rows.flatten() {
                    let (raw_name, score, create_date, workshop_id, play_id, hipfire, dpi) = r;
                    let resolved_name = clean_aimlab_task_name_with_workshop(
                        &raw_name,
                        workshop_id.as_deref(),
                        map,
                    );
                    let legacy_name = clean_aimlab_task_name(&raw_name, &HashMap::new());

                    let mut sens = parse_hipfire_sens_cm(
                        hipfire.as_deref(),
                        dpi,
                        Some(&game_profile),
                        fallback_dpi,
                    );
                    if sens <= 0.0 {
                        if let Some(ref pid) = play_id {
                            if let Some(&(rep_cm, _)) = replay_sens_map.get(pid) {
                                sens = rep_cm;
                            }
                        }
                    }
                    if sens <= 0.0 {
                        sens = default_sens_cm;
                    }

                    let sf_resolved = format!("AimLab_{}_{}_{}", resolved_name, score, create_date).replace(' ', "_");
                    let sf_legacy = format!("AimLab_{}_{}_{}", legacy_name, score, create_date).replace(' ', "_");
                    let sf_raw = format!("AimLab_{}_{}_{}", raw_name, score, create_date).replace(' ', "_");

                    lookup.insert(sf_resolved, (sens, resolved_name.clone()));
                    lookup.insert(sf_legacy, (sens, resolved_name.clone()));
                    lookup.insert(sf_raw, (sens, resolved_name));
                }
            }
        }
    }

    let _ = fs::remove_file(temp_db_path);
    lookup
}

pub fn migrate_existing_aimlab_tasks(data: &mut AppData) -> bool {
    let has_cs_level = data.tasks.iter().any(|t| t.name.starts_with("CsLevel"));
    let has_zero_sens_aimlab = data.tasks.iter().any(|t| {
        t.sessions.iter().any(|s| {
            s.sens <= 0.0
                && s.source_file
                    .as_deref()
                    .map(|sf| sf.starts_with("AimLab_"))
                    .unwrap_or(false)
        })
    });

    if !has_cs_level && !has_zero_sens_aimlab {
        return false;
    }

    let map = build_aimlab_scenario_map();
    let sqlite_lookup = if has_zero_sens_aimlab {
        load_sqlite_sens_and_name_lookup(&map, 800.0)
    } else {
        HashMap::new()
    };
    let mut changed = false;

    // 1. Rename tasks and backfill missing AimLab sensitivities
    for task in &mut data.tasks {
        if task.name.starts_with("CsLevel") {
            let clean = clean_aimlab_task_name(&task.name, &map);
            if clean != task.name {
                task.name = clean;
                changed = true;
            }
        }

        let mut inferred_full_name: Option<String> = None;
        for sess in &mut task.sessions {
            if let Some(ref sf) = sess.source_file {
                if let Some((sens_cm, full_name)) = sqlite_lookup.get(sf) {
                    if sess.sens <= 0.0 && *sens_cm > 0.0 {
                        sess.sens = *sens_cm;
                        changed = true;
                    }
                    if !full_name.is_empty() && full_name != &task.name {
                        inferred_full_name = Some(full_name.clone());
                    }
                }
            }
        }

        if let Some(new_name) = inferred_full_name {
            if task.name != new_name {
                task.name = new_name;
                changed = true;
            }
        }
    }

    // 2. Deduplicate tasks that now have identical names (case-insensitive)
    let mut deduplicated: Vec<crate::model::Task> = Vec::new();
    let mut id_redirects: HashMap<String, String> = HashMap::new();

    for task in data.tasks.drain(..) {
        if let Some(existing) = deduplicated
            .iter_mut()
            .find(|t| t.name.eq_ignore_ascii_case(&task.name))
        {
            id_redirects.insert(task.id, existing.id.clone());
            for sess in task.sessions {
                if let Some(dup_sess) = existing.sessions.iter_mut().find(|s| {
                    (s.source_file.is_some() && s.source_file == sess.source_file)
                        || (s.date == sess.date && (s.pb - sess.pb).abs() < f64::EPSILON)
                }) {
                    if dup_sess.sens <= 0.0 && sess.sens > 0.0 {
                        dup_sess.sens = sess.sens;
                    }
                } else {
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

    let fallback_dpi = {
        let state: State<AppState> = app.state();
        let s = state.settings.lock().unwrap();
        if s.mouse_dpi > 0.0 { s.mouse_dpi } else { 800.0 }
    };

    let name_map = build_aimlab_scenario_map();
    let (default_sens_cm, game_profile, default_fov) =
        read_aimlab_profile_defaults(&aimlab_dir, fallback_dpi);
    let replay_sens_map = build_replay_sens_map(&aimlab_dir, fallback_dpi);

    let temp_db_path = std::env::temp_dir().join(format!(
        "temp_klutch_{}.bytes",
        Utc::now().timestamp_millis()
    ));
    fs::copy(&db_path, &temp_db_path).map_err(|e| format!("Failed to copy DB: {}", e))?;

    let runs_result = (|| -> Result<Vec<KovaakRun>, String> {
        let conn = Connection::open_with_flags(&temp_db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| format!("Failed to open DB: {}", e))?;

        let has_sens_table = conn
            .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='SensData'")
            .and_then(|mut s| s.exists([]))
            .unwrap_or(false);

        let mut parsed_runs = Vec::new();

        if has_sens_table {
            let mut stmt = conn
                .prepare(
                    "SELECT t.taskName, t.score, t.createDate, t.workshopId, t.playId, s.Hipfire, s.DPI, s.FOV
                     FROM TaskData t
                     LEFT JOIN SensData s ON t.playId = s.PlayID AND s.Type = 0",
                )
                .map_err(|e| format!("Failed to prepare joined query: {}", e))?;

            let runs_iter = stmt
                .query_map([], |row| {
                    let raw_task_name: String = row.get(0)?;
                    let score: f64 = row.get(1)?;
                    let create_date: String = row.get(2)?;
                    let workshop_id: Option<String> = row.get(3).ok();
                    let play_id: Option<String> = row.get(4).ok();
                    let hipfire: Option<String> = row.get(5).ok();
                    let dpi: Option<f64> = row.get(6).ok();
                    let fov_opt: Option<f64> = row.get(7).ok();

                    let cleaned_task_name = clean_aimlab_task_name_with_workshop(
                        &raw_task_name,
                        workshop_id.as_deref(),
                        &name_map,
                    );

                    let mut sens = parse_hipfire_sens_cm(
                        hipfire.as_deref(),
                        dpi,
                        Some(&game_profile),
                        fallback_dpi,
                    );
                    let mut fov = fov_opt.unwrap_or(0.0);

                    if sens <= 0.0 {
                        if let Some(ref pid) = play_id {
                            if let Some(&(rep_cm, rep_fov)) = replay_sens_map.get(pid) {
                                sens = rep_cm;
                                if fov <= 0.0 {
                                    fov = rep_fov;
                                }
                            }
                        }
                    }

                    if sens <= 0.0 {
                        sens = default_sens_cm;
                    }
                    if fov <= 0.0 {
                        fov = default_fov;
                    }

                    Ok(KovaakRun {
                        scenario: cleaned_task_name,
                        score,
                        sens,
                        fov,
                        datetime: create_date,
                        source_file: "AimLab_SQLite".to_string(),
                    })
                })
                .map_err(|e| format!("Failed to execute query: {}", e))?;

            for run in runs_iter.flatten() {
                let mut r = run;
                r.source_file = format!("AimLab_{}_{}_{}", r.scenario, r.score, r.datetime).replace(' ', "_");
                if let Ok(ndt) = NaiveDateTime::parse_from_str(&r.datetime, "%Y-%m-%d %H:%M:%S") {
                    r.datetime = ndt.format("%Y-%m-%dT%H:%M:%SZ").to_string();
                }
                parsed_runs.push(r);
            }
        } else {
            let mut stmt = conn
                .prepare("SELECT taskName, score, createDate FROM TaskData")
                .map_err(|e| format!("Failed to prepare fallback query: {}", e))?;

            let runs_iter = stmt
                .query_map([], |row| {
                    let raw_task_name: String = row.get(0)?;
                    let cleaned_task_name = clean_aimlab_task_name(&raw_task_name, &name_map);
                    let score: f64 = row.get(1)?;
                    let create_date: String = row.get(2)?;
                    Ok(KovaakRun {
                        scenario: cleaned_task_name,
                        score,
                        sens: default_sens_cm,
                        fov: default_fov,
                        datetime: create_date,
                        source_file: "AimLab_SQLite".to_string(),
                    })
                })
                .map_err(|e| format!("Failed to execute fallback query: {}", e))?;

            for run in runs_iter.flatten() {
                let mut r = run;
                r.source_file = format!("AimLab_{}_{}_{}", r.scenario, r.score, r.datetime).replace(' ', "_");
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

    let fallback_dpi = {
        let state: State<AppState> = app.state();
        let s = state.settings.lock().unwrap();
        if s.mouse_dpi > 0.0 { s.mouse_dpi } else { 800.0 }
    };

    let name_map = build_aimlab_scenario_map();
    let mut parsed_runs = Vec::new();
    let file_name = PathBuf::from(&path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();

    for (i, result) in reader.deserialize::<AimlabCsvRecord>().enumerate() {
        if let Ok(record) = result {
            let mut datetime = record.create_date;
            if let Ok(ndt) = NaiveDateTime::parse_from_str(&datetime, "%Y-%m-%d %H:%M:%S") {
                datetime = ndt.format("%Y-%m-%dT%H:%M:%SZ").to_string();
            }

            let cleaned_task_name = clean_aimlab_task_name(&record.task_name, &name_map);
            let raw_sens = record.sens.unwrap_or(0.0);
            let sens = if raw_sens > 0.0 {
                crate::parser::convert_sens_to_cm(raw_sens, None, fallback_dpi)
            } else {
                0.0
            };

            parsed_runs.push(KovaakRun {
                scenario: cleaned_task_name,
                score: record.score,
                sens,
                fov: 0.0,
                datetime,
                source_file: format!("CSV_{}_{}", file_name, i),
            });
        }
    }

    process_runs(&app, parsed_runs)
}

fn scan_aimlab_playlist_dir(dir: &Path, playlists: &mut Vec<crate::model::GamePlaylist>) {
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
    fn test_clean_aimlab_task_name_and_workshop_resolution() {
        let mut map = HashMap::new();
        map.insert("CsLevel.VT Empyrean.VT Float.QZWM5U".to_string(), "VT Floating Dots".to_string());
        map.insert("3020357341".to_string(), "VT Adjustshot Micro Small".to_string());

        // 1. Direct map resolution
        assert_eq!(clean_aimlab_task_name("CsLevel.VT Empyrean.VT Float.QZWM5U", &map), "VT Floating Dots");

        // 2. Workshop ID resolution when taskName is truncated
        assert_eq!(
            clean_aimlab_task_name_with_workshop(
                "CsLevel.Lowgravity56.VT Adjus.RZEKV7",
                Some("3020357341"),
                &map
            ),
            "VT Adjustshot Micro Small"
        );

        // 3. Structured dotted fallback
        assert_eq!(clean_aimlab_task_name("CsLevel.Lowgravity56.VT Suave.RX1H0T", &map), "VT Suave");
        assert_eq!(clean_aimlab_task_name("CsLevel.morcaillionaire.rA Twosh.RCGDKY", &map), "rA Twosh");
        assert_eq!(clean_aimlab_task_name("CsLevel.Lowgravity56.Mini's H.RVK2R3", &map), "Mini's H");

        // 4. Simple GUID / UUID prefix
        assert_eq!(clean_aimlab_task_name("CsLevel2ea08b52-c743-4474-82f1-c965bf42d35f", &map), "2ea08b52-c743-4474-82f1-c965bf42d35f");

        // 5. Clean names kept as-is
        assert_eq!(clean_aimlab_task_name("1w2ts Pasu", &map), "1w2ts Pasu");
        assert_eq!(clean_aimlab_task_name("SpiderShot", &map), "SpiderShot");
    }

    #[test]
    fn test_parse_hipfire_sens_cm() {
        // 0.245 @ 1600 DPI Valorant (yaw 0.07) => 914.4 / (1600 * 0.07 * 0.245) = 33.3 cm/360
        let cm = parse_hipfire_sens_cm(
            Some(r#"{"x":0.24500000476837159,"y":0.24500000476837159}"#),
            Some(1600.0),
            Some("VALORANT"),
            800.0,
        );
        assert_eq!(cm, 33.3);

        // 0.238 @ 800 DPI Valorant => 914.4 / (800 * 0.07 * 0.238) = 68.6 cm/360
        let cm_800 = parse_hipfire_sens_cm(
            Some(r#"{"x":0.238,"y":0.238}"#),
            Some(800.0),
            Some("VALORANT"),
            800.0,
        );
        assert_eq!(cm_800, 68.6);
    }

    #[test]
    fn test_parse_aimlab_replay_file() {
        let tmp = std::env::temp_dir().join("test_aimlab_replay.json");
        let sample = r#"{
            "score": 1181.0,
            "endedAt": 1781384800158,
            "taskId": "CsLevel.morcaillionaire.rA Twosh.RCGDKY",
            "taskName": "rA Twoshot Narrow",
            "userSettings": {
                "controlSettings": {
                    "gameProfile": "VALORANT",
                    "mouseCounts": 1600,
                    "mouseSensitivityX": 0.245,
                    "fieldOfView": 70.53
                }
            },
            "userSkills": {
                "create_date": "06/13/2026 21:06:40"
            }
        }"#;
        fs::write(&tmp, sample).unwrap();

        let map = HashMap::new();
        let run = parse_aimlab_replay_file(&tmp, &map, 800.0).expect("should parse replay JSON");
        assert_eq!(run.scenario, "rA Twoshot Narrow");
        assert_eq!(run.score, 1181.0);
        assert_eq!(run.sens, 33.3);
        assert_eq!(run.datetime, "2026-06-13T21:06:40Z");
        assert_eq!(run.source_file, "AimLab_rA_Twoshot_Narrow_1181_2026-06-13_21:06:40");

        let _ = fs::remove_file(tmp);
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
