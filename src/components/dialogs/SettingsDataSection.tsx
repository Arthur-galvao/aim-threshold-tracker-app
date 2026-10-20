import type { ChangeEvent } from "react";
import { DownloadSimple, UploadSimple, Sparkle, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

export interface SettingsDataSectionProps {
  onExport?: () => void;
  onImport?: (file: File) => void;
  onLoadDemo?: () => void;
  onClear?: () => void;
}

export function SettingsDataSection({
  onExport,
  onImport,
  onLoadDemo,
  onClear,
}: SettingsDataSectionProps) {
  const { t } = useI18n();

  return (
    <section className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint px-1">
        {t("settings.dataTitle")}
      </label>

      <div className="glass-inset p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {onExport && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onExport}
              icon={<DownloadSimple size={14} weight="bold" />}
            >
              {t("settings.exportBtn")}
            </Button>
          )}

          {onImport && (
            <label className="glass-control h-8 px-2.5 text-xs rounded-control gap-1.5 text-text-main inline-flex items-center justify-center font-medium select-none transition cursor-pointer press">
              <UploadSimple size={14} weight="bold" />
              <span>{t("settings.importBtn")}</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (file) onImport(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}

          {onLoadDemo && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onLoadDemo}
              icon={<Sparkle size={14} weight="bold" />}
            >
              {t("settings.demoBtn")}
            </Button>
          )}

          {onClear && (
            <Button
              type="button"
              variant="danger"
              size="sm"
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
    </section>
  );
}
