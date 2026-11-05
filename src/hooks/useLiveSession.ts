import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useApp } from "@/hooks/useAppData";
import { useSettings } from "@/hooks/useSettings";
import { useAllRuns, useAllSkills } from "@/hooks/useSkill";
import { useToast } from "@/components/ui/Toast";
import { useI18n, type Key } from "@/lib/i18n";
import { DEFAULT_TRAINING_SETTINGS, type TrainingSettings } from "@/lib/types";
import { groupTrainingSessions, sessionKey, type RunRef } from "@/lib/skill/sessions";
import { shouldAlertFatigue } from "@/lib/skill/fatigue";
import {
  buildSessionSummary,
  sessionZs,
  type SessionSummary,
  type SummaryScenario,
} from "@/lib/skill/session-summary";

/** Intervalo em que o hook reavalia se a sessão aberta já encerrou pelo gap. */
const CHECK_MS = 60_000;
const MIN_MS = 60_000;

export interface LiveSessionValue {
  /** Chave da sessão aberta agora (última run dentro do gap), ou null. */
  openKey: string | null;
  /** Número de runs da sessão aberta. */
  openRuns: number;
  /** Sessão encerrada ainda não vista (alimenta o badge do TopBar). */
  endedKey: string | null;
  /** Sessão exibida no diálogo, ou null se fechado. */
  summaryKey: string | null;
  dialogOpen: boolean;
  summary: SessionSummary | null;
  /** O diálogo mostra a sessão ainda aberta (oferece "Encerrar sessão"). */
  live: boolean;
  /** Abre o resumo da sessão indicada (padrão: a aberta, senão a encerrada pendente). */
  openSummary: (key?: string) => void;
  closeSummary: () => void;
  /** Encerra a sessão aberta agora. Uma run nova depois disso abre outra. */
  endSession: () => void;
}

type ToastKind = "success" | "error" | "info" | "warning";

const LiveSessionContext = createContext<LiveSessionValue | null>(null);

/** Só a janela focada abre o resumo sozinha; em background fica o badge. */
function isWindowActive(): boolean {
  return typeof document !== "undefined" && !document.hidden && document.hasFocus();
}

function groupEnd(group: RunRef[]): number {
  return group.reduce((m, r) => Math.max(m, r.t), -Infinity);
}

function latestGroupOf(groups: RunRef[][]): RunRef[] | null {
  let best: RunRef[] | null = null;
  let bestEnd = -Infinity;
  for (const g of groups) {
    const end = groupEnd(g);
    if (end > bestEnd) {
      bestEnd = end;
      best = g;
    }
  }
  return best;
}

interface FatigueSnapshot {
  scenarios: SummaryScenario[];
  training: Pick<TrainingSettings, "fatigueAlerts">;
  showToast: (message: string, type?: ToastKind) => void;
  t: (key: Key) => string;
}

/**
 * Alerta de fadiga para a sessão aberta (T7.4): toast + registro para o resumo.
 * Chamado pelo ponto de extensão `onRunAdded` quando uma run nova entra na sessão aberta.
 */
function onRunAddedFatigue(
  group: RunRef[],
  snap: FatigueSnapshot,
  lastAlertRef: { current: number | null },
  setAlerts: Dispatch<SetStateAction<Record<string, number[]>>>,
): void {
  const key = sessionKey(group);
  const nowMs = Date.now();
  const zs = sessionZs(snap.scenarios, key).map((z) => z.z);
  const fire = shouldAlertFatigue({
    sessionStartMs: group.reduce((m, r) => Math.min(m, r.t), Infinity),
    nowMs,
    zs,
    lastAlertMs: lastAlertRef.current,
    enabled: snap.training.fatigueAlerts,
  });
  if (!fire) return;
  lastAlertRef.current = nowMs;
  setAlerts((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), nowMs] }));
  snap.showToast(snap.t("fatigue.toast"), "warning");
}

/**
 * Estado da sessão ao vivo (Plano 07, T7.2) e alerta de fadiga (T7.4).
 * Montar uma vez no App, dentro de ToastProvider, SettingsProvider e AppProvider.
 */
export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const { appData } = useApp();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const { t } = useI18n();
  const runs = useAllRuns();
  const skills = useAllSkills();

  const training = settings?.training ?? DEFAULT_TRAINING_SETTINGS;
  const gapMin = training.sessionGapMinutes;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), CHECK_MS);
    return () => window.clearInterval(id);
  }, []);

  const groups = useMemo(() => groupTrainingSessions(runs, gapMin), [runs, gapMin]);
  const latest = useMemo(() => latestGroupOf(groups), [groups]);
  const latestEnd = latest ? groupEnd(latest) : null;

  // "Encerrar sessão" guarda o instante da última run; só uma run posterior reabre.
  const [closedAfter, setClosedAfter] = useState<number | null>(null);
  const withinGap = latest !== null && latestEnd !== null && now - latestEnd < gapMin * MIN_MS;
  const closedByUser = closedAfter !== null && latestEnd !== null && latestEnd <= closedAfter;
  const openKey = withinGap && latest && !closedByUser ? sessionKey(latest) : null;
  const openRuns = openKey && latest ? latest.length : 0;

  const [endedKey, setEndedKey] = useState<string | null>(null);
  const [summaryKey, setSummaryKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [alerts, setAlerts] = useState<Record<string, number[]>>({});

  // Sessão que acabou de encerrar: abre o resumo se a janela está em uso, senão deixa o badge.
  const prevOpenRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevOpenRef.current;
    prevOpenRef.current = openKey;
    if (!prev || prev === openKey) return;
    if (isWindowActive()) {
      setSummaryKey(prev);
      setDialogOpen(true);
      setEndedKey(null);
    } else {
      setEndedKey(prev);
    }
  }, [openKey]);

  const scenarios = useMemo<SummaryScenario[]>(() => {
    const out: SummaryScenario[] = [];
    for (const task of appData.tasks) {
      const skill = skills.get(task.id);
      if (!skill) continue;
      out.push({
        taskId: task.id,
        name: task.name,
        category: task.category,
        subcategory: task.subcategory,
        sessions: task.sessions,
        skill,
      });
    }
    return out;
  }, [appData.tasks, skills]);

  const summary = useMemo<SessionSummary | null>(() => {
    if (!summaryKey) return null;
    const group = groups.find((g) => sessionKey(g) === summaryKey);
    if (!group) return null;
    return buildSessionSummary({
      sessionKey: summaryKey,
      group,
      scenarios,
      nowMs: now,
      live: summaryKey === openKey,
      fatigueAlertTimes: alerts[summaryKey] ?? [],
    });
  }, [summaryKey, groups, scenarios, now, openKey, alerts]);

  // ---- onRunAdded: runs novas = diferença para o conjunto visto na renderização anterior ----
  const snapRef = useRef({ groups, scenarios, training, openKey, showToast, t });
  snapRef.current = { groups, scenarios, training, openKey, showToast, t };
  const seenRef = useRef<Set<string> | null>(null);
  const lastAlertRef = useRef<number | null>(null);

  useEffect(() => {
    const keyOf = (r: RunRef) => `${r.taskId}\u0000${r.session.id}`;
    const prevSeen = seenRef.current;
    seenRef.current = new Set(runs.map(keyOf));
    if (prevSeen === null) return; // carga inicial: nada é "novo"
    const added = runs.filter((r) => !prevSeen.has(keyOf(r)));
    if (added.length === 0) return;

    const snap = snapRef.current;
    const newest = added.reduce((a, b) => (b.t > a.t ? b : a));
    const group = snap.groups.find((g) =>
      g.some((r) => r.taskId === newest.taskId && r.session.id === newest.session.id),
    );
    if (!group || snap.openKey === null || sessionKey(group) !== snap.openKey) return;

    onRunAddedFatigue(group, snap, lastAlertRef, setAlerts);
  }, [runs]);

  // ---- ações ----
  const openSummary = useCallback(
    (key?: string) => {
      const target = key ?? openKey ?? endedKey;
      if (!target) return;
      setSummaryKey(target);
      setDialogOpen(true);
      setEndedKey((prev) => (prev === target ? null : prev));
    },
    [openKey, endedKey],
  );

  const closeSummary = useCallback(() => setDialogOpen(false), []);

  const endSession = useCallback(() => {
    if (latestEnd === null || openKey === null) return;
    setClosedAfter(latestEnd);
  }, [latestEnd, openKey]);

  const value = useMemo<LiveSessionValue>(
    () => ({
      openKey,
      openRuns,
      endedKey,
      summaryKey,
      dialogOpen,
      summary,
      live: summaryKey !== null && summaryKey === openKey,
      openSummary,
      closeSummary,
      endSession,
    }),
    [openKey, openRuns, endedKey, summaryKey, dialogOpen, summary, openSummary, closeSummary, endSession],
  );

  return createElement(LiveSessionContext.Provider, { value }, children);
}

export function useLiveSession(): LiveSessionValue {
  const ctx = useContext(LiveSessionContext);
  if (!ctx) throw new Error("useLiveSession must be used within a LiveSessionProvider");
  return ctx;
}
