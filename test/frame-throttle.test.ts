import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BACKDROP_FPS,
  createFrameThrottle,
  shouldRunBackdropCanvas,
} from "../src/lib/frame-throttle.ts";

/** Simula rAF a `hz` por `durationMs` e conta quantos frames passam pelo acumulador. */
function countDrawn(hz: number, durationMs: number, fps = BACKDROP_FPS): number {
  const throttle = createFrameThrottle(fps);
  const step = 1000 / hz;
  let drawn = 0;
  for (let i = 0; i <= Math.floor(durationMs / step); i++) {
    if (throttle.tick(i * step)) drawn++;
  }
  return drawn;
}

describe("createFrameThrottle", () => {
  it("limita a ~30 fps em monitor de 240 Hz", () => {
    const drawn = countDrawn(240, 1000);
    assert.ok(drawn >= 29 && drawn <= 31, `esperado ~30, veio ${drawn}`);
  });

  it("limita a ~30 fps em monitor de 360 Hz", () => {
    const drawn = countDrawn(360, 1000);
    assert.ok(drawn >= 29 && drawn <= 31, `esperado ~30, veio ${drawn}`);
  });

  it("em 60 Hz desenha 1 de cada 2 frames (30 fps exatos)", () => {
    const drawn = countDrawn(60, 1000);
    assert.ok(drawn >= 29 && drawn <= 31, `esperado ~30, veio ${drawn}`);
  });

  it("não desenha mais rápido que o teto em 30 Hz", () => {
    const drawn = countDrawn(30, 1000);
    assert.ok(drawn >= 29 && drawn <= 31, `esperado ~30, veio ${drawn}`);
  });

  it("primeiro frame sempre passa", () => {
    const throttle = createFrameThrottle(30);
    assert.equal(throttle.tick(1000), true);
  });

  it("frame logo após o anterior é pulado", () => {
    const throttle = createFrameThrottle(30);
    throttle.tick(0);
    assert.equal(throttle.tick(4), false);
    assert.equal(throttle.tick(8), false);
  });

  it("gap longo (aba suspensa) não gera rajada de frames", () => {
    const throttle = createFrameThrottle(30);
    throttle.tick(0);
    assert.equal(throttle.tick(60_000), true);
    assert.equal(throttle.tick(60_004), false);
  });

  it("reset faz o próximo frame passar de novo", () => {
    const throttle = createFrameThrottle(30);
    throttle.tick(0);
    assert.equal(throttle.tick(4), false);
    throttle.reset();
    assert.equal(throttle.tick(5), true);
  });

  it("timestamp que volta no tempo não quebra o acumulador", () => {
    const throttle = createFrameThrottle(30);
    throttle.tick(100);
    assert.equal(throttle.tick(50), false);
  });
});

describe("shouldRunBackdropCanvas", () => {
  it("nível sutil desliga o canvas", () => {
    assert.equal(shouldRunBackdropCanvas("sutil", false), false);
  });

  it("nível moderado liga o canvas", () => {
    assert.equal(shouldRunBackdropCanvas("moderado", false), true);
  });

  it("prefers-reduced-motion desliga o canvas mesmo em moderado", () => {
    assert.equal(shouldRunBackdropCanvas("moderado", true), false);
    assert.equal(shouldRunBackdropCanvas("sutil", true), false);
  });
});
