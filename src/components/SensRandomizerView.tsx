import { useCallback, useMemo, useState } from "react";
import type { Playlist, Task } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { useSensRandomizer } from "@/hooks/useSensRandomizer";
import {
  computeSweetSpotAnalytics,
  valorantToCm360,
  type RunDataPoint,
} from "@/lib/sens-analytics";
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
      const cat = task.category || "Click Timing";
      const subcat = task.subcategory || "Precision";
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
          const cat = task.category || "Click Timing";
          const subcat = task.subcategory || "Precision";
          return `${cat}__${subcat}` === activeCatKey;
        });
        break;
      }
    }

    const taskPbs = new Map<string, number>();
    for (const task of tasksToAnalyze) {
      let maxScore = 0;
      for (const sess of task.sessions) {
        if (sess.pb > maxScore) maxScore = sess.pb;
      }
      taskPbs.set(task.name, maxScore);
    }

    const list: RunDataPoint[] = [];

    for (const task of tasksToAnalyze) {
      const taskPb = taskPbs.get(task.name) || 0;
      for (const sess of task.sessions) {
        const sensCm = valorantToCm360(sess.sens);

        if (sensCm >= 5 && sess.pb > 0) {
          const rawScore = sess.pb;
          const normScore = taskPb > 0 ? (rawScore / taskPb) * 100 : 100;
          const effectiveScore = isNormalized ? normScore : rawScore;

          list.push({
            scenario: task.name,
            sens: Number(sensCm.toFixed(1)),
            rawScore,
            normScore,
            score: effectiveScore,
            threshold: sess.threshold,
            date: sess.date,
          });
        }
      }
    }

    return list;
  }, [scopeFilter, activeTask, allTasks, playlists, availableCategories]);

  const analysis = useMemo(() => {
    return computeSweetSpotAnalytics(relevantSessions);
  }, [relevantSessions]);

  const handleApplySens = useCallback(
    async (sensCm: number) => {
      await saveSettings({
        ...settings,
        rangeMode: "cm360",
        baseSensCm: Number(sensCm.toFixed(1)),
      });
    },
    [saveSettings, settings]
  );

  const handleViewPlaylistInChart = useCallback((playlistId: string) => {
    setScopeFilter({ mode: "playlist", playlistId });
  }, []);

  const handleViewCategoryInChart = useCallback((categoryKey: string) => {
    setScopeFilter({ mode: "category", categoryKey });
  }, []);

  return (
    <div className="space-y-6">
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

      <SensRandomizerChart
        relevantSessions={relevantSessions}
        scopeFilter={scopeFilter}
        onChangeScope={setScopeFilter}
        playlists={playlists}
        categories={availableCategories}
        scopeTitle={scopeTitle}
        theme={theme}
      />

      <SensRandomizerAnalytics
        analysis={analysis}
        relevantSessions={relevantSessions}
        scopeAllTasks={scopeFilter.mode !== "current"}
        onApplySens={handleApplySens}
      />

      <PlaylistSensCard
        playlists={playlists}
        tasks={allTasks}
        onApplySens={handleApplySens}
        onViewInChart={handleViewPlaylistInChart}
      />

      <CategorySensCard
        tasks={allTasks}
        onApplySens={handleApplySens}
        onViewInChart={handleViewCategoryInChart}
      />
    </div>
  );
}
