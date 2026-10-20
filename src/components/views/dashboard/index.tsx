import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ClockCounterClockwise,
  Crosshair,
  ListBullets,
} from "@phosphor-icons/react";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import { useI18n } from "@/lib/i18n";
import { EmptyState, Segmented } from "@/components/ui";
import { KPIStrip } from "./KPIStrip";
import { ProgressChart } from "./ProgressChart";
import { SessionHistory } from "./SessionHistory";
import { ScenarioBreakdown } from "./ScenarioBreakdown";
import { MiniPlaylistRunner } from "./MiniPlaylistRunner";
import { cn } from "@/lib/utils";

export interface DashboardViewProps {
  className?: string;
}

type SidePanelMode = "history" | "scenarios";

export function DashboardView({ className }: DashboardViewProps) {
  const { t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const { state } = useTrackerWorkspace();
  const { tasks, activeTask } = state;

  const [sideMode, setSideMode] = useState<SidePanelMode>("history");

  if (tasks.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <EmptyState
          icon={<Crosshair size={32} weight="regular" />}
          title={t("dashboard.emptyTitle")}
          description={t("dashboard.emptyDesc")}
          className="min-h-[360px]"
        />
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-12 gap-4", className)}>
      {/* 1. Compact Playlist Ribbon (auto-hides when no playlists exist) */}
      <div className="col-span-12">
        <MiniPlaylistRunner />
      </div>

      {/* 2. Unified Ratchet Command Stage (Focal Lead + Today's Target + PB/Hit Rate) */}
      <div className="col-span-12">
        <KPIStrip />
      </div>

      {/* 3. Single-Viewport Analytical Split: Chart (7/8 cols) + Context Inspector (5/4 cols) */}
      <div className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col">
        <ProgressChart activeTask={activeTask} className="h-full" />
      </div>

      <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col">
        <section className="liquid-surface p-5 flex flex-col h-full">
          <div className="flex items-center justify-between gap-2 mb-3.5 select-none">
            <Segmented<SidePanelMode>
              id="dashboard-side-inspector"
              size="sm"
              value={sideMode}
              onChange={setSideMode}
              options={[
                {
                  value: "history",
                  label: t("hist.title"),
                  icon: <ClockCounterClockwise size={13} weight="bold" />,
                },
                {
                  value: "scenarios",
                  label: t("dashboard.scenarioBreakdown"),
                  icon: <ListBullets size={13} weight="bold" />,
                },
              ]}
              className="w-full justify-between"
            />
          </div>

          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={sideMode}
                initial={
                  shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 4 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={
                  shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -3 }
                }
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {sideMode === "history" ? (
                  <SessionHistory embedded />
                ) : (
                  <ScenarioBreakdown embedded />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </div>
    </div>
  );
}

export default DashboardView;
