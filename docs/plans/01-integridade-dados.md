# Plano 01 — Integridade de dados (Onda 1)

Objetivo: nenhum cenário (crash, JSON inválido, versão nova, duas instâncias) pode apagar ou corromper dados do usuário.
Refs: REV-1, REV-5, REV-7, REV-19.

---

## T1.1 [HAIKU] Escrita atômica centralizada
**Arquivos:** `src-tauri/src/storage.rs`, `src-tauri/src/randomizer.rs` (só remover a cópia local de `atomic_write` e importar a de storage).

1. Mover `atomic_write(path, content)` de `randomizer.rs` para `storage.rs` como `pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String>`:
   - Escrever em `path.with_extension("<ext>.tmp")` (ex.: `app_data.json.tmp`, não `app_data.tmp`).
   - `file.sync_all()` antes de fechar.
   - `fs::rename(tmp, path)`. No Windows `rename` sobrescreve destino existente — OK.
2. `write_json` passa a usar `atomic_write` e `serde_json::to_vec` (sem pretty — economiza I/O).
3. `randomizer.rs` usa `storage::atomic_write`.

**Aceite / testes (Rust):**
- Teste: escrever, ler de volta, conteúdo igual; arquivo `.tmp` não existe após sucesso.
- Teste: `atomic_write` em diretório inexistente retorna `Err` sem panic.

## T1.2 [HAIKU] Carregamento seguro + quarentena de arquivo corrompido
**Arquivos:** `src-tauri/src/storage.rs`.

1. Novo enum:
```rust
pub enum LoadOutcome<T> { Loaded(T), Missing(T), Recovered { data: T, quarantined: PathBuf, from_backup: Option<PathBuf> } }
```
2. `load_app_data` / `load_settings`:
   - Arquivo não existe → `Missing(default)`.
   - Existe e parseia → `Loaded`.
   - Existe e **não** parseia → renomear para `app_data.corrupt-YYYYMMDD-HHMMSS.json`; tentar o backup mais recente válido (T1.3); se achar → `Recovered{from_backup: Some}`, senão `Recovered{data: default, from_backup: None}`.
3. Guardar o outcome em `AppState.load_report: Mutex<Option<LoadReport>>` (struct serializável `{ kind: "loaded"|"missing"|"recovered", quarantined: Option<String>, fromBackup: Option<String> }`). O comando para o front é criado em T1.6.

**Aceite / testes:**
- JSON truncado (`{"tasks":[{"id":"a"`) → arquivo renomeado para `.corrupt-*`, retorno `Recovered`, **o arquivo original não é sobrescrito com vazio**.
- Com backup válido presente → dados do backup retornados.

## T1.3 [HAIKU] Backups rotativos
**Arquivos:** `src-tauri/src/storage.rs`.

1. `pub fn rotate_backups(dir: &Path, name: &str, keep: usize)` → mantém `backups/app_data.1.json` (mais novo) … `.5.json`.
2. Chamado **uma vez por boot**, depois de um `Loaded` bem-sucedido (copia o arquivo atual para `.1`, empurrando os outros).
3. Função `latest_valid_backup(dir, name) -> Option<PathBuf>` (itera 1..=5, retorna o primeiro que parseia).
4. Mesmo para `settings.json` (keep 3).

**Aceite:** teste com 6 rotações → existem exatamente 5 arquivos e o `.1` é o mais recente.

## T1.4 [HAIKU] `#[serde(default)]` em todos os structs persistidos
**Arquivos:** `src-tauri/src/model.rs` (dono nesta onda).

- Adicionar `#[serde(default)]` no nível do struct em `RandomizerSettings`, `Playlist`, `PlaylistItem`, `Task`, `Session` (para os dois últimos: implementar `Default` com `id: String::new()` etc.; `sanitize_app_data` já gera IDs vazios).
- Garantir `impl Default` onde faltar.

**Aceite / testes:**
- `{"randomizer":{"enabled":true}}` desserializa em `AppSettings` sem erro, com demais campos no default **e** `kovaak_stats_path` preservado se presente.
- JSON de sessão sem `pb` → `pb = 0.0`, não erro.

## T1.5 [HAIKU] Single instance
**Arquivos:** `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs` (só o bloco `tauri::Builder` — dono nesta onda), `src-tauri/capabilities/default.json`.

- Dependência: `tauri-plugin-single-instance = "2"`.
- Registrar **como o primeiro plugin**: no callback, pegar a janela `main`, `show()`, `unminimize()`, `set_focus()`.

**Aceite:** abrir o executável duas vezes → só um processo; a segunda abertura foca a janela existente (teste manual, descrever no PR).

## T1.6 [HAIKU] Comando `get_load_report` + aviso no front
**Arquivos:** `src-tauri/src/lib.rs` (registrar comando), `src/lib/tauri-bridge.ts`, `src/lib/types.ts`, novo `src/components/dialogs/RecoveryNotice.tsx`, `src/App.tsx` (montar o componente).

- Comando retorna `LoadReport`. Se `kind == "recovered"`, front mostra dialog: "Seus dados estavam corrompidos. Restauramos de {backup} / iniciamos vazio. O arquivo original foi preservado em {path}." Botão "Abrir pasta" (via opener de T1.8) e "OK".
- i18n via `docs/plans/i18n-pending/T1.6.json`.

## T1.7 [HAIKU] Sanitizar import de backup JSON
**Arquivos:** `src-tauri/src/lib.rs` (função `import_json_backup` apenas).

- Após parse: `storage::sanitize_app_data(&mut data)`; rejeitar se `tasks` estiver ausente no JSON bruto (validar com `serde_json::Value` antes de converter) com erro `"invalid_backup"`.
- Antes de substituir: fazer backup do estado atual em `backups/pre-import-<ts>.json`.

## T1.8 [HAIKU] Segurança: opener + CSP
**Arquivos:** `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs` (remover `open_url`, registrar plugin), `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src/lib/tauri-bridge.ts` (`openExternalUrl`), `package.json` (`@tauri-apps/plugin-opener`).

1. Substituir `open_url` (usa `cmd /c start`, injetável com `&`) por `tauri-plugin-opener`.
   - Capability: `opener:allow-open-url` com allowlist: `https://*.github.com/*`, `https://github.com/*`, `https://*.voltaic.gg/*`, `https://rawinput.net/*`, `https://evxl.app/*`, `https://kovaaks.com/*`, `https://aimlabs.com/*`, `https://www.rawaccel.net/*` (ajustar ao que `src/lib/links.ts` usa — ler o arquivo).
   - `opener:allow-reveal-item-in-dir` para "Abrir pasta".
2. `tauri.conf.json` → `"csp": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src ipc: http://ipc.localhost"`.
3. Rodar `npm run tauri dev` e confirmar no console que não há violação de CSP (fonts Geist são locais via fontsource — OK).

**Aceite:** nenhum `Command::new("cmd")` restante no código; links do app abrem; URL fora da allowlist é recusada.

## T1.9 [HAIKU] Integração da Onda 1
**Arquivos:** `src/lib/i18n.tsx`, `docs/plans/i18n-pending/*`.
- Merge dos JSON pendentes (PT e EN), remover fallbacks `|| "..."` introduzidos nesta onda, apagar os pendentes.
