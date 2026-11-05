# Plano 06 — Laboratório de sens (experimental) (Onda 5)

**Decisão do Arthur:** o preditor vira **"Laboratório (experimental)": sensibilidades recomendadas para X jogos com base na sua performance ao longo dos treinos**. É guia direcional e sugestão, **não regra**. Não define o centro do randomizer, a menos que o usuário escolha `centerSource = "lab"` (Plano 05).

Por que rebaixar o preditor:
- NVIDIA (Boudaoud, Spjut & Kim, IEEE CoG 2022 / IEEE ToG 2023): desempenho ótimo e quase plano numa faixa de ~4× (20–80 cm/360). Dentro dela, um "ótimo" pontual é majoritariamente ruído.
- Viscose e Keeah (Raw Input, 2024–2025): não existe sens perfeita; sens é ferramenta.
- → O laboratório mostra **faixas** e **direção** ("você rende pior abaixo de X"), nunca um número único como verdade.

Ativos já existentes a reaproveitar:
- `run-points.ts` → `rel` já remove a tendência temporal (mediana móvel). É o controle de tempo certo; manter.
- `sens-analytics.ts` (`predictOptimalSensitivity`), `sens-model.ts` (`fitQuadraticLog`, `bootstrapVertex`, `kernelSmooth`), `components/views/randomizer/category-cards.tsx` (cards por grupo motor).
- Constantes de yaw em `parser.rs::convert_sens_to_cm`.

---

## T6.1 [HAIKU] Tabela de jogos e conversão
**Arquivos:** novo `src/lib/lab/games.ts`, `test/lab-games.test.ts`.
```ts
export interface GameDef { id: string; name: string; yaw: number; note?: string; decimals: number }
export const GAMES: GameDef[] = [
  { id:"valorant", name:"Valorant", yaw:0.07, decimals:3 },
  { id:"cs2", name:"Counter-Strike 2", yaw:0.022, decimals:2 },
  { id:"apex", name:"Apex Legends (hipfire)", yaw:0.022, decimals:2 },
  { id:"ow2", name:"Overwatch 2", yaw:0.0066, decimals:2 },
  { id:"fortnite", name:"Fortnite (slider %)", yaw:0.0055555555, decimals:1 },
  { id:"r6", name:"Rainbow Six Siege", yaw:0.00528, decimals:0, note:"aproximado; depende de FOV/multiplicadores" },
];
export const cmToGame = (cm: number, dpi: number, g: GameDef) => 914.4 / (dpi * g.yaw * cm);
export const gameToCm = (sens: number, dpi: number, g: GameDef) => 914.4 / (dpi * g.yaw * sens);
```
**Testes:** Valorant 0.35 @800 DPI ≈ 46.65 cm (±0.05); ida e volta preserva o valor.
Nota fixa na UI: "Conversão por distância de 360°. Jogos com FOV diferente do KovaaK's (103) podem sentir diferente."

## T6.2 [FORTE] Estimativa de faixa por subcategoria
**Arquivos:** novo `src/lib/lab/category-range.ts`, `test/lab-category-range.test.ts`.
```ts
export interface CategoryRange { category: string; subcategory: string; centerCm: number|null; loCm: number|null; hiCm: number|null; confidence: "high"|"medium"|"low"|"insufficient"; nRuns: number; nSens: number; slowPenaltyPct: number|null; fastPenaltyPct: number|null }
export function estimateCategoryRange(tasks: Task[], cat: string, sub: string, opts: { dpi: number; validity: ValidityConfig }): CategoryRange
```
- Pontos: `buildRunPoints` das tasks da subcategoria; **excluir só aquecimento/pausa** (Plano 04 regras 1–3). **Não** excluir runs randomizadas: aqui a variedade é o sinal.
- Curva: `fitQuadraticLog` em `(ln sens, rel)`; centro = vértice (se côncava) com IC por `bootstrapVertex`.
- Faixa = intervalo de sens onde a perda prevista é ≤ 2% do pico, recortado ao intervalo de sens efetivamente observado (sem extrapolar).
- `slowPenaltyPct` / `fastPenaltyPct` = perda prevista nas bordas observadas (para frases direcionais).
- Confiança: `high` se ≥ 120 runs e ≥ 6 sens distintas (lattice k) e IC do vértice < ±10%; `medium` se ≥ 50 e ≥ 4; `low` se ≥ 20 e ≥ 3; senão `insufficient` (centro null).
- Curva não côncava (plana ou monotônica) → `centerCm = null`, mas devolve as penalidades. "Plano" é resultado válido ("sem diferença detectável na faixa testada").
**Testes:** curva sintética com vértice em 40 cm → centro entre 36 e 44, faixa contém 40; dados planos → centro null, penalidades ≈ 0; 10 runs → insufficient.

## T6.3 [HAIKU] Perfis de jogo e sugestão
**Arquivos:** novo `src/lib/lab/game-suggestion.ts`, `test/lab-game-suggestion.test.ts`.
- Pesos por categoria (editáveis; padrão rotulado "estimativa inicial"):
  - Valorant: Click Timing .40 · Flick Tech .40 · Reactive Tracking .10 · Control Tracking .10
  - CS2: Click .45 · Flick .45 · Reactive .05 · Control .05
  - Apex: Control .35 · Reactive .35 · Flick .20 · Click .10
  - OW2: Reactive .30 · Flick .30 · Control .25 · Click .15
  - Fortnite: Flick .35 · Reactive .25 · Control .20 · Click .20
  - R6: Click .50 · Flick .40 · Reactive .10
- Peso efetivo da subcategoria = peso da categoria / nº de subcategorias com dado × fator de confiança (`high` 1, `medium` .6, `low` .3, `insufficient` 0).
- Sugestão = média **geométrica** ponderada dos centros; faixa = médias geométricas ponderadas de lo/hi. Soma de pesos efetivos < 0.3 → "dados insuficientes para este jogo".
- `verdict(currentCm)`: `inside` / `faster_than_range` / `slower_than_range`, com a distância em %.
- Texto **sempre direcional**: "Seus dados sugerem que você rende parecido entre X e Y cm/360 (≈ A–B no Valorant). Sua sens atual está N% mais rápida que essa faixa." Nunca "use exatamente X".

## T6.4 [HAIKU] Tela do Laboratório
**Arquivos:** novo `src/components/views/lab/index.tsx`, novo `src/components/views/lab/game-card.tsx`, novo `src/components/views/lab/category-range-card.tsx`; mover `components/views/randomizer/category-cards.tsx` para `components/views/lab/` (atualizar o import no randomizer: remover a seção de lá). Navegação: `components/shell/Dock.tsx`, `components/shell/AppShell.tsx` (tipo `NavTab` += `"lab"`), `src/App.tsx` (render da aba). **Esta tarefa é a única que edita esses três arquivos nesta onda.**
- Badge "EXPERIMENTAL" fixo e banner de 1 linha: "Sugestão direcional baseada no seu treino. Não é regra; sens é ferramenta."
- Seletor de jogo, campo "sua sens atual no jogo" (persistido em settings: `lab: { gameId, inGameSens }`) → mostra o cm/360 e o verdict.
- Card por jogo: faixa sugerida em cm/360 e em sens do jogo; confiança; contribuição por categoria (barras).
- Cards por subcategoria: faixa, penalidades lenta/rápida, nº de runs/sens, mini-gráfico rel × sens (reusar `sweet-spot-chart.tsx`, mas importado, sem editar).
- Botão "Usar como centro do randomizer (experimental)" → `centerSource = "lab"`, com confirmação explicando o efeito.

## T6.5 [HAIKU] Integração (i18n; textos de disclaimer PT/EN; aba "Lab"/"Laboratório").
