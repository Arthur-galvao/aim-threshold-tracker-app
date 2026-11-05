import { useEffect, useMemo, useRef } from "react";
import type { Task } from "@/lib/types";
import { setScenarioMeta } from "@/lib/tauri-bridge";
import { buildScenarioMeta, type CenterSource } from "@/lib/scenario-meta";
import { useSettings } from "@/hooks/useSettings";
import { useLabRanges } from "@/hooks/useLabRanges";

interface UseScenarioMetaSyncProps {
  tasks: Task[];
  baseSensCm: number;
  centerSource: CenterSource;
  centerOverrides?: Record<string, number>;
}

/**
 * Envia ao Rust o centro e a categoria/subcategoria de cada cenário (`set_scenario_meta`).
 * Debounce de 500 ms e envio só quando o payload muda. Não recalcula o preditor empírico (REV-21).
 * Com `centerSource = "lab"` (Plano 06, experimental), os centros vêm das faixas do Laboratório.
 */
export function useScenarioMetaSync({
  tasks,
  baseSensCm,
  centerSource,
  centerOverrides,
}: UseScenarioMetaSyncProps) {
  const { settings } = useSettings();
  const { labCenters } = useLabRanges(tasks, settings, centerSource === "lab");

  const payloadKey = useMemo(
    () =>
      JSON.stringify(
        buildScenarioMeta(tasks, { baseSensCm, centerSource, centerOverrides, labCenters })
      ),
    [tasks, baseSensCm, centerSource, centerOverrides, labCenters]
  );
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    if (payloadKey === lastSentRef.current) return;

    const timeoutId = window.setTimeout(() => {
      if (payloadKey === lastSentRef.current) return;
      lastSentRef.current = payloadKey;
      setScenarioMeta(JSON.parse(payloadKey)).catch((err: unknown) => {
        lastSentRef.current = null;
        console.error("Falha ao sincronizar metadados de cenarios com o Rust:", err);
      });
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [payloadKey]);
}
