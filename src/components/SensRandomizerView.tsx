import { useCallback, useMemo, useState } from "react";
import type { Playlist, Task } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { useSensRandomizer } from "@/hooks/useSensRandomizer";
import {
  computeSweetSpotAnalytics,
  type RunDataPoint,
} from "@/lib/sens-analytics";
import { DEFAULT_CATEGORY, DEFAULT_SUBCATEGORY } from "@/lib/viscose";
import { buildRunPoints } from "@/lib/run-points";
import { SensRandomizerControls } from "./randomizer/SensRandomizerControls";
import {
  SensRandomizerChart,
  type ChartScopeFilter,
  type CategoryOption,
} from "./randomizer/SensRandomizerChart";
import { SensRandomizerAnalytics } from "./randomizer/SensRandomizerAnalytics";
import { CategorySensCard } from "./CategorySensCard";
import { PlaylistSensCard } from "./playlist/PlaylistSensCard";

interface SensRandomizerViewProps {
  activeTask: Task | null;
  allTasks: Task[];
  playlists?: Playlist[];
}

export function SensRandomizerView({
  activeTask,
  allTasks,
  playlists = [],
}: SensRandomizerViewProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const {
    settings,
    randomizerState,
    rawaccelAvailable,
    testing,
    saveSettings,
    toggleEnabled,
    triggerRandomize,
    detectPath,
    testWriter,
  } = useSensRandomizer();

  const [scopeFilter, setScopeFilter] = useState<ChartScopeFilter>({
    mode: "current",
  });

  // Unique categories derived from allTasks for category selector
  const availableCategories = useMemo<CategoryOption[]>(() => {
    const map = new Map<
      string,
      { category: string; subcategory: string; count: number }
    >();

    for (const task of allTasks) {
      const cat = task.category || DEFAULT_CATEGORY;
      const subcat = task.subcategory || DEFAULT_SUBCATEGORY;
      const key = `${cat}__${subcat}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { category: cat, subcategory: subcat, count: 1 });
      }
    }

    return Array.from(map.entries()).map(([key, data]) => ({
      key,
      category: data.category,
      subcategory: data.subcategory,
      scenariosCount: data.count,
    }));
  }, [allTasks]);

  // Derive human-readable scope title for chart
  const scopeTitle = useMemo<string>(() => {
    switch (scopeFilter.mode) {
      case "current":
        return activeTask?.name ?? t("randomizer.scopeCurrent");
      case "all":
        return t("randomizer.scopeAll");
      case "playlist": {
        const activePlId = scopeFilter.playlistId || playlists[0]?.id;
        const pl = playlists.find((p) => p.id === activePlId);
        return pl ? pl.name : t("randomizer.scopePlaylist");
      }
      case "category": {
        const activeCatKey =
          scopeFilter.categoryKey || availableCategories[0]?.key;
        const cat = availableCategories.find((c) => c.key === activeCatKey);
        return cat
          ? `${cat.category} - ${cat.subcategory}`
          : t("randomizer.scopeCategory");
      }
    }
  }, [scopeFilter, activeTask, playlists, availableCategories, t]);

  // Collect runs for analytics with per-scenario normalization according to active scope
  const relevantSessions = useMemo<RunDataPoint[]>(() => {
    let tasksToAnalyze: Task[] = [];
    const isNormalized = scopeFilter.mode !== "current";

    switch (scopeFilter.mode) {
      case "current":
        tasksToAnalyze = activeTask ? [activeTask] : allTasks;
        break;

      case "all":
        tasksToAnalyze = allTasks;
        break;

      case "playlist": {
        const activePlId = scopeFilter.playlistId || playlists[0]?.id;
        const targetPlaylist = playlists.find((p) => p.id === activePlId);
        if (targetPlaylist) {
          const taskMap = new Map(allTasks.map((t) => [t.id, t]));
          const seen = new Set<string>();
          for (const item of targetPlaylist.items || []) {
            const task = taskMap.get(item.taskId);
            if (task && !seen.has(task.id)) {
              seen.add(task.id);
              tasksToAnalyze.push(task);
            }
          }
        }
        break;
      }

      case "category": {
        const activeCatKey =
          scopeFilter.categoryKey || availableCategories[0]?.key;
        tasksToAnalyze = allTasks.filter((task) => {
          const cat = task.category || DEFAULT_CATEGORY;
          const subcat = task.subcategory || DEFAULT_SUBCATEGORY;
          return `${cat}__${subcat}` === activeCatKey;
        });
        break;
      }
    }

    const runPoints = buildRunPoints(tasksToAnalyze, { dpi: settings.mouseDpi });

    return runPoints.map((p) => ({
      scenario: p.scenario,
      sens: p.sens,
      rawScore: p.score,
      normScore: p.rel,
      score: isNormalized ? p.rel : p.score,
      threshold: p.threshold,
      date: p.date,
    }));
  }, [scopeFilter, activeTask, allTasks, playlists, availableCategories, settings.mouseDpi]);

  const analysis = useMemo(() => {
    return computeSweetSpotAnalytics(relevantSessions);
  }, [relevantSessions]);

  const groupRuns = useMemo<RunDataPoint[] | undefined>(() => {
    if (scopeFilter.mode !== "current" || !activeTask) return undefined;
    const cat = activeTask.category || DEFAULT_CATEGORY;
    const subcat = activeTask.subcategory || DEFAULT_SUBCATEGORY;
    const categoryTasks = allTasks.filter(
      (t) =>
        (t.category || DEFAULT_CATEGORY) === cat &&
        (t.subcategory || DEFAULT_SUBCATEGORY) === subcat
    );
    const runPoints = buildRunPoints(categoryTasks, { dpi: settings.mouseDpi });
    return runPoints.map((p) => ({
      scenario: p.scenario,
      sens: p.sens,
      rawScore: p.score,
      normScore: p.rel,
      score: p.rel,
      threshold: p.threshold,
      date: p.date,
    }));
  }, [scopeFilter.mode, activeTask, allTasks, settings.mouseDpi]);

  const handleApplySens = useCallback(
    async (sensCm: number, targetScenarios?: string[]) => {
      const rounded = Number(sensCm.toFixed(1));
      const overrides = { ...(settings.centerOverrides || {}) };
      if (targetScenarios && targetScenarios.length > 0) {
        for (const name of targetScenarios) {
          if (name && name.trim()) {
            overrides[name.trim().toLowerCase()] = rounded;
          }
        }
      } else if (activeTask?.name) {
        overrides[activeTask.name.trim().toLowerCase()] = rounded;
      }
      await saveSettings({
        ...settings,
        scenarioIdealCm: rounded,
        centerOverrides: overrides,
      });
    },
    [activeTask?.name, saveSettings, settings]
  );

  const handleViewPlaylistInChart = useCallback((playlistId: string) => {
    setScopeFilter({ mode: "playlist", playlistId });
  }, []);

  const handleViewCategoryInChart = useCallback((categoryKey: string) => {
    setScopeFilter({ mode: "category", categoryKey });
  }, []);

  return (
    <div className="space-y-6">
      <div className="enter" style={{ animationDelay: "0ms" }}>
        <SensRandomizerControls
          settings={settings}
          randomizerState={randomizerState}
          rawaccelAvailable={rawaccelAvailable}
          testing={testing}
          onSaveSettings={saveSettings}
          onToggleEnabled={toggleEnabled}
          onTriggerRandomize={triggerRandomize}
          onDetectPath={detectPath}
          onTestWriter={testWriter}
          activeTask={activeTask}
          allTasks={allTasks}
        />
      </div>

      <div className="enter" style={{ animationDelay: "60ms" }}>
        <SensRandomizerChart
          relevantSessions={relevantSessions}
          scopeFilter={scopeFilter}
          onChangeScope={setScopeFilter}
          playlists={playlists}
          categories={availableCategories}
          scopeTitle={scopeTitle}
          theme={theme}
          activeMinCm={settings.minCm}
          activeMaxCm={settings.maxCm}
        />
      </div>

      <div className="enter" style={{ animationDelay: "120ms" }}>
        <SensRandomizerAnalytics
          analysis={analysis}
          relevantSessions={relevantSessions}
          groupRuns={groupRuns}
          scopeAllTasks={scopeFilter.mode !== "current"}
          onApplySens={handleApplySens}
        />
      </div>

      <div className="enter" style={{ animationDelay: "180ms" }}>
        <PlaylistSensCard
          playlists={playlists}
          tasks={allTasks}
          mouseDpi={settings.mouseDpi}
          onApplySens={handleApplySens}
          onViewInChart={handleViewPlaylistInChart}
        />
      </div>

      <div className="enter" style={{ animationDelay: "240ms" }}>
        <CategorySensCard
          tasks={allTasks}
          mouseDpi={settings.mouseDpi}
          onApplySens={handleApplySens}
          onViewInChart={handleViewCategoryInChart}
        />
      </div>
    </div>
  );
}
