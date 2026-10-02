import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AppSettings, DetectedPlaylistEvent, Playlist, PlaylistItem, Task } from "../src/lib/types.ts";
import { categorizeScenario } from "../src/lib/viscose.ts";

describe("playlist-sync and detection", () => {
  describe("AppSettings and DetectedPlaylistEvent type structures", () => {
    it("supports background and auto-playlist settings keys", () => {
      const settings: AppSettings = {
        kovaak_stats_path: "C:\\Kovaaks\\stats",
        watcher_active: true,
        import_on_first_run: false,
        close_to_tray: true,
        auto_detect_playlist: true,
        notify_step_advance: true,
      };

      assert.equal(settings.close_to_tray, true);
      assert.equal(settings.auto_detect_playlist, true);
      assert.equal(settings.notify_step_advance, true);
    });

    it("allows optional flags in AppSettings", () => {
      const settings: AppSettings = {
        kovaak_stats_path: null,
        watcher_active: false,
        import_on_first_run: true,
      };

      assert.equal(settings.close_to_tray, undefined);
      assert.equal(settings.auto_detect_playlist, undefined);
      assert.equal(settings.notify_step_advance, undefined);
    });

    it("verifies DetectedPlaylistEvent format", () => {
      const event: DetectedPlaylistEvent = {
        playlist_name: "Voltaic Daily - Tracking",
        playlist_id: "987654",
        scenario_list: [
          { scenario_name: "Smoothbot Unranked", play_count: 3 },
          { scenario_name: "Air Angelic 4", play_count: 2 },
        ],
      };

      assert.equal(event.playlist_name, "Voltaic Daily - Tracking");
      assert.equal(event.playlist_id, "987654");
      assert.equal(event.scenario_list.length, 2);
      assert.equal(event.scenario_list[0].scenario_name, "Smoothbot Unranked");
      assert.equal(event.scenario_list[0].play_count, 3);
    });
  });

  describe("Event normalization logic", () => {
    function normalizeDetectedPlaylist(raw: any): DetectedPlaylistEvent | null {
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

    it("normalizes camelCase payload from Tauri KovaakPlaylist serialization", () => {
      const payloadFromRust = {
        playlistName: "VT Novice Routine",
        playlistId: 4567,
        scenarioList: [
          { scenarioName: "VT 1w4ts", playCount: 3 },
          { scenarioName: "VT Pasu", playCount: 2 },
        ],
      };

      const normalized = normalizeDetectedPlaylist(payloadFromRust);
      assert.ok(normalized);
      assert.equal(normalized.playlist_name, "VT Novice Routine");
      assert.equal(normalized.playlist_id, "4567");
      assert.equal(normalized.scenario_list.length, 2);
      assert.equal(normalized.scenario_list[0].scenario_name, "VT 1w4ts");
      assert.equal(normalized.scenario_list[0].play_count, 3);
    });

    it("normalizes snake_case payload verbatim", () => {
      const payloadSnake = {
        playlist_name: "VT Advanced Routine",
        playlist_id: "vt_adv",
        scenario_list: [
          { scenario_name: "Smoothbot", play_count: 5 },
        ],
      };

      const normalized = normalizeDetectedPlaylist(payloadSnake);
      assert.ok(normalized);
      assert.equal(normalized.playlist_name, "VT Advanced Routine");
      assert.equal(normalized.playlist_id, "vt_adv");
      assert.equal(normalized.scenario_list[0].scenario_name, "Smoothbot");
      assert.equal(normalized.scenario_list[0].play_count, 5);
    });

    it("handles null or undefined payload safely", () => {
      assert.equal(normalizeDetectedPlaylist(null), null);
      assert.equal(normalizeDetectedPlaylist(undefined), null);
    });
  });

  describe("Automatic playlist construction from scenario_list", () => {
    it("constructs Playlist and Tasks matching scenario_list items", () => {
      const event: DetectedPlaylistEvent = {
        playlist_name: "VT Pure Tracking",
        playlist_id: "pl_pure_1",
        scenario_list: [
          { scenario_name: "Ground Plaza Voltaic", play_count: 3 },
          { scenario_name: "Air Voltaic", play_count: 2 },
        ],
      };

      const existingTasks: Task[] = [];
      const updatedTasks = [...existingTasks];
      const items: PlaylistItem[] = [];

      for (let idx = 0; idx < event.scenario_list.length; idx++) {
        const sItem = event.scenario_list[idx];
        const scenarioName = sItem.scenario_name.trim();

        let task = updatedTasks.find(
          (t) => t.name.trim().toLowerCase() === scenarioName.toLowerCase()
        );
        if (!task) {
          const { category, subcategory } = categorizeScenario(scenarioName);
          task = {
            id: `task_${idx}`,
            name: scenarioName,
            category,
            subcategory,
            sessions: [],
          };
          updatedTasks.push(task);
        }

        items.push({
          id: `item_${idx}`,
          taskId: task.id,
          targetMode: "reps",
          targetValue: Math.max(1, Math.round(sItem.play_count || 1)),
        });
      }

      const constructedPlaylist: Playlist = {
        id: "pl_created_1",
        name: event.playlist_name,
        items,
        createdAt: "2026-10-02T12:00:00Z",
      };

      assert.equal(constructedPlaylist.name, "VT Pure Tracking");
      assert.equal(constructedPlaylist.items.length, 2);
      assert.equal(constructedPlaylist.items[0].targetValue, 3);
      assert.equal(constructedPlaylist.items[1].targetValue, 2);
      assert.equal(updatedTasks.length, 2);
      assert.equal(updatedTasks[0].name, "Ground Plaza Voltaic");
      assert.equal(updatedTasks[1].name, "Air Voltaic");
    });
  });

  describe("syncWithDetectedScenario behavior", () => {
    interface RunnerSimulationState {
      currentStepIndex: number;
      completedStepIndices: Set<number>;
      sessionCountAtStart: number;
      isRunning: boolean;
      isFinished: boolean;
    }

    function simulateSync(
      state: RunnerSimulationState,
      playlist: Playlist,
      tasks: Task[],
      scenarioName: string,
      playlistName?: string
    ): RunnerSimulationState {
      const taskMap = new Map(tasks.map((t) => [t.id, t]));
      const cleanScenario = scenarioName.trim().toLowerCase();

      const playlistMatches =
        Boolean(playlistName && playlistName.trim()) &&
        playlist.name.trim().toLowerCase() === playlistName!.trim().toLowerCase();

      const targetStepIndex = playlist.items.findIndex((item) => {
        const task = taskMap.get(item.taskId);
        return task && task.name.trim().toLowerCase() === cleanScenario;
      });

      if (!playlistMatches && targetStepIndex === -1) {
        return state;
      }
      if (targetStepIndex === -1) {
        return state;
      }

      const newState = {
        ...state,
        completedStepIndices: new Set(state.completedStepIndices),
      };

      if (!newState.isRunning || newState.isFinished) {
        newState.isFinished = false;
        newState.isRunning = true;
      }

      if (targetStepIndex === state.currentStepIndex) {
        const item = playlist.items[targetStepIndex];
        const task = taskMap.get(item.taskId);
        const count = task ? task.sessions.length : 0;
        const completedReps = count - state.sessionCountAtStart;

        if (item.targetMode === "reps" && completedReps >= item.targetValue) {
          newState.completedStepIndices.add(targetStepIndex);
          if (targetStepIndex + 1 < playlist.items.length) {
            newState.currentStepIndex = targetStepIndex + 1;
            const nextItem = playlist.items[targetStepIndex + 1];
            const nextTask = taskMap.get(nextItem.taskId);
            newState.sessionCountAtStart = nextTask ? nextTask.sessions.length : 0;
          } else {
            newState.isFinished = true;
            newState.isRunning = false;
          }
        }
      } else if (targetStepIndex > state.currentStepIndex) {
        for (let i = 0; i < targetStepIndex; i++) {
          newState.completedStepIndices.add(i);
        }
        newState.currentStepIndex = targetStepIndex;
        const targetItem = playlist.items[targetStepIndex];
        const targetTask = taskMap.get(targetItem.taskId);
        newState.sessionCountAtStart = targetTask ? targetTask.sessions.length : 0;
      } else if (state.isFinished || !state.completedStepIndices.has(targetStepIndex)) {
        newState.currentStepIndex = targetStepIndex;
        const targetItem = playlist.items[targetStepIndex];
        const targetTask = taskMap.get(targetItem.taskId);
        newState.sessionCountAtStart = targetTask ? targetTask.sessions.length : 0;
      }

      return newState;
    }

    const testTasks: Task[] = [
      {
        id: "task_1",
        name: "Smoothbot Unranked",
        category: "Tracking",
        subcategory: "Smoothness",
        sessions: [],
      },
      {
        id: "task_2",
        name: "Air Angelic 4",
        category: "Tracking",
        subcategory: "Reactive",
        sessions: [],
      },
      {
        id: "task_3",
        name: "Pasu Small",
        category: "Click Timing",
        subcategory: "Dynamic",
        sessions: [],
      },
    ];

    const testPlaylist: Playlist = {
      id: "pl_test",
      name: "Daily Routine",
      createdAt: "2026-10-02T12:00:00Z",
      items: [
        { id: "i_1", taskId: "task_1", targetMode: "reps", targetValue: 3 },
        { id: "i_2", taskId: "task_2", targetMode: "reps", targetValue: 2 },
        { id: "i_3", taskId: "task_3", targetMode: "reps", targetValue: 1 },
      ],
    };

    it("keeps current step when repetitions are below targetValue", () => {
      testTasks[0].sessions = [{ id: "s1", date: "2026-10-02", sens: 40, pb: 100, threshold: 90 }];

      const state: RunnerSimulationState = {
        currentStepIndex: 0,
        completedStepIndices: new Set(),
        sessionCountAtStart: 0,
        isRunning: true,
        isFinished: false,
      };

      const nextState = simulateSync(state, testPlaylist, testTasks, "Smoothbot Unranked", "Daily Routine");
      assert.equal(nextState.currentStepIndex, 0);
      assert.equal(nextState.completedStepIndices.has(0), false);
    });

    it("advances smoothly to next step when target repetitions are satisfied", () => {
      testTasks[0].sessions = [
        { id: "s1", date: "2026-10-02", sens: 40, pb: 100, threshold: 90 },
        { id: "s2", date: "2026-10-02", sens: 40, pb: 102, threshold: 90 },
        { id: "s3", date: "2026-10-02", sens: 40, pb: 105, threshold: 90 },
      ];

      const state: RunnerSimulationState = {
        currentStepIndex: 0,
        completedStepIndices: new Set(),
        sessionCountAtStart: 0,
        isRunning: true,
        isFinished: false,
      };

      const nextState = simulateSync(state, testPlaylist, testTasks, "Smoothbot Unranked", "Daily Routine");
      assert.equal(nextState.currentStepIndex, 1);
      assert.equal(nextState.completedStepIndices.has(0), true);
    });

    it("jumps forward to detected step when player skips ahead in Kovaaks", () => {
      const state: RunnerSimulationState = {
        currentStepIndex: 0,
        completedStepIndices: new Set(),
        sessionCountAtStart: 0,
        isRunning: true,
        isFinished: false,
      };

      const nextState = simulateSync(state, testPlaylist, testTasks, "Pasu Small", "Daily Routine");
      assert.equal(nextState.currentStepIndex, 2);
      assert.equal(nextState.completedStepIndices.has(0), true);
      assert.equal(nextState.completedStepIndices.has(1), true);
    });

    it("does not regress step on lagging event for already completed step", () => {
      const state: RunnerSimulationState = {
        currentStepIndex: 1,
        completedStepIndices: new Set([0]),
        sessionCountAtStart: 0,
        isRunning: true,
        isFinished: false,
      };

      const nextState = simulateSync(state, testPlaylist, testTasks, "Smoothbot Unranked", "Daily Routine");
      assert.equal(nextState.currentStepIndex, 1);
    });

    it("ignores sync when scenario does not belong to playlist and playlist name does not match", () => {
      const state: RunnerSimulationState = {
        currentStepIndex: 0,
        completedStepIndices: new Set(),
        sessionCountAtStart: 0,
        isRunning: true,
        isFinished: false,
      };

      const nextState = simulateSync(state, testPlaylist, testTasks, "Unknown Scenario", "Other Playlist");
      assert.equal(nextState.currentStepIndex, 0);
    });
  });

  describe("Notification dispatch and repetition suppression", () => {
    it("distinguishes initial playlist detection from in-progress step advance", () => {
      const dispatchedNotifications: Array<{ title: string; body: string }> = [];

      function notifyHelper(title: string, body: string) {
        dispatchedNotifications.push({ title, body });
      }

      function handlePlaylistEvent(
        event: DetectedPlaylistEvent,
        activePlaylist: Playlist | null,
        isRunning: boolean
      ) {
        const isSamePlaylistRunning =
          isRunning &&
          activePlaylist !== null &&
          activePlaylist.name.trim().toLowerCase() === event.playlist_name.trim().toLowerCase();

        if (!isSamePlaylistRunning) {
          notifyHelper("Aim Threshold Tracker", `Playlist detectada: ${event.playlist_name}`);
        }
      }

      const testEvent: DetectedPlaylistEvent = {
        playlist_name: "Daily Warmup",
        scenario_list: [{ scenario_name: "Smoothbot", play_count: 3 }],
      };

      // 1. Initial detection: playlist not running -> notification sent
      handlePlaylistEvent(testEvent, null, false);
      assert.equal(dispatchedNotifications.length, 1);
      assert.equal(dispatchedNotifications[0].body, "Playlist detectada: Daily Warmup");

      // 2. Subsequent runs of the same playlist -> "Playlist detectada" must NOT be resent
      const currentActivePlaylist: Playlist = {
        id: "pl_1",
        name: "Daily Warmup",
        items: [],
        createdAt: "2026-10-02T12:00:00Z",
      };
      handlePlaylistEvent(testEvent, currentActivePlaylist, true);
      assert.equal(dispatchedNotifications.length, 1); // Still 1, not duplicated!

      // 3. Step advance notification when scenario transitions
      notifyHelper("Aim Threshold Tracker", "Etapa avançada: Air Angelic 4");
      assert.equal(dispatchedNotifications.length, 2);
      assert.equal(dispatchedNotifications[1].body, "Etapa avançada: Air Angelic 4");

      // 4. Switching to another playlist -> new detection notification sent
      const anotherEvent: DetectedPlaylistEvent = {
        playlist_name: "Speed Routine",
        scenario_list: [{ scenario_name: "Pasu", play_count: 2 }],
      };
      handlePlaylistEvent(anotherEvent, currentActivePlaylist, true);
      assert.equal(dispatchedNotifications.length, 3);
      assert.equal(dispatchedNotifications[2].body, "Playlist detectada: Speed Routine");
    });
  });
});
