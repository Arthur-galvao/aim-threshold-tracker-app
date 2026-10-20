# UI Remake Spec ("Aurora Glass")

Remake total da UI. Estetica: glassmorphism iOS majoritario, dark only, clean. Backup da UI antiga: branch `backup/ui-pre-remake` (consulte com `git show backup/ui-pre-remake:src/components/...` APENAS para descobrir props/hooks/funcionalidades que a nova UI deve cobrir; NAO copie o visual).

## Regras duras
- Shell comeca em C:\Users\Arthur: use caminhos absolutos. Projeto: C:\Users\Arthur\Documents\IA_workspace\programacao\aim-threshold-tracker-app
- NAO tocar: src/hooks/*, src/lib/* (exceto adicionar chaves em i18n.tsx, bilingue pt/en), src/context/*, src-tauri/*. Logica e props dos hooks sao fonte da verdade.
- ZERO emojis. Icones: @phosphor-icons/react, weight "regular" (ativo: "fill"), tamanho 16/18/20.
- Todo texto visivel via i18n (`useI18n()` de src/lib/i18n.tsx). Reaproveite chaves existentes; adicione novas nos dois idiomas.
- Cores SO por tokens tailwind: bg-base, bg-surface, text-text-main/secondary/faint, border-edge, text-score, text-emerald, text-amber, text-red, bg-*-soft. Proibido slate-*/gray-*/hex/rgb literais (graficos SVG/canvas: var(--score) etc).
- Opacidade em tokens: NAO usar `border-edge/50`, `bg-surface/50` (vars nao suportam). Use as classes abaixo.
- Superficies: `.glass` (tile), `.glass-control` (linha/botao elevado, ja tem hover/press), `.glass-float` (dialogs, popovers, dock, tooltip), `.glass-inset`, `.field` (input/select/textarea). Utilitarios: `.press`, `.lift`, `.enter` (+ style `--i`), `.view-enter`, `.tabular`, `.scroll-y`, animation `animate-pop-in`.
- Vidro e funcional: NUNCA glass dentro de glass (sem tiles aninhados; dentro de um tile use divisores `border-t border-edge` ou `.glass-inset` para areas rebaixadas).
- Numeros: `font-mono tabular`. Sem texto gradiente, sem eyebrows/kickers, sem numeracao de secoes, sem border-left colorido.
- Motion: so transform/opacity/filter, ease-out exponencial ou spring (`ease-spring`/`ease-out`), sem loops continuos de GPU (excecao: pulse-ring do watcher ativo). Respeitar reduced-motion (ja global).
- Acessibilidade: foco visivel (global), aria-label em icon buttons, teclado completo, alvo >= 32px, Base UI (`@base-ui/react`) para Dialog/Tabs/Switch/Slider/Tooltip/Select quando util.
- Estrutura: `src/components/ui/*` primitivas; `src/components/shell/*`; `src/components/views/<view>/*`; `src/components/dialogs/*`. Arquivos < 300 linhas; extraia subcomponentes.
- Preservar comentarios existentes fora do escopo. Nao rodar git reset/clean/restore; nao deletar arquivos fora de src/components.

## Layout: "Dock + Stage"
Stage: fundo `Backdrop` estatico (orbs radiais com color-mix de var(--score)/var(--emerald) sobre var(--base), sem animacao), fixo atras de tudo.

```
+--------------------------------------------------------+
| [dock]   | TopBar: ScenarioSwitcher (popover)   [+ Sessao] [watcher orb] |
|  logo    |--------------------------------------------------------|
|  Dash    |  View (bento grid, scroll interno .scroll-y)           |
|  Rand    |                                                        |
|  Playlst |                                                        |
|  ---     |                                                        |
|  Config  |                                                        |
+--------------------------------------------------------+
```
- Dock: coluna vertical flutuante (`.glass-float`, left 16px, centralizada verticalmente, raio 28px), so icones 44px; pill ativo desliza (translateY com spring) entre itens; tooltip a direita com o nome; atalhos 1/2/3 (teclado). Settings no fim. Em largura < 768px vira barra inferior horizontal.
- TopBar (flutuante, sem fundo proprio, alinhada ao conteudo): ScenarioSwitcher = botao `.glass-control` mostrando cenario ativo (nome + categoria); abre popover `.glass-float` com busca (`.field`), chips de categoria, lista de cenarios (cada um: nome, PB mono, mini tendencia), criar cenario. Botao primario "Registrar sessao" abre SessionSheet. WatcherOrb: bolinha emerald com pulse-ring quando ativo, clique alterna watcher, tooltip com status.
- Transicao entre views: `.view-enter` + key da view.
- Views usam grid bento 12 colunas (`grid grid-cols-12 gap-4`), tiles `.glass` com padding 20px, titulo do tile 13px/600 text-secondary (sem eyebrow).

## Views (cobrir TODA a funcionalidade das telas antigas)
1. Dashboard: KPI strip (ameaca de threshold atual, meta do dia, PB, consistencia %, streak/hit rate quando houver; NumberTicker animado ao mudar; badge de ratchet: subiu/mantido/inicial), grafico principal de progresso com filtro 7D/30D/Tudo e curva de catraca em degraus (threshold em emerald, PB em score, MA3 tracejada), historico de sessoes agrupado por dia (excluir sessao com confirmacao inline), playlist runner compacto, telemetria/analytics de catraca. Estado vazio acolhedor com CTA.
2. Randomizer: controles (faixas de sens, rede logaritmica, aplicar no RawAccel), cobertura (SensCoverageBar), grafico de sweet spot, analytics estatisticos, cards por categoria.
3. Playlist: runner sequencial (passo atual grande, avancar/pular, progresso), editor/gerenciador de playlists (dialog), auto-detect.
Dialogs/Sheets: SessionSheet (runs, sens cm/360, simulacao ao vivo da catraca via meta.simulatedOutcome), SettingsDialog (grupos estilo iOS Settings: KovaaK's path + status, RawAccel, automacao, dados import/export, idioma), NewScenarioDialog, PlaylistManagerDialog, AimLab sync dialog, Toast/TelemetryToast (glass pequeno, desliza por cima).

## Entrega por fase (cada fase termina com `npx tsc --noEmit` limpo; builds quebrados nao sao entregues)
F1 primitivas (ui/*) | F2 shell + App.tsx + main.tsx | F3 Dashboard | F4 Randomizer | F5 Playlist + dialogs | F6 testes.
