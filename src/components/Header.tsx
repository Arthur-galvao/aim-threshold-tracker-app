import type { WatcherStatus } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { openExternalUrl } from "@/lib/tauri-bridge";
import { GUIDE_URL } from "@/lib/links";
import { Segmented, type SegmentedOption } from "@/components/ui/Segmented";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import {
  Crosshair,
  Gear,
  BookOpen,
  ArrowSquareOut,
  Sun,
  Moon,
  CircleHalf,
  LockSimple,
} from "@phosphor-icons/react";

interface HeaderProps {
  activeTab: "dashboard" | "randomizer" | "playlist";
  onTabChange: (tab: "dashboard" | "randomizer" | "playlist") => void;
  rawaccelAvailable: boolean;
  onOpenSettings: () => void;
  watcherStatus: WatcherStatus;
}

export function Header({
  activeTab,
  onTabChange,
  rawaccelAvailable,
  onOpenSettings,
  watcherStatus,
}: HeaderProps) {
  const { theme, cycleTheme } = useTheme();
  const { lang, setLang, t } = useI18n();

  const tabOptions: SegmentedOption<"dashboard" | "randomizer" | "playlist">[] = [
    {
      value: "dashboard",
      label: t("tab.dashboard"),
    },
    {
      value: "randomizer",
      label: t("tab.randomizer"),
      disabled: !rawaccelAvailable,
      tooltip: !rawaccelAvailable ? t("tab.lockedTooltip") : undefined,
      icon: !rawaccelAvailable ? (
        <span className="text-amber flex items-center">
          <LockSimple size={13} weight="bold" />
        </span>
      ) : undefined,
      badge: !rawaccelAvailable ? (
        <span className="hidden xl:inline-block text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-soft text-amber border border-amber-edge">
          {t("tab.lockedBadge")}
        </span>
      ) : undefined,
    },
    {
      value: "playlist",
      label: t("tab.playlist"),
    },
  ];

  return (
    <header className="sticky top-0 z-40 chrome transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 min-h-[64px] flex items-center justify-between gap-3">
        {/* Brand / Logo + Tabs */}
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-surface-subtle border border-edge flex items-center justify-center shrink-0 text-accent shadow-sm">
              <Crosshair size={18} weight="bold" />
            </div>
            <div className="hidden md:flex flex-col min-w-0">
              <span className="text-xs font-bold tracking-tight text-text-main truncate uppercase">
                Aim Threshold Tracker
              </span>
              <span className="text-[10px] font-mono text-text-faint -mt-0.5 tracking-wider">
                v1.4.0
              </span>
            </div>
          </div>

          {/* Navigation Tabs with Safety Lock */}
          <Segmented
            options={tabOptions}
            value={activeTab}
            onChange={onTabChange}
          />
        </div>

        {/* Status & Utility Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Watcher Status Indicator */}
          <div
            className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              watcherStatus.active
                ? "bg-emerald-soft text-emerald border-emerald-edge"
                : "bg-surface-subtle text-text-faint border-edge"
            }`}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {watcherStatus.active && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  watcherStatus.active ? "bg-emerald" : "bg-text-faint"
                }`}
              />
            </span>
            <span className="hidden sm:inline text-[11px] font-mono tracking-tight">
              {watcherStatus.active
                ? t("header.watcherActive")
                : t("header.watcherInactive")}
            </span>
          </div>

          {/* Guia Button */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void openExternalUrl(GUIDE_URL)}
            title={t("header.guideTitle")}
            className="hidden sm:inline-flex"
            icon={
              <span className="text-text-secondary flex items-center">
                <BookOpen size={14} weight="bold" />
              </span>
            }
          >
            <span>{t("header.guide")}</span>
            <span className="text-text-faint flex items-center">
              <ArrowSquareOut size={12} weight="bold" />
            </span>
          </Button>

          {/* Language Selector */}
          <IconButton
            size="sm"
            variant="secondary"
            aria-label={t("header.language")}
            onClick={() => setLang(lang === "pt" ? "en" : "pt")}
            className="font-mono text-xs font-bold"
          >
            {lang.toUpperCase()}
          </IconButton>

          {/* Theme Selector */}
          <IconButton
            size="sm"
            variant="secondary"
            aria-label={t("header.theme")}
            onClick={cycleTheme}
          >
            {theme === "dark" ? (
              <Moon size={15} weight="bold" />
            ) : theme === "light" ? (
              <Sun size={15} weight="bold" />
            ) : (
              <CircleHalf size={15} weight="bold" />
            )}
          </IconButton>

          {/* Settings */}
          <IconButton
            size="sm"
            variant="secondary"
            aria-label={t("header.settings")}
            onClick={onOpenSettings}
          >
            <Gear size={15} weight="bold" />
          </IconButton>
        </div>
      </div>
    </header>
  );
}