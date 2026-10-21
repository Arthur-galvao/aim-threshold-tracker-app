import { Sparkle, X, Check } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import type { RecenterSuggestion } from "@/lib/sens-analytics";
import { Button } from "@/components/ui/Button";

export interface RecenterBannerProps {
  suggestion: RecenterSuggestion;
  onApply: () => Promise<void>;
  onDismiss: () => void;
}

export function RecenterBanner({
  suggestion,
  onApply,
  onDismiss,
}: RecenterBannerProps) {
  const { t } = useI18n();

  return (
    <div className="p-3 rounded-control liquid-well bg-amber-soft/50 border border-amber-edge text-xs text-amber flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Sparkle size={16} weight="fill" className="shrink-0 text-amber" />
        <span>
          {t("randomizer.recenterSuggestion")}:{" "}
          <strong className="font-mono">{suggestion.suggestedCm.toFixed(1)} cm</strong>{" "}
          ({t("randomizer.recenterCurrent")}:{" "}
          <span className="font-mono">{suggestion.currentCm.toFixed(1)} cm</span>)
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="ghost" size="sm" onClick={onDismiss} className="rounded-full">
          <X size={13} />
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void onApply()}
          icon={<Check size={13} />}
          className="rounded-full"
        >
          {t("randomizer.applySens")}
        </Button>
      </div>
    </div>
  );
}
