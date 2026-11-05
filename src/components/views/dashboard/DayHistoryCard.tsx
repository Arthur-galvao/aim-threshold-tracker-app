import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CaretRight,
  ShieldCheck,
  Check,
  X,
  Trash,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import type { TrainingSessionSummary } from "@/lib/day-summary";
import { roundScore } from "@/lib/metric-deltas";
import { formatSensSummary, formatScore } from "@/lib/chart-format";
import { sessionStatus } from "@/lib/simple-summary";
import { useAdvancedStats } from "@/hooks/useAdvancedStats";
import { InfoTip } from "./InfoTip";
import { cn } from "@/lib/utils";

export interface DayHistoryCardProps {
  /** Uma sessão de treino (gap <= 45 min), não um dia. */
  day: TrainingSessionSummary;
  isExpanded: boolean;
  onToggle: () => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

function fmtTime(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function DayHistoryCard({
  day,
  isExpanded,
  onToggle,
  onDeleteSession,
}: DayHistoryCardProps) {
  const { t, lang } = useI18n();
  const advanced = useAdvancedStats();
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
  const hasClock = day.items.some((i) => Boolean(i.session.datetime));
  const timeRange = hasClock
    ? day.startedAt === day.endedAt
      ? fmtTime(day.startedAt)
      : `${fmtTime(day.startedAt)}–${fmtTime(day.endedAt)}`
    : null;

  const status = sessionStatus(day.hit, day.validRuns);
  const sensText = formatSensSummary(day.sens).text;

  const handleDelete = async (sessionId: string) => {
    await onDeleteSession(sessionId);
    setConfirmDeleteId(null);
  };

  return (
    <div
      className={cn(
        "group/card rounded-control overflow-hidden transition-all duration-200",
        isExpanded
          ? "liquid-pill border-glass-edge-strong"
          : "liquid-well hover:border-glass-edge-strong hover:translate-x-0.5"
      )}
    >
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
        className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              "text-text-faint transition-transform duration-200 inline-flex",
              isExpanded
                ? "rotate-90 text-score"
                : "group-hover/card:text-text-main group-hover/card:translate-x-0.5"
            )}
            aria-hidden="true"
          >
            <CaretRight size={14} weight="bold" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-xs text-text-main tabular transition-colors group-hover/card:text-score">
                {formatted}
              </span>
              <span className="text-[11px] text-text-faint uppercase font-mono">
                ({weekday})
              </span>
              {day.isPb && (
                <Badge variant="amber">{advanced ? t("hist.pbBadge") : t("simple.sim.newBest")}</Badge>
              )}
            </div>
            <span className="text-[11px] font-mono text-text-faint tabular block mt-0.5">
              {timeRange ? `${timeRange} · ` : ""}
              {advanced
                ? t("skill.hist.runsValid", { n: day.runs, v: day.validRuns })
                : day.runs === 1
                  ? t("simple.hist.run1")
                  : t("simple.hist.runs", { n: day.runs })}
              {sensText ? ` · ${advanced ? `Sens: ${day.sens.join(", ")}cm` : t("simple.hist.sens", { v: sensText })}` : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right font-mono">
            <div className="text-xs font-bold text-score tabular transition-transform duration-200 group-hover/card:scale-105 origin-right">
              {advanced
                ? day.bestAdjusted !== null
                  ? roundScore(day.bestAdjusted)
                  : day.best
                : formatScore(day.bestAdjusted ?? day.best, lang)}{" "}
              <span className="text-[10px] text-text-faint font-normal">
                {advanced && day.bestAdjusted !== null ? t("skill.hist.adjusted") : t("metric.pts")}
              </span>
            </div>
            <div className="text-[11px] text-emerald tabular flex items-center justify-end gap-1">
              <ShieldCheck size={12} weight="regular" />
              <span>
                {advanced
                  ? day.target !== null
                    ? `${roundScore(day.target)} pts`
                    : "—"
                  : day.target !== null
                    ? t("simple.hist.target", { val: formatScore(day.target, lang) })
                    : t("simple.hist.noTarget")}
              </span>
            </div>
          </div>

          <Badge
            variant={
              status === "hit" ? "emerald" : status === "miss" ? "amber" : "neutral"
            }
            title={status === "warmupOnly" ? t("simple.hist.warmupOnlyTip") : undefined}
          >
            {t(`simple.hist.status.${status}`)}
          </Badge>
        </div>
      </div>

      {/* Expanded Individual Runs with smooth Accordion motion */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="liquid-well p-3 space-y-1.5 border-t border-edge">
              <div className="flex items-center justify-between text-[11px] font-mono text-text-faint px-2 pb-1 border-b border-edge">
                <span>{t("chart.tooltipRuns")}</span>
                <span>{t("hist.colAction")}</span>
              </div>

              {day.items.map(({ session: sess, validity }, idx) => {
                const isConfirming = confirmDeleteId === sess.id;

                return (
                  <div
                    key={sess.id}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-[10px] liquid-pill text-xs font-mono transition-all duration-150 hover:translate-x-0.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-text-faint text-[10px] tabular">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-text-main tabular">
                        {sess.pb} pts
                      </span>
                      {validity.valid ? null : (
                        <span className="flex items-center gap-1 text-[10px] text-amber">
                          {validity.reason ? t(`simple.reason.${validity.reason}`) : t("simple.tip.notCounted")}
                          {validity.reason && (
                            <InfoTip text={t(`simple.reasonDesc.${validity.reason}`)} size={11} />
                          )}
                        </span>
                      )}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
