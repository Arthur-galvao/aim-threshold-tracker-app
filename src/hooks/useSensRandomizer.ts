import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useApp } from "@/hooks/useAppData";
import { useI18n } from "@/lib/i18n";

export interface RandomizerSettings {
  enabled: boolean;
  baseSensCm: number;
  rangeMode: "cm360" | "multiplier";
  minCm: number;
  maxCm: number;
  minMult: number;
  maxMult: number;
  avoidRepeats: boolean;
  rawaccelDir: string | null;
  spreadPercent: number;
  autoScenarioSens: boolean;
  scenarioIdealCm?: number;
  mouseDpi: number;
  centerOverrides?: Record<string, number>;
  predictorProfile?: string;
}

export interface RandomizerState {
  available: boolean;
  activeSensCm: number;
  activeMult: number;
  lastRunScenario: string | null;
  lastRunScore: number | null;
  lastUpdated: string | null;
  errorMessage: string | null;
  rawaccelGuiRunning?: boolean;
  lastRollReason?: string | null;
}

const DEFAULT_SETTINGS: RandomizerSettings = {
  enabled: false,
  baseSensCm: 40.0,
  rangeMode: "cm360",
  minCm: 28.0,
  maxCm: 55.0,
  minMult: 0.75,
  maxMult: 1.35,
  avoidRepeats: true,
  rawaccelDir: null,
  spreadPercent: 25.0,
  autoScenarioSens: true,
  scenarioIdealCm: undefined,
  mouseDpi: 800,
  predictorProfile: "equilibrado",
};

const DEFAULT_STATE: RandomizerState = {
  available: false,
  activeSensCm: 40.0,
  activeMult: 1.0,
  lastRunScenario: null,
  lastRunScore: null,
  lastUpdated: null,
  errorMessage: null,
  rawaccelGuiRunning: false,
  lastRollReason: null,
};

export interface RandomizerContextValue {
  settings: RandomizerSettings;
  randomizerState: RandomizerState;
  rawaccelAvailable: boolean;
  loading: boolean;
  testing: boolean;
  saveSettings: (newSettings: RandomizerSettings, silent?: boolean) => Promise<void>;
  toggleEnabled: () => Promise<void>;
  triggerRandomize: () => Promise<void>;
  syncScenarioSens: (targetSens: number, reRollNow?: boolean, idealSource?: "empirical" | "viscose") => Promise<void>;
  detectPath: () => Promise<string | null>;
  testWriter: (customPath?: string) => Promise<string>;
  refreshState: () => Promise<void>;
}

const RandomizerContext = createContext<RandomizerContextValue | null>(null);

export function RandomizerProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<RandomizerSettings>(DEFAULT_SETTINGS);
  const [randomizerState, setRandomizerState] = useState<RandomizerState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const { showToast } = useApp();
  const { t } = useI18n();

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const tRef = useRef(t);
  tRef.current = t;

  const lastErrorToastRef = useRef<{ msg: string; time: number }>({ msg: "", time: 0 });

  const refreshState = useCallback(async () => {
    try {
      const [fetchedSettings, fetchedState] = await Promise.all([
        invoke<RandomizerSettings>("get_randomizer_settings"),
        invoke<RandomizerState>("check_rawaccel_available"),
      ]);
      setSettings(fetchedSettings);
      setRandomizerState(fetchedState);
    } catch (err) {
      console.error("Erro ao carregar estado do randomizer:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshState();

    let cancelled = false;
    const unlistens: Array<() => void> = [];

    const sub = async <T,>(name: string, cb: (p: T) => void) => {
      const un = await listen<T>(name, (e) => cb(e.payload));
      if (cancelled) {
        un();
      } else {
        unlistens.push(un);
      }
    };

    void sub<RandomizerState>("sens_updated", (payload) => {
      setRandomizerState(payload);
      if (!payload.available) return;

      if (payload.lastRollReason === "restore") {
        showToastRef.current(tRef.current("toast.sensRestored"), "info");
      } else if (
        payload.lastRollReason === "manual" ||
        payload.lastRollReason === "toggle" ||
        payload.lastRollReason === "reroll"
      ) {
        showToastRef.current(
          tRef.current("toast.sensUpdated", {
            sens: payload.activeSensCm.toFixed(2),
            mult: payload.activeMult.toFixed(2),
          }),
          "info"
        );
      }
    });

    void sub<RandomizerState>("randomizer_state_patched", (payload) => {
      setRandomizerState(payload);
    });

    void sub<{ message: string }>("randomizer_error", (payload) => {
      const now = Date.now();
      if (lastErrorToastRef.current.msg === payload.message && now - lastErrorToastRef.current.time < 10000) {
        return;
      }
      lastErrorToastRef.current = { msg: payload.message, time: now };
      showToastRef.current(tRef.current("toast.randomizerError", { error: payload.message }), "error");
    });

    void sub<RandomizerSettings>("randomizer_settings_updated", (payload) => {
      setSettings(payload);
    });

    void sub<{ file: string; error: string }>("run_import_failed", (payload) => {
      showToastRef.current(tRef.current("toast.runImportFailed", { file: payload.file }), "error");
    });

    return () => {
      cancelled = true;
      unlistens.forEach((u) => u());
    };
  }, [refreshState]);

  const saveSettings = useCallback(
    async (newSettings: RandomizerSettings, silent = false) => {
      try {
        const updatedState = await invoke<RandomizerState>("save_randomizer_settings", { settings: newSettings });
        setSettings(newSettings);
        setRandomizerState(updatedState);
        if (!silent) {
          showToastRef.current(tRef.current("randomizer.saveSettings"), "success");
        }
      } catch (err) {
        showToastRef.current(String(err), "error");
      }
    },
    []
  );

  const toggleEnabled = useCallback(async () => {
    const next = { ...settings, enabled: !settings.enabled };
    await saveSettings(next);
  }, [settings, saveSettings]);

  const triggerRandomize = useCallback(async () => {
    try {
      const newState = await invoke<RandomizerState>("trigger_randomize_now");
      setRandomizerState(newState);
      showToastRef.current(
        tRef.current("toast.sensUpdated", {
          sens: newState.activeSensCm.toFixed(2),
          mult: newState.activeMult.toFixed(2),
        }),
        "success"
      );
    } catch (err) {
      showToastRef.current(String(err), "error");
    }
  }, []);

  const syncScenarioSens = useCallback(
    async (targetSens: number, reRollNow = false, idealSource?: "empirical" | "viscose") => {
      const rounded = Number(targetSens.toFixed(1));
      if (settings.scenarioIdealCm === rounded && !reRollNow) return;

      const nextSettings: RandomizerSettings = {
        ...settings,
        scenarioIdealCm: rounded,
      };
      await saveSettings(nextSettings, true);
      const sourceLabel = idealSource === "empirical"
        ? tRef.current("randomizer.idealSensSourceEmpirical")
        : tRef.current("randomizer.idealSensSourceViscose");
      showToastRef.current(`${tRef.current("randomizer.idealSensToast")}: ${rounded} cm (${sourceLabel})`, "info");
      if (reRollNow && settings.enabled && randomizerState.available) {
        await triggerRandomize();
      }
    },
    [settings, saveSettings, triggerRandomize, randomizerState.available]
  );

  const detectPath = useCallback(async (): Promise<string | null> => {
    try {
      const path = await invoke<string | null>("detect_rawaccel_path");
      if (path) {
        const next = { ...settings, rawaccelDir: path };
        await saveSettings(next);
        showToastRef.current(tRef.current("toast.pathDetected", { path }), "success");
        return path;
      } else {
        showToastRef.current(tRef.current("randomizer.notReady"), "error");
        return null;
      }
    } catch (err) {
      showToastRef.current(String(err), "error");
      return null;
    }
  }, [settings, saveSettings]);

  const testWriter = useCallback(
    async (customPath?: string) => {
      setTesting(true);
      try {
        const res = await invoke<string>("test_rawaccel_writer", {
          path: customPath || settings.rawaccelDir || null,
        });
        showToastRef.current(tRef.current("toast.rawaccelTested"), "success");
        const updatedState = await invoke<RandomizerState>("check_rawaccel_available");
        setRandomizerState(updatedState);
        return res;
      } catch (err) {
        showToastRef.current(tRef.current("toast.rawaccelFailed", { error: String(err) }), "error");
        throw err;
      } finally {
        setTesting(false);
      }
    },
    [settings.rawaccelDir]
  );

  const value = useMemo<RandomizerContextValue>(() => ({
    settings,
    randomizerState,
    rawaccelAvailable: randomizerState.available,
    loading,
    testing,
    saveSettings,
    toggleEnabled,
    triggerRandomize,
    syncScenarioSens,
    detectPath,
    testWriter,
    refreshState,
  }), [
    settings,
    randomizerState,
    loading,
    testing,
    saveSettings,
    toggleEnabled,
    triggerRandomize,
    syncScenarioSens,
    detectPath,
    testWriter,
    refreshState,
  ]);

  return React.createElement(RandomizerContext.Provider, { value }, children);
}

export function useSensRandomizer(): RandomizerContextValue {
  const ctx = useContext(RandomizerContext);
  if (!ctx) {
    throw new Error("useSensRandomizer must be used within a RandomizerProvider");
  }
  return ctx;
}
