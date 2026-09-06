# Aim Threshold Tracker

[![Download](https://img.shields.io/github/v/release/Arthur-galvao/aim-threshold-tracker-app?label=download&style=for-the-badge)](https://github.com/Arthur-galvao/aim-threshold-tracker-app/releases/latest)

Aplicativo desktop para rastrear thresholds de mira no KovaaK's, seguindo a metodologia do benchmark Viscose e do padrao Escalate, com suporte a randomizacao controlada de sensibilidade e analise estatistica de Sweet Spot.

## Download

**[Baixar instalador (.exe)](https://github.com/Arthur-galvao/aim-threshold-tracker-app/releases/latest)**

Disponivel para Windows. Nao requer privilegios de administrador para instalacao.

## Principais Funcionalidades

### Rastreamento de Thresholds e Metricas
- **Watcher em Tempo Real:** Detecta automaticamente a pasta de estatisticas do KovaaK's (via Steam) e processa novas partidas em tempo real a partir dos arquivos CSV.
- **Calculo Dinamico de Threshold:** Evolucao sistematica de metas de pontuacao baseadas no historico de desempenho individual.
- **Normalizacao de Scores:** Comparacao justa entre cenarios com pontuacoes distintas utilizando porcentagem relativa ao Personal Best (% do PB).
- **Formatacao Escalate:** Exportacao com um clique do historico de sessao formatado para compartilhamento com a comunidade.
- **Privacidade Local:** Todos os dados sao armazenados localmente no computador via SQLite/JSON, sem envio de informacoes para servidores externos.

### Randomizador de Sensibilidade e Analise de Sweet Spot
- **Integracao com Raw Accel:** Deteccao automatica do driver Raw Accel e aplicacao transparente de multiplicadores de sensibilidade no arquivo de configuracao.
- **Modos de Operacao:** Suporte a faixas configuraveis por sensibilidade fisica absoluta (cm/360) ou por multiplicador relativo, com opcao para evitar repeticoes imediatas.
- **Identificacao de Sweet Spot:** Agrupamento em faixas com encolhimento Bayesiano empirico para evitar conclusoes precipitadas com amostras pequenas, calculando a consistencia motora e indicando o nivel de confianca estatistica (Alta, Media, Baixa ou Amostra Preliminar).
- **Visualizacao Grafica:** Grafico de dispersao relacionando sensibilidade fisica e pontuacao, acompanhado de curva de tendencia quadratica ajustada por minimos quadrados.

## Contribuindo

Para executar o projeto localmente ou enviar melhorias, consulte o arquivo [CONTRIBUTING.md](./CONTRIBUTING.md).

## Licenca

Distribuido sob a licenca MIT. Consulte o arquivo [LICENSE](./LICENSE) para mais informacoes.
