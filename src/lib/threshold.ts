import type { Task } from "./types";

export function getTargetThresholdForTask(task: Task | null): number | null {
  if (!task || !task.sessions || task.sessions.length === 0) {
    return null;
  }
  const sorted = [...task.sessions].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1].threshold;
}

export function recalculateAllTaskThresholds(task: Task): void {
  if (!task.sessions || task.sessions.length === 0) return;

  task.sessions.sort((a, b) => a.date.localeCompare(b.date));

  const dateGroups: { date: string; entries: typeof task.sessions }[] = [];
  let currentGroup: (typeof dateGroups)[number] | null = null;
  let currentDate: string | null = null;

  task.sessions.forEach((sess) => {
    if (sess.date !== currentDate) {
      currentDate = sess.date;
      currentGroup = { date: currentDate, entries: [] };
      dateGroups.push(currentGroup);
    }
    currentGroup!.entries.push(sess);
  });

  let prevThreshold: number | null = null;

  dateGroups.forEach((group, gIdx) => {
    const scores = group.entries.map((e) => Number(e.pb) || 0);
    const dayPB = Math.max(...scores);

    let groupThreshold = 0;

    if (gIdx === 0 || prevThreshold === null) {
      if (scores.length > 1) {
        const sortedScores = [...scores].sort((a, b) => b - a);
        groupThreshold = Math.round(sortedScores[1]);
      } else {
        groupThreshold = Math.round(dayPB * 0.92);
      }
    } else {
      let candidate = Math.round(dayPB * 0.93);
      if (scores.length > 1) {
        const sortedScores = [...scores].sort((a, b) => b - a);
        candidate = Math.max(candidate, Math.round(sortedScores[1]));
      }

      groupThreshold = Math.max(prevThreshold, candidate);

      if (dayPB < groupThreshold) {
        groupThreshold = Math.min(prevThreshold, dayPB);
      }
    }

    group.entries.forEach((entry) => {
      entry.threshold = groupThreshold;
    });

    prevThreshold = groupThreshold;
  });
}

export function parseInputScores(rawInput: string): number[] {
  if (!rawInput) return [];
  return rawInput
    .toString()
    .split(/[\s,;]+/)
    .map((v) => parseFloat(v))
    .filter((v) => !isNaN(v) && v > 0);
}

export type SessionDetailKey =
  | "session.detailNoTask"
  | "session.detailFirst"
  | "session.detailTypeScores"
  | "session.detailGoal"
  | "session.detailEvolved"
  | "session.detailMaintained";

export function estimateSessionThreshold(
  task: Task | null,
  rawScores: number[]
): {
  threshold: number | null;
  detailKey: SessionDetailKey;
  detailParams: Record<string, string | number>;
} {
  const targetThresh = task ? getTargetThresholdForTask(task) : null;

  if (!task) {
    return {
      threshold: null,
      detailKey: "session.detailNoTask",
      detailParams: {},
    };
  }

  if (targetThresh === null) {
    if (rawScores.length > 0) {
      const maxInInput = Math.max(...rawScores);
      const firstThreshold =
        rawScores.length > 1
          ? [...rawScores].sort((a, b) => b - a)[1]
          : Math.round(maxInInput * 0.92);
      return {
        threshold: firstThreshold,
        detailKey: "session.detailFirst",
        detailParams: { n: rawScores.length, t: firstThreshold },
      };
    }
    return {
      threshold: null,
      detailKey: "session.detailTypeScores",
      detailParams: {},
    };
  }

  if (rawScores.length === 0) {
    return {
      threshold: targetThresh,
      detailKey: "session.detailGoal",
      detailParams: { t: targetThresh },
    };
  }

  const maxInInput = Math.max(...rawScores);
  let estimatedThreshold = targetThresh;

  if (rawScores.length > 1) {
    const sortedRuns = [...rawScores].sort((a, b) => b - a);
    estimatedThreshold = Math.max(targetThresh, Math.round(sortedRuns[1]));
  } else {
    estimatedThreshold = Math.max(targetThresh, Math.round(maxInInput * 0.93));
  }

  if (maxInInput < estimatedThreshold) {
    estimatedThreshold = Math.min(targetThresh, maxInInput);
  }

  return {
    threshold: estimatedThreshold,
    detailKey:
      estimatedThreshold > targetThresh
        ? "session.detailEvolved"
        : "session.detailMaintained",
    detailParams: { t: estimatedThreshold },
  };
}

export function computeTaskMetrics(task: Task | null) {
  if (!task || !task.sessions || task.sessions.length === 0) {
    return {
      maxPB: null as number | null,
      targetThreshold: null as number | null,
      consistency: null as string | null,
      lastSens: null as number | null,
    };
  }

  const pbs = task.sessions.map((s) => Number(s.pb) || 0);
  const maxPB = Math.max(...pbs);
  const targetThreshold = getTargetThresholdForTask(task);

  const dateGroups: { date: string; entries: typeof task.sessions }[] = [];
  let currentDate: string | null = null;
  let currentGroup: (typeof dateGroups)[number] | null = null;

  task.sessions.forEach((sess) => {
    if (sess.date !== currentDate) {
      currentDate = sess.date;
      currentGroup = { date: currentDate, entries: [] };
      dateGroups.push(currentGroup);
    }
    currentGroup!.entries.push(sess);
  });

  let totalRatio = 0;
  let validDays = 0;
  dateGroups.forEach((group) => {
    const scores = group.entries.map((e) => Number(e.pb) || 0);
    const dayPB = Math.max(...scores);
    const dayThreshold = group.entries[0].threshold;
    if (dayPB > 0) {
      totalRatio += dayThreshold / dayPB;
      validDays++;
    }
  });

  const consistency =
    validDays > 0 ? ((totalRatio / validDays) * 100).toFixed(1) : "0.0";

  const sorted = [...task.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const lastSession = sorted[sorted.length - 1];

  return {
    maxPB,
    targetThreshold,
    consistency: `${consistency}%`,
    lastSens: lastSession.sens,
  };
}

export function buildEscalateFormat(task: Task): string | null {
  if (!task.sessions.length) return null;

  const sortedSessions = [...task.sessions].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const lastSession = sortedSessions[sortedSessions.length - 1];

  let textOutput = `${task.name} - ${lastSession.sens}cm 103\n`;

  sortedSessions.forEach((s) => {
    const [, month, day] = s.date.split("-");
    textOutput += `${s.pb} [${s.threshold}] (${day}/${month}) `;
  });

  return textOutput.trim();
}

export function recalculateAllTasks(tasks: Task[]): void {
  tasks.forEach((task) => recalculateAllTaskThresholds(task));
}
