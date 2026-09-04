import { useState, type FormEvent } from "react";
import type { WatcherStatus } from "@/lib/types";
import { pickStatsFolder } from "@/lib/tauri-bridge";
import { useI18n } from "@/lib/i18n";

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
    <div className="fixed inset-0 modal-scrim z-50 flex items-center justify-center p-4">
      <div className="panel p-6 max-w-lg w-full shadow-2xl rounded-2xl transition-all duration-200">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-edge pb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center">
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-main">
              {t("settings.title")}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-text-faint hover:text-text-main hover:bg-surface-subtle transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 mt-4">
          {/* Status Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint">
                {t("settings.dir")}
              </label>
              <span
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                  watcherStatus.active
                    ? "bg-emerald-500/10 text-emerald border-emerald-500/30"
                    : "bg-red-500/10 text-red border-red-500/30"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    watcherStatus.active ? "bg-emerald animate-pulse" : "bg-red"
                  }`}
                />
                {watcherStatus.active ? t("settings.active") : t("settings.inactive")}
              </span>
            </div>

            <div className="bg-surface-subtle border border-edge rounded-xl px-3.5 py-2.5 text-xs font-mono text-text-secondary break-all">
              {settingsPath ?? t("settings.none")}
            </div>

            {watcherStatus.error && (
              <p className="mt-1.5 text-[11px] text-red font-medium">
                {watcherStatus.error}
              </p>
            )}
          </div>

          {/* Manual Path Form */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint">
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
                className="px-4 py-2 rounded-full minimal-btn text-xs font-bold uppercase tracking-wider whitespace-nowrap disabled:opacity-40"
              >
                {t("settings.save")}
              </button>
            </div>
          </form>

          {/* Folder Detection Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void onDetectPath()}
              className="px-3.5 py-2 minimal-btn-secondary text-xs font-medium rounded-full"
            >
              {t("settings.detect")}
            </button>
            <button
              onClick={() => void handlePickFolder()}
              className="px-3.5 py-2 minimal-btn-secondary text-xs font-medium rounded-full"
            >
              {t("settings.pick")}
            </button>
          </div>

          {/* Watcher Controls */}
          <div className="flex gap-2 pt-2 border-t border-edge">
            <button
              onClick={() => void onToggleWatcher()}
              disabled={!hasPath}
              className={`flex-1 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 border ${
                watcherStatus.active
                  ? "bg-red-500/10 text-red border-red-500/30 hover:bg-red-500/20"
                  : "bg-emerald-500/10 text-emerald border-emerald-500/30 hover:bg-emerald-500/20"
              }`}
            >
              {watcherStatus.active ? t("settings.stop") : t("settings.start")}
            </button>
            <button
              onClick={() => void onReimport()}
              disabled={!hasPath}
              className="px-4 py-2.5 minimal-btn-secondary text-xs font-semibold rounded-full disabled:opacity-40"
            >
              {t("settings.reimport")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

