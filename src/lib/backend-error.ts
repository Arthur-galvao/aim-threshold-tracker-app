import type { Key } from "./i18n.tsx";
import type { BackendErrorCode } from "./types.ts";

/** Erro de um comando do backend (Rust ou web). `code` é o código curto devolvido. */
export class BackendError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "BackendError";
    this.code = code;
  }
}

/** Normaliza o que `invoke` rejeita (string, Error ou objeto) em `BackendError`. */
export function toBackendError(err: unknown): BackendError {
  if (err instanceof BackendError) return err;
  if (typeof err === "string") return new BackendError(err);
  if (err && typeof err === "object" && "message" in err) {
    return new BackendError(String((err as { message: unknown }).message));
  }
  return new BackendError(String(err));
}

export function errorCode(err: unknown): BackendErrorCode | string {
  return toBackendError(err).code;
}

/** `t` do i18n, na forma que os componentes usam. */
export type TranslateFn = (key: Key, params?: Record<string, string | number>) => string;

/**
 * Texto de um erro do backend. O Rust manda `"<code>"` ou `"<code>|<detalhe>"` (ver
 * `src-tauri/src/errors.rs`): traduz `error.<code>` passando `{detail}`. Sem a chave,
 * mostra o código (e o detalhe) como vieram.
 */
export function formatBackendError(err: unknown, t: TranslateFn): string {
  const raw = toBackendError(err).code;
  const sep = raw.indexOf("|");
  const code = sep === -1 ? raw : raw.slice(0, sep);
  const detail = sep === -1 ? null : raw.slice(sep + 1);
  const key = `error.${code}` as Key;
  const text = t(key, detail === null ? undefined : { detail });
  if (text !== key) return text;
  return detail === null ? code : `${code}: ${detail}`;
}
