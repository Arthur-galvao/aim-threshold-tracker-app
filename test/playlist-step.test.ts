import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Playlist, PlaylistItem, Session, Task } from "../src/lib/types.ts";
import {
  countStepAttempts,
  evaluateThresholdStep,
  formatClock,
  isMeasureStep,
  muscleCueFor,
  normalizeIntentCue,
  playlistMeasureDue,
  resolveIntentCue,
  stepMaxAttempts,
  stepMaxMinutes,
  targetAtSensCtx,
  MAX_INTENT_CUE_CHARS,
} from "../src/lib/playlist-step.ts";
import type { SensAdjustModel } from "../src/lib/skill/sens-adjust.ts";

const DAY = 86_400_000;
const NOW = new Date("2026-11-05T12:00:00").getTime();

function item(over: Partial<PlaylistItem> = {}): PlaylistItem {
  return { id: "i1", taskId: "t1", targetMode: "threshold", targetValue: 1, ...over };
}

function playlist(items: PlaylistItem[], over: Partial<Playlist> = {}): Playlist {
  return { id: "p1", name: "P", items, createdAt: "2026-01-01T00:00:00", ...over };
}

function session(id: string, daysAgo: number, runMode?: Session["runMode"]): Session {
  return {
    id,
    date: "2026-01-01",
    sens: 30,
    pb: 1000,
    threshold: 0,
    datetime: new Date(NOW - daysAgo * DAY).toISOString(),
    runMode,
  };
}

function task(id: string, sessions: Session[]): Task {
  return { id, name: id, category: "Flick Tech", subcategory: "Micro", sessions };
}

describe("isMeasureStep (T7.5)", () => {
  it("passo marcado como medição", () => {
    assert.equal(isMeasureStep(item({ stepKind: "measure" }), playlist([item()])), true);
  });

  it("playlist de medição força todos os passos", () => {
    assert.equal(isMeasureStep(item(), playlist([item()], { isMeasurement: true })), true);
  });

  it("passo de treino em playlist comum não é medição; ausência de item = false", () => {
    assert.equal(isMeasureStep(item({ stepKind: "train" }), playlist([item()])), false);
    assert.equal(isMeasureStep(item(), playlist([item()])), false);
    assert.equal(isMeasureStep(null, playlist([item()])), false);
  });
});

describe("playlistMeasureDue (T7.5 lembrete semanal)", () => {
  it("cenário sem nenhuma run de medição = vencido", () => {
    const pl = playlist([item({ taskId: "a" })]);
    assert.equal(playlistMeasureDue(pl, [task("a", [session("s1", 1)])], NOW), true);
  });

  it("medição há 3 dias = em dia", () => {
    const pl = playlist([item({ taskId: "a" })]);
    const tasks = [task("a", [session("s1", 3, "measure")])];
    assert.equal(playlistMeasureDue(pl, tasks, NOW), false);
  });

  it("medição há 8 dias = vencido", () => {
    const pl = playlist([item({ taskId: "a" })]);
    const tasks = [task("a", [session("s1", 8, "measure"), session("s2", 1, "train")])];
    assert.equal(playlistMeasureDue(pl, tasks, NOW), true);
  });

  it("basta um cenário vencido na playlist", () => {
    const pl = playlist([item({ taskId: "a" }), item({ id: "i2", taskId: "b" })]);
    const tasks = [task("a", [session("s1", 1, "measure")]), task("b", [session("s2", 30, "measure")])];
    assert.equal(playlistMeasureDue(pl, tasks, NOW), true);
  });

  it("cenário sem sessões não gera lembrete", () => {
    const pl = playlist([item({ taskId: "a" })]);
    assert.equal(playlistMeasureDue(pl, [task("a", [])], NOW), false);
  });
});

describe("countStepAttempts (T7.6)", () => {
  const runs = [
    { sessionId: "old", score: 900, valid: true },
    { sessionId: "w1", score: 700, valid: false },
    { sessionId: "v1", score: 800, valid: true },
    { sessionId: "v2", score: 850, valid: true },
  ];

  it("ignora runs anteriores ao passo e as inválidas", () => {
    const r = countStepAttempts(runs, new Set(["old", "w1"]));
    assert.equal(r.validAttempts, 2);
    assert.equal(r.bestValid, 850);
  });

  it("sem tentativas válidas: best = null", () => {
    const r = countStepAttempts(runs, new Set(["old", "v1", "v2"]));
    assert.deepEqual(r, { validAttempts: 0, bestValid: null });
  });
});

describe("evaluateThresholdStep (T7.6)", () => {
  const base = {
    validAttempts: 0,
    bestValid: null,
    target: 1000,
    minReps: 1,
    elapsedSeconds: 0,
    maxAttempts: 8,
    maxMinutes: 10,
  };

  it("pending enquanto não bateu e sem teto", () => {
    assert.equal(evaluateThresholdStep({ ...base, validAttempts: 2, bestValid: 900 }), "pending");
  });

  it("hit quando melhor válida >= meta com minReps cumprido", () => {
    assert.equal(evaluateThresholdStep({ ...base, validAttempts: 2, bestValid: 1000 }), "hit");
  });

  it("bater a meta sem minReps ainda é pending", () => {
    assert.equal(evaluateThresholdStep({ ...base, minReps: 3, validAttempts: 2, bestValid: 1200 }), "pending");
  });

  it("sem meta (primeira sessão) basta minReps", () => {
    assert.equal(evaluateThresholdStep({ ...base, target: null, validAttempts: 1 }), "hit");
  });

  it("teto de tentativas sem bater = missed", () => {
    assert.equal(evaluateThresholdStep({ ...base, validAttempts: 8, bestValid: 900 }), "missed");
  });

  it("teto de minutos sem bater = missed", () => {
    assert.equal(evaluateThresholdStep({ ...base, validAttempts: 3, bestValid: 900, elapsedSeconds: 600 }), "missed");
  });

  it("bateu no mesmo tick do teto = hit (vitória tem precedência)", () => {
    assert.equal(evaluateThresholdStep({ ...base, validAttempts: 8, bestValid: 1000 }), "hit");
  });
});

describe("limites padrão do passo", () => {
  it("usa 8 tentativas e 10 minutos quando ausentes", () => {
    assert.equal(stepMaxAttempts(item()), 8);
    assert.equal(stepMaxMinutes(item()), 10);
    assert.equal(stepMaxAttempts(item({ maxAttempts: 3 })), 3);
    assert.equal(stepMaxMinutes(item({ maxMinutes: 4 })), 4);
  });

  it("formatClock produz M:SS", () => {
    assert.equal(formatClock(252), "4:12");
    assert.equal(formatClock(600), "10:00");
    assert.equal(formatClock(-5), "0:00");
  });
});

describe("targetAtSensCtx e muscleCueFor (T5.7e)", () => {
  const model: SensAdjustModel = { b: -2, reliable: true, n: 400, centerFallback: 30 };

  it("sem contexto de randomizer devolve a meta base", () => {
    assert.equal(targetAtSensCtx(1000, model, null), 1000);
  });

  it("modelo não confiável devolve a meta base", () => {
    assert.equal(targetAtSensCtx(1000, { ...model, reliable: false }, { sensCm: 36, centerCm: 30 }), 1000);
  });

  it("sens longe do centro reduz a meta (b negativo)", () => {
    const at = targetAtSensCtx(1000, model, { sensCm: 36, centerCm: 30 });
    assert.ok(at !== null && at < 1000);
    assert.equal(targetAtSensCtx(null, model, { sensCm: 36, centerCm: 30 }), null);
  });

  it("cue muscular: rápida abaixo de 0.92c, lenta acima de 1.08c, base no meio", () => {
    assert.equal(muscleCueFor(27, 30), "fast");
    assert.equal(muscleCueFor(33, 30), "slow");
    assert.equal(muscleCueFor(30, 30), "base");
    assert.equal(muscleCueFor(27.6, 30), "base");
    assert.equal(muscleCueFor(0, 30), "base");
  });
});

describe("cue de intenção (T7.7)", () => {
  it("usa o cue salvo, senão o default", () => {
    assert.equal(resolveIntentCue({ intentCue: "  Relaxar o pulso  " }, "default"), "Relaxar o pulso");
    assert.equal(resolveIntentCue({ intentCue: "   " }, "default"), "default");
    assert.equal(resolveIntentCue({}, "default"), "default");
  });

  it("normaliza para no máximo 80 caracteres", () => {
    assert.equal(MAX_INTENT_CUE_CHARS, 80);
    const long = "a".repeat(120);
    assert.equal(normalizeIntentCue(long).length, 80);
    assert.equal(normalizeIntentCue("  oi  "), "oi");
  });
});
