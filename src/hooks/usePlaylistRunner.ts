import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Playlist, PlaylistItem, Task } from "@/lib/types";
import { getTargetThresholdForTask, resolveAutoAdvanceOnThreshold } from "@/lib/threshold";

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
  stepTargetThreshold: number | null;
  stepBestScore: number | null;
  startedAt: number | null;
  elapsedSeconds: number;
  playlistElapsedSeconds: number;
  isFinished: boolean;
  isRunning: boolean;
  completedStepIndices: Set<number>;
  start: (playlist: Playlist) => void;
  next: () => void;
  previous: () => void;
  finish: () => void;
  stop: () => void;
  restart: () => void;
  jumpToStep: (index: number) => void;
  syncWithDetectedScenario: (scenarioName: string, playlistName?: string) => void;
  predictNextScenarioName: () => string | null;
}

export function usePlaylistRunner({
  tasks,
  setActiveTaskId,
  onStepAdvance,
  globalAutoAdvance,
}: UsePlaylistRunnerProps): PlaylistRunnerState {
  const onStepAdvanceRef = useRef(onStepAdvance);
  onStepAdvanceRef.current = onStepAdvance;

  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [sessionCountAtStart, setSessionCountAtStart] = useState<number>(0);
  const [sessionIdsAtStart, setSessionIdsAtStart] = useState<Set<string>>(new Set());
  const [stepTargetThreshold, setStepTargetThreshold] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [playlistStartedAt, setPlaylistStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completedStepIndices, setCompletedStepIndices] = useState<Set<number>>(new Set());

  const shouldAutoAdvance = useMemo(() => {
    return resolveAutoAdvanceOnThreshold(activePlaylist, globalAutoAdvance);
  }, [activePlaylist, globalAutoAdvance]);

  // Ref to hold current state for interval checks without stale closures
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
    };
  });

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const currentItem = useMemo(() => {
    if (!activePlaylist || !activePlaylist.items[currentStepIndex]) return null;
    return activePlaylist.items[currentStepIndex];
  }, [activePlaylist, currentStepIndex]);

  const currentTask = useMemo(() => {
    if (!currentItem) return null;
    return taskMap.get(currentItem.taskId) ?? null;
  }, [currentItem, taskMap]);

  const stepBestScore = useMemo(() => {
    if (!currentTask || !currentTask.sessions.length) return null;
    const newSessions = currentTask.sessions.filter((s) => !sessionIdsAtStart.has(s.id));
    if (newSessions.length === 0) return null;
    return Math.max(...newSessions.map((s) => Number(s.pb) || 0));
  }, [currentTask, sessionIdsAtStart]);

  // Advance to step index
  const goToStep = useCallback(
    (index: number, playlist: Playlist) => {
      const item = playlist.items[index];
      if (!item) return;

      const task = taskMap.get(item.taskId) ?? null;
      const count = task ? task.sessions.length : 0;
      const ids = new Set(task ? task.sessions.map((s) => s.id) : []);
      const targetThresh = getTargetThresholdForTask(task);

      setCurrentStepIndex(index);
      setSessionCountAtStart(count);
      setSessionIdsAtStart(ids);
      setStepTargetThreshold(targetThresh);
      setStartedAt(Date.now());
      setActiveTaskId(item.taskId);
    },
    [taskMap, setActiveTaskId]
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
    const { activePlaylist: pl, currentStepIndex: idx } = stateRef.current;
    if (!pl) return;

    setCompletedStepIndices((prev) => {
      const nextSet = new Set(prev);
      nextSet.add(idx);
      return nextSet;
    });

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
        } else if (item.targetMode === "threshold" && completedReps >= Math.max(1, item.targetValue)) {
          const startIds = stateRef.current.sessionIdsAtStart;
          const newScores = task
            ? task.sessions.filter((s) => !startIds.has(s.id)).map((s) => Number(s.pb) || 0)
            : [];
          const bestInStep = newScores.length > 0 ? Math.max(...newScores) : null;
          const targetThresh = stateRef.current.stepTargetThreshold;
          if (targetThresh === null || (bestInStep !== null && bestInStep >= targetThresh)) {
            if (shouldAutoAdvance) {
              next();
            }
          }
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
      const currentSessionsCount = currentTask ? currentTask.sessions.length : 0;
      const completedReps = currentSessionsCount - sessionCountAtStart;
      const minReps = Math.max(1, currentItem.targetValue);
      const thresholdMet =
        stepTargetThreshold === null ||
        (stepBestScore !== null && stepBestScore >= stepTargetThreshold);
      if (completedReps >= minReps && thresholdMet) {
        if (shouldAutoAdvance) {
          next();
        }
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
    stepTargetThreshold,
    stepBestScore,
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
    startedAt,
    elapsedSeconds,
    playlistElapsedSeconds,
    isFinished,
    isRunning,
    completedStepIndices,
    start,
    next,
    previous,
    finish,
    stop,
    restart,
    jumpToStep,
    syncWithDetectedScenario,
    predictNextScenarioName,
  };
}
