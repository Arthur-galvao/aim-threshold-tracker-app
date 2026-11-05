import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Task, TrainingSettings } from "../src/lib/types.ts";
import { skillConfigFromTraining, buildAllRuns, BASE_BAND_RATIO } from "../src/lib/skill/config.ts";
import { runTime } from "../src/lib/skill/sessions.ts";

const training: TrainingSettings = {
  warmupRunsPerScenario: 2,
  sessionWarmupMinutes: 7,
  sessionGapMinutes: 30,
  plannedRuns: 4,
  difficulty: "normal",
  maxPauseSeconds: 12,
  focusPrompt: true,
  fatigueAlerts: true,
  weeklyMeasureReminder: true,
  showAdvancedStats: false,
};

describe("skillConfigFromTraining", () => {
  it("mapeia os campos de treino para validity, target e gap", () => {
    const cfg = skillConfigFromTraining(training);
    assert.deepEqual(cfg.validity, {
      warmupRunsPerScenario: 2,
      sessionWarmupMinutes: 7,
      maxPauseSeconds: 12,
      baseBandRatio: 1.05,
    });
    assert.equal(cfg.target.plannedRuns, 4);
    assert.equal(cfg.gapMinutes, 30);
    assert.equal(cfg.target.successProb, 0.6);
    assert.equal(cfg.target.rustK, 1);
    assert.equal(cfg.target.rustFullDays, 14);
  });

  it("successProb segue a dificuldade: fácil 0.75, normal 0.6, difícil 0.45", () => {
    assert.equal(skillConfigFromTraining({ ...training, difficulty: "easy" }).target.successProb, 0.75);
    assert.equal(skillConfigFromTraining({ ...training, difficulty: "normal" }).target.successProb, 0.6);
    assert.equal(skillConfigFromTraining({ ...training, difficulty: "hard" }).target.successProb, 0.45);
  });

  it("baseBandRatio é a constante BASE_BAND_RATIO (1.05)", () => {
    assert.equal(BASE_BAND_RATIO, 1.05);
    assert.equal(skillConfigFromTraining(training).validity.baseBandRatio, BASE_BAND_RATIO);
  });
});

describe("buildAllRuns", () => {
  const tasks: Task[] = [
    {
      id: "a",
      name: "A",
      category: "c",
      subcategory: "s",
      sessions: [
        { id: "a1", date: "2026-03-01", sens: 1, pb: 100, threshold: 0 },
        { id: "a2", date: "2026-03-01", sens: 1, pb: 100, threshold: 0, datetime: "2026-03-01T10:00:00" },
      ],
    },
    {
      id: "b",
      name: "B",
      category: "c",
      subcategory: "s",
      sessions: [{ id: "b1", date: "2026-03-02", sens: 1, pb: 90, threshold: 0 }],
    },
  ];

  it("gera uma run por sessão, com taskId e instante pela posição no array do task", () => {
    const runs = buildAllRuns(tasks);
    assert.equal(runs.length, 3);
    assert.deepEqual(runs.map((r) => [r.taskId, r.session.id]), [
      ["a", "a1"],
      ["a", "a2"],
      ["b", "b1"],
    ]);
    assert.equal(runs[0].t, runTime(tasks[0].sessions[0], 0));
    assert.equal(runs[1].t, runTime(tasks[0].sessions[1], 1));
    assert.equal(runs[2].t, runTime(tasks[1].sessions[0], 0));
  });

  it("lista vazia para zero tasks", () => {
    assert.deepEqual(buildAllRuns([]), []);
  });
});
