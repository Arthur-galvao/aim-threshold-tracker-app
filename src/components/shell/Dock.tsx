import React, { useEffect } from "react";
import { motion } from "motion/react";
import {
  ChartLineUp,
  Gear,
  Playlist as PlaylistIcon,
  Shuffle,
} from "@phosphor-icons/react";
import { Kbd, Tooltip, TooltipProvider } from "@/components/ui";
import { useApp } from "@/hooks/useAppData";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type NavTab = "dashboard" | "randomizer" | "playlist";

export interface DockProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenSettings: () => void;
  variant?: "inline" | "mobile-float";
  className?: string;
}

export function Dock({
  activeTab,
  onTabChange,
  onOpenSettings,
  variant = "inline",
  className,
}: DockProps) {
  const { t } = useI18n();
  const { playlistRunner } = useApp();
  const isPlaylistRunning = Boolean(
    playlistRunner?.isRunning && !playlistRunner?.isFinished
  );

  // Global keyboard shortcuts: 1, 2, 3 (only registered once by inline variant)
  useEffect(() => {
    if (variant !== "inline") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        onTabChange("dashboard");
      } else if (e.key === "2") {
        e.preventDefault();
        onTabChange("randomizer");
      } else if (e.key === "3") {
        e.preventDefault();
        onTabChange("playlist");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTabChange, variant]);

  const navItems: Array<{
    id: NavTab;
    label: string;
    shortcut: string;
    badge?: boolean;
    icon: (active: boolean) => React.ReactNode;
  }> = [
    {
      id: "dashboard",
      label: t("header.guide") || "Dashboard",
      shortcut: "1",
      icon: (active) => (
        <ChartLineUp size={16} weight={active ? "fill" : "regular"} />
      ),
    },
    {
      id: "randomizer",
      label: "Randomizer",
      shortcut: "2",
      icon: (active) => (
        <Shuffle size={16} weight={active ? "fill" : "regular"} />
      ),
    },
    {
      id: "playlist",
      label: "Playlists",
      shortcut: "3",
      badge: isPlaylistRunning,
      icon: (active) => (
        <PlaylistIcon size={16} weight={active ? "fill" : "regular"} />
      ),
    },
  ];

  if (variant === "mobile-float") {
    return (
      <nav
        aria-label="Navegação móvel"
        className={cn(
          "md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40 liquid-float p-1.5 flex items-center gap-1 rounded-full shadow-float",
          className
        )}
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-label={`${item.label} (${item.shortcut})`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex h-9 px-3.5 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer select-none focus-visible:outline-none active:scale-95",
                isActive
                  ? "text-text-main font-semibold"
                  : "text-text-secondary hover:text-text-main"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="dock-mobile-pill"
                  transition={{
                    type: "spring",
                    stiffness: 460,
                    damping: 30,
                    mass: 0.75,
                  }}
                  className="absolute inset-0 rounded-full liquid-pill -z-10"
                />
              )}
              <span className="transition-transform duration-200 group-hover:scale-110">
                {item.icon(isActive)}
              </span>
              <span>{item.label}</span>
              {item.badge && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
              )}
            </button>
          );
        })}
        <div className="h-4 w-[1px] bg-edge mx-0.5" />
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={t("header.settings")}
          className="group flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:text-text-main transition-colors cursor-pointer press"
        >
          <Gear
            size={17}
            weight="regular"
            className="transition-transform duration-300 group-hover:rotate-45"
          />
        </button>
      </nav>
    );
  }

  return (
    <TooltipProvider>
      <nav
        aria-label="Navegação principal"
        className={cn(
          "liquid-well p-1 inline-flex items-center gap-1 rounded-full select-none",
          className
        )}
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <Tooltip
              key={item.id}
              side="bottom"
              sideOffset={10}
              content={
                <div className="flex items-center gap-2">
                  <span>{item.label}</span>
                  <Kbd>{item.shortcut}</Kbd>
                </div>
              }
            >
              <button
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-label={`${item.label} (atalho ${item.shortcut})`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative z-10 flex h-8 px-3.5 items-center justify-center gap-2 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer select-none focus-visible:outline-none active:scale-95",
                  isActive
                    ? "text-text-main font-semibold"
                    : "text-text-secondary hover:text-text-main"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="dock-active-pill"
                    transition={{
                      type: "spring",
                      stiffness: 460,
                      damping: 30,
                      mass: 0.75,
                    }}
                    className="absolute inset-0 rounded-full liquid-pill -z-10"
                  />
                )}
                <span
                  className={cn(
                    "inline-flex transition-transform duration-200",
                    isActive
                      ? "text-score scale-105"
                      : "group-hover:scale-110 group-hover:text-text-main"
                  )}
                >
                  {item.icon(isActive)}
                </span>
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-emerald"
                    title="Playlist ativa"
                  />
                )}
              </button>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
