import { useEffect, useState, type FormEvent } from "react";
import type { Task } from "@/lib/types";
import {
  estimateSessionThreshold,
  getTargetThresholdForTask,
  parseInputScores,
} from "@/lib/threshold";
import { getRecommendedSens } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";

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
    <section className="panel p-5 transition-colors">
      <div className="flex items-center justify-between border-b border-edge pb-3 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-main">
          {t("session.title")}
        </h2>
        <span className="text-[10px] text-text-faint font-mono">103 FOV</span>
      </div>

      <div className="border border-edge rounded-lg p-3 bg-surface-subtle space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-text-secondary">
            {t("session.goal")}
          </span>
          <span className="text-xl font-bold text-amber font-mono">
            {targetThreshold ?? (activeTask ? t("session.first") : "—")}
          </span>
        </div>
        <p className="text-[11px] text-text-faint leading-tight">
          {targetThreshold ? t("session.goalText") : t("session.autoText")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="inputDate" className="block text-[11px] font-medium uppercase tracking-wider text-text-faint mb-1">
              {t("session.date")}
            </label>
            <input
              type="date"
              id="inputDate"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="minimal-input font-mono text-xs"
            />
          </div>
          <div>
            <label htmlFor="inputSens" className="block text-[11px] font-medium uppercase tracking-wider text-text-faint mb-1">
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
              className="minimal-input font-mono text-xs"
            />
          </div>
        </div>

        <div>
<label htmlFor="inputPB" className="block text-[11px] font-medium uppercase tracking-wider text-text-faint mb-1">
              {t("session.scores")}
            </label>
          <input
            type="text"
            id="inputPB"
            value={scoresInput}
            onChange={(e) => setScoresInput(e.target.value)}
            placeholder="Ex: 1000 970 890 900 980"
            required
            className="minimal-input font-mono text-xs"
          />
          <p className="text-[10px] text-text-faint mt-1 font-mono">
            {t("session.separator")}
          </p>
        </div>

        <div className="bg-surface-subtle p-3 rounded-lg border border-edge flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-text-faint block">{t("session.newThreshold")}</span>
            <span className="text-[11px] text-text-secondary mt-0.5 block">
              {t(preview.detailKey, preview.detailParams)}
            </span>
          </div>
          <span className="font-mono font-bold text-amber text-lg ml-2">
            {preview.threshold ?? "—"}
          </span>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 minimal-btn text-xs font-semibold"
        >
          {t("session.save")}
        </button>
      </form>
    </section>
  );
}
