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

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    pub active_task_id: Option<String>,
    pub tasks: Vec<Task>,
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

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct AppSettings {
    pub kovaak_stats_path: Option<String>,
    pub watcher_active: bool,
    pub import_on_first_run: bool,
    #[serde(default)]
    pub randomizer: RandomizerSettings,
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