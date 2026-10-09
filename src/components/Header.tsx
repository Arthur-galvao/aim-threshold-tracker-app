import type { WatcherStatus } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { NotePencil, Gear, Crosshair } from "@phosphor-icons/react";

interface HeaderProps {
  activeTab: "dashboard" | "randomizer" | "playlist";
  onTabChange: (tab: "dashboard" | "randomizer" | "playlist") => void;
  rawaccelAvailable: boolean;
  onOpenSettings: () => void;
  onOpenAimlab: () => void;
  watcherStatus: WatcherStatus;
  onNewSession?: () => void;
}

export function Header({
  activeTab,
  onTabChange,
  rawaccelAvailable: _rawaccelAvailable,
  onOpenSettings,
  onOpenAimlab,
  watcherStatus: _watcherStatus,
  onNewSession,
}: HeaderProps) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 bg-[#090b10]/95 backdrop-blur-md border-b border-edge transition-colors duration-150">
      <div className="w-full px-6 py-2.5 min-h-[54px] flex items-center justify-between gap-4">
        {/* Left: App Title and Pill Tabs */}
        <div className="flex items-center gap-6 shrink-0 min-w-0">
          <span className="text-[13px] font-mono font-semibold tracking-wider text-text-main truncate">
            AIM THRESHOLD TRACKER
          </span>

          <div className="flex items-center gap-1 bg-[#12141e] border border-edge rounded-full p-0.5">
            <button
              type="button"
              onClick={() => onTabChange("dashboard")}
              className={`h-7 px-3.5 text-xs font-mono rounded-full transition-colors cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-surface-subtle text-text-main shadow-xs font-medium"
                  : "text-text-faint hover:text-text-main"
              }`}
            >
              {t("tab.dashboard")}
            </button>
            <button
              type="button"
              onClick={() => onTabChange("playlist")}
              className={`h-7 px-3.5 text-xs font-mono rounded-full transition-colors cursor-pointer ${
                activeTab === "playlist"
                  ? "bg-surface-subtle text-text-main shadow-xs font-medium"
                  : "text-text-faint hover:text-text-main"
              }`}
            >
              {t("tab.playlist")}
            </button>
            <button
              type="button"
              onClick={() => onTabChange("randomizer")}
              className={`h-7 px-3.5 text-xs font-mono rounded-full transition-colors cursor-pointer ${
                activeTab === "randomizer"
                  ? "bg-surface-subtle text-text-main shadow-xs font-medium"
                  : "text-text-faint hover:text-text-main"
              }`}
            >
              {t("tab.randomizer")}
            </button>
          </div>
        </div>

        {/* Right: Action Buttons and Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {onNewSession && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={onNewSession}
                className="h-8 px-3.5 text-[11px] font-mono rounded bg-transparent hover:bg-surface-hover border border-edge text-text-main flex items-center gap-2 cursor-pointer"
              >
                <NotePencil size={14} weight="regular" className="text-text-faint" />
                <span>+ {t("session.title")}</span>
              </Button>
            </div>
          )}

          <button
            type="button"
            onClick={onOpenAimlab}
            title="Aim Lab Integration"
            className="w-8 h-8 rounded-md border border-edge bg-transparent hover:bg-surface-hover text-text-faint hover:text-text-main flex items-center justify-center transition-colors cursor-pointer"
          >
            <Crosshair size={15} weight="regular" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title={t("header.settings")}
            className="w-8 h-8 rounded-md border border-edge bg-transparent hover:bg-surface-hover text-text-faint hover:text-text-main flex items-center justify-center transition-colors cursor-pointer"
          >
            <Gear size={15} weight="regular" />
          </button>
        </div>
      </div>
    </header>
  );
}