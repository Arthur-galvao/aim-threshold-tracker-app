# Plano 01: Background Atmosférico (Clean Frutiger Aero + Apple Liquid Glass)

## 1. Diagnóstico do Problema Atual
- O fundo anterior utilizava apenas uma grade simples de pontos (`radial-gradient` de bolinhas de 1px sobre fundo chapado), deixando a interface árida e sem profundidade óptica real para que o `backdrop-filter` do Glassmorphism funcione de verdade.
- **Princípio Óptico do Liquid Glass:** Vidro translúcido só parece vidro líquido quando existe variação de luz, cor e refração atrás dele. Sobre um fundo escuro uniforme com pontinhos, qualquer painel com `backdrop-blur` parece apenas cinza opaco.

---

## 2. Direção Estética: Clean Frutiger Aero + Apple Liquid Glass
A estética combina a limpidez luminosa e aquática do **Frutiger Aero** (gradientes oceânicos/auroras suaves em ciano-água, verde-esmeralda bioluminescente, azul-safira profundo e feixes de luz zenital) com a física óptica do **Liquid Glass da Apple (macOS Tahoe / iOS 26)** (refração de borda especular, saturação elevada no desfoque e contraste cristalino).

### 2.1. O que Remover de `src/index.css` e `src/App.tsx`
1. Remover completamente o padrão de `radial-gradient` de bolinhas (`dot-grid` de `20px x 20px`).
2. Remover qualquer fundo sólido chapado que bloqueie a passagem da iluminação atmosférica para os cards.

---

## 3. Arquitetura das Camadas do Novo Background (`LiquidAeroBackdrop.tsx` + `src/index.css`)

Criar um componente estrutural estático de fundo (`src/components/layout/LiquidAeroBackdrop.tsx`, com `pointer-events-none fixed inset-0 -z-10 overflow-hidden`) composto por 4 camadas puras de CSS/SVG (zero custo de animação em loop na GPU durante o jogo):

### Camada 1: Base Abissal Aero (`--aero- abyss-base`)
- **Tema Escuro (Liquid Obsidian Aero):** Gradiente linear de topo-esquerdo para base-direito indo de `oklch(14% 0.035 235)` (azul-oceano noturno profundo) -> `oklch(12% 0.03 255)` (safira escuro) -> `oklch(13% 0.035 195)` (ciano abissal).
- **Tema Claro (Crystal Daylight Aero):** Gradiente luminoso indo de `oklch(96% 0.025 220)` (azul-gelo cristalino) -> `oklch(98% 0.015 195)` (água-marinha ultra suave) -> `oklch(95% 0.03 240)` (céu aero limpo).

### Camada 2: Orbes de Refração Atmosférica (Aurora / Aquatic Mesh)
Três grandes campos de luz difusa posicionados estrategicamente atrás das regiões principais da tela (para que os cards Bento e o Gráfico refratem essas cores através do vidro):
1. **Orbe Superior Esquerdo (Atrás do CommandBar e Card da Catraca):**
   - `radial-gradient(ellipse 65% 50% at 18% 12%, oklch(72% 0.17 165 / 0.22), transparent 70%)` (Verde-Esmeralda Aero).
2. **Orbe Superior Direito (Atrás do Card de PB e Quick Composer):**
   - `radial-gradient(ellipse 60% 55% at 85% 18%, oklch(75% 0.16 215 / 0.24), transparent 72%)` (Ciano Aquático Frutiger).
3. **Orbe Central-Inferior (Atrás do Palco do Gráfico e Session Ledger):**
   - `radial-gradient(ellipse 75% 50% at 45% 78%, oklch(62% 0.18 250 / 0.18), transparent 75%)` (Azul Safira Profundo).

### Camada 3: Feixes de Luz Zenital e Ondas de Refração (SVG Caustics Limpo)
- Um SVG estático em tela cheia com `opacity: 0.16` (no escuro) / `0.25` (no claro) contendo duas curvas fluidas orgânicas estilo Frutiger Aero (grandes arcos suaves com gradiente linear de branco/ciano translúcido `stop-opacity="0.35"` para `0`), simulando a refração de luz na superfície da água/vidro curvo.

### Camada 4: Película de Difusão Óptica (Micro-Noise de 1.5%)
- Uma textura sutil de dithering (`opacity: 0.015`) para evitar *color banding* nos gradientes suaves em monitores IPS de 240Hz.

---

## 4. Verificação no Antigravity (Gemini 3.8)
- [ ] Nenhum padrão de bolinhas (`dot-grid`) resta no CSS ou nos componentes.
- [ ] Ao mover ou rolar qualquer painel translúcido sobre o fundo, observa-se a refração suave das luzes ciano, esmeralda e azul-oceano através do vidro (`backdrop-filter: blur(24px) saturate(180%)`).
- [ ] O background é 100% estático na GPU (0% de consumo em segundo plano com o KovaaK's aberto).
