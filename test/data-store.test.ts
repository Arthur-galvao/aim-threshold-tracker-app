import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DataStore, type DataStoreBackend } from "../src/lib/data-store.ts";
import type { AppData, AppDataSnapshot } from "../src/lib/types.ts";

function data(taskNames: string[], active: string | null = null): AppData {
  return {
    activeTaskId: active,
    tasks: taskNames.map((name) => ({ id: name, name, category: "c", subcategory: "s", sessions: [] })),
    playlists: [],
  };
}

function snap(revision: number, names: string[] = []): AppDataSnapshot {
  return { revision, data: data(names) };
}

/** Backend falso controlável: guarda o callback do evento e quantos listens/unlistens houve. */
function fakeBackend(initial: AppDataSnapshot) {
  let callback: ((s: AppDataSnapshot) => void) | null = null;
  const state = { listens: 0, unlistens: 0, gets: 0, current: initial };
  const backend: DataStoreBackend = {
    async getAppData() {
      state.gets += 1;
      return state.current;
    },
    async onAppDataChanged(cb) {
      state.listens += 1;
      callback = cb;
      return () => {
        state.unlistens += 1;
        callback = null;
      };
    },
  };
  return { backend, state, emit: (s: AppDataSnapshot) => callback?.(s) };
}

describe("DataStore", () => {
  it("starts unloaded with a stable empty snapshot", () => {
    const store = new DataStore();
    assert.equal(store.isLoaded(), false);
    assert.equal(store.getSnapshot(), store.getSnapshot());
    assert.equal(store.getSnapshot().revision, -1);
  });

  it("applies newer snapshots and notifies subscribers", () => {
    const store = new DataStore();
    let calls = 0;
    store.subscribe(() => calls++);
    assert.equal(store.apply(snap(0, ["a"])), true);
    assert.equal(store.apply(snap(1, ["a", "b"])), true);
    assert.equal(calls, 2);
    assert.equal(store.getSnapshot().data.tasks.length, 2);
    assert.equal(store.isLoaded(), true);
  });

  it("ignores snapshots with revision <= current (an older snapshot never wins)", () => {
    const store = new DataStore();
    store.apply(snap(5, ["new"]));
    let calls = 0;
    store.subscribe(() => calls++);
    const before = store.getSnapshot();

    assert.equal(store.apply(snap(4, ["stale"])), false);
    assert.equal(store.apply(snap(5, ["same-rev-other-data"])), false);
    assert.equal(store.getSnapshot(), before, "referência preservada");
    assert.equal(store.getSnapshot().data.tasks[0].name, "new");
    assert.equal(calls, 0, "ninguém é notificado por snapshot ignorado");

    assert.equal(store.apply(snap(6, ["newer"])), true);
    assert.equal(store.getSnapshot().data.tasks[0].name, "newer");
  });

  it("unsubscribe stops notifications", () => {
    const store = new DataStore();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.apply(snap(0));
    off();
    store.apply(snap(1));
    assert.equal(calls, 1);
  });

  it("init: event received before get_app_data resolves does not get overwritten by the older initial", async () => {
    const store = new DataStore();
    const fake = fakeBackend(snap(3, ["initial"]));
    // o evento (rev 4) chega durante o get_app_data
    const original = fake.backend.getAppData;
    fake.backend.getAppData = async () => {
      fake.emit(snap(4, ["from-event"]));
      return original();
    };
    await store.init(fake.backend);
    assert.equal(store.getSnapshot().revision, 4);
    assert.equal(store.getSnapshot().data.tasks[0].name, "from-event");
  });

  it("init is idempotent (one listener, one get)", async () => {
    const store = new DataStore();
    const fake = fakeBackend(snap(0));
    await Promise.all([store.init(fake.backend), store.init(fake.backend)]);
    await store.init(fake.backend);
    assert.equal(fake.state.listens, 1);
    assert.equal(fake.state.gets, 1);
  });

  it("dispose before listen resolves does not leak the listener (StrictMode)", async () => {
    const store = new DataStore();
    let release: (un: () => void) => void = () => {};
    let unlistened = 0;
    const backend: DataStoreBackend = {
      getAppData: async () => snap(0),
      onAppDataChanged: () =>
        new Promise((resolve) => {
          release = () => resolve(() => void unlistened++);
        }),
    };
    const pending = store.init(backend);
    store.dispose(); // efeito desmontado antes do listen() resolver
    release(() => {});
    await pending;
    assert.equal(unlistened, 1, "o listener tardio foi desfeito");
    assert.equal(store.isLoaded(), false);
  });

  it("dispose then init again re-registers cleanly", async () => {
    const store = new DataStore();
    const fake = fakeBackend(snap(0, ["a"]));
    await store.init(fake.backend);
    store.dispose();
    assert.equal(fake.state.unlistens, 1);
    await store.init(fake.backend);
    assert.equal(fake.state.listens, 2);
    fake.emit(snap(1, ["a", "b"]));
    assert.equal(store.getSnapshot().data.tasks.length, 2);
  });

  it("waitForRevision resolves as soon as the snapshot arrives", async () => {
    const store = new DataStore();
    store.apply(snap(1));
    let done = false;
    const waiting = store.waitForRevision(3).then(() => (done = true));
    await Promise.resolve();
    assert.equal(done, false);
    store.apply(snap(2));
    await Promise.resolve();
    assert.equal(done, false);
    store.apply(snap(3));
    await waiting;
    assert.equal(done, true);
    await store.waitForRevision(2); // já alcançada: resolve direto
  });

  it("waitForRevision falls back to get_app_data when the event never arrives", async () => {
    const store = new DataStore();
    const fake = fakeBackend(snap(7, ["fetched"]));
    await store.init(fake.backend); // aplica rev 7
    fake.state.current = snap(9, ["after-timeout"]);
    await store.waitForRevision(9, 20);
    assert.equal(store.getSnapshot().revision, 9);
    assert.equal(store.getSnapshot().data.tasks[0].name, "after-timeout");
  });
});
