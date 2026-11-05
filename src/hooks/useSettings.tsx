import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { listen } from "@tauri-apps/api/event";
import type { AppSettings } from "@/lib/types";
import { getSettings, saveSettings } from "@/lib/tauri-bridge";

const REFOCUS_RELOAD_MS = 30_000;

export interface SettingsContextValue {
  /** null até o primeiro carregamento terminar. */
  settings: AppSettings | null;
  /** Mescla `partial` no estado atual, salva e atualiza o contexto. */
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  /** Recarrega do backend (usado no foco da janela e ao receber `settings_updated`). */
  reloadSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Fonte única dos AppSettings no front. Carrega `get_settings` uma vez, recarrega no foco
 * da janela (no máximo a cada 30 s: outra janela ou o tray podem ter mudado algo) e expõe
 * `updateSettings`, que faz o merge a partir do estado em memória (sem novo getSettings).
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Ref espelha o estado para o merge ser síncrono entre chamadas seguidas.
  const currentRef = useRef<AppSettings | null>(null);
  const loadedRef = useRef<Promise<void> | null>(null);
  const lastLoadRef = useRef(0);
  const mountedRef = useRef(true);

  const applyLoaded = useCallback((next: AppSettings) => {
    currentRef.current = next;
    if (mountedRef.current) setSettings(next);
  }, []);

  const reloadSettings = useCallback(async () => {
    try {
      const next = await getSettings();
      lastLoadRef.current = Date.now();
      applyLoaded(next);
    } catch (err) {
      console.error("Erro ao carregar ajustes:", err);
    }
  }, [applyLoaded]);

  // Primeiro carregamento (uma vez). Filhos com efeito de montagem rodam antes deste
  // efeito, então `updateSettings` também dispara o carregamento se ainda não houve.
  const ensureLoaded = useCallback(() => {
    if (!loadedRef.current) loadedRef.current = reloadSettings();
    return loadedRef.current;
  }, [reloadSettings]);

  useEffect(() => {
    mountedRef.current = true;
    void ensureLoaded();
    return () => {
      mountedRef.current = false;
    };
  }, [ensureLoaded]);

  // Recarrega no foco, no máximo a cada 30 s.
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastLoadRef.current < REFOCUS_RELOAD_MS) return;
      void reloadSettings();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reloadSettings]);

  // Evento emitido pelo Rust em save_settings (quando existir); inofensivo se nunca disparar.
  useEffect(() => {
    let cancelled = false;
    let un: (() => void) | undefined;
    listen<AppSettings>("settings_updated", (event) => {
      if (event.payload) applyLoaded(event.payload);
    })
      .then((fn) => {
        if (cancelled) fn();
        else un = fn;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      un?.();
    };
  }, [applyLoaded]);

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      await ensureLoaded();
      const base = currentRef.current;
      // Sem ajustes carregados, salvar só o parcial sobrescreveria o arquivo inteiro.
      if (!base) throw new Error("Settings not loaded yet; refusing to overwrite the settings file.");
      const merged: AppSettings = { ...base, ...partial };
      await saveSettings(merged);
      lastLoadRef.current = Date.now();
      applyLoaded(merged);
    },
    [applyLoaded, ensureLoaded]
  );

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, updateSettings, reloadSettings }),
    [settings, updateSettings, reloadSettings]
  );

  return createElement(SettingsContext.Provider, { value }, children);
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
