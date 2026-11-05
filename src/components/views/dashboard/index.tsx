import { lazy, Suspense, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ClockCounterClockwise,
  Crosshair,
  ListBullets,
} from "@phosphor-icons/react";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import { useI18n } from "@/lib/i18n";
import { EmptyState, Segmented } from "@/components/ui";
import { KPIStrip } from "./KPIStrip";
import { SessionHistory } from "./SessionHistory";
import { ScenarioBreakdown } from "./ScenarioBreakdown";
import { MiniPlaylistRunner } from "./MiniPlaylistRunner";
import { TargetAnalytics } from "./TargetAnalytics";
import { cn } from "@/lib/utils";

// T8.9: chart.js só carrega quando o dashboard monta os gráficos (fora do chunk inicial).
const ProgressChart = lazy(() =>
  import("./ProgressChart").then((m) => ({ default: m.ProgressChart }))
);
const IntraSessionChart = lazy(() =>
  import("./IntraSessionChart").then((m) => ({ default: m.IntraSessionChart }))
);

function ChartFallback({ className }: { className?: string }) {
  return <div className={cn("liquid-surface min-h-[240px] animate-pulse", className)} aria-hidden="true" />;
}

export interface DashboardViewProps {
  className?: string;
}

type SidePanelMode = "history" | "scenarios";

export function DashboardView({ className }: DashboardViewProps) {
  const { t } = useI18n();
  const { state } = useTrackerWorkspace();
  const { tasks, activeTask } = state;

  const [sideMode, setSideMode] = useState<SidePanelMode>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "scenarios" || params.has("playlist")) {
        return "scenarios";
      }
    }
    return "history";
  });

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

      {/* 2. Target command stage (next target + skill mu/CV + PB/hit rate) */}
      <div className="col-span-12">
        <KPIStrip />
      </div>

      {/* 3. Single-Viewport Analytical Split: Chart (7/8 cols) + Context Inspector (5/4 cols) */}
      <div className="col-span-12 lg:col-span-7 xl:col-span-8 flex flex-col">
        <Suspense fallback={<ChartFallback className="h-full" />}>
          <ProgressChart activeTask={activeTask} className="h-full" />
        </Suspense>
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
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
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

      {/* 4. Target analytics (trend, difficulty hint, invalid runs) */}
      <div className="col-span-12">
        <TargetAnalytics />
      </div>

      {/* 5. Intra-session curve + warm-up calibration (Plano 07, T7.3) */}
      <div className="col-span-12">
        <Suspense fallback={<ChartFallback />}>
          <IntraSessionChart />
        </Suspense>
      </div>
    </div>
  );
}

export default DashboardView;
