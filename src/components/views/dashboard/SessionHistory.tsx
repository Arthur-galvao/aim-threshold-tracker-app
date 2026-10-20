import { useState, useMemo } from "react";
import { ClockCounterClockwise, Copy } from "@phosphor-icons/react";
import { useTrackerWorkspace } from "@/context/TrackerWorkspaceContext";
import { useToast } from "@/components/ui/Toast";
import { summarizeDays } from "@/lib/day-summary";
import { buildEscalateFormat } from "@/lib/threshold";
import { useI18n } from "@/lib/i18n";
import { Button, EmptyState } from "@/components/ui";
import { DayHistoryCard, type DayGroupItem } from "./DayHistoryCard";
import { cn } from "@/lib/utils";

export interface SessionHistoryProps {
  className?: string;
  embedded?: boolean;
}

export function SessionHistory({ className, embedded = false }: SessionHistoryProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { state, actions } = useTrackerWorkspace();
  const { activeTask } = state;

  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [visibleDaysCount, setVisibleDaysCount] = useState<number>(14);

  const dayGroups = useMemo<DayGroupItem[]>(() => {
    if (!activeTask?.sessions || activeTask.sessions.length === 0) return [];
    const summaries = summarizeDays(activeTask);
    const reversed = [...summaries].reverse();

    return reversed.map((summary) => {
      const runs = activeTask.sessions.filter((s) => s.date === summary.date);
      return {
        ...summary,
        individualSessions: runs,
      };
    });
  }, [activeTask]);

  const totalRuns = activeTask?.sessions?.length ?? 0;
  const visibleGroups = dayGroups.slice(0, visibleDaysCount);

  const toggleDay = (dateStr: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  const handleCopyEscalate = () => {
    if (!activeTask || !activeTask.sessions.length) {
      showToast(t("toast.noData"), "error");
      return;
    }
    const text = buildEscalateFormat(activeTask);
    if (!text) {
      showToast(t("toast.noData"), "error");
      return;
    }
    void navigator.clipboard.writeText(text);
    showToast(t("toast.copiedEscalate"), "success");
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await actions.deleteSession(sessionId);
      showToast(t("toast.sessionDeleted"), "success");
    } catch {
      showToast("Erro ao excluir", "error");
    }
  };

  return (
    <div
      className={cn(
        embedded ? "flex flex-col h-full" : "liquid-surface p-5 flex flex-col",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3 select-none">
        <span className="text-xs font-mono text-text-faint tabular">
          {t("hist.totalDaysRuns", { days: dayGroups.length, runs: totalRuns })}
        </span>

        {!embedded && activeTask && activeTask.sessions.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCopyEscalate}
            icon={<Copy size={14} weight="regular" />}
          >
            {t("hist.copy")}
          </Button>
        )}
      </div>

      {/* List / Empty State */}
      {dayGroups.length === 0 ? (
        <EmptyState
          icon={<ClockCounterClockwise size={24} weight="regular" />}
          title={t("hist.empty")}
          description={t("dashboard.emptyDesc")}
          className="min-h-[180px]"
        />
      ) : (
        <div className="space-y-2 max-h-[380px] scroll-y pr-1">
          {visibleGroups.map((day) => (
            <DayHistoryCard
              key={day.date}
              day={day}
              isExpanded={expandedDays.has(day.date)}
              onToggle={() => toggleDay(day.date)}
              onDeleteSession={handleDeleteSession}
            />
          ))}

          {/* Show More Button */}
          {dayGroups.length > visibleDaysCount && (
            <div className="pt-2 text-center">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setVisibleDaysCount((v) => v + 14)}
              >
                {t("hist.showMore")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
