# Especificacao de Design: Simplificacao, Otimizacao e Modularizacao

## Contexto e Motivacao
O aplicativo `aim-threshold-tracker-app` cresceu rapidamente com a integracao do KovaaK's watcher e do Randomizador de Sensibilidade via Raw Accel. Embora totalmente funcional e com testes de parser em Rust passando, a base de codigo acumulou alguns sintomas de crescimento acelerado:
1. O componente `SensRandomizerView.tsx` tornou-se monolitico (~1.185 linhas), misturando formulario de entrada, funcoes matematicas de regressao quadratica, calculo de estatisticas bayesianas e renderizacao de graficos e tabelas.
2. A conversao de yaw do Valorant para cm/360 e a formatacao de sensibilidade estao duplicadas em multiplos componentes (`HistoryTable.tsx`, `MetricsCards.tsx`, `SensRandomizerView.tsx`).
3. O compilador do Rust (`cargo clippy`) reporta 4 avisos relacionados a simplificacao de ranges, blocos condicionais aninhados e desempacotamento de Result.
4. Ausencia de testes automatizados no frontend para as funcoes matematicas e estatisticas fundamentais do sweet spot.

## Objetivos
- Modularizar `SensRandomizerView.tsx` em subcomponentes coesos e desacoplados (`SensRandomizerControls`, `SensRandomizerChart`, `SensRandomizerAnalytics`).
- Isolar toda a logica matematica pura em `src/lib/sens-analytics.ts`, permitindo reuso em toda a aplicacao e testes automatizados unitarios com Node 24 (`node --test`).
- Eliminar duplicacoes de formatacao de sensibilidade, adotando `formatSensitivity` e `valorantToCm360` centralizados.
- Sanear todos os avisos do `cargo clippy` no backend Rust sem alterar nenhum comportamento do watcher ou do storage.
- Manter 100% de retrocompatibilidade e integridade de UI e internacionalizacao.

## Arquitetura Proposta

### 1. Camada de Logica e Estatistica Pura (`src/lib/sens-analytics.ts`)
- `valorantToCm360(sens: number, dpi?: number): number`: Converte sensibilidade in-game para cm/360 real caso esteja na faixa angular (< 2.5).
- `formatSensitivity(sens: number): string`: Formata sensibilidade com precisao dinamica (ex: "50 cm", "68.5 cm").
- `calculateParabolicTrendline(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }>`: Resolve regressao quadratica via minimos quadrados e regra de Cramer.
- `computeSweetSpotAnalytics(runs: Array<{ sens: number; score: number }>): SweetSpotAnalysis | null`: Agrupa sessoes em baldes de sensibilidade, aplica encolhimento bayesiano (k=3), variancia amostral de Bessel (n-1) e classifica niveis de confianca.

### 2. Decomposicao de Componentes da UI (`src/components/randomizer/`)
- `src/components/randomizer/SensRandomizerControls.tsx`: Gerencia inputs fluidos de limites (cm/360 vs multiplicador), base sens, botao de salvar e acionamento de randomizacao manual.
- `src/components/randomizer/SensRandomizerChart.tsx`: Encapsula a renderizacao do Scatter Plot e da linha de tendencia parabolica com Chart.js.
- `src/components/randomizer/SensRandomizerAnalytics.tsx`: Exibe os cards de Sweet Spot, indicacao de confianca estatistica, media global e tabela ranqueada de faixas.
- `src/components/SensRandomizerView.tsx`: Reduzido a um orquestrador enxuto (~120 linhas), responsavel por conectar o hook `useSensRandomizer` aos subcomponentes visuais.

### 3. Saneamento do Backend Rust
- `src-tauri/src/parser.rs`: Ajustar range check para `(5.0..=150.0).contains(&raw_sens)`.
- `src-tauri/src/storage.rs`: Substituir `match` por `.unwrap_or_default()`.
- `src-tauri/src/watcher.rs`: Colapsar blocos `if` aninhados na verificacao de atualizacao de sensibilidade.

## Plano de Testes
- Testes unitarios automatizados em `test/sens-analytics.test.ts` cobrindo conversoes de sensibilidade, calculo de regressao quadratica e limites de amostragem bayesiana.
- Execucao de `cargo test` e `cargo clippy` no Rust para validar zero warnings e zero falhas.
- Execucao de `npm run build` para garantir zero erros de compilacao e tipagem TypeScript.
