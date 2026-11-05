import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWebBackend, WEB_STORAGE_KEY, type WebStorage } from "../src/lib/web-backend.ts";
import { BackendError } from "../src/lib/backend-error.ts";
import type { AppData, AppDataSnapshot } from "../src/lib/types.ts";

function memoryStorage(initial?: AppData): WebStorage & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  if (initial) raw.set(WEB_STORAGE_KEY, JSON.stringify(initial));
  return { raw, getItem: (k) => raw.get(k) ?? null, setItem: (k, v) => void raw.set(k, v) };
}

const EMPTY: AppData = { activeTaskId: null, tasks: [], playlists: [] };

function fresh(initial: AppData = EMPTY) {
  const storage = memoryStorage();
  return { backend: createWebBackend({ storage, initial: () => initial }), storage };
}

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof BackendError, "erro deve ser BackendError");
    return e.code;
  }
  assert.fail("esperava erro");
}

describe("web-backend (mesmo contrato do Rust)", () => {
  it("mutations bump the revision, persist and emit snapshots", () => {
    const { backend, storage } = fresh();
    const seen: AppDataSnapshot[] = [];
    backend.subscribe((s) => seen.push(s));
    assert.equal(backend.getAppData().revision, 0);

    const { taskId, revision } = backend.createTask("  1w2ts  ", "Click Timing", "Precision");
    assert.equal(revision, 1);
    const added = backend.addManualSessions(taskId, "2026-10-12", 45, [100, 120]);
    assert.equal(added.revision, 2);

    assert.deepEqual(seen.map((s) => s.revision), [1, 2]);
    const data = backend.getAppData().data;
    assert.equal(data.tasks[0].name, "1w2ts");
    assert.equal(data.tasks[0].sessions.length, 2);
    assert.equal(data.activeTaskId, taskId);
    assert.equal(JSON.parse(storage.raw.get(WEB_STORAGE_KEY)!).tasks[0].sessions.length, 2);
  });

  it("returns short error codes and does not bump the revision on failure", () => {
    const { backend } = fresh();
    const { taskId } = backend.createTask("A", "c", "s");
    const rev = backend.getAppData().revision;
    assert.equal(code(() => backend.createTask("  ", "c", "s")), "empty_name");
    assert.equal(code(() => backend.updateTaskMeta("nope", { name: "x" })), "task_not_found");
    assert.equal(code(() => backend.updateTaskMeta(taskId, { name: " " })), "empty_name");
    assert.equal(code(() => backend.deleteTask("nope")), "task_not_found");
    assert.equal(code(() => backend.setActiveTask("nope")), "task_not_found");
    assert.equal(code(() => backend.deleteSession(taskId, "nope")), "session_not_found");
    assert.equal(code(() => backend.deletePlaylist("nope")), "playlist_not_found");
    assert.equal(code(() => backend.addManualSessions(taskId, "2026-10-12", 45, [])), "invalid_payload");
    assert.deepEqual(backend.syncGamePlaylists(), { revision: rev, imported: 0, total: 0 });
    assert.equal(code(() => backend.importJsonBackup("{not json")), "invalid_backup");
    assert.equal(code(() => backend.importJsonBackup('{"tasks":1}')), "invalid_backup");
    assert.equal(backend.getAppData().revision, rev);
  });

  it("delete_task moves the active task; delete_session removes one session", () => {
    const { backend } = fresh();
    const a = backend.createTask("A", "c", "s").taskId;
    const b = backend.createTask("B", "c", "s").taskId;
    backend.addManualSessions(a, "2026-10-12", 45, [1, 2]);
    const sid = backend.getAppData().data.tasks[0].sessions[0].id;
    backend.deleteSession(a, sid);
    assert.equal(backend.getAppData().data.tasks[0].sessions.length, 1);
    backend.deleteTask(b);
    assert.equal(backend.getAppData().data.activeTaskId, a);
  });

  it("upsert_playlist generates ids and replaces by id", () => {
    const { backend } = fresh();
    const { playlistId } = backend.upsertPlaylist({
      id: "",
      name: "Warmup",
      items: [{ id: "", taskId: "t", targetMode: "reps", targetValue: 3 }],
      createdAt: "",
    });
    let pl = backend.getAppData().data.playlists[0];
    assert.equal(pl.id, playlistId);
    assert.ok(pl.items[0].id);
    assert.ok(pl.createdAt);
    assert.equal(pl.source, "user");
    backend.upsertPlaylist({ ...pl, name: "Warmup 2" });
    pl = backend.getAppData().data.playlists[0];
    assert.equal(backend.getAppData().data.playlists.length, 1);
    assert.equal(pl.name, "Warmup 2");
    backend.deletePlaylist(playlistId);
    assert.equal(backend.getAppData().data.playlists.length, 0);
  });

  it("replace_all_data bumps the revision, sanitizes ids and fixes the active task", () => {
    const { backend } = fresh();
    const before = backend.getAppData().revision;
    const res = backend.replaceAllData(
      {
        activeTaskId: "ghost",
        playlists: [],
        tasks: [
          { id: "t", name: "A", category: "c", subcategory: "s", sessions: [] },
          { id: "t", name: "B", category: "c", subcategory: "s", sessions: [] },
        ],
      },
      "import"
    );
    assert.equal(res.revision, before + 1);
    const data = backend.getAppData().data;
    assert.notEqual(data.tasks[0].id, data.tasks[1].id);
    assert.equal(data.activeTaskId, data.tasks[0].id);
    assert.equal(code(() => backend.replaceAllData(EMPTY, "bogus" as never)), "invalid_payload");
  });

  it("loads persisted data on creation", () => {
    const stored: AppData = {
      activeTaskId: "x",
      tasks: [{ id: "x", name: "Stored", category: "c", subcategory: "s", sessions: [] }],
      playlists: [],
    };
    const backend = createWebBackend({ storage: memoryStorage(stored), initial: () => EMPTY });
    assert.equal(backend.getAppData().data.tasks[0].name, "Stored");
  });

  it("unsubscribe stops events", () => {
    const { backend } = fresh();
    let n = 0;
    const off = backend.subscribe(() => n++);
    backend.createTask("A", "c", "s");
    off();
    backend.createTask("B", "c", "s");
    assert.equal(n, 1);
  });
});

describe("web-backend: foco da sessão e intentCue (Plano 07)", () => {
  it("setSessionFocus sets, clears and validates", () => {
    const { backend } = fresh();
    const { taskId } = backend.createTask("A", "c", "s");
    backend.addManualSessions(taskId, "2026-10-12", 45, [100]);
    const sid = backend.getAppData().data.tasks[0].sessions[0].id;
    backend.setSessionFocus(taskId, sid, "on");
    assert.equal(backend.getAppData().data.tasks[0].sessions[0].focus, "on");
    backend.setSessionFocus(taskId, sid, null);
    assert.equal(backend.getAppData().data.tasks[0].sessions[0].focus, undefined);
    assert.equal(code(() => backend.setSessionFocus(taskId, "nope", "on")), "session_not_found");
    assert.equal(code(() => backend.setSessionFocus("nope", sid, "on")), "task_not_found");
    assert.equal(code(() => backend.setSessionFocus(taskId, sid, "x" as never)), "invalid_payload");
  });

  it("updateTaskMeta truncates intentCue to 80 chars and empty clears it", () => {
    const { backend } = fresh();
    const { taskId } = backend.createTask("A", "c", "s");
    backend.updateTaskMeta(taskId, { intentCue: "y".repeat(200) });
    assert.equal(backend.getAppData().data.tasks[0].intentCue?.length, 80);
    backend.updateTaskMeta(taskId, { intentCue: "  " });
    assert.equal(backend.getAppData().data.tasks[0].intentCue, undefined);
  });
});
