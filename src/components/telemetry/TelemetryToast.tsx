import { CheckCircle, WarningCircle, XCircle, Info, Target } from "@phosphor-icons/react";
import { useApp } from "@/hooks/useAppData";
import type { ToastType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VariantConfig {
  icon: typeof Info;
  cls: string;
}

const VARIANTS: Record<ToastType, VariantConfig> = {
  info: { icon: Info, cls: "text-score bg-score-soft border-score/25" },
  success: { icon: CheckCircle, cls: "text-emerald bg-emerald-soft border-emerald-edge" },
  error: { icon: XCircle, cls: "text-red bg-red-soft border-red-edge" },
  warning: { icon: WarningCircle, cls: "text-amber bg-amber-soft border-amber-edge" },
};

export function TelemetryToast() {
  const { toast } = useApp();
  if (!toast.visible) return null;

  const config = VARIANTS[toast.type] ?? VARIANTS.info;
  const IconComponent = config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-6 right-6 z-50 liquid-glass-floating px-4 py-3 flex items-center gap-3",
        "rounded-2xl shadow-xl transition-all duration-300 animate-pop-in select-none font-mono text-xs max-w-sm"
      )}
    >
      <span
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 shadow-xs",
          config.cls
        )}
      >
        <IconComponent size={16} weight="bold" />
      </span>
      <div className="flex flex-col min-w-0 pr-1">
        <span className="text-[10px] uppercase font-bold text-text-faint tracking-wider flex items-center gap-1">
          <Target size={11} className="text-score" /> Telemetria
        </span>
        <span className="text-xs text-text-main font-semibold truncate">
          {toast.message}
        </span>
      </div>
    </div>
  );
}
