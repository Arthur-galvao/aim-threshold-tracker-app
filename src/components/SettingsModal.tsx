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
  const [mouseDpi, setMouseDpi] = useState(800);
  const [dpiInputText, setDpiInputText] = useState("800");
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

    void getSettings().then((s) => {
      if (s.mouse_dpi !== undefined) {
        setMouseDpi(s.mouse_dpi);
        setDpiInputText(String(s.mouse_dpi));
      }
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
  }, [open, propCloseToTray, propAutoDetectPlaylist, propNotifyStepAdvance]);

  const handleDpiChange = async (val: number) => {
    setMouseDpi(val);
    setDpiInputText(String(val));
    if (onUpdateAppSettings) {
      await onUpdateAppSettings({ mouse_dpi: val });
    } else {
      const current = await getSettings();
      await saveSettings({ ...current, mouse_dpi: val });
    }
  };

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
      className="glass-floating"
    >
      <div className="space-y-6 pb-2">
        {/* Status & KovaaK Directory Section */}
        <section className="enter space-y-2" style={{ "--i": 0 } as React.CSSProperties}>
          <div className="flex items-center justify-between px-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
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

          <div className="bg-surface-subtle/60 border border-edge rounded-2xl p-3.5 space-y-3">
            <div className="font-mono text-xs text-text-secondary break-all bg-surface/50 border border-edge rounded-xl px-3 py-2">
              {settingsPath ?? t("settings.none")}
            </div>

            {watcherStatus.error && (
              <p className="text-[11px] text-red font-medium">
                {watcherStatus.error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                placeholder="C:\Steam\steamapps\common\FPSAimTrainer\FPSAimTrainer\stats"
                className="flex-1 glass-input font-mono text-xs"
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!manualPath.trim()}
                className="press font-semibold whitespace-nowrap"
              >
                {t("settings.save")}
              </Button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <Button
                variant="secondary"
                size="md"
                onClick={() => void onDetectPath()}
                className="press"
                icon={<MagnifyingGlass size={14} weight="bold" />}
              >
                {t("settings.detect")}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => void handlePickFolder()}
                className="press"
                icon={<Folder size={14} weight="bold" />}
              >
                {t("settings.pick")}
              </Button>
            </div>
          </div>
        </section>

        {/* Watcher Controls */}
        <div className="enter flex gap-2" style={{ "--i": 1 } as React.CSSProperties}>
          <Button
            variant={watcherStatus.active ? "danger" : "secondary"}
            size="md"
            onClick={() => void onToggleWatcher()}
            disabled={!hasPath}
            className="flex-1 press font-semibold"
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
            className="press"
            icon={<ArrowClockwise size={14} weight="bold" />}
          >
            {t("settings.reimport")}
          </Button>
        </div>

        {/* RawAccel Integration Section */}
        <section className="enter space-y-2" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="flex items-center justify-between px-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
              {t("randomizer.rawaccelPath")}
            </label>
            <span
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
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

          <div className="bg-surface-subtle/60 border border-edge rounded-2xl p-3.5 space-y-3">
            <div className="font-mono text-xs text-text-secondary break-all bg-surface/50 border border-edge rounded-xl px-3 py-2">
              {rawaccelPath ?? t("settings.rawaccelNone")}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={manualRawaccel}
                onChange={(e) => setManualRawaccel(e.target.value)}
                placeholder={t("settings.rawaccelPh")}
                className="flex-1 glass-input font-mono text-xs"
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
                className="press font-semibold whitespace-nowrap"
              >
                {t("settings.save")}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <Button
                variant="secondary"
                size="md"
                onClick={async () => {
                  if (onDetectRawaccel) {
                    const detected = await onDetectRawaccel();
                    if (detected) setManualRawaccel(detected);
                  }
                }}
                className="press"
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
                className="press"
                icon={<Wrench size={14} weight="bold" />}
              >
                {t("randomizer.testWriter")}
              </Button>
            </div>
          </div>
        </section>

        {/* Background & Automation Section (iOS Inset Group) */}
        <section className="enter space-y-2" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="px-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
              {t("settings.automationSection")}
            </label>
          </div>

          <div className="bg-surface-subtle/60 rounded-2xl border border-edge divide-y divide-edge overflow-hidden">
            {/* Close to Tray Toggle */}
            <div
              onClick={() => void handleToggleCloseToTray(!closeToTray)}
              className="flex items-center justify-between gap-3 p-3.5 sm:p-4 hover:bg-surface-hover/50 transition-colors cursor-pointer select-none"
            >
              <div className="flex-1 min-w-0 pr-2">
                <span className="block text-xs font-semibold text-text-main">
                  {t("settings.closeToTray")}
                </span>
                <p className="text-[11px] text-text-secondary leading-snug mt-0.5">
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
                className={`press relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  closeToTray ? "bg-accent" : "bg-edge-strong"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-md ring-0 transition duration-200 ease-in-out ${
                    closeToTray ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Auto Detect Playlist Toggle */}
            <div
              onClick={() => void handleToggleAutoDetectPlaylist(!autoDetectPlaylist)}
              className="flex items-center justify-between gap-3 p-3.5 sm:p-4 hover:bg-surface-hover/50 transition-colors cursor-pointer select-none"
            >
              <div className="flex-1 min-w-0 pr-2">
                <span className="block text-xs font-semibold text-text-main">
                  {t("settings.autoDetectPlaylist")}
                </span>
                <p className="text-[11px] text-text-secondary leading-snug mt-0.5">
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
                className={`press relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoDetectPlaylist ? "bg-accent" : "bg-edge-strong"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-md ring-0 transition duration-200 ease-in-out ${
                    autoDetectPlaylist ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Notify Step Advance Toggle */}
            <div
              onClick={() => void handleToggleNotifyStepAdvance(!notifyStepAdvance)}
              className="flex items-center justify-between gap-3 p-3.5 sm:p-4 hover:bg-surface-hover/50 transition-colors cursor-pointer select-none"
            >
              <div className="flex-1 min-w-0 pr-2">
                <span className="block text-xs font-semibold text-text-main">
                  {t("settings.notifyStepAdvance")}
                </span>
                <p className="text-[11px] text-text-secondary leading-snug mt-0.5">
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
                className={`press relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  notifyStepAdvance ? "bg-accent" : "bg-edge-strong"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-md ring-0 transition duration-200 ease-in-out ${
                    notifyStepAdvance ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Mouse Hardware & DPI Section */}
        <section className="enter space-y-2" style={{ "--i": 4 } as React.CSSProperties}>
          <div className="px-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
              {t("settings.mouseHardware")}
            </label>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl border border-edge bg-surface-subtle/60 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0 pr-2">
                <span className="block text-xs font-semibold text-text-main">
                  {t("settings.mouseDpi")}
                </span>
                <p className="text-[11px] text-text-secondary leading-snug mt-0.5">
                  {t("settings.mouseDpiDesc")}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-accent px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 whitespace-nowrap tabular-nums">
                {mouseDpi} DPI
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[400, 800, 1600, 3200].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => void handleDpiChange(preset)}
                  className={`press px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all tabular-nums ${
                    mouseDpi === preset
                      ? "bg-accent text-accent-fg shadow-xs"
                      : "bg-surface border border-edge text-text-secondary hover:text-text-main hover:bg-surface-hover"
                  }`}
                >
                  {preset}
                </button>
              ))}

              <div className="flex items-center ml-auto">
                <input
                  type="text"
                  inputMode="numeric"
                  value={dpiInputText}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, "");
                    setDpiInputText(clean);
                  }}
                  onBlur={() => {
                    const parsed = parseInt(dpiInputText, 10);
                    if (!isNaN(parsed) && parsed >= 100 && parsed <= 32000) {
                      void handleDpiChange(parsed);
                    } else {
                      setDpiInputText(String(mouseDpi));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-20 glass-input py-1 px-2.5 text-xs font-mono font-medium text-right tabular-nums"
                  aria-label={t("settings.mouseDpi")}
                />
                <span className="ml-1.5 text-[10px] font-mono text-text-faint uppercase">DPI</span>
              </div>
            </div>
          </div>
        </section>

        {/* Visual Theme Selection */}
        {onThemeChange && (
          <section className="enter space-y-2" style={{ "--i": 5 } as React.CSSProperties}>
            <div className="px-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint flex items-center gap-1.5">
                <Palette size={13} weight="bold" className="text-score" />
                <span>{t("theme.title")}</span>
              </label>
              <p className="text-[11px] text-text-secondary mt-0.5">
                {t("theme.subtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {APP_THEMES.map((th) => {
                const isSelected = th.id === currentTheme;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => onThemeChange(th.id)}
                    className={`press p-3 rounded-xl border text-left font-mono transition-all flex items-start gap-2.5 cursor-pointer select-none ${
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
                        <span className="text-xs font-bold text-text-main truncate">
                          {th.name}
                        </span>
                        {isSelected && (
                          <Check size={12} weight="bold" className="text-score shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-text-faint line-clamp-1 mt-0.5 leading-tight">
                        {th.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Data Management Section */}
        <section className="enter space-y-2" style={{ "--i": 6 } as React.CSSProperties}>
          <div className="px-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
              {t("settings.dataTitle")}
            </label>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {t("settings.dataSubtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {onExport && (
              <Button
                variant="secondary"
                size="md"
                onClick={onExport}
                className="press"
                icon={<DownloadSimple size={14} weight="bold" />}
              >
                {t("settings.exportBtn")}
              </Button>
            )}

            {onImport && (
              <label className="press inline-flex items-center justify-center font-sans tracking-tight cursor-pointer select-none h-9 px-3.5 text-xs gap-2 rounded-xl font-medium bg-surface-subtle text-text-main border border-edge hover:bg-surface-hover hover:border-edge-strong transition-all">
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
                className="press"
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
                className="press"
                icon={<Trash size={14} weight="bold" />}
              >
                {t("settings.clearBtn")}
              </Button>
            )}
          </div>
        </section>
      </div>
    </Dialog>
  );
}
