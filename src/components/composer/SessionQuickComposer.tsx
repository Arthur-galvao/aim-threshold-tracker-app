import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, X, ArrowRight, ShieldCheck, CheckCircle } from "@phosphor-icons/react";
import { NumberField } from "@base-ui/react";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import { parseInputScores } from "@/lib/threshold";
import { cn } from "@/lib/utils";

export interface SessionQuickComposerProps {
  className?: string;
  defaultSens?: number;
}

export function SessionQuickComposerRunInput({
  inputVal,
  onInputChange,
  onAddRun,
  draftRuns,
  onRemoveRun,
  onClearRuns,
  disabled,
}: {
  inputVal: string;
  onInputChange: (val: string) => void;
  onAddRun: () => void;
  draftRuns: number[];
  onRemoveRun: (idx: number) => void;
  onClearRuns: () => void;
  disabled: boolean;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAddRun();
    }
  };

  const avgDraft = useMemo(() => {
    if (draftRuns.length === 0) return null;
    const sum = draftRuns.reduce((a, b) => a + b, 0);
    return (sum / draftRuns.length).toFixed(1);
  }, [draftRuns]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center text-[11px] font-mono text-text-faint">
        <span className="uppercase font-semibold tracking-wider">RUNS DA SESSÃO ATUAL (ENTER OU CSV AUTO)</span>
        {avgDraft && (
          <span className="tabular-nums font-bold text-emerald">Média: {avgDraft} pts</span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            !disabled
              ? "+ digitar score..."
              : "Selecione um cenário primeiro"
          }
          className="glass-input w-full px-3 py-2 text-xs font-mono tabular-nums text-text-main placeholder:text-text-faint"
        />
        <button
          type="button"
          onClick={onAddRun}
          disabled={disabled || !inputVal.trim()}
          className="minimal-btn press px-3.5 py-2 rounded-xl shrink-0"
        >
          <Plus size={15} weight="bold" />
        </button>
      </div>

      {draftRuns.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-glass-input border border-glass-edge max-h-28 overflow-y-auto custom-scrollbar">
          {draftRuns.map((score, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg liquid-glass-control text-xs font-mono font-bold text-text-main tabular-nums shadow-xs press"
            >
              <span>{score.toFixed(1)}</span>
              <button
                type="button"
                onClick={() => onRemoveRun(idx)}
                className="text-text-faint hover:text-red transition-colors cursor-pointer press"
                title="Remover Run"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearRuns}
            className="text-[10px] font-mono text-text-faint hover:text-text-main underline px-2 py-1 cursor-pointer press"
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}

export function SessionQuickComposerTelemetryFields({
  sens,
  onSensChange,
  fov,
  onFovChange,
}: {
  sens: number | null;
  onSensChange: (val: number | null) => void;
  fov: number | null;
  onFovChange: (val: number | null) => void;
}) {
  return (
    <div className="space-y-2 pt-2">
      <span className="text-[10px] font-mono font-semibold tracking-wider uppercase text-text-faint block">
        PARÂMETROS DE TELEMETRIA (BASE UI NUMBERFIELD)
      </span>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-mono text-text-faint uppercase mb-1">
            Sens (cm/360)
          </label>
          <NumberField.Root
            value={sens}
            onValueChange={onSensChange}
            step={0.1}
            min={1}
            max={200}
          >
            <NumberField.Group className="relative flex items-center liquid-glass-control px-2.5 py-1.5 rounded-xl">
              <NumberField.Input className="w-full bg-transparent text-xs font-mono tabular-nums text-center text-text-main focus:outline-none" />
              <div className="flex items-center gap-1 text-[10px] font-mono text-text-faint">
                <NumberField.Decrement className="hover:text-text-main cursor-pointer px-1 py-0.5 rounded-lg hover:bg-surface-hover press">
                  −
                </NumberField.Decrement>
                <NumberField.Increment className="hover:text-text-main cursor-pointer px-1 py-0.5 rounded-lg hover:bg-surface-hover press">
                  +
                </NumberField.Increment>
              </div>
            </NumberField.Group>
          </NumberField.Root>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-text-faint uppercase mb-1">
            FOV
          </label>
          <NumberField.Root
            value={fov}
            onValueChange={onFovChange}
            step={1}
            min={50}
            max={150}
          >
            <NumberField.Group className="relative flex items-center liquid-glass-control px-2.5 py-1.5 rounded-xl">
              <NumberField.Input className="w-full bg-transparent text-xs font-mono tabular-nums text-center text-text-main focus:outline-none" />
              <div className="flex items-center gap-1 text-[10px] font-mono text-text-faint">
                <NumberField.Decrement className="hover:text-text-main cursor-pointer px-1 py-0.5 rounded-lg hover:bg-surface-hover press">
                  −
                </NumberField.Decrement>
                <NumberField.Increment className="hover:text-text-main cursor-pointer px-1 py-0.5 rounded-lg hover:bg-surface-hover press">
                  +
                </NumberField.Increment>
              </div>
            </NumberField.Group>
          </NumberField.Root>
        </div>
      </div>
    </div>
  );
}

export function SessionQuickComposerLiveRatchetPreview() {
  const { state, meta } = useTrackerWorkspace();
  const { computedMetrics } = state;
  const { draftRuns, simulatedOutcome } = meta;
  const currentThresh = computedMetrics.currentThreshold;

  if (draftRuns.length === 0) {
    return (
      <div className="p-3 rounded-xl liquid-glass-control text-[11px] font-mono text-text-faint text-center">
        Digite runs para simular o degrau da Catraca em tempo real.
      </div>
    );
  }

  if (simulatedOutcome.willRaiseRatchet) {
    return (
      <div className="p-3 rounded-xl bg-emerald-soft border border-emerald-edge flex items-start gap-2.5 text-emerald">
        <CheckCircle size={18} weight="bold" className="shrink-0 mt-0.5" />
        <div className="text-[11px] font-mono leading-relaxed">
          <span className="font-bold uppercase tracking-wider block text-xs">
            SIMULAÇÃO AO VIVO DA CATRACA (THRESHOLD.TS)
          </span>
          Salvar esta sessão destravará um <strong className="underline">Novo Degrau</strong>:
          <div className="mt-1 font-bold tabular-nums">
            Threshold: {currentThresh ?? "—"} → {simulatedOutcome.projectedThreshold} pts (+{simulatedOutcome.thresholdDelta})
            {simulatedOutcome.willBreakPB && ` | Novo PB: ${Math.max(...draftRuns)}`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-amber-soft border border-amber-edge flex items-start gap-2.5 text-amber">
      <ShieldCheck size={18} weight="bold" className="shrink-0 mt-0.5" />
      <div className="text-[11px] font-mono leading-relaxed">
        <span className="font-bold uppercase tracking-wider block text-xs">
          SIMULAÇÃO AO VIVO DA CATRACA (THRESHOLD.TS)
        </span>
        <strong className="underline">Platô Protegido:</strong> Catraca evitará queda e manterá seu piso em:
        <div className="mt-1 font-bold tabular-nums">
          Threshold Travado: {currentThresh ?? "—"} pts (Zero regressão)
        </div>
      </div>
    </div>
  );
}

/**
 * SessionQuickComposer: Liquid Glass side composer for rapid run entry & live ratchet projection.
 */
export function SessionQuickComposer({
  className,
  defaultSens,
}: SessionQuickComposerProps) {
  const { state, actions, meta } = useTrackerWorkspace();
  const { activeTask } = state;
  const { recordSession } = actions;
  const { draftRuns, setDraftRuns } = meta;

  const lastSession = useMemo(() => {
    if (!activeTask?.sessions || activeTask.sessions.length === 0) return null;
    return activeTask.sessions[activeTask.sessions.length - 1];
  }, [activeTask?.sessions]);

  const [inputVal, setInputVal] = useState("");
  const [sensVal, setSensVal] = useState<number | null>(42.0);
  const [fovVal, setFovVal] = useState<number | null>(103);
  const [isSaving, setIsSaving] = useState(false);

  // Sync default sensitivity when active scenario changes
  useEffect(() => {
    const initialSens = defaultSens ?? lastSession?.sens ?? 42.0;
    setSensVal(initialSens);
  }, [defaultSens, lastSession?.sens, activeTask?.id]);

  const handleAddRun = useCallback(() => {
    if (!inputVal.trim()) return;
    const scores = parseInputScores(inputVal);
    if (scores.length > 0) {
      setDraftRuns([...draftRuns, ...scores]);
      setInputVal("");
    }
  }, [inputVal, draftRuns, setDraftRuns]);

  const handleRemoveRun = useCallback(
    (index: number) => {
      const updated = draftRuns.filter((_, i) => i !== index);
      setDraftRuns(updated);
    },
    [draftRuns, setDraftRuns]
  );

  const handleSaveSession = async () => {
    if (draftRuns.length === 0 || !activeTask) return;
    setIsSaving(true);
    try {
      const sens = sensVal ?? 42.0;
      const fov = fovVal ?? 103;
      await recordSession(draftRuns, sens, fov);
      setInputVal("");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "p-6 rounded-2xl liquid-glass-panel shadow-xs flex flex-col justify-between gap-4",
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-main font-mono">
              Session Quick Composer
            </h3>
            <p className="text-[11px] text-text-faint font-mono">
              Adição fluida de runs + Simulador de Catraca em tempo real
            </p>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full liquid-glass-control text-text-secondary tabular-nums">
            Rascunho ({draftRuns.length} runs)
          </span>
        </div>

        <SessionQuickComposerRunInput
          inputVal={inputVal}
          onInputChange={setInputVal}
          onAddRun={handleAddRun}
          draftRuns={draftRuns}
          onRemoveRun={handleRemoveRun}
          onClearRuns={() => setDraftRuns([])}
          disabled={!activeTask}
        />

        <SessionQuickComposerTelemetryFields
          sens={sensVal}
          onSensChange={setSensVal}
          fov={fovVal}
          onFovChange={setFovVal}
        />
      </div>

      {/* Live Ratchet Preview Section */}
      <div className="pt-3 border-t border-edge space-y-3">
        <SessionQuickComposerLiveRatchetPreview />

        <button
          type="button"
          disabled={!activeTask || draftRuns.length === 0 || isSaving}
          onClick={handleSaveSession}
          className="w-full py-2.5 px-4 rounded-xl bg-emerald text-surface font-mono font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 press transition-all disabled:opacity-40 cursor-pointer shadow-sm"
        >
          <span>{isSaving ? "Gravando..." : "Confirmar Sessão & Subir Degrau da Catraca (Ctrl+Enter)"}</span>
          <ArrowRight size={15} weight="bold" />
        </button>
      </div>
    </div>
  );
}

// Compound component attachments
SessionQuickComposer.RunInput = SessionQuickComposerRunInput;
SessionQuickComposer.TelemetryFields = SessionQuickComposerTelemetryFields;
SessionQuickComposer.LiveRatchetPreview = SessionQuickComposerLiveRatchetPreview;
