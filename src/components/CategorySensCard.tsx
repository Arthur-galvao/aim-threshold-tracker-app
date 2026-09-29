import { useMemo } from "react";
import type { Task } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { getDisplaySens, getRecommendedSens } from "@/lib/viscose";
import {
  formatSensitivity,
  predictOptimalSensitivity,
  valorantToCm360,
  type RunDataPoint,
} from "@/lib/sens-analytics";

interface CategorySensCardProps {
  tasks: Task[];
  onApplySens?: (sensCm: number) => Promise<void>;
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

export function CategorySensCard({ tasks, onApplySens }: CategorySensCardProps) {
  const { t } = useI18n();

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

    for (const task of tasks) {
      const category = task.category || "Outros";
      const subcategory = task.subcategory || "Geral";
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

      group.taskNames.add(task.name);

      for (const sess of task.sessions) {
        const sensCm = valorantToCm360(sess.sens);
        if (sensCm >= 5 && sess.pb > 0) {
          group.runs.push({
            scenario: task.name,
            sens: Number(sensCm.toFixed(1)),
            score: sess.pb,
            rawScore: sess.pb,
            threshold: sess.threshold,
            date: sess.date,
          });
        }
      }
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {t("randomizer.confidenceHigh")}
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            {t("randomizer.confidenceMedium")}
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {t("randomizer.confidenceLow")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-subtle text-text-faint border border-edge">
            <span className="w-1.5 h-1.5 rounded-full bg-text-faint" />
            {t("randomizer.confInsufficient")}
          </span>
        );
    }
  };

  return (
    <div className="panel p-6 rounded-2xl border-edge-strong bg-surface/80 relative overflow-hidden space-y-4">
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-edge text-[11px] font-semibold text-text-faint uppercase tracking-wider">
                <th className="py-2.5 px-3">{t("categorySens.colCategory")}</th>
                <th className="py-2.5 px-3">{t("categorySens.colRecommended")}</th>
                <th className="py-2.5 px-3">{t("categorySens.colViscose")}</th>
                <th className="py-2.5 px-3">{t("categorySens.colStats")}</th>
                <th className="py-2.5 px-3">{t("categorySens.colConfidence")}</th>
                {onApplySens && <th className="py-2.5 px-3 text-right" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/60">
              {categoryGroups.map((item) => {
                const isPredicted = item.displaySens.source === "predicted";
                return (
                  <tr
                    key={item.key}
                    className="hover:bg-surface-subtle/50 transition-colors"
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
                        <span className="font-mono font-bold text-sm text-text-main">
                          {formatSensitivity(item.displaySens.value)}
                        </span>
                        {isPredicted ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {t("categorySens.sourcePredicted")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {t("categorySens.sourceViscose")}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-text-secondary">
                      {item.viscoseSens !== null
                        ? formatSensitivity(item.viscoseSens)
                        : "-"}
                    </td>

                    <td className="py-3 px-3 text-text-secondary">
                      {t("categorySens.scenariosRuns", {
                        scenarios: item.scenariosCount,
                        runs: item.totalRuns,
                      })}
                    </td>

                    <td className="py-3 px-3">
                      {renderConfidenceBadge(item.confidence)}
                    </td>

                    {onApplySens && (
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => void onApplySens(item.displaySens.value)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-surface-subtle hover:bg-surface-hover border border-edge text-text-main transition-colors"
                        >
                          {t("categorySens.applySens")}
                        </button>
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
