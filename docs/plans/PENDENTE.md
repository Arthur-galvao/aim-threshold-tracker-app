# O que falta — estado em 05/11/2026

## Concluído (branches `feat/onda-1..3`, PRs #1 → #2 → #3, CI Windows verde)
- Plano 01 inteiro (integridade de dados, segurança, single-instance).
- Plano 02 inteiro (Rust como fonte única de dados).
- Plano 03 inteiro (schema v2, parser, ledger de sens, catch-up, migração v1→v2).
- Plano 08: T8.1, T8.2, T8.3, T8.5, T8.6, T8.7, T8.8.
- Fix de UI: dropdown de playlists ilegível + tooltip do gráfico vazando/quebrando.

## Planos ainda NÃO executados
| Plano | Arquivo | Conteúdo | Ondas |
|---|---|---|---|
| 04 | `04-threshold-v2.md` | Meta móvel (EWMA robusta + σ por cenário), runs válidas, aquecimento, ajuste por sens, platô, hit rate. Substitui o ratchet que só sobe | 4–5 |
| 05 | `05-randomizer-v2.md` | Modos Centro / Direcionado (Viscose) / Rodízio muscular / Exploração, reativação e âncoras na sens base, saco persistente, cache do RawAccel, cue de grupo muscular | 4–5 |
| 06 | `06-laboratorio-sens.md` | Preditor vira "Laboratório (experimental)": faixas de sens por jogo, só direcional | 5 |
| 07 | `07-fluxo-de-treino.md` | Sessão ao vivo + resumo, curva intrassessão, fadiga, passos de medição, teto no "bater a meta", cue de intenção, foco 1-toque, qualidade (accuracy/TTK), fraquezas v2 | 5 |
| 08 (resto) | `08-performance-e-limpeza.md` | T8.4 (mover arquivos da raiz — só no seu PC), T8.9 (code splitting), T8.10 (backdrop a 30 fps), T8.11 (worker, só se medir lento) | 1 / 5 |

Ordem e regras do swarm: `00-INDEX.md` (seções "Ondas", "Contratos por onda", "Filas sequenciais").

## Pendências que dependem de você
1. **Tag da beta** — o ambiente do Claude não pode dar push de tag (HTTP 403). No seu PC:
   ```
   git fetch origin feat/onda-3
   git tag -a v3.0.0-beta.1 origin/feat/onda-3 -m "3.0.0-beta.1 — ondas 1–3"
   git push origin v3.0.0-beta.1
   ```
   Isso gera o instalador como **pré-release**. Se o build falhar por causa do formato de versão `3.0.0-beta.1` no NSIS, trocar por versão numérica (ex.: 2.9.0).
2. **Backup** de `%APPDATA%\com.aimthreshold.app\` antes de abrir a beta (a migração v1→v2 também cria `backups/pre-migration-v2-*.json`).
3. **Teste manual** — roteiro em cada PR. Principais: 3 runs seguidas → 3 registros e 1 notificação por run; CSV da pasta `stats` não muda após a run; runs jogadas com o app fechado aparecem ao abrir.
4. **Fixtures reais**: copiar 2–3 CSVs da pasta `stats` para `test/fixtures/kovaak/` (os atuais são sintéticos).
5. **T8.4**: mover PNGs/scripts soltos da raiz (estão no `.gitignore`, só existem no seu PC).
6. Apagar `.git/stale-maintenance-lock-claude` na pasta local (sobra inofensiva).
7. Merge dos PRs na ordem #1 → #2 → #3 depois do teste.

## Pontas soltas conhecidas (pequenas; entram nas próximas ondas)
- Aviso "feche a interface do RawAccel" existe no backend (`rawaccel_gui_running`) mas nunca foi exibido na UI → Plano 05 (T5.7e).
- `SettingsRawaccelSection.handleTest` não captura erro do teste do RawAccel (rejeição não tratada, já existia) e o texto de sucesso do teste ainda vem em PT do Rust.
- `sync_aimlab_sqlite` usa o cache de nomes do Aim Lab mas não refaz o mapa quando um nome não é encontrado (o watcher e o import CSV fazem).
- Backfill da migração em background (só quando > 500 CSVs): se o app fechar no meio, não é retomado.
- `threshold.ts` ainda tem helpers sem uso (`cloneAppData`, `addSessionsFromRun`, …) → removidos no T4.8i.
