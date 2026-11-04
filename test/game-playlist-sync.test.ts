import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWebBackend } from "../src/lib/web-backend.ts";
import { DataStore } from "../src/lib/data-store.ts";
import {
  ensureDetectedPlaylist,
  fromRawKovaakPlaylists,
  syncGamePlaylistsFallback,
  type PlaylistSyncApi,
} from "../src/lib/game-playlist-sync.ts";
import type { AppData } from "../src/lib/types.ts";

const EMPTY: AppData = { activeTaskId: null, tasks: [], playlists: [] };

/** API de sync ligada ao web-backend + DataStore (o mesmo caminho do app, sem Tauri). */
function setup(initial: AppData = EMPTY) {
  const backend = createWebBackend({ storage: null, initial: () => initial });
  const store = new DataStore();
  store.apply(backend.getAppData());
  backend.subscribe((s) => store.apply(s));
  const api: PlaylistSyncApi = {
    getData: () => store.getSnapshot().data,
    createTask: async (n, c, s) => backend.createTask(n, c, s),
    upsertPlaylist: async (p) => backend.upsertPlaylist(p),
    setActiveTask: async (id) => backend.setActiveTask(id),
    waitForRevision: (r) => store.waitForRevision(r, 50),
  };
  return { backend, store, api };
}

describe("syncGamePlaylistsFallback (TODO T2.5)", () => {
  it("creates tasks and playlists, counts imported, keeps the user's active task", async () => {
    const { api, store, backend } = setup({
      activeTaskId: "keep",
      tasks: [{ id: "keep", name: "Existing", category: "c", subcategory: "s", sessions: [] }],
      playlists: [],
    });
    const inputs = fromRawKovaakPlaylists(
      [
        {
          playlistName: " Routine ",
          scenarioList: [
            { scenarioName: "existing", playCount: 2 },
            { scenarioName: "Brand New Scenario", playCount: 0 },
          ],
        },
      ],
      false
    );
    const res = await syncGamePlaylistsFallback(api, inputs);
    assert.equal(res.imported, 1);

    const data = backend.getAppData().data;
    assert.equal(data.tasks.length, 2, "só a task que faltava foi criada");
    assert.equal(data.activeTaskId, "keep", "create_task ativa a nova; o fallback devolve a ativa");
    const pl = data.playlists[0];
    assert.equal(pl.name, "Routine");
    assert.deepEqual(pl.items.map((i) => i.targetValue), [2, 1]);
    assert.equal(pl.items[0].taskId, "keep");
    assert.ok(pl.items.every((i) => i.id));
    await store.waitForRevision(res.lastRevision);
    assert.equal(store.getSnapshot().revision, backend.getAppData().revision);
  });

  it("refreshes an existing playlist keeping targets by position, and imports 0", async () => {
    const { api, backend } = setup();
    const raw = [
      { playlistName: "P", scenarioList: [{ scenarioName: "A", playCount: 1 }, { scenarioName: "B", playCount: 1 }] },
    ];
    await syncGamePlaylistsFallback(api, fromRawKovaakPlaylists(raw, false));
    const first = backend.getAppData().data.playlists[0];
    backend.upsertPlaylist({
      ...first,
      items: first.items.map((i) => ({ ...i, targetMode: "time" as const, targetValue: 90 })),
    });

    const again = await syncGamePlaylistsFallback(api, fromRawKovaakPlaylists(raw, false));
    assert.equal(again.imported, 0);
    const data = backend.getAppData().data;
    assert.equal(data.playlists.length, 1);
    assert.deepEqual(data.playlists[0].items.map((i) => [i.targetMode, i.targetValue]), [["time", 90], ["time", 90]]);
    assert.equal(data.tasks.length, 2);
  });
});

describe("ensureDetectedPlaylist", () => {
  it("returns the playlist found in the CURRENT snapshot without writing", async () => {
    const { api, backend } = setup();
    backend.upsertPlaylist({ id: "", name: "Daily", items: [], createdAt: "" });
    const before = backend.getAppData().revision;
    const found = await ensureDetectedPlaylist(api, { name: "daily", items: [] });
    assert.equal(found?.name, "Daily");
    assert.equal(backend.getAppData().revision, before);
  });

  it("creates the playlist from the scenario list and returns it from the snapshot after the awaits", async () => {
    const { api, backend } = setup();
    const created = await ensureDetectedPlaylist(api, {
      name: "Detected",
      items: [{ scenarioName: "Scen 1", playCount: 3 }],
    });
    assert.ok(created);
    assert.equal(created.items[0].targetValue, 3);
    assert.equal(backend.getAppData().data.playlists[0].id, created.id);
    assert.equal(backend.getAppData().data.tasks.length, 1);
  });

  it("returns null when the playlist is unknown and has no scenarios", async () => {
    const { api } = setup();
    assert.equal(await ensureDetectedPlaylist(api, { name: "Nope", items: [] }), null);
    assert.equal(await ensureDetectedPlaylist(api, { name: "  ", items: [] }), null);
  });
});
