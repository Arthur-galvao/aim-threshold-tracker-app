# Aim Threshold Tracker

[English](README.md) | [Português (Brasil)](README.pt-BR.md)

[![Download](https://img.shields.io/github/v/release/Arthur-galvao/aim-threshold-tracker-app?label=download&style=for-the-badge)](https://github.com/Arthur-galvao/aim-threshold-tracker-app/releases/latest)

Aplicativo desktop para rastrear thresholds de mira no KovaaK's e Aim Lab, seguindo a metodologia do benchmark Viscose e do padrão Escalate, com interface v2.0 Liquid Glass HUD, fundo interativo de nebulosa espacial 3D, randomização controlada de sensibilidade e análise estatística Bayesiana de Sweet Spot.

## Download

**[Baixar instalador (.exe)](https://github.com/Arthur-galvao/aim-threshold-tracker-app/releases/latest)**

Disponível para Windows. Não requer privilégios de administrador para instalação.

## Principais Funcionalidades

### v2.0 Liquid Glass HUD e Nebulosa Espacial Interativa
- **Hierarquia Óptica em 3 Camadas:** Lentes translúcidas de cristal fumê (`.liquid-surface`), cavidades ópticas rebaixadas (`.liquid-well`) e cápsulas espaciais flutuantes (`.liquid-float` / `.liquid-pill`) com reflexo especular guiado pelo cursor.
- **Nebulosa 3D de Poeira Cósmica Interativa:** Renderização em tempo real a 60fps com 1.900 micro-grãos estelares e nuvens volumétricas que reagem com vórtice e paralaxe ao movimento do mouse, pausando automaticamente a GPU quando o app está em segundo plano durante o jogo.
- **Paletas de Tema Sincronizadas:** Quatro temas dinâmicos (`Cyber Lab`, `Tactical Emerald`, `Amethyst Purple` e `Obsidian Amber`) que sincronizam os acentos de vidro e a nebulosa espacial.
- **Microinterações Táteis:** Deslizadores com física de mola, contadores numéricos exponenciais, simulador de catraca em tempo real e acordeão fluido no histórico de sessões.

### Rastreamento de Thresholds e Métricas
- **Watcher em Tempo Real:** Detecta automaticamente a pasta de estatísticas do KovaaK's (via Steam) e processa novas partidas em tempo real a partir dos arquivos CSV.
- **Catraca Dinâmica de Threshold:** Evolução sistemática sem regressão (`max(thresholdAnterior, candidato)`) baseada no histórico de desempenho individual, acompanhando Taxa de Sucesso (Hit Rate) e Sequência (Streak).
- **Normalização de Scores:** Comparação justa entre cenários com pontuações distintas utilizando porcentagem relativa ao Personal Best (% do PB).
- **Formatação Escalate:** Exportação com um clique do histórico de sessão formatado para compartilhamento com a comunidade.
- **Privacidade Local:** Todos os dados são armazenados localmente no computador via SQLite/JSON, sem envio de informações para servidores externos.

### Randomizador de Sensibilidade e Análise de Sweet Spot
- **Gerenciamento Seguro do Driver Raw Accel:** Detecção automática do diretório do Raw Accel, preservando o Output DPI nativo e ajustando unicamente o parâmetro de escala (`scale`). Inclui backup automático do arquivo de configuração na inicialização e restauração íntegra ao encerrar o app.
- **Grade Exponencial Logarítmica:** Amostragem em pontos discretos ancorados em 50 cm com razão de passo 1.05 (`50 * 1.05^k`), sorteados por saco embaralhado sem reposição e com espaçamento mínimo entre jogadas sucessivas.
- **Preditor Estatístico de Sweet Spot:** Combinação de regressão quadrática paramétrica em espaço logarítmico e suavização por kernel com intervalos de confiança por bootstrap (IC 90%) e blend Bayesiano hierárquico por categorias de cenários.
- **Perfis de Predição e Sugestão de Recentralização:** 4 perfis estatísticos (Equilibrado, Neutro, Teórico, Consistência) salvos nas configurações, detecção automática de desvios e sugestão de recentralização sem alterar o `baseSensCm`.
- **Visualização Gráfica Avançada:** Gráfico com eixo logarítmico, curvas de tendência quadrática e suavizada, marcadores de limites de faixa ativa, intervalo de confiança do ápice e barra de cobertura de amostragem por ponto de grade.

## Contribuindo

Para executar o projeto localmente ou enviar melhorias, consulte o arquivo [CONTRIBUTING.md](./CONTRIBUTING.pt-BR.md) (also available in [English](./CONTRIBUTING.md)).

## Licença

Distribuído sob a licença MIT. Consulte o arquivo [LICENSE](./LICENSE) para mais informações.
