import { useSettings } from "@/hooks/useSettings";

/** `true` quando o usuário ligou "Mostrar detalhes estatísticos" (modo avançado). Padrão: modo simples. */
export function useAdvancedStats(): boolean {
  const { settings } = useSettings();
  return settings?.training?.showAdvancedStats === true;
}
