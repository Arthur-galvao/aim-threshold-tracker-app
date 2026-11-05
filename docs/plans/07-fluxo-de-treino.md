# Plano 07 — Fluxo de treino (Onda 5)

Objetivo: fechar o ciclo de treino (o diferencial possível do app; rank e randomizer já existem em evxl/RefleK's/KovaaK's nativo). Medição separada de treino, intenção antes de volume, sessões curtas com feedback.
Fontes: Voltaic Advice FAQ (benchmark 1×/semana, 5–10 runs/cenário; rotina sem meta de score; treino focado, dividir o treino ao longo do dia); Viscose (meta por cenário + diagnóstico de técnica, anti-autopiloto; fácil refina / difícil estressa); efeito de espaçamento (Cepeda 2006); warm-up decrement.

---

## T7.1 [HAIKU] Contrato
**Arquivos:** `src-tauri/src/model.rs`, `src/lib/types.ts`, `src/lib/tauri-bridge.ts`, `src-tauri/src/lib.rs`.
- `PlaylistItem.stepKind: "train"|"measure"` (default train); `PlaylistItem.maxAttempts?: u32` (default 8); `PlaylistItem.maxMinutes?: u32` (default 10) — só para `targetMode = "threshold"`.
- `Playlist.isMeasurement: bool` (default false; true força todos os passos como measure).
- `Task.intentCue?: String`.
- Comandos: `set_session_focus { taskId, sessionId, focus: "on"|"auto"|null }`; `set_measuring(bool)` (Plano 05, se ainda não existir).
- `AppSettings.training` += `focusPrompt: bool = true`, `fatigueAlerts: bool = true`, `weeklyMeasureReminder: bool = true`.
- `AppSettings.lab: { gameId: String = "valorant", inGameSens: Option<f64> }` (usado pelo Plano 06).

## T7.2 [HAIKU] Sessão ao vivo e resumo
**Arquivos:** novo `src/hooks/useLiveSession.ts`, novo `src/components/dialogs/SessionSummaryDialog.tsx`, `src/App.tsx` (montar o dialog — único edit; fila: depois do T6.4), `src/components/shell/TopBar.tsx` (badge; fila: depois do T5.7e).
- `useLiveSession()`: usa `groupTrainingSessions` (Plano 04) sobre o snapshot; expõe a sessão atual (aberta se a última run tem < `sessionGapMinutes`).
- Encerramento: automático quando o gap passa (verificar a cada 60 s) **ou** botão "Encerrar sessão".
- Resumo: duração, runs/válidas (e motivos das inválidas), por cenário (melhor ajustado vs meta, hit), Δμ por cenário, % foco (se houver ratings), alertas de fadiga disparados, próxima sugestão (do T7.8).
- Não abrir o resumo automaticamente se a janela estiver em background; mostrar um badge no TopBar.

## T7.3 [HAIKU] Curva intrassessão + calibração do aquecimento
**Arquivos:** novo `src/lib/skill/intra-session.ts` (+ teste), novo `src/components/views/dashboard/IntraSessionChart.tsx`; registrar no dashboard via `dashboard/index.tsx` (único edit).
- `z = (y − μ_antes)/σ` por run, eixo X = índice da run na sessão (todos os cenários).
- Média de z por índice nas últimas 20 sessões → ponto onde a curva estabiliza (primeiro índice com média ≥ −0.25 e as 3 seguintes também) → sugestão "seu aquecimento real ≈ N runs" com botão "aplicar" (atualiza `warmupRunsPerScenario`/`sessionWarmupMinutes`).

## T7.4 [HAIKU] Alerta de fadiga
**Arquivos:** novo `src/lib/skill/fatigue.ts` (+ teste), `src/hooks/useLiveSession.ts` (consumir — coordenar: o T7.2 cria o hook com um ponto de extensão `onRunAdded`; o T7.4 só adiciona o arquivo de lógica e uma linha no hook, **depois** do T7.2).
- Dispara se: sessão ≥ 30 min, já houve pico (alguma run com z ≥ 0), e a média de z das últimas 4 runs válidas < −1.5.
- Toast: "Queda sustentada nas últimas runs. Pausa de 5–10 min ou troque de categoria." Cooldown de 15 min. Respeita `fatigueAlerts`.

## T7.5 [HAIKU] Passos de medição
**Arquivos:** `src/hooks/usePlaylistRunner.ts`, `src/components/dialogs/PlaylistItemRow.tsx`, `src/components/dialogs/PlaylistEditor.tsx`.
- Entrar em passo `measure` → `set_measuring(true)`; sair → `false`. Runs nesse passo recebem `runMode = "measure"` (o Rust marca a partir do flag `measuring`, já registrado no ledger).
- Editor: toggle por item "Medição (sens base, sem randomizer)" e toggle de playlist "Playlist de medição"; dica: "Voltaic: medir 1×/semana, 5–10 runs por cenário".
- Lembrete semanal: badge no PlaylistCard quando algum cenário da playlist não tem run `measure` há > 7 dias (`weeklyMeasureReminder`).

## T7.6 [HAIKU] Teto no passo "bater a meta"
**Arquivos:** `src/hooks/usePlaylistRunner.ts` (depois do T7.5 — mesmo arquivo, **sequencial**), `src/components/views/playlist/ActiveRunnerStep.tsx`.
- Contar tentativas válidas e minutos no passo; ao atingir `maxAttempts` ou `maxMinutes` sem bater → avança com estado "não bateu" (registrado em `completedStepIndices` com flag). Evita grind de score no piloto automático.
- UI: "Tentativa 3/8 · 4:12/10:00".

## T7.7 [HAIKU] Cue de intenção por cenário
**Arquivos:** `src/components/views/playlist/ActiveRunnerStep.tsx` (depois do T7.6), `src/components/views/playlist/StepSensCard.tsx` (depois do T5.7e), novo `src/components/dialogs/IntentCueEditor.tsx`.
- Default = `getSubcategoryCoachingCue(cat, sub).mechanicKey` traduzido; o usuário pode sobrescrever por cenário (`update_task_meta` com `intentCue`). Máx. 80 caracteres.
- Exibir em destaque por 4 s na troca de passo e fixo pequeno no card do passo, junto do cue muscular do randomizer ("rápida · pulso/dedos").

## T7.8 [HAIKU] Rating de foco em 1 toque
**Arquivos:** novo `src/components/ui/FocusPrompt.tsx`, `src/hooks/useKovaakWatcher.ts` (no handler de `run_recorded`: disparar o prompt — único edit).
- Toast não bloqueante com 2 botões: "Foco ✓" / "Piloto ✗"; some em 8 s sem resposta (fica null). Desligável (`focusPrompt`).
- Analytics (no resumo de sessão e no breakdown): hit rate e μ das runs com foco vs piloto.

## T7.9 [HAIKU] Qualidade além do score
**Arquivos:** `src/components/views/dashboard/ScenarioBreakdown.tsx`, novo `src/lib/skill/quality.ts` (+ teste).
- Por cenário: tendência de accuracy e TTK (Theil-Sen por sessão).
- Flag "score ↑, accuracy ↓ > 3 p.p. nas últimas 2 sessões → possível spam/piloto automático".

## T7.10 [HAIKU] Foco em fraquezas v2
**Arquivos:** localizar o componente atual de "weakness focus" (`grep -rn "weakness" src`) e editar só ele + novo `src/lib/skill/weakness.ts` (+ teste).
- Score de prioridade por subcategoria = `0.4·(trend down=1, flat=0.6, up=0) + 0.3·(1 − hitRate14) + 0.3·min(1, diasSemTreinar/7)`.
- Top 3 subcategorias com sugestão: "refinar" (variante mais fácil) se hitRate < 35%, "estressar" (variante mais difícil) se em platô com hitRate > 60% (lógica da Viscose). Texto: "procure variantes do nome base (slow/fast/small/blink)".

## T7.11 [HAIKU] Integração (i18n PT/EN de tudo acima).
