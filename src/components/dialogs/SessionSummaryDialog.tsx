import { Timer } from "@phosphor-icons/react";
import {
  Badge,
  Button,
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui";
import { useI18n, type Key } from "@/lib/i18n";
import type { SessionSummary, ScenarioSummaryRow } from "@/lib/skill/session-summary";
import type { InvalidReason } from "@/lib/skill/validity";

export interface SessionSummaryDialogProps {
  open: boolean;
  onClose: () => void;
  summary: SessionSummary | null;
  /** Sessão ainda aberta: mostra "Encerrar sessão". */
  live: boolean;
  onEnd: () => void;
}

const REASON_KEYS: Record<InvalidReason, Key> = {
  warmup: "session.summary.reason.warmup",
  paused: "session.summary.reason.paused",
  no_score: "session.summary.reason.noScore",
  off_center_unadjustable: "session.summary.reason.offCenter",
  manual_excluded: "session.summary.reason.manual",
};

export function SessionSummaryDialog({ open, onClose, summary, live, onEnd }: SessionSummaryDialogProps) {
  const { t } = useI18n();

  const reasonsText = (reasons: Partial<Record<InvalidReason, number>>) =>
    (Object.keys(reasons) as InvalidReason[])
      .map((r) => `${t(REASON_KEYS[r])} ×${reasons[r]}`)
      .join(" · ");

  const suggestion = summary?.nextSuggestion ?? null;
  const suggestionText = suggestion
    ? suggestion.suggestion === "stress"
      ? t("session.summary.nextStress", { sub: suggestion.subcategory })
      : t("session.summary.nextRefine", { sub: suggestion.subcategory })
    : t("session.summary.nextNone");

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup variant="dialog" className="max-w-lg max-h-[85vh] overflow-y-auto">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-edge">
            <div className="w-8 h-8 rounded-control bg-score-soft text-score border border-edge flex items-center justify-center shrink-0">
              <Timer size={16} weight="bold" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-semibold text-text-main font-sans">
                {t("session.summary.title")}
              </DialogTitle>
              <p className="text-[11px] text-text-faint">
                {live ? t("session.summary.live") : t("session.summary.ended")}
              </p>
            </div>
          </div>

          {!summary ? (
            <p className="text-xs text-text-faint">{t("session.summary.noRuns")}</p>
          ) : (
            <div className="flex flex-col gap-4 text-xs text-text-main">
              {/* Números gerais */}
              <div className="grid grid-cols-3 gap-2">
                <Stat label={t("session.summary.duration")} value={`${Math.round(summary.durationMin)} min`} />
                <Stat label={t("session.summary.runs")} value={`${summary.validRuns}/${summary.runs}`} hint={t("session.summary.valid")} />
                <Stat
                  label={t("session.summary.focus")}
                  value={summary.focusOnShare === null ? "—" : `${Math.round(summary.focusOnShare * 100)}%`}
                  hint={summary.focusOnShare === null ? t("session.summary.focusNone") : undefined}
                />
              </div>

              {Object.keys(summary.invalidReasons).length > 0 && (
                <p className="text-[11px] text-text-faint">
                  {t("session.summary.invalidReasons", { reasons: reasonsText(summary.invalidReasons) })}
                </p>
              )}

              {/* Por cenário */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                  {t("session.summary.scenarios")}
                </span>
                {summary.scenarios.length === 0 && (
                  <p className="text-text-faint">{t("session.summary.noRuns")}</p>
                )}
                {summary.scenarios.map((row) => (
                  <ScenarioLine key={row.taskId} row={row} reasonsText={reasonsText} />
                ))}
              </div>

              {/* Próxima sugestão */}
              <div className="liquid-well p-3 rounded-control flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                  {t("session.summary.next")}
                </span>
                <p>{suggestionText}</p>
                {summary.fatigueAlerts > 0 && (
                  <p className="text-[11px] text-amber">
                    {t("session.summary.fatigue", { n: summary.fatigueAlerts })}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            {live && (
              <Button variant="danger" size="sm" onClick={onEnd}>
                {t("session.live.end")}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t("session.summary.close")}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="liquid-well p-2.5 rounded-control min-w-0">
      <div className="text-[10px] text-text-faint uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold tabular-nums font-mono">{value}</div>
      {hint && <div className="text-[10px] text-text-faint truncate">{hint}</div>}
    </div>
  );
}

function ScenarioLine({
  row,
  reasonsText,
}: {
  row: ScenarioSummaryRow;
  reasonsText: (reasons: Partial<Record<InvalidReason, number>>) => string;
}) {
  const { t } = useI18n();
  const hitVariant = row.hit === null ? "neutral" : row.hit ? "emerald" : "amber";
  const hitLabel =
    row.hit === null ? t("session.summary.firstSession") : row.hit ? t("session.summary.hit") : t("session.summary.miss");
  const delta =
    row.deltaMuPct === null ? "—" : `${row.deltaMuPct >= 0 ? "+" : ""}${row.deltaMuPct.toFixed(1)}%`;
  const reasons = reasonsText(row.invalidReasons);

  return (
    <div className="liquid-well p-2.5 rounded-control flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="font-semibold truncate">{row.name}</span>
        <Badge variant={hitVariant}>{hitLabel}</Badge>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-secondary font-mono tabular-nums">
        <span>
          {t("session.summary.best")}: {row.bestScore === null ? "—" : row.bestScore.toFixed(0)}
        </span>
        <span>
          {t("session.summary.target")}: {row.target === null ? "—" : row.target.toFixed(0)}
        </span>
        <span>Δμ {delta}</span>
        <span>
          {row.validRuns}/{row.runs} {t("session.summary.valid").toLowerCase()}
        </span>
      </div>
      {reasons && <span className="text-[10px] text-text-faint">{reasons}</span>}
    </div>
  );
}
