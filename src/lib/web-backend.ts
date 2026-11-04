import type {
  AppData,
  AppDataSnapshot,
  CreateTaskResult,
  Playlist,
  ReplaceAllReason,
  RevisionResult,
  Session,
  SyncGamePlaylistsResult,
  Task,
  TaskMetaPatch,
  UpsertPlaylistResult,
} from "./types.ts";
import { BackendError } from "./backend-error.ts";
import { SAMPLE_DATA } from "./sample-data.ts";

/**
 * Backend web (sem Tauri): implementa os MESMOS comandos do Rust sobre `localStorage`,
 * com contador de revisão em memória e um emissor de eventos simples. Usado em
 * `INICIAR_WEB.bat` / dev no browser. Mantém o contrato: erros são códigos curtos.
 */

export const WEB_STORAGE_KEY = "AIM_THRESHOLD_TRACKER_DATA";
const DEFAULT_CATEGORY = "Click Timing";
const DEFAULT_SUBCATEGORY = "Precision";

export interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface WebBackendOptions {
  storage?: WebStorage | null;
  initial?: () => AppData;
}

export type WebSnapshotListener = (snapshot: AppDataSnapshot) => void;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let idCounter = 0;
function uniqueId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

function defaultStorage(): WebStorage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function sanitize(data: AppData): AppData {
  const out: AppData = {
    activeTaskId: data.activeTaskId ?? null,
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    playlists: Array.isArray(data.playlists) ? data.playlists : [],
  };
  const seenTasks = new Set<string>();
  const seenSessions = new Set<string>();
  for (const task of out.tasks) {
    if (!task.id || seenTasks.has(task.id)) task.id = uniqueId("task");
    seenTasks.add(task.id);
    task.sessions = Array.isArray(task.sessions) ? task.sessions : [];
    for (const session of task.sessions) {
      if (!session.id || seenSessions.has(session.id)) session.id = uniqueId("sess");
      seenSessions.add(session.id);
    }
  }
  if (!out.tasks.some((t) => t.id === out.activeTaskId)) {
    out.activeTaskId = out.tasks[0]?.id ?? null;
  }
  return out;
}

export function createWebBackend(options: WebBackendOptions = {}) {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const initial = options.initial ?? (() => SAMPLE_DATA);

  let revision = 0;
  let data: AppData = load();
  const listeners = new Set<WebSnapshotListener>();

  function load(): AppData {
    try {
      const stored = storage?.getItem(WEB_STORAGE_KEY);
      if (stored) return sanitize(JSON.parse(stored) as AppData);
    } catch {
      // cai no dado inicial
    }
    return sanitize(clone(initial()));
  }

  function persist() {
    try {
      storage?.setItem(WEB_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage cheio/indisponível: segue em memória
    }
  }

  /** Aplica `f` numa cópia; só confirma (revisão + persistência + evento) se não lançar. */
  function mutate<R>(f: (draft: AppData) => R): { result: R; revision: number } {
    const draft = clone(data);
    const result = f(draft);
    data = draft;
    revision += 1;
    persist();
    const snapshot: AppDataSnapshot = { revision, data: clone(data) };
    for (const listener of [...listeners]) listener(snapshot);
    return { result, revision };
  }

  function findTask(draft: AppData, taskId: string): Task {
    const task = draft.tasks.find((t) => t.id === taskId);
    if (!task) throw new BackendError("task_not_found");
    return task;
  }

  return {
    getAppData(): AppDataSnapshot {
      return { revision, data: clone(data) };
    },

    /** Equivalente a `listen("app_data_changed")`. Devolve a função de cancelamento. */
    subscribe(listener: WebSnapshotListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    createTask(name: string, category: string, subcategory: string): CreateTaskResult {
      const trimmed = name.trim();
      if (!trimmed) throw new BackendError("empty_name");
      const { result, revision: rev } = mutate((d) => {
        const task: Task = {
          id: uniqueId("task"),
          name: trimmed,
          category: category.trim() || DEFAULT_CATEGORY,
          subcategory: subcategory.trim() || DEFAULT_SUBCATEGORY,
          sessions: [],
        };
        d.tasks.push(task);
        d.activeTaskId = task.id;
        return task.id;
      });
      return { revision: rev, taskId: result };
    },

    updateTaskMeta(taskId: string, patch: TaskMetaPatch): RevisionResult {
      if (patch.name !== undefined && !patch.name.trim()) throw new BackendError("empty_name");
      const { revision: rev } = mutate((d) => {
        const task = findTask(d, taskId);
        if (patch.name !== undefined) task.name = patch.name.trim();
        if (patch.category !== undefined) task.category = patch.category.trim();
        if (patch.subcategory !== undefined) task.subcategory = patch.subcategory.trim();
      });
      return { revision: rev };
    },

    deleteTask(taskId: string): RevisionResult {
      const { revision: rev } = mutate((d) => {
        const idx = d.tasks.findIndex((t) => t.id === taskId);
        if (idx < 0) throw new BackendError("task_not_found");
        d.tasks.splice(idx, 1);
        if (d.activeTaskId === taskId) d.activeTaskId = d.tasks[0]?.id ?? null;
      });
      return { revision: rev };
    },

    setActiveTask(taskId: string | null): RevisionResult {
      const { revision: rev } = mutate((d) => {
        if (taskId !== null) findTask(d, taskId);
        d.activeTaskId = taskId;
      });
      return { revision: rev };
    },

    addManualSessions(taskId: string, date: string, sensCm: number, scores: number[]): RevisionResult {
      if (
        !date.trim() ||
        !Number.isFinite(sensCm) ||
        sensCm <= 0 ||
        scores.length === 0 ||
        scores.some((s) => !Number.isFinite(s) || s <= 0)
      ) {
        throw new BackendError("invalid_payload");
      }
      const { revision: rev } = mutate((d) => {
        const task = findTask(d, taskId);
        for (const score of scores) {
          const session: Session = {
            id: uniqueId("sess"),
            date: date.trim(),
            sens: sensCm,
            pb: score,
            threshold: 0,
          };
          task.sessions.push(session);
        }
      });
      return { revision: rev };
    },

    deleteSession(taskId: string, sessionId: string): RevisionResult {
      const { revision: rev } = mutate((d) => {
        const task = findTask(d, taskId);
        const idx = task.sessions.findIndex((s) => s.id === sessionId);
        if (idx < 0) throw new BackendError("session_not_found");
        task.sessions.splice(idx, 1);
      });
      return { revision: rev };
    },

    upsertPlaylist(playlist: Playlist): UpsertPlaylistResult {
      const name = playlist.name.trim();
      if (!name) throw new BackendError("empty_name");
      const { result, revision: rev } = mutate((d) => {
        const next: Playlist = {
          ...playlist,
          name,
          id: playlist.id?.trim() ? playlist.id : uniqueId("pl"),
          createdAt: playlist.createdAt?.trim() ? playlist.createdAt : new Date().toISOString(),
          source: playlist.source ?? "user",
          items: playlist.items.map((item) => ({
            ...item,
            id: item.id?.trim() ? item.id : uniqueId("item"),
          })),
        };
        const idx = d.playlists.findIndex((p) => p.id === next.id);
        if (idx >= 0) d.playlists[idx] = next;
        else d.playlists.push(next);
        return next.id;
      });
      return { revision: rev, playlistId: result };
    },

    deletePlaylist(playlistId: string): RevisionResult {
      const { revision: rev } = mutate((d) => {
        const idx = d.playlists.findIndex((p) => p.id === playlistId);
        if (idx < 0) throw new BackendError("playlist_not_found");
        d.playlists.splice(idx, 1);
      });
      return { revision: rev };
    },

    /** O web não lê playlists dos jogos; o front cai no fallback (que não acha nada). */
    syncGamePlaylists(): SyncGamePlaylistsResult {
      throw new BackendError("not_implemented");
    },

    replaceAllData(next: AppData, reason: ReplaceAllReason): RevisionResult {
      if (reason !== "demo" && reason !== "clear" && reason !== "import") {
        throw new BackendError("invalid_payload");
      }
      const { revision: rev } = mutate((d) => {
        const replacement = sanitize(clone(next));
        d.activeTaskId = replacement.activeTaskId;
        d.tasks = replacement.tasks;
        d.playlists = replacement.playlists;
      });
      return { revision: rev };
    },

    importJsonBackup(json: string): RevisionResult {
      let parsed: AppData;
      try {
        parsed = JSON.parse(json) as AppData;
      } catch {
        throw new BackendError("invalid_backup");
      }
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tasks)) {
        throw new BackendError("invalid_backup");
      }
      return this.replaceAllData(parsed, "import");
    },
  };
}

export type WebBackend = ReturnType<typeof createWebBackend>;

let singleton: WebBackend | null = null;

/** Instância única usada pelo bridge quando não há Tauri. */
export function getWebBackend(): WebBackend {
  if (!singleton) singleton = createWebBackend();
  return singleton;
}
