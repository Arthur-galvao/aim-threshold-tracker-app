import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeDayThreshold, getTargetThresholdForTask } from "../src/lib/threshold.ts";
import { summarizeDays } from "../src/lib/day-summary.ts";
import type { Task } from "../src/lib/types.ts";

describe("v2.0 Glass HUD: Ratchet Simulation and Component Integrity", () => {
  it("simulates ratchet outcome correctly: raises ratchet when session candidate beats target", () => {
    const task: Task = {
      id: "task-1",
      name: "VT 1w4ts",
      category: "Click Timing",
      subcategory: "Precision",
      sessions: [
        { id: "s1", date: "2026-10-01", sens: 35, pb: 100, threshold: 92 },
      ],
    };

    const currentTarget = getTargetThresholdForTask(task);
    assert.equal(currentTarget, 92);

    // Draft runs that exceed the target: candidate = round(120 * 0.93) = 112 > 92
    const draftRuns = [115, 120];
    const projected = computeDayThreshold(currentTarget, draftRuns);
    assert.ok(projected > currentTarget);
    assert.equal(projected, 115); // second best is 115, max(112, 115) = 115
    const delta = projected - currentTarget;
    assert.equal(delta, 23);
  });

  it("simulates ratchet outcome correctly: holds plateau when session runs fall below threshold", () => {
    const task: Task = {
      id: "task-1",
      name: "VT 1w4ts",
      category: "Click Timing",
      subcategory: "Precision",
      sessions: [
        { id: "s1", date: "2026-10-01", sens: 35, pb: 150, threshold: 140 },
      ],
    };

    const currentTarget = getTargetThresholdForTask(task);
    assert.equal(currentTarget, 140);

    // Bad day: runs are 80, 85 -> candidate is far below 140
    const draftRuns = [80, 85];
    const projected = computeDayThreshold(currentTarget, draftRuns);
    assert.equal(projected, 140); // Plateau hold: never drops!
    const delta = projected - currentTarget;
    assert.equal(delta, 0);
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
    assert.ok(kpiSrc.includes("targetThreshold"));
    assert.ok(chartSrc.includes("ChartCanvas"));
    assert.ok(historySrc.includes("DayHistoryCard"));

    // Randomizer view integration
    assert.ok(randSrc.includes("<TelemetryCard"));
    assert.ok(randSrc.includes("<Controls"));
    assert.ok(randSrc.includes("<SweetSpotChart"));
    assert.ok(randSrc.includes("<CategoryCards"));

    // App.tsx integrates AppShell, DashboardView, RandomizerView, PlaylistView
    assert.ok(appSrc.includes("<AppShell"));
    assert.ok(appSrc.includes("<DashboardView"));
    assert.ok(appSrc.includes("<RandomizerView"));
    assert.ok(appSrc.includes("<PlaylistView"));
  });

  it("verifies SessionLedger day grouping and average calculation for multiple runs per date", () => {
    const task: Task = {
      id: "task-group",
      name: "VT Pasu",
      category: "Click Timing",
      subcategory: "Dynamic",
      sessions: [
        { id: "s1", date: "2026-10-01", sens: 35, pb: 100, threshold: 92 },
        { id: "s2", date: "2026-10-01", sens: 35, pb: 120, threshold: 92 },
        { id: "s3", date: "2026-10-02", sens: 35, pb: 80, threshold: 92 },
      ],
    };

    const summaries = summarizeDays(task);
    assert.equal(summaries.length, 2);

    // Day 1 has 2 runs, avg = (100 + 120) / 2 = 110, best = 120
    assert.equal(summaries[0].runs, 2);
    assert.equal(summaries[0].avg, 110);
    assert.equal(summaries[0].best, 120);

    // Day 2 has 1 run, avg = 80, best = 80
    assert.equal(summaries[1].runs, 1);
    assert.equal(summaries[1].avg, 80);
    assert.equal(summaries[1].best, 80);
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

    // Check for threshold, PB and MA3 series toggles
    assert.ok(toolbarSrc.includes("showThreshold"));
    assert.ok(toolbarSrc.includes("showPB"));
    assert.ok(toolbarSrc.includes("showMA3"));
    assert.ok(chartSrc.includes("filterByPeriod"));
  });
});

