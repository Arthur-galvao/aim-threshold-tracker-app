import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { computeRangePreview } from "@/lib/sens-lattice";
import type { RandomizerSettings } from "./useSensRandomizer";

export interface RangePreview {
  minCm: number;
  maxCm: number;
  minMult: number;
  maxMult: number;
  gridCm: number[];
}

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function useRangePreview(
  settings: RandomizerSettings,
  centerCm?: number | null
): RangePreview {
  const localFallback = useMemo(
    () => computeRangePreview(settings, centerCm),
    [
      settings.baseSensCm,
      settings.rangeMode,
      settings.minCm,
      settings.maxCm,
      settings.minMult,
      settings.maxMult,
      settings.spreadPercent,
      settings.autoScenarioSens,
      settings.scenarioIdealCm,
      centerCm,
    ]
  );

  const [ipcPreview, setIpcPreview] = useState<RangePreview | null>(null);

  useEffect(() => {
    if (!isTauri()) {
      setIpcPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await invoke<RangePreview>("preview_sens_range", {
          settings,
          centerCm: centerCm ?? null,
        });
        if (!cancelled) {
          setIpcPreview(res);
        }
      } catch (err) {
        console.error("Falha ao obter preview de range:", err);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    settings.baseSensCm,
    settings.rangeMode,
    settings.minCm,
    settings.maxCm,
    settings.minMult,
    settings.maxMult,
    settings.spreadPercent,
    settings.autoScenarioSens,
    settings.scenarioIdealCm,
    centerCm,
  ]);

  return ipcPreview ?? localFallback;
}
