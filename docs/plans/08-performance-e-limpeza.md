# Plano 08 — Performance, i18n e limpeza

Dividido em 3 lotes que rodam em paralelo com outras ondas sem conflito de arquivos.

---

## Lote 08-A (Onda 1) — arquivos isolados

### T8.1 [HAIKU] Build do Vite (Tauri 2)
**Arquivos:** `vite.config.ts`.
- `TAURI_PLATFORM`/`TAURI_DEBUG` não existem no Tauri 2. Usar `target: "chrome120"` fixo (WebView2 = Chromium evergreen), `minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild"`, `sourcemap: !!process.env.TAURI_ENV_DEBUG`.
- `envPrefix: ["VITE_", "TAURI_ENV_"]`.
- `build.rollupOptions.output.manualChunks: { chart: ["chart.js", "react-chartjs-2"], motion: ["motion"] }`.

### T8.2 [HAIKU] CI
**Arquivos:** novo `.github/workflows/ci.yml`, `package.json` (script `test`), `.github/workflows/release.yml` (só `node-version`).
- `ci.yml` em `push`/`pull_request`, `windows-latest`: Node **22** (os testes `.ts` exigem Node ≥ 22.18), `npm ci`, `npx tsc -b`, `npm test`, Rust stable + `swatinem/rust-cache`, `cargo test`, `cargo clippy -- -D warnings`.
- `package.json`: `"test": "node --test test/"` (sem lista manual).
- `release.yml`: Node 22.

### T8.3 [HAIKU] Código morto
**Arquivos:** `src/lib/theme.ts` (remover `Theme`, `ResolvedTheme`, `useTheme`, `cycleTheme`, `STORAGE_KEY "att-theme"`), `index.html` (remover o script de tema claro/escuro; manter `class="dark"` fixo no `<html>` se o CSS depender de `dark:`), `src/utils/` (apagar `threshold.ts` e `viscose.ts` — **pedir confirmação ao usuário antes de apagar**), `package.json` (remover `@base-ui-components/react`, alias duplicado sem uso), `src-tauri/src/watcher.rs` (`plan_roll` + teste — só se o Plano 03 ainda não removeu).
- Rodar `grep` antes de cada remoção e listar as evidências de não uso no PR.

### T8.4 [HAIKU] Raiz do repo
**Arquivos:** só `mv` (sem apagar): PNGs de screenshot → `docs/archive/screenshots/`; `debug_cards.js`, `find_duplicates.cjs`, `screenshot_tool.js`, `test-capture.mjs` → `scripts/dev/`; `HANDOFF_UI_REFACTOR.md`, `2026-10-12-*.md` → `docs/archive/`; `refactor_gemini_4/` → `docs/archive/`. `test_output.css` e `tsconfig.tsbuildinfo` → listar para o usuário apagar. Atualizar o `.gitignore` com os novos caminhos (manter ignorados os que já eram).

---

## Lote 08-B (Onda 3)

### T8.5 [HAIKU] Erros como código
**Arquivos:** novo `src-tauri/src/errors.rs`; os comandos do `lib.rs` e dos módulos passam a retornar `Err(AppError)` serializado como `{ code: "rawaccel_not_found", params: {...} }` (substituição mecânica das strings PT). Novo `src/lib/errors.ts`: `formatError(err, t)` → chave `error.<code>`.
- Fazer **depois** da Onda 2 (os comandos novos já nascem com código).

### T8.6 [HAIKU] Vazamentos de i18n
**Arquivos:** `src/hooks/useAppData.tsx` (notificações "Playlist concluída!", "Etapa avançada", "Playlist detectada"), `src/hooks/useKovaakWatcher.ts` ("Nova Run Registrada"), `src/lib/tauri-bridge.ts` (títulos dos dialogs), `src/lib/theme.ts` (descrições dos temas → chaves), `src/components/ui/Toast.tsx`, `src/components/shell/Dock.tsx`, `src/components/shell/ScenarioSwitcher.tsx`, `src/components/dialogs/AimLabSyncDialog.tsx`, `src/components/views/dashboard/MiniPlaylistRunner.tsx`, `src/components/views/randomizer/category-cards.tsx` (fallbacks `|| "..."`).
- **Tray (Rust):** novo comando `set_tray_labels { open, quit }`; o front chama no boot e ao trocar idioma.
- Critério: `grep -rnP '"[^"]*[áéíóúãõçÁÉÍÓÚÃÕÇ][^"]*"' src --include=*.ts* | grep -v i18n.tsx` volta vazio (exceto o label "Português").

### T8.7 [HAIKU] SettingsContext
**Arquivos:** novo `src/hooks/useSettings.tsx`, `src/hooks/useAppData.tsx`, `src/App.tsx` (`handleUpdateAppSettings`).
- Um provider carrega `get_settings` uma vez, assina `settings_updated` (emitido pelo Rust em `save_settings`), expõe `settings` e `updateSettings(partial)`. Remover `getSettings()` do foco da janela, dos avanços de etapa e da detecção de playlist.
- **DPI único (REV-24):** `AppSettings.mouse_dpi` é a fonte; `RandomizerSettings.mouse_dpi` vira somente leitura no Rust (preenchida a partir de `AppSettings` ao carregar). Remover a sincronização manual nos dois comandos.

### T8.8 [HAIKU] Export pelo diálogo nativo
**Arquivos:** `src/hooks/useAppData.tsx` (`exportData`), `src-tauri/src/lib.rs` (comando `export_app_data { path }` — usa o snapshot do store + `atomic_write`), capabilities (`dialog:allow-save`).
- Substitui o `data:` URI + `<a download>`.

---

## Lote 08-C (Onda 5)

### T8.9 [HAIKU] Code splitting
**Arquivos:** `src/App.tsx` (só os imports das views).
- `const RandomizerView = lazy(() => import(...))`, idem `PlaylistView` e `LabView`; `Suspense` com skeleton simples. O dashboard continua eager.
- Aceite: bundle inicial < 600 KB (hoje 1.14 MB em um chunk só).

### T8.10 [HAIKU] Orçamento de GPU do backdrop
**Arquivos:** `src/components/shell/Backdrop.tsx`, `src/styles/index.css`.
- Limitar o loop do canvas a 30 fps (acumulador de tempo no `requestAnimationFrame`). Hoje roda na taxa do monitor (240/360 Hz em setup de FPS) enquanto a janela está focada.
- Nível de animação "sutil" → canvas desligado (gradiente estático). "Moderado" → 30 fps.
- `prefers-reduced-motion` → canvas desligado.

### T8.11 [HAIKU] Cálculo pesado fora da main thread (só se medir > 50 ms)
**Arquivos:** novo `src/workers/skill.worker.ts`, `src/hooks/useSkill.ts` (`useAllSkills` passa a usar o worker).
- Medir antes com `performance.now()` em dados reais e só implementar se `useAllSkills` passar de 50 ms. Senão, registrar a medição no PR e fechar a tarefa.

---

## Checklist global (Onda 6)
- [ ] Teste de caos: matar o processo durante 20 saves seguidos → app reabre com dados íntegros (último estado ou backup).
- [ ] 3 runs seguidas no KovaaK's + troca de cenário na UI → 3 sessões, 1 toast por run.
- [ ] Runs jogadas com o app fechado aparecem no próximo boot.
- [ ] Nenhum arquivo da pasta stats do KovaaK's tem `mtime` alterado pelo app (comparar antes/depois).
- [ ] Meta cai depois de 2 semanas sem treinar; outlier não trava a meta.
- [ ] Randomizer: 2 primeiras runs da sessão na base; âncora a cada 5; saco preservado após reiniciar o app.
- [ ] Passo de medição: sens base aplicada, runs marcadas `measure`.
- [ ] Laboratório mostra faixas com o badge experimental e não altera o centro do randomizer sem opt-in.
- [ ] App em EN: nenhum texto em PT.
- [ ] `tsc`, `npm test`, `cargo test`, `clippy` verdes no CI.
