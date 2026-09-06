import { useCallback, useEffect, useState } from "react";
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
}

export interface RandomizerState {
  available: boolean;
  activeSensCm: number;
  activeMult: number;
  lastRunScenario: string | null;
  lastRunScore: number | null;
  lastUpdated: string | null;
  errorMessage: string | null;
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
};

const DEFAULT_STATE: RandomizerState = {
  available: false,
  activeSensCm: 40.0,
  activeMult: 1.0,
  lastRunScenario: null,
  lastRunScore: null,
  lastUpdated: null,
  errorMessage: null,
};

export function useSensRandomizer() {
  const [settings, setSettings] = useState<RandomizerSettings>(DEFAULT_SETTINGS);
  const [randomizerState, setRandomizerState] = useState<RandomizerState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const { showToast } = useApp();
  const { t } = useI18n();

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
    refreshState();

    let unlisten: (() => void) | undefined;
    listen<RandomizerState>("sens_updated", (event) => {
      setRandomizerState(event.payload);
      showToast(
        t("toast.sensUpdated", {
          sens: event.payload.activeSensCm.toFixed(2),
          mult: event.payload.activeMult.toFixed(2),
        }),
        "info"
      );
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [refreshState, showToast, t]);

  const saveSettings = useCallback(
    async (newSettings: RandomizerSettings) => {
      try {
        await invoke("save_randomizer_settings", { settings: newSettings });
        setSettings(newSettings);
        const updatedState = await invoke<RandomizerState>("check_rawaccel_available");
        setRandomizerState(updatedState);
        showToast(t("randomizer.saveSettings"), "success");
      } catch (err) {
        showToast(String(err), "error");
      }
    },
    [showToast, t]
  );

  const toggleEnabled = useCallback(async () => {
    const next = { ...settings, enabled: !settings.enabled };
    await saveSettings(next);
  }, [settings, saveSettings]);

  const triggerRandomize = useCallback(async () => {
    try {
      const newState = await invoke<RandomizerState>("trigger_randomize_now");
      setRandomizerState(newState);
      showToast(
        t("toast.sensUpdated", {
          sens: newState.activeSensCm.toFixed(2),
          mult: newState.activeMult.toFixed(2),
        }),
        "success"
      );
    } catch (err) {
      showToast(String(err), "error");
    }
  }, [showToast, t]);

  const detectPath = useCallback(async (): Promise<string | null> => {
    try {
      const path = await invoke<string | null>("detect_rawaccel_path");
      if (path) {
        const next = { ...settings, rawaccelDir: path };
        await saveSettings(next);
        showToast(t("toast.pathDetected", { path }), "success");
        return path;
      } else {
        showToast(t("randomizer.notReady"), "error");
        return null;
      }
    } catch (err) {
      showToast(String(err), "error");
      return null;
    }
  }, [settings, saveSettings, showToast, t]);

  const testWriter = useCallback(
    async (customPath?: string) => {
      setTesting(true);
      try {
        const res = await invoke<string>("test_rawaccel_writer", {
          path: customPath || settings.rawaccelDir || null,
        });
        showToast(t("toast.rawaccelTested"), "success");
        const updatedState = await invoke<RandomizerState>("check_rawaccel_available");
        setRandomizerState(updatedState);
        return res;
      } catch (err) {
        showToast(t("toast.rawaccelFailed", { error: String(err) }), "error");
        throw err;
      } finally {
        setTesting(false);
      }
    },
    [settings.rawaccelDir, showToast, t]
  );

  return {
    settings,
    randomizerState,
    rawaccelAvailable: randomizerState.available,
    loading,
    testing,
    saveSettings,
    toggleEnabled,
    triggerRandomize,
    detectPath,
    testWriter,
    refreshState,
  };
}
