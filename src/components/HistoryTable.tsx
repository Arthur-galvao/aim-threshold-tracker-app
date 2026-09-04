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
    <section className="panel p-5 rounded-2xl transition-all duration-200">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center">
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-main">
              {t("hist.title")}
            </h2>
            <p className="text-[11px] text-text-faint">
              {t("hist.count", { n: sessions.length })}
            </p>
          </div>
        </div>
        <button
          onClick={onCopyEscalate}
          disabled={!activeTask?.sessions.length}
          className="minimal-btn-secondary px-3.5 py-1.5 text-xs font-medium gap-1.5 text-text-secondary hover:text-text-main border-edge rounded-full disabled:opacity-40 disabled:pointer-events-none"
        >
          <span className="w-3.5 h-3.5 rounded-full bg-surface-hover text-text-secondary flex items-center justify-center">
            <svg
              className="w-2.5 h-2.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </span>
          <span>{t("hist.copy")}</span>
        </button>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="text-text-faint/70 text-[11px] border-b border-edge">
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
                <td colSpan={5} className="py-10 text-center text-text-faint text-xs">
                  {t("hist.empty")}
                </td>
              </tr>
            ) : (
              sessions.map((session) => {
                const [, m, d] = session.date.split("-");
                return (
                  <tr
                    key={session.id}
                    className="hover:bg-surface-hover/50 transition-colors group"
                  >
                    <td className="py-3 pr-4 text-text-secondary tabular-nums font-medium">
                      {d}/{m}
                    </td>
                    <td className="py-3 pr-4 text-text-faint tabular-nums">
                      {session.sens}cm
                    </td>
                    <td className="py-3 pr-4 font-bold tabular-nums text-text-main transition-colors">
                      {session.pb}
                    </td>
                    <td className="py-3 pr-4 font-bold tabular-nums text-amber">
                      {session.threshold}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onDeleteSession(session.id)}
                        className="text-text-faint hover:text-red transition-colors text-xs p-1.5 rounded-full hover:bg-red-500/10"
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
