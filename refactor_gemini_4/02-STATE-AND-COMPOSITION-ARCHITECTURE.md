# Arquitetura de Estado e Composição (React 19 + Vercel Patterns)

## 1. Diagnóstico do Fluxo de Dados na `v1.9`

Na versão `v1.9`, `App.tsx` coordena múltiplos estados locais (tarefa selecionada, modal de nova tarefa aberto/fechado, notificações toast, filtro de categoria e callbacks de sessão) e os repassa via props para `Header`, `TaskSelector`, `SessionForm`, `MetricsCards`, `ProgressChart` e `HistoryTable`.

Para escalar a interface na `v2.0` sem *prop drilling* e sem proliferação de props booleanas, aplicaremos os padrões da skill `vercel-composition-patterns`.

---

## 2. Contrato do `TrackerWorkspaceProvider` (`state / actions / meta`)

Os hooks existentes `useAppData.tsx` e `useKovaakWatcher.ts` continuarão responsáveis pela persistência e comunicação com o backend Rust do Tauri, mas serão encapsulados em um provedor de contexto unificado com separação estrita em três domínios consumidos via `use()` do React 19:

### 2.1. `state` (Dados Imutáveis da Renderização Atual)
- `tasks`: Lista completa de cenários cadastrados.
- `activeCategory`: Categoria ativa do `viscose.ts` (*All*, *Flick Tech*, *Click Timing*, *Tracking Control*, *Tracking Reactive*).
- `activeTask`: Cenário atualmente selecionado (com histórico de sessões ordenado cronologicamente).
- `computedMetrics`: Resultado memoizado de `threshold.ts` para o cenário ativo:
  - `currentThreshold`: Valor atual da catraca ascendente;
  - `dailyTarget`: Meta do Dia calculada;
  - `personalBest`: Maior score histórico (PB);
  - `consistencyRatio`: Razão percentual entre o Threshold atual e o PB;
  - `movingAverage3`: Série da média móvel de 3 sessões;
  - `ratchetStatus`: Estado da última sessão (`'ratchet_up' | 'plateau_held' | 'initial'`).
- `watcherStatus`: Estado do `useKovaakWatcher` (`'watching' | 'paused' | 'error' | 'syncing'`), caminho configurado da pasta `stats/` e último arquivo CSV processado.
- `theme`: `'dark' | 'light'`.

### 2.2. `actions` (Mutações e Comandos)
- `selectCategory(category)` e `selectTask(taskId)`
- `recordSession(runs, sensitivityCm360, fov, notes)`
- `createTask(name, category, subcategory, targetMetric)`
- `deleteSession(sessionId)` e `deleteTask(taskId)`
- `toggleWatcher()` e `setKovaakStatsPath(path)`
- `importBackupJson(file)` e `exportBackupJson()`
- `toggleTheme()`

### 2.3. `meta` (Simulação em Tempo Real / Estado Efêmero de UI)
- `draftRuns`: Lista de scores que o usuário está digitando no `SessionQuickComposer` antes de salvar.
- `simulatedOutcome`: Cálculo em tempo real (usando a mesma função pura de `threshold.ts`) que responde instantaneamente enquanto o usuário digita uma run:
  - `willRaiseRatchet`: booleano indicando se a sessão rascunhada vai subir um degrau na catraca;
  - `projectedThreshold`: novo valor do Threshold caso a sessão seja salva agora;
  - `thresholdDelta`: diferença em pontos (`+X.X pts` ou `0.0 pts - Platô Mantido`);
  - `willBreakPB`: booleano indicando se alguma run digitada supera o PB histórico.

---

## 3. Decomposição em Compound Components

Em vez de componentes monolíticos configurados por dezenas de props:

1. **`WorkspaceShell`**: Define o grid Desktop-First de tela cheia (`h-screen overflow-hidden` em resoluções >= 1024px, com rolagem interna apenas no `SessionLedger`).
2. **`CommandBar`**:
   - `CommandBar.Brand`
   - `CommandBar.CategoryTabs` (consome `viscose.ts`)
   - `CommandBar.ScenarioPicker` (Command Palette + Select da Base UI)
   - `CommandBar.WatcherBadge` (status ao vivo do `useKovaakWatcher`)
   - `CommandBar.SystemMenu` (Tema Dark/Light, Import/Export JSON, Configurar pasta KovaaK's)
3. **`TelemetryBento`**:
   - `TelemetryBento.TargetCard` (Meta do Dia + Barra de Progresso até o próximo degrau)
   - `TelemetryBento.PersonalBestCard`
   - `TelemetryBento.ConsistencyCard`
   - `TelemetryBento.HardwareSetupCard` (`cm/360` atual, FOV e variação de sensibilidade)
4. **`RatchetAnalyticsStage`**:
   - `RatchetAnalyticsStage.Toolbar` (Filtros de janela: *Últimas 15*, *30 Sessões*, *Todo Histórico* + toggles de visibilidade das curvas)
   - `RatchetAnalyticsStage.Canvas` (Chart.js customizado com Step-Line para a Catraca)
   - `RatchetAnalyticsStage.EmptyState` (Renderizado automaticamente quando o cenário tem 0 sessões)
5. **`SessionQuickComposer`**:
   - `SessionQuickComposer.RunInput` (Adição rápida de runs via `Enter` ou colagem de múltiplos valores)
   - `SessionQuickComposer.TelemetryFields` (`NumberField` da Base UI para `cm/360` e FOV)
   - `SessionQuickComposer.LiveRatchetPreview` (Mostra o impacto imediato na catraca antes de confirmar)
6. **`SessionLedger`**:
   - `SessionLedger.FilterHeader`
   - `SessionLedger.Row` (Linha resumo da sessão)
   - `SessionLedger.ExpandedRuns` (Painel `Collapsible` da Base UI exibindo cada run individual daquele dia)
