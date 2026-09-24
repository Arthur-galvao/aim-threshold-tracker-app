import { useApp } from "@/hooks/useAppData";
import type { ToastType } from "@/lib/types";

const VARIANTS: Record<ToastType, { icon: string; cls: string }> = {
  info: { icon: "●", cls: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  success: { icon: "✓", cls: "text-emerald bg-emerald-500/10 border-emerald-500/30" },
  error: { icon: "✕", cls: "text-red bg-red-500/10 border-red-500/30" },
  warning: { icon: "!", cls: "text-amber bg-amber-500/10 border-amber-500/30" },
};

export function Toast() {
  const { toast } = useApp();
  if (!toast.visible) return null;

  const variant = VARIANTS[toast.type] ?? VARIANTS.info;

  return (
    <div className="fixed bottom-6 right-6 z-50 panel px-4 py-2.5 flex items-center gap-3 shadow-2xl border border-edge rounded-full transition-all duration-300 animate-in fade-in slide-in-from-bottom-3">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border ${variant.cls} shrink-0`}>
        {variant.icon}
      </span>
      <span className="text-xs text-text-main font-medium pr-2">{toast.message}</span>
    </div>
  );
}
