import { useEffect, useState, type FormEvent } from "react";
import { NotePencil, FloppyDisk, Target, X } from "@phosphor-icons/react";
import type { Task } from "@/lib/types";
import {
  estimateSessionThreshold,
  getTargetThresholdForTask,
  parseInputScores,
} from "@/lib/threshold";
import { getRecommendedSens } from "@/lib/viscose";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";

interface SessionModalProps {
  open: boolean;
  onClose: () => void;
  activeTask: Task | null;
  onSubmit: (date: string, sens: number, scores: number[]) => void;
}

export function SessionModal({
  open,
  onClose,
  activeTask,
  onSubmit,
}: SessionModalProps) {
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

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const scores = parseInputScores(scoresInput);
    const sensNum = parseFloat(sens);
    if (!date || isNaN(sensNum) || scores.length === 0) return;
    onSubmit(date, sensNum, scores);
    setScoresInput("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#0f1118] border border-edge rounded-xl shadow-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-surface-subtle text-text-secondary border border-edge flex items-center justify-center">
              <NotePencil size={15} weight="bold" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-main font-mono">
                {t("session.title")}
              </h2>
              {activeTask && (
                <p className="text-[11px] text-text-faint font-mono truncate max-w-[260px]">
                  {activeTask.name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-faint hover:text-text-main hover:bg-surface-subtle cursor-pointer"
          >
            <X size={15} weight="bold" />
          </button>
        </div>

        {/* Goal Indicator */}
        <div className="border border-edge rounded-lg p-3 bg-surface-subtle/40 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Target size={13} weight="bold" className="text-amber" />
              <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider font-mono">
                {t("session.goal")}
              </span>
            </div>
            <span
              className={`text-lg font-bold font-mono tabular-nums ${
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
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="modalDate"
                className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1.5 font-mono"
              >
                {t("session.date")}
              </label>
              <input
                type="date"
                id="modalDate"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="minimal-input text-xs font-mono tabular-nums w-full"
              />
            </div>
            <div>
              <label
                htmlFor="modalSens"
                className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1.5 font-mono"
              >
                {t("session.sens")}
              </label>
              <input
                type="number"
                step="0.1"
                id="modalSens"
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
              htmlFor="modalScores"
              className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1.5 font-mono"
            >
              {t("session.scores")}
            </label>
            <input
              type="text"
              id="modalScores"
              value={scoresInput}
              onChange={(e) => setScoresInput(e.target.value)}
              placeholder="Ex: 1000 970 890 900 980"
              required
              className="minimal-input text-xs font-mono tabular-nums w-full"
            />
            <p className="text-[10px] text-text-faint mt-1 font-medium font-mono">
              {t("session.separator")}
            </p>
          </div>

          {/* Live Threshold Preview */}
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

          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="w-1/3 text-xs"
            >
              {t("modal.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="w-2/3 uppercase tracking-wider font-semibold text-xs flex items-center justify-center gap-1.5"
              icon={<FloppyDisk size={14} weight="bold" />}
            >
              {t("session.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
