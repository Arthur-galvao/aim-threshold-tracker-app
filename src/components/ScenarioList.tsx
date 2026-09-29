import { useState, useMemo } from "react";
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
  onSyncKovaak?: () => Promise<void>;
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
  onSyncKovaak,
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
    if (!onSyncKovaak || isSyncing) return;
    setIsSyncing(true);
    try {
      await onSyncKovaak();
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
    <section className="panel p-5 rounded-2xl transition-all duration-200 flex flex-col">
      {/* Segmented Tab Switcher Header */}
      <div className="grid grid-cols-2 p-1 rounded-xl bg-surface-subtle border border-edge mb-3">
        <button
          type="button"
          onClick={() => setSidebarTab("scenarios")}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            sidebarTab === "scenarios"
              ? "bg-surface text-text-main shadow-xs border border-edge"
              : "text-text-faint hover:text-text-secondary"
          }`}
        >
          <span>{t("scenarioList.title")}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-hover text-text-secondary font-mono">
            {tasks.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSidebarTab("playlists")}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            sidebarTab === "playlists"
              ? "bg-surface text-text-main shadow-xs border border-edge"
              : "text-text-faint hover:text-text-secondary"
          }`}
        >
          <span>{t("tab.playlist")}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-hover text-text-secondary font-mono">
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
            className="minimal-input text-xs py-2 pl-8 pr-8 w-full"
          />
          <svg
            className="w-3.5 h-3.5 text-text-faint absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-main p-0.5 rounded-full"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
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
                  className={`p-2 text-xs font-medium rounded-xl border transition-all shrink-0 ${
                    selectMode
                      ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                      : "minimal-btn-secondary text-text-secondary hover:text-text-main border-edge"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                onClick={onNewTask}
                className="minimal-btn-secondary px-3 py-2 text-xs font-medium gap-1.5 text-text-secondary hover:text-text-main border-edge rounded-xl shrink-0"
              >
                <span className="w-3.5 h-3.5 rounded-full bg-surface-hover text-text-secondary flex items-center justify-center text-xs font-bold leading-none">
                  +
                </span>
                <span>{t("task.new").replace("+ ", "")}</span>
              </button>
            </>
          ) : (
            <>
              {onSyncKovaak && (
                <button
                  type="button"
                  onClick={handleSyncKovaak}
                  disabled={isSyncing}
                  title={t("playlist.syncKovaak")}
                  className="minimal-btn-secondary p-2 rounded-xl text-text-secondary hover:text-text-main border-edge disabled:opacity-50 shrink-0"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                </button>
              )}
              {onOpenPlaylistManager && (
                <button
                  type="button"
                  onClick={onOpenPlaylistManager}
                  className="minimal-btn-secondary px-3 py-2 text-xs font-medium gap-1.5 text-text-secondary hover:text-text-main border-edge rounded-xl shrink-0"
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-surface-hover text-text-secondary flex items-center justify-center text-xs font-bold leading-none">
                    +
                  </span>
                  <span>Playlist</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Selection Summary (when in select mode) */}
      {selectMode && (
        <div className="flex items-center justify-between text-xs px-3 py-1.5 mb-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
          <span>{t("scenarioList.selectedCount", { n: selectedIds.size })}</span>
          <button
            onClick={() => handleSelectAll(filteredTasks)}
            className="hover:underline text-[11px] font-medium"
          >
            {filteredTasks.every((t) => selectedIds.has(t.id))
              ? t("scenarioList.collapseAll")
              : t("scenarioList.expandAll")}
          </button>
        </div>
      )}

      {/* Scrollable Scenario or Playlist List */}
      <div className="max-h-[420px] overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-surface-hover scrollbar-track-transparent">
        {sidebarTab === "scenarios" ? (
          tasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-faint border border-dashed border-edge rounded-xl">
              {t("task.none")}
            </div>
          ) : groupedTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-faint border border-dashed border-edge rounded-xl">
              {t("scenarioList.noResults")}
            </div>
          ) : (
            groupedTasks.map(({ category, subcategories, totalCount }) => {
              const isCollapsed = collapsedCategories.has(category);
              return (
                <div
                  key={category}
                  className="border border-edge rounded-xl bg-surface-subtle/50 overflow-hidden"
                >
                  {/* Category Header */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-surface-hover/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <svg
                        className={`w-3 h-3 text-text-faint transition-transform duration-150 ${
                          isCollapsed ? "-rotate-90" : "rotate-0"
                        }`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      <span className="text-xs font-semibold text-text-main truncate">
                        {category}
                      </span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface border border-edge text-text-faint font-medium">
                      {totalCount}
                    </span>
                  </button>

                  {/* Subcategories & Items */}
                  {!isCollapsed && (
                    <div className="px-2 pb-2 space-y-2">
                      {subcategories.map(({ subcategory, tasks: subTasks }) => (
                        <div key={subcategory} className="space-y-1">
                          <div className="px-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-text-faint">
                            {subcategory}
                          </div>
                          <div className="space-y-1">
                            {subTasks.map((task) => {
                              const isSelected = selectedIds.has(task.id);
                              const isActive = task.id === activeTaskId;
                              const displaySensInfo =
                                categorySensMap.get(`${task.category}__${task.subcategory}`) ??
                                getDisplaySens(task.category, task.subcategory);
                              const pb = getTaskPb(task);

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
                                  className={`group p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                    isActive && !selectMode
                                      ? "bg-blue-500/10 border-blue-500/40 text-text-main font-medium shadow-sm"
                                      : isSelected && selectMode
                                      ? "bg-blue-500/15 border-blue-500 text-text-main"
                                      : "bg-surface border-edge hover:border-white/20 text-text-secondary hover:text-text-main"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {selectMode ? (
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelectTask(task.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="rounded border-edge text-blue-500 focus:ring-0 cursor-pointer"
                                      />
                                    ) : (
                                      <div
                                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                          isActive ? "bg-blue-500" : "bg-transparent group-hover:bg-text-faint"
                                        }`}
                                      />
                                    )}
                                    <span className="truncate text-xs font-medium">
                                      {task.name}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                                    {displaySensInfo && (
                                      <span
                                        title={
                                          displaySensInfo.source === "predicted"
                                            ? t("categorySens.sourcePredicted")
                                            : t("categorySens.sourceViscose")
                                        }
                                        className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${
                                          displaySensInfo.source === "predicted"
                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-semibold"
                                            : "bg-surface-subtle border-edge text-text-faint"
                                        }`}
                                      >
                                        {displaySensInfo.value}cm
                                      </span>
                                    )}
                                    {pb !== null && (
                                      <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-edge text-text-secondary text-[10px] tabular-nums font-medium">
                                        {pb} pts
                                      </span>
                                    )}
                                    <span className="text-[10px] text-text-faint opacity-80 tabular-nums">
                                      {task.sessions.length} {t("scenarioList.sessions")}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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
            <div className="py-8 text-center text-xs text-text-faint border border-dashed border-edge rounded-xl space-y-3 px-3">
              <p>{t("playlist.emptySidebar")}</p>
              {onSyncKovaak && (
                <button
                  type="button"
                  onClick={handleSyncKovaak}
                  disabled={isSyncing}
                  className="minimal-btn-secondary px-3 py-1.5 text-xs text-text-secondary hover:text-text-main border-edge rounded-lg mx-auto inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  <span>{isSyncing ? t("playlist.syncing") : t("playlist.syncKovaak")}</span>
                </button>
              )}
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-faint border border-dashed border-edge rounded-xl">
              {t("scenarioList.noResults")}
            </div>
          ) : (
            filteredPlaylists.map((pl) => {
              const isExpanded = expandedPlaylistIds.has(pl.id);
              const isRunningThis = runningPlaylistId === pl.id;

              return (
                <div
                  key={pl.id}
                  className={`border rounded-xl transition-all overflow-hidden ${
                    isRunningThis
                      ? "border-blue-500/40 bg-blue-500/5 shadow-xs"
                      : "border-edge bg-surface-subtle/50"
                  }`}
                >
                  {/* Playlist Header Row */}
                  <div
                    onClick={() => toggleExpandPlaylist(pl.id)}
                    className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-surface-hover/50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <svg
                        className={`w-3 h-3 text-text-faint transition-transform duration-150 shrink-0 ${
                          isExpanded ? "rotate-0" : "-rotate-90"
                        }`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      <span className="text-xs font-semibold text-text-main truncate" title={pl.name}>
                        {pl.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface border border-edge text-text-faint font-medium shrink-0">
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
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 shrink-0 ${
                          isRunningThis
                            ? "bg-red-500/10 hover:bg-red-500/20 text-red border border-red-500/30"
                            : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        }`}
                      >
                        {isRunningThis ? (
                          <>
                            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                              <rect x="6" y="6" width="12" height="12" rx="1" />
                            </svg>
                            <span>Parar</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            <span>Play</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expanded Scenario Items - No divider line, matches Category layout */}
                  {isExpanded && (
                    <div className="px-2 pb-2 space-y-1">
                      {pl.items.length === 0 ? (
                        <div className="text-[11px] text-text-faint text-center py-2">
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
                              className={`group p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                isActive || isStepActive
                                  ? "bg-blue-500/10 border-blue-500/40 text-text-main font-medium shadow-sm"
                                  : "bg-surface border-edge hover:border-white/20 text-text-secondary hover:text-text-main"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    isActive || isStepActive
                                      ? "bg-blue-500"
                                      : "bg-transparent group-hover:bg-text-faint"
                                  }`}
                                />
                                <span className="truncate text-xs font-medium">
                                  {task ? task.name : `Cenário (${item.taskId.slice(0, 6)})`}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                                {displaySensInfo && (
                                  <span
                                    title={
                                      displaySensInfo.source === "predicted"
                                        ? t("categorySens.sourcePredicted")
                                        : t("categorySens.sourceViscose")
                                    }
                                    className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${
                                      displaySensInfo.source === "predicted"
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-semibold"
                                        : "bg-surface-subtle border-edge text-text-faint"
                                    }`}
                                  >
                                    {displaySensInfo.value}cm
                                  </span>
                                )}
                                {pb !== null && (
                                  <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-edge text-text-secondary text-[10px] tabular-nums font-medium">
                                    {pb} pts
                                  </span>
                                )}
                                <span className="text-[10px] text-text-faint opacity-80 tabular-nums">
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
            className="w-full minimal-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>
              {t("scenarioList.addSelectedToPlaylist", {
                n: selectedIds.size,
              })}
            </span>
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3.5 pt-2.5 border-t border-edge flex justify-between items-center text-xs text-text-faint">
        <span className="text-[11px] opacity-80">
          {sidebarTab === "scenarios"
            ? t("task.count", { n: tasks.length })
            : `${filteredPlaylists.length} playlist(s)`}
        </span>

        {sidebarTab === "scenarios" && activeTask && !selectMode && (
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

        {sidebarTab === "playlists" && onOpenPlaylistManager && (
          <button
            type="button"
            onClick={onOpenPlaylistManager}
            className="text-text-faint hover:text-text-main transition-colors text-xs flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-surface-hover"
          >
            <span>{t("playlist.manage")}</span>
          </button>
        )}
      </div>
    </section>
  );
}
