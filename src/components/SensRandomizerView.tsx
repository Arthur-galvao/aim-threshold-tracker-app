import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Scatter } from "react-chartjs-2";
import type { Task } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import {
  useSensRandomizer,
  type RandomizerSettings,
} from "@/hooks/useSensRandomizer";

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

interface SensRandomizerViewProps {
  activeTask: Task | null;
  allTasks: Task[];
}

interface BucketStat {
  rangeLabel: string;
  min: number;
  max: number;
  count: number;
  avgScore: number;
  maxScore: number;
  stdDev: number | null;
  consistency: number | null;
  weightedScore: number;
  confidenceLevel: "high" | "medium" | "low" | "insufficient";
}

export function SensRandomizerView({ activeTask, allTasks }: SensRandomizerViewProps) {
  const { t } = useI18n();
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

  const [baseSensStr, setBaseSensStr] = useState(() => String(settings.baseSensCm || 40));
  const [minCmStr, setMinCmStr] = useState(() => String(settings.minCm || 28));
  const [maxCmStr, setMaxCmStr] = useState(() => String(settings.maxCm || 55));
  const [minMultStr, setMinMultStr] = useState(() => String(settings.minMult || 0.75));
  const [maxMultStr, setMaxMultStr] = useState(() => String(settings.maxMult || 1.35));
  const [rangeMode, setRangeMode] = useState<"cm360" | "multiplier">(() =>
    settings.rangeMode === "multiplier" ? "multiplier" : "cm360"
  );
  const [avoidRepeats, setAvoidRepeats] = useState(() => settings.avoidRepeats ?? true);
  const [scopeAllTasks, setScopeAllTasks] = useState(false);

  // Sync inputs whenever backend settings update
  useEffect(() => {
    setBaseSensStr(String(settings.baseSensCm || 40));
    setMinCmStr(String(settings.minCm || 28));
    setMaxCmStr(String(settings.maxCm || 55));
    setMinMultStr(String(settings.minMult || 0.75));
    setMaxMultStr(String(settings.maxMult || 1.35));
    setRangeMode(settings.rangeMode === "multiplier" ? "multiplier" : "cm360");
    setAvoidRepeats(settings.avoidRepeats ?? true);
  }, [settings]);

  const parsedBaseSens = parseFloat(baseSensStr) || settings.baseSensCm || 40;
  const parsedMinCm = parseFloat(minCmStr) || settings.minCm || 28;
  const parsedMaxCm = parseFloat(maxCmStr) || settings.maxCm || 55;
  const parsedMinMult = parseFloat(minMultStr) || settings.minMult || 0.75;
  const parsedMaxMult = parseFloat(maxMultStr) || settings.maxMult || 1.35;

  const handleSave = async () => {
    const newSettings: RandomizerSettings = {
      ...settings,
      rangeMode,
      avoidRepeats,
      baseSensCm: parseFloat(baseSensStr) || settings.baseSensCm || 40,
      minCm: parseFloat(minCmStr) || settings.minCm || 28,
      maxCm: parseFloat(maxCmStr) || settings.maxCm || 55,
      minMult: parseFloat(minMultStr) || settings.minMult || 0.75,
      maxMult: parseFloat(maxMultStr) || settings.maxMult || 1.35,
    };
    await saveSettings(newSettings);
  };

  // Collect runs for analytics with per-scenario normalization
  const relevantSessions = useMemo(() => {
    const tasksToAnalyze = scopeAllTasks
      ? allTasks
      : activeTask
      ? [activeTask]
      : allTasks;

    // First, determine each task's peak score (PB) to allow proper percentage normalization
    const taskPbs = new Map<string, number>();
    for (const task of tasksToAnalyze) {
      let maxScore = 0;
      for (const sess of task.sessions) {
        if (sess.pb > maxScore) maxScore = sess.pb;
      }
      taskPbs.set(task.name, maxScore);
    }

    const list: Array<{
      scenario: string;
      sens: number;
      rawScore: number;
      normScore: number;
      score: number;
      threshold: number;
      date: string;
    }> = [];

    for (const task of tasksToAnalyze) {
      const taskPb = taskPbs.get(task.name) || 0;
      for (const sess of task.sessions) {
        const sensCm = sess.sens > 0 && sess.sens < 2.5
          ? 13062.857 / (800 * sess.sens)
          : sess.sens;

        if (sensCm >= 5 && sess.pb > 0) {
          const rawScore = sess.pb;
          const normScore = taskPb > 0 ? (rawScore / taskPb) * 100 : 100;
          // When analyzing across all tasks, use normalized score (% of PB) so scenarios with 70,000 points
          // don't completely skew and overshadow scenarios with 100 points!
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

  // Statistical analysis for sweet spot with sample-size qualification & Bayesian shrinkage
  const analysis = useMemo(() => {
    if (relevantSessions.length === 0) {
      return null;
    }

    const sensList = relevantSessions.map((s) => s.sens);
    const minSens = Math.floor(Math.min(...sensList));
    const maxSens = Math.ceil(Math.max(...sensList));

    const totalScores = relevantSessions.map((s) => s.score);
    const globalMeanScore =
      totalScores.reduce((a, b) => a + b, 0) / (totalScores.length || 1);

    const bucketSize = 5;
    const bucketMap = new Map<number, number[]>();

    for (const sess of relevantSessions) {
      const bucketIndex = Math.floor(sess.sens / bucketSize) * bucketSize;
      const scores = bucketMap.get(bucketIndex) || [];
      scores.push(sess.score);
      bucketMap.set(bucketIndex, scores);
    }

    const buckets: BucketStat[] = [];
    for (const [bMin, scores] of bucketMap.entries()) {
      const bMax = bMin + bucketSize;
      const count = scores.length;
      const avg = scores.reduce((a, b) => a + b, 0) / count;
      const max = Math.max(...scores);

      // Bayesian shrinkage towards global mean with prior weight k = 3
      // Prevents 1-run outliers from skewing the results
      const k = 3;
      const weightedScore =
        (count / (count + k)) * avg + (k / (count + k)) * globalMeanScore;

      // Sample standard deviation and motor consistency
      let stdDev: number | null = null;
      let consistency: number | null = null;

      if (count >= 2) {
        // Bessel's correction (n - 1) for unbiased sample variance
        const sampleVariance =
          scores.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) /
          (count - 1);
        stdDev = Math.sqrt(sampleVariance);
        const cv = avg > 0 ? stdDev / avg : 1;
        consistency = Math.max(0, Math.min(100, (1 - cv) * 100));
      }

      let confidenceLevel: "high" | "medium" | "low" | "insufficient";
      if (count >= 8) {
        confidenceLevel = "high";
      } else if (count >= 4) {
        confidenceLevel = "medium";
      } else if (count >= 2) {
        confidenceLevel = "low";
      } else {
        confidenceLevel = "insufficient";
      }

      buckets.push({
        rangeLabel: `${bMin.toFixed(0)} - ${bMax.toFixed(0)} cm`,
        min: bMin,
        max: bMax,
        count,
        avgScore: avg,
        maxScore: max,
        stdDev,
        consistency,
        weightedScore,
        confidenceLevel,
      });
    }

    // Determine the minimum sample size required for a bucket to be eligible as the definitive Sweet Spot
    const maxCountInAnyBucket = Math.max(...buckets.map((b) => b.count), 0);
    // If the user has well-populated buckets (>= 5 runs), require at least 3 runs.
    // If the top bucket has 3-4 runs, require at least 2 runs.
    // If all buckets have only 1 run, allow 1 run as provisional.
    const minEligibleRuns =
      maxCountInAnyBucket >= 5 ? 3 : maxCountInAnyBucket >= 3 ? 2 : 1;

    const eligibleBuckets = buckets.filter((b) => b.count >= minEligibleRuns);

    // Sort eligible buckets primarily by Bayesian weighted score, then by raw average score
    eligibleBuckets.sort((a, b) => {
      if (Math.abs(b.weightedScore - a.weightedScore) > 0.05) {
        return b.weightedScore - a.weightedScore;
      }
      return b.avgScore - a.avgScore;
    });

    // Also sort all buckets by weighted score for general ranking
    buckets.sort((a, b) => {
      if (Math.abs(b.weightedScore - a.weightedScore) > 0.05) {
        return b.weightedScore - a.weightedScore;
      }
      return b.avgScore - a.avgScore;
    });

    const bestBucket = eligibleBuckets[0] || buckets[0] || null;
    const isProvisional = !bestBucket || bestBucket.count < 3;

    return {
      minSens,
      maxSens,
      totalRuns: relevantSessions.length,
      bestBucket,
      isProvisional,
      minEligibleRuns,
      buckets,
      globalMeanScore,
    };
  }, [relevantSessions]);

  // Chart data
  const chartData = useMemo(() => {
    if (relevantSessions.length === 0) {
      return { datasets: [] };
    }

    const scatterPoints = relevantSessions.map((s) => ({
      x: s.sens,
      y: s.score,
      scenario: s.scenario,
      date: s.date,
    }));

    // Generate quadratic trendline
    let trendPoints: Array<{ x: number; y: number }> = [];
    if (relevantSessions.length >= 4) {
      const sorted = [...relevantSessions].sort((a, b) => a.sens - b.sens);
      const xMin = sorted[0].sens;
      const xMax = sorted[sorted.length - 1].sens;

      // Simple parabolic fit (y = ax^2 + bx + c) using least squares
      let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
      let sumY = 0, sumXY = 0, sumX2Y = 0;
      const n = sorted.length;

      for (const pt of sorted) {
        const x = pt.sens;
        const y = pt.score;
        sumX += x;
        sumX2 += x * x;
        sumX3 += x * x * x;
        sumX4 += x * x * x * x;
        sumY += y;
        sumXY += x * y;
        sumX2Y += x * x * y;
      }

      // Solve 3x3 linear system using Cramer's rule
      const d =
        n * (sumX2 * sumX4 - sumX3 * sumX3) -
        sumX * (sumX * sumX4 - sumX2 * sumX3) +
        sumX2 * (sumX * sumX3 - sumX2 * sumX2);

      if (Math.abs(d) > 1e-7) {
        const da =
          sumY * (sumX2 * sumX4 - sumX3 * sumX3) -
          sumX * (sumXY * sumX4 - sumX2Y * sumX3) +
          sumX2 * (sumXY * sumX3 - sumX2Y * sumX2);
        const db =
          n * (sumXY * sumX4 - sumX2Y * sumX3) -
          sumY * (sumX * sumX4 - sumX2 * sumX3) +
          sumX2 * (sumX * sumX2Y - sumX2 * sumXY);
        const dc =
          n * (sumX2 * sumX2Y - sumX3 * sumXY) -
          sumX * (sumX * sumX2Y - sumX2 * sumXY) +
          sumY * (sumX * sumX3 - sumX2 * sumX2);

        const c = da / d;
        const b = db / d;
        const a = dc / d;

        const steps = 30;
        const stepSize = (xMax - xMin) / steps;
        for (let i = 0; i <= steps; i++) {
          const xVal = xMin + i * stepSize;
          const yVal = a * xVal * xVal + b * xVal + c;
          trendPoints.push({ x: Number(xVal.toFixed(1)), y: Math.max(0, Math.round(yVal)) });
        }
      }
    }

    const isLight = theme === "light";

    return {
      datasets: [
        {
          type: "scatter" as const,
          label: scopeAllTasks ? t("randomizer.normPb") : t("randomizer.rawScore"),
          data: scatterPoints,
          backgroundColor: isLight ? "rgba(2, 132, 199, 0.75)" : "rgba(56, 189, 248, 0.8)",
          borderColor: isLight ? "#0284c7" : "#38bdf8",
          pointRadius: 5,
          pointHoverRadius: 7,
        },
        ...(trendPoints.length > 0
          ? [
              {
                type: "line" as const,
                label: t("randomizer.chartTrend"),
                data: trendPoints,
                borderColor: "#f59e0b",
                backgroundColor: "transparent",
                borderWidth: 2.5,
                borderDash: [4, 4],
                pointRadius: 0,
                fill: false,
                tension: 0.3,
              },
            ]
          : []),
      ],
    };
  }, [relevantSessions, scopeAllTasks, theme, t]);

  const isLight = theme === "light";

  const chartOptions = useMemo(() => {
    const gridColor = isLight ? "rgba(0, 0, 0, 0.05)" : "rgba(255, 255, 255, 0.04)";
    const textColor = isLight ? "#475569" : "#94a3b8";

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: {
            color: textColor,
            font: { size: 11, weight: "bold" as const },
            boxWidth: 12,
          },
        },
        tooltip: {
          backgroundColor: isLight ? "rgba(255, 255, 255, 0.96)" : "rgba(18, 19, 26, 0.96)",
          titleColor: isLight ? "#0f172a" : "#f8fafc",
          bodyColor: isLight ? "#334155" : "#cbd5e1",
          borderColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx: any) => {
              const raw = ctx.raw;
              if (raw.scenario) {
                if (scopeAllTasks) {
                  return `${raw.scenario}: ${raw.normScore.toFixed(1)}${t("randomizer.chartTooltipOfPb")} (${raw.rawScore.toFixed(0)} pts) ${t("randomizer.chartTooltipAt")} ${raw.x.toFixed(1)} cm`;
                }
                return `${raw.scenario}: ${raw.rawScore.toFixed(1)} pts (${raw.normScore.toFixed(1)}${t("randomizer.chartTooltipOfPb")}) ${t("randomizer.chartTooltipAt")} ${raw.x.toFixed(1)} cm`;
              }
              return `${t("randomizer.chartTrendLabel")}: ${raw.y.toFixed(1)} ${scopeAllTasks ? t("randomizer.chartTooltipOfPb") : "pts"} (${raw.x.toFixed(1)} cm)`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear" as const,
          title: {
            display: true,
            text: t("randomizer.chartSensAxis"),
            color: textColor,
            font: { size: 11, weight: "bold" as const },
          },
          grid: { color: gridColor },
          ticks: { color: textColor },
        },
        y: {
          title: {
            display: true,
            text: scopeAllTasks ? t("randomizer.normPb") : t("randomizer.rawScore"),
            color: textColor,
            font: { size: 11, weight: "bold" as const },
          },
          grid: { color: gridColor },
          ticks: { color: textColor },
        },
      },
    };
  }, [isLight, scopeAllTasks, t]);

  // Delta calculation for current state
  const deltaFromBasePercent = useMemo(() => {
    if (settings.baseSensCm <= 0) return 0;
    const diff = randomizerState.activeSensCm - settings.baseSensCm;
    return (diff / settings.baseSensCm) * 100;
  }, [randomizerState.activeSensCm, settings.baseSensCm]);

  // Recent runs history
  const recentRuns = useMemo(() => {
    return [...relevantSessions].slice(-10).reverse();
  }, [relevantSessions]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-text-main tracking-tight">
              {t("randomizer.title")}
            </h2>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                settings.enabled
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-surface-subtle text-text-faint border-edge"
              }`}
            >
              {settings.enabled ? t("randomizer.statusActive") : t("randomizer.statusInactive")}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            {t("randomizer.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={triggerRandomize}
            disabled={!rawaccelAvailable}
            className="minimal-btn-secondary px-3.5 py-2 text-xs font-semibold rounded-full flex items-center gap-1.5 justify-center flex-1 md:flex-initial disabled:opacity-40 disabled:pointer-events-none"
            title={t("randomizer.rollNowTooltip")}
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{t("randomizer.rollNow")}</span>
          </button>

          <button
            type="button"
            onClick={toggleEnabled}
            disabled={!rawaccelAvailable}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 justify-center transition-all flex-1 md:flex-initial disabled:opacity-40 disabled:pointer-events-none shadow-sm ${
              settings.enabled
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
                : "minimal-btn"
            }`}
          >
            {settings.enabled ? t("randomizer.disableBtn") : t("randomizer.enableBtn")}
          </button>
        </div>
      </div>

      {/* 2-Column Grid: Config & Real-Time Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Config Panel */}
        <div className="lg:col-span-6 space-y-6">
          <div className="panel p-6 rounded-2xl space-y-5">
            <div className="border-b border-edge pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
                {t("randomizer.paramsTitle")}
              </h3>
              <p className="text-[11px] text-text-faint mt-0.5">
                {t("randomizer.paramsSubtitle")}
              </p>
            </div>

            {/* Base Sens */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="baseSensInput" className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
                  {t("randomizer.baseSens")}
                </label>
                <span className="text-[10px] text-text-faint font-mono">
                  {t("randomizer.baseSensSource")}
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  id="baseSensInput"
                  type="text"
                  inputMode="decimal"
                  value={baseSensStr}
                  onChange={(e) => {
                    const val = e.target.value.replace(",", ".");
                    if (val === "" || /^\d*\.?\d*$/.test(val)) {
                      setBaseSensStr(val);
                    }
                  }}
                  onBlur={() => {
                    if (!baseSensStr.trim() || isNaN(parseFloat(baseSensStr))) {
                      setBaseSensStr(String(settings.baseSensCm || 40));
                    }
                  }}
                  className="minimal-input text-xs font-mono font-medium pl-3.5 pr-20 py-2.5 tabular-nums"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-surface border border-edge text-[10px] font-mono font-semibold text-text-faint uppercase pointer-events-none">
                  cm/360
                </div>
              </div>
              <p className="text-[11px] text-text-faint mt-1.5 leading-relaxed">
                {t("randomizer.baseSensHelp")}
              </p>
            </div>

            {/* Mode Selector */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5">
                {t("randomizer.mode")}
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-subtle rounded-xl border border-edge">
                <button
                  type="button"
                  onClick={() => setRangeMode("cm360")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 ${
                    rangeMode === "cm360"
                      ? "bg-surface text-text-main shadow-sm border border-edge-strong"
                      : "text-text-secondary hover:text-text-main"
                  }`}
                >
                  <span>{t("randomizer.modeCm")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRangeMode("multiplier")}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 ${
                    rangeMode === "multiplier"
                      ? "bg-surface text-text-main shadow-sm border border-edge-strong"
                      : "text-text-secondary hover:text-text-main"
                  }`}
                >
                  <span>{t("randomizer.modeMult")}</span>
                </button>
              </div>
            </div>

            {/* Range Inputs based on mode */}
            {rangeMode === "cm360" ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="minCmInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5">
                      {t("randomizer.min")} (cm/360)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="minCmInput"
                        type="text"
                        inputMode="decimal"
                        value={minCmStr}
                        onChange={(e) => {
                          const val = e.target.value.replace(",", ".");
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setMinCmStr(val);
                          }
                        }}
                        onBlur={() => {
                          if (!minCmStr.trim() || isNaN(parseFloat(minCmStr))) {
                            setMinCmStr(String(settings.minCm || 28));
                          }
                        }}
                        className="minimal-input text-xs font-mono font-medium pl-3.5 pr-12 py-2.5 tabular-nums"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-surface border border-edge text-[10px] font-mono font-semibold text-text-faint uppercase pointer-events-none">
                        cm
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="maxCmInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5">
                      {t("randomizer.max")} (cm/360)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="maxCmInput"
                        type="text"
                        inputMode="decimal"
                        value={maxCmStr}
                        onChange={(e) => {
                          const val = e.target.value.replace(",", ".");
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setMaxCmStr(val);
                          }
                        }}
                        onBlur={() => {
                          if (!maxCmStr.trim() || isNaN(parseFloat(maxCmStr))) {
                            setMaxCmStr(String(settings.maxCm || 55));
                          }
                        }}
                        className="minimal-input text-xs font-mono font-medium pl-3.5 pr-12 py-2.5 tabular-nums"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-surface border border-edge text-[10px] font-mono font-semibold text-text-faint uppercase pointer-events-none">
                        cm
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2 rounded-xl bg-surface-subtle/70 border border-edge flex items-center justify-between text-[11px]">
                  <span className="text-text-faint font-medium">{t("randomizer.configuredRange")}</span>
                  <span className="text-text-main font-mono font-semibold">
                    {parsedMinCm.toFixed(1)} cm {t("randomizer.rangeTo")} {parsedMaxCm.toFixed(1)} cm
                    {parsedBaseSens > 0 && parsedMinCm > 0 && parsedMaxCm > 0 && (
                      <span className="text-text-faint font-normal ml-1.5">
                        ({(parsedBaseSens / parsedMaxCm).toFixed(2)}x {t("randomizer.rangeTo")} {(parsedBaseSens / parsedMinCm).toFixed(2)}x)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="minMultInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5">
                      {t("randomizer.min")} {t("randomizer.multSuffix")}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="minMultInput"
                        type="text"
                        inputMode="decimal"
                        value={minMultStr}
                        onChange={(e) => {
                          const val = e.target.value.replace(",", ".");
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setMinMultStr(val);
                          }
                        }}
                        onBlur={() => {
                          if (!minMultStr.trim() || isNaN(parseFloat(minMultStr))) {
                            setMinMultStr(String(settings.minMult || 0.75));
                          }
                        }}
                        className="minimal-input text-xs font-mono font-medium pl-3.5 pr-10 py-2.5 tabular-nums"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-surface border border-edge text-[10px] font-mono font-bold text-text-faint pointer-events-none">
                        x
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="maxMultInput" className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5">
                      {t("randomizer.max")} {t("randomizer.multSuffix")}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="maxMultInput"
                        type="text"
                        inputMode="decimal"
                        value={maxMultStr}
                        onChange={(e) => {
                          const val = e.target.value.replace(",", ".");
                          if (val === "" || /^\d*\.?\d*$/.test(val)) {
                            setMaxMultStr(val);
                          }
                        }}
                        onBlur={() => {
                          if (!maxMultStr.trim() || isNaN(parseFloat(maxMultStr))) {
                            setMaxMultStr(String(settings.maxMult || 1.35));
                          }
                        }}
                        className="minimal-input text-xs font-mono font-medium pl-3.5 pr-10 py-2.5 tabular-nums"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-surface border border-edge text-[10px] font-mono font-bold text-text-faint pointer-events-none">
                        x
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2 rounded-xl bg-surface-subtle/70 border border-edge flex items-center justify-between text-[11px]">
                  <span className="text-text-faint font-medium">{t("randomizer.configuredRange")}</span>
                  <span className="text-text-main font-mono font-semibold">
                    {parsedMinMult.toFixed(2)}x {t("randomizer.rangeTo")} {parsedMaxMult.toFixed(2)}x
                    {parsedBaseSens > 0 && parsedMinMult > 0 && parsedMaxMult > 0 && (
                      <span className="text-text-faint font-normal ml-1.5">
                        ({(parsedBaseSens / parsedMaxMult).toFixed(1)} cm {t("randomizer.rangeTo")} {(parsedBaseSens / parsedMinMult).toFixed(1)} cm)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Avoid Repeats */}
            <label
              htmlFor="avoidRepeatsCheck"
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                avoidRepeats
                  ? "bg-surface-subtle border-edge-strong"
                  : "bg-surface-subtle/40 border-edge hover:bg-surface-subtle/70"
              }`}
            >
              <input
                id="avoidRepeatsCheck"
                type="checkbox"
                checked={avoidRepeats}
                onChange={(e) => setAvoidRepeats(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-edge-strong bg-surface text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-text-main block">
                  {t("randomizer.avoidRepeats")}
                </span>
                <span className="text-[11px] text-text-faint block mt-0.5 leading-relaxed">
                  {t("randomizer.avoidRepeatsHelp")}
                </span>
              </div>
            </label>

            {/* Save Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleSave}
                className="w-full py-2.5 px-4 minimal-btn text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                <span>{t("randomizer.saveSettings")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Driver Telemetry & Live Status */}
        <div className="lg:col-span-6 space-y-6">
          <div className="panel p-6 rounded-2xl space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-main border-b border-edge pb-3">
              {t("randomizer.telemetryTitle")}
            </h3>

            {/* Big Active Sens KPI Card */}
            <div className="p-5 rounded-xl bg-surface-subtle border border-edge flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-text-faint font-medium">
                  {t("randomizer.activeSens")}
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-mono font-bold text-text-main">
                    {randomizerState.activeSensCm.toFixed(2)}
                  </span>
                  <span className="text-sm font-mono text-text-secondary">cm/360</span>
                </div>
              </div>

              <div className="text-right sm:border-l sm:border-edge sm:pl-6">
                <span className="text-xs uppercase tracking-wider text-text-faint font-medium">
                  {t("randomizer.activeMult")}
                </span>
                <div className="flex items-baseline gap-2 mt-1 justify-end">
                  <span className="text-2xl font-mono font-bold text-blue-400">
                    {randomizerState.activeMult.toFixed(2)}x
                  </span>
                  <span
                    className={`text-xs font-mono font-semibold ${
                      deltaFromBasePercent > 0
                        ? "text-emerald-400"
                        : deltaFromBasePercent < 0
                        ? "text-amber-400"
                        : "text-text-faint"
                    }`}
                  >
                    ({deltaFromBasePercent >= 0 ? "+" : ""}
                    {deltaFromBasePercent.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* RawAccel Integration Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">{t("randomizer.rawaccelPath")}</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${
                    rawaccelAvailable
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-rose-500/10 text-rose-400"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      rawaccelAvailable ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                    }`}
                  />
                  {rawaccelAvailable ? t("randomizer.ready") : t("randomizer.notReady")}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={settings.rawaccelDir || t("randomizer.noPathDetected")}
                  className="flex-1 minimal-input text-xs font-mono text-text-secondary truncate bg-surface-subtle"
                />
                <button
                  type="button"
                  onClick={detectPath}
                  className="px-3.5 py-2 minimal-btn-secondary text-xs font-semibold rounded-full shrink-0"
                  title={t("randomizer.detectPathTooltip")}
                >
                  {t("randomizer.detectPath")}
                </button>
                <button
                  type="button"
                  onClick={() => testWriter()}
                  disabled={testing || !rawaccelAvailable}
                  className="px-3.5 py-2 minimal-btn-secondary text-xs font-semibold rounded-full shrink-0 disabled:opacity-40 disabled:pointer-events-none"
                  title={t("randomizer.testDriverTooltip")}
                >
                  {testing ? "..." : t("randomizer.testWriter")}
                </button>
              </div>

              {randomizerState.errorMessage && (
                <p className="text-[11px] text-rose-400 mt-1">
                  {randomizerState.errorMessage}
                </p>
              )}
            </div>

            {/* Last Run Info */}
            <div className="pt-2 border-t border-edge text-xs flex items-center justify-between text-text-secondary">
              <span className="text-text-faint">{t("randomizer.lastRun")}:</span>
              <span className="font-mono text-text-main truncate max-w-[280px]">
                {randomizerState.lastRunScenario
                  ? `${randomizerState.lastRunScenario} (${randomizerState.lastRunScore?.toFixed(1)} pts)`
                  : t("randomizer.waitingRun")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Optimal Sensitivity (Sweet Spot) Analysis Card */}
      <div className="panel p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-edge pb-3.5">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-main">
              {t("randomizer.sweetSpotTitle")}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {t("randomizer.sweetSpotSubtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setScopeAllTasks(false)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                !scopeAllTasks
                  ? "bg-surface-subtle text-text-main font-semibold border border-edge"
                  : "text-text-faint hover:text-text-secondary"
              }`}
            >
              {t("randomizer.scopeCurrent")} ({activeTask?.name.slice(0, 14) || t("randomizer.scopeNone")}...)
            </button>
            <button
              type="button"
              onClick={() => setScopeAllTasks(true)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                scopeAllTasks
                  ? "bg-surface-subtle text-text-main font-semibold border border-edge"
                  : "text-text-faint hover:text-text-secondary"
              }`}
            >
              {t("randomizer.scopeAll")}
            </button>
          </div>
        </div>

        <div className="text-[11px] text-blue-400 bg-blue-500/10 px-3.5 py-2.5 rounded-xl border border-blue-500/20 flex items-start sm:items-center gap-2.5">
          <svg
            className="w-4 h-4 shrink-0 text-blue-400 mt-0.5 sm:mt-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className="leading-relaxed">
            {scopeAllTasks && (
              <span className="font-medium mr-1.5">{t("randomizer.normExplanation")}</span>
            )}
            <span className="text-text-secondary">
              {t("randomizer.sampleSizeExplanation", { n: analysis?.minEligibleRuns || 3 })}
            </span>
          </div>
        </div>

        {analysis && analysis.bestBucket ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Card 1: Best Performance Band */}
            <div className="p-4 rounded-xl bg-surface-subtle border border-edge flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-faint">
                    {t("randomizer.sweetSpotBest")}
                  </span>
                  {analysis.bestBucket.confidenceLevel === "high" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                      {t("randomizer.confidenceHigh")}
                    </span>
                  )}
                  {analysis.bestBucket.confidenceLevel === "medium" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                      {t("randomizer.confidenceMedium")}
                    </span>
                  )}
                  {(analysis.bestBucket.confidenceLevel === "low" || analysis.bestBucket.confidenceLevel === "insufficient") && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                      {t("randomizer.confidenceLow")}
                    </span>
                  )}
                </div>
                <div className="text-xl font-mono font-bold text-amber-400 mt-1.5">
                  {analysis.bestBucket.rangeLabel}
                </div>
              </div>
              <div className="text-[11px] text-text-faint mt-2.5 space-y-0.5">
                <p>
                  {analysis.bestBucket.count === 1
                    ? t("randomizer.basedOnOneRun")
                    : t("randomizer.basedOnRuns", { n: analysis.bestBucket.count })}
                </p>
                {analysis.minEligibleRuns > 1 && (
                  <p className="text-[10px] text-text-secondary">
                    {t("randomizer.filterActiveRuns", { n: analysis.minEligibleRuns })}
                  </p>
                )}
              </div>
            </div>

            {/* Card 2: Average Score */}
            <div className="p-4 rounded-xl bg-surface-subtle border border-edge flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-text-faint">
                  {t("randomizer.sweetSpotAvg")}
                </span>
                <div className="text-xl font-mono font-bold text-text-main mt-1.5">
                  {analysis.bestBucket.avgScore.toFixed(1)}{" "}
                  <span className="text-xs font-normal text-text-secondary">
                    {scopeAllTasks ? "% do PB" : "pts"}
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-text-faint mt-2.5 space-y-0.5">
                <p>
                  {t("randomizer.peakInBand", {
                    score: analysis.bestBucket.maxScore.toFixed(1),
                    unit: scopeAllTasks ? (t("randomizer.chartTooltipOfPb")) : "pts",
                  })}
                </p>
                <p className="text-[10px] text-text-secondary">
                  {t("randomizer.bayesianScore", {
                    score: analysis.bestBucket.weightedScore.toFixed(1),
                    unit: scopeAllTasks ? "%" : "pts",
                  })}
                </p>
              </div>
            </div>

            {/* Card 3: Consistency */}
            <div className="p-4 rounded-xl bg-surface-subtle border border-edge flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-text-faint">
                  {t("randomizer.sweetSpotConsistency")}
                </span>
                <div className="text-xl font-mono font-bold text-emerald-400 mt-1.5">
                  {analysis.bestBucket.consistency !== null ? (
                    `${analysis.bestBucket.consistency.toFixed(1)}%`
                  ) : (
                    <span className="text-text-faint font-normal text-base">N/D</span>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-text-faint mt-2.5">
                {analysis.bestBucket.consistency !== null ? (
                  analysis.bestBucket.stdDev !== null && (
                    <p>
                      {t("randomizer.stdDevSample", {
                        std: analysis.bestBucket.stdDev.toFixed(1),
                        unit: scopeAllTasks ? "%" : "pts",
                      })}
                    </p>
                  )
                ) : (
                  <p className="text-amber-400/90 text-[10px] leading-relaxed">
                    {t("randomizer.sampleSingleDispersion")}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-text-faint">
            {t("randomizer.sweetSpotEmpty")}
          </div>
        )}
      </div>

      {/* Row 3: Scatter Plot Chart (Sensibility vs Score) */}
      <div className="panel p-6 rounded-2xl space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-main">
            {t("randomizer.chartTitle")}
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            {t("randomizer.chartSubtitle")}
          </p>
        </div>

        <div className="h-72 w-full">
          {relevantSessions.length > 0 ? (
            <Scatter data={chartData as any} options={chartOptions} />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-text-faint">
              {t("randomizer.chartEmpty")}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Recent Runs History Table */}
      <div className="panel p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-main border-b border-edge pb-3">
          {t("randomizer.historyTitle")}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-edge text-text-faint uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">{t("randomizer.colDate")}</th>
                <th className="py-2.5 px-3">{t("randomizer.colScenario")}</th>
                <th className="py-2.5 px-3">{t("randomizer.colSens")}</th>
                <th className="py-2.5 px-3">{t("randomizer.colDelta")}</th>
                <th className="py-2.5 px-3">
                  {scopeAllTasks ? t("randomizer.colScoreNorm") : t("randomizer.colScore")}
                </th>
                <th className="py-2.5 px-3">{t("randomizer.colThreshold")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {recentRuns.length > 0 ? (
                recentRuns.map((r, i) => {
                  const delta = settings.baseSensCm > 0
                    ? ((r.sens - settings.baseSensCm) / settings.baseSensCm) * 100
                    : 0;
                  return (
                    <tr key={i} className="hover:bg-surface-subtle transition-colors">
                      <td className="py-2.5 px-3 text-text-faint font-mono">{r.date}</td>
                      <td className="py-2.5 px-3 text-text-main font-medium truncate max-w-[200px]">
                        {r.scenario}
                      </td>
                      <td className="py-2.5 px-3 text-text-main font-mono font-semibold">
                        {r.sens.toFixed(1)} cm
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        <span
                          className={
                            delta > 0
                              ? "text-emerald-400"
                              : delta < 0
                              ? "text-amber-400"
                              : "text-text-faint"
                          }
                        >
                          {delta >= 0 ? "+" : ""}
                          {delta.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-blue-400 font-mono font-bold">
                        {scopeAllTasks ? (
                          <span>
                            {r.normScore.toFixed(1)}%{" "}
                            <span className="text-[10px] text-text-faint font-normal">
                              ({r.rawScore.toFixed(0)} pts)
                            </span>
                          </span>
                        ) : (
                          r.rawScore.toFixed(1)
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-text-secondary font-mono">
                        {r.threshold > 0 ? r.threshold.toFixed(1) : "-"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-text-faint">
                    {t("randomizer.historyEmpty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
