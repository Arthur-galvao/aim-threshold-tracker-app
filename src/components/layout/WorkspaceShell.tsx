import type { ReactNode } from "react";
import { CommandBar } from "./CommandBar";
import { TelemetryBento } from "@/components/bento/TelemetryBento";
import { RatchetAnalyticsStage } from "@/components/analytics/RatchetAnalyticsStage";
import { SessionQuickComposer } from "@/components/composer/SessionQuickComposer";
import { SessionLedger } from "@/components/ledger/SessionLedger";
import { cn } from "@/lib/utils";

export interface WorkspaceShellProps {
  children?: ReactNode;
  className?: string;
}

/**
 * WorkspaceShell: Master Liquid Glass stage container.
 * Establishes the 8px spatial grid with p-6 lg:p-7 padding and 24px vertical rhythm (gap-6).
 */
export function WorkspaceShell({ children, className }: WorkspaceShellProps) {
  return (
    <div
      className={cn(
        "relative w-full min-h-0 bg-transparent text-text-main flex flex-col p-6 lg:p-8 max-w-[1680px] mx-auto gap-6",
        className
      )}
    >
      {children}
    </div>
  );
}

// Compound component attachments for idiomatic composition
WorkspaceShell.CommandBar = CommandBar;
WorkspaceShell.TelemetryBento = TelemetryBento;
WorkspaceShell.RatchetAnalyticsStage = RatchetAnalyticsStage;
WorkspaceShell.SessionQuickComposer = SessionQuickComposer;
WorkspaceShell.SessionLedger = SessionLedger;
