import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { setTrayLabels } from "@/lib/tauri-bridge";

/** Mantém os rótulos do menu da bandeja no idioma atual (Plano 08, T8.6). */
export function useTrayLabels(): void {
  const { lang, t } = useI18n();

  useEffect(() => {
    setTrayLabels(t("tray.open"), t("tray.quit")).catch((err) => {
      console.warn("Falha ao atualizar rótulos da bandeja:", err);
    });
    // `t` muda junto com `lang`; a dependência de `lang` basta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
}
