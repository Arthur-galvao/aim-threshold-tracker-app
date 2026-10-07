import { useState } from "react";
import { ClockCounterClockwise, Copy, Trash, Check, X } from "@phosphor-icons/react";
import type { Task } from "@/lib/types";
import { buildEscalateFormat } from "@/lib/threshold";
import { useI18n } from "@/lib/i18n";
import { formatSensitivity } from "@/lib/sens-analytics";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";

interface HistoryTableProps {
  activeTask: Task | null;
  onDeleteSession: (sessionId: string) => void;
  onCopyEscalate: () => void;
}

export function HistoryTable({
  activeTask,
  onDeleteSession,
  onCopyEscalate,
}: HistoryTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const sessions = activeTask
    ? [...activeTask.sessions].sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const { t } = useI18n();

  return (
    <section className="panel p-5 rounded-2xl border border-edge transition-all duration-200">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center">
            <ClockCounterClockwise size={15} weight="bold" />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-main">
              {t("hist.title")}
            </h2>
            <p className="text-[11px] text-text-muted">
              {t("hist.count", { n: sessions.length })}
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={onCopyEscalate}
          disabled={!activeTask?.sessions.length}
          icon={<Copy size={13} weight="bold" />}
        >
          {t("hist.copy")}
        </Button>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="text-text-muted text-[11px] border-b border-edge">
              <th className="py-2.5 pr-4 font-semibold uppercase tracking-wider">{t("hist.colDate")}</th>
              <th className="py-2.5 pr-4 font-semibold uppercase tracking-wider">{t("hist.colSens")}</th>
              <th className="py-2.5 pr-4 font-semibold uppercase tracking-wider">{t("hist.colScore")}</th>
              <th className="py-2.5 pr-4 font-semibold uppercase tracking-wider">{t("hist.colThreshold")}</th>
              <th className="py-2.5 text-right font-semibold uppercase tracking-wider">{t("hist.colAction")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-text-muted text-xs">
                  {t("hist.empty")}
                </td>
              </tr>
            ) : (
              sessions.map((session) => {
                const [, m, d] = session.date.split("-");
                const delta = session.pb - session.threshold;
                const isTargetBeat = delta >= 0;

                return (
                  <tr
                    key={session.id}
                    className="hover:bg-surface-hover transition-colors group"
                  >
                    <td className="py-3 pr-4 text-text-secondary tabular-nums font-mono font-medium">
                      {d}/{m}
                    </td>
                    <td className="py-3 pr-4 text-text-muted tabular-nums font-mono">
                      {formatSensitivity(session.sens)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-text-main text-sm">
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
                    </td>
                    <td className="py-3 pr-4 font-bold font-mono tabular-nums text-amber">
                      {session.threshold}
                    </td>
                    <td className="py-3 text-right">
                      {confirmDeleteId === session.id ? (
                        <div className="inline-flex items-center gap-1.5 animate-fadeIn">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteSession(session.id);
                              setConfirmDeleteId(null);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-red text-white hover:bg-red-hover transition-colors"
                          >
                            <Check size={11} weight="bold" />
                            <span>{t("hist.confirm")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded text-text-muted hover:text-text-main transition-colors"
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
                          className="text-text-faint hover:text-red hover:bg-red-500/10 transition-colors opacity-70 group-hover:opacity-100"
                        >
                          <Trash size={14} weight="regular" />
                        </IconButton>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function copyEscalateToClipboard(task: Task | null): boolean {
  if (!task) return false;
  const text = buildEscalateFormat(task);
  if (!text) return false;
  void navigator.clipboard.writeText(text);
  return true;
}
