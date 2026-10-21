import { useState, useEffect } from "react";
import { Gear, Translate, Mouse, Database, Palette, Check } from "@phosphor-icons/react";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  Button,
  Badge,
  Input,
  Segmented,
} from "@/components/ui";
import type { AppSettings, WatcherStatus } from "@/lib/types";
import { getSettings, saveSettings } from "@/lib/tauri-bridge";
import { useI18n, type Lang } from "@/lib/i18n";
import { APP_THEMES, type AppTheme } from "@/lib/theme";
import { SettingsKovaakSection } from "./SettingsKovaakSection";
import { SettingsRawaccelSection } from "./SettingsRawaccelSection";
import { SettingsAutomationSection } from "./SettingsAutomationSection";
import { SettingsDataSection } from "./SettingsDataSection";

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  watcherStatus?: WatcherStatus;
  settingsPath?: string | null;
  onDetectPath?: () => Promise<void>;
  onUpdatePath?: (path: string) => Promise<void>;
  onToggleWatcher?: () => Promise<void>;
  onReimport?: () => Promise<void>;
  rawaccelPath?: string | null;
  rawaccelAvailable?: boolean;
  onDetectRawaccel?: () => Promise<string | null>;
  onUpdateRawaccelPath?: (path: string) => Promise<void>;
  onTestRawaccel?: () => Promise<unknown>;
  onExport?: () => void;
  onImport?: (file: File) => void;
  onLoadDemo?: () => void;
  onClear?: () => void;
  closeToTray?: boolean;
  autoDetectPlaylist?: boolean;
  notifyStepAdvance?: boolean;
  onUpdateAppSettings?: (settings: Partial<AppSettings>) => Promise<void>;
  onOpenAimLab?: () => void;
  currentTheme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
}

export function SettingsDialog({
  open,
  onClose,
  watcherStatus = { active: false, path: null, error: null },
  settingsPath,
  onDetectPath,
  onUpdatePath,
  onToggleWatcher,
  onReimport,
  rawaccelPath,
  rawaccelAvailable = false,
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
  onOpenAimLab,
  currentTheme = "cyber-lab",
  onThemeChange,
}: SettingsDialogProps) {
  const { t, lang, setLang } = useI18n();

  const [closeToTray, setCloseToTray] = useState(propCloseToTray ?? true);
  const [autoDetectPlaylist, setAutoDetectPlaylist] = useState(propAutoDetectPlaylist ?? true);
  const [notifyStepAdvance, setNotifyStepAdvance] = useState(propNotifyStepAdvance ?? true);
  const [mouseDpi, setMouseDpi] = useState(800);
  const [dpiText, setDpiText] = useState("800");

  useEffect(() => {
    if (!open) return;

    void getSettings().then((s) => {
      if (s.mouse_dpi !== undefined) {
        setMouseDpi(s.mouse_dpi);
        setDpiText(String(s.mouse_dpi));
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

  const updateSetting = async (partial: Partial<AppSettings>) => {
    if (onUpdateAppSettings) {
      await onUpdateAppSettings(partial);
    } else {
      const current = await getSettings();
      await saveSettings({ ...current, ...partial });
    }
  };

  const handleDpiChange = async (val: number) => {
    setMouseDpi(val);
    setDpiText(String(val));
    await updateSetting({ mouse_dpi: val });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup variant="dialog" className="max-w-2xl max-h-[88vh] p-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2.5 p-6 pb-4 border-b border-edge shrink-0">
            <div className="w-8 h-8 rounded-control bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center shadow-1">
              <Gear size={16} weight="bold" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-text-main font-sans">
                {t("settings.title")}
              </DialogTitle>
              <p className="text-[11px] text-text-faint">
                {t("settings.dataSubtitle")}
              </p>
            </div>
          </div>

          {/* Scrollable iOS settings sections */}
          <div className="flex-1 overflow-y-auto scroll-y p-6 space-y-6">
            <SettingsKovaakSection
              watcherStatus={watcherStatus}
              settingsPath={settingsPath}
              onDetectPath={onDetectPath}
              onUpdatePath={onUpdatePath}
              onToggleWatcher={onToggleWatcher}
              onReimport={onReimport}
            />

            <SettingsRawaccelSection
              rawaccelPath={rawaccelPath}
              rawaccelAvailable={rawaccelAvailable}
              onDetectRawaccel={onDetectRawaccel}
              onUpdateRawaccelPath={onUpdateRawaccelPath}
              onTestRawaccel={onTestRawaccel}
            />

            <SettingsAutomationSection
              closeToTray={closeToTray}
              autoDetectPlaylist={autoDetectPlaylist}
              notifyStepAdvance={notifyStepAdvance}
              onToggleCloseToTray={(val) => {
                setCloseToTray(val);
                void updateSetting({ close_to_tray: val });
              }}
              onToggleAutoDetectPlaylist={(val) => {
                setAutoDetectPlaylist(val);
                void updateSetting({ auto_detect_playlist: val });
              }}
              onToggleNotifyStepAdvance={(val) => {
                setNotifyStepAdvance(val);
                void updateSetting({ notify_step_advance: val });
              }}
            />

            {/* Mouse & Hardware */}
            <section className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint px-1 flex items-center gap-1.5">
                <Mouse size={13} weight="bold" />
                <span>{t("settings.mouseHardware")}</span>
              </label>

              <div className="glass-inset p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-text-main">
                    {t("settings.mouseDpi")}
                  </span>
                  <Badge variant="score" className="font-mono tabular-nums font-bold">
                    {mouseDpi} DPI
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[400, 800, 1600, 3200].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => void handleDpiChange(preset)}
                      className={`press px-3 py-1.5 rounded-control text-xs font-mono font-semibold transition-all tabular-nums cursor-pointer ${
                        mouseDpi === preset
                          ? "bg-score text-base shadow-xs"
                          : "glass-control text-text-secondary hover:text-text-main"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                  <div className="flex items-center ml-auto gap-1.5">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={dpiText}
                      onChange={(e) => setDpiText(e.target.value.replace(/[^0-9]/g, ""))}
                      onBlur={() => {
                        const parsed = parseInt(dpiText, 10);
                        if (!isNaN(parsed) && parsed >= 100 && parsed <= 32000) {
                          void handleDpiChange(parsed);
                        } else {
                          setDpiText(String(mouseDpi));
                        }
                      }}
                      className="w-20 font-mono text-xs text-right tabular-nums py-1 px-2"
                    />
                    <span className="text-[10px] font-mono text-text-faint uppercase">DPI</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Theme & Space Nebula */}
            {onThemeChange && (
              <section className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint px-1 flex items-center gap-1.5">
                  <Palette size={13} weight="bold" />
                  <span>{lang === "pt" ? "Tema & Nebulosa Espacial" : "Theme & Space Nebula"}</span>
                </label>

                <div className="glass-inset p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {APP_THEMES.map((theme) => {
                    const active = currentTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => onThemeChange(theme.id)}
                        className={`press flex items-center justify-between gap-2.5 p-3 rounded-control text-left transition-all cursor-pointer ${
                          active
                            ? "liquid-pill text-text-main border-edge-strong"
                            : "glass-control text-text-secondary hover:text-text-main"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/25"
                            style={{
                              backgroundColor: theme.color,
                              boxShadow: `0 0 12px ${theme.color}`,
                            }}
                          />
                          <div className="min-w-0">
                            <span className="block text-xs font-semibold truncate">
                              {theme.name}
                            </span>
                            <span className="block text-[10px] text-text-faint truncate">
                              {theme.desc}
                            </span>
                          </div>
                        </div>
                        {active && <Check size={14} weight="bold" className="text-score shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Language */}
            <section className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint px-1 flex items-center gap-1.5">
                <Translate size={13} weight="bold" />
                <span>{t("settings.language")}</span>
              </label>

              <div className="glass-inset p-4 flex items-center justify-between gap-4">
                <span className="text-xs text-text-secondary">
                  {t("settings.languageDesc")}
                </span>
                <Segmented<Lang>
                  value={lang}
                  onChange={(next) => setLang(next)}
                  options={[
                    { value: "pt", label: "Português" },
                    { value: "en", label: "English" },
                  ]}
                />
              </div>
            </section>

            {/* Integrations */}
            {onOpenAimLab && (
              <section className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint px-1 flex items-center gap-1.5">
                  <Database size={13} weight="bold" />
                  <span>{t("settings.aimlabSync")}</span>
                </label>
                <div className="glass-inset p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-text-main block">
                      Aim Lab SQLite & CSV
                    </span>
                    <span className="text-[11px] text-text-faint block">
                      {t("settings.aimlabDesc")}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onOpenAimLab();
                    }}
                  >
                    {t("settings.openAimlab")}
                  </Button>
                </div>
              </section>
            )}

            <SettingsDataSection
              onExport={onExport}
              onImport={onImport}
              onLoadDemo={onLoadDemo}
              onClear={onClear}
            />
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

export default SettingsDialog;
