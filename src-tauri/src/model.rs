use std::collections::HashMap;
use serde::{Deserialize, Serialize};

pub const DEFAULT_CATEGORY: &str = "Click Timing";
pub const CURRENT_SCHEMA_VERSION: u32 = 2;

fn default_schema_version() -> u32 {
    1
}

pub const DEFAULT_SUBCATEGORY: &str = "Precision";

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub date: String,
    pub sens: f64,
    pub pb: f64,
    pub threshold: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_file: Option<String>,
    // --- schema v2 (Plano 03): run completa; todos opcionais ---
    #[serde(skip_serializing_if = "Option::is_none")]
    pub datetime: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub game: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fov: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shots: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hits: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accuracy: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kills: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avg_ttk: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub damage_done: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub damage_possible: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fight_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pause_count: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pause_duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avg_fps: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub game_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dpi: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sens_role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub roll_center_cm: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lattice_k: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub focus: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub name: String,
    pub category: String,
    pub subcategory: String,
    pub sessions: Vec<Session>,
    /// Cue de intenção do treino (Plano 07, T7.1). Máx. `MAX_INTENT_CUE_CHARS`; ausente/vazio = sem cue.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intent_cue: Option<String>,
}

/// Tamanho máximo (em caracteres) de `Task.intent_cue`; o Rust trunca.
pub const MAX_INTENT_CUE_CHARS: usize = 80;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PlaylistItem {
    pub id: String,
    pub task_id: String,
    pub target_mode: String, // "reps" | "time" | "threshold"
    pub target_value: f64,
    /// "train" | "measure" (Plano 07, T7.1). Ausente = "train".
    #[serde(default = "default_step_kind")]
    pub step_kind: String,
    /// Só para `target_mode = "threshold"`. Ausente = 8 (default aplicado pelo consumidor).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_attempts: Option<u32>,
    /// Só para `target_mode = "threshold"`. Ausente = 10 (default aplicado pelo consumidor).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_minutes: Option<u32>,
}

impl Default for PlaylistItem {
    fn default() -> Self {
        Self {
            id: String::new(),
            task_id: String::new(),
            target_mode: String::new(),
            target_value: 0.0,
            step_kind: default_step_kind(),
            max_attempts: None,
            max_minutes: None,
        }
    }
}

pub fn default_step_kind() -> String {
    "train".to_string()
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub items: Vec<PlaylistItem>,
    pub created_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_advance_mode: Option<String>,
    /// "user" | "kovaak" | "aimlab" (T2.5: o sync só mexe em playlists com `source != "user"`).
    #[serde(default = "default_playlist_source")]
    pub source: String,
    /// true força todos os passos como medição (Plano 07, T7.1).
    #[serde(default)]
    pub is_measurement: bool,
}

pub fn default_playlist_source() -> String {
    "user".to_string()
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    /// Ausente = 1. Atual = `CURRENT_SCHEMA_VERSION`.
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    pub active_task_id: Option<String>,
    pub tasks: Vec<Task>,
    #[serde(default)]
    pub playlists: Vec<Playlist>,
}

/// Estatísticas extras da run (schema v2). Campo ausente no CSV = `None`.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct RunStats {
    #[serde(skip_serializing_if = "Option::is_none")]
    /// Campo `DPI:` do CSV (autodeclarado; pode estar errado).
    pub dpi: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shots: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hits: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accuracy: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kills: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avg_ttk: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub damage_done: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub damage_possible: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fight_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pause_count: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pause_duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avg_fps: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub game_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct KovaakRun {
    pub scenario: String,
    pub score: f64,
    pub sens: f64,
    pub fov: f64,
    pub datetime: String,
    pub source_file: String,
    /// "kovaak" | "aimlab"
    #[serde(default)]
    pub game: String,
    #[serde(default)]
    pub stats: RunStats,
    /// Snapshot do randomizer no momento da run (do ledger de sens; Plano 03/05).
    #[serde(default)]
    pub sens_role: Option<String>,
    #[serde(default)]
    pub roll_center_cm: Option<f64>,
    #[serde(default)]
    pub lattice_k: Option<i32>,
    #[serde(default)]
    pub run_mode: Option<String>,
}

fn default_spread_percent() -> f64 {
    25.0
}

fn default_dpi() -> f64 {
    800.0
}

fn default_predictor_profile() -> String {
    "equilibrado".to_string()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
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
    #[serde(default = "default_spread_percent")]
    pub spread_percent: f64,
    #[serde(default = "default_true")]
    pub auto_scenario_sens: bool,
    #[serde(default)]
    pub scenario_ideal_cm: Option<f64>,
    #[serde(default = "default_dpi")]
    pub mouse_dpi: f64,
    #[serde(default)]
    pub center_overrides: HashMap<String, f64>,
    /// LEGADO: só para ler settings antigos (o preditor deixou de ser o centro padrão).
    #[serde(default = "default_predictor_profile")]
    pub predictor_profile: String,
    // --- Randomizer v2 (Plano 05, T5.1) ---
    /// "center" | "directed" | "alternating" | "explore"
    #[serde(default = "default_rand_mode")]
    pub mode: String,
    /// "personal_relative" | "viscose_absolute" | "base" | "lab".
    /// Migração: JSON antigo sem este campo cai no default `personal_relative`, que é o
    /// equivalente do antigo `autoScenarioSens = true`.
    #[serde(default = "default_center_source")]
    pub center_source: String,
    /// Chave "Categoria/Subcategoria" -> "fast" | "slow" | "neutral".
    #[serde(default)]
    pub direction_overrides: HashMap<String, String>,
    #[serde(default = "default_reactivation_runs")]
    pub reactivation_runs: u32,
    #[serde(default = "default_anchor_every")]
    pub anchor_every: u32,
    #[serde(default = "default_alternating_block")]
    pub alternating_block: u32,
    /// Categoria ausente = habilitada.
    #[serde(default)]
    pub category_enabled: HashMap<String, bool>,
}

fn default_rand_mode() -> String {
    "center".to_string()
}
fn default_center_source() -> String {
    "personal_relative".to_string()
}
fn default_reactivation_runs() -> u32 {
    2
}
fn default_anchor_every() -> u32 {
    5
}
fn default_alternating_block() -> u32 {
    3
}

/// Metadados por cenário enviados pelo front (`set_scenario_meta`), chave = nome normalizado.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct ScenarioMeta {
    pub center_cm: f64,
    pub category: String,
    pub subcategory: String,
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
            spread_percent: 25.0,
            auto_scenario_sens: true,
            scenario_ideal_cm: None,
            mouse_dpi: 800.0,
            center_overrides: HashMap::new(),
            predictor_profile: "equilibrado".to_string(),
            mode: default_rand_mode(),
            center_source: default_center_source(),
            direction_overrides: HashMap::new(),
            reactivation_runs: default_reactivation_runs(),
            anchor_every: default_anchor_every(),
            alternating_block: default_alternating_block(),
            category_enabled: HashMap::new(),
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
    #[serde(default)]
    pub last_roll_reason: Option<String>,
    /// "base" | "anchor" | "random" | "off" (Plano 05).
    #[serde(default)]
    pub active_role: Option<String>,
    #[serde(default)]
    pub active_center_cm: Option<f64>,
    /// "fast" | "slow" | "base"
    #[serde(default)]
    pub muscle_cue: Option<String>,
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
            last_roll_reason: None,
            active_role: None,
            active_center_cm: None,
            muscle_cue: None,
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
    #[serde(default = "default_true")]
    pub auto_advance_on_threshold: bool,
    #[serde(default = "default_dpi")]
    pub mouse_dpi: f64,
    /// Epoch ms da última varredura de CSVs (catch-up import, Plano 03).
    #[serde(default)]
    pub last_import_scan_at: Option<i64>,
    /// Plano 04 (T4.6) + Plano 07 (T7.1).
    #[serde(default)]
    pub training: TrainingSettings,
    /// Plano 06 / T7.1.
    #[serde(default)]
    pub lab: LabSettings,
}

/// Casing camelCase dentro da sub-struct (os campos de topo de `AppSettings` são snake_case).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct TrainingSettings {
    pub warmup_runs_per_scenario: u32,
    pub session_warmup_minutes: u32,
    pub session_gap_minutes: u32,
    pub planned_runs: u32,
    /// "easy" | "normal" | "hard"
    pub difficulty: String,
    pub max_pause_seconds: u32,
    pub focus_prompt: bool,
    pub fatigue_alerts: bool,
    pub weekly_measure_reminder: bool,
}

impl Default for TrainingSettings {
    fn default() -> Self {
        Self {
            warmup_runs_per_scenario: 1,
            session_warmup_minutes: 5,
            session_gap_minutes: 45,
            planned_runs: 5,
            difficulty: "normal".to_string(),
            max_pause_seconds: 10,
            focus_prompt: true,
            fatigue_alerts: true,
            weekly_measure_reminder: true,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct LabSettings {
    pub game_id: String,
    pub in_game_sens: Option<f64>,
}

impl Default for LabSettings {
    fn default() -> Self {
        Self { game_id: "valorant".to_string(), in_game_sens: None }
    }
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
            auto_advance_on_threshold: true,
            mouse_dpi: 800.0,
            last_import_scan_at: None,
            training: TrainingSettings::default(),
            lab: LabSettings::default(),
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
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GamePlaylistItem {
    #[serde(alias = "scenario_name", alias = "scenarioName", alias = "taskName")]
    pub scenario_name: String,
    #[serde(alias = "play_Count", alias = "playCount", alias = "repetitions", default = "default_play_count")]
    pub play_count: f64,
}

fn default_play_count() -> f64 {
    1.0
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GamePlaylist {
    #[serde(alias = "playlistName", alias = "playlist_name")]
    pub playlist_name: String,
    #[serde(alias = "playlistId", alias = "playlist_id", default)]
    pub playlist_id: Option<serde_json::Value>,
    #[serde(alias = "scenarioList", alias = "scenario_list", alias = "playlist", default)]
    pub scenario_list: Vec<GamePlaylistItem>,
    #[serde(default)]
    pub description: Option<String>,
}

#[cfg(test)]
mod serde_default_tests {
    use super::*;

    #[test]
    fn partial_randomizer_does_not_reset_settings() {
        let json = r#"{"kovaak_stats_path":"C:\\stats","randomizer":{"enabled":true}}"#;
        let parsed: AppSettings = serde_json::from_str(json).expect("partial randomizer must parse");
        assert_eq!(parsed.kovaak_stats_path.as_deref(), Some("C:\\stats"));
        assert!(parsed.randomizer.enabled);
        assert_eq!(parsed.randomizer.range_mode, "cm360");
        assert_eq!(parsed.randomizer.mouse_dpi, 800.0);
    }

    #[test]
    fn playlist_without_source_defaults_to_user() {
        let json = r#"{"id":"p1","name":"Warmup","items":[],"createdAt":"2026-10-10"}"#;
        let parsed: Playlist = serde_json::from_str(json).expect("legacy playlist must parse");
        assert_eq!(parsed.source, "user");
    }

    #[test]
    fn session_without_pb_defaults_to_zero() {
        let json = r#"{"id":"s1","date":"2026-10-10","sens":40.0,"threshold":0.0}"#;
        let parsed: Session = serde_json::from_str(json).expect("session without pb must parse");
        assert_eq!(parsed.pb, 0.0);
    }

    #[test]
    fn old_settings_get_new_defaults() {
        let json = r#"{"randomizer":{"enabled":true,"autoScenarioSens":true}}"#;
        let parsed: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.training, TrainingSettings::default());
        assert_eq!(parsed.training.session_gap_minutes, 45);
        assert_eq!(parsed.training.difficulty, "normal");
        assert!(parsed.training.focus_prompt);
        assert_eq!(parsed.lab.game_id, "valorant");
        assert_eq!(parsed.lab.in_game_sens, None);
        let r = parsed.randomizer;
        assert_eq!(r.mode, "center");
        assert_eq!(r.center_source, "personal_relative");
        assert_eq!(r.reactivation_runs, 2);
        assert_eq!(r.anchor_every, 5);
        assert_eq!(r.alternating_block, 3);
        assert!(r.direction_overrides.is_empty());
        assert!(r.category_enabled.is_empty());
    }

    #[test]
    fn partial_training_keeps_other_defaults() {
        let json = r#"{"training":{"plannedRuns":7,"difficulty":"hard"},"lab":{"inGameSens":0.35}}"#;
        let parsed: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.training.planned_runs, 7);
        assert_eq!(parsed.training.difficulty, "hard");
        assert_eq!(parsed.training.max_pause_seconds, 10);
        assert_eq!(parsed.lab.in_game_sens, Some(0.35));
        assert_eq!(parsed.lab.game_id, "valorant");
    }

    #[test]
    fn playlist_item_without_step_kind_is_train() {
        let json = r#"{"id":"i","taskId":"t","targetMode":"threshold","targetValue":3}"#;
        let item: PlaylistItem = serde_json::from_str(json).unwrap();
        assert_eq!(item.step_kind, "train");
        assert_eq!(item.max_attempts, None);
        assert_eq!(item.max_minutes, None);
        let out = serde_json::to_value(&item).unwrap();
        assert!(out.get("maxAttempts").is_none());
        assert_eq!(out["stepKind"], "train");
        let pl: Playlist =
            serde_json::from_str(r#"{"id":"p","name":"n","items":[],"createdAt":"x"}"#).unwrap();
        assert!(!pl.is_measurement);
    }

    #[test]
    fn scenario_meta_and_state_camel_case() {
        let m: ScenarioMeta = serde_json::from_str(
            r#"{"centerCm":42.5,"category":"Flick Tech","subcategory":"Speed"}"#,
        )
        .unwrap();
        assert_eq!(m.center_cm, 42.5);
        assert_eq!(m.subcategory, "Speed");
        let st = serde_json::to_value(RandomizerState::default()).unwrap();
        assert!(st.get("activeRole").is_some() && st.get("muscleCue").is_some());
    }
}
