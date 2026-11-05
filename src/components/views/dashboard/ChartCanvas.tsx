import { useMemo, useState, useCallback, useRef } from "react";
import type { ChartSeries } from "@/lib/day-summary";
import { ChartTooltip } from "./ChartTooltip";
import { useI18n } from "@/lib/i18n";

export interface ChartCanvasProps {
  series: ChartSeries;
  showTarget: boolean;
  showPB: boolean;
  showMu: boolean;
}

export function ChartCanvas({ series, showTarget, showPB, showMu }: ChartCanvasProps) {
  const { t } = useI18n();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { runs, sessions, pbRunning } = series;
  const n = runs.length;

  const width = 800;
  const height = 280;
  const padLeft = 52;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 38;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const { minVal, maxVal, yTicks } = useMemo(() => {
    if (n === 0) return { minVal: 0, maxVal: 100, yTicks: [0, 50, 100] };

    const values: number[] = [];
    for (const r of runs) values.push(r.score);
    for (const s of sessions) {
      if (showTarget && s.target !== null) values.push(s.target);
      if (showMu && Number.isFinite(s.lo) && Number.isFinite(s.hi)) values.push(s.lo, s.hi);
    }
    if (showPB) values.push(pbRunning[pbRunning.length - 1]);

    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const range = rawMax - rawMin || 20;

    const min = Math.max(0, Math.floor(rawMin - range * 0.12));
    const max = Math.ceil(rawMax + range * 0.12);

    const step = (max - min) / 4;
    const ticks = [min, min + step, min + step * 2, min + step * 3, max].map((v) => Math.round(v));
    return { minVal: min, maxVal: max, yTicks: ticks };
  }, [runs, sessions, pbRunning, n, showTarget, showMu, showPB]);

  const getY = useCallback(
    (val: number) => {
      const range = maxVal - minVal || 1;
      return padTop + chartH - ((val - minVal) / range) * chartH;
    },
    [maxVal, minVal, chartH]
  );

  /** Posição X em unidades de "slot" (0..n): cada run ocupa um slot de largura chartW/n. */
  const slotX = useCallback((u: number) => padLeft + (u / Math.max(n, 1)) * chartW, [n, chartW]);
  const runX = useCallback((idx: number) => slotX(idx + 0.5), [slotX]);

  /** Caminho em degraus: um valor por sessão, ocupando os slots da sessão. */
  const stepPath = useCallback(
    (valueOf: (i: number) => number | null) => {
      let d = "";
      let open = false;
      sessions.forEach((s, i) => {
        const v = valueOf(i);
        if (v === null || !Number.isFinite(v)) {
          open = false;
          return;
        }
        const y = getY(v).toFixed(1);
        const x0 = slotX(s.startIdx).toFixed(1);
        const x1 = slotX(s.endIdx + 1).toFixed(1);
        d += open ? ` L ${x0},${y} L ${x1},${y}` : `${d ? " " : ""}M ${x0},${y} L ${x1},${y}`;
        open = true;
      });
      return d;
    },
    [sessions, getY, slotX]
  );

  const targetPath = useMemo(
    () => (showTarget ? stepPath((i) => sessions[i].target) : ""),
    [showTarget, stepPath, sessions]
  );
  const muPath = useMemo(() => (showMu ? stepPath((i) => sessions[i].mu) : ""), [showMu, stepPath, sessions]);

  const pbPath = useMemo(() => {
    if (!showPB || n === 0) return "";
    let d = "";
    for (let i = 0; i < n; i++) {
      const y = getY(pbRunning[i]).toFixed(1);
      const x0 = slotX(i).toFixed(1);
      const x1 = slotX(i + 1).toFixed(1);
      d += i === 0 ? `M ${x0},${y} L ${x1},${y}` : ` L ${x0},${y} L ${x1},${y}`;
    }
    return d;
  }, [showPB, n, pbRunning, getY, slotX]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    const relX = Math.max(0, Math.min(chartW, mouseX - padLeft));
    setHoveredIdx(Math.max(0, Math.min(n - 1, Math.floor((relX / chartW) * n))));
  };

  const hoveredRun = hoveredIdx !== null ? runs[hoveredIdx] ?? null : null;
  const hoveredStep = hoveredRun ? sessions[hoveredRun.sessionIdx] : null;

  const labelEvery = Math.max(1, Math.ceil(sessions.length / 7));

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden select-none liquid-well p-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
        aria-label={t("skill.chart.title")}
      >
        {yTicks.map((val) => {
          const y = getY(val);
          return (
            <g key={val}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="var(--edge)"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <text
                x={padLeft - 10}
                y={y + 3.5}
                textAnchor="end"
                className="font-mono tabular fill-text-faint text-[10px]"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Faixa mu +/- sigma (um retângulo por sessão) */}
        {showMu &&
          sessions.map((s) =>
            Number.isFinite(s.lo) && Number.isFinite(s.hi) ? (
              <rect
                key={s.key}
                x={slotX(s.startIdx)}
                y={getY(s.hi)}
                width={slotX(s.endIdx + 1) - slotX(s.startIdx)}
                height={Math.max(1, getY(s.lo) - getY(s.hi))}
                fill="var(--score)"
                opacity="0.12"
              />
            ) : null
          )}

        {showPB && pbPath && (
          <path
            d={pbPath}
            fill="none"
            stroke="var(--amber)"
            strokeWidth="1.5"
            strokeDasharray="2 4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
        )}

        {showMu && muPath && (
          <path
            d={muPath}
            fill="none"
            stroke="var(--score)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
        )}

        {showTarget && targetPath && (
          <path
            d={targetPath}
            fill="none"
            stroke="var(--emerald)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Runs: válidas cheias, inválidas vazadas */}
        {runs.map((r) => {
          const isHovered = hoveredIdx === r.index;
          const radius = isHovered ? 5.5 : 3.2;
          return (
            <circle
              key={r.id}
              cx={runX(r.index)}
              cy={getY(r.score)}
              r={radius}
              fill={r.valid ? "var(--score)" : "none"}
              stroke={r.valid ? "var(--base)" : "var(--score)"}
              strokeWidth={r.valid ? 1.2 : 1.4}
              style={{
                transition: "r 160ms cubic-bezier(0.16, 1, 0.3, 1), opacity 160ms ease",
                opacity: hoveredIdx !== null && !isHovered ? 0.65 : 1,
              }}
            />
          );
        })}

        {sessions.map((s, i) => {
          if (i % labelEvery !== 0 && i !== sessions.length - 1) return null;
          const d = new Date(s.startedAt);
          const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
          const isHovered = hoveredRun?.sessionIdx === i;
          return (
            <text
              key={s.key}
              x={slotX((s.startIdx + s.endIdx + 1) / 2)}
              y={height - 10}
              textAnchor="middle"
              className={`font-mono tabular text-[10px] transition-colors ${
                isHovered ? "fill-text-main font-semibold" : "fill-text-faint"
              }`}
            >
              {label}
            </text>
          );
        })}

        {hoveredRun && (
          <line
            x1={runX(hoveredRun.index)}
            y1={padTop}
            x2={runX(hoveredRun.index)}
            y2={height - padBottom}
            stroke="var(--edge-strong)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {hoveredRun && hoveredStep && (
        <ChartTooltip
          run={hoveredRun}
          step={hoveredStep}
          xPos={runX(hoveredRun.index)}
          totalWidth={width}
        />
      )}
    </div>
  );
}
