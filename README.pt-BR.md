# Aim Threshold Tracker

[English](README.md) | [Português (Brasil)](README.pt-BR.md)

[![Download](https://img.shields.io/github/v/release/Arthur-galvao/aim-threshold-tracker-app?label=download&style=for-the-badge)](https://github.com/Arthur-galvao/aim-threshold-tracker-app/releases/latest)

Aplicativo desktop para rastrear thresholds de mira no KovaaK's, seguindo a metodologia do benchmark Viscose e do padrão Escalate, com suporte a randomização controlada de sensibilidade e análise estatística de Sweet Spot.

## Download

**[Baixar instalador (.exe)](https://github.com/Arthur-galvao/aim-threshold-tracker-app/releases/latest)**

Disponível para Windows. Não requer privilégios de administrador para instalação.

## Principais Funcionalidades

### Rastreamento de Thresholds e Métricas
- **Watcher em Tempo Real:** Detecta automaticamente a pasta de estatísticas do KovaaK's (via Steam) e processa novas partidas em tempo real a partir dos arquivos CSV.
- **Cálculo Dinâmico de Threshold:** Evolução sistemática de metas de pontuação baseadas no histórico de desempenho individual.
- **Normalização de Scores:** Comparação justa entre cenários com pontuações distintas utilizando porcentagem relativa ao Personal Best (% do PB).
- **Formatação Escalate:** Exportação com um clique do histórico de sessão formatado para compartilhamento com a comunidade.
- **Privacidade Local:** Todos os dados são armazenados localmente no computador via SQLite/JSON, sem envio de informações para servidores externos.

### Randomizador de Sensibilidade e Análise de Sweet Spot
- **Integração com Raw Accel:** Detecção automática do driver Raw Accel e aplicação transparente de multiplicadores de sensibilidade no arquivo de configuração.
- **Modos de Operação:** Suporte a faixas configuráveis por sensibilidade física absoluta (cm/360) ou por multiplicador relativo, com opção para evitar repetições imediatas.
- **Identificação de Sweet Spot:** Agrupamento em faixas com encolhimento Bayesiano empírico para evitar conclusões precipitadas com amostras pequenas, calculando a consistência motora e indicando o nível de confiança estatística (Alta, Média, Baixa ou Amostra Preliminar).
- **Visualização Gráfica:** Gráfico de dispersão relacionando sensibilidade física e pontuação, acompanhado de curva de tendência quadrática ajustada por mínimos quadrados.

## Contribuindo

Para executar o projeto localmente ou enviar melhorias, consulte o arquivo [CONTRIBUTING.md](./CONTRIBUTING.pt-BR.md) (also available in [English](./CONTRIBUTING.md)).

## Licença

Distribuído sob a licença MIT. Consulte o arquivo [LICENSE](./LICENSE) para mais informações.
