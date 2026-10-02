use serde::{Deserialize, Serialize};

pub const DEFAULT_CATEGORY: &str = "Click Timing";
pub const DEFAULT_SUBCATEGORY: &str = "Precision";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub date: String,
    pub sens: f64,
    pub pb: f64,
    pub threshold: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_file: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub name: String,
    pub category: String,
    pub subcategory: String,
    pub sessions: Vec<Session>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistItem {
    pub id: String,
    pub task_id: String,
    pub target_mode: String, // "reps" | "time"
    pub target_value: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub items: Vec<PlaylistItem>,
    pub created_at: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    pub active_task_id: Option<String>,
    pub tasks: Vec<Task>,
    #[serde(default)]
    pub playlists: Vec<Playlist>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KovaakRun {
    pub scenario: String,
    pub score: f64,
    pub sens: f64,
    pub fov: f64,
    pub datetime: String,
    pub source_file: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RandomizerSettings {
    pub enabled: bool,
    pub base_sens_cm: f64,
    pub range_mode: String,
    pub min_cm: f64,
    pub max_cm: f64,
    pub min_mult: f64,
    pub max_mult: f64,
    pub avoid_repeats: bool,
    pub rawaccel_dir: Option<String>,
}

impl Default for RandomizerSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            base_sens_cm: 40.0,
            range_mode: "cm360".to_string(),
            min_cm: 28.0,
            max_cm: 55.0,
            min_mult: 0.75,
            max_mult: 1.35,
            avoid_repeats: true,
            rawaccel_dir: None,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RandomizerState {
    pub available: bool,
    pub active_sens_cm: f64,
    pub active_mult: f64,
    pub last_run_scenario: Option<String>,
    pub last_run_score: Option<f64>,
    pub last_updated: Option<String>,
    pub error_message: Option<String>,
    #[serde(default)]
    pub rawaccel_gui_running: bool,
}

impl Default for RandomizerState {
    fn default() -> Self {
        Self {
            available: false,
            active_sens_cm: 40.0,
            active_mult: 1.0,
            last_run_scenario: None,
            last_run_score: None,
            last_updated: None,
            error_message: None,
            rawaccel_gui_running: false,
        }
    }
}

fn default_true() -> bool {
    true
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {
    pub kovaak_stats_path: Option<String>,
    pub watcher_active: bool,
    pub import_on_first_run: bool,
    #[serde(default)]
    pub randomizer: RandomizerSettings,
    #[serde(default = "default_true")]
    pub close_to_tray: bool,
    #[serde(default = "default_true")]
    pub auto_detect_playlist: bool,
    #[serde(default = "default_true")]
    pub notify_step_advance: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            kovaak_stats_path: None,
            watcher_active: false,
            import_on_first_run: false,
            randomizer: RandomizerSettings::default(),
            close_to_tray: true,
            auto_detect_playlist: true,
            notify_step_advance: true,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportStats {
    pub total: usize,
    pub new: usize,
    pub skipped: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatcherStatus {
    pub active: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_data_deserialization_without_playlists() {
        let legacy_json = r#"{"activeTaskId":"task_1","tasks":[]}"#;
        let parsed: AppData = serde_json::from_str(legacy_json).expect("should deserialize legacy json");
        assert_eq!(parsed.active_task_id, Some("task_1".to_string()));
        assert!(parsed.tasks.is_empty());
        assert!(parsed.playlists.is_empty());
    }

    #[test]
    fn test_app_data_deserialization_with_playlists() {
        let json_with_playlists = r#"{
            "activeTaskId": null,
            "tasks": [],
            "playlists": [
                {
                    "id": "pl_1",
                    "name": "Daily Warmup",
                    "items": [
                        {
                            "id": "item_1",
                            "taskId": "task_1",
                            "targetMode": "reps",
                            "targetValue": 5.0
                        }
                    ],
                    "createdAt": "2026-09-24T00:00:00Z"
                }
            ]
        }"#;
        let parsed: AppData = serde_json::from_str(json_with_playlists).expect("should deserialize playlist json");
        assert_eq!(parsed.playlists.len(), 1);
        assert_eq!(parsed.playlists[0].name, "Daily Warmup");
        assert_eq!(parsed.playlists[0].items.len(), 1);
        assert_eq!(parsed.playlists[0].items[0].target_mode, "reps");
        assert_eq!(parsed.playlists[0].items[0].target_value, 5.0);
    }

    #[test]
    fn test_app_settings_default_values() {
        let settings = AppSettings::default();
        assert!(settings.close_to_tray);
        assert!(settings.auto_detect_playlist);
        assert!(settings.notify_step_advance);
        assert_eq!(settings.kovaak_stats_path, None);
        assert!(!settings.watcher_active);
    }

    #[test]
    fn test_app_settings_deserialization_defaults() {
        let json = r#"{"watcher_active": false, "import_on_first_run": false}"#;
        let parsed: AppSettings = serde_json::from_str(json).expect("should deserialize settings");
        assert!(parsed.close_to_tray);
        assert!(parsed.auto_detect_playlist);
        assert!(parsed.notify_step_advance);
    }

    #[test]
    fn test_app_settings_deserialization_explicit_values() {
        let json = r#"{
            "close_to_tray": false,
            "auto_detect_playlist": false,
            "notify_step_advance": false
        }"#;
        let parsed: AppSettings = serde_json::from_str(json).expect("should deserialize explicit settings");
        assert!(!parsed.close_to_tray);
        assert!(!parsed.auto_detect_playlist);
        assert!(!parsed.notify_step_advance);
    }
}