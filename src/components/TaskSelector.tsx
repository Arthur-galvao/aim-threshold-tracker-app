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
    <section className="panel p-5 transition-colors">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-edge">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-main">
          {t("task.active")}
        </h2>
        <button
          onClick={onNewTask}
          className="px-2.5 py-1 minimal-btn text-xs font-medium"
        >
          {t("task.new")}
        </button>
      </div>

      <div className="space-y-2">
        <select
          id="taskSelect"
          value={activeTaskId ?? ""}
          onChange={(e) => onTaskChange(e.target.value)}
          className="minimal-input font-medium"
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

      {activeTask && (
        <div className="mt-3 p-3 bg-surface-subtle rounded-lg border border-edge text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 bg-surface text-text-secondary border border-edge rounded font-mono text-[10px] uppercase">
                {activeTask.category}
              </span>
              <span className="px-2 py-0.5 bg-surface text-text-secondary border border-edge rounded font-mono text-[10px] uppercase">
                {activeTask.subcategory}
              </span>
            </div>
            <span className="text-[11px] text-text-faint font-mono">
              {t("task.sens")}{" "}
              <strong className="text-text-main">
                {recSens ? `${recSens}cm` : "—"}
              </strong>
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-edge flex justify-between items-center text-xs text-text-faint">
        <span className="font-mono text-[11px]">
          {t("task.count", { n: tasks.length })}
        </span>
        {activeTask && (
          <button
            onClick={onDeleteTask}
            className="text-text-faint hover:text-red transition-colors text-xs"
          >
            {t("task.delete")}
          </button>
        )}
      </div>
    </section>
  );
}
