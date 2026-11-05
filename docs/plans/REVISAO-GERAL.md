# Revisão geral — Aim Threshold Tracker (2026-11-04)

Escopo: todo o Rust (`src-tauri/src`), hooks/lib/componentes React, configs de build/CI.
Estado atual verificado: `tsc -b` limpo, `npm test` 192/192 passando. O que está abaixo **não** é pego pelos testes.

Prioridade: **P0** = risco de perder/corromper dado do usuário · **P1** = bug real ou custo de performance perceptível · **P2** = limpeza/dívida · **P3** = feature com bom retorno.

---

## P0 — Integridade de dados

### 1. Escrita não-atômica + fallback silencioso para dados vazios
- `storage.rs::write_json` usa `fs::write` direto. Crash/queda de energia no meio da escrita = `app_data.json` truncado.
- `load_app_data` faz `.unwrap_or_default()`: JSON inválido vira `AppData` vazio **sem aviso**, e o primeiro `save_app_data` do front sobrescreve o arquivo corrompido com vazio. Perda total, irreversível.
- Mesmo problema em `load_settings` (perde caminho do KovaaK's, config do randomizer etc.).
- **Fix:** reusar `randomizer::atomic_write` (tmp + rename) em `write_json`. No load, se o parse falhar: renomear para `app_data.corrupt-<timestamp>.json`, emitir evento pro front e **não** salvar por cima. Manter backups rotativos (`app_data.bak.1..5`) a cada boot.

### 2. Duas fontes da verdade (Rust `state.data` × React state) → lost updates
- Run ao vivo: backend emite `new_run`, o **front** clona `appDataRef.current`, adiciona a sessão e manda o `AppData` inteiro de volta (`useKovaakWatcher.onNewRun` → `saveData`).
- Imports (CSV, Aim Lab SQLite/CSV) fazem o contrário: mutam `state.data` no Rust e salvam.
- Qualquer `updateAppData` do front entre esses momentos manda um snapshot velho e sobrescreve o backend. Cenário concreto: `new_run` → `kovaak_playlist_active` chega logo depois → `syncWithDetectedScenario` → `setActiveTaskId` → `updateAppData(prev)` com `prev` ainda sem a run (o `setAppData` do `saveData` só roda depois do `await` do IPC) → disco recebe dado sem a run; a ordem final depende de qual invoke termina por último.
- **Fix (certo):** backend é dono do dado. Watcher chama `add_session_to_data` (já existe) e emite `data_changed` com o delta/revisão; front só renderiza. Mutações do front viram comandos granulares (`add_sessions`, `delete_session`, `upsert_playlist`, `set_active_task`...).
- **Fix mínimo (se não quiser refatorar agora):** campo `revision: u64` no `AppData`; `save_app_data` rejeita se `revision` ≠ atual; front recarrega e reaplica.
- Dado que `rusqlite` (bundled) já está compilado por causa do Aim Lab, vale considerar migrar sessões para SQLite: resolve atomicidade, concorrência e escrita incremental de uma vez.

### 3. Runs jogadas com o app fechado nunca são importadas
- `import_existing` só roda se `import_on_first_run` (uma vez na vida) ou manual. `start_watcher` não faz catch-up.
- **Fix:** ao iniciar o watcher, importar CSVs não vistos (ver item 9 pro custo). Cheap e elimina o "cadê minhas runs?".

### 4. O app reescreve os CSVs de stats do KovaaK's
- `watcher::update_kovaak_csv_sensitivity` faz read-modify-write (não atômico, normaliza line endings) no arquivo do jogo ~300ms após o `Create`, possivelmente enquanto o KovaaK's ainda escreve. Destrói a sens original e afeta qualquer outra ferramenta que lê esses arquivos.
- O front já recebe `run.sens = active_sens` — a reescrita só serve pra reimport futuro.
- **Fix:** ledger próprio `sens_ledger.json` (`source_file → cm`) no app_data_dir; `import_existing`/migração consultam o ledger. Nunca tocar em arquivo do jogo.

### 5. Settings resetam inteiros se um campo do randomizer faltar
- `AppSettings` tem `#[serde(default)]` no struct, mas `RandomizerSettings` não (só alguns campos). Se o objeto `randomizer` existir e faltar `range_mode`/`min_cm`/etc. (versão nova adicionando campo obrigatório), o parse do `AppSettings` inteiro falha → `unwrap_or_default` → tudo zera.
- **Fix:** `#[serde(default)]` no struct `RandomizerSettings` (o `Default` já existe).

### 6. Migrações heurísticas rodando a cada boot
- `migrate_existing_sensitivities`: toda sessão com `sens < 2.5` é convertida assumindo **Valorant** (yaw 0.07). Sens de CS2/Apex nessa faixa vira cm errado (fator ~3x), silenciosamente, em todo boot.
- Mesmo padrão em `migrate_existing_aimlab_tasks` e `migrateAndCategorizeTasks` (TS).
- **Fix:** `schemaVersion` no `AppData`; migrações numeradas rodam uma vez. Remover a conversão "assume Valorant" ou exigir confirmação.

### 7. Sem single-instance
- Duas instâncias = dois watchers rolando o RawAccel e dois processos escrevendo `app_data.json`. Fácil acontecer com close-to-tray (usuário abre de novo pelo atalho).
- **Fix:** `tauri-plugin-single-instance`, focando a janela existente.

---

## P1 — Bugs e performance

### 8. `updateAppData` com efeito colateral dentro do updater
- `void saveAppData(next)` dentro de `setAppData(prev => ...)`. Em StrictMode (dev) o updater roda 2x → 2 saves. E o `await updateAppData(...)` não espera nada (setState não retorna promise).
- Consequência real: `syncGamePlaylists` lê `importedCount` e `handleDetectedPlaylist` lê `targetPlaylist`, ambos atribuídos **dentro** do updater, logo após o `await`. Só funciona quando o React calcula o estado de forma eager; com update pendente, `targetPlaylist` fica `null` → **playlist recém-detectada não inicia o runner** e o toast de import fica errado.
- **Fix:** calcular `next` a partir de um ref (`appDataRef.current`), depois `setAppData(next)` + `await saveAppData(next)` fora do updater. (Some sozinho se fizer o item 2.)

### 9. `import_existing` é O(CSVs × sessões)
- `has_source_file` varre todas as sessões de todas as tasks pra cada CSV. Com 10k CSVs e 10k sessões = 100M comparações de string. Mesma coisa em `aimlab::process_runs`.
- **Fix:** montar `HashSet<&str>` dos `source_file` uma vez antes do loop.

### 10. Hot path do sorteio chama `tasklist`, varre pastas e lê o registro
- `apply_next_sens` (segurando `roll_lock`) chama `check_rawaccel_availability` → spawn de `tasklist` (100–400ms no Windows) + `read_dir` de Downloads/Desktop + registro. Isso a cada fim de run, a cada `set_upcoming_scenario` com reroll, a cada `save_settings`.
- **Fix:** cachear o diretório resolvido e o status do driver no `AppState` (invalidar quando o usuário mudar o path / clicar "testar"). Checar GUI do RawAccel só ao abrir Settings/aba do randomizer.

### 11. `set_upcoming_scenario` dispara a cada mudança de `tasks`
- O effect em `App.tsx` depende de `predictNextScenarioName`, que depende de `taskMap` → qualquer edição de dados (inclusive renomear task) dispara IPC com `reroll: true` + item 10. Pode gerar reroll extra além do esperado.
- **Fix:** derivar o nome previsto num `useMemo` e só chamar o IPC quando o **nome** mudar.

### 12. `build_aimlab_scenario_map` a cada replay do Aim Lab
- `process_new_aimlab_replay` reconstrói o mapa varrendo workshop/academy/levels/XMLs inteiros a cada run.
- **Fix:** cachear no `AppState`, rebuild lazy se o nome não for encontrado.

### 13. Latência desnecessária até a run aparecer
- `wait_for_parse` dorme 1000ms **antes** da primeira tentativa (+ loop da reescrita do CSV de 300ms×n). Run aparece 1.3s–6s depois.
- **Fix:** backoff 100/200/400/800ms. Com o item 4 resolvido, o loop de reescrita some.

### 14. Toda ação salva e recalcula tudo
- `setActiveTaskId` (trocar de cenário!) → `recalculateAllTasks` (todas as tasks) → serializa `AppData` inteiro → IPC → `to_string_pretty` → disco.
- **Fix:** `activeTaskId` sai do arquivo de dados (vai pro estado de UI/settings); recalcular só a task alterada; debounce de 300–500ms nos saves; `to_string` em vez de `to_string_pretty`.

### 15. `syncGamePlaylists` sobrescreve playlists editadas pelo usuário a cada boot
- Playlist com o mesmo nome de uma do jogo tem `items` reconstruídos pela lista do jogo (mantém target só por índice). Reordenou/adicionou/removeu item? Perde no próximo boot.
- **Fix:** campo `source: "kovaak" | "aimlab" | "user"` no `Playlist`; sync só mexe nas de origem de jogo, e só se a lista do jogo mudou. Ou importar apenas playlists novas.

### 16. Listeners do Tauri vazando em StrictMode
- `useKovaakWatcher`: `setup()` é async e a cleanup roda antes do `await listen(...)` resolver → `unlistenRun` ainda `undefined` → listener duplicado em dev → sessão duplicada. `addSessionsFromRun` não deduplica por `sourceFile`.
- **Fix:** flag `cancelled` no effect (se cancelado após o `await`, chamar o unlisten imediatamente) + dedupe por `sourceFile` em `addSessionsFromRun`.

### 17. Saco do sorteio (sem reposição) não persiste
- `SamplerState.bags` vive só em memória → reiniciar o app reinicia o ciclo. A garantia de "cobrir todos os pontos da grade" que você escolheu só vale dentro de uma sessão do app.
- **Fix:** serializar `bags` + `last_k` em `sampler_state.json` (atômico).

### 18. `vite.config.ts` usa nomes de env do Tauri 1
- `TAURI_PLATFORM` / `TAURI_DEBUG` não existem no Tauri 2 (são `TAURI_ENV_PLATFORM` / `TAURI_ENV_DEBUG`). Resultado: target sempre `safari13` (transpila pra sintaxe antiga, bundle maior) e sourcemap nunca liga no debug.
- **Fix:** `target: "chrome120"` fixo (WebView2 é Chromium evergreen) e `TAURI_ENV_DEBUG`.

### 19. Segurança
- `csp: null` em `tauri.conf.json`. Definir CSP restritiva (`default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'`).
- `open_url` faz `cmd /c start "" <url>`: `&`, `|`, `^` na URL são interpretados pelo cmd → injeção de comando. Trocar por `tauri-plugin-opener` com allowlist de domínios.
- `import_json_backup` não chama `sanitize_app_data` nem valida nada além do parse.

### 20. Baseline do Output DPI
- `apply_scale_to_rawaccel_json` usa `mouse_dpi * mult` como Output DPI, ignorando `backup.output_dpi`. Se o usuário tinha Output DPI ≠ DPI do mouse no RawAccel (usado como multiplicador), a sens base muda ao ativar o randomizer. Foi intencional no commit `0b1bf60`, mas falta um aviso: se `backup.output_dpi != mouse_dpi`, mostrar alerta na aba do randomizer.

### 21. Preditor recalculado inteiro a cada mudança
- `useScenarioCentersSync` roda `getScenarioIdealSens` para **todas** as tasks a cada mudança de `tasks`; cada task com dado local insuficiente faz `buildRunPoints` da categoria inteira → O(tasks × runs da categoria), na main thread.
- **Fix:** cache por categoria (calcular o pool uma vez por categoria por ciclo) e/ou Web Worker. Recalcular só categorias afetadas pela task alterada.

---

## P2 — Limpeza e dívida

22. **Código morto:** `useTheme`/`cycleTheme`/tipos `Theme`/`ResolvedTheme` em `lib/theme.ts` (tema claro foi removido); script de tema claro/escuro no `index.html`; `src/utils/threshold.ts` e `src/utils/viscose.ts` (shims sem uso); `plan_roll` (só usado no próprio teste); `parse_stats_file` (`#[allow(dead_code)]`); dependência duplicada `@base-ui-components/react` (alias pro mesmo pacote, sem import).
23. **Lixo na raiz:** PNGs de screenshot, `debug_cards.js`, `find_duplicates.cjs`, `screenshot_tool.js`, `test-capture.mjs`, `test_output.css`, `tsconfig.tsbuildinfo`, `refactor_gemini_4/`, HANDOFF/planos antigos. Estão no `.gitignore`, mas poluem o contexto de qualquer agente que leia a pasta. Mover pra `scripts/` e `docs/archive/` ou apagar.
24. **DPI duplicado:** `AppSettings.mouse_dpi` e `RandomizerSettings.mouse_dpi` com sincronização manual em 2 comandos. Uma fonte só.
25. **Convenção de serde mista:** `AppSettings` em snake_case, o resto em camelCase. Padronizar (com `alias` pra compatibilidade de leitura).
26. **i18n vazando:** notificações hardcoded em PT ("Nova Run Registrada", "Etapa avançada", "Playlist concluída!", "Playlist detectada"), menu do tray, títulos dos dialogs em `tauri-bridge.ts`, descrições dos temas em `theme.ts`, `aria-label`s, placeholder do ScenarioSwitcher, erros do Rust (todos PT, exibidos em toast). **Fix:** Rust retorna código de erro (`{ code, params }`), front traduz.
27. **`getSettings()` via IPC** a cada foco da janela, a cada avanço de etapa e a cada detecção de playlist → `SettingsContext` único com evento `settings_updated`.
28. **IDs:** `Date.now() + Math.random()` espalhado em 6+ lugares → `crypto.randomUUID()`.
29. **Export:** `data:` URI + `<a download>` com JSON inteiro em `encodeURIComponent`. Usar `save()` do plugin-dialog + comando Rust que escreve o arquivo (o usuário escolhe onde).
30. **CI:** só existe `release.yml`, com Node 20 — e os testes (`node --test *.ts`) exigem Node ≥ 22.18 (type stripping). Criar `ci.yml` em PR/push: `tsc -b`, `npm test`, `cargo test`, `cargo clippy -- -D warnings`. Trocar a lista manual do script `test` por `node --test test/`.
31. **Bundle:** 1.14 MB em um chunk só. `React.lazy` por view (Randomizer + chart.js são os pesados).
32. **Backdrop:** o canvas roda a `requestAnimationFrame` na taxa do monitor (240/360 Hz em setup de FPS) enquanto a janela está focada, somado a várias camadas de `backdrop-filter`. Já pausa em background (bom). Limitar a 30 fps e desligar o canvas no nível "sutil" de animação.

---

## P3 — Features com bom retorno

33. **Guardar datetime completo, FOV e stats extras por sessão.** Hoje `Session.date` é só `YYYY-MM-DD` e o resto do CSV (accuracy, TTK, kills, FOV) é descartado. Com horário dá pra ter curva de aquecimento (primeiras runs do dia), detecção de fadiga e ordem real dentro do dia. O dado já está no CSV — é só parar de jogar fora. `buildEscalateFormat` hoje chumba `103` de FOV.
34. **Threshold que só sobe.** `computeDayThreshold` faz `max(prev, ...)`: um dia de outlier trava a meta acima do alcançável pra sempre. E com o randomizer ativo, runs em sens longe do centro derrubam o hit rate sem refletir habilidade. Sugestões: (a) score ajustado pela sens usando o `sens-model` que já existe, (b) decay leve ou estimador robusto (ex.: percentil das últimas N runs), (c) trocar o `0.93` fixo por um fator derivado da variância do cenário (cenários com CV alto precisam de margem maior).
35. **Auto-update** com `tauri-plugin-updater` apontando pros releases do GitHub (o workflow já publica; falta o `latest.json` assinado).
36. **Catch-up import** (item 3) exibido como "N runs importadas desde a última sessão" no boot.

---

## Ordem sugerida de execução
1. Itens 1, 5, 7, 19 (pequenos, alto risco evitado) — 1 PR.
2. Item 2 (+ 8, 14, 16 caem junto) — refactor de fonte da verdade. Maior PR do plano; decidir antes se vai pra SQLite.
3. Itens 3, 4, 9, 13 — pipeline de import/watcher.
4. Itens 10, 11, 12, 17, 21 — performance do randomizer/preditor.
5. Item 6 + `schemaVersion` (depende do 2).
6. P2 em lote, depois P3.
