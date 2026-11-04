import { useEffect, useState } from "react";
import { useI18n, type Key } from "@/lib/i18n";
import { onMigrationProgress } from "@/lib/tauri-bridge";
import { cn } from "@/lib/utils";

const HIDE_DELAY_MS = 1500;

/** Pill discreta com o backfill do histórico no primeiro boot após atualizar (Plano 08, T8.8). */
export function MigrationProgress() {
  const { t } = useI18n();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let un: (() => void) | undefined;
    onMigrationProgress((p) => {
      if (!cancelled) setProgress(p);
    }).then((fn) => (cancelled ? fn() : (un = fn)));
    return () => {
      cancelled = true;
      un?.();
    };
  }, []);

  const finished = progress !== null && progress.total > 0 && progress.done >= progress.total;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!progress) return;
    if (!finished) {
      setVisible(true);
      return;
    }
    const timer = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [progress, finished]);

  if (!progress || !visible) return null;

  const { done, total } = progress;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const key = "migration.progress";
  const label = t(key as string as Key, { done, total });
  const text = label === key ? `Atualizando histórico: ${done}/${total}` : label;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "glass-float fixed bottom-4 left-4 z-40 flex flex-col gap-1.5 min-w-[200px] px-3 py-2",
        "rounded-control border border-glass-edge shadow-float text-xs text-text-main animate-pop-in pointer-events-none"
      )}
    >
      <span className="tabular-nums">{text}</span>
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-subtle">
        <div
          className="h-full bg-score transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
