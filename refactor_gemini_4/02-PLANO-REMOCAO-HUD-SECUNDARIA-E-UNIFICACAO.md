# Plano 02: Remoção da HUD Secundária Redundante e Unificação do Topo

## 1. Diagnóstico do Problema Atual
- Na implementação atual, existe uma **HUD secundária redundante** abaixo ou ao lado da barra principal (causada pela coexistência de elementos antigos de `Header.tsx` / `TaskSelector.tsx` ou de uma segunda barra de título/status de cenário repetindo o nome da tarefa, categoria Viscose, botões de ação ou status do KovaaK's Watcher).
- Isso rouba espaço vertical precioso da janela desktop, cria confusão visual sobre onde clicar para trocar de tarefa e quebra a estética limpa do Liquid Glass.

---

## 2. Regra de Ouro da Navegação (`Single Unified Command HUD`)
Deve existir **exatamente UMA barra superior (`CommandBar.tsx`)** em toda a aplicação. Nenhuma outra barra horizontal de navegação, sub-header de tarefa ou barra de status secundária é permitida entre a `CommandBar` e o `TelemetryBento`.

### 2.1. O que Remover Definitivamente do Código
1. **Em `src/App.tsx`:**
   - Remover qualquer renderização residual de `<Header />`, `<TaskSelector />`, sub-barras de título do cenário ativo ou containers intermediários de controle entre o topo e os cards de métricas.
   - Excluir os arquivos legados `src/components/Header.tsx` e `src/components/TaskSelector.tsx` caso ainda existam na árvore de arquivos.
2. **Dentro dos painéis filhos (`TelemetryBento`, `RatchetAnalyticsStage`, `SessionQuickComposer`):**
   - Remover cabeçalhos duplicados que repitam o nome do cenário atual, a categoria da Viscose ou o botão de "+ Nova Task" (essas informações pertencem exclusivamente à `CommandBar`).

---

## 3. Estrutura Limpa da Única `CommandBar` (Liquid Glass)

A `CommandBar` única terá altura fixa de `64px`, acabamento `.liquid-glass-pill` (`rounded-2xl px-5`), dividida em 3 zonas horizontais com `justify-between` e `gap-4`:

1. **Zona Esquerda (Identidade + Seletor Rápido do Cenário Ativo):**
   - Ícone/Logo compacto em vidro + Seletor do Cenário (`Select` / `Dialog` Command Palette `Ctrl+K` da Base UI) exibindo o nome do cenário ativo, badge discreto da subcategoria Viscose e botão integrado `+` para criar novo cenário (`NewTaskModal`).
2. **Zona Central (Filtro de Categorias Viscose em Liquid Glass):**
   - `Tabs.Root` da Base UI contendo apenas as pílulas das categorias do `viscose.ts` (*Todas*, *Flick Tech*, *Click Timing*, *Tracking Control*, *Tracking Reactive*) com a cápsula deslizante translúcida (`layoutId="viscose-pill"`).
3. **Zona Direita (Telemetria do Sistema & Ações):**
   - Pílula unificada do `useKovaakWatcher` (LED pulsante + Switch Base UI + atalho para configurar pasta `stats/`).
   - Botões em vidro líquido para Importar/Exportar JSON e alternância de tema (Dark Aero / Light Aero).

---

## 4. Verificação no Antigravity (Gemini 3.8)
- [ ] Abaixo da `CommandBar` superior, o próximo elemento visual imediato (após o espaçamento de `24px`) é a linha dos 4 cards do `TelemetryBento`.
- [ ] Não há nenhum componente ou barra duplicada exibindo novamente seletor de tarefa, abas de categoria ou status do Watcher.
