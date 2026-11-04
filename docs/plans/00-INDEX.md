# Planos de implementação — Aim Threshold Tracker v3

Fonte: `2026-11-04-revisao-geral.md` (itens REV-1..36) + pesquisa de metodologia (Voltaic, Viscose, Aimlabs, literatura motora) + decisões do Arthur:
- Threshold **não** pode só subir → substituído por meta móvel calibrada (Plano 04).
- **Randomizer fica e continua central no treino** (anti-piloto-automático, adaptação real, grupos musculares diferentes). Ganha modos novos e deixa de poluir a meta (Plano 05).
- **Preditor de sens vira "Laboratório (experimental)"**: sugestões direcionais de sens por jogo com base no histórico. É guia, não regra. Não define mais o centro do randomizer por padrão (Plano 06).

## Planos

| # | Arquivo | Escopo | Depende de |
|---|---|---|---|
| 01 | `01-integridade-dados.md` | Escrita atômica, arquivo corrompido, backups, serde default, single-instance, CSP, opener | — |
| 02 | `02-fonte-unica-de-dados.md` | Rust vira dono do `AppData`; front só lê + chama comandos; fim dos lost updates | 01 |
| 03 | `03-schema-v2-e-importador.md` | Run completa (datetime, accuracy, TTK...), schemaVersion, ledger de sens, catch-up import, para de reescrever CSV | 02 |
| 04 | `04-threshold-v2.md` | Meta EWMA robusta + σ por cenário, runs válidas, aquecimento, platô, hit rate | 03 |
| 05 | `05-randomizer-v2.md` | Modos (Centro / Direcionado / Exploração), âncoras na sens base, blocos, saco persistente, cache RawAccel | 03 (04 para integração da âncora) |
| 06 | `06-laboratorio-sens.md` | Preditor experimental de sens por jogo | 04, 05 |
| 07 | `07-fluxo-de-treino.md` | Sessão, resumo pós-sessão, fadiga, passos medição/treino, cue de intenção, foco 1-toque | 04, 05 |
| 08 | `08-performance-e-limpeza.md` | Perf, i18n, código morto, CI, bundle, backdrop | pode correr em paralelo a partir da Onda 2 |

## Ondas de execução (swarm)

```
Onda 1: 01 (todas as tarefas)                         + 08-A (vite/CI/código morto, só arquivos isolados)
Onda 2: 02 (núcleo sequencial, MODELO FORTE)          
Onda 3: 03                                            + 08-B
Onda 4: 04-núcleo (MODELO FORTE) ∥ 05-Rust (MODELO FORTE)
Onda 5: 04-UI ∥ 05-UI ∥ 06 ∥ 07                       + 08-C
Onda 6: integração i18n final, testes de regressão, checklist de aceite global
```
Não comece uma onda antes da anterior estar **verde** (ver "Definição de pronto").

### Contratos por onda (um único agente, executado ANTES das tarefas folha da onda)
| Onda | Tarefas de contrato (mesmo agente, nesta ordem) |
|---|---|
| 1 | T1.4 (model.rs) |
| 2 | T2.1 |
| 3 | T3.1 |
| 4 | T5.1 → parte de contrato do T4.6 (`AppSettings.training` em model.rs/types.ts) |
| 5 | T7.1 (inclui também `AppSettings.lab: { gameId, inGameSens }` do Plano 06) |

### Filas sequenciais na Onda 5 (mesmo arquivo, tarefas diferentes — executar nesta ordem, nunca em paralelo)
- `src/App.tsx`: T6.4 → T7.2 → T8.9
- `src/hooks/usePlaylistRunner.ts`: T4.8h → T7.5 → T7.6
- `src/components/views/playlist/ActiveRunnerStep.tsx`: T7.6 → T7.7
- `src/components/views/playlist/StepSensCard.tsx`: T5.7e → T7.7
- `src/components/shell/TopBar.tsx`: T5.7e → T7.2 (badge de resumo)
- `src/components/views/dashboard/index.tsx`: T4.8c → T7.3
- `src/hooks/useLiveSession.ts`: T7.2 → T7.4
- `src/components/dialogs/SettingsDialog.tsx`: T4.6 (Onda 4, só montar `SettingsTrainingSection`) — nenhuma outra tarefa edita
Todo o resto da Onda 5 pode rodar em paralelo.

## Regras do swarm (OBRIGATÓRIO para todo agente)

1. **Um agente = uma tarefa** (`Tn.m`). Leia o plano inteiro da tarefa antes de editar.
2. **Propriedade de arquivos.** Cada tarefa lista os arquivos que pode editar (`Arquivos:`). Editar arquivo fora da lista = proibido. Se precisar, pare e reporte ao orquestrador.
3. **Arquivos compartilhados têm dono único por onda** (tarefa "Contrato" ou "Integração" daquela onda):
   - `src-tauri/src/model.rs`, `src-tauri/src/lib.rs` (lista do `invoke_handler`), `src/lib/types.ts`, `src/lib/tauri-bridge.ts`, `src/lib/i18n.tsx`.
   - Tarefas folha que precisam de chave de i18n **não editam `i18n.tsx`**: criam `docs/plans/i18n-pending/<ID-da-tarefa>.json` no formato `{ "pt": { "chave": "texto" }, "en": { "chave": "text" } }`. A tarefa de Integração da onda faz o merge e apaga os pendentes.
   - Durante o desenvolvimento, a tarefa folha pode usar `t("chave") || "fallback"` só até a integração; a Integração remove os fallbacks.
4. **Branch por plano**: `feat/plan-0N-<slug>`. Commits pequenos, mensagem `tipo(escopo): resumo [Tn.m]`.
5. **Nada destrutivo sem confirmação do usuário** (regra do `GEMINI.md`): `rm`, `git reset --hard`, `git clean`, apagar dados do usuário, rodar o app contra a pasta real do KovaaK's em modo escrita.
6. **Nunca escrever em arquivos do jogo** (pasta stats do KovaaK's, DB do Aim Lab). Leitura apenas. Para fixtures, **copie** 3–5 CSVs reais da pasta stats configurada para `test/fixtures/kovaak/` (anonimizar não é necessário).
7. **Dados do usuário**: antes de rodar qualquer migração localmente, faça backup de `%APPDATA%/com.aimthreshold.app/` (copiar, não mover).
8. **Sem dependência nova** além das listadas no plano.
9. Funções novas de lógica (estatística, parsing, sorteio) são **puras** e testadas. UI não contém fórmula.

## Definição de pronto (toda tarefa)
- `npx tsc -b` sem erro.
- `npm test` verde (incluindo testes novos da tarefa).
- `cd src-tauri && cargo test` verde e `cargo clippy -- -D warnings` sem warning novo.
- Critérios de aceite da tarefa marcados no PR/descrição.
- Nenhum texto visível hardcoded (usar i18n PT e EN).

## Marcação de complexidade
- **[HAIKU]**: tarefa folha, arquivo(s) isolado(s), especificação fechada.
- **[FORTE]**: Sonnet/Opus recomendado. Concorrência, refator transversal ou núcleo estatístico. Haiku aqui tende a gerar bug sutil que os testes não pegam.

## Glossário
- **Run**: uma execução de cenário (um CSV do KovaaK's / um replay do Aim Lab). No código: `Session` (nome legado, mantido).
- **Sessão de treino**: bloco de runs com intervalo ≤ 45 min entre runs consecutivas (qualquer cenário). Substitui "dia" como unidade de agrupamento.
- **Run válida**: run que alimenta a meta (ver Plano 04 §2).
- **Âncora**: run forçada na sens base dentro de um bloco randomizado (Plano 05).
- **μ, σ**: habilidade estimada e dispersão por cenário, em log(score).
- **cm/360**: maior = mais lenta. "Sens rápida" = cm/360 **menor**.

## Prompt sugerido para o orquestrador (Claude Code)
> Você é o orquestrador. Leia `docs/plans/00-INDEX.md` e o plano da onda atual. Para cada onda: (1) execute você mesmo as tarefas de contrato da tabela "Contratos por onda"; (2) dispare um subagente por tarefa folha: **[HAIKU] → Haiku 5.5**, **[FORTE] → Sonnet/Opus**; (3) respeite as "Filas sequenciais"; (4) passe a cada subagente apenas: o texto da tarefa, a lista `Arquivos:` permitida, as "Regras do swarm" e a "Definição de pronto"; (5) depois que todos terminarem, rode a tarefa de Integração da onda, `npx tsc -b`, `npm test`, `cargo test` e `cargo clippy`; (6) só avance com tudo verde. Se um subagente precisar editar arquivo fora da lista dele, ele para e reporta, e você decide. Nunca rode comandos destrutivos sem confirmar comigo.

## Fontes da metodologia
- Voltaic: Advice FAQ e Benchmarks Guide (benchmark mede, rotina melhora; 1×/semana; 5–10 runs); anúncio do S5 (dez/2024).
- Viscose: "Muscle memory is a myth (kinda)" (Raw Input, 30/01/2024); "The new best way to train your aim" (Raw Input, 29/10/2025).
- Aimlabs: "Why changing your sensitivity can actually help you train" (08/04/2026).
- Wymbs, Bastian & Celnik, Current Biology 26:338–343 (2016): reconsolidação, prática modificada.
- Czyż et al., Scientific Reports 14:15974 (2024); Ammar et al., Educational Psychology Review (2024): interferência contextual.
- Boudaoud, Spjut & Kim (NVIDIA), IEEE CoG 2022 / IEEE Transactions on Games 15(4) (2023): faixa ótima de sens 20–80 cm/360.
- Ajemian et al., J Motor Behavior (2010); "Long-Term Motor Learning in the 'Wild' With High Volume Video Game Data" (Frontiers in Human Neuroscience): aquecimento.
- Cepeda et al. (2006): efeito de espaçamento.
- robinwobin: conteúdo não localizado na pesquisa; incorporar quando o link estiver disponível.
