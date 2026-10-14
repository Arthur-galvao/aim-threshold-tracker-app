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
    <header className="sticky top-0 z-30 liquid-glass-panel border-b border-glass-edge shadow-xs transition-colors duration-150">
      <div className="w-full px-3 sm:px-6 py-2 sm:py-2.5 min-h-[50px] sm:min-h-[54px] flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Sidebar Toggle, App Title and Pill Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-3 md:gap-5 shrink-0 min-w-0">
          {onToggleSidebar && (
            <Tooltip content={t("scenarioList.title")}>
              <button
                type="button"
                onClick={onToggleSidebar}
                aria-label="Toggle sidebar"
                className="w-8 h-8 rounded-xl border border-glass-edge bg-glass-bg hover:bg-glass-bg-elevated text-text-secondary hover:text-text-main flex items-center justify-center transition-all cursor-pointer shadow-xs press md:hidden shrink-0"
              >
                <List size={16} weight="bold" />
              </button>
            </Tooltip>
          )}

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-xl bg-score-soft border border-score/30 flex items-center justify-center text-score shadow-xs shrink-0">
              <Target size={15} weight="bold" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[12px] sm:text-[13px] font-mono font-bold tracking-wider text-text-main truncate">
                <span className="hidden xl:inline">AIM THRESHOLD TRACKER</span>
                <span className="xl:hidden">ATT</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-glass-bg border border-glass-edge text-text-faint tabular-nums">
                v1.9.1
              </span>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(val) => onTabChange(val as "dashboard" | "randomizer" | "playlist")}
            className="w-auto shrink-0"
          >
            <TabsList className="h-8 p-0.5 rounded-full bg-glass-bg border border-glass-edge gap-0.5">
              <TabsTrigger
                value="dashboard"
                layoutId="headerActiveTab"
                className="h-7 px-2.5 sm:px-3.5 text-[11px] sm:text-xs rounded-full press"
              >
                {t("tab.dashboard")}
              </TabsTrigger>
              <TabsTrigger
                value="playlist"
                layoutId="headerActiveTab"
                className="h-7 px-2.5 sm:px-3.5 text-[11px] sm:text-xs rounded-full press"
              >
                {t("tab.playlist")}
              </TabsTrigger>
              <TabsTrigger
                value="randomizer"
                layoutId="headerActiveTab"
                disabled={!rawaccelAvailable}
                className="h-7 px-2.5 sm:px-3.5 text-[11px] sm:text-xs rounded-full press"
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
            <div className="hidden 2xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-glass-bg border border-glass-edge text-[11px] font-mono text-text-secondary select-none shadow-xs">
              <span className="relative flex h-2 w-2 items-center justify-center">
                {watcherStatus?.active && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-1.5 w-1.5 rounded-full",
                    watcherStatus?.active ? "bg-emerald shadow-xs" : "bg-text-faint/50"
                  )}
                />
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-text-faint">
                {watcherStatus?.active ? "LIVE" : "IDLE"}
              </span>
            </div>
          </Tooltip>

          {onNewSession && (
            <Tooltip content={t("session.title")}>
              <Button
                size="sm"
                variant="frosted"
                onClick={onNewSession}
                className="h-8 px-2.5 2xl:px-3 text-[11px] font-mono rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0 press"
              >
                <NotePencil size={13} weight="bold" className="text-score" />
                <span className="hidden 2xl:inline">+ {t("session.title")}</span>
              </Button>
            </Tooltip>
          )}

          <Tooltip content="Aim Lab Integration">
            <button
              type="button"
              onClick={onOpenAimlab}
              className="w-8 h-8 rounded-xl border border-glass-edge bg-glass-bg hover:bg-glass-bg-elevated text-text-secondary hover:text-text-main flex items-center justify-center transition-all cursor-pointer shadow-xs press"
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
              className="w-8 h-8 rounded-xl border border-glass-edge bg-glass-bg hover:bg-glass-bg-elevated text-text-secondary hover:text-text-main flex items-center justify-center transition-all cursor-pointer shadow-xs press"
            >
              <Gear size={14} weight="bold" />
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}