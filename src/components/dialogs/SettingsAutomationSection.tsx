import { Switch } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

export interface SettingsAutomationSectionProps {
  closeToTray: boolean;
  autoDetectPlaylist: boolean;
  notifyStepAdvance: boolean;
  onToggleCloseToTray: (val: boolean) => void;
  onToggleAutoDetectPlaylist: (val: boolean) => void;
  onToggleNotifyStepAdvance: (val: boolean) => void;
}

export function SettingsAutomationSection({
  closeToTray,
  autoDetectPlaylist,
  notifyStepAdvance,
  onToggleCloseToTray,
  onToggleAutoDetectPlaylist,
  onToggleNotifyStepAdvance,
}: SettingsAutomationSectionProps) {
  const { t } = useI18n();

  return (
    <section className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint px-1">
        {t("settings.automationSection")}
      </label>

      <div className="glass-inset divide-y divide-edge">
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-text-main block">
              {t("settings.closeToTray")}
            </span>
            <span className="text-[11px] text-text-faint block">
              {t("settings.closeToTrayDesc")}
            </span>
          </div>
          <Switch
            checked={closeToTray}
            onCheckedChange={onToggleCloseToTray}
          />
        </div>

        <div className="p-4 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-text-main block">
              {t("settings.autoDetectPlaylist")}
            </span>
            <span className="text-[11px] text-text-faint block">
              {t("settings.autoDetectPlaylistDesc")}
            </span>
          </div>
          <Switch
            checked={autoDetectPlaylist}
            onCheckedChange={onToggleAutoDetectPlaylist}
          />
        </div>

        <div className="p-4 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-text-main block">
              {t("settings.notifyStepAdvance")}
            </span>
            <span className="text-[11px] text-text-faint block">
              {t("settings.notifyStepAdvanceDesc")}
            </span>
          </div>
          <Switch
            checked={notifyStepAdvance}
            onCheckedChange={onToggleNotifyStepAdvance}
          />
        </div>
      </div>
    </section>
  );
}
