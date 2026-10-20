import { Gear, Plus, Target } from "@phosphor-icons/react";
import { Button, Tooltip, TooltipProvider } from "@/components/ui";
import { Dock, type NavTab } from "./Dock";
import { ScenarioSwitcher } from "./ScenarioSwitcher";
import { WatcherOrb } from "./WatcherOrb";
import { useI18n } from "@/lib/i18n";
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
  className,
}: TopBarProps) {
  const { t } = useI18n();

  return (
    <header
      className={cn(
        "w-full pt-3 pb-2.5 select-none shrink-0 z-30",
        className
      )}
    >
      <div className="liquid-surface px-3 py-2 rounded-full flex items-center justify-between gap-3">
        {/* Left: Brand Mark + Scenario Switcher */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            aria-hidden="true"
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full liquid-well text-score shrink-0"
          >
            <Target size={17} weight="bold" />
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

        {/* Right: Watcher Status + Quick Session Record + Settings */}
        <div className="flex items-center gap-2 shrink-0">
          <WatcherOrb active={watcherActive} onToggle={onToggleWatcher} />

          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} weight="bold" />}
            onClick={onOpenSessionSheet}
            className="rounded-full px-3.5"
          >
            <span className="hidden sm:inline">
              {t("session.title") || "Registrar sessão"}
            </span>
            <span className="sm:hidden">Run</span>
          </Button>

          <TooltipProvider>
            <Tooltip side="bottom" sideOffset={8} content={t("header.settings")}>
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label={t("header.settings")}
                className="hidden md:flex h-8 w-8 items-center justify-center rounded-full liquid-pill text-text-secondary hover:text-text-main cursor-pointer focus-visible:outline-none press"
              >
                <Gear size={16} weight="regular" />
              </button>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </header>
  );
}
