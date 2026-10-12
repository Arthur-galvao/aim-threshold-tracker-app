import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { RandomizerSettings } from "./useSensRandomizer";

export interface RangePreview {
  minCm: number;
  maxCm: number;
  minMult: number;
  maxMult: number;
  gridCm: number[];
}

export function useRangePreview(
  settings: RandomizerSettings,
  centerCm?: number | null
): RangePreview | null {
  const [preview, setPreview] = useState<RangePreview | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await invoke<RangePreview>("preview_sens_range", {
          settings,
          centerCm: centerCm ?? null,
        });
        if (!cancelled) {
          setPreview(res);
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

  return preview;
}
