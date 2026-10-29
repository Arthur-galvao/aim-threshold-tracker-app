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

export interface Playlist {
  id: string;
  name: string;
  items: PlaylistItem[];
  createdAt: string;
  autoAdvanceMode?: PlaylistAutoAdvanceMode;
}

export interface AppData {
  activeTaskId: string | null;
  tasks: Task[];
  playlists: Playlist[];
}

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

export type ToastType = "info" | "success" | "error" | "warning";

export interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}
