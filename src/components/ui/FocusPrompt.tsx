import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { setSessionFocus } from "@/lib/tauri-bridge";

/** Tempo até o toast sumir sem resposta (o foco fica null e nada é chamado). */
export const FOCUS_PROMPT_TIMEOUT_MS = 8000;

export interface FocusPromptRequest {
  /** Identidade do pedido: muda a cada `requestFocusPrompt`, reinicia o timer. */
  id: number;
  taskId: string;
  sessionId: string;
  scenario: string;
}

// Store mínimo (sem contexto) para o watcher disparar o prompt sem depender da árvore de componentes.
let current: FocusPromptRequest | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return current;
}

/** Mostra o prompt de foco para uma run. Um novo pedido substitui o anterior. */
export function requestFocusPrompt(req: Omit<FocusPromptRequest, "id">): void {
  seq += 1;
  current = { ...req, id: seq };
  emit();
}

/** Remove o prompt (só se `id` ainda for o atual, quando informado). */
export function clearFocusPrompt(id?: number): void {
  if (!current) return;
  if (id !== undefined && current.id !== id) return;
  current = null;
  emit();
}

/**
 * Monta o prompt ativo (ou nada). Precisa estar montado uma vez na árvore (ex. no App),
 * dentro do I18nProvider.
 */
export function FocusPromptHost() {
  const request = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!request) return null;
  return <FocusPrompt key={request.id} request={request} />;
}

export function FocusPrompt({ request }: { request: FocusPromptRequest }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => clearFocusPrompt(request.id), FOCUS_PROMPT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [request.id]);

  const answer = async (focus: "on" | "auto") => {
    if (busy) return;
    setBusy(true);
    try {
      await setSessionFocus(request.taskId, request.sessionId, focus);
    } catch (err) {
      console.error("Falha ao registrar foco:", err);
    }
    clearFocusPrompt(request.id);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "glass-float pointer-events-auto fixed bottom-4 right-4 z-50 w-full max-w-sm",
        "flex flex-col gap-2 px-3.5 py-2.5 rounded-control shadow-float animate-pop-in border border-glass-edge text-xs text-text-main"
      )}
    >
      <div className="min-w-0">
        <p className="font-medium">{t("focus.prompt.title")}</p>
        <p className="truncate text-text-faint">{t("focus.prompt.desc", { scenario: request.scenario })}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void answer("on")}
          className="flex-1 cursor-pointer press rounded-control border border-emerald-edge px-2.5 py-1.5 text-emerald hover:bg-white/5 disabled:opacity-50"
        >
          {t("focus.prompt.on")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void answer("auto")}
          className="flex-1 cursor-pointer press rounded-control border border-glass-edge px-2.5 py-1.5 text-text-main hover:bg-white/5 disabled:opacity-50"
        >
          {t("focus.prompt.auto")}
        </button>
      </div>
    </div>
  );
}
