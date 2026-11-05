import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Thermometer } from "@phosphor-icons/react";
import { useAllRuns, useAllSkills } from "@/hooks/useSkill";
import { useSettings } from "@/hooks/useSettings";
import { groupTrainingSessions } from "@/lib/skill/sessions";
import { INTRA_SESSION_LAST_N, intraSessionCurve } from "@/lib/skill/intra-session";
import { DEFAULT_TRAINING_SETTINGS } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { Button, EmptyState, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

ChartJS.register(LinearScale, PointElement, LineElement, ChartTooltip, Legend);

export interface IntraSessionChartProps {
  className?: string;
}

const PALETTE_FALLBACK = {
  score: "#5ec5ff",
  amber: "#fbbf5a",
  textSecondary: "#a9b4c6",
  textFaint: "#7a8699",
  edge: "rgba(255, 255, 255, 0.08)",
};

/** Cores do tema (variáveis CSS), com fallback quando o DOM não existe. */
function palette() {
  if (typeof document === "undefined") return PALETTE_FALLBACK;
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    score: read("--score", PALETTE_FALLBACK.score),
    amber: read("--amber", PALETTE_FALLBACK.amber),
    textSecondary: read("--text-secondary", PALETTE_FALLBACK.textSecondary),
    textFaint: read("--text-faint", PALETTE_FALLBACK.textFaint),
    edge: read("--edge", PALETTE_FALLBACK.edge),
  };
}

/** Curva z médio por índice da run na sessão (últimas sessões) com a sugestão de aquecimento. */
export function IntraSessionChart({ className }: IntraSessionChartProps) {
  const { t } = useI18n();
  // Chaves novas vivem em docs/plans/i18n-pending/T7-dashboard.json até a integração (o tipo Key ainda não as conhece).
  const { showToast } = useToast();
  const { settings, updateSettings } = useSettings();
  const training = settings?.training ?? DEFAULT_TRAINING_SETTINGS;
  const allRuns = useAllRuns();
  const skills = useAllSkills();
  const [applying, setApplying] = useState(false);

  const curve = useMemo(() => {
    const sessions = groupTrainingSessions(allRuns, training.sessionGapMinutes);
    return intraSessionCurve(skills, sessions, INTRA_SESSION_LAST_N);
  }, [allRuns, skills, training.sessionGapMinutes]);

  const suggested = curve.suggestedWarmupRuns;
  const canApply = suggested !== null && suggested !== training.warmupRunsPerScenario && !applying;

  const apply = async () => {
    if (suggested === null || !canApply) return;
    setApplying(true);
    try {
      await updateSettings({ training: { ...training, warmupRunsPerScenario: suggested } });
      showToast(t("intra.applied", { n: suggested }), "success");
    } catch {
      showToast(t("intra.applyError"), "error");
    } finally {
      setApplying(false);
    }
  };

  const colors = palette();
  const lastIndex = curve.byIndex.length > 0 ? curve.byIndex[curve.byIndex.length - 1].index : 0;

  const data = {
      datasets: [
        {
          label: t("intra.meanZ"),
          data: curve.byIndex.map((b) => ({ x: b.index, y: b.meanZ })),
          borderColor: colors.score,
          backgroundColor: colors.score,
          pointRadius: 3,
          borderWidth: 2,
          tension: 0.2,
        },
        {
          label: t("intra.lineMean"),
          data: [
            { x: 0, y: 0 },
            { x: lastIndex, y: 0 },
          ],
          borderColor: colors.textFaint,
          borderDash: [4, 4],
          pointRadius: 0,
          borderWidth: 1,
        },
        {
          label: t("intra.lineWarmup"),
          data: [
            { x: 0, y: -0.25 },
            { x: lastIndex, y: -0.25 },
          ],
          borderColor: colors.amber,
          borderDash: [2, 4],
          pointRadius: 0,
          borderWidth: 1,
        },
      ],
  };

  const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      plugins: {
        legend: {
          labels: { color: colors.textSecondary, boxWidth: 10, font: { size: 10 } },
        },
      },
      scales: {
        x: {
          type: "linear" as const,
          min: 0,
          title: { display: true, text: t("intra.axisX"), color: colors.textFaint, font: { size: 10 } },
          ticks: { color: colors.textFaint, stepSize: 1, font: { size: 10 } },
          grid: { color: colors.edge },
        },
        y: {
          title: { display: true, text: t("intra.axisY"), color: colors.textFaint, font: { size: 10 } },
          ticks: { color: colors.textFaint, font: { size: 10 } },
          grid: { color: colors.edge },
        },
      },
  };

  return (
    <section className={cn("liquid-surface p-5 flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-3 select-none">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-main flex items-center gap-1.5">
            <Thermometer size={14} weight="regular" />
            <span>{t("intra.title")}</span>
          </h3>
          <p className="text-[11px] text-text-faint mt-0.5">{t("intra.desc", { n: INTRA_SESSION_LAST_N })}</p>
        </div>
      </div>

      {curve.byIndex.length === 0 ? (
        <EmptyState
          icon={<Thermometer size={24} weight="regular" />}
          title={t("intra.emptyTitle")}
          description={t("intra.empty")}
          className="min-h-[160px]"
        />
      ) : (
        <div className="h-48 w-full">
          <Line data={data} options={options} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-edge text-xs">
        <span className="text-text-secondary font-mono">
          {suggested !== null ? t("intra.suggest", { n: suggested }) : t("intra.noStable")}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-faint font-mono">
            {t("intra.current", { n: training.warmupRunsPerScenario })}
          </span>
          {suggested !== null && (
            <Button size="sm" variant="secondary" onClick={apply} disabled={!canApply}>
              {t("intra.apply")}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

export default IntraSessionChart;
