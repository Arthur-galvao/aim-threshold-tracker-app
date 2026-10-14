# Plano Mestre de Refatoração UI/UX: Aim Threshold Tracker (v1.9 -> v2.0)

## 1. Contexto e Auditoria de Base (Tag `v1.9`)

Este plano parte do estado atual do repositório `Arthur-galvao/aim-threshold-tracker-app` na **tag `v1.9`** (arquitetura desktop Tauri + Rust backend + React 19 + TypeScript + Tailwind CSS) e define a refatoração completa da interface para a versão **v2.0 (Tactical Precision Glass HUD)**.

### 1.1. O que existe hoje na base (`v1.9`) e como será tratado
- **Regras de Negócio Intocáveis (Preservar 100% da matemática):**
  - `src/utils/threshold.ts`: Cálculo da **Catraca Ascendente (Upward Ratchet)** (onde o Threshold sobe em sessões fortes e mantém o platô histórico sem regredir em dias ruins), cálculo da **Meta do Dia (Target Threshold)**, **Média Móvel de 3 sessões** e **Ratio de Consistência (Threshold / PB)**.
  - `src/utils/viscose.ts`: Categorização e subcategorização de cenários do KovaaK's segundo os benchmarks da Viscose (*Flick Tech*, *Click Timing*, *Tracking Control*, *Tracking Reactive*, etc.).
  - **Backend Rust (`src-tauri/`) + `src/hooks/useKovaakWatcher.ts`**: Monitoramento automático em tempo real da pasta `stats/` do KovaaK's via IPC do Tauri, extraindo score, sensibilidade (`cm/360`), FOV e timestamp de cada CSV gerado.
  - `src/hooks/useAppData.tsx`: Persistência local de tarefas e sessões, cálculo derivado de PB e importação/exportação de backup JSON.
- **Camada Visual Atual (`v1.9`) que será totalmente substituída:**
  - `src/index.css`: Atualmente baseado em classes utilitárias minimalistas (`.panel`, `.minimal-input`) com variáveis CSS de tema claro/escuro e fontes `Inter` e `JetBrains Mono`. Será evoluído para uma arquitetura **Glassmorphism em 3 camadas ópticas (OKLCH)** mantendo suporte a tema escuro (padrão) e claro translúcido.
  - `src/App.tsx`: Atualmente empilha verticalmente `Header`, `TaskSelector`, `SessionForm`, `MetricsCards`, `ProgressChart` e `HistoryTable`. Será substituído por um **Workspace HUD de tela única (Desktop-First)** sem rolagem vertical desnecessária e sem *prop drilling*.
  - Componentes de UI (`Header.tsx`, `TaskSelector.tsx`, `SessionForm.tsx`, `MetricsCards.tsx`, `ProgressChart.tsx`, `HistoryTable.tsx`, `NewTaskModal.tsx`, `Toast.tsx`): Serão reestruturados combinando primitivas acessíveis **Base UI (`@base-ui-components/react`)** com microinterações focadas **Aceternity UI (`motion/react`)**.

---

## 2. Diretrizes Arquiteturais das Skills Aplicadas

1. **`anti-ui-slop` (Contrato de Design e Hard Finish Gate):**
   - Proibido usar gradientes neon genéricos de IA ou vidro leitoso ilegível.
   - O vidro deve usar **translucidez controlada + borda especular interna superior de 1px + contraste tipográfico rigoroso**.
   - **Orçamento de GPU em Background:** Como o aplicativo roda aberto junto com o KovaaK's (e jogos competitivos como VALORANT), efeitos contínuos de GPU (shaders infinitos, partículas em loop) são **estritamente proibidos**. Todas as animações da Aceternity UI devem ser acionadas apenas por eventos discretos (hover, troca de aba, chegada de novo CSV ou quebra de degrau da catraca) e pausadas via `document.visibilityState` quando a janela Tauri estiver em segundo plano.
2. **`tailwind-design-system` (Tokens Semânticos e Variantes):**
   - Migração das classes `.panel` e `.minimal-input` para tokens semânticos de profundidade (`surface-canvas`, `surface-glass-1`, `surface-glass-2`, `surface-glass-elevated`) e tokens semânticos da catraca (`status-pb`, `status-ratchet-up`, `status-ratchet-hold`, `status-watcher-live`).
   - Tipografia numérica estrita: `JetBrains Mono` com `tabular-nums` obrigatório em todos os scores, `cm/360`, FOV, porcentagens de consistência e datas.
3. **`vercel-composition-patterns` (React 19 Composition & State):**
   - Eliminação de props booleanas proliferadas e repasse manual de props em `App.tsx`.
   - Adoção de **Compound Components** e do padrão `state / actions / meta` em um `TrackerWorkspaceProvider` consumido via API `use()` do React 19.
4. **`executing-plans` (Execução Estruturada no Google Antigravity):**
   - Divisão em 5 fases sequenciais com checkpoints de compilação (`tsc`, `vite build`, `cargo tauri check`) para execução segura pelo **Gemini 3.8** no Google Antigravity.

---

## 3. Mapa dos Documentos do Plano

| Arquivo | Escopo para o Gemini 3.8 no Antigravity |
| :--- | :--- |
| `00-MASTER-PLAN-v2.0-GLASS-HUD.md` | Visão geral da arquitetura, regras de negócio preservadas da `v1.9` e diretrizes globais. |
| `01-DESIGN-SYSTEM-GLASSMORPHISM-TAILWIND-V4.md` | Tokens OKLCH, evolução do `index.css` (`.panel` -> camadas ópticas de vidro), tipografia e guarda de GPU. |
| `02-STATE-AND-COMPOSITION-ARCHITECTURE.md` | Refatoração de `useAppData` e `useKovaakWatcher` para Context Provider React 19 com simulação prévia da catraca. |
| `03-BASEUI-ACETERNITY-COMPONENT-SPECS.md` | Especificação detalhada de cada componente novo/refatorado usando Base UI e Aceternity UI. |
| `04-ANTIGRAVITY-EXECUTION-CHECKLIST-GEMINI-3.8.md` | Roteiro passo a passo de execução, comandos de verificação e checklist final (*Hard Finish Gate*). |
