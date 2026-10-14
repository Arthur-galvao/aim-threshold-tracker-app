# Runbook de Execução no Google Antigravity (Para o Gemini 3.8)

Este guia foi estruturado seguindo a skill **`executing-plans`** e **`anti-ui-slop`** para ser executado pelo **Gemini 3.8** dentro do **Google Antigravity** sobre a base na **tag `v1.9`**.

---

## Passo 0: Preparação do Worktree e Diagnóstico da Tag `v1.9`

1. No terminal integrado do Antigravity, verifique a tag atual e crie uma branch dedicada para a refatoração visual:
   - Verificar estado atual: confirmar que o `HEAD` corresponde à `v1.9` (`git status` e `git describe --tags`).
   - Criar branch isolada: `git checkout -b feat/v2.0-glass-hud`.
2. Inspecionar `package.json`, `src/index.css`, `src/App.tsx`, `src/utils/threshold.ts`, `src/utils/viscose.ts`, `src/hooks/useAppData.tsx` e `src/hooks/useKovaakWatcher.ts` para mapear todas as assinaturas de tipos existentes na `v1.9`.

---

## Fase 1: Dependências e Fundação Glassmorphism (`src/index.css`)

### Tarefas:
1. Instalar as dependências de UI:
   - `@base-ui-components/react`
   - `motion` (para microinterações estilo Aceternity UI)
   - `clsx` e `tailwind-merge` (se ainda não presentes na `v1.9`)
2. Refatorar `src/index.css` preservando a configuração de fontes (`Inter` e `JetBrains Mono`) e o suporte a temas claro/escuro da `v1.9`, adicionando:
   - Variáveis ópticas OKLCH para `--surface-canvas`, `--surface-glass-1`, `--surface-glass-2`, `--surface-glass-floating`, `--border-glass` e `--specular-top`.
   - Variáveis semânticas da catraca (`--telemetry-pb`, `--telemetry-ratchet-up`, `--telemetry-ratchet-hold`, `--telemetry-ma3`, `--telemetry-watcher`).
   - Utilitários `.glass-panel`, `.glass-card-interactive`, `.glass-input` (evolução direta de `.panel` e `.minimal-input` da `v1.9`) e `.tabular-nums`.
3. Criar `src/hooks/useWindowActivityGuard.ts` para congelar animações quando a janela do Tauri estiver sem foco ou minimizada durante o KovaaK's.

### Checkpoint de Verificação 1:
- Rodar `npm run build` (ou `tsc --noEmit`) e confirmar zero erros de CSS/TypeScript.

---

## Fase 2: Context Provider React 19 e Simulador de Catraca

### Tarefas:
1. Criar `src/context/TrackerWorkspaceContext.tsx` seguindo o padrão `state / actions / meta` (conforme `02-STATE-AND-COMPOSITION-ARCHITECTURE.md`).
2. Integrar `useAppData` e `useKovaakWatcher` dentro do Provider, mantendo **100% de compatibilidade** com o formato de dados já salvo no armazenamento local da `v1.9`.
3. Expor em `meta.simulatedOutcome` a função de pré-visualização da catraca que recebe as runs em digitação e retorna `willRaiseRatchet`, `projectedThreshold`, `thresholdDelta` e `willBreakPB` usando a matemática de `src/utils/threshold.ts`.

### Checkpoint de Verificação 2:
- Confirmar que a importação de um JSON da `v1.9` carrega todas as tarefas e sessões sem perda de campos e que `simulatedOutcome` respeita a regra de nunca reduzir o Threshold.

---

## Fase 3: CommandBar, Categorias Viscose e Modais em Base UI

### Tarefas:
1. Construir `src/components/layout/CommandBar.tsx` unificando `Header.tsx` e `TaskSelector.tsx`:
   - Implementar as abas de categoria consumindo `src/utils/viscose.ts` com indicador animado em vidro (`motion.div` com `layoutId`).
   - Implementar o seletor rápido de cenário com busca e atalho `Ctrl+K` usando Base UI `Dialog` / `Select`.
   - Adicionar o indicador ao vivo do `useKovaakWatcher` (`Switch` da Base UI + badge luminoso de sincronização CSV) e o `Menu` de sistema (Tema Dark/Light, Importar/Exportar JSON).
2. Refatorar `src/components/NewTaskModal.tsx` e `src/components/Toast.tsx` usando `Dialog` e `Toast` da Base UI com superfície `--surface-glass-floating`.

### Checkpoint de Verificação 3:
- Testar navegação por teclado (`Tab`, `Esc`, `Ctrl+K`), troca de categoria Viscose, alternância de tema Dark/Light e criação de novo cenário.

---

## Fase 4: TelemetryBento, RatchetAnalyticsStage, QuickComposer e SessionLedger

### Tarefas:
1. Refatorar `src/components/MetricsCards.tsx` no novo `TelemetryBento` com 4 `SpotlightCard` em vidro, `NumberTicker` e barra de progresso da Meta do Dia (`Progress.Root` da Base UI + `Tooltip` explicativo da catraca).
2. Refatorar `src/components/ProgressChart.tsx` no novo `RatchetAnalyticsStage`:
   - Configurar a série do Threshold como **Step-Line (`stepped: 'before'`)** em Esmeralda com preenchimento em gradiente translúcido.
   - Configurar a linha de PB em Ciano e a Média Móvel (3 sessões) como curva tracejada em Índigo.
   - Adicionar `ToggleGroup` da Base UI para filtro de período (*10 / 25 / Todas*) e tooltip customizado em vidro.
3. Refatorar `src/components/SessionForm.tsx` no novo `SessionQuickComposer` com entrada rápida de runs por *chips*, `NumberField` da Base UI para `cm/360` e FOV, e o painel `LiveRatchetPreview`.
4. Refatorar `src/components/HistoryTable.tsx` no novo `SessionLedger` com linhas expansíveis via `Collapsible` da Base UI e badges semânticos (*Subiu Catraca* vs. *Platô Mantido*).
5. Montar o grid Desktop-First final em `src/App.tsx` conectando os Compound Components sem *prop drilling*.

### Checkpoint de Verificação 4:
- Simular a digitação de uma sessão abaixo do Threshold atual e verificar se o preview mostra **"Platô Protegido"** em Âmbar; simular uma sessão acima da Meta do Dia e verificar se mostra **"Novo Degrau"** em Esmeralda e atualiza o Step-Line no gráfico ao salvar.

---

## Fase 5: Hard Finish Gate (`anti-ui-slop`) e Build Tauri

### Checklist Obrigatório Antes do Commit / Tag `v2.0`:
- [ ] **Estado Vazio (Cenário Novo com 0 Sessões):** O gráfico exibe um card de vidro instrucional elegante em vez de um canvas vazio em branco.
- [ ] **Estado de 1ª Sessão (Apenas 1 Sessão Registrada):** O gráfico renderiza o ponto inicial e a linha horizontal da Meta do Dia sem distorcer os eixos X/Y.
- [ ] **Alinhamento Numérico (`tabular-nums`):** Todos os scores, `cm/360`, porcentagens e datas nas tabelas e cards usam `JetBrains Mono` com largura tabular fixa.
- [ ] **Proteção contra Overflow:** Nomes extensos de cenários do KovaaK's não quebram o layout do `CommandBar` nem dos cards (uso de `truncate` + `Tooltip`).
- [ ] **Contraste nos Temas Escuro e Claro:** Textos secundários e bordas especulares de `1px` permanecem legíveis tanto no modo Obsidian Dark quanto no modo Frosted Light.
- [ ] **Zero Uso de GPU em Segundo Plano:** Minimizar a janela confirma pausa imediata das animações via `useWindowActivityGuard`.
- [ ] **Build Limpo:** Executar `npm run build` e `cargo tauri check` sem erros.
