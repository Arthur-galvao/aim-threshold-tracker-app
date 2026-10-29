import { useState, useMemo } from "react";
import {
  ListBullets,
  MagnifyingGlass,
  CheckCircle,
  Trophy,
  ShieldCheck,
  TrendDown,
  Queue,
  CaretDown,
  X,
} from "@phosphor-icons/react";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import { useApp } from "@/hooks/useAppData";
import { VISCOSE_CATEGORIES } from "@/lib/viscose";
import { computeTaskMetrics } from "@/lib/threshold";
import { useI18n } from "@/lib/i18n";
import { Badge, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ScenarioBreakdownProps {
  className?: string;
  embedded?: boolean;
}

export function ScenarioBreakdown({ className, embedded = false }: ScenarioBreakdownProps) {
  const { t } = useI18n();
  const { appData } = useApp();
  const { state, actions } = useTrackerWorkspace();
  const { tasks, activeTask } = state;
  const playlists = appData?.playlists ?? [];

  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("playlist");
      if (p) return p;
    }
    return "All";
  });
  const [weaknessFocus, setWeaknessFocus] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  const effectivePlaylistId = playlists.some((p) => p.id === selectedPlaylistId)
    ? selectedPlaylistId
    : "All";

  const categories = useMemo(() => {
    return ["All", ...Object.keys(VISCOSE_CATEGORIES)];
  }, []);

  const filteredTasks = useMemo(() => {
    const selectedPlaylist =
      effectivePlaylistId !== "All"
        ? playlists.find((p) => p.id === effectivePlaylistId)
        : null;

    const playlistTaskIds = selectedPlaylist
      ? new Set(selectedPlaylist.items.map((it) => it.taskId))
      : null;

    const base = tasks.filter((task) => {
      const matchPlaylist = !playlistTaskIds || playlistTaskIds.has(task.id);
      const matchCat = categoryFilter === "All" || task.category === categoryFilter;
      const matchSearch =
        search.trim() === "" ||
        task.name.toLowerCase().includes(search.toLowerCase()) ||
        task.subcategory.toLowerCase().includes(search.toLowerCase());
      return matchPlaylist && matchCat && matchSearch;
    });

    if (selectedPlaylist && !weaknessFocus) {
      const orderIndexMap = new Map<string, number>();
      selectedPlaylist.items.forEach((item, idx) => {
        if (!orderIndexMap.has(item.taskId)) {
          orderIndexMap.set(item.taskId, idx);
        }
      });
      return [...base].sort(
        (a, b) => (orderIndexMap.get(a.id) ?? 999) - (orderIndexMap.get(b.id) ?? 999)
      );
    }

    if (!weaknessFocus) return base;

    const weaknessScore = (task: (typeof tasks)[number]): number => {
      if (!task.sessions || task.sessions.length === 0) return 2;
      const last = task.sessions[task.sessions.length - 1];
      const thresh = Number(last.threshold) || 0;
      const lastPb = Number(last.pb) || 0;
      const recentRatio = thresh > 0 ? lastPb / thresh : 1;
      const { hitRate } = computeTaskMetrics(task);
      const hitNorm = hitRate !== null ? hitRate / 100 : 0.85;
      return hitNorm * 0.5 + recentRatio * 0.5;
    };

    return [...base].sort((a, b) => weaknessScore(a) - weaknessScore(b));
  }, [tasks, effectivePlaylistId, playlists, categoryFilter, search, weaknessFocus]);

  return (
    <div
      className={cn(
        embedded ? "flex flex-col h-full" : "liquid-surface p-5 flex flex-col",
        className
      )}
    >
      {/* Search & Category Bar */}
      <div className="space-y-2.5 mb-3 select-none">
        <div className="relative w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none">
            <MagnifyingGlass size={14} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("dashboard.searchScenarios")}
            className="w-full h-8 pl-8 pr-3 text-xs font-mono rounded-full field"
          />
        </div>

        {/* Category Pills + Playlist Filter + 60/40 Weakness Focus */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scroll-y select-none">
          {playlists.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <div
                className={cn(
                  "relative flex items-center rounded-full transition-all text-[11px] font-medium",
                  effectivePlaylistId !== "All"
                    ? "bg-score-soft text-score border border-edge-strong font-semibold"
                    : "liquid-well text-text-secondary hover:text-text-main"
                )}
              >
                <span className="pl-2.5 text-text-faint pointer-events-none flex items-center">
                  <Queue size={12} weight="regular" />
                </span>
                <select
                  value={effectivePlaylistId}
                  onChange={(e) => setSelectedPlaylistId(e.target.value)}
                  aria-label={t("dashboard.filterByPlaylist")}
                  className="bg-transparent text-[11px] font-medium py-0.5 pl-1.5 pr-6 appearance-none cursor-pointer focus:outline-none"
                >
                  <option value="All" className="bg-bg-canvas text-text-main">
                    {t("dashboard.allPlaylists")}
                  </option>
                  {playlists.map((pl) => (
                    <option key={pl.id} value={pl.id} className="bg-bg-canvas text-text-main">
                      {pl.name} ({pl.items.length})
                    </option>
                  ))}
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-faint flex items-center">
                  <CaretDown size={10} weight="bold" />
                </span>
              </div>
              {effectivePlaylistId !== "All" && (
                <button
                  type="button"
                  onClick={() => setSelectedPlaylistId("All")}
                  title={t("dashboard.clearPlaylistFilter")}
                  aria-label={t("dashboard.clearPlaylistFilter")}
                  className="w-5 h-5 rounded-full liquid-well hover:bg-score-soft text-text-faint hover:text-score flex items-center justify-center transition-all press shrink-0 cursor-pointer"
                >
                  <X size={10} weight="bold" />
                </button>
              )}
              <div className="h-3.5 w-[1px] bg-edge shrink-0 mx-0.5" />
            </div>
          )}

          <button
            type="button"
            onClick={() => setWeaknessFocus((prev) => !prev)}
            title={t("dashboard.weaknessFocusTooltip")}
            className={cn(
              "px-2.5 py-0.5 text-[11px] font-medium rounded-full transition-all shrink-0 cursor-pointer press flex items-center gap-1",
              weaknessFocus
                ? "bg-amber/15 text-amber border border-amber/40 font-semibold"
                : "liquid-well text-text-secondary hover:text-text-main"
            )}
          >
            <TrendDown size={12} weight="bold" />
            <span>{t("dashboard.weaknessFocus")}</span>
          </button>

          <div className="h-3.5 w-[1px] bg-edge shrink-0 mx-0.5" />

          {categories.map((cat) => {
            const isSelected = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-2.5 py-0.5 text-[11px] font-medium rounded-full transition-all shrink-0 cursor-pointer press",
                  isSelected
                    ? "bg-score-soft text-score border border-edge-strong font-semibold"
                    : "liquid-well text-text-secondary hover:text-text-main"
                )}
              >
                {cat === "All" ? t("dashboard.allCategories") : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scenario Cards Grid */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={<ListBullets size={24} weight="regular" />}
          title={t("task.none")}
          description={t("dashboard.emptyDesc")}
          className="min-h-[160px]"
        />
      ) : (
        <div
          className={cn(
            "grid gap-2 max-h-[340px] overflow-y-auto scroll-y pr-1",
            embedded ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
          )}
        >
          {filteredTasks.map((task) => {
            const isActive = activeTask?.id === task.id;
            const pb =
              task.sessions && task.sessions.length > 0
                ? Math.max(...task.sessions.map((s) => Number(s.pb) || 0))
                : null;
            const lastThreshold =
              task.sessions && task.sessions.length > 0
                ? task.sessions[task.sessions.length - 1].threshold
                : null;

            return (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                onClick={() => actions.selectTask(task.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    actions.selectTask(task.id);
                  }
                }}
                className={cn(
                  "p-3 rounded-control border transition-all cursor-pointer flex flex-col justify-between gap-2 press select-none",
                  isActive
                    ? "glass-control border-emerald-edge shadow-1"
                    : "glass-inset border-edge hover:border-edge-strong"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-xs text-text-main truncate max-w-[200px]" title={task.name}>
                        {task.name}
                      </span>
                      {isActive && (
                        <Badge variant="emerald" className="text-[10px]">
                          <CheckCircle size={10} weight="fill" />
                          <span>Ativo</span>
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="neutral" className="text-[10px]">
                        {task.category}
                      </Badge>
                      <span className="text-[10px] text-text-faint font-mono">
                        {task.subcategory}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-text-faint tabular shrink-0">
                    {t("metric.sessionsCount", { n: task.sessions?.length ?? 0 })}
                  </span>
                </div>

                <div className="pt-2 border-t border-edge flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1 text-score">
                    <Trophy size={13} weight="regular" />
                    <span className="font-bold tabular">{pb !== null ? `${pb} pts` : "—"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald">
                    <ShieldCheck size={13} weight="regular" />
                    <span className="font-semibold tabular">
                      {lastThreshold !== null ? `${lastThreshold} pts` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
