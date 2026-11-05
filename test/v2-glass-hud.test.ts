import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { simulateDraftRuns } from "../src/lib/threshold.ts";
import { summarizeTrainingSessions } from "../src/lib/day-summary.ts";
import { computeSkill } from "../src/lib/skill/index.ts";
import { buildAllRuns, skillConfigFromTraining } from "../src/lib/skill/config.ts";
import { DEFAULT_TRAINING_SETTINGS } from "../src/lib/types.ts";
import { makeTask } from "./_helpers_skill.ts";

const CFG = skillConfigFromTraining(DEFAULT_TRAINING_SETTINGS);
const NOW = new Date("2026-10-10T12:00:00").getTime();

describe("v2.0 Glass HUD: Target Simulation and Component Integrity", () => {
  it("simulates the v2 target: strong draft runs hit the target and raise it", () => {
    const task = makeTask([
      { date: "2026-10-01", scores: [90, 100, 102, 101, 103, 99] },
      { date: "2026-10-03", scores: [92, 102, 104, 103, 101, 105] },
    ]);
    const out = simulateDraftRuns(
      task,
      buildAllRuns([task]),
      { scores: [100, 125, 126, 124, 127], sens: 40, date: "2026-10-10" },
      CFG,
      NOW
    );
    assert.equal(out.willHit, true);
    assert.equal(out.willBreakPB, true);
    assert.ok(out.projectedTarget! > out.targetBefore!);
  });

  it("simulates the v2 target: a bad draft misses and the target falls (no ratchet floor)", () => {
    const task = makeTask([
      { date: "2026-10-01", scores: [140, 150, 152, 151, 153, 149] },
      { date: "2026-10-03", scores: [142, 152, 154, 153, 151, 155] },
    ]);
    const out = simulateDraftRuns(
      task,
      buildAllRuns([task]),
      { scores: [70, 80, 85, 82, 79], sens: 40, date: "2026-10-10" },
      CFG,
      NOW
    );
    assert.equal(out.willHit, false);
    assert.equal(out.willBreakPB, false);
    assert.ok(out.projectedTarget! < out.targetBefore!);
  });

  it("verifies compound component exports and contracts across component sources", () => {
    const shellSrc = fs.readFileSync(path.resolve("src/components/shell/AppShell.tsx"), "utf-8");
    const topBarSrc = fs.readFileSync(path.resolve("src/components/shell/TopBar.tsx"), "utf-8");
    const dockSrc = fs.readFileSync(path.resolve("src/components/shell/Dock.tsx"), "utf-8");
    const backdropSrc = fs.readFileSync(path.resolve("src/components/shell/Backdrop.tsx"), "utf-8");
    const dashSrc = fs.readFileSync(path.resolve("src/components/views/dashboard/index.tsx"), "utf-8");
    const kpiSrc = fs.readFileSync(path.resolve("src/components/views/dashboard/KPIStrip.tsx"), "utf-8");
    const chartSrc = fs.readFileSync(path.resolve("src/components/views/dashboard/ProgressChart.tsx"), "utf-8");
    const historySrc = fs.readFileSync(path.resolve("src/components/views/dashboard/SessionHistory.tsx"), "utf-8");
    const randSrc = fs.readFileSync(path.resolve("src/components/views/randomizer/index.tsx"), "utf-8");
    const labSrc = fs.readFileSync(path.resolve("src/components/views/lab/index.tsx"), "utf-8");
    const appSrc = fs.readFileSync(path.resolve("src/App.tsx"), "utf-8");

    // Shell hierarchy
    assert.ok(shellSrc.includes("<TopBar"));
    assert.ok(shellSrc.includes("<Dock"));
    assert.ok(shellSrc.includes("<Backdrop"));

    // TopBar and Dock elements
    assert.ok(topBarSrc.includes("TopBar"));
    assert.ok(dockSrc.includes("dashboard"));
    assert.ok(dockSrc.includes("randomizer"));
    assert.ok(dockSrc.includes("playlist"));
    assert.ok(backdropSrc.includes("Backdrop") && backdropSrc.includes("radial-gradient"));

    // Dashboard views & widgets
    assert.ok(dashSrc.includes("<KPIStrip"));
    assert.ok(dashSrc.includes("<ProgressChart"));
    assert.ok(dashSrc.includes("<SessionHistory"));
    assert.ok(kpiSrc.includes("nextTarget"));
    assert.ok(!kpiSrc.includes("ratchet"));
    assert.ok(chartSrc.includes("ChartCanvas"));
    assert.ok(historySrc.includes("DayHistoryCard"));

    // Randomizer view integration
    assert.ok(randSrc.includes("<TelemetryCard"));
    assert.ok(randSrc.includes("<Controls"));
    assert.ok(randSrc.includes("<SweetSpotChart"));
    // CategoryCards moved to the Lab view (src/components/views/lab/index.tsx)
    assert.ok(labSrc.includes("<CategoryCards"));

    // App.tsx integrates AppShell, DashboardView, RandomizerView, PlaylistView
    assert.ok(appSrc.includes("<AppShell"));
    assert.ok(appSrc.includes("<DashboardView"));
    assert.ok(appSrc.includes("<RandomizerView"));
    assert.ok(appSrc.includes("<PlaylistView"));
  });

  it("verifies history groups by training session (gap <= 45 min), not by calendar day", () => {
    const task = makeTask([{ date: "2026-10-01", scores: [100, 120, 110] }]);
    // mesmo dia, mas 5 horas depois: outra sessão de treino
    const evening = makeTask([{ date: "2026-10-01", scores: [80, 90] }]);
    evening.sessions.forEach((s, i) => {
      s.id = `eve_${i}`;
      s.datetime = `2026-10-01T15:${String(i * 3).padStart(2, "0")}:00`;
    });
    task.sessions.push(...evening.sessions);

    const skill = computeSkill(task, buildAllRuns([task]), CFG, NOW);
    const sessions = summarizeTrainingSessions(task, skill);
    assert.equal(sessions.length, 2);
    assert.equal(sessions[0].runs, 3);
    assert.equal(sessions[0].best, 120);
    assert.equal(sessions[1].runs, 2);
    assert.equal(sessions[1].best, 90);
  });

  it("verifies zero emojis across all v2.0 Glass HUD component and context files", () => {
    const emojiRegex = /\p{Extended_Pictographic}/u;

    const filesToCheck = [
      "src/context/TrackerWorkspaceContext.tsx",
      "src/hooks/useWindowActivityGuard.ts",
      "src/components/shell/AppShell.tsx",
      "src/components/shell/TopBar.tsx",
      "src/components/shell/Dock.tsx",
      "src/components/shell/Backdrop.tsx",
      "src/components/views/dashboard/index.tsx",
      "src/components/views/dashboard/KPIStrip.tsx",
      "src/components/views/dashboard/ProgressChart.tsx",
      "src/components/views/dashboard/SessionHistory.tsx",
      "src/components/views/randomizer/index.tsx",
      "src/components/views/randomizer/sweet-spot-chart.tsx",
      "src/components/views/randomizer/analytics.tsx",
      "src/components/views/randomizer/buckets-table.tsx",
      "src/components/views/lab/category-cards.tsx",
      "src/lib/threshold.ts",
      "src/lib/viscose.ts",
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(relPath);
      assert.ok(fs.existsSync(fullPath), `Expected file ${relPath} to exist`);
      const content = fs.readFileSync(fullPath, "utf-8");
      assert.equal(
        emojiRegex.test(content),
        false,
        `File ${relPath} contains visual emojis, which is strictly prohibited`
      );
    }
  });

  it("verifies CSS optical hierarchy, Base UI attributes, and GPU budget guard in index.css", () => {
    const cssContent = fs.readFileSync(path.resolve("src/styles/index.css"), "utf-8");

    // Check optical hierarchy tokens & Liquid Glass master classes
    assert.ok(cssContent.includes(".liquid-surface"));
    assert.ok(cssContent.includes(".liquid-pill"));
    assert.ok(cssContent.includes(".liquid-float"));
    assert.ok(cssContent.includes(".liquid-well"));

    // Check GPU budget guard
    assert.ok(cssContent.includes(".app-backgrounded"));
    assert.ok(cssContent.includes("animation-play-state: paused"));
  });

  it("verifies single master TopBar and AppShell layout hierarchy in App.tsx", () => {
    const appSrc = fs.readFileSync(path.resolve("src/App.tsx"), "utf-8");
    const shellSrc = fs.readFileSync(path.resolve("src/components/shell/AppShell.tsx"), "utf-8");
    const topBarSrc = fs.readFileSync(path.resolve("src/components/shell/TopBar.tsx"), "utf-8");
    const dockSrc = fs.readFileSync(path.resolve("src/components/shell/Dock.tsx"), "utf-8");

    // Must NOT import or render legacy Header or CommandBar
    assert.ok(!appSrc.includes('import { Header }'));
    assert.ok(!appSrc.includes('<Header'));
    assert.ok(!appSrc.includes('<CommandBar'));

    // App.tsx must render AppShell with TopBar and Dock
    assert.ok(appSrc.includes("<AppShell"));
    assert.ok(shellSrc.includes("<TopBar"));
    assert.ok(shellSrc.includes("<Dock"));
    assert.ok(topBarSrc.includes("TopBar"));
    assert.ok(dockSrc.includes("Dock"));
  });

  it("verifies ProgressChart 7D/30D/all time range filter and series controls", () => {
    const chartSrc = fs.readFileSync(path.resolve("src/components/views/dashboard/ProgressChart.tsx"), "utf-8");
    const toolbarSrc = fs.readFileSync(path.resolve("src/components/views/dashboard/ChartToolbar.tsx"), "utf-8");

    // Check for 7D, 30D, all period options
    assert.ok(toolbarSrc.includes('"7D"'));
    assert.ok(toolbarSrc.includes('"30D"'));
    assert.ok(toolbarSrc.includes('"all"'));

    // Check for target, PB and mu series toggles
    assert.ok(toolbarSrc.includes("showTarget"));
    assert.ok(toolbarSrc.includes("showPB"));
    assert.ok(toolbarSrc.includes("showMu"));
    assert.ok(chartSrc.includes("filterByPeriod"));
  });

  it("verifies interactive space nebula backdrop, isolated transparent AppShell, theme tokens, and KPIStrip percentage fix", () => {
    const shellSrc = fs.readFileSync(path.resolve("src/components/shell/AppShell.tsx"), "utf-8");
    const backdropSrc = fs.readFileSync(path.resolve("src/components/shell/Backdrop.tsx"), "utf-8");
    const kpiSrc = fs.readFileSync(path.resolve("src/components/views/dashboard/KPIStrip.tsx"), "utf-8");
    const cssSrc = fs.readFileSync(path.resolve("src/styles/index.css"), "utf-8");

    // AppShell must isolate stacking context and not obscure Backdrop with opaque bg-base
    assert.ok(shellSrc.includes("isolate"));
    assert.ok(shellSrc.includes("bg-transparent"));
    assert.ok(!shellSrc.includes("bg-base text-text-main"));

    // Backdrop must include interactive canvas + mouse cursor tracking
    assert.ok(backdropSrc.includes("<canvas"));
    assert.ok(backdropSrc.includes("--cursor-x"));
    assert.ok(backdropSrc.includes("contentvisibilityautostatechange"));

    // KPIStrip must not multiply consistencyRatio by 100 (target/PB is already a percentage)
    assert.ok(!kpiSrc.includes("consistencyRatio * 100"));
    assert.ok(kpiSrc.includes("consistencyRatio.toFixed(1)"));

    // Theme tokens and oklab gradient interpolation in index.css
    assert.ok(cssSrc.includes('[data-theme="tactical-emerald"]'));
    assert.ok(cssSrc.includes('[data-theme="amethyst-purple"]'));
    assert.ok(cssSrc.includes('[data-theme="obsidian-amber"]'));
    assert.ok(cssSrc.includes("--in-oklab"));
  });

  it("verifies Randomizer SweetSpotChart registers LineController and ScatterController and uses Liquid Glass surfaces", () => {
    const sweetSpotSrc = fs.readFileSync(
      path.resolve("src/components/views/randomizer/sweet-spot-chart.tsx"),
      "utf-8"
    );
    const analyticsSrc = fs.readFileSync(
      path.resolve("src/components/views/randomizer/analytics.tsx"),
      "utf-8"
    );
    const bucketsSrc = fs.readFileSync(
      path.resolve("src/components/views/randomizer/buckets-table.tsx"),
      "utf-8"
    );
    const controlsSrc = fs.readFileSync(
      path.resolve("src/components/views/randomizer/controls.tsx"),
      "utf-8"
    );

    // Chart.js mixed scatter + line datasets require both controllers registered
    assert.ok(sweetSpotSrc.includes("LineController"));
    assert.ok(sweetSpotSrc.includes("ScatterController"));
    assert.ok(sweetSpotSrc.includes("liquid-surface liquid-interactive"));

    // Randomizer subviews use Liquid Glass and interactive spotlight
    assert.ok(analyticsSrc.includes("liquid-surface liquid-interactive"));
    assert.ok(bucketsSrc.includes("liquid-surface liquid-interactive"));
    assert.ok(controlsSrc.includes("liquid-surface liquid-interactive"));
  });
});
