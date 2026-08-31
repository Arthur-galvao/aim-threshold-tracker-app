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

export interface AppData {
  activeTaskId: string | null;
  tasks: Task[];
}

export interface KovaakRun {
  scenario: string;
  score: number;
  sens: number;
  fov: number;
  datetime: string;
  source_file: string;
}

export interface AppSettings {
  kovaak_stats_path: string | null;
  watcher_active: boolean;
  import_on_first_run: boolean;
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
