import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "@/lib/types";
import { getScenarioIdealSens } from "@/lib/sens-analytics";

import { stabilizeCenter } from "../lib/scenario-centers";
export { stabilizeCenter };

interface UseScenarioCentersSyncProps {
  tasks: Task[];
  mouseDpi: number;
  enabled?: boolean;
}

export function useScenarioCentersSync({
  tasks,
  mouseDpi,
  enabled = true,
}: UseScenarioCentersSyncProps) {
  const prevCentersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!enabled || !tasks || tasks.length === 0) return;

    const timeoutId = window.setTimeout(async () => {
      const centers: Record<string, number> = {};
      const newPrevMap = new Map<string, number>();

      for (const task of tasks) {
        if (!task.name || !task.name.trim()) continue;
        const normKey = task.name.trim().toLowerCase();
        const ideal = getScenarioIdealSens(task, tasks, mouseDpi).value;
        const prev = prevCentersRef.current.get(normKey);
        const stabilized = stabilizeCenter(prev, ideal);
        centers[normKey] = stabilized;
        newPrevMap.set(normKey, stabilized);
      }

      try {
        await invoke("set_scenario_centers", { centers });
        prevCentersRef.current = newPrevMap;
      } catch (err) {
        console.error("Falha ao sincronizar centros de cenarios com o Rust:", err);
      }
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [tasks, mouseDpi, enabled]);
}
