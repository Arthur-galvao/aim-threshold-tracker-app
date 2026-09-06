import { useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { useSensRandomizer } from "@/hooks/useSensRandomizer";
import {
  computeSweetSpotAnalytics,
  valorantToCm360,
  type RunDataPoint,
} from "@/lib/sens-analytics";
import { SensRandomizerControls } from "./randomizer/SensRandomizerControls";
import { SensRandomizerChart } from "./randomizer/SensRandomizerChart";
import { SensRandomizerAnalytics } from "./randomizer/SensRandomizerAnalytics";

interface SensRandomizerViewProps {
  activeTask: Task | null;
  allTasks: Task[];
}

export function SensRandomizerView({ activeTask, allTasks }: SensRandomizerViewProps) {
  const { theme } = useTheme();
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

  const [scopeAllTasks, setScopeAllTasks] = useState(false);

  // Collect runs for analytics with per-scenario normalization
  const relevantSessions = useMemo<RunDataPoint[]>(() => {
    const tasksToAnalyze = scopeAllTasks
      ? allTasks
      : activeTask
      ? [activeTask]
      : allTasks;

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
          const effectiveScore = scopeAllTasks ? normScore : rawScore;

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
  }, [scopeAllTasks, activeTask, allTasks]);

  const analysis = useMemo(() => {
    return computeSweetSpotAnalytics(relevantSessions);
  }, [relevantSessions]);

  const handleApplySens = async (sensCm: number) => {
    await saveSettings({
      ...settings,
      rangeMode: "cm360",
      baseSensCm: Number(sensCm.toFixed(1)),
    });
  };

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
      />

      <SensRandomizerChart
        relevantSessions={relevantSessions}
        scopeAllTasks={scopeAllTasks}
        onToggleScope={setScopeAllTasks}
        theme={theme}
      />

      <SensRandomizerAnalytics
        analysis={analysis}
        relevantSessions={relevantSessions}
        scopeAllTasks={scopeAllTasks}
        onApplySens={handleApplySens}
      />
    </div>
  );
}
