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

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct AppSettings {
    pub kovaak_stats_path: Option<String>,
    pub watcher_active: bool,
    pub import_on_first_run: bool,
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