export interface Session {
  id: string;
  date: string;
  sens: number;
  pb: number;
  threshold: number;
  sourceFile?: string;
  // --- schema v2 (Plano 03): run completa; todos opcionais ---
  datetime?: string; // ISO local YYYY-MM-DDTHH:MM:SS
  game?: "kovaak" | "aimlab" | "manual";
  fov?: number;
  shots?: number;
  hits?: number;
  accuracy?: number; // 0..1
  kills?: number;
  avgTtk?: number;
  damageDone?: number;
  damagePossible?: number;
  fightTime?: number;
  pauseCount?: number;
  pauseDuration?: number;
  avgFps?: number;
  gameVersion?: string;
  hash?: string;
  dpi?: number; // campo DPI do CSV (autodeclarado)
  sensRole?: "base" | "anchor" | "random" | "off" | "unknown";
  rollCenterCm?: number;
  latticeK?: number;
  runMode?: "measure" | "train" | "free";
  focus?: "on" | "auto" | null;
}

export interface Task {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  sessions: Session[];
  /** Cue de intenção do treino (Plano 07). Máx. 80 caracteres (o Rust trunca); ausente = sem cue. */
  intentCue?: string;
}

export type PlaylistTargetMode = "reps" | "time" | "threshold";
export type PlaylistStepKind = "train" | "measure";
/** Defaults de `maxAttempts` / `maxMinutes` quando ausentes (só `targetMode = "threshold"`). */
export const DEFAULT_STEP_MAX_ATTEMPTS = 8;
export const DEFAULT_STEP_MAX_MINUTES = 10;
export type PlaylistAutoAdvanceMode = "inherit" | "enabled" | "disabled";

export interface PlaylistItem {
  id: string;
  taskId: string;
  targetMode: PlaylistTargetMode;
  targetValue: number; // reps/threshold: número de sessões; time: segundos
  /** Ausente = "train". */
  stepKind?: PlaylistStepKind;
  /** Só para targetMode "threshold". Ausente = DEFAULT_STEP_MAX_ATTEMPTS (8). */
  maxAttempts?: number;
  /** Só para targetMode "threshold". Ausente = DEFAULT_STEP_MAX_MINUTES (10). */
  maxMinutes?: number;
}

export type PlaylistSource = "user" | "kovaak" | "aimlab";

export interface Playlist {
  id: string;
  name: string;
  items: PlaylistItem[];
  createdAt: string;
  autoAdvanceMode?: PlaylistAutoAdvanceMode;
  /** Origem da playlist (Rust usa "user" por padrão). Plano 02 / T2.5. */
  source?: PlaylistSource;
  /** true força todos os passos como medição. Ausente = false. */
  isMeasurement?: boolean;
}

export interface AppData {
  /** Ausente = 1; atual = 2 (Plano 03). */
  schemaVersion?: number;
  activeTaskId: string | null;
  tasks: Task[];
  playlists: Playlist[];
}

// ---------------------------------------------------------------------------
// Contrato Rust <-> front (Plano 02): snapshots versionados, comandos de mutação.
// ---------------------------------------------------------------------------

/** Payload do evento `app_data_changed` e retorno de `get_app_data`. */
export interface AppDataSnapshot {
  revision: number;
  data: AppData;
}

/** Retorno de todos os comandos de mutação. */
export interface RevisionResult {
  revision: number;
}

export interface CreateTaskResult extends RevisionResult {
  taskId: string;
}

export interface UpsertPlaylistResult extends RevisionResult {
  playlistId: string;
}

export interface SyncGamePlaylistsResult extends RevisionResult {
  imported: number;
  total: number;
}

export interface TaskMetaPatch {
  name?: string;
  category?: string;
  subcategory?: string;
  /** Máx. 80 caracteres (o Rust trunca). String vazia limpa o cue; omitido = não altera. */
  intentCue?: string;
}

export type ReplaceAllReason = "demo" | "clear" | "import";

/** Payload do evento `run_recorded` (toast / notificação / runner). */
export interface RunRecordedEvent {
  revision: number;
  taskId: string;
  sessionId: string;
  scenario: string;
  score: number;
  sensCm: number;
  isNewTask: boolean;
}

/** Códigos de erro devolvidos pelos comandos (o front traduz). */
export type BackendErrorCode =
  | "empty_name"
  | "task_not_found"
  | "session_not_found"
  | "playlist_not_found"
  | "invalid_payload"
  | "invalid_backup"
  | "not_implemented";

export interface KovaakRun {
  scenario: string;
  score: number;
  sens: number;
  fov: number;
  datetime: string;
  source_file: string;
}

export interface KovaakPlaylistItemRaw {
  scenarioName: string;
  playCount: number;
}

export interface KovaakPlaylistRaw {
  playlistName: string;
  scenarioList: KovaakPlaylistItemRaw[];
  description?: string;
}

export interface DetectedPlaylistEvent {
  playlist_name: string;
  playlist_id?: string;
  scenario_list: Array<{ scenario_name: string; play_count: number }>;
}

export interface AppSettings {
  kovaak_stats_path: string | null;
  watcher_active: boolean;
  import_on_first_run: boolean;
  close_to_tray?: boolean;
  auto_detect_playlist?: boolean;
  notify_step_advance?: boolean;
  mouse_dpi?: number;
  auto_advance_on_threshold?: boolean;
  last_import_scan_at?: number | null;
  /** Plano 04 (T4.6) + Plano 07. O Rust sempre envia; o front web preenche com os defaults. */
  training: TrainingSettings;
  /** Plano 06. */
  lab: LabSettings;
}

/** camelCase dentro da sub-struct (os campos de topo de AppSettings são snake_case). */
export interface TrainingSettings {
  warmupRunsPerScenario: number;
  sessionWarmupMinutes: number;
  sessionGapMinutes: number;
  plannedRuns: number;
  difficulty: "easy" | "normal" | "hard";
  maxPauseSeconds: number;
  focusPrompt: boolean;
  fatigueAlerts: boolean;
  weeklyMeasureReminder: boolean;
  /** Mostra μ, CV, z e demais estatísticas no dashboard (modo simples por padrão). */
  showAdvancedStats: boolean;
}

export const DEFAULT_TRAINING_SETTINGS: TrainingSettings = {
  warmupRunsPerScenario: 1,
  sessionWarmupMinutes: 5,
  sessionGapMinutes: 45,
  plannedRuns: 5,
  difficulty: "normal",
  maxPauseSeconds: 10,
  focusPrompt: true,
  fatigueAlerts: true,
  weeklyMeasureReminder: true,
  showAdvancedStats: false,
};

export interface LabSettings {
  gameId: string;
  inGameSens: number | null;
}

export const DEFAULT_LAB_SETTINGS: LabSettings = { gameId: "valorant", inGameSens: null };

/** Metadados por cenário enviados ao Rust (`set_scenario_meta`); a chave do mapa é o nome normalizado (trim + lowercase). */
export interface ScenarioMeta {
  centerCm: number;
  category: string;
  subcategory: string;
}

export type SessionFocus = "on" | "auto" | null;

export interface ImportStats {
  total: number;
  new: number;
  skipped: number;
}

export interface WatcherStatus {
  active: boolean;
  path: string | null;
  error: string | null;
}

export interface LoadReport {
  kind: "loaded" | "missing" | "recovered";
  quarantined: string | null;
  fromBackup: string | null;
}

export type ToastType = "info" | "success" | "error" | "warning";

export interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}
