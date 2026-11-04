import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import type {
  AppData,
  AppDataSnapshot,
  AppSettings,
  CreateTaskResult,
  DetectedPlaylistEvent,
  ImportStats,
  KovaakPlaylistRaw,
  LoadReport,
  Playlist,
  ReplaceAllReason,
  RevisionResult,
  RunRecordedEvent,
  SyncGamePlaylistsResult,
  TaskMetaPatch,
  UpsertPlaylistResult,
  WatcherStatus,
} from "./types";
import { toBackendError } from "./backend-error";
import { getWebBackend } from "./web-backend";

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ---------------------------------------------------------------------------
// Dados do app (Plano 02): o Rust é o dono do AppData. O front chama comandos de
// mutação e recebe snapshots versionados via "app_data_changed". Sem Tauri, o
// `web-backend` implementa o mesmo contrato sobre localStorage.
// ---------------------------------------------------------------------------

async function cmd<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(name, args);
  } catch (err) {
    throw toBackendError(err);
  }
}

/** Executa o comando web (síncrono) com o mesmo formato de erro do Rust. */
async function web<T>(run: () => T): Promise<T> {
  try {
    return run();
  } catch (err) {
    throw toBackendError(err);
  }
}

export async function getAppData(): Promise<AppDataSnapshot> {
  if (!isTauri()) return web(() => getWebBackend().getAppData());
  return cmd<AppDataSnapshot>("get_app_data");
}

export function onAppDataChanged(
  callback: (snapshot: AppDataSnapshot) => void
): Promise<UnlistenFn> {
  if (!isTauri()) return Promise.resolve(getWebBackend().subscribe(callback));
  return listen<AppDataSnapshot>("app_data_changed", (event) => callback(event.payload));
}

export function onRunRecorded(callback: (event: RunRecordedEvent) => void): Promise<UnlistenFn> {
  if (!isTauri()) return Promise.resolve(() => {});
  return listen<RunRecordedEvent>("run_recorded", (event) => callback(event.payload));
}

export async function createTask(
  name: string,
  category: string,
  subcategory: string
): Promise<CreateTaskResult> {
  if (!isTauri()) return web(() => getWebBackend().createTask(name, category, subcategory));
  return cmd<CreateTaskResult>("create_task", { name, category, subcategory });
}

export async function updateTaskMeta(taskId: string, patch: TaskMetaPatch): Promise<RevisionResult> {
  if (!isTauri()) return web(() => getWebBackend().updateTaskMeta(taskId, patch));
  return cmd<RevisionResult>("update_task_meta", { taskId, ...patch });
}

export async function deleteTask(taskId: string): Promise<RevisionResult> {
  if (!isTauri()) return web(() => getWebBackend().deleteTask(taskId));
  return cmd<RevisionResult>("delete_task", { taskId });
}

export async function setActiveTask(taskId: string | null): Promise<RevisionResult> {
  if (!isTauri()) return web(() => getWebBackend().setActiveTask(taskId));
  return cmd<RevisionResult>("set_active_task", { taskId });
}

export async function addManualSessions(
  taskId: string,
  date: string,
  sensCm: number,
  scores: number[]
): Promise<RevisionResult> {
  if (!isTauri()) return web(() => getWebBackend().addManualSessions(taskId, date, sensCm, scores));
  return cmd<RevisionResult>("add_manual_sessions", { taskId, date, sensCm, scores });
}

export async function deleteSession(taskId: string, sessionId: string): Promise<RevisionResult> {
  if (!isTauri()) return web(() => getWebBackend().deleteSession(taskId, sessionId));
  return cmd<RevisionResult>("delete_session", { taskId, sessionId });
}

export async function upsertPlaylist(playlist: Playlist): Promise<UpsertPlaylistResult> {
  if (!isTauri()) return web(() => getWebBackend().upsertPlaylist(playlist));
  return cmd<UpsertPlaylistResult>("upsert_playlist", { playlist });
}

export async function deletePlaylist(playlistId: string): Promise<RevisionResult> {
  if (!isTauri()) return web(() => getWebBackend().deletePlaylist(playlistId));
  return cmd<RevisionResult>("delete_playlist", { playlistId });
}

/** Rejeita com `BackendError("not_implemented")` até a T2.5 (o chamador usa fallback). */
export async function syncGamePlaylistsCommand(): Promise<SyncGamePlaylistsResult> {
  if (!isTauri()) return web(() => getWebBackend().syncGamePlaylists());
  return cmd<SyncGamePlaylistsResult>("sync_game_playlists");
}

export async function replaceAllData(
  data: AppData,
  reason: ReplaceAllReason
): Promise<RevisionResult> {
  if (!isTauri()) return web(() => getWebBackend().replaceAllData(data, reason));
  return cmd<RevisionResult>("replace_all_data", { data, reason });
}

export async function importJsonBackup(json: string): Promise<RevisionResult> {
  if (!isTauri()) return web(() => getWebBackend().importJsonBackup(json));
  return cmd<RevisionResult>("import_json_backup", { json });
}

export async function detectKovaakPath(): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string | null>("detect_kovaak_path");
}

export async function getAimlabPlaylists(): Promise<KovaakPlaylistRaw[]> {
  if (!isTauri()) return [];
  return invoke<KovaakPlaylistRaw[]>("get_aimlab_playlists");
}

export async function getKovaakPlaylists(): Promise<KovaakPlaylistRaw[]> {
  if (!isTauri()) return [];
  return invoke<KovaakPlaylistRaw[]>("get_kovaak_playlists");
}

export function normalizeDetectedPlaylistPayload(
  raw: any
): DetectedPlaylistEvent | null {
  if (!raw) return null;
  const name = raw.playlist_name || raw.playlistName || "";
  const id = raw.playlist_id ?? raw.playlistId;
  const listRaw = raw.scenario_list || raw.scenarioList || [];
  const normalizedList = Array.isArray(listRaw)
    ? listRaw.map((s: any) => ({
        scenario_name: s.scenario_name || s.scenarioName || "",
        play_count: Number(s.play_count ?? s.playCount ?? 1),
      }))
    : [];
  return {
    playlist_name: name,
    playlist_id: id !== undefined && id !== null ? String(id) : undefined,
    scenario_list: normalizedList,
  };
}

export async function getPlaylistInProgress(): Promise<DetectedPlaylistEvent | null> {
  if (!isTauri()) return null;
  try {
    const raw = await invoke<any>("get_playlist_in_progress");
    return normalizeDetectedPlaylistPayload(raw);
  } catch (err) {
    console.error("Erro ao obter playlist em andamento:", err);
    return null;
  }
}

export async function pickStatsFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Selecione a pasta de stats do KovaaK's",
  });
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected ?? null;
}

export async function pickAimlabCsvFile(): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({
    directory: false,
    multiple: false,
    title: "Selecione o arquivo CSV do Aim Lab",
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected ?? null;
}

export async function getSettings(): Promise<AppSettings> {
  if (!isTauri()) {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("AIM_SETTINGS");
      if (stored) {
        try {
          return {
            kovaak_stats_path: null,
            watcher_active: false,
            import_on_first_run: true,
            close_to_tray: true,
            auto_detect_playlist: true,
            notify_step_advance: true,
            auto_advance_on_threshold: true,
            ...JSON.parse(stored),
          };
        } catch {}
      }
    }
    return {
      kovaak_stats_path: null,
      watcher_active: false,
      import_on_first_run: true,
      close_to_tray: true,
      auto_detect_playlist: true,
      notify_step_advance: true,
      auto_advance_on_threshold: true,
    };
  }
  return invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!isTauri()) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("AIM_SETTINGS", JSON.stringify(settings));
    }
    return;
  }
  await invoke("save_settings", { settings });
}

export async function setStatsPath(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("set_stats_path", { path });
}

export async function startWatcher(): Promise<void> {
  if (!isTauri()) return;
  await invoke("start_watcher");
}

export async function stopWatcher(): Promise<void> {
  if (!isTauri()) return;
  await invoke("stop_watcher");
}

export async function getWatcherStatus(): Promise<WatcherStatus> {
  if (!isTauri()) {
    return { active: false, path: null, error: null };
  }
  return invoke<WatcherStatus>("get_watcher_status");
}

export async function importExistingCsvs(): Promise<ImportStats> {
  if (!isTauri()) {
    return { total: 0, new: 0, skipped: 0 };
  }
  return invoke<ImportStats>("import_existing_csvs");
}

export async function syncAimlabSqlite(): Promise<ImportStats> {
  if (!isTauri()) return { total: 0, new: 0, skipped: 0 };
  return invoke<ImportStats>("sync_aimlab_sqlite");
}

export async function importAimlabCsv(path: string): Promise<ImportStats> {
  if (!isTauri()) return { total: 0, new: 0, skipped: 0 };
  return invoke<ImportStats>("import_aimlab_csv", { path });
}

export function onWatcherError(callback: (error: string) => void): Promise<UnlistenFn> {
  if (!isTauri()) {
    return Promise.resolve(() => {});
  }
  return listen<string>("watcher_error", (event) => callback(event.payload));
}

export function onImportComplete(
  callback: (stats: ImportStats) => void
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return Promise.resolve(() => {});
  }
  return listen<ImportStats>("import_complete", (event) =>
    callback(event.payload)
  );
}

export function listenKovaakPlaylistActive(
  handler: (event: DetectedPlaylistEvent) => void
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return Promise.resolve(() => {});
  }
  return listen<any>("kovaak_playlist_active", (event) => {
    const normalized = normalizeDetectedPlaylistPayload(event.payload);
    if (normalized) {
      handler(normalized);
    }
  });
}

export async function getLoadReport(): Promise<LoadReport | null> {
  if (!isTauri()) return null;
  return invoke<LoadReport | null>("get_load_report");
}

export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    try {
      await openUrl(url);
    } catch (err) {
      console.error("Erro ao abrir URL no Tauri:", err);
    }
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function revealInFolder(path: string): Promise<void> {
  if (!isTauri()) return;
  try {
    await revealItemInDir(path);
  } catch (err) {
    console.error("Erro ao abrir pasta:", err);
  }
}
