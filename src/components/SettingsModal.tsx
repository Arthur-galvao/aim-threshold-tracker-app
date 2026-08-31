import { useState, type FormEvent } from "react";
import type { WatcherStatus } from "@/lib/types";
import { pickStatsFolder } from "@/lib/tauri-bridge";
import { useI18n } from "@/lib/i18n";
import { GUIDE_URL } from "@/lib/links";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  watcherStatus: WatcherStatus;
  settingsPath: string | null;
  onDetectPath: () => Promise<void>;
  onUpdatePath: (path: string) => Promise<void>;
  onToggleWatcher: () => Promise<void>;
  onReimport: () => Promise<void>;
}

export function SettingsModal({
  open,
  onClose,
  watcherStatus,
  settingsPath,
  onDetectPath,
  onUpdatePath,
  onToggleWatcher,
  onReimport,
}: SettingsModalProps) {
  const [manualPath, setManualPath] = useState(settingsPath ?? "");
  const { t } = useI18n();

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!manualPath.trim()) return;
    void onUpdatePath(manualPath.trim());
  };

  const handlePickFolder = async () => {
    const picked = await pickStatsFolder();
    if (picked) {
      setManualPath(picked);
      await onUpdatePath(picked);
    }
  };

  const hasPath = Boolean(settingsPath);

  return (
    <div className="fixed inset-0 modal-scrim backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="panel bg-surface p-6 max-w-lg w-full shadow-2xl border-edge-strong transition-colors">
        <div className="flex justify-between items-center border-b border-edge pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-main">
            {t("settings.title")}
          </h3>
          <button
            onClick={onClose}
            className="text-text-faint hover:text-text-main text-sm"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 mt-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-medium uppercase tracking-wider text-text-faint">
                {t("settings.dir")}
              </label>
              <span
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border ${
                  watcherStatus.active
                    ? "bg-emerald-soft text-emerald border-emerald-edge"
                    : "bg-red-soft text-red border-red-edge"
                }`}
              >
                {watcherStatus.active ? t("settings.active") : t("settings.inactive")}
              </span>
            </div>

            <div className="bg-surface-subtle border border-edge rounded-lg px-3 py-2 text-xs font-mono text-text-secondary break-all">
              {settingsPath ?? t("settings.none")}
            </div>

            {watcherStatus.error && (
              <p className="mt-1.5 text-[11px] text-red font-mono">
                {watcherStatus.error}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-2">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-text-faint">
              {t("settings.manual")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                placeholder="C:\Steam\steamapps\common\FPSAimTrainer\FPSAimTrainer\stats"
                className="flex-1 minimal-input font-mono text-xs"
              />
              <button
                type="submit"
                disabled={!manualPath.trim()}
                className="px-3 py-2 minimal-btn text-xs font-semibold whitespace-nowrap disabled:opacity-40"
              >
                {t("settings.save")}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void onDetectPath()}
              className="px-3 py-2 minimal-btn-secondary text-xs"
            >
              {t("settings.detect")}
            </button>
            <button
              onClick={() => void handlePickFolder()}
              className="px-3 py-2 minimal-btn-secondary text-xs"
            >
              {t("settings.pick")}
            </button>
          </div>

          <div className="flex gap-2 pt-2 border-t border-edge">
            <button
              onClick={() => void onToggleWatcher()}
              disabled={!hasPath}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-40 border ${
                watcherStatus.active
                  ? "bg-red-soft text-red border-red-edge hover:opacity-90"
                  : "bg-emerald-soft text-emerald border-emerald-edge hover:opacity-90"
              }`}
            >
              {watcherStatus.active ? t("settings.stop") : t("settings.start")}
            </button>
            <button
              onClick={() => void onReimport()}
              disabled={!hasPath}
              className="px-3 py-2 minimal-btn-secondary text-xs disabled:opacity-40"
            >
              {t("settings.reimport")}
            </button>
          </div>

          <button
            onClick={() => window.open(GUIDE_URL, "_blank")}
            className="w-full px-3 py-2.5 minimal-btn-secondary text-xs"
          >
            {t("settings.guide")}
          </button>
        </div>
      </div>
    </div>
  );
}
