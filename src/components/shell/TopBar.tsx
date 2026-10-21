import { useState } from "react";
import { Check, Gear, Palette, Plus, Target } from "@phosphor-icons/react";
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
import { useI18n } from "@/lib/i18n";
import { APP_THEMES, type AppTheme } from "@/lib/theme";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

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
              {t("session.title") || "Registrar sessão"}
            </span>
            <span className="sm:hidden">Run</span>
          </Button>

          {onThemeChange && (
            <Popover open={themeOpen} onOpenChange={setThemeOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label="Tema visual"
                    title="Tema visual"
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
