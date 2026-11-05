import { useState } from "react";
import { Check, Gear, Palette, Plus, Target, Timer, Warning } from "@phosphor-icons/react";
import {
  Button,
  Popover,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
  Tooltip,
  TooltipProvider,
} from "@/components/ui";
import { Dock, type NavTab } from "./Dock";
import { ScenarioSwitcher } from "./ScenarioSwitcher";
import { WatcherOrb } from "./WatcherOrb";
import { useI18n, type Key } from "@/lib/i18n";
import { APP_THEMES, type AppTheme } from "@/lib/theme";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSensRandomizer } from "@/hooks/useSensRandomizer";
import { useLiveSession } from "@/hooks/useLiveSession";
import type { RandomizerActiveRole, RandomizerMuscleCue } from "@/hooks/useSensRandomizer";

/** Chaves i18n do papel do randomizer (compartilhadas com o card de sens da playlist). */
const ROLE_KEYS: Record<RandomizerActiveRole, Key> = {
  base: "playlistSens.roleBase",
  anchor: "playlistSens.roleAnchor",
  random: "playlistSens.roleRandom",
  off: "playlistSens.roleOff",
};

/** Cue muscular: rápida = pulso/dedos, lenta = braço (Plano 05). */
const CUE_KEYS: Record<RandomizerMuscleCue, Key> = {
  fast: "playlistSens.cueFast",
  slow: "playlistSens.cueSlow",
  base: "playlistSens.cueBase",
};

export interface TopBarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenSettings: () => void;
  tasks: Task[];
  activeTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onNewScenario: () => void;
  onOpenSessionSheet: () => void;
  watcherActive: boolean;
  onToggleWatcher: () => void;
  currentTheme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
  className?: string;
}

export function TopBar({
  activeTab,
  onTabChange,
  onOpenSettings,
  tasks,
  activeTaskId,
  onSelectTask,
  onNewScenario,
  onOpenSessionSheet,
  watcherActive,
  onToggleWatcher,
  currentTheme = "cyber-lab",
  onThemeChange,
  className,
}: TopBarProps) {
  const { t } = useI18n();
  const [themeOpen, setThemeOpen] = useState(false);
  const { settings: randomizerSettings, randomizerState } = useSensRandomizer();
  const live = useLiveSession();

  const roleKey = randomizerState.activeRole ? ROLE_KEYS[randomizerState.activeRole] : null;
  const cueKey = randomizerState.muscleCue ? CUE_KEYS[randomizerState.muscleCue] : null;

  return (
    <header
      className={cn(
        "w-full pt-3 pb-2.5 select-none shrink-0 z-30",
        className
      )}
    >
      <div className="liquid-surface liquid-interactive px-3 py-2 rounded-full flex items-center justify-between gap-3">
        {/* Left: Brand Mark + Scenario Switcher */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            aria-hidden="true"
            className="group hidden sm:flex h-8 w-8 items-center justify-center rounded-full liquid-well text-score shrink-0 transition-all duration-300 hover:border-score/40 hover:shadow-[0_0_14px_rgb(var(--score-rgb)/0.3)]"
          >
            <Target
              size={17}
              weight="bold"
              className="transition-transform duration-300 group-hover:rotate-45 group-hover:scale-110"
            />
          </div>

          <ScenarioSwitcher
            tasks={tasks}
            activeTaskId={activeTaskId}
            onSelectTask={onSelectTask}
            onNewScenario={onNewScenario}
          />

          {/* Sens ativa do randomizer: valor, papel e cue muscular (Plano 05, T5.7e) */}
          {randomizerSettings.enabled && (
            <div
              className="hidden lg:flex items-center gap-1.5 min-w-0 px-2.5 py-1 rounded-full liquid-well text-[11px] font-mono text-text-secondary whitespace-nowrap"
              title={t("topbar.randomizerChip")}
            >
              <span className="tabular-nums text-text-main">
                {randomizerState.activeSensCm.toFixed(2)} cm/360
              </span>
              {roleKey && (
                <>
                  <span className="text-text-faint">·</span>
                  <span>{t(roleKey)}</span>
                </>
              )}
              {cueKey && (
                <>
                  <span className="text-text-faint">·</span>
                  <span className="truncate">{t(cueKey)}</span>
                </>
              )}
            </div>
          )}

          {randomizerSettings.enabled && randomizerState.rawaccelGuiRunning && (
            <span
              role="status"
              className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full border border-amber-edge bg-amber-soft text-amber text-[11px] whitespace-nowrap"
            >
              <Warning size={12} weight="bold" />
              {t("topbar.rawaccelGui")}
            </span>
          )}
        </div>

        {/* Center: Spatial Segmented Navigation Capsule (Desktop) */}
        <div className="hidden md:flex items-center justify-center">
          <Dock
            activeTab={activeTab}
            onTabChange={onTabChange}
            onOpenSettings={onOpenSettings}
            variant="inline"
          />
        </div>

        {/* Right: Watcher Status + Quick Session Record + Theme + Settings */}
        <div className="flex items-center gap-2 shrink-0">
          {(live.openKey || live.endedKey) && (
            <button
              type="button"
              onClick={() => live.openSummary()}
              aria-label={t("session.summary.title")}
              className="flex items-center gap-1.5 h-8 px-3 rounded-full liquid-pill text-[11px] text-text-main whitespace-nowrap cursor-pointer focus-visible:outline-none press"
            >
              <Timer size={13} weight="bold" className={live.openKey ? "text-emerald" : "text-score"} />
              <span className="tabular-nums">
                {live.openKey
                  ? t("session.live.badge", { n: live.openRuns })
                  : t("session.live.ready")}
              </span>
            </button>
          )}

          <WatcherOrb active={watcherActive} onToggle={onToggleWatcher} />

          <Button
            variant="primary"
            size="sm"
            icon={
              <Plus
                size={14}
                weight="bold"
                className="transition-transform duration-300 group-hover:rotate-90"
              />
            }
            onClick={onOpenSessionSheet}
            className="rounded-full px-3.5"
          >
            <span className="hidden sm:inline">
              {t("session.title")}
            </span>
            <span className="sm:hidden">{t("topbar.runShort")}</span>
          </Button>

          {onThemeChange && (
            <Popover open={themeOpen} onOpenChange={setThemeOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label={t("topbar.themeVisual")}
                    title={t("topbar.themeVisual")}
                    className="group hidden sm:flex h-8 w-8 items-center justify-center rounded-full liquid-pill text-score hover:text-text-main cursor-pointer focus-visible:outline-none press"
                  />
                }
              >
                <Palette
                  size={16}
                  weight="duotone"
                  className={cn(
                    "transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110",
                    themeOpen && "rotate-12 scale-110"
                  )}
                />
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverPositioner side="bottom" align="end" sideOffset={10}>
                  <PopoverPopup className="liquid-float w-60 p-2.5 shadow-float">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                      Tema & Nebulosa
                    </div>
                    <div className="mt-1 flex flex-col gap-1">
                      {APP_THEMES.map((item) => {
                        const isSelected = currentTheme === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              onThemeChange(item.id);
                              setThemeOpen(false);
                            }}
                            className={cn(
                              "group flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-control text-xs transition-all duration-200 cursor-pointer select-none press text-left",
                              isSelected
                                ? "liquid-pill text-text-main font-semibold"
                                : "hover:bg-surface-hover hover:translate-x-0.5 text-text-secondary hover:text-text-main"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="h-3 w-3 rounded-full shrink-0 border border-white/25 transition-transform duration-200 group-hover:scale-125"
                                style={{
                                  backgroundColor: item.color,
                                  boxShadow: `0 0 10px ${item.color}`,
                                }}
                              />
                              <span className="truncate">{item.name}</span>
                            </div>
                            {isSelected && (
                              <Check size={13} weight="bold" className="text-score shrink-0 animate-pop-in" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverPopup>
                </PopoverPositioner>
              </PopoverPortal>
            </Popover>
          )}

          <TooltipProvider>
            <Tooltip side="bottom" sideOffset={8} content={t("header.settings")}>
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label={t("header.settings")}
                className="group hidden md:flex h-8 w-8 items-center justify-center rounded-full liquid-pill text-text-secondary hover:text-text-main cursor-pointer focus-visible:outline-none press"
              >
                <Gear
                  size={16}
                  weight="regular"
                  className="transition-transform duration-300 group-hover:rotate-90"
                />
              </button>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </header>
  );
}
