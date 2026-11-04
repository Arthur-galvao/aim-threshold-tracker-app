//! Cola entre o núcleo puro (`data_store`) e o tauri: comandos de mutação, eventos
//! `app_data_changed` / `run_recorded`, persistência com debounce e flush.
//!
//! Regra: nenhum comando devolve o `AppData` inteiro (exceto `get_app_data`); o front
//! recebe snapshots versionados pelo evento `app_data_changed`.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::data_store::{self, BatchOutcome, RunOutcome};
use crate::model::{AppData, KovaakRun, Playlist, Session};
use crate::{storage, AppState};

pub const EVENT_APP_DATA_CHANGED: &str = "app_data_changed";
pub const EVENT_RUN_RECORDED: &str = "run_recorded";

/// `{ revision, data }` — payload de `app_data_changed` e retorno de `get_app_data`.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppDataSnapshot {
    pub revision: u64,
    pub data: AppData,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionResult {
    pub revision: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskResult {
    pub revision: u64,
    pub task_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertPlaylistResult {
    pub revision: u64,
    pub playlist_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncGamePlaylistsResult {
    pub revision: u64,
    pub imported: usize,
    pub total: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRecorded {
    pub revision: u64,
    pub task_id: String,
    pub session_id: String,
    pub scenario: String,
    pub score: f64,
    pub sens_cm: f64,
    pub is_new_task: bool,
}

// ---------------------------------------------------------------------------
// Helpers (todo comando usa `mutate`)
// ---------------------------------------------------------------------------

fn emit_changed(app: &AppHandle, revision: u64, data: AppData) {
    if let Err(e) = app.emit(EVENT_APP_DATA_CHANGED, AppDataSnapshot { revision, data }) {
        eprintln!("[data_commands] falha ao emitir {EVENT_APP_DATA_CHANGED}: {e}");
    }
}

/// Aplica a mutação, marca sujo para o persister e emite `app_data_changed`.
pub fn mutate<R>(
    app: &AppHandle,
    f: impl FnOnce(&mut AppData) -> Result<R, String>,
) -> Result<(R, u64), String> {
    let state: State<AppState> = app.state();
    let (result, revision, snapshot) = state.data.mutate(f)?;
    state.persister.mark_dirty();
    emit_changed(app, revision, snapshot);
    Ok((result, revision))
}

/// Como `mutate`, mas `Ok(None)` significa "nada mudou": sem revisão, sem evento.
pub fn mutate_opt<R>(
    app: &AppHandle,
    f: impl FnOnce(&mut AppData) -> Result<Option<R>, String>,
) -> Result<Option<(R, u64)>, String> {
    let state: State<AppState> = app.state();
    match state.data.mutate_opt(f)? {
        Some((result, revision, snapshot)) => {
            state.persister.mark_dirty();
            emit_changed(app, revision, snapshot);
            Ok(Some((result, revision)))
        }
        None => Ok(None),
    }
}

/// Grava o estado atual em disco agora (Exit, replace_all_data, imports).
/// Se o persister não responder, grava direto.
pub fn flush_now(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    if let Err(e) = state.persister.flush() {
        eprintln!("[data_commands] flush via persister falhou ({e}); gravando direto");
        let (_, data) = state.data.snapshot();
        if let Err(e) = storage::save_app_data(app, &data) {
            eprintln!("[data_commands] falha ao gravar app_data: {e}");
        }
    }
}

/// Registra uma run ao vivo (watcher). `None` = `source_file` já existia (duplicada).
pub fn record_run(app: &AppHandle, run: &KovaakRun) -> Result<Option<RunRecorded>, String> {
    let recorded = mutate_opt(app, |d| Ok(data_store::add_run(d, run)))?;
    let Some((RunOutcome { task_id, session_id, is_new_task }, revision)) = recorded else {
        return Ok(None);
    };
    let event = RunRecorded {
        revision,
        task_id,
        session_id,
        scenario: run.scenario.clone(),
        score: run.score,
        sens_cm: run.sens,
        is_new_task,
    };
    if let Err(e) = app.emit(EVENT_RUN_RECORDED, event.clone()) {
        eprintln!("[data_commands] falha ao emitir {EVENT_RUN_RECORDED}: {e}");
    }
    Ok(Some(event))
}

/// Importa um lote inteiro numa ÚNICA mutação (uma revisão por import) e faz flush.
/// `post` roda dentro da mutação, só se algo foi adicionado.
pub fn import_runs(
    app: &AppHandle,
    runs: &[KovaakRun],
    fix_existing: impl FnMut(&mut Session, &KovaakRun) -> bool,
    post: impl FnOnce(&mut AppData),
) -> Result<BatchOutcome, String> {
    let applied = mutate_opt(app, |d| {
        let outcome = data_store::add_runs_batch(d, runs, fix_existing);
        if outcome.new == 0 {
            return Ok(None);
        }
        post(d);
        Ok(Some(outcome))
    })?;
    match applied {
        Some((outcome, _)) => {
            flush_now(app);
            Ok(outcome)
        }
        None => Ok(BatchOutcome { new: 0, skipped: runs.len() }),
    }
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_app_data(state: State<'_, AppState>) -> Result<AppDataSnapshot, String> {
    let (revision, data) = state.data.snapshot();
    Ok(AppDataSnapshot { revision, data })
}

#[tauri::command]
pub fn create_task(
    app: AppHandle,
    name: String,
    category: String,
    subcategory: String,
) -> Result<CreateTaskResult, String> {
    let (task_id, revision) =
        mutate(&app, |d| data_store::create_task(d, &name, &category, &subcategory))?;
    Ok(CreateTaskResult { revision, task_id })
}

#[tauri::command]
pub fn update_task_meta(
    app: AppHandle,
    task_id: String,
    name: Option<String>,
    category: Option<String>,
    subcategory: Option<String>,
) -> Result<RevisionResult, String> {
    let ((), revision) = mutate(&app, |d| {
        data_store::update_task_meta(
            d,
            &task_id,
            name.as_deref(),
            category.as_deref(),
            subcategory.as_deref(),
        )
    })?;
    Ok(RevisionResult { revision })
}

#[tauri::command]
pub fn delete_task(app: AppHandle, task_id: String) -> Result<RevisionResult, String> {
    let ((), revision) = mutate(&app, |d| data_store::delete_task(d, &task_id))?;
    Ok(RevisionResult { revision })
}

/// Não força flush: vai no debounce normal do persister.
#[tauri::command]
pub fn set_active_task(app: AppHandle, task_id: Option<String>) -> Result<RevisionResult, String> {
    let ((), revision) = mutate(&app, |d| data_store::set_active_task(d, task_id.as_deref()))?;
    Ok(RevisionResult { revision })
}

#[tauri::command]
pub fn add_manual_sessions(
    app: AppHandle,
    task_id: String,
    date: String,
    sens_cm: f64,
    scores: Vec<f64>,
) -> Result<RevisionResult, String> {
    let (_ids, revision) = mutate(&app, |d| {
        data_store::add_manual_sessions(d, &task_id, &date, sens_cm, &scores)
    })?;
    Ok(RevisionResult { revision })
}

#[tauri::command]
pub fn delete_session(
    app: AppHandle,
    task_id: String,
    session_id: String,
) -> Result<RevisionResult, String> {
    let ((), revision) = mutate(&app, |d| data_store::delete_session(d, &task_id, &session_id))?;
    Ok(RevisionResult { revision })
}

#[tauri::command]
pub fn upsert_playlist(app: AppHandle, playlist: Playlist) -> Result<UpsertPlaylistResult, String> {
    let (playlist_id, revision) = mutate(&app, |d| data_store::upsert_playlist(d, playlist))?;
    Ok(UpsertPlaylistResult { revision, playlist_id })
}

#[tauri::command]
pub fn delete_playlist(app: AppHandle, playlist_id: String) -> Result<RevisionResult, String> {
    let ((), revision) = mutate(&app, |d| data_store::delete_playlist(d, &playlist_id))?;
    Ok(RevisionResult { revision })
}

/// Lógica em `data_store::sync_game_playlists` (T2.5): lê as playlists dos dois jogos do
/// disco e sincroniza numa única mutação.
#[tauri::command]
pub fn sync_game_playlists(
    app: AppHandle,
    state: State<'_, AppState>,
    detected: Option<crate::model::GamePlaylist>,
) -> Result<SyncGamePlaylistsResult, String> {
    let stats_path = state.settings.lock().unwrap().kovaak_stats_path.clone();
    let mut kovaak = crate::kovaaak::load_all_kovaak_playlists(stats_path.as_deref());
    // Playlist em andamento no KovaaK's que não está salva na pasta de playlists:
    // entra na sincronização como playlist do jogo (antes o front a criava a partir do evento).
    if let Some(det) = detected {
        let wanted = det.playlist_name.trim().to_lowercase();
        if !wanted.is_empty() && !kovaak.iter().any(|p| p.playlist_name.trim().to_lowercase() == wanted) {
            kovaak.push(det);
        }
    }
    let aimlab = crate::aimlab::load_all_aimlab_playlists();
    let (outcome, revision) =
        mutate(&app, |d| data_store::sync_game_playlists(d, &kovaak, &aimlab))?;
    Ok(SyncGamePlaylistsResult { revision, imported: outcome.imported, total: outcome.total })
}

/// Troca TODOS os dados (demo / limpar / importar), com backup `pre-<reason>-<ts>.json`
/// do estado atual e flush síncrono.
pub fn replace_all(app: &AppHandle, new_data: AppData, reason: &str) -> Result<RevisionResult, String> {
    if !matches!(reason, "demo" | "clear" | "import") {
        return Err(data_store::ERR_INVALID_PAYLOAD.to_string());
    }
    let state: State<AppState> = app.state();
    let (_, current) = state.data.snapshot();
    let dir = storage::data_dir(app)?;
    storage::write_pre_backup(&dir, reason, &current)?;

    let ((), revision) = mutate(app, |d| {
        data_store::replace_all(d, new_data);
        Ok(())
    })?;
    flush_now(app);
    Ok(RevisionResult { revision })
}

#[tauri::command]
pub fn replace_all_data(
    app: AppHandle,
    data: AppData,
    reason: String,
) -> Result<RevisionResult, String> {
    replace_all(&app, data, &reason)
}

/// Importa um backup JSON (validação no Rust). Erro: "invalid_backup".
#[tauri::command]
pub fn import_json_backup(app: AppHandle, json: String) -> Result<RevisionResult, String> {
    let raw: serde_json::Value =
        serde_json::from_str(&json).map_err(|_| "invalid_backup".to_string())?;
    if !raw.is_object() || !raw.get("tasks").is_some_and(|t| t.is_array()) {
        return Err("invalid_backup".to_string());
    }
    let data: AppData = serde_json::from_value(raw).map_err(|_| "invalid_backup".to_string())?;
    replace_all(&app, data, "import")
}
