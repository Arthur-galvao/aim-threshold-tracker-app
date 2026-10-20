import { Tooltip } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface WatcherOrbProps {
  active: boolean;
  onToggle: () => void;
  className?: string;
}

export function WatcherOrb({ active, onToggle, className }: WatcherOrbProps) {
  const { t } = useI18n();
  const label = active
    ? t("header.watcherActive")
    : t("header.watcherInactive");

  return (
    <Tooltip
      side="bottom"
      sideOffset={8}
      content={
        <div className="flex items-center gap-2">
          <span>{label}</span>
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              active ? "bg-emerald" : "bg-text-faint"
            )}
          />
        </div>
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "liquid-pill relative flex h-8 items-center gap-2 px-3 rounded-full text-xs font-medium cursor-pointer select-none focus-visible:outline-none press",
          active ? "text-emerald border-emerald-edge" : "text-text-secondary",
          className
        )}
      >
        <span className="relative flex h-2 w-2 items-center justify-center">
          {active && (
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75"
              style={{
                animation: "pulse-ring 2s cubic-bezier(0.24, 0, 0.38, 1) infinite",
              }}
            />
          )}
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full transition-colors",
              active ? "bg-emerald" : "bg-text-faint"
            )}
          />
        </span>
        <span className="hidden lg:inline">{active ? "Watcher" : "Offline"}</span>
      </button>
    </Tooltip>
  );
}
