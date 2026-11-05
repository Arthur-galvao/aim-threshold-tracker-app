import type { AppData, AppDataSnapshot } from "./types.ts";

/**
 * Store somente-leitura do AppData no front (Plano 02). O Rust é o dono do dado: aqui só
 * guardamos o último snapshot recebido (`get_app_data` + evento `app_data_changed`) e
 * descartamos qualquer snapshot com `revision <= atual`. Nunca muta localmente.
 */

export type Unlisten = () => void;

/** O que o store precisa do backend (injetado: Tauri ou web-backend). */
export interface DataStoreBackend {
  getAppData(): Promise<AppDataSnapshot>;
  onAppDataChanged(callback: (snapshot: AppDataSnapshot) => void): Promise<Unlisten>;
}

export const EMPTY_APP_DATA: AppData = { activeTaskId: null, tasks: [], playlists: [] };
const INITIAL_SNAPSHOT: AppDataSnapshot = { revision: -1, data: EMPTY_APP_DATA };

interface Waiter {
  revision: number;
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
}

export class DataStore {
  private snapshot: AppDataSnapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private readonly waiters = new Set<Waiter>();
  private backend: DataStoreBackend | null = null;
  private unlisten: Unlisten | undefined;
  private initPromise: Promise<void> | null = null;
  /** Invalida inits/disposes em andamento (StrictMode monta, desmonta e remonta). */
  private generation = 0;

  /** Referência estável entre mudanças (exigência do useSyncExternalStore). */
  getSnapshot = (): AppDataSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  isLoaded(): boolean {
    return this.snapshot.revision >= 0;
  }

  /** Aplica o snapshot se for MAIS NOVO que o atual. Devolve se foi aplicado. */
  apply(incoming: AppDataSnapshot): boolean {
    if (incoming.revision <= this.snapshot.revision) return false;
    this.snapshot = incoming;
    for (const waiter of [...this.waiters]) {
      if (this.snapshot.revision >= waiter.revision) this.release(waiter);
    }
    for (const listener of [...this.listeners]) listener();
    return true;
  }

  /**
   * Registra o listener ANTES de buscar o estado inicial (assim nenhuma mudança entre as
   * duas chamadas se perde; a regra de revisão descarta o que for repetido). Idempotente.
   */
  init(backend: DataStoreBackend): Promise<void> {
    if (this.initPromise) return this.initPromise;
    const gen = ++this.generation;
    this.backend = backend;

    this.initPromise = (async () => {
      const unlisten = await backend.onAppDataChanged((snapshot) => {
        if (gen === this.generation) this.apply(snapshot);
      });
      if (gen !== this.generation) {
        unlisten(); // cancelado enquanto o listen() era registrado: não vaza
        return;
      }
      this.unlisten = unlisten;
      const initial = await backend.getAppData();
      if (gen === this.generation) this.apply(initial);
    })().catch((err) => {
      if (gen === this.generation) {
        this.unlisten?.();
        this.unlisten = undefined;
        this.initPromise = null;
      }
      throw err;
    });

    return this.initPromise;
  }

  /** Cancela o listener (e qualquer init em andamento). O snapshot atual é mantido. */
  dispose(): void {
    this.generation++;
    this.unlisten?.();
    this.unlisten = undefined;
    this.initPromise = null;
  }

  /**
   * Resolve quando o snapshot local alcançar `revision`. Comandos devolvem a revisão
   * antes do evento chegar; quem precisa ler o resultado da própria mutação espera aqui.
   * Se o evento não vier a tempo, busca `get_app_data` uma vez; resolve sempre.
   */
  waitForRevision(revision: number, timeoutMs = 2000): Promise<void> {
    if (this.snapshot.revision >= revision) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const waiter: Waiter = {
        revision,
        resolve,
        timer: setTimeout(() => {
          this.waiters.delete(waiter);
          const backend = this.backend;
          if (!backend) {
            resolve();
            return;
          }
          backend
            .getAppData()
            .then((snapshot) => this.apply(snapshot))
            .catch(() => undefined)
            .finally(resolve);
        }, timeoutMs),
      };
      this.waiters.add(waiter);
    });
  }

  private release(waiter: Waiter) {
    clearTimeout(waiter.timer);
    this.waiters.delete(waiter);
    waiter.resolve();
  }

  /** Só para testes. */
  reset(): void {
    this.dispose();
    this.snapshot = INITIAL_SNAPSHOT;
    this.backend = null;
    for (const waiter of [...this.waiters]) this.release(waiter);
  }
}

export const dataStore = new DataStore();
