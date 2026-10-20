import { useMemo, useState, useCallback, useRef } from "react";
import type { DaySummary } from "@/lib/day-summary";
import { ChartTooltip } from "./ChartTooltip";
import { useI18n } from "@/lib/i18n";

export interface ChartCanvasProps {
  data: (DaySummary & { ma3: number })[];
  showThreshold: boolean;
  showPB: boolean;
  showMA3: boolean;
}

export function ChartCanvas({
  data,
  showThreshold,
  showPB,
  showMA3,
}: ChartCanvasProps) {
  const { t } = useI18n();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const width = 800;
  const height = 280;
  const padLeft = 52;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 38;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const { minVal, maxVal, yTicks } = useMemo(() => {
    if (data.length === 0) return { minVal: 0, maxVal: 100, yTicks: [0, 50, 100] };

    const values: number[] = [];
    data.forEach((d) => {
      if (showPB) values.push(d.best);
      if (showThreshold) values.push(d.threshold);
      if (showMA3) values.push(d.ma3);
    });

    if (values.length === 0) values.push(0, 100);

    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const range = rawMax - rawMin || 20;

    const min = Math.max(0, Math.floor(rawMin - range * 0.12));
    const max = Math.ceil(rawMax + range * 0.12);

    const step = (max - min) / 4;
    const ticks = [min, min + step, min + step * 2, min + step * 3, max].map((v) =>
      Math.round(v)
    );

    return { minVal: min, maxVal: max, yTicks: ticks };
  }, [data, showPB, showThreshold, showMA3]);

  const getY = useCallback(
    (val: number) => {
      const range = maxVal - minVal || 1;
      const normalized = (val - minVal) / range;
      return padTop + chartH - normalized * chartH;
    },
    [maxVal, minVal, chartH]
  );

  const getX = useCallback(
    (idx: number) => {
      if (data.length <= 1) return padLeft + chartW / 2;
      return padLeft + (idx / (data.length - 1)) * chartW;
    },
    [data.length, chartW]
  );

  const stepThresholdPath = useMemo(() => {
    if (!showThreshold || data.length === 0) return "";
    let d = "";
    data.forEach((item, idx) => {
      const x = getX(idx);
      const y = getY(item.threshold);
      if (idx === 0) {
        d += `M ${x},${y}`;
      } else {
        const prevY = getY(data[idx - 1].threshold);
        d += ` L ${x},${prevY} L ${x},${y}`;
      }
    });
    return d;
  }, [data, showThreshold, getX, getY]);

  const pbLinePath = useMemo(() => {
    if (!showPB || data.length === 0) return "";
    return data
      .map((item, idx) => {
        const x = getX(idx);
        const y = getY(item.best);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data, showPB, getX, getY]);

  const ma3LinePath = useMemo(() => {
    if (!showMA3 || data.length === 0) return "";
    return data
      .map((item, idx) => {
        const x = getX(idx);
        const y = getY(item.ma3);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data, showMA3, getX, getY]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (data.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;

    if (data.length === 1) {
      setHoveredIdx(0);
      return;
    }

    const relX = Math.max(0, Math.min(chartW, mouseX - padLeft));
    const rawIdx = (relX / chartW) * (data.length - 1);
    setHoveredIdx(Math.round(rawIdx));
  };

  const hoveredItem = hoveredIdx !== null && data[hoveredIdx] ? data[hoveredIdx] : null;

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
        aria-label={t("chart.title")}
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

        {showThreshold && stepThresholdPath && (
          <path
            d={stepThresholdPath}
            fill="none"
            stroke="var(--emerald)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {showMA3 && ma3LinePath && (
          <path
            d={ma3LinePath}
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.75"
          />
        )}

        {showPB && pbLinePath && (
          <path
            d={pbLinePath}
            fill="none"
            stroke="var(--score)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {showPB &&
          data.map((item, idx) => {
            const x = getX(idx);
            const y = getY(item.best);
            const isPb = item.isPbDay;
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r={isPb ? 4.5 : 3}
                fill={isPb ? "var(--amber)" : "var(--score)"}
                stroke="var(--base)"
                strokeWidth="1.5"
              />
            );
          })}

        {data.map((item, idx) => {
          const showLabel =
            data.length <= 10 ||
            idx === 0 ||
            idx === data.length - 1 ||
            idx % Math.ceil(data.length / 7) === 0;
          if (!showLabel) return null;
          const x = getX(idx);
          const [, m, day] = item.date.split("-");
          return (
            <text
              key={idx}
              x={x}
              y={height - 10}
              textAnchor="middle"
              className="font-mono tabular fill-text-faint text-[10px]"
            >
              {`${day}/${m}`}
            </text>
          );
        })}

        {hoveredIdx !== null && hoveredItem && (
          <g>
            <line
              x1={getX(hoveredIdx)}
              y1={padTop}
              x2={getX(hoveredIdx)}
              y2={height - padBottom}
              stroke="var(--edge-strong)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {showPB && (
              <circle
                cx={getX(hoveredIdx)}
                cy={getY(hoveredItem.best)}
                r="6"
                fill="var(--score)"
                stroke="var(--base)"
                strokeWidth="2"
              />
            )}
            {showThreshold && (
              <circle
                cx={getX(hoveredIdx)}
                cy={getY(hoveredItem.threshold)}
                r="5"
                fill="var(--emerald)"
                stroke="var(--base)"
                strokeWidth="2"
              />
            )}
          </g>
        )}
      </svg>

      {hoveredIdx !== null && hoveredItem && (
        <ChartTooltip
          item={hoveredItem}
          xPos={getX(hoveredIdx)}
          totalWidth={width}
        />
      )}
    </div>
  );
}
