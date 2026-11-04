# Plano 03 — Schema v2 da run + importador (Onda 3)

Objetivo: guardar a run completa (hoje só data/sens/score), parar de reescrever arquivos do jogo, importar runs perdidas, migrações versionadas. Tudo nos Planos 04–07 depende disso.
Refs: REV-3, REV-4, REV-6, REV-9, REV-12, REV-13, P3-33.

## Schema v2

### `Session` (Rust `model.rs` + TS `types.ts`)
Campos existentes mantidos (`id, date, sens, pb, threshold?, sourceFile?`). Novos, todos opcionais (`Option` / `?`) com `#[serde(default)]`:
| Campo | Tipo | Origem |
|---|---|---|
| `datetime` | ISO local `YYYY-MM-DDTHH:MM:SS` | timestamp do nome do arquivo; fallback `Challenge Start` + data |
| `game` | `"kovaak" \| "aimlab" \| "manual"` | importador |
| `fov` | f64 | `FOV:` |
| `shots`, `hits` | u32 | linha `Weapon,...` (somar todas as armas) |
| `accuracy` | f64 (0–1) | `hits/shots` se shots > 0 |
| `kills` | u32 | `Kills:` |
| `avgTtk` | f64 | `Avg TTK:` |
| `damageDone`, `damagePossible` | f64 | `Damage Done:` / coluna da arma |
| `fightTime` | f64 | `Fight Time:` |
| `pauseCount`, `pauseDuration` | f64 | `Pause Count:` / `Pause Duration:` |
| `avgFps` | f64 | `Avg FPS:` |
| `gameVersion`, `hash` | String | `Game Version:` / `Hash:` |
| `sensRole` | `"base" \| "anchor" \| "random" \| "off" \| "unknown"` | randomizer no momento da run (Plano 05) |
| `rollCenterCm` | f64 | centro usado no sorteio da run |
| `latticeK` | i32 | índice da grade sorteado |
| `runMode` | `"measure" \| "train" \| "free"` | playlist/step ativo (Plano 07); default `"free"` |
| `focus` | `"on" \| "auto" \| null` | rating 1-toque (Plano 07) |

### `AppData`
- `schemaVersion: u32` (ausente = 1). Atual após este plano = **2**.

**Regra de parsing:** por **chave normalizada** (minúsculas, sem espaço/pontuação), nunca por posição. Campo ausente → `None`. Os nomes variam por versão do KovaaK's.

---

## T3.1 [HAIKU] Contrato do schema v2
**Arquivos:** `src-tauri/src/model.rs`, `src/lib/types.ts`.
- Adicionar os campos acima. `KovaakRun` ganha `stats: RunStats` (struct com os campos de stats) + `datetime` já existe.

## T3.2 [HAIKU] Parser KovaaK's completo
**Arquivos:** `src-tauri/src/parser.rs`, `test/fixtures/kovaak/*.csv` (copiar 3–5 CSVs reais da pasta stats configurada; incluir um de cenário com várias armas se houver).
- `parse_stats_file_with_fallback_dpi` passa a preencher `RunStats`.
- Tabela de armas: localizar a linha de cabeçalho que começa com `Weapon,` e somar `Shots`/`Hits` das linhas seguintes até linha vazia.
- Otimização: normalizar cada linha **uma vez** (hoje `find_line_value` re-normaliza todas as linhas para cada alias). Construir `HashMap<String,String>` chave→valor numa passada e consultar.
- Remover a heurística `sens 2.5..5 sem escala = Valorant` (REV): sem `Sens Scale` e fora de 5–150 → `sens = 0.0` e `sensRole = "unknown"` (melhor não ter dado do que ter dado errado).
**Testes:** cada fixture → asserts de score, scenario, datetime, shots/hits, accuracy, fov.

## T3.3 [HAIKU] Ledger de sens (fim da reescrita de CSV do jogo)
**Arquivos:** `src-tauri/src/watcher.rs`, novo `src-tauri/src/sens_ledger.rs`, `src-tauri/src/storage.rs` (só path helper).
- **Remover** `update_kovaak_csv_sensitivity` e o loop que a chama. Remover o teste dele.
- `sens_ledger.json`: `HashMap<source_file, LedgerEntry { cm, role, centerCm, k, ts }>`; escrito com `atomic_write`. Gravado no momento do `run_end` (antes do sorteio da próxima, com o snapshot da sens usada).
- Ao importar (live, catch-up ou reimport): se houver entrada no ledger → usar `cm`/`role`/`centerCm`/`k` do ledger; senão sens do CSV.
- Ledger podado: manter entradas dos últimos 365 dias.

## T3.4 [HAIKU] Latência do parse
**Arquivos:** `src-tauri/src/watcher.rs` (`wait_for_parse`).
- Backoff: tentativas em 100, 200, 400, 800, 1600, 3200 ms (total ≈ 6.3 s). Sem sleep inicial de 1 s.
- Considerar a run válida só se `Score` **e** a tabela de armas foram lidos (garante arquivo completo).

## T3.5 [HAIKU] Catch-up import
**Arquivos:** `src-tauri/src/watcher.rs`, `src-tauri/src/lib.rs` (`start_watcher`).
- Ao iniciar o watcher (boot ou manual): listar CSVs de stats com `mtime > last_import_scan_at` (novo campo em `AppSettings`, default = epoch), importar os ausentes via `import_existing` (já em lote único do Plano 02), atualizar `last_import_scan_at = now`.
- Emitir `import_complete` com `{ new, reason: "catch_up" }`; front mostra "N runs importadas desde a última sessão" só se `new > 0`.
- `import_on_first_run` vira irrelevante (manter o campo, ignorar).

## T3.6 [FORTE] Migração v1 → v2
**Arquivos:** novo `src-tauri/src/migrations.rs`, `src-tauri/src/lib.rs` (setup: chamar migrações; remover chamadas a `migrate_existing_sensitivities` e `migrate_existing_aimlab_tasks` do boot), `src-tauri/src/watcher.rs` (remover `migrate_existing_sensitivities`), `src-tauri/src/aimlab.rs` (mover a lógica de dedupe para a migração).
- `run_migrations(data, settings) -> bool`: `match data.schema_version { 1 => v1_to_v2, ... }`. Cada passo roda **uma vez**.
- `v1_to_v2`:
  1. Backup `backups/pre-migration-v2-<ts>.json` (obrigatório, abortar migração se falhar).
  2. Para cada sessão com `sourceFile` que contém timestamp → preencher `datetime`.
  3. Se `kovaak_stats_path` existir: re-parsear os CSVs referenciados (em thread de background, emitindo `migration_progress {done,total}`) e preencher `RunStats`. Sens: só substituir se a sessão tiver sens `< 2.5` **e** o CSV tiver `Sens Scale` explícito. Sem CSV → mantém como está (não converter assumindo Valorant).
  4. Dedupe de tasks do Aim Lab (lógica atual de `migrate_existing_aimlab_tasks`).
  5. `sensRole = "unknown"` para tudo que não estiver no ledger.
  6. `schemaVersion = 2`.
- Front: barra de progresso discreta enquanto `migration_progress` < total.
**Testes:** fixture v1 → v2 idempotente (rodar 2× não muda nada na 2ª); sessão sem CSV com sens 0.24 **não** é convertida.

## T3.7 [HAIKU] Cache do mapa de cenários do Aim Lab
**Arquivos:** `src-tauri/src/aimlab.rs`, `src-tauri/src/lib.rs` (campo no `AppState`).
- `AppState.aimlab_name_map: Mutex<Option<(Instant, HashMap<..>)>>`; rebuild se `None`, > 10 min, ou nome não encontrado (uma vez por run).

## T3.8 [HAIKU] Aviso de DPI
**Arquivos:** `src/components/views/randomizer/telemetry-card.tsx` (ou componente de status do randomizer), pendente i18n.
- O campo `DPI:` do CSV é autodeclarado e frequentemente errado. Se `|csvDpi - settings.mouseDpi| / mouseDpi > 5%` nas últimas 10 runs → aviso "DPI do KovaaK's ≠ DPI configurado no app; o cm/360 pode estar errado".
- Também (REV-20): se `rawaccel_backup.output_dpi` ≠ `mouse_dpi` → aviso de baseline do RawAccel.

## T3.9 [HAIKU] Integração Onda 3 (i18n + remover código morto do parser: `parse_stats_file` com `allow(dead_code)`, `plan_roll`).
