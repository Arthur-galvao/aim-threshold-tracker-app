import { useState } from "react";
import {
  CaretDown,
  CaretRight,
  ShieldCheck,
  Check,
  X,
  Trash,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import type { Session } from "@/lib/types";
import type { DaySummary } from "@/lib/day-summary";

export interface DayGroupItem extends DaySummary {
  individualSessions: Session[];
}

export interface DayHistoryCardProps {
  day: DayGroupItem;
  isExpanded: boolean;
  onToggle: () => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

export function DayHistoryCard({
  day,
  isExpanded,
  onToggle,
  onDeleteSession,
}: DayHistoryCardProps) {
  const { t, lang } = useI18n();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const formatDayDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayStr = String(d).padStart(2, "0");
    const monthStr = String(m).padStart(2, "0");
    const yearStr = String(y);
    const weekday = dateObj.toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", {
      weekday: "short",
    });
    return { formatted: `${dayStr}/${monthStr}/${yearStr}`, weekday };
  };

  const { formatted, weekday } = formatDayDate(day.date);

  const handleDelete = async (sessionId: string) => {
    await onDeleteSession(sessionId);
    setConfirmDeleteId(null);
  };

  return (
    <div className={`rounded-control overflow-hidden transition-all ${isExpanded ? "liquid-pill" : "liquid-well"}`}>
      {/* Day Summary Row */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-text-faint" aria-hidden="true">
            {isExpanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-xs text-text-main tabular">
                {formatted}
              </span>
              <span className="text-[11px] text-text-faint uppercase font-mono">
                ({weekday})
              </span>
              {day.isPbDay && <Badge variant="amber">{t("hist.pbBadge")}</Badge>}
            </div>
            <span className="text-[11px] font-mono text-text-faint tabular block mt-0.5">
              {t("hist.runsCount", { n: day.runs })} · Sens: {day.sens.join(", ")}cm
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right font-mono">
            <div className="text-xs font-bold text-score tabular">
              {day.best} <span className="text-[10px] text-text-faint font-normal">{t("metric.pts")}</span>
            </div>
            <div className="text-[11px] text-emerald tabular flex items-center justify-end gap-1">
              <ShieldCheck size={12} weight="regular" />
              <span>{day.threshold} pts</span>
            </div>
          </div>

          {day.hit !== null ? (
            <Badge variant={day.hit ? "emerald" : "red"}>
              {day.hit ? t("hist.hit") : t("hist.miss")}
            </Badge>
          ) : (
            <Badge variant="neutral">{t("hist.firstDay")}</Badge>
          )}
        </div>
      </div>

      {/* Expanded Individual Runs */}
      {isExpanded && (
        <div className="liquid-well p-3 space-y-1.5 border-t border-edge">
          <div className="flex items-center justify-between text-[11px] font-mono text-text-faint px-2 pb-1 border-b border-edge">
            <span>{t("chart.tooltipRuns")}</span>
            <span>{t("hist.colAction")}</span>
          </div>

          {day.individualSessions.map((sess, idx) => {
            const isConfirming = confirmDeleteId === sess.id;

            return (
              <div
                key={sess.id}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-[10px] bg-surface-subtle text-xs font-mono hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-text-faint text-[10px] tabular">
                    #{idx + 1}
                  </span>
                  <span className="font-bold text-text-main tabular">
                    {sess.pb} pts
                  </span>
                  {sess.sourceFile && (
                    <span
                      className="text-[10px] text-text-faint truncate max-w-[200px]"
                      title={sess.sourceFile}
                    >
                      {sess.sourceFile}
                    </span>
                  )}
                </div>

                {/* Inline Confirmation for Delete */}
                <div className="shrink-0 flex items-center">
                  {isConfirming ? (
                    <div className="flex items-center gap-1.5 animate-pop-in">
                      <span className="text-[11px] text-red font-sans">
                        {t("dashboard.deleteConfirm")}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(sess.id)}
                        className="px-2 py-0.5 rounded-[8px] bg-red-soft text-red border border-red-edge text-xs font-medium press cursor-pointer"
                        title={t("hist.confirm")}
                      >
                        <Check size={12} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-0.5 rounded-[8px] bg-surface-subtle text-text-faint hover:text-text-main text-xs press cursor-pointer"
                        title={t("hist.cancel")}
                      >
                        <X size={12} weight="bold" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(sess.id)}
                      className="p-1 rounded-control text-text-faint hover:text-red hover:bg-red-soft transition-colors cursor-pointer press"
                      title={t("hist.delete")}
                      aria-label={t("hist.delete")}
                    >
                      <Trash size={14} weight="regular" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
