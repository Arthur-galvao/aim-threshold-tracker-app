import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Playlist, PlaylistItem, Task } from "@/lib/types";

interface UsePlaylistRunnerProps {
  tasks: Task[];
  setActiveTaskId: (id: string) => void;
}

export interface PlaylistRunnerState {
  activePlaylist: Playlist | null;
  currentStepIndex: number;
  currentItem: PlaylistItem | null;
  currentTask: Task | null;
  sessionCountAtStart: number;
  startedAt: number | null;
  elapsedSeconds: number;
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
}

export function usePlaylistRunner({
  tasks,
  setActiveTaskId,
}: UsePlaylistRunnerProps): PlaylistRunnerState {
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [sessionCountAtStart, setSessionCountAtStart] = useState<number>(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completedStepIndices, setCompletedStepIndices] = useState<Set<number>>(new Set());

  // Ref to hold current state for interval checks without stale closures
  const stateRef = useRef({
    activePlaylist,
    currentStepIndex,
    sessionCountAtStart,
    startedAt,
    isFinished,
    isRunning,
    completedStepIndices,
  });

  useEffect(() => {
    stateRef.current = {
      activePlaylist,
      currentStepIndex,
      sessionCountAtStart,
      startedAt,
      isFinished,
      isRunning,
      completedStepIndices,
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

  // Advance to step index
  const goToStep = useCallback(
    (index: number, playlist: Playlist) => {
      const item = playlist.items[index];
      if (!item) return;

      const task = taskMap.get(item.taskId);
      const count = task ? task.sessions.length : 0;

      setCurrentStepIndex(index);
      setSessionCountAtStart(count);
      setStartedAt(Date.now());
      setActiveTaskId(item.taskId);
    },
    [taskMap, setActiveTaskId]
  );

  const start = useCallback(
    (playlist: Playlist) => {
      if (!playlist.items || playlist.items.length === 0) return;
      setActivePlaylist(playlist);
      setIsFinished(false);
      setIsRunning(true);
      setCompletedStepIndices(new Set());
      goToStep(0, playlist);
    },
    [goToStep]
  );

  const finish = useCallback(() => {
    setIsFinished(true);
    setIsRunning(false);
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
      goToStep(idx + 1, pl);
    } else {
      finish();
    }
  }, [goToStep, finish]);

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
        }
      } else if (targetStepIndex > curIdx) {
        setCompletedStepIndices((prev) => {
          const nextSet = new Set(prev);
          for (let i = 0; i < targetStepIndex; i++) {
            nextSet.add(i);
          }
          return nextSet;
        });
        goToStep(targetStepIndex, pl);
      } else if (finished || !completed.has(targetStepIndex)) {
        goToStep(targetStepIndex, pl);
      }
    },
    [taskMap, next, goToStep]
  );

  // Tick timer for time-based targets
  useEffect(() => {
    if (!isRunning || isFinished) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, [isRunning, isFinished]);

  // Auto-advance checking: reps or time
  useEffect(() => {
    if (!isRunning || isFinished || !activePlaylist || !currentItem) return;

    if (currentItem.targetMode === "reps") {
      const currentSessionsCount = currentTask ? currentTask.sessions.length : 0;
      const completedReps = currentSessionsCount - sessionCountAtStart;
      if (completedReps >= currentItem.targetValue) {
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
    startedAt,
    now,
    next,
  ]);

  const elapsedSeconds = useMemo(() => {
    if (!startedAt) return 0;
    return Math.max(0, Math.floor((now - startedAt) / 1000));
  }, [startedAt, now]);

  return {
    activePlaylist,
    currentStepIndex,
    currentItem,
    currentTask,
    sessionCountAtStart,
    startedAt,
    elapsedSeconds,
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
  };
}
