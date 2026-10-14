import { useState, useMemo } from "react";
import {
  CaretDown,
  CaretRight,
  Trash,
  ClockCounterClockwise,
  TrendUp,
  ShieldCheck,
  Calendar,
  Copy,
} from "@phosphor-icons/react";
import { Collapsible, Popover } from "@base-ui/react";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import { formatSensitivity } from "@/lib/sens-analytics";
import { summarizeDays, type DaySummary } from "@/lib/day-summary";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface SessionLedgerProps {
  className?: string;
  mouseDpi?: number;
  onCopyEscalate?: () => void;
  onDeleteSession?: (id: string) => Promise<void> | void;
}

export interface DayLedgerData extends DaySummary {
  individualSessions: Session[];
  isUpward: boolean;
  delta: number;
  prevThreshold: number | null;
  sessionIndex: number;
}

export function SessionLedgerFilterHeader({
  totalDays,
  totalRuns,
  onCopyEscalate,
}: {
  totalDays: number;
  totalRuns: number;
  onCopyEscalate?: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 select-none">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-score-soft text-score border border-score/30 flex items-center justify-center shadow-xs">
          <ClockCounterClockwise size={16} weight="bold" />
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-main font-mono">
            Histórico de Sessões
          </h2>
          <p className="text-[11px] text-text-faint font-mono">
            Histórico detalhado e telemetria de runs
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onCopyEscalate && (
          <button
            type="button"
            onClick={onCopyEscalate}
            className="px-3 py-1.5 rounded-xl liquid-glass-control text-xs font-mono text-text-secondary hover:text-text-main flex items-center gap-1.5 cursor-pointer shadow-xs press"
            title="Copiar no formato Escalate"
          >
            <Copy size={13} weight="bold" />
            <span>Copiar Escalate</span>
          </button>
        )}
        <span className="text-xs font-mono px-3 py-1 rounded-full bg-surface-subtle border border-edge text-text-secondary tabular-nums">
          {totalDays} {totalDays === 1 ? "sessão" : "sessões"} • {totalRuns} runs
        </span>
      </div>
    </div>
  );
}

export function SessionLedgerExpandedRuns({
  day,
  mouseDpi,
  onDeleteSession,
}: {
  day: DayLedgerData;
  mouseDpi: number;
  onDeleteSession: (id: string) => Promise<void> | void;
}) {
  const [popoverOpenId, setPopoverOpenId] = useState<string | null>(null);

  return (
    <Collapsible.Panel className="px-5 py-3.5 border-t border-glass-edge bg-glass-input text-xs font-mono space-y-3 animate-fade-in">
      <div className="flex items-center justify-between text-xs text-text-faint pb-1 border-b border-glass-edge/40">
        <span>
          Runs detalhadas: <strong className="text-text-main tabular-nums">{day.runs}</strong> | Média da Sessão:{" "}
          <strong className="text-emerald tabular-nums">{day.avg} pts</strong> | Mínimo:{" "}
          <strong className="text-text-main tabular-nums">{day.min} pts</strong>
        </span>
        <span className="tabular-nums">
          Sens: {day.sens.map((s) => `${formatSensitivity(s, mouseDpi, "")}cm`).join(", ")} ({mouseDpi} DPI)
        </span>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
        {day.individualSessions.map((sess, idx) => (
          <div
            key={sess.id}
            className="flex items-center justify-between p-2 rounded-xl liquid-glass-control hover:bg-glass-bg-elevated transition-colors press"
          >
            <div className="flex items-center gap-2.5 text-xs">
              <span className="text-text-faint text-[10px] font-mono tabular-nums">#{idx + 1}</span>
              <span className="font-bold text-text-main tabular-nums">{sess.pb} pts</span>
              {sess.sourceFile && (
                <span className="text-[10px] text-text-faint truncate max-w-[280px]" title={sess.sourceFile}>
                  {sess.sourceFile}
                </span>
              )}
            </div>

            {/* Base UI Popover Confirmation for Safe Run Deletion */}
            <Popover.Root
              open={popoverOpenId === sess.id}
              onOpenChange={(open) => setPopoverOpenId(open ? sess.id : null)}
            >
              <Popover.Trigger
                aria-label="Excluir run"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-text-faint hover:text-red hover:bg-red-soft transition-colors cursor-pointer press"
              >
                <Trash size={13} />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner side="top" align="end" sideOffset={6}>
                  <Popover.Popup className="p-3 rounded-2xl liquid-glass-floating shadow-float border border-glass-edge z-50 animate-pop-in text-xs font-mono space-y-2">
                    <p className="text-xs text-text-main font-semibold">Excluir esta run?</p>
                    <div className="flex items-center gap-2 justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setPopoverOpenId(null)}
                        className="px-2.5 py-1 rounded-lg liquid-glass-control text-[11px] text-text-faint hover:text-text-main cursor-pointer press"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setPopoverOpenId(null);
                          await onDeleteSession(sess.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red text-white text-[11px] font-bold hover:brightness-110 press cursor-pointer shadow-xs"
                      >
                        Sim, Excluir
                      </button>
                    </div>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </div>
        ))}
      </div>
    </Collapsible.Panel>
  );
}

export function SessionLedgerRow({
  day,
  mouseDpi,
  onDeleteSession,
}: {
  day: DayLedgerData;
  mouseDpi: number;
  onDeleteSession: (id: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);

  const chipsFormatted = useMemo(() => {
    return day.individualSessions.map((s) => Number(s.pb).toFixed(1)).join(", ");
  }, [day.individualSessions]);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "rounded-2xl border transition-all duration-200 overflow-hidden",
        open
          ? "bg-glass-bg-elevated border-glass-edge-strong shadow-md"
          : "bg-glass-bg border-glass-edge hover:bg-glass-bg-elevated/70"
      )}
    >
      <Collapsible.Trigger className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer select-none press">
        {/* Left Section: Date & Session index */}
        <div className="flex items-center gap-3">
          <span className="text-text-faint">
            {open ? (
              <CaretDown size={14} weight="bold" />
            ) : (
              <CaretRight size={14} weight="bold" />
            )}
          </span>

          <div className="flex items-center gap-2 font-mono text-xs">
            <Calendar size={14} className="text-text-faint" />
            <span className="font-semibold text-text-main">{day.date}</span>
            <span className="text-[11px] text-text-faint tabular-nums">• S{day.sessionIndex}</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-text-faint">
            <span>•</span>
            <span className="tabular-nums">{formatSensitivity(day.sens[0] ?? 42, mouseDpi, "")} cm / 103</span>
            <span>•</span>
            <span className="truncate max-w-[200px] text-[11px] text-text-faint/80 tabular-nums">
              [{chipsFormatted}]
            </span>
          </div>
        </div>

        {/* Right Section: Average, Peak PB, Threshold and Ratchet Badge */}
        <div className="flex items-center gap-4 font-mono text-xs">
          {/* Average of session */}
          <div className="hidden sm:flex items-baseline gap-1">
            <span className="text-[10px] text-text-faint uppercase">Média:</span>
            <span className="font-medium text-text-secondary tabular-nums">{day.avg} pts</span>
          </div>

          {/* Peak / PB of session */}
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-text-faint uppercase">Pico:</span>
            <span className="font-bold text-text-main tabular-nums">{day.best} pts</span>
          </div>

          {/* Threshold at that date */}
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-text-faint uppercase">Catraca:</span>
            <span className="font-bold text-emerald tabular-nums">{day.threshold} pts</span>
          </div>

          {/* Semantic Ratchet Badge */}
          {day.isUpward ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-soft text-emerald border border-emerald-edge text-[10px] font-bold tabular-nums">
              <TrendUp size={11} weight="bold" />
              ▲ Subiu +{day.delta.toFixed(1)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-soft text-amber border border-amber-edge text-[10px] font-medium">
              <ShieldCheck size={11} weight="bold" />
              Platô Mantido
            </span>
          )}
        </div>
      </Collapsible.Trigger>

      <SessionLedgerExpandedRuns
        day={day}
        mouseDpi={mouseDpi}
        onDeleteSession={onDeleteSession}
      />
    </Collapsible.Root>
  );
}

/**
 * SessionLedger: Complete session ledger in Liquid Glass with Base UI Collapsible rows.
 */
export function SessionLedger({
  className,
  mouseDpi = 800,
  onCopyEscalate,
  onDeleteSession,
}: SessionLedgerProps) {
  const { state, actions } = useTrackerWorkspace();
  const { activeTask } = state;
  const { deleteSession } = actions;

  // Group and sort sessions by date using summarizeDays
  const dayRows: DayLedgerData[] = useMemo(() => {
    if (!activeTask?.sessions || activeTask.sessions.length === 0) return [];

    const summaries = summarizeDays(activeTask);
    const sortedSummaries = [...summaries].reverse(); // most recent day on top

    const sortedSessions = [...activeTask.sessions].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const sessionsByDate = new Map<string, Session[]>();
    for (const sess of sortedSessions) {
      const list = sessionsByDate.get(sess.date);
      if (list) list.push(sess);
      else sessionsByDate.set(sess.date, [sess]);
    }

    const total = sortedSummaries.length;
    return sortedSummaries.map((s, idx) => {
      // In reversed list, the chronologically preceding day is at idx + 1
      const prevDay = sortedSummaries[idx + 1];
      const isUpward = prevDay ? s.threshold > prevDay.threshold : false;
      const delta = prevDay ? Math.max(0, s.threshold - prevDay.threshold) : 0;

      return {
        ...s,
        individualSessions: sessionsByDate.get(s.date) ?? [],
        isUpward,
        delta,
        prevThreshold: prevDay?.threshold ?? null,
        sessionIndex: total - idx,
      };
    });
  }, [activeTask]);

  const handleDelete = async (id: string) => {
    if (onDeleteSession) {
      await onDeleteSession(id);
    } else {
      await deleteSession(id);
    }
  };

  const totalRuns = activeTask?.sessions?.length ?? 0;

  if (!activeTask || dayRows.length === 0) {
    return (
      <div
        className={cn(
          "p-6 rounded-2xl liquid-glass-panel text-center text-text-faint text-xs font-mono shadow-xs",
          className
        )}
      >
        Nenhuma sessão gravada no histórico deste cenário.
      </div>
    );
  }

  return (
    <div className={cn("p-6 rounded-2xl liquid-glass-panel shadow-xs", className)}>
      <SessionLedgerFilterHeader
        totalDays={dayRows.length}
        totalRuns={totalRuns}
        onCopyEscalate={onCopyEscalate}
      />

      {/* Ledger Table / List */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
        {dayRows.map((day) => (
          <SessionLedgerRow
            key={day.date}
            day={day}
            mouseDpi={mouseDpi}
            onDeleteSession={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

// Compound component attachments
SessionLedger.FilterHeader = SessionLedgerFilterHeader;
SessionLedger.Row = SessionLedgerRow;
SessionLedger.ExpandedRuns = SessionLedgerExpandedRuns;
