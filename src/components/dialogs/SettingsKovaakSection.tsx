import { useState, type FormEvent } from "react";
import { Folder, MagnifyingGlass, ArrowsClockwise, Play, Stop } from "@phosphor-icons/react";
import { Badge, Button, Input } from "@/components/ui";
import type { WatcherStatus } from "@/lib/types";
import { pickStatsFolder } from "@/lib/tauri-bridge";
import { useI18n } from "@/lib/i18n";

export interface SettingsKovaakSectionProps {
  watcherStatus: WatcherStatus;
  settingsPath?: string | null;
  onDetectPath?: () => Promise<void>;
  onUpdatePath?: (path: string) => Promise<void>;
  onToggleWatcher?: () => Promise<void>;
  onReimport?: () => Promise<void>;
}

export function SettingsKovaakSection({
  watcherStatus,
  settingsPath,
  onDetectPath,
  onUpdatePath,
  onToggleWatcher,
  onReimport,
}: SettingsKovaakSectionProps) {
  const { t } = useI18n();
  const [manualKovaak, setManualKovaak] = useState(settingsPath ?? "");
  const [reimporting, setReimporting] = useState(false);

  const handlePickFolder = async () => {
    const picked = await pickStatsFolder();
    if (picked && onUpdatePath) {
      setManualKovaak(picked);
      await onUpdatePath(picked);
    }
  };

  const handleSavePath = async (e: FormEvent) => {
    e.preventDefault();
    if (manualKovaak.trim() && onUpdatePath) {
      await onUpdatePath(manualKovaak.trim());
    }
  };

  const handleReimport = async () => {
    if (!onReimport || reimporting) return;
    setReimporting(true);
    try {
      await onReimport();
    } finally {
      setReimporting(false);
    }
  };

  return (
    <section className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint px-1 flex items-center justify-between">
        <span>{t("settings.kovaakTitle")}</span>
        <Badge variant={watcherStatus.active ? "emerald" : "red"}>
          {watcherStatus.active ? t("settings.active") : t("settings.inactive")}
        </Badge>
      </label>

      <div className="glass-inset p-4 space-y-3">
        <form onSubmit={handleSavePath} className="flex gap-2">
          <Input
            type="text"
            value={manualKovaak}
            onChange={(e) => setManualKovaak(e.target.value)}
            placeholder="C:\Steam\steamapps\common\FPSAimTrainer\FPSAimTrainer\stats"
            className="font-mono text-xs flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!manualKovaak.trim()}
          >
            {t("settings.save")}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {onDetectPath && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void onDetectPath()}
              icon={<MagnifyingGlass size={13} weight="bold" />}
            >
              {t("settings.detect")}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handlePickFolder}
            icon={<Folder size={13} weight="bold" />}
          >
            {t("settings.pick")}
          </Button>
          {onToggleWatcher && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void onToggleWatcher()}
              icon={watcherStatus.active ? <Stop size={13} weight="bold" /> : <Play size={13} weight="bold" />}
            >
              {watcherStatus.active ? t("settings.stop") : t("settings.start")}
            </Button>
          )}
          {onReimport && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={reimporting}
              onClick={handleReimport}
              icon={<ArrowsClockwise size={13} weight="bold" />}
            >
              {t("settings.reimport")}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
