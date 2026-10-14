# Plano 05: Refatoração Total do Gráfico e Filtro Temporal (`7D` / `30D` / `Tudo`)

## 1. Diagnóstico dos Problemas no Gráfico Atual
1. **Filtro de período incorreto:** Os botões exibiam `10s / 25s / Tudo` (contagem de sessões), quando a regra correta de negócio exige filtro por janela de tempo real: **`7D` (últimos 7 dias), `30D` (últimos 30 dias) e `Tudo` (histórico completo)**.
2. **Aparência e proporção degradadas ("ficou zoado"):**
   - Falta de respiro vertical nos eixos Y (a linha do PB bate no teto do canvas e o início da catraca cola no eixo X).
   - Pontos excessivos ou mal dimensionados poluindo a leitura das 3 curvas.
   - Falta de acabamento Liquid Glass na área interna do gráfico e nos preenchimentos sob a curva.
   - Colisão visual de elementos flutuantes (como Toast ou Tooltip) sobre a área de leitura.

---

## 2. Correção Lógica do Filtro Temporal (`7D` / `30D` / `Tudo`)

No componente `RatchetAnalyticsStage` (ou `ProgressChart.tsx`):

1. **Definir o tipo do estado de filtro:**
   - `type TimeRangeFilter = '7d' | '30d' | 'all';` (padrão inicial: `'30d'` ou `'all'` caso não haja sessões nos últimos 30 dias).
2. **Rótulos Exatos na Interface (`ToggleGroup` em `.liquid-glass-control`):**
   - Botão 1: **`7D`** (filtra sessões onde `sessionTimestamp >= agora - 7 * 86400000`)
   - Botão 2: **`30D`** (filtra sessões onde `sessionTimestamp >= agora - 30 * 86400000`)
   - Botão 3: **`Tudo`** (exibe todas as sessões em ordem cronológica da mais antiga à esquerda para a mais recente à direita)
3. **Importante — Preservação do Contexto Matemático da Catraca no Filtro:**
   - Os valores de `Threshold (Catraca)`, `PB Acumulado` e `Média Móvel (3 sessões)` devem ser **calculados sobre o histórico completo primeiro** (via `threshold.ts`), e **só depois fatiados (`filter`) pelo período `7D` ou `30D`**. Isso garante que, ao visualizar os últimos `7D`, a catraca já comece no patamar real conquistado nas semanas anteriores, e não reinicie do zero.
   - Se o filtro `7D` retornar 0 sessões para o cenário atual, exibir um aviso translúcido elegante dentro do palco com um botão rápido `"Ver 30D / Tudo"`.

---

## 3. Redesenho Visual e Óptico do Gráfico (Liquid Glass Telemetry)

### 3.1. Proporção, Eixos e Margens Internas (Fim do Aspecto "Zoado")
- **Container com Altura Elástica Controlada:** Envolver o `<Line />` do Chart.js em uma `div` com `relative w-full h-[340px] lg:h-[370px] p-4 rounded-2xl bg-white/[0.025] border border-white/[0.08] shadow-inner`.
- **`maintainAspectRatio: false` e `responsive: true`:** Obrigatórios nas `options` do Chart.js para que o gráfico preencha perfeitamente a largura e altura do card sem achatar nem esticar.
- **Respiro Vertical Automático no Eixo Y (`scales.y`):**
  - Configurar `grace: '15%'` (ou calcular `min: Math.floor(minScore * 0.96)` e `max: Math.ceil(maxScore * 1.03)`), garantindo que a linha ciano de PB nunca encoste no topo e a linha esmeralda da Catraca nunca cole na base.
  - Configurar `ticks.maxTicksLimit: 6`, fonte `JetBrains Mono` `11px`, cor `rgba(226, 232, 240, 0.55)` e `padding: 12`.
  - Linhas de grade horizontais (`grid.color`): `rgba(255, 255, 255, 0.06)` com `drawBorder: false`.
  - Remover completamente as linhas de grade verticais (`scales.x.grid.display: false`) para um visual limpo estilo Apple Health / EVXL.

### 3.2. Estilização das 3 Séries no Canvas
1. **Série 1 — Catraca Ascendente (`Threshold` — Protagonista Visual):**
   - `stepped: 'before'` (degraus horizontais-verticais nítidos).
   - `borderColor: '#34d399'` (Esmeralda Aero Bioluminescente), `borderWidth: 3`.
   - **Preenchimento Liquid Glass (`fill: true`):** Gradiente linear vertical no contexto 2D do Canvas indo de `rgba(16, 185, 129, 0.28)` no topo da linha até `rgba(6, 182, 212, 0.0)` na base do gráfico.
   - **Destaque de Platô Protegido (`segment.borderColor`):** Usar a propriedade `segment` do Chart.js para pintar automaticamente de **Âmbar (`#fbbf24`)** os trechos horizontais onde a sessão do dia teve performance menor que a anterior, mas a catraca travou a queda (`ctx.p0.parsed.y === ctx.p1.parsed.y` quando houve queda na média do dia).
2. **Série 2 — Recorde Pessoal Acumulado (`PB`):**
   - `tension: 0.25`, `borderColor: '#22d3ee'` (Ciano Cristal), `borderWidth: 2.5`.
   - Pontos visíveis (`pointRadius: 4.5`, `pointBackgroundColor: '#22d3ee'`, `pointBorderColor: '#ffffff'`, `pointBorderWidth: 1.5`) **apenas nas sessões em que o PB subiu** (e `pointRadius: 0` nas sessões em que o PB permaneceu igual), limpando a poluição visual.
3. **Série 3 — Média Móvel de 3 Sessões (`MA3`):**
   - `tension: 0.4` (curva orgânica fluida), `borderColor: 'rgba(165, 180, 252, 0.75)'` (Azul-Lavanda Aero), `borderWidth: 2`, `borderDash: [6, 5]`, `pointRadius: 0` (aparece apenas no hover).

### 3.3. Tooltip Flutuante em Liquid Glass
- Desativar o tooltip preto padrão do canvas (`tooltip.enabled: false`) e usar um tooltip HTML externo com a classe `.liquid-glass-floating` (`pointer-events-none transition-all duration-150`), exibindo:
  - Data e hora da sessão;
  - Score de PB, Valor da Catraca e Média Móvel (3s) alinhados em `JetBrains Mono tabular-nums`;
  - Sensibilidade (`cm/360`) daquela sessão;
  - Badge indicando se naquela sessão a **Catraca Subiu (`+X pts`)** ou se o **Platô Foi Protegido**.

---

## 4. Verificação no Antigravity (Gemini 3.8)
- [ ] O seletor de período do gráfico exibe exatamente **`7D` | `30D` | `Tudo`** e filtra pelas datas reais das sessões preservando o cálculo acumulado da catraca.
- [ ] O gráfico possui margens superiores e inferiores confortáveis (`grace: '15%'`), zero grade vertical, degraus nítidos na Catraca e visual translúcido integrado ao Liquid Glass.
