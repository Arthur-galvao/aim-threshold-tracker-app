import { CheckCircle, WarningCircle, XCircle, Info } from "@phosphor-icons/react";
import { useApp } from "@/hooks/useAppData";
import type { ToastType } from "@/lib/types";

interface VariantConfig {
  icon: typeof Info;
  cls: string;
}

const VARIANTS: Record<ToastType, VariantConfig> = {
  info: { icon: Info, cls: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  success: { icon: CheckCircle, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  error: { icon: XCircle, cls: "text-red-400 bg-red-500/10 border-red-500/30" },
  warning: { icon: WarningCircle, cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
};

export function Toast() {
  const { toast } = useApp();
  if (!toast.visible) return null;

  const config = VARIANTS[toast.type] ?? VARIANTS.info;
  const IconComponent = config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 panel px-4 py-2.5 flex items-center gap-3 shadow-overlay border border-edge rounded-xl transition-all duration-300 animate-pop-in"
    >
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center border ${config.cls} shrink-0`}>
        <IconComponent size={16} weight="bold" />
      </span>
      <span className="text-xs text-text-main font-medium pr-2">{toast.message}</span>
    </div>
  );
}
