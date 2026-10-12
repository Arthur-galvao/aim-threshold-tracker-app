import type { WatcherStatus } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/Tooltip";
import { ThemeSelector } from "@/components/ThemeSelector";
import type { AppTheme } from "@/lib/theme";
import { NotePencil, Gear, Crosshair, Target, List } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  activeTab: "dashboard" | "randomizer" | "playlist";
  onTabChange: (tab: "dashboard" | "randomizer" | "playlist") => void;
  rawaccelAvailable: boolean;
  onOpenSettings: () => void;
  onOpenAimlab: () => void;
  watcherStatus: WatcherStatus;
  onNewSession?: () => void;
  currentTheme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
  onToggleSidebar?: () => void;
}

export function Header({
  activeTab,
  onTabChange,
  rawaccelAvailable,
  onOpenSettings,
  onOpenAimlab,
  watcherStatus,
  onNewSession,
  currentTheme = "cyber-lab",
  onThemeChange,
  onToggleSidebar,
}: HeaderProps) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 bg-base/95 backdrop-blur-md border-b border-edge transition-colors duration-150">
      <div className="w-full px-2.5 sm:px-6 py-2 sm:py-2.5 min-h-[50px] sm:min-h-[54px] flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Sidebar Toggle, App Title and Pill Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-3 md:gap-5 shrink-0 min-w-0">
          {onToggleSidebar && (
            <Tooltip content={t("scenarioList.title")}>
              <button
                type="button"
                onClick={onToggleSidebar}
                aria-label="Toggle sidebar"
                className="w-8 h-8 rounded-lg border border-edge bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-main flex items-center justify-center transition-colors cursor-pointer shadow-xs md:hidden shrink-0"
              >
                <List size={16} weight="bold" />
              </button>
            </Tooltip>
          )}

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-score-soft border border-score/30 flex items-center justify-center text-score shrink-0">
              <Target size={15} weight="bold" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[12px] sm:text-[13px] font-mono font-bold tracking-wider text-text-main truncate">
                <span className="hidden xl:inline">AIM THRESHOLD TRACKER</span>
                <span className="xl:hidden">ATT</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-surface-subtle border border-edge text-text-faint">
                v1.7.2
              </span>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(val) => onTabChange(val as "dashboard" | "randomizer" | "playlist")}
            className="w-auto shrink-0"
          >
            <TabsList className="h-8 p-0.5 rounded-full bg-surface-subtle border border-edge gap-0.5">
              <TabsTrigger
                value="dashboard"
                layoutId="headerActiveTab"
                className="h-7 px-2 sm:px-3.5 text-[11px] sm:text-xs rounded-full"
              >
                {t("tab.dashboard")}
              </TabsTrigger>
              <TabsTrigger
                value="playlist"
                layoutId="headerActiveTab"
                className="h-7 px-2 sm:px-3.5 text-[11px] sm:text-xs rounded-full"
              >
                {t("tab.playlist")}
              </TabsTrigger>
              <TabsTrigger
                value="randomizer"
                layoutId="headerActiveTab"
                disabled={!rawaccelAvailable}
                className="h-7 px-2 sm:px-3.5 text-[11px] sm:text-xs rounded-full"
              >
                {t("tab.randomizer")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Right: Live Watcher Pill & Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Live Watcher Telemetry Status */}
          <Tooltip content={watcherStatus?.active ? t("header.watcherActive") : t("header.watcherInactive")}>
            <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-subtle border border-edge text-[11px] font-mono text-text-secondary select-none">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  watcherStatus?.active ? "bg-emerald animate-pulse" : "bg-text-faint/50"
                )}
              />
              <span className="text-[10px] uppercase font-semibold tracking-wider text-text-faint">
                {watcherStatus?.active ? "LIVE" : "IDLE"}
              </span>
            </div>
          </Tooltip>

          {onNewSession && (
            <Tooltip content={t("session.title")}>
              <Button
                size="sm"
                variant="secondary"
                onClick={onNewSession}
                className="h-8 px-2 sm:px-2.5 2xl:px-3 text-[11px] font-mono rounded-lg bg-surface hover:bg-surface-hover border border-edge text-text-main flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
              >
                <NotePencil size={13} weight="bold" className="text-text-secondary" />
                <span className="hidden 2xl:inline">+ {t("session.title")}</span>
              </Button>
            </Tooltip>
          )}

          <Tooltip content="Aim Lab Integration">
            <button
              type="button"
              onClick={onOpenAimlab}
              className="w-8 h-8 rounded-lg border border-edge bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-main flex items-center justify-center transition-colors cursor-pointer shadow-xs"
            >
              <Crosshair size={14} weight="bold" />
            </button>
          </Tooltip>

          {onThemeChange && (
            <ThemeSelector currentTheme={currentTheme} onThemeChange={onThemeChange} />
          )}

          <Tooltip content={t("header.settings")}>
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-8 h-8 rounded-lg border border-edge bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-main flex items-center justify-center transition-colors cursor-pointer shadow-xs"
            >
              <Gear size={14} weight="bold" />
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}