import { useState, useEffect, type FormEvent } from "react";
import {
  Folder,
  ArrowClockwise,
  DownloadSimple,
  UploadSimple,
  Sparkle,
  Trash,
  Play,
  Stop,
  MagnifyingGlass,
  Wrench,
  Palette,
  Check,
} from "@phosphor-icons/react";
import type { AppSettings, WatcherStatus } from "@/lib/types";
import { getSettings, pickStatsFolder, saveSettings } from "@/lib/tauri-bridge";
import { useI18n } from "@/lib/i18n";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { APP_THEMES, type AppTheme } from "@/lib/theme";

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
  currentTheme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
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
  currentTheme = "cyber-lab",
  onThemeChange,
}: SettingsModalProps) {
  const [manualPath, setManualPath] = useState(settingsPath ?? "");
  const [manualRawaccel, setManualRawaccel] = useState(rawaccelPath ?? "");
  const [closeToTray, setCloseToTray] = useState(propCloseToTray ?? true);
  const [autoDetectPlaylist, setAutoDetectPlaylist] = useState(propAutoDetectPlaylist ?? true);
  const [notifyStepAdvance, setNotifyStepAdvance] = useState(propNotifyStepAdvance ?? true);
  const { t } = useI18n();

  useEffect(() => {
    if (open) {
      setManualPath(settingsPath ?? "");
      setManualRawaccel(rawaccelPath ?? "");
    }
  }, [open, settingsPath, rawaccelPath]);

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
    <Dialog
      open={open}
      onClose={onClose}
      title={t("settings.title")}
      maxWidth="lg"
    >
      <div className="space-y-5 pb-4">
        {/* Status Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {t("settings.dir")}
            </label>
            <span
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                watcherStatus.active
                  ? "bg-emerald-soft text-emerald border-emerald-edge"
                  : "bg-red-soft text-red border-red-edge"
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

          <div className="bg-surface-subtle border border-edge rounded-md px-3.5 py-2.5 text-[10px] font-mono tracking-widest uppercase font-mono text-text-secondary break-all">
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
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {t("settings.manual")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              placeholder="C:\Steam\steamapps\common\FPSAimTrainer\FPSAimTrainer\stats"
              className="flex-1 minimal-input font-mono text-[10px] font-mono tracking-widest uppercase"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!manualPath.trim()}
              className="uppercase tracking-wider font-semibold whitespace-nowrap"
            >
              {t("settings.save")}
            </Button>
          </div>
        </form>

        {/* Folder Detection Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => void onDetectPath()}
            icon={<MagnifyingGlass size={14} weight="bold" />}
          >
            {t("settings.detect")}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => void handlePickFolder()}
            icon={<Folder size={14} weight="bold" />}
          >
            {t("settings.pick")}
          </Button>
        </div>

        {/* Watcher Controls */}
        <div className="flex gap-2 pt-2 border-t border-edge">
          <Button
            variant={watcherStatus.active ? "danger" : "secondary"}
            size="md"
            onClick={() => void onToggleWatcher()}
            disabled={!hasPath}
            className="flex-1 uppercase tracking-wider font-bold"
            icon={
              watcherStatus.active ? (
                <Stop size={14} weight="bold" />
              ) : (
                <Play size={14} weight="bold" />
              )
            }
          >
            {watcherStatus.active ? t("settings.stop") : t("settings.start")}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => void onReimport()}
            disabled={!hasPath}
            icon={<ArrowClockwise size={14} weight="bold" />}
          >
            {t("settings.reimport")}
          </Button>
        </div>

        {/* RawAccel Integration Section */}
        <div className="pt-4 border-t border-edge space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              {t("randomizer.rawaccelPath")}
            </label>
            <span
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                rawaccelAvailable
                  ? "bg-emerald-soft text-emerald border-emerald-edge"
                  : "bg-red-soft text-red border-red-edge"
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

          <div className="bg-surface-subtle border border-edge rounded-md px-3.5 py-2 text-[10px] font-mono tracking-widest uppercase font-mono text-text-secondary break-all">
            {rawaccelPath ?? t("settings.rawaccelNone")}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={manualRawaccel}
              onChange={(e) => setManualRawaccel(e.target.value)}
              placeholder={t("settings.rawaccelPh")}
              className="flex-1 minimal-input font-mono text-[10px] font-mono tracking-widest uppercase"
            />
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => {
                if (manualRawaccel.trim() && onUpdateRawaccelPath) {
                  void onUpdateRawaccelPath(manualRawaccel.trim());
                }
              }}
              disabled={!manualRawaccel.trim()}
              className="uppercase tracking-wider font-semibold whitespace-nowrap"
            >
              {t("settings.save")}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="secondary"
              size="md"
              onClick={async () => {
                if (onDetectRawaccel) {
                  const detected = await onDetectRawaccel();
                  if (detected) setManualRawaccel(detected);
                }
              }}
              icon={<MagnifyingGlass size={14} weight="bold" />}
            >
              {t("randomizer.detectPath")}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                if (onTestRawaccel) {
                  void onTestRawaccel();
                }
              }}
              disabled={!rawaccelAvailable}
              icon={<Wrench size={14} weight="bold" />}
            >
              {t("randomizer.testWriter")}
            </Button>
          </div>
        </div>

        {/* Background & Automation Section */}
        <div className="space-y-3 pt-3 border-t border-edge">
          <div>
            <h4 className="text-[10px] font-mono tracking-widest uppercase font-bold uppercase tracking-wider text-text-main">
              {t("settings.automationSection")}
            </h4>
          </div>

          <div className="space-y-2">
            {/* Close to Tray Toggle */}
            <div
              onClick={() => void handleToggleCloseToTray(!closeToTray)}
              className="flex items-center justify-between gap-3 p-3 rounded-md border border-edge bg-surface-subtle/40 hover:bg-surface-subtle/80 transition-colors cursor-pointer select-none"
            >
              <div className="flex-1 min-w-0 pr-2">
                <span className="block text-[10px] font-mono tracking-widest uppercase font-semibold text-text-main">
                  {t("settings.closeToTray")}
                </span>
                <p className="text-[11px] text-text-muted leading-snug mt-0.5">
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
              className="flex items-center justify-between gap-3 p-3 rounded-md border border-edge bg-surface-subtle/40 hover:bg-surface-subtle/80 transition-colors cursor-pointer select-none"
            >
              <div className="flex-1 min-w-0 pr-2">
                <span className="block text-[10px] font-mono tracking-widest uppercase font-semibold text-text-main">
                  {t("settings.autoDetectPlaylist")}
                </span>
                <p className="text-[11px] text-text-muted leading-snug mt-0.5">
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
              className="flex items-center justify-between gap-3 p-3 rounded-md border border-edge bg-surface-subtle/40 hover:bg-surface-subtle/80 transition-colors cursor-pointer select-none"
            >
              <div className="flex-1 min-w-0 pr-2">
                <span className="block text-[10px] font-mono tracking-widest uppercase font-semibold text-text-main">
                  {t("settings.notifyStepAdvance")}
                </span>
                <p className="text-[11px] text-text-muted leading-snug mt-0.5">
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

        {/* Visual Theme Selection */}
        {onThemeChange && (
          <div className="space-y-3 pt-3 border-t border-edge">
            <div>
              <h4 className="text-[10px] font-mono tracking-widest uppercase font-bold uppercase tracking-wider text-text-main flex items-center gap-1.5">
                <Palette size={13} weight="bold" className="text-score" />
                <span>{t("theme.title")}</span>
              </h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                {t("theme.subtitle")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {APP_THEMES.map((th) => {
                const isSelected = th.id === currentTheme;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => onThemeChange(th.id)}
                    className={`p-2.5 rounded-lg border text-left font-mono transition-all flex items-start gap-2.5 cursor-pointer select-none ${
                      isSelected
                        ? "bg-surface-subtle border-score/40 shadow-xs"
                        : "bg-surface/60 border-edge hover:border-edge-strong hover:bg-surface"
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 shadow-xs"
                      style={{ backgroundColor: th.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold text-text-main truncate">
                          {th.name}
                        </span>
                        {isSelected && (
                          <Check size={12} weight="bold" className="text-score shrink-0" />
                        )}
                      </div>
                      <p className="text-[9px] text-text-muted line-clamp-1 mt-0.5 leading-tight">
                        {th.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Data Management Section */}
        <div className="space-y-3 pt-3 border-t border-edge">
          <div>
            <h4 className="text-[10px] font-mono tracking-widest uppercase font-bold uppercase tracking-wider text-text-main">
              {t("settings.dataTitle")}
            </h4>
            <p className="text-[11px] text-text-muted mt-0.5">
              {t("settings.dataSubtitle")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {onExport && (
              <Button
                variant="secondary"
                size="md"
                onClick={onExport}
                icon={<DownloadSimple size={14} weight="bold" />}
              >
                {t("settings.exportBtn")}
              </Button>
            )}

            {onImport && (
              <label className="inline-flex items-center justify-center font-sans tracking-tight cursor-pointer select-none h-8 px-3 text-[10px] font-mono tracking-widest uppercase gap-2 rounded-lg font-medium bg-surface-subtle text-text-main border border-edge hover:bg-surface-hover hover:border-edge-strong active:scale-[0.985] transition-all duration-150">
                <UploadSimple size={14} weight="bold" />
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
              <Button
                variant="secondary"
                size="md"
                onClick={onLoadDemo}
                icon={<Sparkle size={14} weight="bold" />}
              >
                {t("settings.demoBtn")}
              </Button>
            )}

            {onClear && (
              <Button
                variant="danger"
                size="md"
                onClick={() => {
                  if (window.confirm(t("settings.clearConfirm"))) {
                    onClear();
                  }
                }}
                icon={<Trash size={14} weight="bold" />}
              >
                {t("settings.clearBtn")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
