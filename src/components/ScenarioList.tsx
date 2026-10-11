import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MagnifyingGlass,
  X,
  Checks,
  Plus,
  ArrowsClockwise,
  CaretDown,
  CaretLeft,
  CaretRight,
  Play,
  Stop,
  Trash,
  List,
} from "@phosphor-icons/react";
import type { Playlist, Task } from "@/lib/types";
import { VISCOSE_CATEGORIES, getDisplaySens, cleanScenarioName } from "@/lib/viscose";
import { valorantToCm360, type RunDataPoint } from "@/lib/sens-analytics";
import { useI18n } from "@/lib/i18n";
import { Tooltip } from "@/components/ui/Tooltip";

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
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
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
  sidebarCollapsed,
  onToggleSidebar,
}: ScenarioListProps) {
  const { t } = useI18n();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = sidebarCollapsed !== undefined ? sidebarCollapsed : internalCollapsed;
  const toggleCollapse = onToggleSidebar ?? (() => setInternalCollapsed((prev) => !prev));

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

  const handleSelectAll = (filteredTasksList: Task[]) => {
    const allFilteredIds = filteredTasksList.map((t) => t.id);
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

  // Render Collapsed Sidebar Rail
  if (isCollapsed) {
    return (
      <aside className="w-14 max-md:hidden shrink-0 h-screen max-h-screen border-r border-edge bg-[#0c0e16]/85 backdrop-blur-md flex flex-col items-center py-3.5 px-1.5 select-none z-20 transition-all duration-200">
        <Tooltip content="Expand sidebar" side="right">
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Expand sidebar"
            className="w-9 h-9 rounded-lg bg-surface hover:bg-surface-hover border border-edge text-text-secondary hover:text-text-main flex items-center justify-center transition-colors cursor-pointer mb-4"
          >
            <CaretRight size={15} weight="bold" />
          </button>
        </Tooltip>

        <div className="flex flex-col items-center gap-2 flex-1">
          <Tooltip content={t("scenarioList.title")} side="right">
            <button
              type="button"
              onClick={() => {
                setSidebarTab("scenarios");
                toggleCollapse();
              }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                sidebarTab === "scenarios"
                  ? "bg-surface-subtle text-text-main border border-edge font-bold shadow-xs"
                  : "text-text-faint hover:text-text-secondary hover:bg-surface-hover/50"
              }`}
            >
              <List size={16} weight="bold" />
            </button>
          </Tooltip>

          <Tooltip content={t("tab.playlist")} side="right">
            <button
              type="button"
              onClick={() => {
                setSidebarTab("playlists");
                toggleCollapse();
              }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                sidebarTab === "playlists"
                  ? "bg-surface-subtle text-text-main border border-edge font-bold shadow-xs"
                  : "text-text-faint hover:text-text-secondary hover:bg-surface-hover/50"
              }`}
            >
              <Play size={14} weight="bold" />
            </button>
          </Tooltip>
        </div>

        <div className="pt-2 border-t border-edge w-full flex justify-center">
          <Tooltip content={t("task.new")} side="right">
            <button
              type="button"
              onClick={onNewTask}
              aria-label="New Task"
              className="w-9 h-9 rounded-lg bg-surface hover:bg-surface-hover border border-edge text-text-secondary hover:text-text-main flex items-center justify-center transition-colors cursor-pointer"
            >
              <Plus size={15} weight="bold" />
            </button>
          </Tooltip>
        </div>
      </aside>
    );
  }

  // Render Full Structured Sidebar
  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
        onClick={toggleCollapse}
        aria-hidden="true"
      />
      <aside className="w-72 sm:w-80 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-2xl md:relative shrink-0 h-screen max-h-screen border-r border-edge bg-[#0c0e16]/95 md:bg-[#0c0e16]/85 backdrop-blur-md flex flex-col p-3 sm:p-4 select-none z-20 transition-all duration-200">
      {/* Top Header Row: Tab Switcher & Collapse Button */}
      <div className="flex items-center gap-2 mb-3">
        <div className="grid grid-cols-2 p-1 rounded-lg bg-surface-subtle border border-edge flex-1">
          <button
            type="button"
            onClick={() => setSidebarTab("scenarios")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-mono font-semibold transition-all cursor-pointer ${
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
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-mono font-semibold transition-all cursor-pointer ${
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

        <Tooltip content="Collapse sidebar" side="left">
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Collapse sidebar"
            className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover border border-edge text-text-faint hover:text-text-main flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <CaretLeft size={14} weight="bold" />
          </button>
        </Tooltip>
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
            className="minimal-input text-[11px] font-mono py-1.5 pl-8 pr-8 w-full uppercase placeholder:text-text-faint"
          />
          <MagnifyingGlass
            size={13}
            weight="bold"
            className="text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-0.5 rounded-full cursor-pointer"
            >
              <X size={12} weight="bold" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
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
                  className={`p-2 text-[10px] font-mono font-bold rounded-lg border transition-all shrink-0 cursor-pointer ${
                    selectMode
                      ? "bg-score text-white border-score shadow-sm"
                      : "bg-surface text-text-secondary hover:text-text-main border border-edge"
                  }`}
                >
                  <Checks size={13} weight="bold" />
                </button>
              )}

              <button
                type="button"
                onClick={onNewTask}
                className="bg-surface px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest gap-1 text-text-secondary hover:text-text-main border border-edge rounded-lg shrink-0 inline-flex items-center cursor-pointer"
              >
                <Plus size={12} weight="bold" />
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
                  className="bg-surface p-2 rounded-lg text-text-secondary hover:text-text-main border border-edge disabled:opacity-50 shrink-0 inline-flex items-center cursor-pointer"
                >
                  <ArrowsClockwise size={13} weight="bold" className={isSyncing ? "animate-spin" : ""} />
                </button>
              )}
              {onOpenPlaylistManager && (
                <button
                  type="button"
                  onClick={onOpenPlaylistManager}
                  className="bg-surface px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest gap-1 text-text-secondary hover:text-text-main border border-edge rounded-lg shrink-0 inline-flex items-center cursor-pointer"
                >
                  <Plus size={12} weight="bold" />
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
            className="hover:underline text-[9px] uppercase tracking-widest cursor-pointer"
          >
            {filteredTasks.every((t) => selectedIds.has(t.id))
              ? t("scenarioList.collapseAll")
              : t("scenarioList.expandAll")}
          </button>
        </div>
      )}

      {/* Middle Scrollable Items Container (Independent full-height scroll) */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 pr-1">
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
              const isCollapsedCategory = collapsedCategories.has(category);
              return (
                <div key={category} className="space-y-1 mb-2 border-b border-edge pb-2">
                  {/* Category Header */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="w-full px-2 py-1 flex items-center justify-between text-left cursor-pointer select-none text-[11px] font-mono uppercase tracking-wider text-text-faint hover:text-text-main transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <CaretDown
                        size={11}
                        weight="bold"
                        className={`transition-transform duration-200 ${
                          isCollapsedCategory ? "-rotate-90 text-text-muted" : "rotate-0 text-text-secondary"
                        }`}
                      />
                      <span>{category}</span>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">{totalCount}</span>
                  </button>

                  {/* Smooth Accordion with AnimatePresence */}
                  <AnimatePresence initial={false}>
                    {!isCollapsedCategory && (
                      <motion.div
                        key={`cat-content-${category}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-1 space-y-1 pt-0.5">
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
                                        if (typeof window !== "undefined" && window.innerWidth < 768) {
                                          toggleCollapse();
                                        }
                                      }
                                    }}
                                    className={`group px-2 py-1.5 rounded-md text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                      isActive && !selectMode
                                        ? "bg-surface-subtle text-text-main font-medium shadow-xs border border-edge"
                                        : isSelected && selectMode
                                        ? "bg-score-soft text-text-main border border-score/30"
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
                                      {isActive && !selectMode && (
                                        <div className="w-1 h-3 rounded-full bg-score shrink-0" />
                                      )}
                                      <span className="truncate" title={cleanScenarioName(task.name)}>
                                        {cleanScenarioName(task.name)}
                                      </span>
                                    </div>
                                    {task.sessions && task.sessions.length > 0 && (
                                      <span className="text-[10px] font-mono tabular-nums text-text-faint px-1.5 py-0.2 rounded bg-surface border border-edge shrink-0">
                                        {Math.max(...task.sessions.map((s) => s.pb))}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                  className="bg-surface px-3 py-1.5 text-text-secondary hover:text-text-main border border-edge rounded-md mx-auto inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <ArrowsClockwise className={isSyncing ? "animate-spin" : ""} size={13} />
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
                  className={`rounded-lg transition-all overflow-hidden mb-2 border ${
                    isRunningThis
                      ? "border-score/35 bg-score/[0.04] shadow-xs relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-score"
                      : "border-edge bg-surface/70 hover:bg-surface hover:border-edge-strong"
                  }`}
                >
                  {/* Playlist Header Row */}
                  <div
                    onClick={() => toggleExpandPlaylist(pl.id)}
                    className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-surface-hover/70 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <CaretDown
                        size={12}
                        weight="bold"
                        className={`text-text-muted transition-transform duration-150 shrink-0 ${
                          isExpanded ? "rotate-0" : "-rotate-90"
                        }`}
                      />
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-text-main truncate" title={pl.name}>
                        {pl.name}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface-subtle border border-edge text-text-faint font-mono shrink-0">
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
                        className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-mono font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 ${
                          isRunningThis
                            ? "bg-red/15 hover:bg-red/25 text-red border border-red/30"
                            : "bg-score/10 hover:bg-score/20 text-score border border-score/25"
                        }`}
                      >
                        {isRunningThis ? (
                          <>
                            <Stop size={10} weight="fill" />
                            <span>STOP</span>
                          </>
                        ) : (
                          <>
                            <Play size={10} weight="fill" />
                            <span>PLAY</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Smooth Accordion for Playlist Items */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key={`pl-content-${pl.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-2 pb-2 space-y-1 pt-1">
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
                                      ? "bg-score/10 border-score/30 text-text-main font-semibold shadow-xs"
                                      : "bg-surface-subtle/50 border-edge hover:border-edge-strong text-text-secondary hover:text-text-main font-medium"
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
                                      {task ? cleanScenarioName(task.name) : `Cenário (${item.taskId.slice(0, 6)})`}
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
                                            : "bg-surface border border-edge text-text-faint"
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Bottom Action: Add Selected to Playlist (Scenarios tab only) */}
      {sidebarTab === "scenarios" && selectMode && selectedIds.size > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-edge">
          <button
            onClick={handleAddSelected}
            className="w-full bg-score hover:bg-score/90 text-surface font-mono font-bold uppercase tracking-widest py-2 px-3 rounded-lg text-[10px] flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
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
      <div className="mt-2.5 pt-2.5 border-t border-edge flex justify-between items-center text-[10px] font-mono font-bold uppercase tracking-widest text-text-faint">
        <span className="opacity-80">
          {sidebarTab === "scenarios"
            ? t("task.count", { n: tasks.length })
            : `${filteredPlaylists.length} PLAYLISTS`}
        </span>

        {sidebarTab === "scenarios" && activeTask && !selectMode && (
          <button
            onClick={onDeleteTask}
            className="text-text-muted hover:text-red transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-red/10 cursor-pointer"
          >
            <Trash size={12} weight="bold" />
            <span>{t("hist.delete")}</span>
          </button>
        )}

        {sidebarTab === "playlists" && onOpenPlaylistManager && (
          <button
            type="button"
            onClick={onOpenPlaylistManager}
            className="text-text-faint hover:text-text-main transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-surface-hover cursor-pointer"
          >
            <span>{t("playlist.manage")}</span>
          </button>
        )}
      </div>
    </aside>
    </>
  );
}
