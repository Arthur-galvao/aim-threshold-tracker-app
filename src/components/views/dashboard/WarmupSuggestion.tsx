import { useMemo, useState } from "react";
import { Thermometer } from "@phosphor-icons/react";
import { useAllRuns, useAllSkills } from "@/hooks/useSkill";
import { useSettings } from "@/hooks/useSettings";
import { groupTrainingSessions } from "@/lib/skill/sessions";
import { INTRA_SESSION_LAST_N, intraSessionCurve } from "@/lib/skill/intra-session";
import { DEFAULT_TRAINING_SETTINGS } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { Button, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface WarmupSuggestionProps {
  className?: string;
}

/** Modo simples: no lugar da curva intrassessão, só a sugestão de aquecimento (quando houver e for diferente da atual). */
export function WarmupSuggestion({ className }: WarmupSuggestionProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { settings, updateSettings } = useSettings();
  const training = settings?.training ?? DEFAULT_TRAINING_SETTINGS;
  const allRuns = useAllRuns();
  const skills = useAllSkills();
  const [applying, setApplying] = useState(false);

  const suggested = useMemo(() => {
    const sessions = groupTrainingSessions(allRuns, training.sessionGapMinutes);
    return intraSessionCurve(skills, sessions, INTRA_SESSION_LAST_N).suggestedWarmupRuns;
  }, [allRuns, skills, training.sessionGapMinutes]);

  if (suggested === null || suggested === training.warmupRunsPerScenario) return null;

  const apply = async () => {
    if (applying) return;
    setApplying(true);
    try {
      await updateSettings({ training: { ...training, warmupRunsPerScenario: suggested } });
      showToast(t("intra.applied", { n: suggested }), "success");
    } catch {
      showToast(t("intra.applyError"), "error");
    } finally {
      setApplying(false);
    }
  };

  return (
    <section
      className={cn(
        "liquid-surface px-5 py-3 flex flex-wrap items-center justify-between gap-3",
        className
      )}
    >
      <span className="flex items-center gap-2 text-xs text-text-secondary">
        <Thermometer size={14} weight="regular" aria-hidden="true" />
        {t("simple.warmup.suggest", { n: suggested })}
      </span>
      <Button size="sm" variant="secondary" onClick={apply} disabled={applying}>
        {t("simple.warmup.apply", { n: suggested })}
      </Button>
    </section>
  );
}

export default WarmupSuggestion;
