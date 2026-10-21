import type { ChartOptions } from "chart.js";
import {
  type RunDataPoint,
  type SensPrediction,
  binByLattice,
  fitQuadraticLog,
} from "@/lib/sens-analytics";
import { latticeIndex } from "@/lib/sens-lattice";

function getThemePalette() {
  if (typeof document === "undefined") {
    return {
      score: "#5ec5ff",
      scoreFill: "rgba(94, 197, 255, 0.26)",
      emerald: "#4adea8",
      amber: "#fbbf5a",
      red: "#ff6b81",
      textSecondary: "#a9b4c6",
      textFaint: "#7a8699",
    };
  }
  const style = getComputedStyle(document.documentElement);
  const score = style.getPropertyValue("--score").trim() || "#5ec5ff";
  const scoreFill = style.getPropertyValue("--score-soft").trim() || "rgba(94, 197, 255, 0.24)";
  const emerald = style.getPropertyValue("--emerald").trim() || "#4adea8";
  const amber = style.getPropertyValue("--amber").trim() || "#fbbf5a";
  const red = style.getPropertyValue("--red").trim() || "#ff6b81";
  const textSecondary = style.getPropertyValue("--text-secondary").trim() || "#a9b4c6";
  const textFaint = style.getPropertyValue("--text-faint").trim() || "#7a8699";
  return { score, scoreFill, emerald, amber, red, textSecondary, textFaint };
}

export interface BuildDatasetsParams {
  validRuns: RunDataPoint[];
  isNormalized: boolean;
  activeMinCm?: number;
  activeMaxCm?: number;
  effectivePrediction?: SensPrediction | null;
  labels: {
    normPb: string;
    rawScore: string;
    chartKernel: string;
    chartTrend: string;
    activeRangeMin: string;
    activeRangeMax: string;
    confidenceInterval: string;
    predictorApex: string;
  };
}

export function buildChartDatasets({
  validRuns,
  isNormalized,
  activeMinCm,
  activeMaxCm,
  effectivePrediction,
  labels,
}: BuildDatasetsParams) {
  if (validRuns.length === 0) {
    return { datasets: [] };
  }

  const palette = getThemePalette();

  const scatterPoints = validRuns.map((s) => ({
    x: s.sens,
    y: s.score,
    scenario: s.scenario,
    date: s.date,
    rawScore: s.rawScore ?? s.score,
    normScore: s.normScore ?? 100,
  }));

  const yVals = validRuns.map((s) => s.score);
  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);

  // 1. Curva do kernel suavizada por ponto de grade
  let kernelCurvePoints: Array<{ x: number; y: number }> = [];
  if (validRuns.length >= 3) {
    const points = validRuns.map((r) => ({ k: latticeIndex(r.sens), rel: r.score }));
    const bins = binByLattice(points);
    if (bins.length > 0) {
      kernelCurvePoints = bins
        .map((b) => ({ x: Number(b.cm.toFixed(1)), y: b.smooth }))
        .sort((a, b) => a.x - b.x);
    }
  }

  // 2. Curva quadratica amostrada em u (log-space)
  const quadCurvePoints: Array<{ x: number; y: number }> = [];
  if (validRuns.length >= 12) {
    const pts = validRuns.map((r) => ({ cm: r.sens, y: r.score }));
    const quad = fitQuadraticLog(pts);
    if (quad) {
      const minCm = Math.min(...validRuns.map((r) => r.sens));
      const maxCm = Math.max(...validRuns.map((r) => r.sens));
      if (maxCm > minCm) {
        const lnMin = Math.log(minCm);
        const lnMax = Math.log(maxCm);
        const steps = 30;
        for (let i = 0; i <= steps; i++) {
          const lnVal = lnMin + (i / steps) * (lnMax - lnMin);
          const cm = Math.exp(lnVal);
          const u = Math.log(cm / quad.refCm);
          const y = quad.a * u * u + quad.b * u + quad.c;
          quadCurvePoints.push({ x: Number(cm.toFixed(2)), y });
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const datasets: any[] = [
    {
      type: "scatter" as const,
      label: isNormalized ? labels.normPb : labels.rawScore,
      data: scatterPoints,
      backgroundColor: palette.scoreFill,
      borderColor: palette.score,
      borderWidth: 1.5,
      pointRadius: 4.5,
      pointHoverRadius: 7,
    },
  ];

  if (kernelCurvePoints.length > 0) {
    datasets.push({
      type: "line" as const,
      label: labels.chartKernel,
      data: kernelCurvePoints,
      borderColor: palette.score,
      backgroundColor: "transparent",
      borderWidth: 2.2,
      pointRadius: 0,
      fill: false,
      tension: 0.25,
    });
  }

  if (quadCurvePoints.length > 0) {
    datasets.push({
      type: "line" as const,
      label: labels.chartTrend,
      data: quadCurvePoints,
      borderColor: palette.amber,
      backgroundColor: "transparent",
      borderWidth: 2,
      borderDash: [5, 4],
      pointRadius: 0,
      fill: false,
    });
  }

  if (activeMinCm != null && activeMinCm > 0) {
    datasets.push({
      type: "line" as const,
      label: labels.activeRangeMin,
      data: [
        { x: activeMinCm, y: yMin * 0.95 },
        { x: activeMinCm, y: yMax * 1.05 },
      ],
      borderColor: "rgba(255, 255, 255, 0.25)",
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderDash: [6, 4],
      pointRadius: 0,
      fill: false,
    });
  }

  if (activeMaxCm != null && activeMaxCm > 0) {
    datasets.push({
      type: "line" as const,
      label: labels.activeRangeMax,
      data: [
        { x: activeMaxCm, y: yMin * 0.95 },
        { x: activeMaxCm, y: yMax * 1.05 },
      ],
      borderColor: "rgba(255, 255, 255, 0.25)",
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderDash: [6, 4],
      pointRadius: 0,
      fill: false,
    });
  }

  if (
    effectivePrediction &&
    effectivePrediction.vertexSens != null &&
    effectivePrediction.vertexSens > 0 &&
    effectivePrediction.scoreEstimate != null
  ) {
    const yEst = effectivePrediction.scoreEstimate;
    if (
      effectivePrediction.ci &&
      effectivePrediction.ci.low != null &&
      effectivePrediction.ci.low > 0 &&
      effectivePrediction.ci.high != null &&
      effectivePrediction.ci.high > 0
    ) {
      datasets.push({
        type: "line" as const,
        label: labels.confidenceInterval,
        data: [
          { x: effectivePrediction.ci.low, y: yEst },
          { x: effectivePrediction.ci.high, y: yEst },
        ],
        borderColor: palette.emerald,
        backgroundColor: "transparent",
        borderWidth: 3,
        pointRadius: 3,
        fill: false,
      });
    }

    datasets.push({
      type: "scatter" as const,
      label: labels.predictorApex,
      data: [{ x: effectivePrediction.vertexSens, y: yEst }],
      backgroundColor: palette.red,
      borderColor: palette.red,
      pointRadius: 7,
      pointHoverRadius: 9,
      pointStyle: "rectRot",
    });
  }

  return { datasets };
}

export function buildChartOptions(
  isNormalized: boolean,
  labels: {
    normPb: string;
    rawScore: string;
    chartSensAxis: string;
    chartTooltipOfPb: string;
    chartTooltipAt: string;
    chartTrendLabel: string;
  }
): ChartOptions<"scatter"> {
  const palette = getThemePalette();

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 320 },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: {
          color: palette.textSecondary,
          font: { size: 11, family: "Geist Variable, system-ui, sans-serif" },
          boxWidth: 10,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: "rgba(12, 16, 26, 0.92)",
        titleColor: "#f4f7fb",
        bodyColor: palette.textSecondary,
        borderColor: "rgba(255, 255, 255, 0.14)",
        borderWidth: 1,
        padding: 10,
        cornerRadius: 12,
        displayColors: false,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => {
            const raw = ctx.raw;
            if (raw.scenario) {
              if (isNormalized) {
                return `${raw.scenario}: ${raw.normScore.toFixed(1)}${labels.chartTooltipOfPb} (${raw.rawScore.toFixed(0)} pts) ${labels.chartTooltipAt} ${raw.x.toFixed(1)} cm`;
              }
              return `${raw.scenario}: ${raw.rawScore.toFixed(1)} pts (${raw.normScore.toFixed(1)}${labels.chartTooltipOfPb}) ${labels.chartTooltipAt} ${raw.x.toFixed(1)} cm`;
            }
            return `${ctx.dataset.label || labels.chartTrendLabel}: ${raw.y.toFixed(1)} ${isNormalized ? labels.chartTooltipOfPb : "pts"} (${raw.x.toFixed(1)} cm)`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "logarithmic" as const,
        title: {
          display: true,
          text: labels.chartSensAxis,
          color: palette.textFaint,
          font: { size: 11 },
        },
        grid: { color: "rgba(255, 255, 255, 0.05)" },
        ticks: {
          color: palette.textSecondary,
          font: { family: "Geist Mono Variable, monospace" },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (value: any) => `${Number(value).toFixed(0)}`,
        },
      },
      y: {
        title: {
          display: true,
          text: isNormalized ? labels.normPb : labels.rawScore,
          color: palette.textFaint,
          font: { size: 11 },
        },
        grid: { color: "rgba(255, 255, 255, 0.05)" },
        ticks: {
          color: palette.textSecondary,
          font: { family: "Geist Mono Variable, monospace" },
        },
      },
    },
  };
}
