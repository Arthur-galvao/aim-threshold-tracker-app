# Specific Sensitivity Tracking & Kovaak's CSV Rewriter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the exact randomized sensitivity directly into KovaaK's CSV files on disk, ensure the randomizer is active from application launch without race conditions, and transition the sweet spot analytics from sensitivity ranges to specific sensitivity values.

**Architecture:** 
1. In the Rust backend (`src-tauri/src/watcher.rs`), add file rewriting capability so that when a new run finishes under an active randomizer, the CSV's `Sens Scale`, `Horiz Sens`, and `Vert Sens` fields are permanently updated on disk to `cm/360` with the randomized sensitivity before parsing and event emission.
2. In the Tauri startup lifecycle (`src-tauri/src/lib.rs`), if the randomizer is enabled, immediately apply a randomized sensitivity to RawAccel and application state before starting the watcher, preventing any run from using the default 50 cm base sensitivity.
3. In the frontend analytics (`src/lib/sens-analytics.ts`, `src/lib/i18n.tsx`, and `src/components/randomizer/SensRandomizerAnalytics.tsx`), remove the legacy `bucketSize` parameter, group runs by discrete sensitivity (rounded to 1 decimal place), and adjust all UI copy and translations to reference specific sensitivities instead of ranges, bands, or midpoints.
4. Clean up the unrandomized historical run (`sess_1790209128413_rd1qc`) from `app_data.json` with JSON integrity validation.

**Tech Stack:** Rust (Tauri 2), React 19, TypeScript, Node Test Runner, Cargo.

**Spec:** In-session agreed bounded design approved by user on 2026-09-23.

## Global Constraints

- Absolute prohibition of emojis in all code, comments, UI text, logs, and documentation.
- Maintain humanized, fluid, and professional copy throughout.
- Keep sensitivities formatted with one decimal place when non-integer (e.g. 67.5 cm, 108.4 cm) and no decimal places when integer (e.g. 50 cm, 68 cm).
- All destructive operations require confirmation.
- Code must pass both `npm test` and `cargo test`.

---

### Task 1: Specific Sensitivity Analytics (TDD)

**Files:**
- Modify: `src/lib/sens-analytics.ts`
- Test: `test/sens-analytics.test.ts`

**Interfaces:**
- Consumes: `RunDataPoint`, `formatSensitivity`
- Produces: `BucketStat` with `sens: number` and `label: string`, `computeSweetSpotAnalytics(runs: RunDataPoint[])` (with `bucketSize` removed) grouping by specific sensitivity rounded to 1 decimal place.

**Current State Note:** Steps 1 and 3 were drafted in the workspace during initial exploration. The next step is to clean up the `bucketSize` parameter and confirm tests pass GREEN.

- [x] **Step 1: Write the tests for specific sensitivity grouping**

```typescript
// test/sens-analytics.test.ts
describe("computeSweetSpotAnalytics", () => {
  it("groups by specific sensitivities instead of ranges", () => {
    const runs = [
      { sens: 67.5, score: 95 },
      { sens: 67.5, score: 97 },
      { sens: 67.5, score: 96 },
      { sens: 50.0, score: 90 },
      { sens: 108.4, score: 85 },
    ];

    const analysis = computeSweetSpotAnalytics(runs);
    assert.ok(analysis !== null);
    assert.equal(analysis.totalRuns, 5);

    assert.ok(analysis.bestBucket !== null);
    assert.equal(analysis.bestBucket.sens, 67.5);
    assert.equal(analysis.bestBucket.rangeLabel, "67.5 cm");
    assert.equal(analysis.bestBucket.count, 3);

    for (const bucket of analysis.buckets) {
      assert.ok(!bucket.rangeLabel.includes("-"));
      assert.equal(typeof bucket.sens, "number");
    }

    const sens50 = analysis.buckets.find((b) => b.sens === 50.0);
    assert.ok(sens50 !== undefined);
    assert.equal(sens50.rangeLabel, "50 cm");
    assert.equal(sens50.count, 1);
  });
});
```

- [ ] **Step 2: Remove obsolete `bucketSize` parameter and clean up signature**

In `src/lib/sens-analytics.ts`:
- Change signature from `computeSweetSpotAnalytics(runs: RunDataPoint[], bucketSize: number = 5)` to `computeSweetSpotAnalytics(runs: RunDataPoint[])`.
- Ensure all internal logic maps runs to `Number(sess.sens.toFixed(1))` without referencing `bucketSize`.
- Ensure `BucketStat` includes `sens: number`, `label: string`, `rangeLabel: string`, `min: number`, and `max: number`.

- [ ] **Step 3: Run test suite to verify GREEN state**

Run: `node --test test/sens-analytics.test.ts`
Expected: All 11 tests PASS cleanly.

---

### Task 2: UI and i18n Updates for Specific Sensitivity (No Ranges/Bands)

**Files:**
- Modify: `src/lib/i18n.tsx`
- Modify: `src/components/randomizer/SensRandomizerAnalytics.tsx`

**Interfaces:**
- Consumes: `BucketStat` with `sens: number` and `label: string`, updated `computeSweetSpotAnalytics(runs)`
- Produces: UI hero card and breakdown table displaying specific sensitivities, applying sensitivity without midpoint wording, and updated translation keys in Portuguese and English.

- [ ] **Step 1: Update all range/band terminology in `src/lib/i18n.tsx`**

Update both `pt` and `en` dictionaries for all relevant keys:

**Portuguese (`pt`):**
- `randomizer.sweetSpotSubtitle`: "Desempenho motor cruzado por sensibilidade"
- `randomizer.sweetSpotBest`: "Melhor Sensibilidade de Desempenho"
- `randomizer.sweetSpotInsight`: "Sensibilidade de pico recomendada com base nas suas runs registradas:"
- `randomizer.sampleSizeExplanation`: "Para garantir relevância estatística e evitar distorções por sorteios isolados, sensibilidades com menos de {n} runs são desconsideradas da melhor sensibilidade, priorizando consistência motora comprovada."
- `randomizer.basedOnRuns`: "Baseado em {n} run(s) nesta sensibilidade"
- `randomizer.peakInBand`: "Pico nesta sensibilidade: {score} {unit}"
- `randomizer.applySensBtn`: "Aplicar Sensibilidade"
- `randomizer.optimalRange`: "Sensibilidade Ótima"
- `randomizer.sampleSize`: "Amostras nesta Sensibilidade"
- `randomizer.bucketsTableTitle`: "Detalhamento por Sensibilidade"
- `randomizer.bucketsTableSubtitle`: "Comparativo estatístico bayesiano e consistência por sensibilidade específica"
- `randomizer.colRange`: "SENSIBILIDADE"
- `randomizer.useMidpoint`: "Aplicar"

**English (`en`):**
- `randomizer.sweetSpotSubtitle`: "Cross-referenced motor performance by sensitivity"
- `randomizer.sweetSpotBest`: "Best Performance Sensitivity"
- `randomizer.sweetSpotInsight`: "Recommended peak performance sensitivity based on your recorded runs:"
- `randomizer.sampleSizeExplanation`: "To ensure statistical significance and avoid single-run flukes, sensitivities with fewer than {n} runs are excluded from optimal selection, prioritizing proven motor consistency."
- `randomizer.basedOnRuns`: "Based on {n} run(s) at this sensitivity"
- `randomizer.peakInBand`: "Peak at this sensitivity: {score} {unit}"
- `randomizer.applySensBtn`: "Apply Sensitivity"
- `randomizer.optimalRange`: "Optimal Sensitivity"
- `randomizer.sampleSize`: "Samples at this Sensitivity"
- `randomizer.bucketsTableTitle`: "Sensitivity Breakdown"
- `randomizer.bucketsTableSubtitle`: "Bayesian statistical comparison and consistency per specific sensitivity"
- `randomizer.colRange`: "SENSITIVITY"
- `randomizer.useMidpoint`: "Apply"

- [ ] **Step 2: Update `src/components/randomizer/SensRandomizerAnalytics.tsx`**

- Update call to `computeSweetSpotAnalytics(runs)` (remove second argument if passed).
- In the hero card:
  - Replace `onApplySens((bestBucket.min + bestBucket.max) / 2)` with `onApplySens(bestBucket.sens)`.
  - Replace `{bestBucket.rangeLabel}` with `{bestBucket.label}`.
  - Remove the midpoint helper text line (`{t("randomizer.midpoint")}: ...`).
- In the breakdown table:
  - Replace `onApplySens((b.min + b.max) / 2)` with `onApplySens(b.sens)`.
  - Use `{b.label}` for the sensitivity cell.
  - Use `t("randomizer.useMidpoint")` (now translated as "Aplicar" / "Apply") on the action button.

- [ ] **Step 3: Verify TypeScript and frontend build**

Run: `npm run build`
Expected: `tsc -b && vite build` succeeds with zero errors.

---

### Task 3: Kovaak's Stats CSV Sensitivity Rewriter in Rust (TDD)

**Files:**
- Modify: `src-tauri/src/watcher.rs`

**Interfaces:**
- Produces: `pub fn update_kovaak_csv_sensitivity(path: &Path, sens_cm: f64) -> Result<(), String>`
- Modifies: `process_new_csv` to invoke `update_kovaak_csv_sensitivity` before parsing stats.

- [x] **Step 1: Write failing Rust unit test in `src-tauri/src/watcher.rs` using CRLF**

Add unit test using CRLF line endings (`\r\n`), matching real KovaaK's Windows files:

```rust
#[test]
fn test_update_kovaak_csv_sensitivity() {
    let tmp_path = std::env::temp_dir().join("test_update_sens.csv");
    let initial_content = "Score:,940.0\r\nScenario:,WALLHACK - VBRClick Easy\r\nSens Scale:,cm/360\r\nHoriz Sens:,50.0\r\nVert Sens:,50.0\r\nDPI:,800\r\nFOV:,103.0\r\n";
    std::fs::write(&tmp_path, initial_content).unwrap();

    let result = update_kovaak_csv_sensitivity(&tmp_path, 108.35);
    assert!(result.is_ok());

    let updated_content = std::fs::read_to_string(&tmp_path).unwrap();
    assert!(updated_content.contains("Horiz Sens:,108.35"));
    assert!(updated_content.contains("Vert Sens:,108.35"));
    assert!(updated_content.contains("Sens Scale:,cm/360"));

    let _ = std::fs::remove_file(tmp_path);
}
```

- [x] **Step 2: Run cargo test to verify it fails**

Run: `cargo test test_update_kovaak_csv_sensitivity --manifest-path src-tauri/Cargo.toml`
Expected: FAIL with "cannot find function `update_kovaak_csv_sensitivity` in this scope".

- [x] **Step 3: Implement `update_kovaak_csv_sensitivity` in `src-tauri/src/watcher.rs`**

```rust
pub fn update_kovaak_csv_sensitivity(path: &Path, sens_cm: f64) -> Result<(), String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Falha ao ler arquivo CSV para atualização: {e}"))?;

    let sens_str = format!("{:.2}", sens_cm);
    let mut new_lines = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        let lower = trimmed.to_lowercase();

        if lower.starts_with("horiz sens:") || lower.starts_with("horizsens:") {
            new_lines.push(format!("Horiz Sens:,{sens_str}"));
        } else if lower.starts_with("vert sens:") || lower.starts_with("vertsens:") {
            new_lines.push(format!("Vert Sens:,{sens_str}"));
        } else if lower.starts_with("sens scale:") || lower.starts_with("sensscale:") {
            new_lines.push("Sens Scale:,cm/360".to_string());
        } else {
            new_lines.push(line.to_string());
        }
    }

    let updated = new_lines.join("\r\n");
    fs::write(path, updated)
        .map_err(|e| format!("Falha ao gravar arquivo CSV atualizado: {e}"))?;

    Ok(())
}
```

- [x] **Step 4: Integrate rewriting directly into `process_new_csv` before parsing**

In `src-tauri/src/watcher.rs`, position the rewrite check before `parser::parse_stats_file` or immediately after receiving the file, ensuring the file on disk is modified before stats are imported and emitted:

```rust
let (is_randomizer_enabled, active_sens) = {
    let s = state.settings.lock().unwrap();
    let r = state.randomizer_state.lock().unwrap();
    (s.randomizer.enabled, r.active_sens_cm)
};

if is_randomizer_enabled && active_sens > 0.0 {
    if let Err(e) = update_kovaak_csv_sensitivity(path, active_sens) {
        eprintln!("[Watcher] Erro ao atualizar sensibilidade no CSV: {e}");
    }
}
```

- [x] **Step 5: Run cargo test to verify it passes**

Run: `cargo test test_update_kovaak_csv_sensitivity --manifest-path src-tauri/Cargo.toml`
Expected: PASS.

---

### Task 4: Startup Randomization Safeguard & Historical Data Cleanup

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `C:\Users\Arthur\AppData\Roaming\com.aimthreshold.app\app_data.json`

**Interfaces:**
- Modifies: `src-tauri/src/lib.rs` setup hook to execute initial sensitivity roll synchronously before starting the watcher loop, eliminating startup race conditions.
- Modifies: `app_data.json` to purge unrandomized run `sess_1790209128413_rd1qc`.

- [x] **Step 1: Execute startup randomization before launching watcher in `src-tauri/src/lib.rs`**

In `lib.rs` `setup` hook:
Ensure that if `settings.randomizer.enabled && avail`, `randomizer::apply_next_sens(&app.handle(), None, None)` is called so that `active_sens_cm` is randomized and applied to RawAccel before any KovaaK's run can complete:

```rust
if settings.randomizer.enabled && avail {
    let handle = app.handle().clone();
    let _ = randomizer::apply_next_sens(&handle, None, None);
}
```

- [x] **Step 2: Clean up the unrandomized 50 cm run in `app_data.json` with integrity check**

1. Create a backup of `app_data.json`.
2. Remove session `sess_1790209128413_rd1qc` from `WALLHACK - VBRClick Easy` task.
3. Validate JSON structure by parsing it. Verify remaining sessions for `WALLHACK - VBRClick Easy` have valid randomized sensitivities (`108.35`, `44.53`, `83.42`).

- [x] **Step 3: Verification of entire project**

- Run `npm test` to verify TypeScript test suite.
- Run `cargo test --manifest-path src-tauri/Cargo.toml` to verify Rust test suite.
- Run `npm run build` to verify frontend build cleanly compiles without errors or warnings.
