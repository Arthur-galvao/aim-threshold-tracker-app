# Plano de Implementacao: Simplificacao, Otimizacao e Modularizacao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modularizar a logica analitica e os componentes de randomizacao de sensibilidade, eliminar duplicacoes de conversao de sensibilidade no frontend e sanear todos os warnings de compilação no backend Rust.

**Architecture:** Extrair funcoes puras de calculo estatistico e de conversao para `src/lib/sens-analytics.ts` com testes unitarios nativos (`node --test`). Decompor `SensRandomizerView.tsx` em subcomponentes coesos dentro de `src/components/randomizer/`. Corrigir os 4 avisos do `cargo clippy` nos modulos Rust.

**Tech Stack:** React 19, TypeScript 5.7, Tailwind CSS, Chart.js, Rust 1.97, Tauri 2.2, Node 24 Test Runner.

**Spec:** `docs/superpowers/specs/2026-09-06-code-simplification-and-modularization-design.md`

## Global Constraints
- Proibicao absoluta de emojis em codigo, comentarios e documentacao.
- Preservar todas as funcionalidades existentes, rotulos i18n e comportamento de UI.
- Garantir que todos os testes passem (frontend e Rust) com zero erros de tipagem TypeScript.

---

### Task 1: Modulo Puro de Analise de Sensibilidade e Testes Unitarios

**Files:**
- Create: `test/sens-analytics.test.ts`
- Create: `src/lib/sens-analytics.ts`
- Test: `test/sens-analytics.test.ts`

**Interfaces:**
- Produces:
  - `valorantToCm360(sens: number, dpi?: number): number`
  - `formatSensitivity(sens: number, unit?: string): string`
  - `calculateParabolicTrendline(points: Array<{ x: number; y: number }>, steps?: number): Array<{ x: number; y: number }>`
  - `computeSweetSpotAnalytics(runs: Array<{ sens: number; score: number }>): SweetSpotAnalysis | null`

- [ ] **Step 1: Escrever teste unitario automatizado em `test/sens-analytics.test.ts`**
- [ ] **Step 2: Executar teste e verificar que falha por modulo inexistente**
- [ ] **Step 3: Implementar funcoes puras em `src/lib/sens-analytics.ts`**
- [ ] **Step 4: Executar teste e verificar que passa com sucesso**
- [ ] **Step 5: Commit das alteracoes**

---

### Task 2: Reuso e Consolidacao de Formatacao em `HistoryTable` e `MetricsCards`

**Files:**
- Modify: `src/components/HistoryTable.tsx`
- Modify: `src/components/MetricsCards.tsx`

**Interfaces:**
- Consumes:
  - `formatSensitivity` e `valorantToCm360` de `@/lib/sens-analytics`

- [ ] **Step 1: Substituir funcoes inline de conversao em `HistoryTable.tsx` e `MetricsCards.tsx` pelas funcoes importadas de `@/lib/sens-analytics`**
- [ ] **Step 2: Executar `npx tsc --noEmit` para validar consistencia de tipagem**
- [ ] **Step 3: Commit das alteracoes**

---

### Task 3: Decomposicao do Componente Monolitico `SensRandomizerView`

**Files:**
- Create: `src/components/randomizer/SensRandomizerControls.tsx`
- Create: `src/components/randomizer/SensRandomizerChart.tsx`
- Create: `src/components/randomizer/SensRandomizerAnalytics.tsx`
- Modify: `src/components/SensRandomizerView.tsx`

**Interfaces:**
- Consumes:
  - `useSensRandomizer` e funcoes de `@/lib/sens-analytics`
- Produces:
  - Componentes modulares com responsabilidade unica e arquivos abaixo de 300 linhas cada.

- [ ] **Step 1: Criar `SensRandomizerControls.tsx` encapsulando inputs de sensibilidade, selecao de modo e acoes de salvar/randomizar**
- [ ] **Step 2: Criar `SensRandomizerChart.tsx` encapsulando o Scatter Plot com curva parabolica**
- [ ] **Step 3: Criar `SensRandomizerAnalytics.tsx` exibindo cards de metricas de Sweet Spot e tabela ranqueada de faixas**
- [ ] **Step 4: Refatorar `SensRandomizerView.tsx` como orquestrador enxuto integrando os subcomponentes**
- [ ] **Step 5: Executar `npx tsc --noEmit` e `npm run build` para validar integracao e renderizacao**
- [ ] **Step 6: Commit das alteracoes**

---

### Task 4: Saneamento de Avisos do Rust Backend (`cargo clippy`)

**Files:**
- Modify: `src-tauri/src/parser.rs`
- Modify: `src-tauri/src/storage.rs`
- Modify: `src-tauri/src/watcher.rs`

- [ ] **Step 1: Ajustar range check em `src-tauri/src/parser.rs` utilizando `(5.0..=150.0).contains(&raw_sens)`**
- [ ] **Step 2: Simplificar leituras de JSON em `src-tauri/src/storage.rs` com `.unwrap_or_default()`**
- [ ] **Step 3: Colapsar condicional em `src-tauri/src/watcher.rs`**
- [ ] **Step 4: Executar `cargo clippy` e `cargo test` confirmando zero avisos e todos os testes passando**
- [ ] **Step 5: Commit das alteracoes**
