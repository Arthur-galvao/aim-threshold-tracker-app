import { useCallback } from "react";
import { Backdrop } from "./Backdrop";
import { Dock, type NavTab } from "./Dock";
import { TopBar } from "./TopBar";
import type { Task } from "@/lib/types";
import type { AppTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export interface AppShellProps {
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
  children: React.ReactNode;
}

export function AppShell({
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
  currentTheme,
  onThemeChange,
  className,
  children,
}: AppShellProps) {
  // Delegated pointer tracker: feeds local cursor coordinates (--mx, --my) into any hovered glass card
  const handleStagePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const card = target.closest<HTMLElement>(".glass, .liquid-surface, .liquid-interactive");
    if (card) {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      card.style.setProperty("--my", `${e.clientY - rect.top}px`);
    }
  }, []);

  return (
    <div
      onPointerMove={handleStagePointerMove}
      className={cn(
        "relative isolate h-screen w-screen overflow-hidden bg-transparent text-text-main flex flex-col",
        className
      )}
    >
      {/* Interactive Spatial Nebula & Cosmic Dust Cloud */}
      <Backdrop />

      {/* Mobile bottom floating dock (< md) */}
      <Dock
        activeTab={activeTab}
        onTabChange={onTabChange}
        onOpenSettings={onOpenSettings}
        variant="mobile-float"
      />

      {/* Full-width Spatial Workspace Stage (no transform/opacity wrapper that would create a backdrop-root) */}
      <div className="relative z-10 flex-1 flex flex-col h-full min-w-0 pb-16 md:pb-0 overflow-hidden">
        <div className="w-full max-w-[1600px] mx-auto px-4 md:px-6 flex flex-col h-full">
          {/* Unified Dynamic Glass Bar */}
          <TopBar
            activeTab={activeTab}
            onTabChange={onTabChange}
            onOpenSettings={onOpenSettings}
            tasks={tasks}
            activeTaskId={activeTaskId}
            onSelectTask={onSelectTask}
            onNewScenario={onNewScenario}
            onOpenSessionSheet={onOpenSessionSheet}
            watcherActive={watcherActive}
            onToggleWatcher={onToggleWatcher}
            currentTheme={currentTheme}
            onThemeChange={onThemeChange}
          />

          {/* View Container — pure transparent pass-through so child backdrop-filter samples Backdrop directly */}
          <main
            key={activeTab}
            className="flex-1 min-h-0 scroll-y pb-5 pr-0.5"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
