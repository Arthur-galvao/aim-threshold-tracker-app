import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GAMES,
  cmToGame,
  findGame,
  formatGameSens,
  gameToCm,
} from "../src/lib/lab/games.ts";

describe("lab games", () => {
  it("Valorant 0.35 @800 DPI converte para ~46.65 cm/360", () => {
    const g = findGame("valorant");
    assert.ok(g);
    const cm = gameToCm(0.35, 800, g);
    assert.ok(Math.abs(cm - 46.65) <= 0.05, `cm = ${cm}`);
  });

  it("ida e volta preserva o valor para todos os jogos", () => {
    for (const g of GAMES) {
      for (const sens of [0.1, 0.35, 1, 2.5]) {
        const cm = gameToCm(sens, 800, g);
        const back = cmToGame(cm, 800, g);
        assert.ok(Math.abs(back - sens) < 1e-9, `${g.id}: ${back} != ${sens}`);
      }
    }
  });

  it("findGame retorna undefined para id desconhecido", () => {
    assert.equal(findGame("nope"), undefined);
    assert.equal(findGame("cs2")?.name, "Counter-Strike 2");
  });

  it("formatGameSens usa as casas decimais do jogo", () => {
    assert.equal(formatGameSens(0.35, findGame("valorant")!), "0.350");
    assert.equal(formatGameSens(1.2345, findGame("cs2")!), "1.23");
    assert.equal(formatGameSens(33.7, findGame("r6")!), "34");
    assert.equal(formatGameSens(12.34, findGame("fortnite")!), "12.3");
  });

  it("r6 tem nota como chave i18n", () => {
    assert.equal(findGame("r6")?.note, "lab.games.r6Note");
  });
});
