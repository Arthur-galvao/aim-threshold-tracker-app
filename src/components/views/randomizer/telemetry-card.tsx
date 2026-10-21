import { useMemo } from "react";
import {
  CheckCircle,
  MagnifyingGlass,
  Shuffle,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import type {
  RandomizerSettings,
  RandomizerState,
} from "@/hooks/useSensRandomizer";
import { Badge, Button, NumberTicker, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface TelemetryCardProps {
  settings: RandomizerSettings;
  randomizerState: RandomizerState;
  rawaccelAvailable: boolean;
  testing: boolean;
  onDetectPath: () => Promise<string | null>;
  onTestWriter: (customPath?: string) => Promise<string>;
  onToggleEnabled?: () => Promise<void>;
  onTriggerRandomize?: () => Promise<void>;
  className?: string;
  style?: React.CSSProperties;
}

export function TelemetryCard({
  settings,
  randomizerState,
  rawaccelAvailable,
  testing,
  onDetectPath,
  onTestWriter,
  onToggleEnabled,
  onTriggerRandomize,
  className,
  style,
}: TelemetryCardProps) {
  const { t } = useI18n();

  const safeActiveSensCm = Number.isFinite(randomizerState?.activeSensCm)
    ? randomizerState.activeSensCm
    : settings?.baseSensCm || 40.0;

  const safeActiveMult = Number.isFinite(randomizerState?.activeMult)
    ? randomizerState.activeMult
    : 1.0;

  const multDeltaPercent = useMemo(() => {
    return (safeActiveMult - 1.0) * 100;
  }, [safeActiveMult]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <section
      style={style}
      onMouseMove={handleMouseMove}
      className={cn(
        "liquid-surface liquid-interactive p-4 rounded-tile flex flex-col gap-3",
        className
      )}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-4">
        {/* Left (4 cols): Master Toggle & Driver Status */}
        <div className="lg:col-span-4 flex items-center justify-between lg:justify-start gap-3.5">
          {onToggleEnabled && (
            <Switch
              checked={Boolean(settings?.enabled)}
              disabled={!rawaccelAvailable}
              onCheckedChange={() => void onToggleEnabled()}
              aria-label={t("randomizer.enable")}
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs font-semibold text-text-main">
                {t("randomizer.enable")}
              </h2>
              <Badge variant={rawaccelAvailable ? "emerald" : "red"}>
                {rawaccelAvailable ? (
                  <>
                    <CheckCircle
                      size={12}
                      weight="fill"
                      className="text-emerald"
                    />
                    <span>{t("randomizer.ready")}</span>
                  </>
                ) : (
                  <>
                    <WarningCircle
                      size={12}
                      weight="fill"
                      className="text-red"
                    />
                    <span>{t("randomizer.notReady")}</span>
                  </>
                )}
              </Badge>
            </div>
            <p className="text-[11px] text-text-faint truncate mt-0.5 font-mono">
              {settings?.rawaccelDir || t("randomizer.noPathDetected")}
            </p>
          </div>
        </div>

        {/* Center (5 cols): Live Sensitivity & Multiplier Optical Well */}
        <div className="lg:col-span-5 liquid-well px-4 py-2.5 flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] text-text-faint font-medium block">
              {t("randomizer.activeSens")}
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <NumberTicker
                value={safeActiveSensCm}
                decimalPlaces={1}
                className="text-2xl font-bold text-text-main tabular"
              />
              <span className="text-xs font-mono text-text-secondary">
                cm/360
              </span>
            </div>
          </div>

          <div className="h-7 w-[1px] bg-edge" />

          <div className="text-right">
            <span className="text-[10px] text-text-faint font-medium block">
              {t("randomizer.activeMult")}
            </span>
            <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
              <NumberTicker
                value={safeActiveMult}
                decimalPlaces={2}
                suffix="x"
                className="text-xl font-mono font-bold text-score tabular"
              />
              <span
                className={cn(
                  "text-xs font-mono font-semibold tabular",
                  multDeltaPercent > 0
                    ? "text-emerald"
                    : multDeltaPercent < 0
                    ? "text-amber"
                    : "text-text-faint"
                )}
              >
                ({multDeltaPercent >= 0 ? "+" : ""}
                {multDeltaPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Right (3 cols): Instant Reroll & Driver Actions */}
        <div className="lg:col-span-3 flex items-center justify-end gap-2">
          {!rawaccelAvailable && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onDetectPath()}
              icon={<MagnifyingGlass size={13} />}
              className="rounded-full"
            >
              {t("randomizer.detectPath")}
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            loading={testing}
            disabled={!rawaccelAvailable}
            onClick={() => void onTestWriter()}
            icon={<Wrench size={13} />}
            className="rounded-full"
          >
            {t("randomizer.testWriter")}
          </Button>

          {onTriggerRandomize && (
            <Button
              variant="primary"
              size="sm"
              disabled={!settings?.enabled || !rawaccelAvailable}
              onClick={() => void onTriggerRandomize()}
              icon={<Shuffle size={14} weight="bold" />}
              className="rounded-full"
            >
              {t("randomizer.rollNow")}
            </Button>
          )}
        </div>
      </div>

      {/* Warning banner if RawAccel GUI is open */}
      {randomizerState?.rawaccelGuiRunning && (
        <div className="px-3.5 py-2 rounded-control bg-amber-soft border border-amber-edge text-xs text-amber flex items-center gap-2">
          <WarningCircle size={15} weight="fill" className="shrink-0" />
          <span className="font-medium">
            {t("randomizer.rawaccelGuiRunning")}
          </span>
        </div>
      )}
    </section>
  );
}
