import { useState, useMemo } from "react";
import {
  ClockCounterClockwise,
  Copy,
  Trash,
  Check,
  X,
  Plus,
  CaretDown,
} from "@phosphor-icons/react";
import type { Task, Session } from "@/lib/types";
import { summarizeDays, type DaySummary } from "@/lib/day-summary";
import { buildEscalateFormat } from "@/lib/threshold";
import { useI18n } from "@/lib/i18n";
import { formatSensitivity } from "@/lib/sens-analytics";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

interface HistoryTableProps {
  activeTask: Task | null;
  mouseDpi?: number;
  onDeleteSession: (sessionId: string) => void;
  onCopyEscalate: () => void;
  onNewSession?: () => void;
}

function formatDayDate(dateStr: string, lang: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dayStr = String(d).padStart(2, "0");
  const monthStr = String(m).padStart(2, "0");
  const yearStr = String(y);
  const weekday = dateObj.toLocaleDateString(
    lang === "pt" ? "pt-BR" : "en-US",
    { weekday: "short" }
  );
  return { formatted: `${dayStr}/${monthStr}/${yearStr}`, weekday };
}

export function HistoryTable({
  activeTask,
  mouseDpi,
  onDeleteSession,
  onCopyEscalate,
  onNewSession,
}: HistoryTableProps) {
  const dpi = mouseDpi || 800;
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pageLimit, setPageLimit] = useState(14);
  const { t, lang } = useI18n();

  const summaries = useMemo(() => summarizeDays(activeTask), [activeTask]);
  const reversedSummaries = useMemo(
    () => [...summaries].reverse(),
    [summaries]
  );
  const visibleSummaries = reversedSummaries.slice(0, pageLimit);
  const totalRuns = activeTask?.sessions?.length ?? 0;

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl liquid-glass-panel shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-score-soft text-score border border-score/30 flex items-center justify-center shadow-xs">
            <ClockCounterClockwise size={14} weight="bold" />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-main font-mono">
              {t("hist.title")}
            </h2>
            <p className="text-[10px] text-text-faint font-mono tabular-nums">
              {t("hist.totalDaysRuns", {
                days: summaries.length,
                runs: totalRuns,
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onNewSession && (
            <Tooltip content={t("session.title")}>
              <Button
                variant="frosted"
                size="sm"
                onClick={onNewSession}
                className="h-8 px-2.5 text-xs rounded-xl font-mono flex items-center gap-1.5 press"
                icon={<Plus size={13} weight="bold" className="text-score" />}
              >
                {t("session.title")}
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t("hist.copy")}>
            <Button
              variant="frosted"
              size="sm"
              onClick={onCopyEscalate}
              disabled={!activeTask?.sessions.length}
              className="h-8 px-2.5 text-xs rounded-xl font-mono flex items-center gap-1.5 press"
              icon={<Copy size={13} weight="bold" />}
            >
              {t("hist.copy")}
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow className="border-b border-edge hover:bg-transparent">
              <TableHead className="w-8 text-text-faint font-mono text-[11px] p-2" />
              <TableHead className="text-text-faint font-mono text-[11px] uppercase tracking-wider whitespace-nowrap">
                {t("hist.colDate")}
              </TableHead>
              <TableHead className="text-text-faint font-mono text-[11px] uppercase tracking-wider whitespace-nowrap">
                {t("hist.colRuns")}
              </TableHead>
              <TableHead className="text-text-faint font-mono text-[11px] uppercase tracking-wider whitespace-nowrap">
                {t("hist.colScore")}
              </TableHead>
              <TableHead className="text-text-faint font-mono text-[11px] uppercase tracking-wider whitespace-nowrap">
                {t("hist.colThreshold")}
              </TableHead>
              <TableHead className="text-text-faint font-mono text-[11px] uppercase tracking-wider whitespace-nowrap">
                {t("hist.colStatus")}
              </TableHead>
              <TableHead className="text-right text-text-faint font-mono text-[11px] uppercase tracking-wider whitespace-nowrap">
                {t("hist.colSens")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleSummaries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-text-faint text-xs font-mono"
                >
                  {t("hist.empty")}
                </TableCell>
              </TableRow>
            ) : (
              visibleSummaries.map((day) => {
                const isExpanded = expandedDays.has(day.date);
                const { formatted, weekday } = formatDayDate(day.date, lang);
                const daySessions = (activeTask?.sessions ?? [])
                  .filter((s) => s.date === day.date)
                  .sort((a, b) => b.pb - a.pb);

                return (
                  <DayGroupRows
                    key={day.date}
                    day={day}
                    formattedDate={formatted}
                    weekday={weekday}
                    isExpanded={isExpanded}
                    daySessions={daySessions}
                    confirmDeleteId={confirmDeleteId}
                    mouseDpi={dpi}
                    onToggle={() => toggleDay(day.date)}
                    onSetConfirmDeleteId={setConfirmDeleteId}
                    onDeleteSession={onDeleteSession}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {reversedSummaries.length > pageLimit && (
        <div className="mt-3.5 flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPageLimit((prev) => prev + 14)}
            className="font-mono text-xs text-text-secondary h-8 px-3"
          >
            {t("hist.showMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

interface DayGroupRowsProps {
  day: DaySummary;
  formattedDate: string;
  weekday: string;
  isExpanded: boolean;
  daySessions: Session[];
  confirmDeleteId: string | null;
  mouseDpi?: number;
  onToggle: () => void;
  onSetConfirmDeleteId: (id: string | null) => void;
  onDeleteSession: (sessionId: string) => void;
}

function DayGroupRows({
  day,
  formattedDate,
  weekday,
  isExpanded,
  daySessions,
  confirmDeleteId,
  mouseDpi,
  onToggle,
  onSetConfirmDeleteId,
  onDeleteSession,
}: DayGroupRowsProps) {
  const { t } = useI18n();
  const rowDpi = mouseDpi || 800;

  return (
    <>
      <TableRow
        onClick={onToggle}
        className={cn(
          "group border-b border-glass-edge hover:bg-glass-bg-elevated/70 transition-all duration-150 cursor-pointer select-none press",
          isExpanded && "bg-glass-bg-elevated/40"
        )}
      >
        <TableCell className="w-8 p-2 text-center">
          <CaretDown
            size={13}
            className={cn(
              "transition-transform duration-200 text-text-faint group-hover:text-text-main",
              isExpanded && "rotate-180 text-score"
            )}
          />
        </TableCell>
        <TableCell className="text-text-secondary tabular-nums font-mono text-xs font-medium">
          <span>{formattedDate}</span>
          <span className="text-[10px] text-text-faint ml-1.5 font-normal uppercase">
            {weekday}
          </span>
        </TableCell>
        <TableCell className="tabular-nums font-mono text-xs">
          <span className="px-2 py-0.5 rounded-full bg-surface-subtle border border-edge text-text-secondary text-[10px]">
            {t("hist.runsCount", { n: day.runs })}
          </span>
        </TableCell>
        <TableCell className="tabular-nums">
          <div className="flex items-center gap-2">
            <span className="font-bold font-mono text-text-main text-xs sm:text-sm">
              {day.best}
            </span>
            {day.isPbDay && (
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-soft text-amber border border-amber-edge">
                {t("hist.pbBadge")}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="font-bold font-mono tabular-nums text-score text-xs">
          {day.threshold}
        </TableCell>
        <TableCell className="font-mono text-xs">
          {day.hit === true ? (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-soft text-emerald border border-emerald-edge">
              {t("hist.hit")}
            </span>
          ) : day.hit === false ? (
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-soft text-red border border-red-edge">
              {t("hist.miss")}
            </span>
          ) : (
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-surface-subtle text-text-faint border border-edge">
              {t("hist.firstDay")}
            </span>
          )}
        </TableCell>
        <TableCell className="text-right text-text-faint tabular-nums font-mono text-xs">
          {day.sens.length > 0
            ? `${day.sens.map((s) => formatSensitivity(s, rowDpi, "")).join(", ")} cm`
            : "—"}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-surface-subtle/25 hover:bg-surface-subtle/25 border-b border-glass-edge">
          <TableCell colSpan={7} className="p-0">
            <div className="py-2.5 px-4 sm:px-8 bg-surface-subtle/20 border-y border-glass-edge space-y-1.5">
              <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-text-faint mb-2">
                Runs ({daySessions.length})
              </div>
              <div className="grid grid-cols-1 divide-y divide-glass-edge">
                {daySessions.map((session, idx) => {
                  const delta = session.pb - day.threshold;
                  return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between py-1.5 text-xs font-mono"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-text-faint text-[10px] w-6 tabular-nums">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-text-main tabular-nums">
                          {session.pb}
                        </span>
                        <Tooltip
                          content={
                            delta >= 0
                              ? t("hist.aboveThreshold", { n: delta })
                              : t("hist.belowThreshold", { n: Math.abs(delta) })
                          }
                        >
                          <Badge
                            variant={delta >= 0 ? "emerald" : "neutral"}
                            size="sm"
                            className="font-mono text-[10px] tabular-nums rounded-full"
                          >
                            {delta > 0
                              ? `+${delta}`
                              : delta === 0
                                ? "= 0"
                                : `${delta}`}
                          </Badge>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-text-faint text-xs tabular-nums">
                          {formatSensitivity(session.sens, rowDpi, "")}cm
                        </span>
                        {confirmDeleteId === session.id ? (
                          <div className="inline-flex items-center gap-1.5 animate-fadeIn">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSession(session.id);
                                onSetConfirmDeleteId(null);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-lg bg-red text-white hover:brightness-110 transition-all cursor-pointer press shadow-xs"
                            >
                              <Check size={11} weight="bold" />
                              <span>{t("hist.confirm")}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetConfirmDeleteId(null);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded-lg text-text-faint hover:text-text-main hover:bg-surface-hover transition-colors cursor-pointer press"
                            >
                              <X size={11} weight="bold" />
                              <span>{t("hist.cancel")}</span>
                            </button>
                          </div>
                        ) : (
                          <Tooltip content={t("hist.delete")}>
                            <IconButton
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetConfirmDeleteId(session.id);
                              }}
                              aria-label={t("hist.delete")}
                              className="text-text-faint hover:text-red hover:bg-red-soft transition-colors opacity-70 hover:opacity-100 h-6 w-6 press rounded-lg"
                            >
                              <Trash size={12} weight="regular" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function copyEscalateToClipboard(task: Task | null): boolean {
  if (!task) return false;
  const text = buildEscalateFormat(task);
  if (!text) return false;
  void navigator.clipboard.writeText(text);
  return true;
}
