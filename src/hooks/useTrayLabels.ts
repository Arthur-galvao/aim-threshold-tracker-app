import { useEffect } from "react";
import { useI18n, type Key } from "@/lib/i18n";
import { setTrayLabels } from "@/lib/tauri-bridge";

// Chaves ainda não mescladas em i18n.tsx (ver docs/plans/i18n-pending/T8.8.json).
// `t` devolve a própria chave quando ela não existe; nesse caso usamos o fallback.
const pending = (key: string, fallback: string, t: (k: Key) => string): string => {
  const value = t(key as string as Key);
  return value === key ? fallback : value;
};

/** Mantém os rótulos do menu da bandeja no idioma atual (Plano 08, T8.6). */
export function useTrayLabels(): void {
  const { lang, t } = useI18n();

  useEffect(() => {
    const open = pending("tray.open", lang === "pt" ? "Abrir Aim Threshold Tracker" : "Open Aim Threshold Tracker", t);
    const quit = pending("tray.quit", lang === "pt" ? "Sair" : "Quit", t);
    let warned = false;
    setTrayLabels(open, quit).catch((err) => {
      if (!warned) {
        warned = true;
        console.warn("Falha ao atualizar rótulos da bandeja:", err);
      }
    });
    // `t` muda junto com `lang`; a dependência de `lang` basta.
  }, [lang]);
}
