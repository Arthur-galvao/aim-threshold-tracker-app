import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Playlist, PlaylistItem, Task } from "@/lib/types";
import { DEFAULT_TRAINING_SETTINGS } from "@/lib/types";
import { resolveAutoAdvanceOnThreshold } from "@/lib/threshold";
import { useSettings } from "@/hooks/useSettings";
import { computeSkill } from "@/lib/skill";
import { buildAllRuns, skillConfigFromTraining } from "@/lib/skill/config";
import type { SensAdjustModel } from "@/lib/skill/sens-adjust";
import { setMeasuring } from "@/lib/tauri-bridge";
import {
  countStepAttempts,
  evaluateThresholdStep,
  isMeasureStep,
  stepMaxAttempts,
  stepMaxMinutes,
  targetAtSensCtx,
  type StepSensContext,
  type ThresholdStepOutcome,
} from "@/lib/playlist-step";

interface UsePlaylistRunnerProps {
  tasks: Task[];
  setActiveTaskId: (id: string) => void;
  onStepAdvance?: (stepIndex: number, scenarioName: string, isFinished: boolean) => void;
  globalAutoAdvance?: boolean;
}

export interface PlaylistRunnerState {
  activePlaylist: Playlist | null;
  currentStepIndex: number;
  currentItem: PlaylistItem | null;
  currentTask: Task | null;
  sessionCountAtStart: number;
  /** Meta do passo (score) na sens ativa; null sem histórico. */
  stepTargetThreshold: number | null;
  /** Melhor score entre as runs VÁLIDAS do passo. */
  stepBestScore: number | null;
  /** Tentativas válidas no passo (threshold). */
  stepAttempts: number;
  stepMaxAttempts: number;
  stepMaxMinutes: number;
  /** Resultado do passo threshold: pendente, bateu ou "não bateu" (teto atingido). */
  stepOutcome: ThresholdStepOutcome;
  /** Passo de medição (sens base, randomizer pausado). */
  isMeasureStep: boolean;
  startedAt: number | null;
  elapsedSeconds: number;
  playlistElapsedSeconds: number;
  isFinished: boolean;
  isRunning: boolean;
  completedStepIndices: Set<number>;
  /** Subconjunto de completedStepIndices que terminou sem bater a meta. */
  missedStepIndices: Set<number>;
  start: (playlist: Playlist) => void;
  next: () => void;
  previous: () => void;
  finish: () => void;
  stop: () => void;
  restart: () => void;
  jumpToStep: (index: number) => void;
  syncWithDetectedScenario: (scenarioName: string, playlistName?: string) => void;
  predictNextScenarioName: () => string | null;
  /** Sens e centro do randomizer agora (null = sens fixa, meta sem ajuste). */
  reportSensContext: (ctx: StepSensContext | null) => void;
}

export function usePlaylistRunner({
  tasks,
  setActiveTaskId,
  onStepAdvance,
  globalAutoAdvance,
}: UsePlaylistRunnerProps): PlaylistRunnerState {
  const onStepAdvanceRef = useRef(onStepAdvance);
  onStepAdvanceRef.current = onStepAdvance;

  const { settings } = useSettings();
  const training = settings?.training ?? DEFAULT_TRAINING_SETTINGS;
  const skillCfg = useMemo(() => skillConfigFromTraining(training), [training]);
  const allRuns = useMemo(() => buildAllRuns(tasks), [tasks]);

  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [sessionCountAtStart, setSessionCountAtStart] = useState<number>(0);
  const [sessionIdsAtStart, setSessionIdsAtStart] = useState<Set<string>>(new Set());
  /** Meta (score) e modelo de sens congelados no início do passo. */
  const [stepBase, setStepBase] = useState<{ target: number | null; model: SensAdjustModel | null }>({
    target: null,
    model: null,
  });
  const [sensCtx, setSensCtx] = useState<StepSensContext | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [playlistStartedAt, setPlaylistStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completedStepIndices, setCompletedStepIndices] = useState<Set<number>>(new Set());
  const [missedStepIndices, setMissedStepIndices] = useState<Set<number>>(new Set());

  const shouldAutoAdvance = useMemo(() => {
    return resolveAutoAdvanceOnThreshold(activePlaylist, globalAutoAdvance);
  }, [activePlaylist, globalAutoAdvance]);

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const currentItem = useMemo(() => {
    if (!activePlaylist || !activePlaylist.items[currentStepIndex]) return null;
    return activePlaylist.items[currentStepIndex];
  }, [activePlaylist, currentStepIndex]);

  const currentTask = useMemo(() => {
    if (!currentItem) return null;
    return taskMap.get(currentItem.taskId) ?? null;
  }, [currentItem, taskMap]);

  // Tentativas válidas do passo (runs do cenário criadas depois do início do passo).
  const currentSkill = useMemo(
    () => (currentTask ? computeSkill(currentTask, allRuns, skillCfg, Date.now()) : null),
    [currentTask, allRuns, skillCfg],
  );

  const stepCounts = useMemo(() => {
    if (!currentSkill) return { validAttempts: 0, bestValid: null as number | null };
    return countStepAttempts(
      currentSkill.runs.map((r) => ({ sessionId: r.sessionId, score: r.score, valid: r.validity.valid })),
      sessionIdsAtStart,
    );
  }, [currentSkill, sessionIdsAtStart]);

  const stepTargetThreshold = useMemo(
    () => targetAtSensCtx(stepBase.target, stepBase.model, sensCtx),
    [stepBase, sensCtx],
  );

  const stepBestScore = stepCounts.bestValid;
  const stepIsMeasure = isMeasureStep(currentItem, activePlaylist);
  const maxAttempts = currentItem ? stepMaxAttempts(currentItem) : 0;
  const maxMinutes = currentItem ? stepMaxMinutes(currentItem) : 0;

  const stepOutcome: ThresholdStepOutcome = useMemo(() => {
    if (!currentItem || currentItem.targetMode !== "threshold" || startedAt === null) return "pending";
    return evaluateThresholdStep({
      validAttempts: stepCounts.validAttempts,
      bestValid: stepCounts.bestValid,
      target: stepTargetThreshold,
      minReps: Math.max(1, currentItem.targetValue),
      elapsedSeconds: Math.max(0, (now - startedAt) / 1000),
      maxAttempts: stepMaxAttempts(currentItem),
      maxMinutes: stepMaxMinutes(currentItem),
    });
  }, [currentItem, stepCounts, stepTargetThreshold, startedAt, now]);

  // Ref para os callbacks lerem o estado atual sem closures obsoletas
  const stateRef = useRef({
    activePlaylist,
    currentStepIndex,
    sessionCountAtStart,
    sessionIdsAtStart,
    stepTargetThreshold,
    startedAt,
    playlistStartedAt,
    isFinished,
    isRunning,
    completedStepIndices,
    shouldAutoAdvance,
    stepMissed: false,
    stepOutcome,
  });

  useEffect(() => {
    stateRef.current = {
      activePlaylist,
      currentStepIndex,
      sessionCountAtStart,
      sessionIdsAtStart,
      stepTargetThreshold,
      startedAt,
      playlistStartedAt,
      isFinished,
      isRunning,
      completedStepIndices,
      shouldAutoAdvance,
      stepMissed: currentItem?.targetMode === "threshold" && stepOutcome === "missed",
      stepOutcome,
    };
  });

  // Modo medição (T7.5): randomizer pausado enquanto o passo de medição roda.
  const measuringNow = isRunning && !isFinished && stepIsMeasure;
  const lastMeasuringRef = useRef(false);
  useEffect(() => {
    if (lastMeasuringRef.current === measuringNow) return;
    lastMeasuringRef.current = measuringNow;
    setMeasuring(measuringNow).catch((err) => console.error("Erro ao alterar modo de medição:", err));
  }, [measuringNow]);
  useEffect(() => {
    return () => {
      if (lastMeasuringRef.current) {
        lastMeasuringRef.current = false;
        setMeasuring(false).catch(() => undefined);
      }
    };
  }, []);

  // Advance to step index
  const goToStep = useCallback(
    (index: number, playlist: Playlist) => {
      const item = playlist.items[index];
      if (!item) return;

      const task = taskMap.get(item.taskId) ?? null;
      const count = task ? task.sessions.length : 0;
      const ids = new Set(task ? task.sessions.map((s) => s.id) : []);
      const skill = task ? computeSkill(task, allRuns, skillCfg, Date.now()) : null;

      setCurrentStepIndex(index);
      setSessionCountAtStart(count);
      setSessionIdsAtStart(ids);
      setStepBase({ target: skill?.nextTarget ?? null, model: skill?.model ?? null });
      setStartedAt(Date.now());
      setActiveTaskId(item.taskId);
    },
    [taskMap, setActiveTaskId, allRuns, skillCfg]
  );

  const start = useCallback(
    (playlist: Playlist) => {
      if (!playlist.items || playlist.items.length === 0) return;
      const startTs = Date.now();
      setActivePlaylist(playlist);
      setIsFinished(false);
      setIsRunning(true);
      setPlaylistStartedAt(startTs);
      setNow(startTs);
      setCompletedStepIndices(new Set());
      setMissedStepIndices(new Set());
      goToStep(0, playlist);
    },
    [goToStep]
  );

  const finish = useCallback(() => {
    setNow(Date.now());
    setIsFinished(true);
    setIsRunning(false);
    onStepAdvanceRef.current?.(stateRef.current.currentStepIndex, "", true);
  }, []);

  const next = useCallback(() => {
    const { activePlaylist: pl, currentStepIndex: idx, stepMissed } = stateRef.current;
    if (!pl) return;

    setCompletedStepIndices((prev) => {
      const nextSet = new Set(prev);
      nextSet.add(idx);
      return nextSet;
    });
    if (stepMissed) {
      setMissedStepIndices((prev) => {
        const nextSet = new Set(prev);
        nextSet.add(idx);
        return nextSet;
      });
    }

    if (idx + 1 < pl.items.length) {
      const nextItem = pl.items[idx + 1];
      const nextTask = taskMap.get(nextItem.taskId);
      const nextScenarioName = nextTask ? nextTask.name : "";
      goToStep(idx + 1, pl);
      onStepAdvanceRef.current?.(idx + 1, nextScenarioName, false);
    } else {
      finish();
    }
  }, [goToStep, finish, taskMap]);

  const previous = useCallback(() => {
    const { activePlaylist: pl, currentStepIndex: idx } = stateRef.current;
    if (!pl || idx <= 0) return;
    goToStep(idx - 1, pl);
  }, [goToStep]);

  const stop = useCallback(() => {
    setActivePlaylist(null);
    setIsRunning(false);
    setIsFinished(false);
    setCurrentStepIndex(0);
    setStartedAt(null);
    setPlaylistStartedAt(null);
  }, []);

  const restart = useCallback(() => {
    if (!activePlaylist) return;
    start(activePlaylist);
  }, [activePlaylist, start]);

  const jumpToStep = useCallback(
    (index: number) => {
      const { activePlaylist: pl } = stateRef.current;
      if (!pl) return;
      goToStep(index, pl);
    },
    [goToStep]
  );

  const reportSensContext = useCallback((ctx: StepSensContext | null) => {
    setSensCtx((prev) => {
      if (prev === ctx) return prev;
      if (prev && ctx && prev.sensCm === ctx.sensCm && prev.centerCm === ctx.centerCm) return prev;
      return ctx;
    });
  }, []);

  const syncWithDetectedScenario = useCallback(
    (scenarioName: string, playlistName?: string) => {
      const {
        activePlaylist: pl,
        currentStepIndex: curIdx,
        isRunning: running,
        isFinished: finished,
        completedStepIndices: completed,
      } = stateRef.current;

      if (!pl) return;

      const cleanScenario = scenarioName.trim().toLowerCase();
      if (!cleanScenario) return;

      const playlistMatches =
        Boolean(playlistName && playlistName.trim()) &&
        pl.name.trim().toLowerCase() === playlistName!.trim().toLowerCase();

      const targetStepIndex = pl.items.findIndex((item) => {
        const task = taskMap.get(item.taskId);
        const nameInTask = task ? task.name.trim().toLowerCase() : "";
        const nameInItem = (item as any).scenarioName
          ? String((item as any).scenarioName).trim().toLowerCase()
          : "";
        return nameInTask === cleanScenario || nameInItem === cleanScenario;
      });

      if (!playlistMatches && targetStepIndex === -1) {
        return;
      }

      if (targetStepIndex === -1) {
        return;
      }

      if (!running || finished) {
        setIsFinished(false);
        setIsRunning(true);
      }

      if (targetStepIndex === curIdx) {
        const item = pl.items[targetStepIndex];
        const task = taskMap.get(item.taskId);
        const count = task ? task.sessions.length : 0;
        const startCount = stateRef.current.sessionCountAtStart;
        const completedReps = count - startCount;

        if (item.targetMode === "reps" && completedReps >= item.targetValue) {
          next();
        } else if (item.targetMode === "threshold" && shouldAutoAdvance) {
          // Bateu ou atingiu o teto: o efeito de auto-avanço já trata; isto cobre o caso de tasks atrasadas.
          if (stateRef.current.stepOutcome !== "pending") next();
        }
      } else if (targetStepIndex > curIdx) {
        setCompletedStepIndices((prev) => {
          const nextSet = new Set(prev);
          for (let i = 0; i < targetStepIndex; i++) {
            nextSet.add(i);
          }
          return nextSet;
        });
        const targetItem = pl.items[targetStepIndex];
        const targetTask = taskMap.get(targetItem.taskId);
        const scenarioName = targetTask ? targetTask.name : "";
        goToStep(targetStepIndex, pl);
        onStepAdvanceRef.current?.(targetStepIndex, scenarioName, false);
      } else if (finished || !completed.has(targetStepIndex)) {
        goToStep(targetStepIndex, pl);
      }
    },
    [taskMap, next, goToStep, shouldAutoAdvance]
  );

  // Tick timer for time-based targets
  useEffect(() => {
    if (!isRunning || isFinished) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, [isRunning, isFinished]);

  // Auto-advance checking: reps, threshold or time
  useEffect(() => {
    if (!isRunning || isFinished || !activePlaylist || !currentItem) return;

    if (currentItem.targetMode === "reps") {
      const currentSessionsCount = currentTask ? currentTask.sessions.length : 0;
      const completedReps = currentSessionsCount - sessionCountAtStart;
      if (completedReps >= currentItem.targetValue) {
        next();
      }
    } else if (currentItem.targetMode === "threshold") {
      // Bateu (runs válidas >= meta) ou teto (tentativas/minutos) => avança.
      if (shouldAutoAdvance && stepOutcome !== "pending") {
        next();
      }
    } else if (currentItem.targetMode === "time" && startedAt !== null) {
      const elapsed = Math.floor((now - startedAt) / 1000);
      if (elapsed >= currentItem.targetValue) {
        next();
      }
    }
  }, [
    isRunning,
    isFinished,
    activePlaylist,
    currentItem,
    currentTask,
    sessionCountAtStart,
    stepOutcome,
    startedAt,
    now,
    next,
    shouldAutoAdvance,
  ]);

  const elapsedSeconds = useMemo(() => {
    if (!startedAt) return 0;
    return Math.max(0, Math.floor((now - startedAt) / 1000));
  }, [startedAt, now]);

  const playlistElapsedSeconds = useMemo(() => {
    if (!playlistStartedAt) return 0;
    return Math.max(0, Math.floor((now - playlistStartedAt) / 1000));
  }, [playlistStartedAt, now]);

  const predictNextScenarioName = useCallback((): string | null => {
    const {
      activePlaylist: pl,
      currentStepIndex: idx,
      isRunning: running,
      isFinished: finished,
      sessionCountAtStart: startCount,
    } = stateRef.current;
    if (!running || finished || !pl || !pl.items[idx]) {
      return null;
    }
    const item = pl.items[idx];
    const task = taskMap.get(item.taskId);
    if (!task) return null;

    if (item.targetMode === "reps" || item.targetMode === "threshold") {
      const currentReps = Math.max(0, task.sessions.length - startCount);
      if (currentReps + 1 < item.targetValue) {
        return task.name;
      }
      if (idx + 1 < pl.items.length) {
        const nextItem = pl.items[idx + 1];
        const nextTask = taskMap.get(nextItem.taskId);
        return nextTask ? nextTask.name : task.name;
      }
      return task.name;
    }

    return task.name;
  }, [taskMap]);

  return {
    activePlaylist,
    currentStepIndex,
    currentItem,
    currentTask,
    sessionCountAtStart,
    stepTargetThreshold,
    stepBestScore,
    stepAttempts: stepCounts.validAttempts,
    stepMaxAttempts: maxAttempts,
    stepMaxMinutes: maxMinutes,
    stepOutcome,
    isMeasureStep: stepIsMeasure,
    startedAt,
    elapsedSeconds,
    playlistElapsedSeconds,
    isFinished,
    isRunning,
    completedStepIndices,
    missedStepIndices,
    start,
    next,
    previous,
    finish,
    stop,
    restart,
    jumpToStep,
    syncWithDetectedScenario,
    predictNextScenarioName,
    reportSensContext,
  };
}
