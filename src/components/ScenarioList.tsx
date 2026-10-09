import { useState, useMemo } from "react";
import {
  MagnifyingGlass,
  X,
  Checks,
  Plus,
  ArrowsClockwise,
  CaretDown,
  Play,
  Stop,
  Trash,
} from "@phosphor-icons/react";
import type { Playlist, Task } from "@/lib/types";
import { VISCOSE_CATEGORIES, getDisplaySens } from "@/lib/viscose";
import { valorantToCm360, type RunDataPoint } from "@/lib/sens-analytics";
import { useI18n } from "@/lib/i18n";

interface ScenarioListProps {
  tasks: Task[];
  activeTaskId: string | null;
  onTaskChange: (id: string) => void;
  onNewTask: () => void;
  onDeleteTask: () => void;
  onAddToPlaylist?: (taskIds: string[]) => void;
  playlists?: Playlist[];
  onStartPlaylist?: (playlist: Playlist) => void;
  onStopPlaylist?: () => void;
  runningPlaylistId?: string | null;
  runningStepIndex?: number;
  onJumpToStep?: (stepIndex: number) => void;
  onOpenPlaylistManager?: () => void;
  onSyncGames?: () => Promise<void>;
}

export function ScenarioList({
  tasks,
  activeTaskId,
  onTaskChange,
  onNewTask,
  onDeleteTask,
  onAddToPlaylist,
  playlists = [],
  onStartPlaylist,
  onStopPlaylist,
  runningPlaylistId,
  runningStepIndex,
  onJumpToStep,
  onOpenPlaylistManager,
  onSyncGames,
}: ScenarioListProps) {
  const { t } = useI18n();
  const [sidebarTab, setSidebarTab] = useState<"scenarios" | "playlists">("scenarios");
  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [expandedPlaylistIds, setExpandedPlaylistIds] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);

  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const toggleSelectTask = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const categorySensMap = useMemo(() => {
    const runsMap = new Map<string, RunDataPoint[]>();
    for (const t of tasks) {
      const key = `${t.category}__${t.subcategory}`;
      let r = runsMap.get(key);
      if (!r) {
        r = [];
        runsMap.set(key, r);
      }
      for (const s of t.sessions) {
        const sensCm = valorantToCm360(s.sens);
        if (sensCm >= 5 && s.pb > 0) {
          r.push({ sens: Number(sensCm.toFixed(1)), score: s.pb, date: s.date });
        }
      }
    }
    const result = new Map<string, { value: number; source: "predicted" | "viscose" }>();
    for (const [key, runs] of runsMap.entries()) {
      const [category, subcategory] = key.split("__");
      result.set(key, getDisplaySens(category, subcategory, runs));
    }
    return result;
  }, [tasks]);

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const toggleExpandPlaylist = (id: string) => {
    setExpandedPlaylistIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSyncKovaak = async () => {
    if (!onSyncGames || isSyncing) return;
    setIsSyncing(true);
    try {
      await onSyncGames();
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredPlaylists = useMemo(() => {
    if (!playlists) return [];
    const query = search.trim().toLowerCase();
    if (!query) return playlists;
    return playlists.filter((p) => {
      if (p.name.toLowerCase().includes(query)) return true;
      return p.items.some((item) => {
        const task = taskMap.get(item.taskId);
        return task && task.name.toLowerCase().includes(query);
      });
    });
  }, [playlists, search, taskMap]);

  const handleSelectAll = (filteredTasks: Task[]) => {
    const allFilteredIds = filteredTasks.map((t) => t.id);
    const allSelected = allFilteredIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allFilteredIds.forEach((id) => next.delete(id));
      } else {
        allFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleAddSelected = () => {
    if (onAddToPlaylist && selectedIds.size > 0) {
      onAddToPlaylist(Array.from(selectedIds));
      setSelectedIds(new Set());
      setSelectMode(false);
    }
  };

  // Filter tasks by search query
  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter(
      (task) =>
        task.name.toLowerCase().includes(query) ||
        task.category.toLowerCase().includes(query) ||
        task.subcategory.toLowerCase().includes(query)
    );
  }, [tasks, search]);

  // Group filtered tasks by Category -> Subcategory
  const groupedTasks = useMemo(() => {
    const knownCategories = Object.keys(VISCOSE_CATEGORIES);
    const categorySet = new Set(knownCategories);
    tasks.forEach((t) => categorySet.add(t.category));

    const result: Array<{
      category: string;
      subcategories: Array<{
        subcategory: string;
        tasks: Task[];
      }>;
      totalCount: number;
    }> = [];

    categorySet.forEach((category) => {
      const tasksInCat = filteredTasks.filter((t) => t.category === category);
      if (tasksInCat.length === 0) return;

      const subcatOrder = VISCOSE_CATEGORIES[category] ?? [];
      const subcatSet = new Set(subcatOrder);
      tasksInCat.forEach((t) => subcatSet.add(t.subcategory));

      const subcategories: Array<{ subcategory: string; tasks: Task[] }> = [];

      subcatSet.forEach((subcategory) => {
        const subTasks = tasksInCat.filter((t) => t.subcategory === subcategory);
        if (subTasks.length > 0) {
          subcategories.push({
            subcategory,
            tasks: subTasks,
          });
        }
      });

      result.push({
        category,
        subcategories,
        totalCount: tasksInCat.length,
      });
    });

    return result;
  }, [filteredTasks, tasks]);

  const getTaskPb = (task: Task): number | null => {
    if (task.sessions.length === 0) return null;
    return Math.max(...task.sessions.map((s) => s.pb));
  };

  return (
    <section className="panel p-5 rounded-[10px] border border-edge transition-all duration-200 flex flex-col">
      {/* Segmented Tab Switcher Header */}
      <div className="grid grid-cols-2 p-1 rounded-lg bg-surface-subtle border border-edge mb-3">
        <button
          type="button"
          onClick={() => setSidebarTab("scenarios")}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-mono font-semibold transition-all ${
            sidebarTab === "scenarios"
              ? "bg-surface text-text-main shadow-xs border border-edge"
              : "text-text-faint hover:text-text-secondary"
          }`}
        >
          <span>{t("scenarioList.title")}</span>
          <span className="text-[9px] px-1.5 rounded-sm bg-surface-hover text-text-secondary font-mono">
            {tasks.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSidebarTab("playlists")}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-mono font-semibold transition-all ${
            sidebarTab === "playlists"
              ? "bg-surface text-text-main shadow-xs border border-edge"
              : "text-text-faint hover:text-text-secondary"
          }`}
        >
          <span>{t("tab.playlist")}</span>
          <span className="text-[9px] px-1.5 rounded-sm bg-surface-hover text-text-secondary font-mono">
            {playlists.length}
          </span>
        </button>
      </div>

      {/* Search Input & Action Buttons */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              sidebarTab === "playlists"
                ? t("playlist.searchPlaceholder")
                : t("scenarioList.search")
            }
            className="minimal-input text-[11px] font-mono py-2 pl-8 pr-8 w-full uppercase placeholder:text-text-faint"
          />
          <MagnifyingGlass
            size={14}
            weight="bold"
            className="text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-0.5 rounded-full"
            >
              <X size={13} weight="bold" />
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {sidebarTab === "scenarios" ? (
            <>
              {onAddToPlaylist && tasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectMode(!selectMode);
                    if (selectMode) setSelectedIds(new Set());
                  }}
                  title={selectMode ? t("scenarioList.cancelSelect") : t("scenarioList.selectMode")}
                  className={`p-2 text-[10px] font-mono font-bold rounded-lg border transition-all shrink-0 ${
                    selectMode
                      ? "bg-score text-white border-score shadow-sm"
                      : "bg-surface text-text-secondary hover:text-text-main border-edge"
                  }`}
                >
                  <Checks size={14} weight="bold" />
                </button>
              )}

              <button
                type="button"
                onClick={onNewTask}
                className="bg-surface px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest gap-1.5 text-text-secondary hover:text-text-main border border-edge rounded-lg shrink-0 inline-flex items-center"
              >
                <Plus size={13} weight="bold" />
                <span>{t("task.new").replace("+ ", "")}</span>
              </button>
            </>
          ) : (
            <>
              {onSyncGames && (
                <button
                  type="button"
                  onClick={handleSyncKovaak}
                  disabled={isSyncing}
                  title={t("playlist.syncGames")}
                  className="bg-surface p-2 rounded-lg text-text-secondary hover:text-text-main border border-edge disabled:opacity-50 shrink-0 inline-flex items-center"
                >
                  <ArrowsClockwise size={14} weight="bold" className={isSyncing ? "animate-spin" : ""} />
                </button>
              )}
              {onOpenPlaylistManager && (
                <button
                  type="button"
                  onClick={onOpenPlaylistManager}
                  className="bg-surface px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest gap-1.5 text-text-secondary hover:text-text-main border border-edge rounded-lg shrink-0 inline-flex items-center"
                >
                  <Plus size={13} weight="bold" />
                  <span>PLAYLIST</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Selection Summary (when in select mode) */}
      {selectMode && (
        <div className="flex items-center justify-between text-[10px] font-mono font-bold px-3 py-1.5 mb-2 bg-score/10 border border-score/20 rounded-lg text-score">
          <span>{t("scenarioList.selectedCount", { n: selectedIds.size })}</span>
          <button
            onClick={() => handleSelectAll(filteredTasks)}
            className="hover:underline text-[9px] uppercase tracking-widest"
          >
            {filteredTasks.every((t) => selectedIds.has(t.id))
              ? t("scenarioList.collapseAll")
              : t("scenarioList.expandAll")}
          </button>
        </div>
      )}

      {/* Scrollable Scenario or Playlist List */}
      <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-surface-hover scrollbar-track-transparent">
        {sidebarTab === "scenarios" ? (
          tasks.length === 0 ? (
            <div className="py-8 text-center text-[10px] font-mono uppercase tracking-widest text-text-faint border border-dashed border-edge rounded-lg">
              {t("task.none")}
            </div>
          ) : groupedTasks.length === 0 ? (
            <div className="py-8 text-center text-[10px] font-mono uppercase tracking-widest text-text-faint border border-dashed border-edge rounded-lg">
              {t("scenarioList.noResults")}
            </div>
          ) : (
            groupedTasks.map(({ category, subcategories, totalCount }) => {
              const isCollapsed = collapsedCategories.has(category);
              return (
                <div key={category} className="space-y-1 mb-3 border-b border-edge pb-2">
                  {/* Category Header */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="w-full px-2 py-1 flex items-center justify-between text-left cursor-pointer select-none text-[11px] font-mono uppercase tracking-wider text-text-faint hover:text-text-main transition-colors"
                  >
                    <span>{category}</span>
                    <span className="text-[10px] text-text-muted">{totalCount}</span>
                  </button>

                  {/* Subcategories & Items */}
                  {!isCollapsed && (
                    <div className="px-1 space-y-1">
                      {subcategories.map(({ subcategory, tasks: subTasks }) => (
                        <div key={subcategory} className="space-y-0.5">
                          {subTasks.map((task) => {
                            const isSelected = selectedIds.has(task.id);
                            const isActive = task.id === activeTaskId;

                            return (
                              <div
                                key={task.id}
                                onClick={() => {
                                  if (selectMode) {
                                    toggleSelectTask(task.id);
                                  } else {
                                    onTaskChange(task.id);
                                  }
                                }}
                                className={`group px-2 py-1.5 rounded-md text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                  isActive && !selectMode
                                    ? "bg-surface-subtle text-text-main font-medium shadow-xs"
                                    : isSelected && selectMode
                                    ? "bg-score-soft text-text-main"
                                    : "text-text-secondary hover:text-text-main hover:bg-surface-hover/60"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  {selectMode && (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectTask(task.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="rounded-sm border-edge text-score focus:ring-0 cursor-pointer"
                                    />
                                  )}
                                  <span className="truncate">{task.name}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })

          )
        ) : (
          /* Playlists Tab View */
          playlists.length === 0 ? (
            <div className="py-8 text-center text-[10px] font-mono uppercase tracking-widest text-text-faint border border-dashed border-edge rounded-lg space-y-3 px-3">
              <p>{t("playlist.emptySidebar")}</p>
              {onSyncGames && (
                <button
                  type="button"
                  onClick={handleSyncKovaak}
                  disabled={isSyncing}
                  className="bg-surface px-3 py-1.5 text-text-secondary hover:text-text-main border border-edge rounded-md mx-auto inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <ArrowsClockwise className={isSyncing ? "animate-spin" : ""} size={14} />
                  <span>{isSyncing ? "SYNCING..." : "SYNC KOVAAK"}</span>
                </button>
              )}
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="py-8 text-center text-[10px] font-mono uppercase tracking-widest text-text-faint border border-dashed border-edge rounded-lg">
              {t("scenarioList.noResults")}
            </div>
          ) : (
            filteredPlaylists.map((pl) => {
              const isExpanded = expandedPlaylistIds.has(pl.id);
              const isRunningThis = runningPlaylistId === pl.id;

              return (
                <div
                  key={pl.id}
                  className={`border rounded-lg transition-all overflow-hidden ${
                    isRunningThis
                      ? "border-score/40 bg-score/5 shadow-xs"
                      : "border-edge bg-surface"
                  }`}
                >
                  {/* Playlist Header Row */}
                  <div
                    onClick={() => toggleExpandPlaylist(pl.id)}
                    className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-surface-hover transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <CaretDown
                        size={12}
                        weight="bold"
                        className={`text-text-muted transition-transform duration-150 shrink-0 ${
                          isExpanded ? "rotate-0" : "-rotate-90"
                        }`}
                      />
                      <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-text-main truncate" title={pl.name}>
                        {pl.name}
                      </span>
                      <span className="text-[9px] px-1.5 rounded-sm bg-surface-subtle border border-edge text-text-muted font-mono font-bold shrink-0">
                        {pl.items.length}
                      </span>
                    </div>

                    {/* Direct Play / Stop Button */}
                    {onStartPlaylist && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isRunningThis && onStopPlaylist) {
                            onStopPlaylist();
                          } else {
                            onStartPlaylist(pl);
                          }
                        }}
                        title={isRunningThis ? t("runner.exit") : t("playlist.start")}
                        className={`px-2 py-0.5 rounded-sm text-[9px] uppercase tracking-widest font-mono font-bold transition-all flex items-center gap-1 shrink-0 ${
                          isRunningThis
                            ? "bg-red/10 hover:bg-red/20 text-red border border-red/30"
                            : "bg-score/10 hover:bg-score/20 text-score border border-score/30"
                        }`}
                      >
                        {isRunningThis ? (
                          <>
                            <Stop size={10} weight="bold" />
                            <span>STOP</span>
                          </>
                        ) : (
                          <>
                            <Play size={10} weight="bold" />
                            <span>PLAY</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expanded Scenario Items */}
                  {isExpanded && (
                    <div className="px-2 pb-2 space-y-1">
                      {pl.items.length === 0 ? (
                        <div className="text-[10px] font-mono uppercase tracking-widest text-text-faint text-center py-2">
                          {t("playlist.emptyList")}
                        </div>
                      ) : (
                        pl.items.map((item, idx) => {
                          const task = taskMap.get(item.taskId);
                          const isStepActive = isRunningThis && runningStepIndex === idx;
                          const isActive = task && task.id === activeTaskId;
                          const displaySensInfo = task
                            ? categorySensMap.get(`${task.category}__${task.subcategory}`) ??
                              getDisplaySens(task.category, task.subcategory)
                            : null;
                          const pb = task ? getTaskPb(task) : null;
                          const targetLabel =
                            item.targetMode === "time"
                              ? `${item.targetValue}s`
                              : `${item.targetValue}x`;

                          return (
                            <div
                              key={`${pl.id}-${item.taskId}-${idx}`}
                              onClick={() => {
                                if (isRunningThis && onJumpToStep) {
                                  onJumpToStep(idx);
                                } else if (task) {
                                  onTaskChange(task.id);
                                }
                              }}
                              className={`group px-2 py-1.5 rounded-md border text-[10px] font-mono cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                isActive || isStepActive
                                  ? "bg-score/10 border-score/40 text-text-main font-bold shadow-sm"
                                  : "bg-surface-subtle border-edge hover:border-edge-strong text-text-secondary hover:text-text-main font-semibold"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div
                                  className={`w-1.5 h-1.5 rounded-sm shrink-0 ${
                                    isActive || isStepActive
                                      ? "bg-score"
                                      : "bg-transparent group-hover:bg-text-faint"
                                  }`}
                                />
                                <span className="truncate">
                                  {task ? task.name : `Cenário (${item.taskId.slice(0, 6)})`}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {displaySensInfo && (
                                  <span
                                    title={
                                      displaySensInfo.source === "predicted"
                                        ? t("categorySens.sourcePredicted")
                                        : t("categorySens.sourceViscose")
                                    }
                                    className={`px-1 rounded-sm border ${
                                      displaySensInfo.source === "predicted"
                                        ? "bg-emerald/10 border-emerald/20 text-emerald"
                                        : "bg-surface border-edge text-text-faint"
                                    }`}
                                  >
                                    {displaySensInfo.value}cm
                                  </span>
                                )}
                                {pb !== null && (
                                  <span className="px-1 rounded-sm bg-surface border border-edge text-text-secondary">
                                    {pb}
                                  </span>
                                )}
                                <span className="text-text-faint opacity-80">
                                  {targetLabel}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )
        )}
      </div>

      {/* Bottom Action: Add Selected to Playlist (Scenarios tab only) */}
      {sidebarTab === "scenarios" && selectMode && selectedIds.size > 0 && (
        <div className="mt-3 pt-3 border-t border-edge">
          <button
            onClick={handleAddSelected}
            className="w-full bg-score hover:bg-score/90 text-surface font-mono font-bold uppercase tracking-widest py-2 px-3 rounded-lg text-[10px] flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Plus size={12} weight="bold" />
            <span>
              {t("scenarioList.addSelectedToPlaylist", {
                n: selectedIds.size,
              })}
            </span>
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3.5 pt-2.5 border-t border-edge flex justify-between items-center text-[10px] font-mono font-bold uppercase tracking-widest text-text-faint">
        <span className="opacity-80">
          {sidebarTab === "scenarios"
            ? t("task.count", { n: tasks.length })
            : `${filteredPlaylists.length} PLAYLISTS`}
        </span>

        {sidebarTab === "scenarios" && activeTask && !selectMode && (
          <button
            onClick={onDeleteTask}
            className="text-text-muted hover:text-red transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-red/10"
          >
            <Trash size={12} weight="bold" />
            <span>DELETE</span>
          </button>
        )}

        {sidebarTab === "playlists" && onOpenPlaylistManager && (
          <button
            type="button"
            onClick={onOpenPlaylistManager}
            className="text-text-faint hover:text-text-main transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-surface-hover"
          >
            <span>MANAGE</span>
          </button>
        )}
      </div>
    </section>
  );
}

