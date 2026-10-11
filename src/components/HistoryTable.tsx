import { useState } from "react";
import { ClockCounterClockwise, Copy, Trash, Check, X, Plus } from "@phosphor-icons/react";
import type { Task } from "@/lib/types";
import { buildEscalateFormat } from "@/lib/threshold";
import { useI18n } from "@/lib/i18n";
import { formatSensitivity } from "@/lib/sens-analytics";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";

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
  onDeleteSession: (sessionId: string) => void;
  onCopyEscalate: () => void;
  onNewSession?: () => void;
}

export function HistoryTable({
  activeTask,
  onDeleteSession,
  onCopyEscalate,
  onNewSession,
}: HistoryTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const sessions = activeTask
    ? [...activeTask.sessions].sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const maxPB = sessions.length > 0 ? Math.max(...sessions.map((s) => s.pb)) : null;
  const { t } = useI18n();

  return (
    <div className="p-3.5 sm:p-5 rounded-xl bg-surface border border-edge shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center">
            <ClockCounterClockwise size={13} weight="bold" />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-main font-mono">
              {t("hist.title")}
            </h2>
            <p className="text-[10px] text-text-faint font-mono">
              {t("hist.count", { n: sessions.length })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onNewSession && (
            <Tooltip content={t("session.title")}>
              <Button
                variant="secondary"
                size="sm"
                onClick={onNewSession}
                className="h-7.5 px-2.5 text-xs rounded-md font-mono"
                icon={<Plus size={12} weight="bold" />}
              >
                {t("session.title")}
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t("hist.copy")}>
            <Button
              variant="secondary"
              size="sm"
              onClick={onCopyEscalate}
              disabled={!activeTask?.sessions.length}
              className="h-7.5 px-2.5 text-xs rounded-md font-mono"
              icon={<Copy size={12} weight="bold" />}
            >
              {t("hist.copy")}
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <Table className="min-w-[480px]">
          <TableHeader>
            <TableRow className="border-b border-edge hover:bg-transparent">
              <TableHead className="text-text-faint font-mono text-[11px] uppercase tracking-wider whitespace-nowrap">{t("hist.colDate")}</TableHead>
              <TableHead className="text-text-faint font-mono text-[11px] uppercase tracking-wider whitespace-nowrap">{t("hist.colSens")}</TableHead>
              <TableHead className="text-text-faint font-mono text-[11px] uppercase tracking-wider whitespace-nowrap">{t("hist.colScore")}</TableHead>
              <TableHead className="text-text-faint font-mono text-[11px] uppercase tracking-wider whitespace-nowrap">{t("hist.colThreshold")}</TableHead>
              <TableHead className="text-right text-text-faint font-mono text-[11px] uppercase tracking-wider whitespace-nowrap">{t("hist.colAction")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-text-faint text-xs font-mono"
                >
                  {t("hist.empty")}
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => {
                const [, m, d] = session.date.split("-");
                const delta = session.pb - session.threshold;
                const isTargetBeat = delta >= 0;

                return (
                  <TableRow
                    key={session.id}
                    className="group border-b border-edge hover:bg-surface-hover/50 transition-colors duration-150"
                  >
                    <TableCell className="text-text-secondary tabular-nums font-mono text-xs font-medium">
                      {d}/{m}
                    </TableCell>
                    <TableCell className="text-text-faint tabular-nums font-mono text-xs">
                      {formatSensitivity(session.sens)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-text-main text-xs sm:text-sm">
                          {session.pb}
                        </span>
                        {maxPB !== null && session.pb === maxPB && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-soft text-amber border border-amber-edge">
                            {t("hist.pbBadge")}
                          </span>
                        )}
                        <Tooltip
                          content={
                            isTargetBeat
                              ? t("hist.aboveThreshold", { n: delta })
                              : t("hist.belowThreshold", { n: Math.abs(delta) })
                          }
                        >
                          <Badge
                            variant={isTargetBeat ? "emerald" : "neutral"}
                            size="sm"
                            className="font-mono text-[10px]"
                          >
                            {delta > 0 ? `+${delta}` : delta === 0 ? "= 0" : `${delta}`}
                          </Badge>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold font-mono tabular-nums text-score text-xs">
                      {session.threshold}
                    </TableCell>
                    <TableCell className="text-right">
                      {confirmDeleteId === session.id ? (
                        <div className="inline-flex items-center gap-1.5 animate-fadeIn">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteSession(session.id);
                              setConfirmDeleteId(null);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-red text-white hover:opacity-90 transition-opacity cursor-pointer"
                          >
                            <Check size={11} weight="bold" />
                            <span>{t("hist.confirm")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded text-text-faint hover:text-text-main transition-colors cursor-pointer"
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
                            onClick={() => setConfirmDeleteId(session.id)}
                            aria-label={t("hist.delete")}
                            className="text-text-faint hover:text-red hover:bg-red-soft transition-colors opacity-70 group-hover:opacity-100"
                          >
                            <Trash size={13} weight="regular" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function copyEscalateToClipboard(task: Task | null): boolean {
  if (!task) return false;
  const text = buildEscalateFormat(task);
  if (!text) return false;
  void navigator.clipboard.writeText(text);
  return true;
}
