import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AppData,
  AppSettings,
  DetectedPlaylistEvent,
  ImportStats,
  KovaakPlaylistRaw,
  KovaakRun,
  WatcherStatus,
} from "./types";
import { SAMPLE_DATA } from "./sample-data";

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function loadAppData(): Promise<AppData> {
  if (!isTauri()) {
    const stored = localStorage.getItem("AIM_THRESHOLD_TRACKER_DATA");
    if (stored) return JSON.parse(stored);
    return SAMPLE_DATA;
  }
  return invoke<AppData>("load_app_data");
}

export async function saveAppData(data: AppData): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem("AIM_THRESHOLD_TRACKER_DATA", JSON.stringify(data));
    return;
  }
  await invoke("save_app_data", { data });
}

export async function importJsonBackup(json: string): Promise<AppData> {
  if (!isTauri()) {
    const parsed = JSON.parse(json) as AppData;
    if (!parsed || !Array.isArray(parsed.tasks)) {
      throw new Error("JSON inválido");
    }
    await saveAppData(parsed);
    return parsed;
  }
  return invoke<AppData>("import_json_backup", { json });
}

export async function detectKovaakPath(): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string | null>("detect_kovaak_path");
}

export async function getKovaakPlaylists(): Promise<KovaakPlaylistRaw[]> {
  if (!isTauri()) return [];
  return invoke<KovaakPlaylistRaw[]>("get_kovaak_playlists");
}

export async function getPlaylistInProgress(): Promise<DetectedPlaylistEvent | null> {
  if (!isTauri()) return null;
  try {
    const raw = await invoke<any>("get_playlist_in_progress");
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

export async function getSettings(): Promise<AppSettings> {
  if (!isTauri()) {
    return {
      kovaak_stats_path: null,
      watcher_active: false,
      import_on_first_run: true,
      close_to_tray: true,
      auto_detect_playlist: true,
      notify_step_advance: true,
    };
  }
  return invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!isTauri()) return;
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

export function onNewRun(callback: (run: KovaakRun) => void): Promise<UnlistenFn> {
  if (!isTauri()) {
    return Promise.resolve(() => {});
  }
  return listen<KovaakRun>("new_run", (event) => callback(event.payload));
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
    const raw = event.payload;
    if (!raw) return;
    const name = raw.playlist_name || raw.playlistName || "";
    const id = raw.playlist_id ?? raw.playlistId;
    const listRaw = raw.scenario_list || raw.scenarioList || [];
    const normalizedList = Array.isArray(listRaw)
      ? listRaw.map((s: any) => ({
          scenario_name: s.scenario_name || s.scenarioName || "",
          play_count: Number(s.play_count ?? s.playCount ?? 1),
        }))
      : [];
    handler({
      playlist_name: name,
      playlist_id: id !== undefined && id !== null ? String(id) : undefined,
      scenario_list: normalizedList,
    });
  });
}

export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("open_url", { url });
      return;
    } catch (err) {
      console.error("Erro ao abrir URL no Tauri:", err);
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
