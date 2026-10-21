import { useMemo, useState } from "react";
import {
  CaretDown,
  MagnifyingGlass,
  Plus,
  TrendDown,
  TrendUp,
  Minus,
} from "@phosphor-icons/react";
import {
  Popover,
  PopoverTrigger,
  PopoverPortal,
  PopoverPositioner,
  PopoverPopup,
} from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ScenarioSwitcherProps {
  tasks: Task[];
  activeTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onNewScenario: () => void;
  className?: string;
}

export function ScenarioSwitcher({
  tasks,
  activeTaskId,
  onSelectTask,
  onNewScenario,
  className,
}: ScenarioSwitcherProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const activeTask = useMemo(
    () => tasks.find((tk) => tk.id === activeTaskId) || tasks[0] || null,
    [tasks, activeTaskId]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((tk) => {
      if (tk.category) set.add(tk.category);
    });
    return ["all", ...Array.from(set)];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesSearch =
        !q ||
        task.name.toLowerCase().includes(q) ||
        (task.category && task.category.toLowerCase().includes(q));
      const matchesCat =
        selectedCategory === "all" || task.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [tasks, search, selectedCategory]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "group liquid-pill flex h-8 items-center gap-2.5 px-3.5 rounded-full text-xs cursor-pointer select-none focus-visible:outline-none press",
              open && "border-glass-edge-strong",
              className
            )}
          />
        }
      >
        <div className="flex items-center gap-2 min-w-0 text-left leading-tight">
          <span className="font-semibold text-text-main max-w-[180px] sm:max-w-[220px] truncate">
            {activeTask ? activeTask.name : t("task.none")}
          </span>
          {activeTask?.category && (
            <span className="hidden lg:inline-block px-2 py-0.5 rounded-full liquid-well text-[10px] font-medium text-text-secondary truncate transition-colors group-hover:text-text-main">
              {activeTask.category}
            </span>
          )}
        </div>
        <CaretDown
          size={13}
          className={cn(
            "text-text-faint shrink-0 transition-transform duration-200 group-hover:text-text-main",
            open && "rotate-180 text-score"
          )}
        />
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverPositioner side="bottom" align="start" sideOffset={10}>
          <PopoverPopup className="liquid-float w-[350px] p-3 shadow-float">
            {/* Search Input */}
            <div className="relative mb-2.5">
              <MagnifyingGlass
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cenários..."
                className="field pl-8 py-1.5 text-xs rounded-full"
                autoFocus
              />
            </div>

            {/* Category Chips */}
            {categories.length > 2 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-2 scroll-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-150 cursor-pointer press",
                      selectedCategory === cat
                        ? "bg-score-soft text-score border border-edge-strong shadow-[0_0_12px_rgb(var(--score-rgb)/0.2)]"
                        : "liquid-well text-text-secondary hover:text-text-main"
                    )}
                  >
                    {cat === "all" ? "Todos" : cat}
                  </button>
                ))}
              </div>
            )}

            {/* Scenario list */}
            <div className="scroll-y max-h-[240px] -mx-1 px-1 flex flex-col gap-1 my-1">
              {filteredTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-text-faint">
                  Nenhum cenário encontrado
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const isCurrent = task.id === activeTask?.id;
                  const pb = task.sessions?.length
                    ? Math.max(...task.sessions.map((s) => s.pb || 0))
                    : null;

                  // Trend: compare last 2 sessions
                  let trend: "up" | "down" | "flat" = "flat";
                  if (task.sessions && task.sessions.length >= 2) {
                    const last = task.sessions[task.sessions.length - 1]?.pb || 0;
                    const prev = task.sessions[task.sessions.length - 2]?.pb || 0;
                    if (last > prev) trend = "up";
                    else if (last < prev) trend = "down";
                  }

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => {
                        onSelectTask(task.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "group flex items-center justify-between p-2 rounded-control text-xs transition-all duration-150 cursor-pointer select-none text-left w-full press",
                        isCurrent
                          ? "liquid-pill text-text-main font-medium border-edge-strong"
                          : "hover:bg-surface-hover hover:translate-x-0.5 text-text-secondary hover:text-text-main"
                      )}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="truncate text-text-main font-medium group-hover:text-score transition-colors">
                          {task.name}
                        </span>
                        {task.category && (
                          <span className="text-[10px] text-text-faint truncate">
                            {task.category}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {pb !== null && (
                          <span className="font-mono tabular text-text-secondary text-[11px]">
                            {pb.toLocaleString()}
                          </span>
                        )}
                        {trend === "up" && (
                          <TrendUp size={13} className="text-emerald shrink-0 transition-transform group-hover:-translate-y-0.5" />
                        )}
                        {trend === "down" && (
                          <TrendDown size={13} className="text-amber shrink-0 transition-transform group-hover:translate-y-0.5" />
                        )}
                        {trend === "flat" && pb !== null && (
                          <Minus size={13} className="text-text-faint shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Create scenario button */}
            <div className="pt-2 mt-1 border-t border-edge">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onNewScenario();
                }}
                className="group w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-control text-xs font-medium text-score hover:bg-score-soft transition cursor-pointer press"
              >
                <Plus size={14} weight="bold" className="transition-transform duration-200 group-hover:rotate-90" />
                <span>{t("task.new")}</span>
              </button>
            </div>
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  );
}
