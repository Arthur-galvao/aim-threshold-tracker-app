import type { Task } from "@/lib/types";
import { buildEscalateFormat } from "@/lib/threshold";
import { useI18n } from "@/lib/i18n";

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
  const sessions = activeTask
    ? [...activeTask.sessions].sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const { t } = useI18n();

  return (
    <section className="panel p-5 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-edge">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-main">
            {t("hist.title")}
          </h2>
          <p className="text-[11px] text-text-faint">
            {t("hist.count", { n: sessions.length })}
          </p>
        </div>
        <button
          onClick={onCopyEscalate}
          disabled={!activeTask?.sessions.length}
          className="px-3 py-1.5 minimal-btn-secondary text-[11px] font-mono disabled:opacity-40"
        >
          {t("hist.copy")}
        </button>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="text-text-faint border-b border-edge font-mono text-[11px]">
              <th className="py-2.5 pr-4 font-normal">{t("hist.colDate")}</th>
              <th className="py-2.5 pr-4 font-normal">{t("hist.colSens")}</th>
              <th className="py-2.5 pr-4 font-normal">{t("hist.colScore")}</th>
              <th className="py-2.5 pr-4 font-normal">{t("hist.colThreshold")}</th>
              <th className="py-2.5 text-right font-normal">{t("hist.colAction")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge font-mono">
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-text-faint font-sans text-xs">
                  {t("hist.empty")}
                </td>
              </tr>
            ) : (
              sessions.map((session) => {
                const [, m, d] = session.date.split("-");
                return (
                  <tr
                    key={session.id}
                    className="hover:bg-surface-hover transition-colors"
                  >
                    <td className="py-2.5 pr-4 text-text-secondary">
                      {d}/{m}
                    </td>
                    <td className="py-2.5 pr-4 text-text-faint">
                      {session.sens}cm
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-text-main">
                      {session.pb}
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-amber">
                      {session.threshold}
                    </td>
                    <td className="py-2.5 text-right font-sans">
                      <button
                        onClick={() => onDeleteSession(session.id)}
                        className="text-text-faint hover:text-red transition-colors text-xs px-1"
                        title={t("hist.delete")}
                      >
                        ✕
                      </button>
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
