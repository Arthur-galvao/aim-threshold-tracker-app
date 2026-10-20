import { useState, type FormEvent } from "react";
import { MagnifyingGlass, Sliders } from "@phosphor-icons/react";
import { Badge, Button, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

export interface SettingsRawaccelSectionProps {
  rawaccelPath?: string | null;
  rawaccelAvailable: boolean;
  onDetectRawaccel?: () => Promise<string | null>;
  onUpdateRawaccelPath?: (path: string) => Promise<void>;
  onTestRawaccel?: () => Promise<unknown>;
}

export function SettingsRawaccelSection({
  rawaccelPath,
  rawaccelAvailable,
  onDetectRawaccel,
  onUpdateRawaccelPath,
  onTestRawaccel,
}: SettingsRawaccelSectionProps) {
  const { t } = useI18n();
  const [manualRawaccel, setManualRawaccel] = useState(rawaccelPath ?? "");
  const [testingRawaccel, setTestingRawaccel] = useState(false);

  const handleSavePath = async (e: FormEvent) => {
    e.preventDefault();
    if (manualRawaccel.trim() && onUpdateRawaccelPath) {
      await onUpdateRawaccelPath(manualRawaccel.trim());
    }
  };

  const handleTest = async () => {
    if (!onTestRawaccel || testingRawaccel) return;
    setTestingRawaccel(true);
    try {
      await onTestRawaccel();
    } finally {
      setTestingRawaccel(false);
    }
  };

  return (
    <section className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint px-1 flex items-center justify-between">
        <span>{t("settings.rawaccelTitle")}</span>
        <Badge variant={rawaccelAvailable ? "emerald" : "red"}>
          {rawaccelAvailable ? t("settings.rawaccelReady") : t("settings.rawaccelNotDetected")}
        </Badge>
      </label>

      <div className="glass-inset p-4 space-y-3">
        <form onSubmit={handleSavePath} className="flex gap-2">
          <Input
            type="text"
            value={manualRawaccel}
            onChange={(e) => setManualRawaccel(e.target.value)}
            placeholder={t("settings.rawaccelPh")}
            className="font-mono text-xs flex-1"
          />
          {onUpdateRawaccelPath && (
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!manualRawaccel.trim()}
            >
              {t("settings.save")}
            </Button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {onDetectRawaccel && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={async () => {
                const detected = await onDetectRawaccel();
                if (detected) setManualRawaccel(detected);
              }}
              icon={<MagnifyingGlass size={13} weight="bold" />}
            >
              {t("randomizer.detectPath")}
            </Button>
          )}
          {onTestRawaccel && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={testingRawaccel}
              onClick={handleTest}
              icon={<Sliders size={13} weight="bold" />}
            >
              {t("randomizer.testWriter")}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
