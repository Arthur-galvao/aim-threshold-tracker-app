import type { Task } from "@/lib/types";
import { getRecommendedSens } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";

interface TaskSelectorProps {
  tasks: Task[];
  activeTaskId: string | null;
  onTaskChange: (id: string) => void;
  onNewTask: () => void;
  onDeleteTask: () => void;
}

export function TaskSelector({
  tasks,
  activeTaskId,
  onTaskChange,
  onNewTask,
  onDeleteTask,
}: TaskSelectorProps) {
  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;
  const recSens = activeTask
    ? getRecommendedSens(activeTask.category, activeTask.subcategory)
    : null;
  const { t } = useI18n();

  return (
    <section className="panel p-5 rounded-2xl transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
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
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-main">
            {t("task.active")}
          </h2>
        </div>
        <button
          onClick={onNewTask}
          className="minimal-btn-secondary px-3 py-1.5 text-xs font-medium gap-1.5 text-text-secondary hover:text-text-main border-edge rounded-full"
        >
          <span className="w-3.5 h-3.5 rounded-full bg-surface-hover text-text-secondary flex items-center justify-center text-xs font-bold leading-none">
            +
          </span>
          <span>{t("task.new").replace("+ ", "")}</span>
        </button>
      </div>

      {/* Task Dropdown */}
      <div className="space-y-3">
        <div className="relative">
          <select
            id="taskSelect"
            value={activeTaskId ?? ""}
            onChange={(e) => onTaskChange(e.target.value)}
            className="minimal-input font-medium cursor-pointer"
          >
            {tasks.length === 0 ? (
              <option value="">{t("task.none")}</option>
            ) : (
              tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name} · {task.category}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Task Meta Chips (Clean Minimalist) */}
        {activeTask && (
          <div className="p-3 bg-surface-subtle rounded-xl border border-edge text-xs transition-all">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 bg-surface text-text-secondary border border-edge rounded-full text-[11px] font-medium tracking-normal">
                  {activeTask.category}
                </span>
                <span className="px-2.5 py-0.5 bg-surface text-text-secondary border border-edge rounded-full text-[11px] font-medium tracking-normal">
                  {activeTask.subcategory}
                </span>
              </div>
              <span className="text-[11px] text-text-faint ml-auto flex items-center gap-1.5">
                <span>{t("task.sens")}</span>
                <strong className="px-2 py-0.5 rounded-full bg-surface border border-edge text-text-main text-xs tabular-nums font-semibold">
                  {recSens ? `${recSens}cm` : "Padrão"}
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3.5 flex justify-between items-center text-xs text-text-faint">
        <span className="text-[11px] opacity-80">
          {t("task.count", { n: tasks.length })}
        </span>
        {activeTask && (
          <button
            onClick={onDeleteTask}
            className="text-text-faint hover:text-red transition-colors text-xs flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-red-500/10"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>{t("task.delete")}</span>
          </button>
        )}
      </div>
    </section>
  );
}
