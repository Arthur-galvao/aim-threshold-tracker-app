export interface Session {
  id: string;
  date: string;
  sens: number;
  pb: number;
  threshold: number;
  sourceFile?: string;
}

export interface Task {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  sessions: Session[];
}

export type PlaylistTargetMode = "reps" | "time" | "threshold";
export type PlaylistAutoAdvanceMode = "inherit" | "enabled" | "disabled";

export interface PlaylistItem {
  id: string;
  taskId: string;
  targetMode: PlaylistTargetMode;
  targetValue: number; // reps/threshold: número de sessões; time: segundos
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
}

export interface AppData {
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
}

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
