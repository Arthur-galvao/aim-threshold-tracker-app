# Plano 03: Correção de Espaçamento, Ritmo Espacial e Cards Bento

## 1. Diagnóstico do Problema Atual
- Os cards e painéis ficaram com espaçamento comprimido ou irregular: falta respiro (*breathing room*) entre as bordas da janela Tauri e os containers, o `gap` entre os 4 cards de métricas e o palco principal está apertado, e o conteúdo interno dos cards fica próximo demais das bordas de vidro.
- Na estética **Apple Liquid Glass**, o espaço negativo (onde o background Frutiger Aero respira entre os blocos de vidro) é essencial para destacar a refração das bordas e dar leitura imediata aos números.

---

## 2. Sistema Estrito de Grid e Espaçamento (`8px Spatial Grid`)

Aplicar rigorosamente esta escala espacial em `src/App.tsx` e em todos os componentes filhos:

| Região / Elemento | Classe Tailwind / Medida Exata | Regra de Layout |
| :--- | :--- | :--- |
| **Padding Externo da Janela (`WorkspaceShell`)** | `p-6 lg:p-7` (`24px` a `28px`) | Margem de respiro uniforme ao redor de toda a interface para exibir a refração do background nas bordas externas. |
| **Container Principal (`max-w-[1680px] mx-auto`)** | `flex flex-col gap-6` (`24px` verticais) | Distância vertical exata de `24px` entre: (1) `CommandBar`, (2) `TelemetryBento`, (3) Palco Central (`Chart` + `Composer`) e (4) `SessionLedger`. |
| **Grid dos 4 Cards (`TelemetryBento`)** | `grid grid-cols-12 gap-5 lg:gap-6` (`20px` a `24px`) | Colunas: Card 1 (`Meta do Dia`) = `col-span-12 lg:col-span-4`; Card 2 (`PB`) = `col-span-12 sm:col-span-4 lg:col-span-3`; Card 3 (`Consistência`) = `col-span-12 sm:col-span-4 lg:col-span-3`; Card 4 (`Setup cm/360`) = `col-span-12 sm:col-span-4 lg:col-span-2`. |
| **Padding Interno dos Cards Bento** | `p-6` (`24px` em todos os lados) e `min-h-[148px]` | Layout interno `flex flex-col justify-between gap-3`. Nenhum texto ou badge pode ficar a menos de `24px` da borda do card. |
| **Grid do Palco Central (`Chart` + `Composer`)** | `grid grid-cols-12 gap-6 items-stretch` (`24px`) | Gráfico (`RatchetAnalyticsStage`) = `col-span-12 xl:col-span-8`; Formulário Rápido (`SessionQuickComposer`) = `col-span-12 xl:col-span-4`. Ambos com mesma altura (`min-h-[440px]`) e `p-6` (`24px`) de padding interno. |
| **Painel de Histórico (`SessionLedger`)** | `p-6` (`24px`) com células `px-4 py-3.5` | Espaçamento horizontal generoso entre colunas da tabela e `gap-2` entre os chips de runs expandidas. |

---

## 3. Hierarquia Interna dos 4 Cards Bento (Zero Sobreposição)

Dentro de cada um dos 4 cards do `TelemetryBento`, padronizar 3 faixas verticais bem separadas:
1. **Linha de Topo (Header do Card):** `flex items-center justify-between gap-2` contendo o título em caixa alta (`text-[11px] font-semibold tracking-[0.08em] uppercase text-white/65`) à esquerda e a pílula de status (`px-2.5 py-0.5 rounded-full text-[11px] font-mono`) à direita, com `whitespace-nowrap` para nunca quebrar linha.
2. **Linha Central (Valor Principal):** Número principal em `JetBrains Mono` (`text-3xl lg:text-[34px] font-bold tracking-tight tabular-nums leading-none my-2`) acompanhado da unidade (`pts`, `%`, `cm/360`) em `text-sm font-normal text-white/50 ml-1.5`.
3. **Linha de Base (Sub-métrica + Barra de Progresso Liquid Glass):** Barra `Progress.Root` de `h-2 rounded-full` (quando aplicável) com `mb-2.5` acima do rodapé `flex items-center justify-between text-xs text-white/60`.

---

## 4. Verificação no Antigravity (Gemini 3.8)
- [ ] Todos os 4 cards da fileira `TelemetryBento` possuem exatamente a mesma altura renderizada e distam `24px` (`gap-6`) entre si e em relação às seções vizinhas.
- [ ] Nenhum badge, número ou rótulo encosta nas bordas do card ou sobrepõe outro texto em janelas de `1280px` a `2560px`.
