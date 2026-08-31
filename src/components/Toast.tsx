import { useApp } from "@/hooks/useAppData";

const ICONS: Record<string, string> = {
  info: "●",
  success: "✓",
  error: "✕",
  warning: "!",
};

const COLORS: Record<string, string> = {
  info: "text-text-main",
  success: "text-emerald",
  error: "text-red",
  warning: "text-amber",
};

export function Toast() {
  const { toast } = useApp();

  if (!toast.visible) return null;

  return (
    <div className="fixed bottom-5 right-5 panel bg-surface px-4 py-2.5 flex items-center space-x-3 z-50 shadow-xl border-edge-strong transition-all duration-200">
      <span className={`${COLORS[toast.type]} font-mono font-bold text-xs`}>
        {ICONS[toast.type]}
      </span>
      <span className="text-xs text-text-main font-medium">{toast.message}</span>
    </div>
  );
}
