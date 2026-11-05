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
import { useAllRuns, useAllSkills } from "@/hooks/useSkill";
import { useSettings } from "@/hooks/useSettings";
import { useAdvancedStats } from "@/hooks/useAdvancedStats";
import { formatScore } from "@/lib/chart-format";
import type { WeaknessItem } from "@/lib/skill/weakness";
import { VISCOSE_CATEGORIES } from "@/lib/viscose";
import { computeTaskMetrics } from "@/lib/threshold";
import { groupTrainingSessions } from "@/lib/skill/sessions";
import { scenarioQuality, type ScenarioQuality } from "@/lib/skill/quality";
import { rankWeaknesses, WEAKNESS_TOP_N } from "@/lib/skill/weakness";
import { DEFAULT_TRAINING_SETTINGS } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { Badge, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Número com sinal explícito (+1.2 / −0.4). */
function signed(v: number, digits = 1): string {
  const s = v.toFixed(digits).replace("-", "−");
  return v > 0 ? `+${s}` : s;
}

/** Motivo da fraqueza em palavras simples (chave i18n). */
function weaknessWhyKey(item: WeaknessItem) {
  if (item.hitRate14 !== null && item.hitRate14 < 0.35) return "simple.weak.whyLowHit" as const;
  if (item.trend === "down") return "simple.weak.whyDown" as const;
  if (item.suggestion === "stress") return "simple.weak.whyStalled" as const;
  if (item.daysSinceTrained === null || item.daysSinceTrained >= 7) return "simple.weak.whyStale" as const;
  return "simple.weak.whyReview" as const;
}

export interface ScenarioBreakdownProps {
  className?: string;
  embedded?: boolean;
}

export function ScenarioBreakdown({ className, embedded = false }: ScenarioBreakdownProps) {
  const { t, lang } = useI18n();
  const advanced = useAdvancedStats();
  // Chaves novas vivem em docs/plans/i18n-pending/T7-dashboard.json até a integração (o tipo Key ainda não as conhece).
  const { appData } = useApp();
  const { settings } = useSettings();
  const training = settings?.training ?? DEFAULT_TRAINING_SETTINGS;
  const allRuns = useAllRuns();
  const allSkills = useAllSkills();
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

  // Sessões globais (todos os cenários) para a qualidade por cenário (T7.9).
  const sessionsGlobal = useMemo(
    () => groupTrainingSessions(allRuns, training.sessionGapMinutes),
    [allRuns, training.sessionGapMinutes]
  );

  // Fraquezas v2 (T7.10): ranking de subcategorias sobre todos os cenários.
  const lastTrainedByTask = useMemo(() => {
    const out = new Map<string, number>();
    for (const r of allRuns) {
      const prev = out.get(r.taskId);
      if (prev === undefined || r.t > prev) out.set(r.taskId, r.t);
    }
    return out;
  }, [allRuns]);

  const weaknessRanking = useMemo(
    () =>
      rankWeaknesses(
        tasks.map((task) => {
          const sk = allSkills.get(task.id);
          return {
            taskId: task.id,
            category: task.category,
            subcategory: task.subcategory,
            trend: sk?.trend ?? "insufficient",
            hitRate14: sk?.hitRate14 ?? null,
            lastTrainedMs: lastTrainedByTask.get(task.id) ?? null,
          };
        }),
        Date.now(),
        Number.MAX_SAFE_INTEGER
      ),
    [tasks, allSkills, lastTrainedByTask]
  );

  const weaknessRank = useMemo(() => {
    const out = new Map<string, number>();
    weaknessRanking.forEach((item, idx) => item.taskIds.forEach((id) => out.set(id, idx)));
    return out;
  }, [weaknessRanking]);

  const weaknessTop = useMemo(() => weaknessRanking.slice(0, WEAKNESS_TOP_N), [weaknessRanking]);

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

    return [...base].sort(
      (a, b) =>
        (weaknessRank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (weaknessRank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );
  }, [tasks, effectivePlaylistId, playlists, categoryFilter, search, weaknessFocus, weaknessRank]);

  const quality = useMemo(
    () =>
      new Map<string, ScenarioQuality>(
        filteredTasks.map((task): [string, ScenarioQuality] => [
          task.id,
          scenarioQuality(task.id, sessionsGlobal),
        ])
      ),
    [filteredTasks, sessionsGlobal]
  );

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

        {/* Category Pills + Playlist Filter + Weakness Focus (T7.10) */}
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
                  <option value="All">
                    {t("dashboard.allPlaylists")}
                  </option>
                  {playlists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
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
            title={advanced ? t("weak.tooltip") : t("simple.weak.tooltip")}
            className={cn(
              "px-2.5 py-0.5 text-[11px] font-medium rounded-full transition-all shrink-0 cursor-pointer press flex items-center gap-1",
              weaknessFocus
                ? "bg-amber/15 text-amber border border-amber/40 font-semibold"
                : "liquid-well text-text-secondary hover:text-text-main"
            )}
          >
            <TrendDown size={12} weight="bold" />
            <span>{advanced ? t("weak.button") : t("simple.weak.button")}</span>
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

      {/* Onde focar (T7.10) */}
      {weaknessFocus && (
        <div className="mb-3 space-y-1.5">
          <div className="text-[11px] font-semibold text-text-secondary">
            {advanced ? t("weak.top3Title") : t("simple.weak.title")}
          </div>
          {weaknessTop.length === 0 ? (
            <p className="text-[11px] text-text-faint">
              {advanced ? t("weak.empty") : t("simple.weak.empty")}
            </p>
          ) : (
            <>
              {weaknessTop.map((item) => (
                <div
                  key={JSON.stringify([item.category, item.subcategory])}
                  className="p-2.5 rounded-control border border-edge glass-inset flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-text-main" title={`${item.category} · ${item.subcategory}`}>
                      {advanced
                        ? `${item.category} · ${item.subcategory}`
                        : t("simple.weak.item", { sub: item.subcategory, why: t(weaknessWhyKey(item)) })}
                    </div>
                    {advanced ? (
                      <div className="text-[10px] text-text-faint font-mono">
                        {t("weak.priority", { n: Math.round(item.priority * 100) })} · {t(`skill.trend.${item.trend}`)}
                        {item.hitRate14 !== null ? ` · ${t("scenario.hit", { v: Math.round(item.hitRate14 * 100) })}` : ""}
                      </div>
                    ) : (
                      item.suggestion && (
                        <div className="text-[11px] text-text-secondary leading-snug mt-0.5">
                          {item.suggestion === "refine" ? t("simple.weak.refine") : t("simple.weak.stress")}
                        </div>
                      )
                    )}
                  </div>
                  {advanced && item.suggestion && (
                    <Badge variant={item.suggestion === "refine" ? "amber" : "emerald"} className="text-[10px] shrink-0">
                      {item.suggestion === "refine" ? t("weak.refine") : t("weak.stress")}
                    </Badge>
                  )}
                </div>
              ))}
              <p className="text-[10px] text-text-faint">
                {advanced ? t("weak.variantHint") : t("simple.weak.variantHint")}
              </p>
            </>
          )}
        </div>
      )}

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
            const metrics = computeTaskMetrics(task, allSkills.get(task.id));
            const q = quality.get(task.id);
            const hasQualityTrend = q !== undefined && (q.accuracySlope !== null || q.ttkSlope !== null);
            // Modo simples: no máximo um aviso, em frase.
            const accuracyDropping = q?.accuracySlope != null && q.accuracySlope < -0.005;
            const warnKey = q?.possibleAutopilot
              ? ("simple.scn.warnAutopilot" as const)
              : accuracyDropping
                ? ("simple.scn.warnAccuracy" as const)
                : allSkills.get(task.id)?.trend === "down"
                  ? ("simple.scn.warnTrend" as const)
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
                          <span>{t("scenarioBreakdown.activeBadge")}</span>
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

                {advanced ? (
                  <div className="pt-2 border-t border-edge flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1 text-score">
                      <Trophy size={13} weight="regular" />
                      <span className="font-bold tabular">{pb !== null ? `${pb} pts` : "—"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald">
                      <ShieldCheck size={13} weight="regular" />
                      <span className="font-semibold tabular">
                        {metrics.targetThreshold !== null ? `${metrics.targetThreshold} pts` : "—"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-edge flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-score">
                      <Trophy size={13} weight="regular" />
                      <span className="font-semibold tabular">
                        {pb !== null
                          ? metrics.targetThreshold !== null
                            ? t("simple.scn.line", {
                                pb: formatScore(pb, lang),
                                target: formatScore(metrics.targetThreshold, lang),
                              })
                            : t("simple.scn.lineNoTarget", { pb: formatScore(pb, lang) })
                          : "—"}
                      </span>
                    </span>
                  </div>
                )}

                {advanced ? (
                  (metrics.hitRate !== null || hasQualityTrend || q?.possibleAutopilot) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-text-faint">
                      {metrics.hitRate !== null && <span>{t("scenario.hit", { v: metrics.hitRate.toFixed(0) })}</span>}
                      {q?.accuracySlope != null && (
                        <span>{t("quality.accTrend", { v: signed(q.accuracySlope * 100) })}</span>
                      )}
                      {q?.ttkSlope != null && <span>{t("quality.ttkTrend", { v: signed(q.ttkSlope) })}</span>}
                      {q?.possibleAutopilot && (
                        <span title={t("quality.autopilotHint")}>
                          <Badge variant="amber" className="text-[10px]">
                            {t("quality.autopilot")}
                          </Badge>
                        </span>
                      )}
                    </div>
                  )
                ) : (
                  (metrics.hitRate !== null || warnKey) && (
                    <div className="flex flex-col gap-0.5 text-[11px] text-text-faint">
                      {metrics.hitRate !== null && (
                        <span>{t("simple.scn.hits", { v: metrics.hitRate.toFixed(0) })}</span>
                      )}
                      {warnKey && <span className="text-amber">{t(warnKey)}</span>}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
