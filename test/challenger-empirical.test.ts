import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Playlist, Task, AppData } from "../src/lib/types.ts";
import { resolveAutoAdvanceOnThreshold, computeTaskMetrics } from "../src/lib/threshold.ts";

// Helper reproducing the pure scenario breakdown filtering logic from ScenarioBreakdown.tsx:52-98
function filterScenarios({
  tasks,
  playlists,
  selectedPlaylistId,
  categoryFilter = "All",
  search = "",
  weaknessFocus = false,
}: {
  tasks: Task[];
  playlists: Playlist[];
  selectedPlaylistId: string;
  categoryFilter?: string;
  search?: string;
  weaknessFocus?: boolean;
}): Task[] {
  const effectivePlaylistId = playlists.some((p) => p.id === selectedPlaylistId)
    ? selectedPlaylistId
    : "All";

  const selectedPlaylist =
    effectivePlaylistId !== "All"
      ? playlists.find((p) => p.id === effectivePlaylistId)
      : null;

  const playlistTaskIds = selectedPlaylist
    ? new Set(selectedPlaylist.items.map((it) => it.taskId))
    : null;

  const base = tasks.filter((task) => {
    const matchPlaylist = !playlistTaskIds || playlistTaskIds.has(task.id);
    const matchCat = categoryFilter === "All" || task.category === categoryFilter;
    const matchSearch =
      search.trim() === "" ||
      task.name.toLowerCase().includes(search.toLowerCase()) ||
      task.subcategory.toLowerCase().includes(search.toLowerCase());
    return matchPlaylist && matchCat && matchSearch;
  });

  if (selectedPlaylist && !weaknessFocus) {
    const orderIndexMap = new Map<string, number>();
    selectedPlaylist.items.forEach((item, idx) => {
      if (!orderIndexMap.has(item.taskId)) {
        orderIndexMap.set(item.taskId, idx);
      }
    });
    return [...base].sort(
      (a, b) => (orderIndexMap.get(a.id) ?? 999) - (orderIndexMap.get(b.id) ?? 999)
    );
  }

  if (!weaknessFocus) return base;

  const weaknessScore = (task: Task): number => {
    if (!task.sessions || task.sessions.length === 0) return 2;
    const last = task.sessions[task.sessions.length - 1];
    const thresh = Number(last.threshold) || 0;
    const lastPb = Number(last.pb) || 0;
    const recentRatio = thresh > 0 ? lastPb / thresh : 1;
    const { hitRate } = computeTaskMetrics(task);
    const hitNorm = hitRate !== null ? hitRate / 100 : 0.85;
    return hitNorm * 0.5 + recentRatio * 0.5;
  };

  return [...base].sort((a, b) => weaknessScore(a) - weaknessScore(b));
}

describe("Empirical Challenger Suite: Scenario Overview Filtering Stress", () => {
  const mockTasks: Task[] = [
    {
      id: "task-1",
      name: "VT Pasu Intermediate",
      category: "Click Timing",
      subcategory: "Precision",
      sessions: [
        { id: "s1", date: "2026-10-20", sens: 40, pb: 100, threshold: 90 },
      ],
    },
    {
      id: "task-2",
      name: "VT Smoothbot Rapid",
      category: "Control Tracking",
      subcategory: "Smoothness",
      sessions: [
        { id: "s2", date: "2026-10-21", sens: 35, pb: 200, threshold: 220 },
      ],
    },
    {
      id: "task-3",
      name: "VT Air Angelic",
      category: "Reactive Tracking",
      subcategory: "Speed",
      sessions: [],
    },
    {
      id: "task-4",
      name: "VT Popcorn Precision",
      category: "Click Timing",
      subcategory: "Precision",
      sessions: [
        { id: "s3", date: "2026-10-22", sens: 45, pb: 80, threshold: 75 },
      ],
    },
  ];

  it("handles empty playlists list gracefully (playlists = [])", () => {
    const result = filterScenarios({
      tasks: mockTasks,
      playlists: [],
      selectedPlaylistId: "any-pl-id",
    });
    assert.equal(result.length, 4);
    assert.deepEqual(result.map((t) => t.id), ["task-1", "task-2", "task-3", "task-4"]);
  });

  it("handles selected playlist that has 0 items (empty playlist)", () => {
    const emptyPlaylist: Playlist = {
      id: "pl-empty",
      name: "Empty Routine",
      items: [],
      createdAt: "2026-10-29",
    };
    const result = filterScenarios({
      tasks: mockTasks,
      playlists: [emptyPlaylist],
      selectedPlaylistId: "pl-empty",
    });
    assert.equal(result.length, 0);
  });

  it("handles playlists containing orphaned scenario IDs not present in task database", () => {
    const ghostPlaylist: Playlist = {
      id: "pl-ghost",
      name: "Ghost Routine",
      items: [
        { id: "item-1", taskId: "deleted-scenario-999", targetMode: "reps", targetValue: 3 },
        { id: "item-2", taskId: "task-2", targetMode: "threshold", targetValue: 1 },
        { id: "item-3", taskId: "nonexistent-scenario-000", targetMode: "time", targetValue: 60 },
        { id: "item-4", taskId: "task-4", targetMode: "reps", targetValue: 2 },
      ],
      createdAt: "2026-10-29",
    };

    const result = filterScenarios({
      tasks: mockTasks,
      playlists: [ghostPlaylist],
      selectedPlaylistId: "pl-ghost",
    });

    assert.equal(result.length, 2);
    assert.equal(result[0].id, "task-2");
    assert.equal(result[1].id, "task-4");
  });

  it("handles duplicate scenarios in playlist and preserves first-seen order without duplicate cards", () => {
    const dupePlaylist: Playlist = {
      id: "pl-dupe",
      name: "Repeated Routine",
      items: [
        { id: "item-1", taskId: "task-4", targetMode: "reps", targetValue: 2 },
        { id: "item-2", taskId: "task-1", targetMode: "threshold", targetValue: 1 },
        { id: "item-3", taskId: "task-4", targetMode: "reps", targetValue: 2 }, // repeated
        { id: "item-4", taskId: "task-2", targetMode: "reps", targetValue: 1 },
        { id: "item-5", taskId: "task-1", targetMode: "threshold", targetValue: 1 }, // repeated
      ],
      createdAt: "2026-10-29",
    };

    const result = filterScenarios({
      tasks: mockTasks,
      playlists: [dupePlaylist],
      selectedPlaylistId: "pl-dupe",
    });

    // 3 unique tasks, in order of first appearance: task-4, task-1, task-2
    assert.equal(result.length, 3);
    assert.deepEqual(result.map((t) => t.id), ["task-4", "task-1", "task-2"]);
  });

  it("combines playlist filtering with category filtering correctly", () => {
    const mixedPlaylist: Playlist = {
      id: "pl-mixed",
      name: "Mixed Routine",
      items: [
        { id: "i1", taskId: "task-1", targetMode: "reps", targetValue: 1 }, // Click Timing
        { id: "i2", taskId: "task-2", targetMode: "reps", targetValue: 1 }, // Control Tracking
        { id: "i3", taskId: "task-4", targetMode: "reps", targetValue: 1 }, // Click Timing
      ],
      createdAt: "2026-10-29",
    };

    const result = filterScenarios({
      tasks: mockTasks,
      playlists: [mixedPlaylist],
      selectedPlaylistId: "pl-mixed",
      categoryFilter: "Click Timing",
    });

    assert.equal(result.length, 2);
    assert.deepEqual(result.map((t) => t.id), ["task-1", "task-4"]);
  });

  it("combines playlist filtering with search query correctly", () => {
    const mixedPlaylist: Playlist = {
      id: "pl-mixed",
      name: "Mixed Routine",
      items: [
        { id: "i1", taskId: "task-1", targetMode: "reps", targetValue: 1 },
        { id: "i2", taskId: "task-2", targetMode: "reps", targetValue: 1 },
        { id: "i3", taskId: "task-4", targetMode: "reps", targetValue: 1 },
      ],
      createdAt: "2026-10-29",
    };

    const result = filterScenarios({
      tasks: mockTasks,
      playlists: [mixedPlaylist],
      selectedPlaylistId: "pl-mixed",
      search: "popcorn",
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].id, "task-4");
  });

  it("falls back to all scenarios if selected playlist was deleted from playlists array", () => {
    const pl1: Playlist = {
      id: "pl-active",
      name: "Active Pl",
      items: [{ id: "i1", taskId: "task-1", targetMode: "reps", targetValue: 1 }],
      createdAt: "2026-10-29",
    };

    // User previously selected "deleted-pl-id", which is not in playlists
    const result = filterScenarios({
      tasks: mockTasks,
      playlists: [pl1],
      selectedPlaylistId: "deleted-pl-id",
    });

    // Effective playlist becomes "All"
    assert.equal(result.length, 4);
  });

  it("preserves task metric integrity and calculation capability", () => {
    const pl: Playlist = {
      id: "pl-1",
      name: "Metrics Pl",
      items: [{ id: "i1", taskId: "task-1", targetMode: "reps", targetValue: 1 }],
      createdAt: "2026-10-29",
    };

    const result = filterScenarios({
      tasks: mockTasks,
      playlists: [pl],
      selectedPlaylistId: "pl-1",
    });

    const task = result[0];
    assert.equal(task.sessions.length, 1);
    const pb = Math.max(...task.sessions.map((s) => Number(s.pb) || 0));
    assert.equal(pb, 100);
    assert.equal(task.sessions[0].threshold, 90);
    const metrics = computeTaskMetrics(task);
    assert.equal(metrics.maxPB, 100);
  });
});

describe("Empirical Challenger Suite: Auto-Advance Resolution Full Matrix", () => {
  const modes: (Playlist["autoAdvanceMode"] | undefined)[] = [
    undefined,
    "inherit",
    "enabled",
    "disabled",
  ];
  const globals: (boolean | undefined)[] = [true, false, undefined];

  modes.forEach((mode) => {
    globals.forEach((globalVal) => {
      it(`resolves mode=${mode} with global=${globalVal} according to spec`, () => {
        const pl: Playlist = {
          id: "pl-matrix",
          name: "Matrix Test",
          items: [],
          createdAt: "2026-10-29",
          autoAdvanceMode: mode,
        };

        const res = resolveAutoAdvanceOnThreshold(pl, globalVal);

        if (mode === "enabled") {
          assert.equal(res, true, `Expected true for mode=enabled regardless of global=${globalVal}`);
        } else if (mode === "disabled") {
          assert.equal(res, false, `Expected false for mode=disabled regardless of global=${globalVal}`);
        } else {
          // inherit or undefined
          const expected = globalVal !== false;
          assert.equal(res, expected, `Expected ${expected} for mode=${mode} with global=${globalVal}`);
        }
      });
    });
  });

  it("handles null and undefined playlist object across all global values", () => {
    globals.forEach((globalVal) => {
      const expected = globalVal !== false;
      assert.equal(resolveAutoAdvanceOnThreshold(null, globalVal), expected);
      assert.equal(resolveAutoAdvanceOnThreshold(undefined, globalVal), expected);
    });
  });

  it("handles malformed/unrecognized autoAdvanceMode defensively", () => {
    const weirdPl = {
      id: "pl-weird",
      name: "Weird",
      items: [],
      createdAt: "2026-10-29",
      autoAdvanceMode: "some_unexpected_string" as any,
    };
    assert.equal(resolveAutoAdvanceOnThreshold(weirdPl, true), true);
    assert.equal(resolveAutoAdvanceOnThreshold(weirdPl, false), false);
    assert.equal(resolveAutoAdvanceOnThreshold(weirdPl, undefined), true);
  });
});

describe("Empirical Challenger Suite: Runner Threshold Guard Logic Simulation", () => {
  // Simulates the exact state check in usePlaylistRunner:
  // if (item.targetMode === "threshold") {
  //   const completedReps = currentSessionsCount - sessionCountAtStart;
  //   const minReps = Math.max(1, item.targetValue);
  //   const thresholdMet = stepTargetThreshold === null || (stepBestScore !== null && stepBestScore >= stepTargetThreshold);
  //   if (completedReps >= minReps && thresholdMet) {
  //     if (shouldAutoAdvance) {
  //       next();
  //     }
  //   }
  // }
  function simulateThresholdCheck({
    targetValue,
    completedReps,
    stepTargetThreshold,
    stepBestScore,
    shouldAutoAdvance,
  }: {
    targetValue: number;
    completedReps: number;
    stepTargetThreshold: number | null;
    stepBestScore: number | null;
    shouldAutoAdvance: boolean;
  }): { advanced: boolean; thresholdMet: boolean; repsSatisfied: boolean } {
    const minReps = Math.max(1, targetValue);
    const repsSatisfied = completedReps >= minReps;
    const thresholdMet =
      stepTargetThreshold === null ||
      (stepBestScore !== null && stepBestScore >= stepTargetThreshold);

    const advanced = repsSatisfied && thresholdMet && shouldAutoAdvance;
    return { advanced, thresholdMet, repsSatisfied };
  }

  it("advances when threshold is met, reps satisfied, and shouldAutoAdvance is true", () => {
    const res = simulateThresholdCheck({
      targetValue: 1,
      completedReps: 1,
      stepTargetThreshold: 100,
      stepBestScore: 105,
      shouldAutoAdvance: true,
    });
    assert.equal(res.thresholdMet, true);
    assert.equal(res.repsSatisfied, true);
    assert.equal(res.advanced, true);
  });

  it("STOPS and does NOT advance when threshold is met but shouldAutoAdvance is false", () => {
    const res = simulateThresholdCheck({
      targetValue: 1,
      completedReps: 1,
      stepTargetThreshold: 100,
      stepBestScore: 120,
      shouldAutoAdvance: false, // disabled override or global false
    });
    assert.equal(res.thresholdMet, true);
    assert.equal(res.repsSatisfied, true);
    assert.equal(res.advanced, false); // BLOCKED as required
  });

  it("does not advance if reps are not yet satisfied, even if score beats threshold", () => {
    const res = simulateThresholdCheck({
      targetValue: 3, // requires 3 reps
      completedReps: 1,
      stepTargetThreshold: 100,
      stepBestScore: 110,
      shouldAutoAdvance: true,
    });
    assert.equal(res.thresholdMet, true);
    assert.equal(res.repsSatisfied, false);
    assert.equal(res.advanced, false);
  });

  it("does not advance if score did not reach threshold", () => {
    const res = simulateThresholdCheck({
      targetValue: 1,
      completedReps: 1,
      stepTargetThreshold: 100,
      stepBestScore: 95,
      shouldAutoAdvance: true,
    });
    assert.equal(res.thresholdMet, false);
    assert.equal(res.repsSatisfied, true);
    assert.equal(res.advanced, false);
  });
});
