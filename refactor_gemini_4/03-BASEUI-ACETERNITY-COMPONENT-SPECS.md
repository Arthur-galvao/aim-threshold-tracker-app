# Especificação de Componentes: Base UI + Aceternity UI

Este documento detalha como cada componente da versão `v1.9` deve ser refatorado combinando **Base UI (`@base-ui-components/react`)** para acessibilidade, foco e controle de estado sem estilo, e **Aceternity UI (`motion/react`)** para acabamento visual Glassmorphism.

---

## 1. `CommandBar` (Substitui `Header.tsx` + `TaskSelector.tsx`)

### 1.1. Primitivas Base UI Utilizadas
- **`Tabs.Root` / `Tabs.List` / `Tabs.Tab` / `Tabs.Indicator`**: Para filtrar rapidamente os cenários pelas categorias do `viscose.ts` (*Todas*, *Flick Tech*, *Click Timing*, *Tracking Control*, *Tracking Reactive*).
- **`Dialog.Root` (Command Palette `Ctrl+K`) + `Select.Root`**: Seletor rápido de cenário com busca instantânea por nome e subcategoria Viscose, além de atalho direto para "+ Novo Cenário".
- **`Switch.Root` / `Switch.Thumb`**: Para ativar/pausar o `useKovaakWatcher` com feedback visual imediato.
- **`Menu.Root` / `Menu.Popup` / `Menu.Item`**: Agrupa ações secundárias (Importar JSON, Exportar JSON, Alterar Tema Dark/Light, Selecionar Pasta `stats/` do KovaaK's), limpando a poluição de botões soltos no topo.

### 1.2. Camada Aceternity UI
- **Animated Pill Indicator (`layoutId="viscose-category-pill"`):** Cápsula de vidro translúcido (`--surface-glass-2` com borda especular) que desliza suavemente entre as categorias da Viscose ao trocar de aba.
- **Watcher Pulse Ring:** Quando o Rust backend detecta um novo CSV na pasta `stats/`, o badge do Watcher emite um único pulso radial em `--telemetry-watcher` e atualiza o timestamp da última leitura.

---

## 2. `TelemetryBento` (Substitui `MetricsCards.tsx`)

### 2.1. Layout Bento Assimétrico (4 Cartões no Topo do Workspace)
1. **Card 1 (Destaque — 4 colunas): Meta do Dia & Degrau da Catraca (`Target Threshold`)**
   - Exibe o valor atual do Threshold em `JetBrains Mono` grande (`text-3xl font-bold tabular-nums`).
   - Inclui uma **Barra de Progresso de Vidro (`Progress.Root` da Base UI)** mostrando o quão próxima a última sessão (ou o rascunho atual) está de destravar o próximo degrau da catraca.
   - Inclui um `PreviewCard` / `Tooltip` da Base UI no ícone de informação que explica em 2 linhas a regra da catraca: *"A catraca sobe quando sua consistência supera a barra atual e trava quedas em dias de baixo desempenho."*
2. **Card 2 (3 colunas): Recorde Pessoal (`Personal Best`)**
   - Destaque em Ciano (`--telemetry-pb`), exibindo o score máximo histórico, a data em que foi atingido e o delta percentual em relação à sessão mais recente.
3. **Card 3 (3 colunas): Índice de Consistência (`Ratio %`)**
   - Exibe a razão `Threshold / PB` em porcentagem, acompanhada de um mini-indicador de estabilidade das últimas 3 sessões.
4. **Card 4 (2 colunas): Setup & Sensibilidade (`cm/360` & FOV)**
   - Exibe a última sensibilidade registrada (`cm/360`) e FOV, sinalizando se houve alteração de sensibilidade nas últimas sessões.

### 2.2. Camada Aceternity UI
- **`SpotlightCard` (CSS Radial Hover):** Passar o mouse sobre qualquer um dos 4 cards revela um brilho radial sutil na borda de vidro de `1px` acompanhando o cursor via variáveis CSS (`--mouse-x`, `--mouse-y`), sem re-renderizar o React.
- **`NumberTicker`:** Ao trocar de cenário ou registrar uma sessão nova, os números interpolam suavemente em `tabular-nums` (duração máxima de `280ms`).

---

## 3. `RatchetAnalyticsStage` (Substitui `ProgressChart.tsx`)

### 3.1. Evolução Visual do Gráfico Cronológico
- **Ordem Cronológica Estrita:** Sessão mais antiga à esquerda -> Sessão mais recente à direita.
- **Diferenciação Clara das 3 Curvas Principais:**
  1. **Linha do Threshold (Catraca Ascendente):** Renderizada obrigatoriamente como **Step-Line (`stepped: 'before'`)** em Esmeralda (`--telemetry-ratchet-up`) com preenchimento em gradiente vertical translúcido abaixo dos degraus. Isso torna visualmente óbvio o efeito de catraca (degraus que só sobem ou ficam retos em platô, nunca descem).
  2. **Linha de Recorde Pessoal (PB):** Linha contínua superior em Ciano (`--telemetry-pb`) com pontos destacados apenas nos dias em que o PB foi quebrado.
  3. **Curva de Média Móvel (3 Sessões):** Linha suavizada (`tension: 0.35`, tracejada) em Índigo (`--telemetry-ma3`) mostrando a oscilação real de curto prazo em contraste com a proteção da catraca.

### 3.2. Primitivas Base UI no Gráfico
- **`ToggleGroup.Root` / `Toggle`:** Seletor compacto no canto superior direito do gráfico para filtrar a janela temporal (*Últimas 10*, *Últimas 25*, *Todas as Sessões*).
- **`Checkbox.Root` (Chips de Camada):** Permite ligar/desligar visualmente no canvas a curva de Média Móvel (3s), os pontos de Pico da Sessão ou anotações de mudança de `cm/360`.
- **Tooltip HTML Customizado em Vidro:** Substitui o tooltip nativo em canvas do Chart.js por um elemento DOM posicionado com `--surface-glass-floating`, exibindo Data, Runs do dia, Média do dia, PB, Degrau da Catraca e `cm/360`.

---

## 4. `SessionQuickComposer` (Substitui `SessionForm.tsx`)

### 4.1. Mudança de Fluxo UX
Na `v1.9`, o formulário de sessão ocupava espaço fixo na coluna principal. Na `v2.0`, ele opera como uma **Coluna Tática Lateral (ou Popover de Ação Rápida)** sempre acessível ao lado do gráfico:
- **Entrada Rápida de Runs:** O jogador digita o score da run e pressiona `Enter` (ou cola várias runs separadas por espaço/vírgula). Cada run vira um *chip* editável/removível em vidro.
- **Campos de Precisão (`NumberField.Root` da Base UI):** Controles incrementais acessíveis para `Sensibilidade (cm/360)` (pré-preenchido automaticamente com o valor da última sessão do cenário) e `FOV`.
- **Simulador de Catraca Ao Vivo (`LiveRatchetPreview`):** Antes de clicar em "Salvar Sessão", um painel interno em vidro calcula em tempo real via `threshold.ts`:
  - Se as runs digitadas subirem a barra: exibe um badge Esmeralda **"Novo Degrau: Threshold subirá de X para Y (+Z pts)"**.
  - Se as runs digitadas ficarem abaixo da barra atual: exibe um badge Âmbar **"Platô Protegido: Catraca manterá seu Threshold em X pts"**.

---

## 5. `SessionLedger` (Substitui `HistoryTable.tsx`)

### 5.1. Primitivas Base UI Utilizadas
- **`Collapsible.Root` / `Collapsible.Trigger` / `Collapsible.Panel`**: Cada linha do histórico representa uma sessão e mostra de forma limpa:
  - Data e hora;
  - Quantidade de runs na sessão;
  - Sensibilidade (`cm/360`);
  - Média da sessão e Pico do dia;
  - Valor do Threshold naquela data + **Badge Semântico** (*Subiu Catraca* em Esmeralda ou *Platô Mantido* em Âmbar).
- Ao clicar na linha (`Collapsible.Trigger`), o painel desliza revelando todas as pontuações individuais das runs daquela sessão, notas de treino e botão de exclusão com confirmação em `Popover` da Base UI (evitando cliques acidentais).

---

## 6. `ScenarioDialog` & `TelemetryToast` (Substituem `NewTaskModal.tsx` e `Toast.tsx`)

- **`ScenarioDialog` (`Dialog.Root` da Base UI):** Modal em vidro `--surface-glass-floating` para criar ou editar cenários, com seleção guiada das categorias e subcategorias oficiais de `src/utils/viscose.ts`.
- **`TelemetryToast` (`Toast.Root` da Base UI):** Notificações empilhadas no canto inferior direito que disparam automaticamente quando o `useKovaakWatcher` importa um novo CSV do KovaaK's, exibindo o nome do cenário, o score detectado e se a run superou a Meta do Dia.
