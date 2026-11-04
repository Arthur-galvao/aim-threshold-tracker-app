# Plano 02 — Fonte única de dados no Rust (Onda 2) — [FORTE]

Objetivo: o Rust é o único dono do `AppData`. O front **nunca** envia o `AppData` inteiro; ele chama comandos de mutação e recebe snapshots versionados por evento. Elimina lost updates (REV-2, REV-8, REV-14, REV-16).

## Bugs que este plano fecha (confirmados no código)
1. **Watcher duplicado em produção:** `useKovaakWatcher()` é chamado em `App.tsx` **e** em `TrackerWorkspaceContext.tsx`. Cada chamada registra seu próprio `onNewRun` → toda run é processada 2×, 2 toasts, 2 notificações, 2 `saveData` concorrentes; `import_on_first_run` também roda 2× em paralelo.
2. `onNewRun` clona `appDataRef.current` (pode estar velho) e salva o blob inteiro; qualquer `updateAppData` concorrente sobrescreve.
3. `updateAppData` faz `saveAppData` **dentro** do updater do `setState` (roda 2× em StrictMode) e `await updateAppData` não espera nada → `importedCount` / `targetPlaylist` lidos antes de existirem (runner pode não iniciar para playlist recém-detectada).
4. Listeners `listen()` registrados após `await` vazam em StrictMode.
5. Trocar de cenário (`setActiveTaskId`) recalcula todas as tasks e regrava o JSON inteiro.

## Arquitetura alvo
```
Rust AppState.data: RwLock<AppData> + revision: AtomicU64
  ├─ comandos de mutação (abaixo) → aplicam, revision += 1, marcam dirty, emitem "app_data_changed"
  ├─ persister (thread): dirty → espera 400ms de silêncio → storage::atomic_write → limpa dirty
  │                      flush síncrono em RunEvent::Exit e antes de import/replace
  └─ watcher: em vez de emitir new_run cru, chama add_run_to_data() e emite "run_recorded"
Front: DataStore (useSyncExternalStore) assina "app_data_changed"; nunca muta localmente.
Derivados (threshold/skill, métricas) são calculados no front a partir do snapshot, memoizados por task (NÃO persistidos).
```

### Eventos
- `app_data_changed`: `{ revision: number, data: AppData }` (snapshot completo; ok para o tamanho atual — evita lógica de patch).
- `run_recorded`: `{ revision, taskId, sessionId, scenario, score, sensCm, isNewTask }` (para toast/notificação/runner).

### Comandos (todos retornam `{ revision: number }`)
| Comando | Payload |
|---|---|
| `get_app_data` | → `{ revision, data }` |
| `create_task` | `{ name, category, subcategory }` → também `{ taskId }` |
| `update_task_meta` | `{ taskId, name?, category?, subcategory? }` |
| `delete_task` | `{ taskId }` |
| `set_active_task` | `{ taskId \| null }` (**não** dispara persistência imediata pesada — vai no debounce normal) |
| `add_manual_sessions` | `{ taskId, date, sensCm, scores: number[] }` |
| `delete_session` | `{ taskId, sessionId }` |
| `upsert_playlist` | `{ playlist }` |
| `delete_playlist` | `{ playlistId }` |
| `sync_game_playlists` | `{}` → `{ revision, imported, total }` (lógica movida do TS para Rust, ver T2.5) |
| `replace_all_data` | `{ data, reason: "demo" \| "clear" \| "import" }` (faz backup `pre-<reason>-<ts>.json` antes) |

Regras: IDs gerados no Rust (`unique_id`). Validação no Rust (nome vazio → `Err("empty_name")`). Erros retornam **códigos**, não frases (front traduz).

---

## T2.1 [FORTE] Contrato
**Arquivos:** `src-tauri/src/model.rs`, `src/lib/types.ts`, `src/lib/tauri-bridge.ts` (assinaturas + stubs que chamam `invoke`), `src-tauri/src/lib.rs` (registrar comandos com corpo `todo!()` substituído em T2.2).
- Tipos TS espelhando payloads acima. `AppDataSnapshot = { revision: number; data: AppData }`.
- Remover do bridge: `saveAppData` (manter só até T2.4 terminar, marcado `@deprecated`).
- **Web fallback (sem Tauri)**: manter um `MemoryBackend` em `src/lib/web-backend.ts` que implementa os mesmos comandos sobre `localStorage` (para `INICIAR_WEB.bat`/dev no browser). Mesmo contrato.

## T2.2 [FORTE] Store + comandos no Rust
**Arquivos:** novo `src-tauri/src/data_store.rs`, `src-tauri/src/lib.rs` (handlers), `src-tauri/src/storage.rs` (persister).
- `AppState.data` vira `RwLock<AppData>`; `revision: AtomicU64`; `dirty: AtomicBool`; `persist_tx: mpsc::Sender<()>`.
- Helper único: `fn mutate<F: FnOnce(&mut AppData) -> Result<R,String>, R>(app, f) -> Result<(R,u64),String>` → lock write, aplica, `revision+1`, sinaliza persister, emite `app_data_changed`. **Todo** comando usa `mutate`.
- Persister: thread que recebe sinais, faz debounce 400ms, clona sob read-lock, solta lock, `atomic_write`. `flush_now()` público (usado no Exit, `replace_all_data`, `import_existing`).
- `RunEvent::Exit` → `flush_now()` antes de `restore_on_exit`.
- Remover o comando `save_app_data`.

**Testes Rust:** 1000 mutações concorrentes de 8 threads (`add_manual_sessions`) → contagem final exata, `revision == 1000`; persister grava uma vez por rajada (contar escritas com um writer mock).

## T2.3 [FORTE] Watcher e imports usam o store
**Arquivos:** `src-tauri/src/watcher.rs`, `src-tauri/src/aimlab.rs`.
- `process_new_csv` / `process_new_aimlab_replay`: em vez de `emit("new_run")`, chamar `data_store::add_run(app, &run, extra)` (dedupe por `source_file` dentro do lock) e emitir `run_recorded`.
- `import_existing` e `aimlab::process_runs`: aplicar todo o lote numa **única** chamada `mutate` (uma revision por import), depois `flush_now()`.
- `has_source_file` em loop → substituir por `HashSet<String>` construído uma vez dentro do lock (REV-9).

## T2.4 [FORTE] Front: DataStore read-only
**Arquivos:** `src/hooks/useAppData.tsx` (reescrita), novo `src/lib/data-store.ts`, `src/hooks/useKovaakWatcher.ts`, `src/context/TrackerWorkspaceContext.tsx`, `src/App.tsx`.
1. `data-store.ts`: singleton com `getSnapshot()`, `subscribe()`, `init()` (chama `get_app_data`, depois `listen("app_data_changed")`; ignora snapshot com `revision <= atual`).
2. `useAppData`: `const { revision, data } = useSyncExternalStore(...)`. Todas as funções (`createTask`, `deleteSession`, …) viram `await bridge.xxx(...)` + toast. **Sem** `setAppData`, **sem** `cloneAppData`, **sem** `recalculateAllTasks`.
3. `useKovaakWatcher`:
   - **Chamar uma única vez.** Criar `WatcherProvider` (ou mover para dentro do `AppProvider`) e expor via contexto; `TrackerWorkspaceContext` e `App.tsx` **consomem o contexto**, não chamam o hook.
   - Listener de `run_recorded` só faz: toast, notificação, `playlistRunner.syncWithDetectedScenario(scenario)`.
   - Padrão anti-vazamento obrigatório para todo `listen`:
```ts
useEffect(() => {
  let cancelled = false; let un: UnlistenFn | undefined;
  listen(...).then(fn => { if (cancelled) fn(); else un = fn; });
  return () => { cancelled = true; un?.(); };
}, []);
```
   Aplicar em `useAppData`, `useKovaakWatcher`, `useSensRandomizer` e qualquer outro `listen`.
4. Derivados: `useTaskDerived(taskId)` memoiza por `task` (referência muda só quando a task muda; garantir no Rust que o snapshot preserva igualdade estrutural não é possível → memoizar por `task.id + task.sessions.length + lastSessionId`).
5. `Session.threshold` deixa de ser escrito pelo front. Até o Plano 04, calcular o threshold legado on-the-fly em `useTaskDerived`.

**Aceite (manual, descrever no PR):** com watcher ativo, terminar 3 runs seguidas no KovaaK's enquanto troca de cenário na UI → 3 sessões no disco, 1 toast por run, nenhuma notificação duplicada.

## T2.5 [HAIKU] `sync_game_playlists` no Rust + não sobrescrever playlists do usuário
**Arquivos:** `src-tauri/src/data_store.rs` (função `sync_game_playlists`), `src-tauri/src/model.rs` (campo novo — coordenar com T2.1, já incluído no contrato), `src/hooks/useAppData.tsx` (só trocar a chamada).
- `Playlist.source: "user" | "kovaak" | "aimlab"` (default `"user"` via serde; playlists existentes cujo nome bate com playlist de jogo → `"kovaak"`/`"aimlab"` na primeira sync).
- Sync **só** atualiza playlists com `source != "user"`. Se o usuário editar uma playlist de jogo pelo editor, ela vira `source = "user"` (o editor chama `upsert_playlist` com `source: "user"`).
- Itens: comparar pela lista de nomes de cenário; se idêntica, não mexe; se mudou, reconstrói preservando `targetMode/targetValue` **por taskId** (não por índice).
- `handleDetectedPlaylist` (TS) passa a chamar `sync_game_playlists` e depois procura a playlist no snapshot **retornado** (não no ref).

**Testes Rust:** playlist `source:"user"` com mesmo nome de playlist do jogo → intocada após sync; playlist de jogo reordenada → targets preservados por taskId.

## T2.6 [HAIKU] Integração Onda 2
**Arquivos:** `src/lib/i18n.tsx`, pendentes; remover `saveAppData` deprecated do bridge; remover `cloneAppData` se sem uso.
