# Especificação do Design System: Tactical Glassmorphism HUD

## 1. Evolução do `src/index.css` (Da `v1.9` para `v2.0`)

Na versão `v1.9`, o `src/index.css` introduziu variáveis de tema claro/escuro e classes utilitárias como `.panel` e `.minimal-input` com as fontes `Inter` e `JetBrains Mono`. Na `v2.0`, essa base será expandida para um sistema óptico de **Glassmorphism de Precisão** em 3 níveis de elevação, preservando a alternância Dark/Light (com Dark Obsidian como padrão tático).

---

## 2. Hierarquia Óptica em 3 Camadas (Tokens de Superfície)

| Token Semântico | Uso na Interface | Especificação no Tema Escuro (Padrão) | Especificação no Tema Claro |
| :--- | :--- | :--- | :--- |
| `--surface-canvas` | Fundo base da janela Tauri | `oklch(11% 0.015 265)` + grade pontilhada sutil (`radial-gradient` de 1px a cada 20px com opacidade `0.06`) | `oklch(96% 0.008 265)` + grade pontilhada sutil com opacidade `0.08` |
| `--surface-glass-1` | Painéis principais (Bento Cards, Container do Gráfico, Histórico) | Fundo `oklch(17% 0.02 265 / 0.62)`, `backdrop-filter: blur(12px) saturate(140%)` | Fundo `oklch(100% 0 0 / 0.68)`, `backdrop-filter: blur(12px) saturate(140%)` |
| `--surface-glass-2` | Elementos interativos internos (Inputs, Botões secundários, Linhas hover, Tabs) | Fundo `oklch(22% 0.025 265 / 0.55)`, `backdrop-filter: blur(16px)` | Fundo `oklch(98% 0.005 265 / 0.78)`, `backdrop-filter: blur(16px)` |
| `--surface-glass-floating` | Popovers, Modais (`NewTaskModal`), Command Palette (`Ctrl+K`), Toasts | Fundo `oklch(20% 0.03 265 / 0.82)`, `backdrop-filter: blur(24px) saturate(160%)` | Fundo `oklch(100% 0 0 / 0.88)`, `backdrop-filter: blur(24px) saturate(160%)` |

### 2.1. Bordas Especulares e Sombras (Substituição da classe `.panel`)
Para criar a sensação real de vidro lapidado sem poluição visual:
- **Borda Externa (`--border-glass`):** `1px solid oklch(100% 0 0 / 0.08)` no escuro e `1px solid oklch(15% 0.02 265 / 0.09)` no claro.
- **Reflexo Especular Superior (`--specular-top`):** Sombra interna superior `inset 0 1px 0 0 oklch(100% 0 0 / 0.14)` em todos os cartões `.glass-panel`.
- **Substituição de `.minimal-input` por `.glass-input`:** Mantém a leveza da `v1.9`, mas adiciona fundo `--surface-glass-2`, transição de foco para anel luminoso de `1.5px` na cor de acento e suporte nativo aos atributos de estado da Base UI (`data-[focused]`, `data-[invalid]`, `data-[disabled]`).

---

## 3. Tokens Semânticos de Telemetria e Catraca

Cada estado matemático retornado por `src/utils/threshold.ts` e `src/hooks/useKovaakWatcher.ts` possui uma assinatura cromática exclusiva:

| Token | Significado na Regra de Negócio | Cor (OKLCH) | Onde Aparece |
| :--- | :--- | :--- | :--- |
| `--telemetry-pb` | Recorde Pessoal (Personal Best) | `oklch(76% 0.15 210)` (Ciano Elétrico) | Card de PB, linha superior do gráfico, badge de "Novo PB". |
| `--telemetry-ratchet-up` | Subida de Degrau da Catraca (Meta Batida) | `oklch(74% 0.17 155)` (Esmeralda Tático) | Linha em degraus (Step-Line) do Threshold, badge "Catraca Subiu", barra de progresso concluída. |
| `--telemetry-ratchet-hold` | Platô Protegido (Sessão abaixo da barra, catraca travou queda) | `oklch(78% 0.15 75)` (Âmbar Precisão) | Badge "Platô Mantido" no histórico e no simulador de sessão. |
| `--telemetry-ma3` | Média Móvel (3 Sessões) | `oklch(70% 0.14 285)` (Índigo/Violeta Suave) | Curva tracejada de tendência de curto prazo no gráfico. |
| `--telemetry-watcher` | File Watcher Rust/Tauri Ativo | `oklch(72% 0.18 160)` (Verde Pulso) / `oklch(68% 0.19 25)` (Erro) | Indicador de status da pasta `stats/` no cabeçalho. |

---

## 4. Tipografia e Alinhamento Tabular

- **UI e Rótulos (`--font-sans`):** `Inter`, pesos 400, 500 e 600. Títulos de seção em caixa alta com `letter-spacing: 0.06em` e tamanho `11px` (`text-[11px] uppercase tracking-wider text-muted`).
- **Telemetria e Números (`--font-mono`):** `JetBrains Mono` com `font-variant-numeric: tabular-nums` aplicado globalmente a:
  - Pontuações de runs e médias de sessão;
  - Valores de Threshold e Meta do Dia;
  - Sensibilidade (`cm/360`) e FOV;
  - Porcentagem de Consistência (Ratio %);
  - Timestamps e contadores de runs.

---

## 5. Orçamento de Performance e Guarda de GPU para Jogos

Como o usuário mantém o **Aim Threshold Tracker** aberto enquanto treina no KovaaK's:
1. **Zero Blur Dinâmico em Loop:** O `backdrop-filter` só é aplicado em containers estáticos no layout. Nenhuma animação deve alterar o raio de `blur()` continuamente a cada frame.
2. **Guarda de Visibilidade (`useWindowActivityGuard`):** Quando a janela do Tauri está minimizada ou sem foco (`document.hidden` ou evento `tauri://blur`), uma classe `.app-backgrounded` é aplicada ao `document.documentElement`, desativando transições de `motion/react` e efeitos de hover até que o usuário volte para a janela.
