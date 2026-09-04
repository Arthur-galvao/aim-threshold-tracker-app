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
    <section className="panel p-5 rounded-2xl transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center">
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-main">
            {t("session.title")}
          </h2>
        </div>
        <span className="text-[10px] text-text-faint font-medium px-2.5 py-0.5 rounded-full bg-surface-subtle border border-edge">
          103 FOV
        </span>
      </div>

      {/* Goal Display Card (Clean Minimalist) */}
      <div className="border border-edge rounded-xl p-3.5 bg-surface-subtle space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
            {t("session.goal")}
          </span>
          <span className={`text-2xl font-extrabold tabular-nums ${
            targetThreshold ? "text-amber" : "text-amber/40"
          }`}>
            {targetThreshold ?? (activeTask ? t("session.first") : "0")}
          </span>
        </div>
        <p className="text-[11px] text-text-faint leading-relaxed">
          {targetThreshold ? t("session.goalText") : t("session.autoText")}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="inputDate"
              className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5"
            >
              {t("session.date")}
            </label>
            <input
              type="date"
              id="inputDate"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="minimal-input text-xs tabular-nums"
            />
          </div>
          <div>
            <label
              htmlFor="inputSens"
              className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5"
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
              className="minimal-input text-xs tabular-nums"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="inputPB"
            className="block text-[11px] font-semibold uppercase tracking-wider text-text-faint mb-1.5"
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
            className="minimal-input text-xs tabular-nums"
          />
          <p className="text-[10px] text-text-faint mt-1.5 font-medium">
            {t("session.separator")}
          </p>
        </div>

        {/* Live Threshold Preview Card */}
        <div className="bg-surface-subtle p-3.5 rounded-xl border border-edge flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-[10px] font-semibold text-text-faint uppercase tracking-wider block">
              {t("session.newThreshold")}
            </span>
            <span className="text-[11px] text-text-secondary mt-0.5 block truncate">
              {t(preview.detailKey, preview.detailParams)}
            </span>
          </div>
          <span className={`font-extrabold text-xl shrink-0 tabular-nums ${
            preview.threshold !== null ? "text-amber" : "text-amber/40"
          }`}>
            {preview.threshold ?? "0"}
          </span>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 minimal-btn text-xs font-bold uppercase tracking-wider cursor-pointer"
        >
          {t("session.save")}
        </button>
      </form>
    </section>
  );
}
