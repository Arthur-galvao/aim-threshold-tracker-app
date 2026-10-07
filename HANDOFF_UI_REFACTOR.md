# Guia de Refatoração de Interface (Handoff UI Refactor)

Este documento contém todo o contexto necessário para que um próximo modelo ou agente assuma a refatoração da interface de usuário (UI) do **Aim Threshold Tracker**.

## 1. Contexto do Projeto e Domínio

- **O que é o app?** Um aplicativo desktop desenvolvido com **Tauri v2** (Rust no backend) e **React 19** (Vite + TypeScript + Tailwind CSS no frontend).
- **Propósito:** Gerenciar sessões de treino de mira (Aim Training) no KovaaK's, analisar estatísticas (Thresholds, Consistência Bayesiana, Regressões Lineares/Quadráticas) e orquestrar a randomização física de sensibilidade no mouse através da manipulação dos arquivos de configuração do driver **RawAccel**.
- **Estado Recente:** O backend (Rust) já foi ajustado para reescrever arquivos CSV corretamente. Foram implementados preditores estatísticos experimentais e o estado do frontend foi centralizado em hooks robustos (`useApp`, `useKovaakWatcher`, `useSensRandomizer`). A estrutura de roteamento e modais também está consolidada.

## 2. Objetivo da Refatoração

O usuário solicitou uma correção e melhoria na interface. O objetivo é aplicar uma camada de design impecável, despoluindo componentes, melhorando a hierarquia da informação e garantindo que o aplicativo não tenha a aparência de um "template genérico" (UI Slop).

Espera-se uma estética **Minimalista / Industrial-Brutalist / Clean**, voltada para "Developer Tools" ou aplicativos de alta precisão técnica. 

## 3. Regras de Design e Comportamento (Estritas)

As seguintes regras são inegociáveis no workspace do usuário:
1. **ZERO Emojis:** É absolutamente proibido o uso de qualquer emoji (carinhas, foguetes, engrenagens unicode, etc.) no código, nos componentes, nos textos de UI, em comentários ou em commits. Use ícones SVG (a biblioteca `@phosphor-icons/react` já está instalada) ou caracteres textuais ASCII padrão.
2. **Internacionalização (i18n):** O aplicativo suporta múltiplos idiomas via `src/lib/i18n.tsx`. Sempre que adicionar ou modificar textos na UI, utilize as chaves de tradução existentes chamando `const { t } = useI18n()` ou expanda o dicionário de forma bilíngue (Português/Inglês).
3. **Uso de Cores Semânticas:** O Tailwind CSS está configurado para utilizar variáveis CSS nativas (ver `src/styles/index.css`). **Não** utilize cores genéricas do Tailwind (ex: `bg-slate-900`, `text-gray-300`). Utilize estritamente a paleta semântica do projeto:
   - Fundo e Superfícies: `bg-base`, `bg-surface`, `bg-surface-subtle`, `bg-surface-hover`.
   - Bordas: `border-edge`, `border-edge-strong`.
   - Textos: `text-text-main`, `text-text-secondary`, `text-text-faint`.
   - Destalhes: `text-accent`, `bg-score`, `text-emerald`, etc.
4. **Classes Globais:** Existem utilitários predefinidos em `index.css` que devem ser priorizados: `.panel`, `.minimal-input`, `.minimal-btn`, `.minimal-btn-secondary`, e `.custom-scrollbar`.

## 4. Estrutura Atual da UI

A interface principal está em `src/App.tsx` e é dividida em abas (Tabs):
- **Dashboard:** Visão geral com métricas (`MetricsCards`), gráficos (`ProgressChart`), lista de cenários (`ScenarioList`), tabela de histórico (`HistoryTable`) e formulário manual (`SessionForm`).
- **Randomizer (`SensRandomizerView`):** Painel de controle do RawAccel, contendo controles de faixas e análise estatística (`SensRandomizerAnalytics`).
- **Playlist (`PlaylistRunnerView`):** Gestão de execução sequencial de cenários.

Existem três modais principais:
- `SettingsModal.tsx`: Concentra configurações gerais, gestão de dados (import/export), configurações do RawAccel e status do KovaaK's.
- `PlaylistManagerModal.tsx`: Edição e criação de playlists.
- `NewTaskModal.tsx`: Criação de novos cenários a serem rastreados.

## 5. Passos Sugeridos para o Próximo Modelo

1. **Auditoria Visual:** Inicie lendo os arquivos `src/App.tsx` e `src/components/Header.tsx`. Identifique onde o layout está "flutuando", se há espaçamento excessivo ou insuficiente e onde a hierarquia de tipografia falha.
2. **Revisão de Grid e Layout:** Certifique-se de que o Dashboard (`App.tsx`) obedeça a um Bento Grid rigoroso ou a uma estrutura em colunas muito clara, usando as classes `grid` do Tailwind de forma consistente.
3. **Refinamento de Componentes Subjacentes:** Verifique botões, inputs, cards e tooltips. A biblioteca Phosphor Icons pode ser ajustada em peso e tamanho para combinar perfeitamente com a tipografia Geist/Geist Mono.
4. **Proteção do Estado Global:** Todas as melhorias visuais devem ser puramente estéticas ou de UX arquitetural. Evite reescrever a lógica interna dos hooks (`useApp`, etc.), pois o fluxo de processamento de dados e a comunicação com o Tauri estão estáveis.
5. **Verificação (QA):** Após qualquer bloco de refatoração, instrua o usuário a compilar o app (`npm run tauri:dev` ou equivalente) para validar se a interface renderizou de acordo com o design intent.
