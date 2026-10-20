import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Backdrop } from "./Backdrop";
import { Dock, type NavTab } from "./Dock";
import { TopBar } from "./TopBar";
import type { Task } from "@/lib/types";
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
  className,
  children,
}: AppShellProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "relative h-screen w-screen overflow-hidden bg-base text-text-main flex flex-col",
        className
      )}
    >
      {/* Spatial caustic background */}
      <Backdrop />

      {/* Mobile bottom floating dock (< md) */}
      <Dock
        activeTab={activeTab}
        onTabChange={onTabChange}
        onOpenSettings={onOpenSettings}
        variant="mobile-float"
      />

      {/* Full-width Spatial Workspace Stage */}
      <div className="flex-1 flex flex-col h-full min-w-0 pb-16 md:pb-0 z-10 overflow-hidden">
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
          />

          {/* View Container with internal scroll and physical entry transition */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.main
              key={activeTab}
              initial={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 0, y: 5, scale: 0.996 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: 0, y: -3, scale: 0.998 }
              }
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-h-0 scroll-y pb-5 pr-0.5"
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
