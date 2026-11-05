import { useState, type ReactNode } from "react";
import { Input, Segmented, Switch } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_TRAINING_SETTINGS, type TrainingSettings } from "@/lib/types";

type Difficulty = TrainingSettings["difficulty"];

/** Limites aceitos para os campos numéricos (valores fora deles são limitados). */
const LIMITS = {
  warmupRunsPerScenario: { min: 0, max: 10 },
  sessionWarmupMinutes: { min: 0, max: 60 },
  plannedRuns: { min: 1, max: 20 },
} as const;

type NumericKey = keyof typeof LIMITS;

function Row({ title, desc, control }: { title: string; desc: string; control: ReactNode }) {
  return (
    <div className="p-4 flex items-center justify-between gap-4">
      <div className="space-y-0.5 min-w-0">
        <span className="text-xs font-semibold text-text-main block">{title}</span>
        <span className="text-[11px] text-text-faint block">{desc}</span>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function NumberField({
  value,
  min,
  max,
  onCommit,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (next: number) => void;
  label: string;
}) {
  const [text, setText] = useState(String(value));
  const [prevValue, setPrevValue] = useState(value);

  // Sincroniza o texto quando o valor salvo muda por outra via (ex.: outra janela).
  if (value !== prevValue) {
    setPrevValue(value);
    setText(String(value));
  }

  const commit = () => {
    const parsed = parseInt(text, 10);
    if (Number.isNaN(parsed)) {
      setText(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    setText(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-20 font-mono text-xs text-right tabular-nums py-1 px-2"
    />
  );
}

/** Preferências do modo treino (meta móvel). Salva em `AppSettings.training`. */
export function SettingsTrainingSection() {
  const { t } = useI18n();
  const { settings, updateSettings } = useSettings();
  const training = settings?.training ?? DEFAULT_TRAINING_SETTINGS;

  // Chaves de `docs/plans/i18n-pending/T4.6.json` (passam a existir em i18n.tsx após o merge).

  const save = async (partial: Partial<TrainingSettings>) => {
    try {
      await updateSettings({ training: { ...training, ...partial } });
    } catch (err) {
      console.error("Erro ao salvar ajustes de treino:", err);
    }
  };

  const saveNumber = (key: NumericKey, next: number) => {
    const { min, max } = LIMITS[key];
    void save({ [key]: Math.min(max, Math.max(min, next)) } as Partial<TrainingSettings>);
  };

  return (
    <section className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-text-faint px-1">
        {t("settings.trainingSection")}
      </label>

      <div className="glass-inset divide-y divide-edge">
        <Row
          title={t("settings.training.difficulty")}
          desc={t("settings.training.difficultyDesc")}
          control={
            <Segmented<Difficulty>
              size="sm"
              value={training.difficulty}
              onChange={(next) => void save({ difficulty: next })}
              options={[
                { value: "easy", label: t("settings.training.difficulty.easy") },
                { value: "normal", label: t("settings.training.difficulty.normal") },
                { value: "hard", label: t("settings.training.difficulty.hard") },
              ]}
            />
          }
        />

        <Row
          title={t("settings.training.warmupRuns")}
          desc={t("settings.training.warmupRunsDesc")}
          control={
            <NumberField
              label={t("settings.training.warmupRuns")}
              value={training.warmupRunsPerScenario}
              min={LIMITS.warmupRunsPerScenario.min}
              max={LIMITS.warmupRunsPerScenario.max}
              onCommit={(next) => saveNumber("warmupRunsPerScenario", next)}
            />
          }
        />

        <Row
          title={t("settings.training.warmupMinutes")}
          desc={t("settings.training.warmupMinutesDesc")}
          control={
            <NumberField
              label={t("settings.training.warmupMinutes")}
              value={training.sessionWarmupMinutes}
              min={LIMITS.sessionWarmupMinutes.min}
              max={LIMITS.sessionWarmupMinutes.max}
              onCommit={(next) => saveNumber("sessionWarmupMinutes", next)}
            />
          }
        />

        <Row
          title={t("settings.training.plannedRuns")}
          desc={t("settings.training.plannedRunsDesc")}
          control={
            <NumberField
              label={t("settings.training.plannedRuns")}
              value={training.plannedRuns}
              min={LIMITS.plannedRuns.min}
              max={LIMITS.plannedRuns.max}
              onCommit={(next) => saveNumber("plannedRuns", next)}
            />
          }
        />

        <Row
          title={t("settings.training.focusPrompt")}
          desc={t("settings.training.focusPromptDesc")}
          control={
            <Switch
              checked={training.focusPrompt}
              onCheckedChange={(val) => void save({ focusPrompt: val })}
            />
          }
        />

        <Row
          title={t("settings.training.fatigueAlerts")}
          desc={t("settings.training.fatigueAlertsDesc")}
          control={
            <Switch
              checked={training.fatigueAlerts}
              onCheckedChange={(val) => void save({ fatigueAlerts: val })}
            />
          }
        />

        <Row
          title={t("settings.training.weeklyMeasureReminder")}
          desc={t("settings.training.weeklyMeasureReminderDesc")}
          control={
            <Switch
              checked={training.weeklyMeasureReminder}
              onCheckedChange={(val) => void save({ weeklyMeasureReminder: val })}
            />
          }
        />
      </div>
    </section>
  );
}
