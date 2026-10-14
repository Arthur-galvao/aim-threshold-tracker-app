import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_CATEGORY,
  DEFAULT_SUBCATEGORY,
  getDisplaySens,
  getRecommendedSens,
} from "@/lib/viscose";
import {
  formatSensitivity,
  predictOptimalSensitivity,
  type RunDataPoint,
} from "@/lib/sens-analytics";
import { buildRunPoints } from "@/lib/run-points";

interface CategorySensCardProps {
  tasks: Task[];
  mouseDpi?: number;
  onApplySens?: (sensCm: number, targetScenarios?: string[]) => Promise<void>;
  onViewInChart?: (categoryKey: string) => void;
}

interface CategoryGroupItem {
  key: string;
  category: string;
  subcategory: string;
  scenariosCount: number;
  totalRuns: number;
  displaySens: { value: number; source: "predicted" | "viscose" };
  viscoseSens: number | null;
  confidence: "high" | "medium" | "low" | "insufficient";
}

export function CategorySensCard({
  tasks,
  mouseDpi,
  onApplySens,
  onViewInChart,
}: CategorySensCardProps) {
  const { t } = useI18n();
  const dpi = mouseDpi || 800;

  const categoryGroups = useMemo<CategoryGroupItem[]>(() => {
    const map = new Map<
      string,
      {
        category: string;
        subcategory: string;
        taskNames: Set<string>;
        runs: RunDataPoint[];
      }
    >();

    const runPoints = buildRunPoints(tasks, { dpi });
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    for (const p of runPoints) {
      const task = taskMap.get(p.taskId);
      const category = task?.category || DEFAULT_CATEGORY;
      const subcategory = task?.subcategory || DEFAULT_SUBCATEGORY;
      const groupKey = `${category}__${subcategory}`;

      let group = map.get(groupKey);
      if (!group) {
        group = {
          category,
          subcategory,
          taskNames: new Set<string>(),
          runs: [],
        };
        map.set(groupKey, group);
      }

      group.taskNames.add(p.scenario);
      group.runs.push({
        scenario: p.scenario,
        sens: p.sens,
        score: p.rel,
        rawScore: p.score,
        normScore: p.rel,
        threshold: p.threshold,
        date: p.date,
      });
    }

    const items: CategoryGroupItem[] = [];

    for (const [key, group] of map.entries()) {
      const displaySens = getDisplaySens(
        group.category,
        group.subcategory,
        group.runs
      );
      const viscoseSens = getRecommendedSens(group.category, group.subcategory);

      let confidence: "high" | "medium" | "low" | "insufficient" = "insufficient";
      if (group.runs.length > 0) {
        const pred = predictOptimalSensitivity([], "equilibrado", {
          groupRuns: group.runs,
        });
        if (pred) {
          confidence = pred.confidence;
        }
      }

      items.push({
        key,
        category: group.category,
        subcategory: group.subcategory,
        scenariosCount: group.taskNames.size,
        totalRuns: group.runs.length,
        displaySens,
        viscoseSens,
        confidence,
      });
    }

    // Sort by runs descending, then category name
    return items.sort((a, b) => {
      if (b.totalRuns !== a.totalRuns) {
        return b.totalRuns - a.totalRuns;
      }
      return a.category.localeCompare(b.category);
    });
  }, [tasks]);

  const renderConfidenceBadge = (
    confidence: "high" | "medium" | "low" | "insufficient"
  ) => {
    switch (confidence) {
      case "high":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-soft text-emerald border border-emerald-edge">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald" />
            {t("randomizer.confidenceHigh")}
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-score-soft text-score border border-score/20">
            <span className="w-1.5 h-1.5 rounded-full bg-score" />
            {t("randomizer.confidenceMedium")}
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-soft text-amber border border-amber-edge">
            <span className="w-1.5 h-1.5 rounded-full bg-amber" />
            {t("randomizer.confidenceLow")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-subtle text-text-faint border border-edge">
            <span className="w-1.5 h-1.5 rounded-full bg-text-faint" />
            {t("randomizer.confInsufficient")}
          </span>
        );
    }
  };

  return (
    <div className="glass-panel p-4 sm:p-6 relative overflow-hidden space-y-4">
      <div className="border-b border-edge pb-4">
        <h3 className="text-base font-bold text-text-main">
          {t("categorySens.title")}
        </h3>
        <p className="text-xs text-text-secondary mt-1">
          {t("categorySens.subtitle")}
        </p>
      </div>

      {categoryGroups.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-faint">
          {t("categorySens.empty")}
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-edge text-[11px] font-semibold text-text-faint uppercase tracking-wider">
                <th className="py-2.5 px-3 whitespace-nowrap">{t("categorySens.colCategory")}</th>
                <th className="py-2.5 px-3 whitespace-nowrap">{t("categorySens.colRecommended")}</th>
                <th className="py-2.5 px-3 whitespace-nowrap">{t("categorySens.colViscose")}</th>
                <th className="py-2.5 px-3 whitespace-nowrap">{t("categorySens.colStats")}</th>
                <th className="py-2.5 px-3 whitespace-nowrap">{t("categorySens.colConfidence")}</th>
                {(onViewInChart || onApplySens) && (
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    {t("playlistSens.colActions")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {categoryGroups.map((item, index) => {
                const isPredicted = item.displaySens.source === "predicted";
                return (
                  <tr
                    key={item.key}
                    className="hover:bg-surface-hover transition-colors enter"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="py-3 px-3">
                      <div className="font-semibold text-text-main">
                        {item.category}
                      </div>
                      <div className="text-[11px] text-text-secondary">
                        {item.subcategory}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-text-main tabular-nums">
                          {formatSensitivity(item.displaySens.value, dpi)}
                        </span>
                        {isPredicted ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-soft text-emerald border border-emerald-edge">
                            {t("categorySens.sourcePredicted")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-accent-soft text-accent border border-accent/20">
                            {t("categorySens.sourceViscose")}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-text-secondary tabular-nums">
                      {item.viscoseSens !== null
                        ? formatSensitivity(item.viscoseSens, dpi)
                        : "-"}
                    </td>

                    <td className="py-3 px-3 text-text-secondary tabular-nums">
                      {t("categorySens.scenariosRuns", {
                        scenarios: item.scenariosCount,
                        runs: item.totalRuns,
                      })}
                    </td>

                    <td className="py-3 px-3">
                      {renderConfidenceBadge(item.confidence)}
                    </td>

                    {(onViewInChart || onApplySens) && (
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onViewInChart && (
                            <button
                              type="button"
                              onClick={() => onViewInChart(item.key)}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-surface-subtle hover:bg-surface-hover border border-edge text-text-main transition-colors whitespace-nowrap press"
                            >
                              {t("categorySens.viewInChart")}
                            </button>
                          )}
                          {onApplySens && (
                            <button
                              type="button"
                              onClick={() => {
                                const scenarioNames = tasks
                                  .filter((t) => `${t.category || DEFAULT_CATEGORY}__${t.subcategory || DEFAULT_SUBCATEGORY}` === item.key)
                                  .map((t) => t.name)
                                  .filter(Boolean);
                                void onApplySens(item.displaySens.value, scenarioNames);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-surface-subtle hover:bg-surface-hover border border-edge text-text-main transition-colors whitespace-nowrap press"
                            >
                              {t("categorySens.applySens")}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
