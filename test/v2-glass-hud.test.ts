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

  it("verifies compound component exports and Base UI contracts across component sources", () => {
    const shellSrc = fs.readFileSync(path.resolve("src/components/layout/WorkspaceShell.tsx"), "utf-8");
    const cmdBarSrc = fs.readFileSync(path.resolve("src/components/layout/CommandBar.tsx"), "utf-8");
    const bentoSrc = fs.readFileSync(path.resolve("src/components/bento/TelemetryBento.tsx"), "utf-8");
    const stageSrc = fs.readFileSync(path.resolve("src/components/analytics/RatchetAnalyticsStage.tsx"), "utf-8");
    const compSrc = fs.readFileSync(path.resolve("src/components/composer/SessionQuickComposer.tsx"), "utf-8");
    const ledgerSrc = fs.readFileSync(path.resolve("src/components/ledger/SessionLedger.tsx"), "utf-8");
    const appSrc = fs.readFileSync(path.resolve("src/App.tsx"), "utf-8");

    // WorkspaceShell attachments
    assert.ok(shellSrc.includes("WorkspaceShell.CommandBar = CommandBar"));
    assert.ok(shellSrc.includes("WorkspaceShell.TelemetryBento = TelemetryBento"));
    assert.ok(shellSrc.includes("WorkspaceShell.RatchetAnalyticsStage = RatchetAnalyticsStage"));
    assert.ok(shellSrc.includes("WorkspaceShell.SessionQuickComposer = SessionQuickComposer"));
    assert.ok(shellSrc.includes("WorkspaceShell.SessionLedger = SessionLedger"));

    // CommandBar compound subcomponents & Base UI
    assert.ok(cmdBarSrc.includes("CommandBar.Brand = CommandBarBrand"));
    assert.ok(cmdBarSrc.includes("CommandBar.CategoryTabs = CommandBarCategoryTabs"));
    assert.ok(cmdBarSrc.includes("CommandBar.ScenarioPicker = CommandBarScenarioPicker"));
    assert.ok(cmdBarSrc.includes("CommandBar.WatcherBadge = CommandBarWatcherBadge"));
    assert.ok(cmdBarSrc.includes("CommandBar.SystemMenu = CommandBarSystemMenu"));
    assert.ok(cmdBarSrc.includes("Switch.Root"));
    assert.ok(cmdBarSrc.includes("Menu.Root"));
    assert.ok(cmdBarSrc.includes("Tabs.Root"));

    // TelemetryBento compound subcomponents
    assert.ok(bentoSrc.includes("TelemetryBento.TargetCard = TelemetryBentoTargetCard"));
    assert.ok(bentoSrc.includes("TelemetryBento.PersonalBestCard = TelemetryBentoPersonalBestCard"));
    assert.ok(bentoSrc.includes("TelemetryBento.ConsistencyCard = TelemetryBentoConsistencyCard"));
    assert.ok(bentoSrc.includes("TelemetryBento.HardwareSetupCard = TelemetryBentoHardwareSetupCard"));
    assert.ok(bentoSrc.includes("BaseProgress.Root"));
    assert.ok(bentoSrc.includes("deltaPct"));

    // RatchetAnalyticsStage compound subcomponents & Base UI & 1st session fix
    assert.ok(stageSrc.includes("RatchetAnalyticsStage.Toolbar = RatchetAnalyticsStageToolbar"));
    assert.ok(stageSrc.includes("RatchetAnalyticsStage.Canvas = RatchetAnalyticsStageCanvas"));
    assert.ok(stageSrc.includes("RatchetAnalyticsStage.EmptyState = RatchetAnalyticsStageEmptyState"));
    assert.ok(stageSrc.includes("ToggleGroup"));
    assert.ok(stageSrc.includes("isSingleSession ? 6 : 0"));

    // SessionQuickComposer compound subcomponents & Base UI NumberField
    assert.ok(compSrc.includes("SessionQuickComposer.RunInput = SessionQuickComposerRunInput"));
    assert.ok(compSrc.includes("SessionQuickComposer.TelemetryFields = SessionQuickComposerTelemetryFields"));
    assert.ok(compSrc.includes("SessionQuickComposer.LiveRatchetPreview = SessionQuickComposerLiveRatchetPreview"));
    assert.ok(compSrc.includes("NumberField.Root"));

    // SessionLedger compound subcomponents & Base UI Popover
    assert.ok(ledgerSrc.includes("SessionLedger.FilterHeader = SessionLedgerFilterHeader"));
    assert.ok(ledgerSrc.includes("SessionLedger.Row = SessionLedgerRow"));
    assert.ok(ledgerSrc.includes("SessionLedger.ExpandedRuns = SessionLedgerExpandedRuns"));
    assert.ok(ledgerSrc.includes("summarizeDays"));
    assert.ok(ledgerSrc.includes("Popover.Root"));

    // App.tsx uses WorkspaceShell and ScenarioDialog
    assert.ok(appSrc.includes("<WorkspaceShell"));
    assert.ok(appSrc.includes("<ScenarioDialog"));
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
      "src/components/layout/CommandBar.tsx",
      "src/components/bento/TelemetryBento.tsx",
      "src/components/analytics/RatchetAnalyticsStage.tsx",
      "src/components/composer/SessionQuickComposer.tsx",
      "src/components/ledger/SessionLedger.tsx",
      "src/components/dialogs/ScenarioDialog.tsx",
      "src/components/telemetry/TelemetryToast.tsx",
      "src/components/layout/WorkspaceShell.tsx",
      "src/utils/threshold.ts",
      "src/utils/viscose.ts",
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

    // Check optical hierarchy tokens
    assert.ok(cssContent.includes("--surface-canvas"));
    assert.ok(cssContent.includes("--surface-glass-1"));
    assert.ok(cssContent.includes("--surface-glass-2"));
    assert.ok(cssContent.includes("--surface-glass-floating"));
    assert.ok(cssContent.includes("--border-glass"));
    assert.ok(cssContent.includes("--specular-top"));

    // Check telemetry tokens
    assert.ok(cssContent.includes("--telemetry-pb"));
    assert.ok(cssContent.includes("--telemetry-ratchet-up"));
    assert.ok(cssContent.includes("--telemetry-ratchet-hold"));
    assert.ok(cssContent.includes("--telemetry-ma3"));
    assert.ok(cssContent.includes("--telemetry-watcher"));

    // Check utility classes
    assert.ok(cssContent.includes(".glass-panel"));
    assert.ok(cssContent.includes(".glass-panel-floating"));
    assert.ok(cssContent.includes(".glass-card-interactive"));
    assert.ok(cssContent.includes(".glass-input"));
    assert.ok(cssContent.includes(".tabular-nums"));

    // Check Base UI state attributes
    assert.ok(cssContent.includes(".glass-input[data-focused]"));
    assert.ok(cssContent.includes(".glass-input[data-invalid]"));
    assert.ok(cssContent.includes(".glass-input[data-disabled]"));

    // Check GPU budget guard
    assert.ok(cssContent.includes(".app-backgrounded"));
    assert.ok(cssContent.includes("animation-play-state: paused"));

    // Check v2.1 Apple Liquid Glass Master Classes
    assert.ok(cssContent.includes(".liquid-glass-panel"));
    assert.ok(cssContent.includes(".liquid-glass-control"));
    assert.ok(cssContent.includes(".liquid-glass-floating"));
    assert.ok(cssContent.includes(".liquid-glass-pill"));
  });

  it("verifies v2.1 Single Master Top Navbar (CommandBar) and layout hierarchy in App.tsx", () => {
    const appSrc = fs.readFileSync(path.resolve("src/App.tsx"), "utf-8");
    const cmdBarSrc = fs.readFileSync(path.resolve("src/components/layout/CommandBar.tsx"), "utf-8");
    const backdropSrc = fs.readFileSync(path.resolve("src/components/layout/LiquidAeroBackdrop.tsx"), "utf-8");

    // Must NOT import or render legacy Header
    assert.ok(!appSrc.includes('import { Header }'));
    assert.ok(!appSrc.includes('<Header'));

    // Must render LiquidAeroBackdrop
    assert.ok(appSrc.includes("<LiquidAeroBackdrop"));
    assert.ok(backdropSrc.includes("LiquidAeroBackdrop"));

    // CommandBar must have 64px height and liquid-glass-pill
    assert.ok(cmdBarSrc.includes("h-16"));
    assert.ok(cmdBarSrc.includes("liquid-glass-pill"));

    // App.tsx must render CommandBar followed by TelemetryBento
    const cmdBarIndex = appSrc.indexOf("<CommandBar");
    const bentoIndex = appSrc.indexOf("<TelemetryBento");
    assert.ok(cmdBarIndex !== -1, "CommandBar should be present in App.tsx");
    assert.ok(bentoIndex !== -1, "TelemetryBento should be present in App.tsx");
    assert.ok(cmdBarIndex < bentoIndex, "CommandBar must appear above TelemetryBento");
  });

  it("verifies v2.1 Ratchet Analytics 7D/30D/Tudo time range filter and stepped ratchet curve", () => {
    const stageSrc = fs.readFileSync(path.resolve("src/components/analytics/RatchetAnalyticsStage.tsx"), "utf-8");

    // Check for 7d, 30d, all options in ToggleGroup
    assert.ok(stageSrc.includes('value="7d"'));
    assert.ok(stageSrc.includes('value="30d"'));
    assert.ok(stageSrc.includes('value="all"'));
    assert.ok(stageSrc.includes("TimeRangeFilter"));

    // Check for stepped ratchet and plateau highlight in Amber
    assert.ok(stageSrc.includes('stepped: "before"'));
    assert.ok(stageSrc.includes("var(--amber)") || stageSrc.includes("#fbbf24")); // Amber for plateau
    assert.ok(stageSrc.includes("var(--emerald)") || stageSrc.includes("#34d399")); // Emerald for ratchet
    assert.ok(stageSrc.includes('grace: "15%"')); // 15% vertical optical margin
  });
});

