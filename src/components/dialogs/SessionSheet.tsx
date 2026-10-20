import { useState, useEffect, useCallback, type FormEvent, type KeyboardEvent } from "react";
import {
  NotePencil,
  FloppyDisk,
  Target,
  Plus,
  X,
  CalendarBlank,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  Field,
  Input,
  Button,
  Badge,
} from "@/components/ui";
import type { Task } from "@/lib/types";
import { getTargetThresholdForTask, parseInputScores } from "@/lib/threshold";
import { getRecommendedSens } from "@/lib/viscose";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import { useI18n } from "@/lib/i18n";
import { SessionSheetLivePreview } from "./SessionSheetLivePreview";

export interface SessionSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (date: string, sens: number, scores: number[]) => void | Promise<void>;
  activeTask?: Task | null;
}

export function SessionSheet({
  open,
  onClose,
  onSubmit,
  activeTask: propActiveTask,
}: SessionSheetProps) {
  const { t } = useI18n();
  const { state, meta, actions } = useTrackerWorkspace();
  const activeTask = propActiveTask ?? state.activeTask;
  const { draftRuns, setDraftRuns, simulatedOutcome } = meta;
  const currentThreshold = state.computedMetrics.currentThreshold;

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [sens, setSens] = useState("");
  const [singleInput, setSingleInput] = useState("");
  const [saving, setSaving] = useState(false);

  const targetThreshold = activeTask ? getTargetThresholdForTask(activeTask) : null;

  // Initialize sensitivity & date on open
  useEffect(() => {
    if (!open) return;
    setDate(new Date().toISOString().split("T")[0]);
    setSingleInput("");

    if (activeTask) {
      if (activeTask.sessions && activeTask.sessions.length > 0) {
        const sorted = [...activeTask.sessions].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
        setSens(String(sorted[sorted.length - 1].sens));
      } else {
        const rec = getRecommendedSens(activeTask.category, activeTask.subcategory);
        setSens(rec ? String(rec) : "40.0");
      }
    } else {
      setSens("40.0");
    }
  }, [open, activeTask]);

  const handleAddRunsFromInput = useCallback(() => {
    const parsed = parseInputScores(singleInput);
    if (parsed.length > 0) {
      setDraftRuns([...draftRuns, ...parsed]);
      setSingleInput("");
    }
  }, [singleInput, draftRuns, setDraftRuns]);

  const handleKeyDownInput = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddRunsFromInput();
    }
  };

  const handleRemoveRun = (idx: number) => {
    setDraftRuns(draftRuns.filter((_, i) => i !== idx));
  };

  const handleClose = () => {
    setDraftRuns([]);
    setSingleInput("");
    onClose();
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const sensNum = parseFloat(sens);
    if (!activeTask || isNaN(sensNum) || draftRuns.length === 0 || saving) return;

    setSaving(true);
    try {
      if (onSubmit) {
        await onSubmit(date, sensNum, draftRuns);
      } else {
        await actions.recordSession(draftRuns, sensNum);
      }
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup variant="sheet" className="max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-edge">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-control bg-score-soft text-score border border-edge flex items-center justify-center shadow-1">
                <NotePencil size={16} weight="bold" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-text-main font-sans">
                  {t("session.title")}
                </DialogTitle>
                <span className="text-xs font-mono text-text-secondary truncate max-w-[280px] sm:max-w-md block">
                  {activeTask?.name ?? t("task.none")}
                </span>
              </div>
            </div>

            {targetThreshold !== null && (
              <div className="flex items-center gap-2 pr-8">
                <span className="text-[11px] text-text-faint font-semibold uppercase tracking-wider hidden sm:inline">
                  {t("session.goal")}:
                </span>
                <Badge variant="amber" className="font-mono tabular-nums font-bold">
                  <Target size={12} weight="bold" className="mr-1" />
                  {targetThreshold} pts
                </Badge>
              </div>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Date & Sens inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t("session.date")} required>
                <div className="relative">
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="font-mono text-xs pl-8 tabular-nums"
                  />
                  <CalendarBlank
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none"
                  />
                </div>
              </Field>

              <Field label={t("session.sens")} required>
                <Input
                  type="number"
                  step="0.1"
                  min="5"
                  max="200"
                  value={sens}
                  onChange={(e) => setSens(e.target.value)}
                  placeholder="Ex: 42.0"
                  required
                  className="font-mono text-xs tabular-nums"
                />
              </Field>
            </div>

            {/* Run score input */}
            <Field
              label={`${t("session.scores")} (${draftRuns.length} runs)`}
              description={t("session.separator")}
            >
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={singleInput}
                  onChange={(e) => setSingleInput(e.target.value)}
                  onKeyDown={handleKeyDownInput}
                  placeholder="Ex: 1040 1080 990 1015"
                  className="font-mono text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddRunsFromInput}
                  disabled={!singleInput.trim()}
                  icon={<Plus size={14} weight="bold" />}
                >
                  Adicionar
                </Button>
              </div>
            </Field>

            {/* Runs pills list */}
            {draftRuns.length > 0 && (
              <div className="glass-inset p-3 flex flex-wrap items-center gap-1.5 max-h-28 overflow-y-auto scroll-y">
                {draftRuns.map((score, idx) => (
                  <span
                    key={`${idx}-${score}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-control bg-surface border border-edge text-xs font-mono font-semibold text-text-main tabular-nums shadow-xs"
                  >
                    <span>{score}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRun(idx)}
                      className="text-text-faint hover:text-red transition ml-0.5"
                      aria-label="Remover score"
                    >
                      <X size={12} weight="bold" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setDraftRuns([])}
                  className="text-[11px] text-text-faint hover:text-red px-2 py-0.5 rounded-control transition ml-auto"
                >
                  Limpar todos
                </button>
              </div>
            )}

            {/* Live Ratchet Projection Card */}
            <div className="pt-1">
              <SessionSheetLivePreview
                draftRunsCount={draftRuns.length}
                currentThreshold={currentThreshold}
                simulatedOutcome={simulatedOutcome}
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-edge">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleClose}
              >
                {t("modal.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={saving}
                disabled={draftRuns.length === 0 || !activeTask}
                icon={<FloppyDisk size={14} weight="bold" />}
              >
                {t("session.save")}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

export default SessionSheet;
