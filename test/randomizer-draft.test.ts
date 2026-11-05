import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  initDraft,
  syncDraftWithSettings,
  updateDraftField,
  validateDraft,
  isDraftDirty,
  draftToSettings,
  effectiveSpreadPercent,
  type RandomizerDraft,
} from "../src/lib/randomizer-draft.ts";
import type { RandomizerSettings } from "../src/hooks/useSensRandomizer.ts";

const BASE_SETTINGS: RandomizerSettings = {
  enabled: true,
  baseSensCm: 40.0,
  rangeMode: "cm360",
  minCm: 28.0,
  maxCm: 55.0,
  minMult: 0.75,
  maxMult: 1.35,
  avoidRepeats: true,
  rawaccelDir: "C:\\RawAccel",
  spreadPercent: 25.0,
  autoScenarioSens: true,
  mouseDpi: 800,
  mode: "center",
  centerSource: "personal_relative",
  directionOverrides: {},
  reactivationRuns: 2,
  anchorEvery: 5,
  alternatingBlock: 3,
  categoryEnabled: {},
};

const fieldErrors = (draft: RandomizerDraft, field: string) =>
  validateDraft(draft).filter((e) => e.field === field);

describe("randomizer-draft module", () => {
  test("initializes draft from settings without dirty state", () => {
    const draft = initDraft(BASE_SETTINGS);
    assert.equal(draft.baseSens, "40");
    assert.equal(draft.minCm, "28");
    assert.equal(draft.maxCm, "55");
    assert.equal(draft.rangeMode, "cm360");
    assert.equal(draft.mouseDpi, "800");
    assert.equal(draft.mode, "center");
    assert.equal(draft.centerSource, "personal_relative");
    assert.equal(draft.touched.size, 0);

    const errors = validateDraft(draft);
    assert.equal(errors.length, 0);
    assert.equal(isDraftDirty(draft, BASE_SETTINGS), false);
  });

  test("legacy settings without centerSource migrate from autoScenarioSens", () => {
    const legacyOn = initDraft({ ...BASE_SETTINGS, centerSource: undefined as never, autoScenarioSens: true });
    assert.equal(legacyOn.centerSource, "personal_relative");
    const legacyOff = initDraft({ ...BASE_SETTINGS, centerSource: undefined as never, autoScenarioSens: false });
    assert.equal(legacyOff.centerSource, "base");
  });

  test("zero does not silently turn into default and fails validation", () => {
    let draft = initDraft(BASE_SETTINGS);
    draft = updateDraftField(draft, "baseSens", "0");
    const errors = validateDraft(draft);
    assert.ok(errors.some((e) => e.field === "baseSens" && e.messageKey === "randomizer.errorBaseSensRange"));
  });

  test("validates baseSens boundaries (10 to 200)", () => {
    let draftLow = updateDraftField(initDraft(BASE_SETTINGS), "baseSens", "9.9");
    assert.ok(validateDraft(draftLow).some((e) => e.field === "baseSens"));

    let draftHigh = updateDraftField(initDraft(BASE_SETTINGS), "baseSens", "201");
    assert.ok(validateDraft(draftHigh).some((e) => e.field === "baseSens"));

    let draftValid = updateDraftField(initDraft(BASE_SETTINGS), "baseSens", "35.5");
    assert.equal(validateDraft(draftValid).length, 0);
  });

  test("validates mouseDpi range (100 to 32000)", () => {
    let draftLow = updateDraftField(initDraft(BASE_SETTINGS), "mouseDpi", "50");
    assert.ok(validateDraft(draftLow).some((e) => e.field === "mouseDpi"));

    let draftHigh = updateDraftField(initDraft(BASE_SETTINGS), "mouseDpi", "50000");
    assert.ok(validateDraft(draftHigh).some((e) => e.field === "mouseDpi"));

    let draftFloat = updateDraftField(initDraft(BASE_SETTINGS), "mouseDpi", "800.5");
    assert.ok(validateDraft(draftFloat).some((e) => e.field === "mouseDpi"));

    let draftValid = updateDraftField(initDraft(BASE_SETTINGS), "mouseDpi", "1600");
    assert.equal(validateDraft(draftValid).length, 0);
  });

  test("validates cm360 mode: minCm floor >= 5 and min < max", () => {
    let draftFloor = updateDraftField(initDraft(BASE_SETTINGS), "minCm", "4.9");
    assert.ok(validateDraft(draftFloor).some((e) => e.field === "minCm" && e.messageKey === "randomizer.errorMinCmFloor"));

    let draftOrder = updateDraftField(initDraft(BASE_SETTINGS), "minCm", "60");
    // maxCm is 55, minCm is 60 -> min >= max
    assert.ok(validateDraft(draftOrder).some((e) => e.field === "minCm" && e.messageKey === "randomizer.errorMinMaxOrder"));
  });

  test("validates multiplier mode: minMult > 0 and min < max", () => {
    let draft = initDraft(BASE_SETTINGS);
    draft = updateDraftField(draft, "rangeMode", "multiplier");
    draft = updateDraftField(draft, "minMult", "0");
    assert.ok(validateDraft(draft).some((e) => e.field === "minMult" && e.messageKey === "randomizer.errorMinMultPositive"));

    draft = updateDraftField(draft, "minMult", "1.5");
    draft = updateDraftField(draft, "maxMult", "1.2");
    assert.ok(validateDraft(draft).some((e) => e.field === "minMult" && e.messageKey === "randomizer.errorMinMaxOrder"));
  });

  test("spread: 5 to 40 in normal modes", () => {
    let draft = initDraft(BASE_SETTINGS);
    draft = updateDraftField(draft, "spreadPercent", 4);
    assert.equal(fieldErrors(draft, "spreadPercent").length, 1);
    draft = updateDraftField(draft, "spreadPercent", 5);
    assert.equal(fieldErrors(draft, "spreadPercent").length, 0);
    draft = updateDraftField(draft, "spreadPercent", 40);
    assert.equal(fieldErrors(draft, "spreadPercent").length, 0);
    draft = updateDraftField(draft, "spreadPercent", 41);
    assert.equal(fieldErrors(draft, "spreadPercent").length, 1);
  });

  test("spread: explore accepts up to 60, but not above; below 5 still invalid", () => {
    let draft = initDraft(BASE_SETTINGS);
    draft = updateDraftField(draft, "mode", "explore");
    draft = updateDraftField(draft, "spreadPercent", 60);
    assert.equal(fieldErrors(draft, "spreadPercent").length, 0);
    draft = updateDraftField(draft, "spreadPercent", 61);
    assert.equal(fieldErrors(draft, "spreadPercent").length, 1);
    draft = updateDraftField(draft, "spreadPercent", 4);
    assert.equal(fieldErrors(draft, "spreadPercent").length, 1);
    // 25 is valid in explore: effective spread is forced to 40 at sorteio.
    draft = updateDraftField(draft, "spreadPercent", 25);
    assert.equal(fieldErrors(draft, "spreadPercent").length, 0);
  });

  test("effectiveSpreadPercent: explore floors at 40, other modes unchanged", () => {
    assert.equal(effectiveSpreadPercent("explore", 25), 40);
    assert.equal(effectiveSpreadPercent("explore", 55), 55);
    assert.equal(effectiveSpreadPercent("center", 25), 25);
    assert.equal(effectiveSpreadPercent("directed", 12), 12);
  });

  test("anchorEvery accepts integers 0 to 20 only", () => {
    const check = (value: string) =>
      fieldErrors(updateDraftField(initDraft(BASE_SETTINGS), "anchorEvery", value), "anchorEvery").length;
    assert.equal(check("0"), 0);
    assert.equal(check("20"), 0);
    assert.equal(check("21"), 1);
    assert.equal(check("-1"), 1);
    assert.equal(check("2.5"), 1);
    assert.equal(check(""), 1);
  });

  test("reactivationRuns accepts integers 0 to 5 only", () => {
    const check = (value: string) =>
      fieldErrors(updateDraftField(initDraft(BASE_SETTINGS), "reactivationRuns", value), "reactivationRuns").length;
    assert.equal(check("0"), 0);
    assert.equal(check("5"), 0);
    assert.equal(check("6"), 1);
    assert.equal(check("-1"), 1);
    assert.equal(check("abc"), 1);
  });

  test("alternatingBlock 1 to 10 is validated only in alternating mode", () => {
    const withBlock = (mode: RandomizerDraft["mode"], block: string) => {
      let d = updateDraftField(initDraft(BASE_SETTINGS), "mode", mode);
      d = updateDraftField(d, "alternatingBlock", block);
      return fieldErrors(d, "alternatingBlock").length;
    };
    assert.equal(withBlock("alternating", "0"), 1);
    assert.equal(withBlock("alternating", "1"), 0);
    assert.equal(withBlock("alternating", "10"), 0);
    assert.equal(withBlock("alternating", "11"), 1);
    // Campo oculto nos outros modos: não bloqueia salvar.
    assert.equal(withBlock("center", "0"), 0);
  });

  test("syncDraftWithSettings preserves touched fields and updates untouched fields", () => {
    let draft = initDraft(BASE_SETTINGS);
    // User is editing minCm
    draft = updateDraftField(draft, "minCm", "32.5");

    const externalUpdate: RandomizerSettings = {
      ...BASE_SETTINGS,
      baseSensCm: 45.0,
      minCm: 25.0,
      maxCm: 60.0,
      anchorEvery: 8,
    };

    const synced = syncDraftWithSettings(draft, externalUpdate);
    // minCm was touched -> preserved user's 32.5
    assert.equal(synced.minCm, "32.5");
    // baseSens was NOT touched -> updated to 45
    assert.equal(synced.baseSens, "45");
    // maxCm was NOT touched -> updated to 60
    assert.equal(synced.maxCm, "60");
    assert.equal(synced.anchorEvery, "8");
  });

  test("draftToSettings produces clean RandomizerSettings", () => {
    let draft = initDraft(BASE_SETTINGS);
    draft = updateDraftField(draft, "baseSens", "38.2");
    draft = updateDraftField(draft, "minCm", "25.0");
    draft = updateDraftField(draft, "maxCm", "50.0");
    draft = updateDraftField(draft, "mouseDpi", "1600");

    const result = draftToSettings(draft, BASE_SETTINGS);
    assert.equal(result.baseSensCm, 38.2);
    assert.equal(result.minCm, 25.0);
    assert.equal(result.maxCm, 50.0);
    assert.equal(result.mouseDpi, 1600);
  });

  test("draftToSettings maps the v2 fields", () => {
    let draft = initDraft(BASE_SETTINGS);
    draft = updateDraftField(draft, "mode", "alternating");
    draft = updateDraftField(draft, "centerSource", "base");
    draft = updateDraftField(draft, "reactivationRuns", "3");
    draft = updateDraftField(draft, "anchorEvery", "7");
    draft = updateDraftField(draft, "alternatingBlock", "4");
    draft = updateDraftField(draft, "categoryEnabled", { "Flick Tech": false });
    draft = updateDraftField(draft, "directionOverrides", { "Flick Tech/Speed": "fast" });

    const result = draftToSettings(draft, BASE_SETTINGS);
    assert.equal(result.mode, "alternating");
    assert.equal(result.centerSource, "base");
    assert.equal(result.reactivationRuns, 3);
    assert.equal(result.anchorEvery, 7);
    assert.equal(result.alternatingBlock, 4);
    assert.deepEqual(result.categoryEnabled, { "Flick Tech": false });
    assert.deepEqual(result.directionOverrides, { "Flick Tech/Speed": "fast" });
    assert.equal(result.autoScenarioSens, false);
  });

  test("dirty detection covers v2 fields, and missing category = enabled", () => {
    const draft = initDraft(BASE_SETTINGS);
    assert.equal(isDraftDirty(draft, BASE_SETTINGS), false);

    // Explicit true equals the implicit default: not dirty.
    const explicitTrue = initDraft({ ...BASE_SETTINGS, categoryEnabled: { "Flick Tech": true } });
    assert.equal(isDraftDirty(explicitTrue, BASE_SETTINGS), false);

    const disabledSettings = { ...BASE_SETTINGS, categoryEnabled: { "Flick Tech": false } };
    const disabled = initDraft(disabledSettings);
    assert.equal(isDraftDirty(disabled, disabledSettings), false);
    assert.equal(isDraftDirty(disabled, BASE_SETTINGS), true);

    const withOverride = initDraft({ ...BASE_SETTINGS, directionOverrides: { "Flick Tech/Speed": "fast" } });
    assert.equal(isDraftDirty(withOverride, BASE_SETTINGS), true);

    const modeChanged = initDraft({ ...BASE_SETTINGS, mode: "explore" });
    assert.equal(isDraftDirty(modeChanged, BASE_SETTINGS), true);
  });
});
