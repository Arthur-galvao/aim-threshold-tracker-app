import React, { createContext, useCallback, useContext, useState } from "react";
import { Check, Info, Warning, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss?: () => void;
}) {
  const icons: Record<ToastType, React.ReactNode> = {
    success: <Check size={16} className="text-emerald" weight="bold" />,
    error: <X size={16} className="text-red" weight="bold" />,
    warning: <Warning size={16} className="text-amber" weight="bold" />,
    info: <Info size={16} className="text-score" weight="bold" />,
  };

  const borderStyles: Record<ToastType, string> = {
    success: "border-emerald-edge",
    error: "border-red-edge",
    warning: "border-amber-edge",
    info: "border-glass-edge",
  };

  return (
    <div
      role="status"
      className={cn(
        "glass-float pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-control shadow-float animate-pop-in border text-xs text-text-main",
        borderStyles[toast.type]
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="shrink-0">{icons[toast.type]}</span>
        <span className="truncate">{toast.message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar notificação"
          className="shrink-0 text-text-faint hover:text-text-main transition cursor-pointer press p-0.5 rounded"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
