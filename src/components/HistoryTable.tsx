import { useState } from "react";
import { ClockCounterClockwise, Copy, Trash, Check, X, Plus } from "@phosphor-icons/react";
import type { Task } from "@/lib/types";
import { buildEscalateFormat } from "@/lib/threshold";
import { useI18n } from "@/lib/i18n";
import { formatSensitivity } from "@/lib/sens-analytics";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";

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
  const { t } = useI18n();

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-[#12141e]/60">
      <div className="flex items-center justify-between gap-3 mb-4">
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

        <div className="flex items-center gap-2">
          {onNewSession && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onNewSession}
              className="h-7.5 px-2.5 text-xs rounded-md font-mono"
              icon={<Plus size={12} weight="bold" />}
            >
              {t("session.title")}
            </Button>
          )}
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
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-edge hover:bg-transparent">
              <TableHead className="text-text-faint font-mono text-[11px] uppercase tracking-wider">{t("hist.colDate")}</TableHead>
              <TableHead className="text-text-faint font-mono text-[11px] uppercase tracking-wider">{t("hist.colSens")}</TableHead>
              <TableHead className="text-text-faint font-mono text-[11px] uppercase tracking-wider">{t("hist.colScore")}</TableHead>
              <TableHead className="text-text-faint font-mono text-[11px] uppercase tracking-wider">{t("hist.colThreshold")}</TableHead>
              <TableHead className="text-right text-text-faint font-mono text-[11px] uppercase tracking-wider">{t("hist.colAction")}</TableHead>
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
                    className="group border-b border-edge hover:bg-surface-hover/30 transition-colors"
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
                        <Badge
                          variant={isTargetBeat ? "emerald" : "neutral"}
                          size="sm"
                          className="font-mono text-[10px]"
                        >
                          {delta > 0 ? `+${delta}` : delta === 0 ? "= 0" : `${delta}`}
                        </Badge>
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
                        <IconButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(session.id)}
                          aria-label={t("hist.delete")}
                          className="text-text-faint hover:text-red hover:bg-red-soft transition-colors opacity-70 group-hover:opacity-100"
                        >
                          <Trash size={13} weight="regular" />
                        </IconButton>
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
