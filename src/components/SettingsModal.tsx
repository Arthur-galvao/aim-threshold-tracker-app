import { useState, useEffect, type FormEvent } from "react";
import type { AppSettings, WatcherStatus } from "@/lib/types";
import { getSettings, pickStatsFolder, saveSettings } from "@/lib/tauri-bridge";
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
  rawaccelPath?: string | null;
  rawaccelAvailable?: boolean;
  onDetectRawaccel?: () => Promise<string | null>;
  onUpdateRawaccelPath?: (path: string) => Promise<void>;
  onTestRawaccel?: () => Promise<any>;
  onExport?: () => void;
  onImport?: (file: File) => void;
  onLoadDemo?: () => void;
  onClear?: () => void;
  closeToTray?: boolean;
  autoDetectPlaylist?: boolean;
  notifyStepAdvance?: boolean;
  onUpdateAppSettings?: (settings: Partial<AppSettings>) => Promise<void>;
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
  rawaccelPath,
  rawaccelAvailable,
  onDetectRawaccel,
  onUpdateRawaccelPath,
  onTestRawaccel,
  onExport,
  onImport,
  onLoadDemo,
  onClear,
  closeToTray: propCloseToTray,
  autoDetectPlaylist: propAutoDetectPlaylist,
  notifyStepAdvance: propNotifyStepAdvance,
  onUpdateAppSettings,
}: SettingsModalProps) {
  const [manualPath, setManualPath] = useState(settingsPath ?? "");
  const [manualRawaccel, setManualRawaccel] = useState(rawaccelPath ?? "");
  const [closeToTray, setCloseToTray] = useState(propCloseToTray ?? true);
  const [autoDetectPlaylist, setAutoDetectPlaylist] = useState(propAutoDetectPlaylist ?? true);
  const [notifyStepAdvance, setNotifyStepAdvance] = useState(propNotifyStepAdvance ?? true);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;

    if (propCloseToTray !== undefined) {
      setCloseToTray(propCloseToTray);
    }
    if (propAutoDetectPlaylist !== undefined) {
      setAutoDetectPlaylist(propAutoDetectPlaylist);
    }
    if (propNotifyStepAdvance !== undefined) {
      setNotifyStepAdvance(propNotifyStepAdvance);
    }

    if (
      propCloseToTray === undefined ||
      propAutoDetectPlaylist === undefined ||
      propNotifyStepAdvance === undefined
    ) {
      void getSettings().then((s) => {
        if (propCloseToTray === undefined && s.close_to_tray !== undefined) {
          setCloseToTray(s.close_to_tray);
        }
        if (propAutoDetectPlaylist === undefined && s.auto_detect_playlist !== undefined) {
          setAutoDetectPlaylist(s.auto_detect_playlist);
        }
        if (propNotifyStepAdvance === undefined && s.notify_step_advance !== undefined) {
          setNotifyStepAdvance(s.notify_step_advance);
        }
      });
    }
  }, [open, propCloseToTray, propAutoDetectPlaylist, propNotifyStepAdvance]);

  const handleToggleCloseToTray = async (val: boolean) => {
    setCloseToTray(val);
    if (onUpdateAppSettings) {
      await onUpdateAppSettings({ close_to_tray: val });
    } else {
      const current = await getSettings();
      await saveSettings({ ...current, close_to_tray: val });
    }
  };

  const handleToggleAutoDetectPlaylist = async (val: boolean) => {
    setAutoDetectPlaylist(val);
    if (onUpdateAppSettings) {
      await onUpdateAppSettings({ auto_detect_playlist: val });
    } else {
      const current = await getSettings();
      await saveSettings({ ...current, auto_detect_playlist: val });
    }
  };

  const handleToggleNotifyStepAdvance = async (val: boolean) => {
    setNotifyStepAdvance(val);
    if (onUpdateAppSettings) {
      await onUpdateAppSettings({ notify_step_advance: val });
    } else {
      const current = await getSettings();
      await saveSettings({ ...current, notify_step_advance: val });
    }
  };

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
      <div className="panel p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl transition-all duration-200">
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
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
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

          {/* RawAccel Integration Section */}
          <div className="pt-4 border-t border-edge space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint">
                {t("randomizer.rawaccelPath")}
              </label>
              <span
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  rawaccelAvailable
                    ? "bg-emerald-500/10 text-emerald border-emerald-500/30"
                    : "bg-red-500/10 text-red border-red-500/30"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    rawaccelAvailable ? "bg-emerald animate-pulse" : "bg-red"
                  }`}
                />
                {rawaccelAvailable ? t("randomizer.ready") : t("randomizer.notReady")}
              </span>
            </div>

            <div className="bg-surface-subtle border border-edge rounded-xl px-3.5 py-2 text-xs font-mono text-text-secondary break-all">
              {rawaccelPath ?? t("settings.rawaccelNone")}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={manualRawaccel}
                onChange={(e) => setManualRawaccel(e.target.value)}
                placeholder={t("settings.rawaccelPh")}
                className="flex-1 minimal-input font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (manualRawaccel.trim() && onUpdateRawaccelPath) {
                    void onUpdateRawaccelPath(manualRawaccel.trim());
                  }
                }}
                disabled={!manualRawaccel.trim()}
                className="px-3.5 py-2 rounded-full minimal-btn text-xs font-bold uppercase tracking-wider disabled:opacity-40"
              >
                {t("settings.save")}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  if (onDetectRawaccel) {
                    const detected = await onDetectRawaccel();
                    if (detected) setManualRawaccel(detected);
                  }
                }}
                className="px-3 py-2 minimal-btn-secondary text-xs font-medium rounded-full"
              >
                {t("randomizer.detectPath")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onTestRawaccel) {
                    void onTestRawaccel();
                  }
                }}
                disabled={!rawaccelAvailable}
                className="px-3 py-2 minimal-btn-secondary text-xs font-medium rounded-full disabled:opacity-40"
              >
                {t("randomizer.testWriter")}
              </button>
            </div>
          </div>

          {/* Background & Automation Section */}
          <div className="space-y-3 pt-3 border-t border-edge">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-main">
                {t("settings.automationSection")}
              </h4>
            </div>

            <div className="space-y-2">
              {/* Close to Tray Toggle */}
              <div
                onClick={() => void handleToggleCloseToTray(!closeToTray)}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-edge bg-surface-subtle/40 hover:bg-surface-subtle/80 transition-colors cursor-pointer select-none"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <span className="block text-xs font-semibold text-text-main">
                    {t("settings.closeToTray")}
                  </span>
                  <p className="text-[11px] text-text-faint leading-snug mt-0.5">
                    {t("settings.closeToTrayDesc")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={closeToTray}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleToggleCloseToTray(!closeToTray);
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    closeToTray ? "bg-accent" : "bg-edge-strong"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      closeToTray ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Auto Detect Playlist Toggle */}
              <div
                onClick={() => void handleToggleAutoDetectPlaylist(!autoDetectPlaylist)}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-edge bg-surface-subtle/40 hover:bg-surface-subtle/80 transition-colors cursor-pointer select-none"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <span className="block text-xs font-semibold text-text-main">
                    {t("settings.autoDetectPlaylist")}
                  </span>
                  <p className="text-[11px] text-text-faint leading-snug mt-0.5">
                    {t("settings.autoDetectPlaylistDesc")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoDetectPlaylist}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleToggleAutoDetectPlaylist(!autoDetectPlaylist);
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoDetectPlaylist ? "bg-accent" : "bg-edge-strong"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      autoDetectPlaylist ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Notify Step Advance Toggle */}
              <div
                onClick={() => void handleToggleNotifyStepAdvance(!notifyStepAdvance)}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-edge bg-surface-subtle/40 hover:bg-surface-subtle/80 transition-colors cursor-pointer select-none"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <span className="block text-xs font-semibold text-text-main">
                    {t("settings.notifyStepAdvance")}
                  </span>
                  <p className="text-[11px] text-text-faint leading-snug mt-0.5">
                    {t("settings.notifyStepAdvanceDesc")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyStepAdvance}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleToggleNotifyStepAdvance(!notifyStepAdvance);
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notifyStepAdvance ? "bg-accent" : "bg-edge-strong"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      notifyStepAdvance ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Data Management Section */}
          <div className="space-y-3 pt-3 border-t border-edge">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-main">
                {t("settings.dataTitle")}
              </h4>
              <p className="text-[11px] text-text-faint mt-0.5">
                {t("settings.dataSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {onExport && (
                <button
                  type="button"
                  onClick={onExport}
                  className="px-3 py-2 minimal-btn-secondary text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>{t("settings.exportBtn")}</span>
                </button>
              )}

              {onImport && (
                <label className="px-3 py-2 minimal-btn-secondary text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer">
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>{t("settings.importBtn")}</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onImport(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}

              {onLoadDemo && (
                <button
                  type="button"
                  onClick={onLoadDemo}
                  className="px-3 py-2 minimal-btn-secondary text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
                >
                  <span>{t("settings.demoBtn")}</span>
                </button>
              )}

              {onClear && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t("settings.clearConfirm"))) {
                      onClear();
                    }
                  }}
                  className="px-3 py-2 minimal-btn-secondary text-xs font-semibold rounded-xl text-rose-400 hover:text-rose-300 border-rose-500/20 hover:border-rose-500/40 flex items-center justify-center gap-1.5"
                >
                  <span>{t("settings.clearBtn")}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

