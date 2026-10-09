import { useEffect, useState, type FormEvent } from "react";
import { NotePencil, FloppyDisk, Target } from "@phosphor-icons/react";
import type { Task } from "@/lib/types";
import {
  estimateSessionThreshold,
  getTargetThresholdForTask,
  parseInputScores,
} from "@/lib/threshold";
import { getRecommendedSens } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/card";

interface SessionFormProps {
  activeTask: Task | null;
  onSubmit: (date: string, sens: number, scores: number[]) => void;
}

export function SessionForm({ activeTask, onSubmit }: SessionFormProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [sens, setSens] = useState("");
  const [scoresInput, setScoresInput] = useState("");
  const { t } = useI18n();

  const targetThreshold = activeTask ? getTargetThresholdForTask(activeTask) : null;
  const rawScores = parseInputScores(scoresInput);
  const preview = estimateSessionThreshold(activeTask, rawScores);

  useEffect(() => {
    if (!activeTask) return;

    const recSens = getRecommendedSens(activeTask.category, activeTask.subcategory);
    if (activeTask.sessions.length === 0 && recSens) {
      setSens(String(recSens));
    } else if (activeTask.sessions.length > 0) {
      const sorted = [...activeTask.sessions].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      setSens(String(sorted[sorted.length - 1].sens));
    }
  }, [activeTask]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const scores = parseInputScores(scoresInput);
    const sensNum = parseFloat(sens);
    if (!date || isNaN(sensNum) || scores.length === 0) return;
    onSubmit(date, sensNum, scores);
    setScoresInput("");
  };

  return (
    <Card className="p-4 sm:p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center">
            <NotePencil size={13} weight="bold" />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-main">
            {t("session.title")}
          </h2>
        </div>
        <span className="text-[10px] text-text-faint font-mono font-medium px-2 py-0.5 rounded-md bg-surface-subtle border border-edge">
          103 FOV
        </span>
      </div>

      {/* Goal Display Card */}
      <div className="border border-edge rounded-lg p-3 bg-surface-subtle/50 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Target size={13} weight="bold" className="text-amber" />
            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider font-mono">
              {t("session.goal")}
            </span>
          </div>
          <span
            className={`text-xl font-bold font-mono tabular-nums ${
              targetThreshold ? "text-amber" : "text-amber/40"
            }`}
          >
            {targetThreshold ?? (activeTask ? t("session.first") : "0")}
          </span>
        </div>
        <p className="text-[11px] text-text-secondary leading-relaxed">
          {targetThreshold ? t("session.goalText") : t("session.autoText")}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5 mt-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="inputDate"
              className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1.5"
            >
              {t("session.date")}
            </label>
            <input
              type="date"
              id="inputDate"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="minimal-input text-xs font-mono tabular-nums w-full"
            />
          </div>
          <div>
            <label
              htmlFor="inputSens"
              className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1.5"
            >
              {t("session.sens")}
            </label>
            <input
              type="number"
              step="0.1"
              id="inputSens"
              value={sens}
              onChange={(e) => setSens(e.target.value)}
              placeholder="Ex: 45"
              required
              className="minimal-input text-xs font-mono tabular-nums w-full"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="inputPB"
            className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1.5"
          >
            {t("session.scores")}
          </label>
          <input
            type="text"
            id="inputPB"
            value={scoresInput}
            onChange={(e) => setScoresInput(e.target.value)}
            placeholder="Ex: 1000 970 890 900 980"
            required
            className="minimal-input text-xs font-mono tabular-nums w-full"
          />
          <p className="text-[10px] text-text-faint mt-1.5 font-medium">
            {t("session.separator")}
          </p>
        </div>

        {/* Live Threshold Preview Card */}
        <div className="bg-surface-subtle/70 p-3 rounded-lg border border-edge flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-[10px] font-semibold text-text-faint uppercase tracking-wider block font-mono">
              {t("session.newThreshold")}
            </span>
            <span className="text-[11px] text-text-secondary mt-0.5 block truncate">
              {t(preview.detailKey, preview.detailParams)}
            </span>
          </div>
          <span
            className={`font-bold font-mono text-xl shrink-0 tabular-nums ${
              preview.threshold !== null ? "text-amber" : "text-amber/40"
            }`}
          >
            {preview.threshold ?? "0"}
          </span>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full uppercase tracking-wider font-semibold py-2.5 h-auto text-xs"
          icon={<FloppyDisk size={14} weight="bold" />}
        >
          {t("session.save")}
        </Button>
      </form>
    </Card>
  );
}
