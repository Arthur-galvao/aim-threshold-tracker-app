//! Fonte única de dados (Plano 02): o Rust é o dono do `AppData`.
//!
//! Este módulo é PURO (sem tipos do tauri) para ser testável fora do app:
//! - `DataCore`: `RwLock<AppData>` + revisão atômica; toda mutação passa por `mutate`.
//! - funções de mutação simples (`create_task`, `add_run`, `add_runs_batch`, ...);
//! - `Persister`: thread com debounce que grava o snapshot via um `writer` injetado.
//!
//! A cola com o tauri (comandos, eventos `app_data_changed` / `run_recorded`) fica em
//! `data_commands.rs`.
//!
//! Erros são CÓDIGOS curtos ("empty_name", "task_not_found", ...), nunca frases.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::Duration;

use crate::model::{
    AppData, GamePlaylist, KovaakRun, Playlist, PlaylistItem, Session, Task, DEFAULT_CATEGORY,
    DEFAULT_SUBCATEGORY, MAX_INTENT_CUE_CHARS,
};
use crate::watcher::unique_id;

pub const ERR_EMPTY_NAME: &str = "empty_name";
pub const ERR_TASK_NOT_FOUND: &str = "task_not_found";
pub const ERR_SESSION_NOT_FOUND: &str = "session_not_found";
pub const ERR_PLAYLIST_NOT_FOUND: &str = "playlist_not_found";
pub const ERR_INVALID_PAYLOAD: &str = "invalid_payload";

/// Silêncio (sem novas mutações) antes de gravar em disco.
pub const PERSIST_DEBOUNCE: Duration = Duration::from_millis(400);

// ---------------------------------------------------------------------------
// Núcleo
// ---------------------------------------------------------------------------

pub struct DataCore {
    data: RwLock<AppData>,
    revision: AtomicU64,
}

impl DataCore {
    pub fn new(data: AppData) -> Self {
        Self {
            data: RwLock::new(data),
            revision: AtomicU64::new(0),
        }
    }

    pub fn revision(&self) -> u64 {
        self.revision.load(Ordering::SeqCst)
    }

    /// Cópia consistente `(revisão, dados)`: a revisão só muda com o lock de escrita,
    /// então lida sob o lock de leitura sempre corresponde aos dados clonados.
    pub fn snapshot(&self) -> (u64, AppData) {
        let guard = self.data.read().unwrap_or_else(|e| e.into_inner());
        (self.revision.load(Ordering::SeqCst), guard.clone())
    }

    /// Aplica `f` sob o lock de escrita. Se `f` devolver `Ok`, incrementa a revisão e
    /// devolve `(resultado, revisão, snapshot)`. Se devolver `Err`, nada muda de revisão
    /// (por isso `f` deve validar ANTES de mutar).
    pub fn mutate<R>(
        &self,
        f: impl FnOnce(&mut AppData) -> Result<R, String>,
    ) -> Result<(R, u64, AppData), String> {
        let mut guard = self.data.write().unwrap_or_else(|e| e.into_inner());
        let result = f(&mut guard)?;
        let rev = self.revision.fetch_add(1, Ordering::SeqCst) + 1;
        Ok((result, rev, guard.clone()))
    }

    /// Como `mutate`, mas `f` devolve `Ok(None)` quando não houve mudança: nesse caso a
    /// revisão não é incrementada e nada é devolvido.
    pub fn mutate_opt<R>(
        &self,
        f: impl FnOnce(&mut AppData) -> Result<Option<R>, String>,
    ) -> Result<Option<(R, u64, AppData)>, String> {
        let mut guard = self.data.write().unwrap_or_else(|e| e.into_inner());
        match f(&mut guard)? {
            Some(result) => {
                let rev = self.revision.fetch_add(1, Ordering::SeqCst) + 1;
                Ok(Some((result, rev, guard.clone())))
            }
            None => Ok(None),
        }
    }
}

// ---------------------------------------------------------------------------
// Mutações (puras sobre &mut AppData)
// ---------------------------------------------------------------------------

fn find_task_mut<'a>(data: &'a mut AppData, task_id: &str) -> Result<&'a mut Task, String> {
    data.tasks
        .iter_mut()
        .find(|t| t.id == task_id)
        .ok_or_else(|| ERR_TASK_NOT_FOUND.to_string())
}

/// Cria a tarefa e a torna ativa. Devolve o id.
pub fn create_task(
    data: &mut AppData,
    name: &str,
    category: &str,
    subcategory: &str,
) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(ERR_EMPTY_NAME.to_string());
    }
    let category = category.trim();
    let subcategory = subcategory.trim();
    let task = Task {
        id: unique_id("task"),
        name: name.to_string(),
        category: if category.is_empty() { DEFAULT_CATEGORY } else { category }.to_string(),
        subcategory: if subcategory.is_empty() { DEFAULT_SUBCATEGORY } else { subcategory }
            .to_string(),
        sessions: Vec::new(),
        intent_cue: None,
    };
    let id = task.id.clone();
    data.active_task_id = Some(id.clone());
    data.tasks.push(task);
    Ok(id)
}

pub fn update_task_meta(
    data: &mut AppData,
    task_id: &str,
    name: Option<&str>,
    category: Option<&str>,
    subcategory: Option<&str>,
    intent_cue: Option<&str>,
) -> Result<(), String> {
    // valida tudo antes de mutar
    let new_name = match name {
        Some(n) => {
            let n = n.trim();
            if n.is_empty() {
                return Err(ERR_EMPTY_NAME.to_string());
            }
            Some(n.to_string())
        }
        None => None,
    };
    let task = find_task_mut(data, task_id)?;
    if let Some(n) = new_name {
        task.name = n;
    }
    if let Some(c) = category {
        task.category = c.trim().to_string();
    }
    if let Some(s) = subcategory {
        task.subcategory = s.trim().to_string();
    }
    if let Some(c) = intent_cue {
        let c: String = c.trim().chars().take(MAX_INTENT_CUE_CHARS).collect();
        let c = c.trim_end().to_string();
        task.intent_cue = if c.is_empty() { None } else { Some(c) };
    }
    Ok(())
}

/// Define o foco da sessão: `Some("on"|"auto")` ou `None` (limpa).
pub fn set_session_focus(
    data: &mut AppData,
    task_id: &str,
    session_id: &str,
    focus: Option<&str>,
) -> Result<(), String> {
    let focus = match focus {
        None => None,
        Some("on") => Some("on".to_string()),
        Some("auto") => Some("auto".to_string()),
        Some(_) => return Err(ERR_INVALID_PAYLOAD.to_string()),
    };
    let task = find_task_mut(data, task_id)?;
    let session = task
        .sessions
        .iter_mut()
        .find(|s| s.id == session_id)
        .ok_or_else(|| ERR_SESSION_NOT_FOUND.to_string())?;
    session.focus = focus;
    Ok(())
}

/// Remove a tarefa. Se era a ativa, a primeira restante passa a ser a ativa.
pub fn delete_task(data: &mut AppData, task_id: &str) -> Result<(), String> {
    let idx = data
        .tasks
        .iter()
        .position(|t| t.id == task_id)
        .ok_or_else(|| ERR_TASK_NOT_FOUND.to_string())?;
    data.tasks.remove(idx);
    if data.active_task_id.as_deref() == Some(task_id) {
        data.active_task_id = data.tasks.first().map(|t| t.id.clone());
    }
    Ok(())
}

pub fn set_active_task(data: &mut AppData, task_id: Option<&str>) -> Result<(), String> {
    match task_id {
        Some(id) => {
            if !data.tasks.iter().any(|t| t.id == id) {
                return Err(ERR_TASK_NOT_FOUND.to_string());
            }
            data.active_task_id = Some(id.to_string());
        }
        None => data.active_task_id = None,
    }
    Ok(())
}

/// Adiciona uma sessão manual por score. Devolve os ids criados.
pub fn add_manual_sessions(
    data: &mut AppData,
    task_id: &str,
    date: &str,
    sens_cm: f64,
    scores: &[f64],
) -> Result<Vec<String>, String> {
    if date.trim().is_empty()
        || !sens_cm.is_finite()
        || sens_cm <= 0.0
        || scores.is_empty()
        || scores.iter().any(|s| !s.is_finite() || *s <= 0.0)
    {
        return Err(ERR_INVALID_PAYLOAD.to_string());
    }
    let task = find_task_mut(data, task_id)?;
    let mut ids = Vec::with_capacity(scores.len());
    for score in scores {
        let id = unique_id("sess");
        task.sessions.push(Session {
            id: id.clone(),
            date: date.trim().to_string(),
            sens: sens_cm,
            pb: *score,
            threshold: 0.0,
            source_file: None,
            ..Default::default()
        });
        ids.push(id);
    }
    Ok(ids)
}

pub fn delete_session(data: &mut AppData, task_id: &str, session_id: &str) -> Result<(), String> {
    let task = find_task_mut(data, task_id)?;
    let idx = task
        .sessions
        .iter()
        .position(|s| s.id == session_id)
        .ok_or_else(|| ERR_SESSION_NOT_FOUND.to_string())?;
    task.sessions.remove(idx);
    Ok(())
}

/// Insere ou substitui (por id) a playlist. Id/`createdAt`/ids de itens vazios são gerados
/// aqui. Devolve o id da playlist.
pub fn upsert_playlist(data: &mut AppData, mut playlist: Playlist) -> Result<String, String> {
    playlist.name = playlist.name.trim().to_string();
    if playlist.name.is_empty() {
        return Err(ERR_EMPTY_NAME.to_string());
    }
    if playlist.id.trim().is_empty() {
        playlist.id = unique_id("pl");
    }
    if playlist.created_at.trim().is_empty() {
        playlist.created_at = chrono::Utc::now().to_rfc3339();
    }
    if playlist.source.trim().is_empty() {
        playlist.source = crate::model::default_playlist_source();
    }
    for item in &mut playlist.items {
        if item.id.trim().is_empty() {
            item.id = unique_id("item");
        }
    }
    let id = playlist.id.clone();
    match data.playlists.iter_mut().find(|p| p.id == id) {
        Some(existing) => *existing = playlist,
        None => data.playlists.push(playlist),
    }
    Ok(id)
}

pub fn delete_playlist(data: &mut AppData, playlist_id: &str) -> Result<(), String> {
    let idx = data
        .playlists
        .iter()
        .position(|p| p.id == playlist_id)
        .ok_or_else(|| ERR_PLAYLIST_NOT_FOUND.to_string())?;
    data.playlists.remove(idx);
    Ok(())
}

/// Substitui todos os dados (demo / limpar / importar). Corrige ids duplicados e uma
/// `activeTaskId` que aponte para uma tarefa inexistente.
pub fn replace_all(data: &mut AppData, mut new_data: AppData) {
    crate::storage::sanitize_app_data(&mut new_data);
    let active_ok = new_data
        .active_task_id
        .as_deref()
        .is_some_and(|id| new_data.tasks.iter().any(|t| t.id == id));
    if !active_ok {
        new_data.active_task_id = new_data.tasks.first().map(|t| t.id.clone());
    }
    *data = new_data;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunOutcome {
    pub task_id: String,
    pub session_id: String,
    pub is_new_task: bool,
}

fn session_from_run(run: &KovaakRun) -> Session {
    Session {
        id: unique_id("sess"),
        date: run.datetime.get(..10).unwrap_or("").to_string(),
        sens: run.sens,
        pb: run.score,
        threshold: 0.0,
        source_file: Some(run.source_file.clone()),
        datetime: (run.datetime.len() >= 19).then(|| run.datetime[..19].to_string()),
        game: (!run.game.is_empty()).then(|| run.game.clone()),
        fov: (run.fov > 0.0).then_some(run.fov),
        shots: run.stats.shots,
        hits: run.stats.hits,
        accuracy: run.stats.accuracy,
        kills: run.stats.kills,
        avg_ttk: run.stats.avg_ttk,
        damage_done: run.stats.damage_done,
        damage_possible: run.stats.damage_possible,
        fight_time: run.stats.fight_time,
        pause_count: run.stats.pause_count,
        pause_duration: run.stats.pause_duration,
        avg_fps: run.stats.avg_fps,
        game_version: run.stats.game_version.clone(),
        hash: run.stats.hash.clone(),
        dpi: run.stats.dpi,
        sens_role: run.sens_role.clone(),
        roll_center_cm: run.roll_center_cm,
        lattice_k: run.lattice_k,
        run_mode: run.run_mode.clone(),
        ..Default::default()
    }
}

fn new_task_for_run(run: &KovaakRun, session: Session) -> Task {
    Task {
        id: unique_id("task"),
        name: run.scenario.clone(),
        category: DEFAULT_CATEGORY.to_string(),
        subcategory: DEFAULT_SUBCATEGORY.to_string(),
        sessions: vec![session],
        intent_cue: None,
    }
}

/// Run ao vivo. Dedupe por `source_file` DENTRO do lock: devolve `None` se já existe.
/// Tarefa nova (ou nenhuma ativa) passa a ser a ativa, como o front fazia antes.
pub fn add_run(data: &mut AppData, run: &KovaakRun) -> Option<RunOutcome> {
    let already = data.tasks.iter().any(|t| {
        t.sessions
            .iter()
            .any(|s| s.source_file.as_deref() == Some(run.source_file.as_str()))
    });
    if already {
        return None;
    }

    let session = session_from_run(run);
    let session_id = session.id.clone();

    if let Some(task) = data
        .tasks
        .iter_mut()
        .find(|t| t.name.trim().eq_ignore_ascii_case(run.scenario.trim()))
    {
        task.sessions.push(session);
        let task_id = task.id.clone();
        if data.active_task_id.is_none() {
            data.active_task_id = Some(task_id.clone());
        }
        return Some(RunOutcome { task_id, session_id, is_new_task: false });
    }

    let task = new_task_for_run(run, session);
    let task_id = task.id.clone();
    data.active_task_id = Some(task_id.clone());
    data.tasks.push(task);
    Some(RunOutcome { task_id, session_id, is_new_task: true })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct BatchOutcome {
    pub new: usize,
    pub skipped: usize,
}

/// Importa um lote. O índice `source_file -> (tarefa, sessão)` e `nome -> tarefa` é
/// construído UMA vez (O(sessões + runs), antes era O(runs × sessões)).
///
/// Para run cujo `source_file` já existe, `fix_existing(sessão, run)` pode corrigir a
/// sessão (ex.: sens); se devolver `true` conta como `new`, senão como `skipped`.
/// Não ativa tarefa nova, exceto quando nenhuma está ativa.
pub fn add_runs_batch(
    data: &mut AppData,
    runs: &[KovaakRun],
    mut fix_existing: impl FnMut(&mut Session, &KovaakRun) -> bool,
) -> BatchOutcome {
    let mut by_source: HashMap<String, (usize, usize)> = HashMap::new();
    let mut by_name: HashMap<String, usize> = HashMap::new();
    for (ti, task) in data.tasks.iter().enumerate() {
        by_name.entry(task.name.trim().to_ascii_lowercase()).or_insert(ti);
        for (si, session) in task.sessions.iter().enumerate() {
            if let Some(sf) = &session.source_file {
                by_source.entry(sf.clone()).or_insert((ti, si));
            }
        }
    }

    let mut out = BatchOutcome::default();
    for run in runs {
        if let Some(&(ti, si)) = by_source.get(&run.source_file) {
            if fix_existing(&mut data.tasks[ti].sessions[si], run) {
                out.new += 1;
            } else {
                out.skipped += 1;
            }
            continue;
        }

        let session = session_from_run(run);
        let key = run.scenario.trim().to_ascii_lowercase();
        let (ti, si) = match by_name.get(&key) {
            Some(&ti) => {
                let task = &mut data.tasks[ti];
                task.sessions.push(session);
                (ti, task.sessions.len() - 1)
            }
            None => {
                let task = new_task_for_run(run, session);
                if data.active_task_id.is_none() {
                    data.active_task_id = Some(task.id.clone());
                }
                data.tasks.push(task);
                let ti = data.tasks.len() - 1;
                by_name.insert(key, ti);
                (ti, 0)
            }
        };
        by_source.insert(run.source_file.clone(), (ti, si));
        out.new += 1;
    }
    out
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct SyncOutcome {
    /// Playlists de jogo criadas nesta sincronização.
    pub imported: usize,
    /// Playlists de jogo consideradas (KovaaK's + Aim Lab).
    pub total: usize,
}

/// Origens de playlist de jogo (`Playlist.source`). `"user"` nunca é tocada pelo sync.
pub const SOURCE_KOVAAK: &str = "kovaak";
pub const SOURCE_AIMLAB: &str = "aimlab";

/// Port de `cleanScenarioName` (src/lib/viscose.ts), mesmas regras e ordem:
/// "CsLevel.<autor>.<cenário>.<código>" -> "<cenário>" (3 partes: a do meio);
/// "CsLevel<guid>" -> o que sobra sem o prefixo; qualquer outro nome só é aparado.
pub fn clean_scenario_name(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.starts_with("CsLevel.") {
        let parts: Vec<&str> = trimmed.split('.').collect();
        if parts.len() >= 4 {
            let middle = parts[2..parts.len() - 1].join(".");
            let middle = middle.trim();
            if !middle.is_empty() {
                return middle.to_string();
            }
        } else if parts.len() == 3 {
            let middle = parts[1].trim();
            if !middle.is_empty() {
                return middle.to_string();
            }
        }
    }
    if let Some(rest) = trimmed.strip_prefix("CsLevel") {
        let stripped = rest.trim_start_matches(['-', '_', '.']).trim();
        if !stripped.is_empty() {
            return stripped.to_string();
        }
    }
    trimmed.to_string()
}

fn norm_key(s: &str) -> String {
    s.trim().to_lowercase()
}

/// `item.playCount || 1`, depois `max(1, round(..))`, como no fallback TS.
fn target_reps(play_count: f64) -> f64 {
    let pc = if play_count == 0.0 || play_count.is_nan() { 1.0 } else { play_count };
    pc.round().max(1.0)
}

/// Monta os itens de uma playlist de jogo, criando as tarefas que faltam (match
/// case-insensitive pelo nome aparado). Tarefas novas usam categoria padrão; o
/// `fixupTaskCategories` do front recategoriza depois.
fn build_items(
    data: &mut AppData,
    task_ids: &mut HashMap<String, String>,
    game: &GamePlaylist,
) -> Vec<PlaylistItem> {
    let mut items = Vec::new();
    for entry in &game.scenario_list {
        let trimmed = entry.scenario_name.trim();
        if trimmed.is_empty() {
            continue;
        }
        let cleaned = clean_scenario_name(trimmed);
        let name = cleaned.trim();
        if name.is_empty() {
            continue;
        }
        let key = norm_key(name);
        let task_id = match task_ids.get(&key).cloned() {
            Some(id) => id,
            None => {
                let id = unique_id("task");
                data.tasks.push(Task {
                    id: id.clone(),
                    name: name.to_string(),
                    category: DEFAULT_CATEGORY.to_string(),
                    subcategory: DEFAULT_SUBCATEGORY.to_string(),
                    sessions: Vec::new(),
                    intent_cue: None,
                });
                task_ids.insert(key, id.clone());
                id
            }
        };
        items.push(PlaylistItem {
            id: unique_id("item"),
            task_id,
            target_mode: "reps".to_string(),
            target_value: target_reps(entry.play_count),
            ..Default::default()
        });
    }
    items
}

/// Atualiza uma playlist já existente com o mesmo nome (case-insensitive).
/// - `source` "user" (ou desconhecido): intocada, exceto a migração: se os taskIds
///   forem exatamente os da lista do jogo (mesma ordem), vira playlist de `origin`.
/// - playlist de jogo: só é reconstruída se a sequência de taskIds mudou; os alvos
///   (`targetMode`/`targetValue`) são preservados por `taskId`.
fn refresh_existing(pl: &mut Playlist, items: Vec<PlaylistItem>, origin: &str) {
    let is_game = pl.source == SOURCE_KOVAAK || pl.source == SOURCE_AIMLAB;
    let same_order = pl.items.len() == items.len()
        && pl.items.iter().zip(&items).all(|(old, new)| old.task_id == new.task_id);
    if !is_game {
        if !same_order {
            return;
        }
        pl.source = origin.to_string();
    }
    if same_order {
        return;
    }
    let rebuilt: Vec<PlaylistItem> = items
        .into_iter()
        .map(|mut item| {
            if let Some(old) = pl.items.iter().find(|o| o.task_id == item.task_id) {
                item.target_mode = old.target_mode.clone();
                item.target_value = old.target_value;
            }
            item
        })
        .collect();
    pl.items = rebuilt;
}

/// T2.5: sincroniza playlists dos jogos (KovaaK's em `kovaak`, Aim Lab em `aimlab`) com
/// `data.playlists`, numa única mutação. Regras:
/// - nova playlist de jogo -> criada com `source` "kovaak"/"aimlab";
/// - playlist com mesmo nome e `source` de usuário -> intocada (ou migrada, ver `refresh_existing`);
/// - playlist de jogo -> atualizada só se a lista de cenários mudou.
///
/// Tarefas faltantes são criadas. A tarefa ativa do usuário não muda, a não ser que não
/// haja nenhuma.
pub fn sync_game_playlists(
    data: &mut AppData,
    kovaak: &[GamePlaylist],
    aimlab: &[GamePlaylist],
) -> Result<SyncOutcome, String> {
    let total = kovaak.len() + aimlab.len();
    let tasks_before = data.tasks.len();

    let mut task_ids: HashMap<String, String> = HashMap::new();
    for task in &data.tasks {
        task_ids.entry(norm_key(&task.name)).or_insert_with(|| task.id.clone());
    }
    let mut playlist_idx: HashMap<String, usize> = HashMap::new();
    for (i, pl) in data.playlists.iter().enumerate() {
        playlist_idx.insert(norm_key(&pl.name), i);
    }

    let mut imported = 0;
    let games = kovaak
        .iter()
        .map(|g| (SOURCE_KOVAAK, g))
        .chain(aimlab.iter().map(|g| (SOURCE_AIMLAB, g)));
    for (origin, game) in games {
        let name = game.playlist_name.trim();
        if name.is_empty() {
            continue;
        }
        let items = build_items(data, &mut task_ids, game);
        if items.is_empty() {
            continue;
        }
        let key = norm_key(name);
        match playlist_idx.get(&key).copied() {
            Some(idx) => refresh_existing(&mut data.playlists[idx], items, origin),
            None => {
                data.playlists.push(Playlist {
                    id: unique_id("pl"),
                    name: name.to_string(),
                    items,
                    created_at: chrono::Utc::now().to_rfc3339(),
                    auto_advance_mode: None,
                    source: origin.to_string(),
                    is_measurement: false,
                });
                playlist_idx.insert(key, data.playlists.len() - 1);
                imported += 1;
            }
        }
    }

    if data.tasks.len() > tasks_before && data.active_task_id.is_none() {
        data.active_task_id = data.tasks.first().map(|t| t.id.clone());
    }
    Ok(SyncOutcome { imported, total })
}

// ---------------------------------------------------------------------------
// Persister (debounce)
// ---------------------------------------------------------------------------

enum Msg {
    Dirty,
    Flush(mpsc::Sender<Result<(), String>>),
    Stop,
}

/// Thread que grava o snapshot depois de `debounce` de silêncio. O `writer` é injetado
/// (em produção: `storage::save_app_data`; em teste: um contador).
pub struct Persister {
    tx: Mutex<mpsc::Sender<Msg>>,
}

impl Persister {
    pub fn spawn<W>(core: Arc<DataCore>, debounce: Duration, writer: W) -> Persister
    where
        W: Fn(&AppData) -> Result<(), String> + Send + 'static,
    {
        let (tx, rx) = mpsc::channel::<Msg>();
        let spawned = thread::Builder::new()
            .name("data-persister".into())
            .spawn(move || {
                let write = || -> Result<(), String> {
                    // clona sob o lock de leitura e solta antes de ir ao disco
                    let (_, snapshot) = core.snapshot();
                    writer(&snapshot)
                };
                // Após falha de escrita espera mais antes de tentar de novo.
                let retry_wait = debounce.saturating_mul(5);
                let mut wait = debounce;
                let mut dirty = false;
                loop {
                    let msg = if dirty {
                        match rx.recv_timeout(wait) {
                            Ok(m) => Some(m),
                            Err(RecvTimeoutError::Timeout) => None,
                            Err(RecvTimeoutError::Disconnected) => Some(Msg::Stop),
                        }
                    } else {
                        match rx.recv() {
                            Ok(m) => Some(m),
                            Err(_) => return,
                        }
                    };
                    match msg {
                        Some(Msg::Dirty) => {
                            dirty = true;
                            wait = debounce;
                        }
                        Some(Msg::Flush(ack)) => {
                            let result = if dirty { write() } else { Ok(()) };
                            if result.is_ok() {
                                dirty = false;
                            }
                            let _ = ack.send(result);
                        }
                        Some(Msg::Stop) => {
                            if dirty {
                                let _ = write();
                            }
                            return;
                        }
                        None => match write() {
                            Ok(()) => dirty = false,
                            Err(e) => {
                                eprintln!("[data_store] falha ao gravar app_data: {e}");
                                wait = retry_wait;
                            }
                        },
                    }
                }
            });
        if let Err(e) = spawned {
            eprintln!("[data_store] falha ao iniciar o persister: {e}");
        }
        Persister { tx: Mutex::new(tx) }
    }

    /// Sinaliza que há dados novos (reinicia o debounce).
    pub fn mark_dirty(&self) {
        let _ = self.tx.lock().unwrap_or_else(|e| e.into_inner()).send(Msg::Dirty);
    }

    /// Grava agora (se houver mudança pendente) e espera terminar.
    /// `Err` se a gravação falhou ou se a thread não existe mais.
    pub fn flush(&self) -> Result<(), String> {
        let (ack_tx, ack_rx) = mpsc::channel();
        self.tx
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .send(Msg::Flush(ack_tx))
            .map_err(|_| "persister_stopped".to_string())?;
        ack_rx
            .recv_timeout(Duration::from_secs(10))
            .map_err(|_| "persister_timeout".to_string())?
    }
}

impl Drop for Persister {
    fn drop(&mut self) {
        if let Ok(tx) = self.tx.lock() {
            let _ = tx.send(Msg::Stop);
        }
    }
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;

    fn core_with_task() -> (DataCore, String) {
        let core = DataCore::new(AppData::default());
        let (id, _, _) = core
            .mutate(|d| create_task(d, "1w2ts Pasu", "Click Timing", "Precision"))
            .unwrap();
        (core, id)
    }

    fn run(scenario: &str, source: &str) -> KovaakRun {
        KovaakRun {
            scenario: scenario.into(),
            score: 100.0,
            sens: 40.0,
            fov: 103.0,
            datetime: "2026-10-12T14:30:22".into(),
            source_file: source.into(),
            ..Default::default()
        }
    }

    #[test]
    fn concurrent_manual_sessions_are_exact() {
        let (core, task_id) = core_with_task();
        let base_rev = core.revision();
        thread::scope(|s| {
            for t in 0..8 {
                let core = &core;
                let task_id = task_id.clone();
                s.spawn(move || {
                    for i in 0..125 {
                        let score = 100.0 + (t * 125 + i) as f64;
                        core.mutate(|d| add_manual_sessions(d, &task_id, "2026-10-12", 40.0, &[score]))
                            .unwrap();
                    }
                });
            }
        });
        let (rev, data) = core.snapshot();
        assert_eq!(data.tasks[0].sessions.len(), 1000);
        assert_eq!(rev - base_rev, 1000);
        assert_eq!(rev, 1001); // 1 create_task + 1000 sessões
        let ids: std::collections::HashSet<_> =
            data.tasks[0].sessions.iter().map(|s| s.id.clone()).collect();
        assert_eq!(ids.len(), 1000);
    }

    #[test]
    fn revision_is_exactly_1000_for_1000_mutations_from_zero() {
        let core = DataCore::new(AppData::default());
        thread::scope(|s| {
            for _ in 0..8 {
                let core = &core;
                s.spawn(move || {
                    for _ in 0..125 {
                        core.mutate(|d| create_task(d, "t", "", "")).unwrap();
                    }
                });
            }
        });
        assert_eq!(core.revision(), 1000);
        assert_eq!(core.snapshot().1.tasks.len(), 1000);
    }

    #[test]
    fn failed_mutation_does_not_bump_revision() {
        let (core, _) = core_with_task();
        let rev = core.revision();
        let err = core.mutate(|d| create_task(d, "   ", "a", "b")).unwrap_err();
        assert_eq!(err, "empty_name");
        assert_eq!(core.revision(), rev);
    }

    #[test]
    fn error_codes_for_missing_ids() {
        let (core, task_id) = core_with_task();
        let e = |r: Result<(), String>| r.unwrap_err();
        let mut data = core.snapshot().1;
        assert_eq!(e(update_task_meta(&mut data, "nope", Some("x"), None, None, None)), "task_not_found");
        assert_eq!(e(update_task_meta(&mut data, &task_id, Some(" "), None, None, None)), "empty_name");
        assert_eq!(e(delete_task(&mut data, "nope")), "task_not_found");
        assert_eq!(e(set_active_task(&mut data, Some("nope"))), "task_not_found");
        assert_eq!(e(delete_session(&mut data, "nope", "s")), "task_not_found");
        assert_eq!(e(delete_session(&mut data, &task_id, "nope")), "session_not_found");
        assert_eq!(e(delete_playlist(&mut data, "nope")), "playlist_not_found");
        assert_eq!(
            add_manual_sessions(&mut data, "nope", "2026-10-12", 40.0, &[1.0]).unwrap_err(),
            "task_not_found"
        );
        assert_eq!(
            add_manual_sessions(&mut data, &task_id, "2026-10-12", 40.0, &[]).unwrap_err(),
            "invalid_payload"
        );
        let pl = Playlist { name: " ".into(), ..Playlist::default() };
        assert_eq!(upsert_playlist(&mut data, pl).unwrap_err(), "empty_name");
        // nada foi alterado pelos erros
        assert!(data.tasks[0].sessions.is_empty());
    }

    #[test]
    fn update_and_delete_task_flow() {
        let mut data = AppData::default();
        let a = create_task(&mut data, " A ", "", "").unwrap();
        let b = create_task(&mut data, "B", "Cat", "Sub").unwrap();
        assert_eq!(data.tasks[0].name, "A");
        assert_eq!(data.tasks[0].category, DEFAULT_CATEGORY);
        assert_eq!(data.active_task_id.as_deref(), Some(b.as_str()));
        update_task_meta(&mut data, &a, Some("A2"), Some("C2"), None, None).unwrap();
        assert_eq!(data.tasks[0].name, "A2");
        assert_eq!(data.tasks[0].category, "C2");
        assert_eq!(data.tasks[0].subcategory, DEFAULT_SUBCATEGORY);
        delete_task(&mut data, &b).unwrap();
        assert_eq!(data.active_task_id.as_deref(), Some(a.as_str()));
        delete_task(&mut data, &a).unwrap();
        assert_eq!(data.active_task_id, None);
    }

    #[test]
    fn set_session_focus_sets_and_clears() {
        let (core, task_id) = core_with_task();
        let (ids, _, _) = core
            .mutate(|d| add_manual_sessions(d, &task_id, "2026-10-12", 40.0, &[100.0]))
            .unwrap();
        let sid = ids[0].clone();
        let mut data = core.snapshot().1;
        set_session_focus(&mut data, &task_id, &sid, Some("on")).unwrap();
        assert_eq!(data.tasks[0].sessions[0].focus.as_deref(), Some("on"));
        set_session_focus(&mut data, &task_id, &sid, Some("auto")).unwrap();
        assert_eq!(data.tasks[0].sessions[0].focus.as_deref(), Some("auto"));
        set_session_focus(&mut data, &task_id, &sid, None).unwrap();
        assert_eq!(data.tasks[0].sessions[0].focus, None);
        assert_eq!(
            set_session_focus(&mut data, &task_id, &sid, Some("bogus")).unwrap_err(),
            "invalid_payload"
        );
        assert_eq!(set_session_focus(&mut data, "nope", &sid, None).unwrap_err(), "task_not_found");
        assert_eq!(
            set_session_focus(&mut data, &task_id, "nope", None).unwrap_err(),
            "session_not_found"
        );
    }

    #[test]
    fn intent_cue_is_trimmed_truncated_and_clearable() {
        let mut data = AppData::default();
        let id = create_task(&mut data, "A", "", "").unwrap();
        let long = "x".repeat(200);
        update_task_meta(&mut data, &id, None, None, None, Some(&long)).unwrap();
        assert_eq!(data.tasks[0].intent_cue.as_ref().unwrap().chars().count(), 80);
        update_task_meta(&mut data, &id, None, None, None, Some("  foco no pulso  ")).unwrap();
        assert_eq!(data.tasks[0].intent_cue.as_deref(), Some("foco no pulso"));
        update_task_meta(&mut data, &id, None, None, None, None).unwrap();
        assert_eq!(data.tasks[0].intent_cue.as_deref(), Some("foco no pulso"));
        update_task_meta(&mut data, &id, None, None, None, Some("  ")).unwrap();
        assert_eq!(data.tasks[0].intent_cue, None);
    }

    #[test]
    fn playlist_upsert_generates_ids_and_replaces() {
        let mut data = AppData::default();
        let mut pl = Playlist { name: "Warmup".into(), ..Playlist::default() };
        pl.items.push(crate::model::PlaylistItem {
            task_id: "t".into(),
            target_mode: "reps".into(),
            target_value: 3.0,
            ..Default::default()
        });
        let id = upsert_playlist(&mut data, pl).unwrap();
        assert!(id.starts_with("pl_"));
        assert!(!data.playlists[0].items[0].id.is_empty());
        assert!(!data.playlists[0].created_at.is_empty());
        assert_eq!(data.playlists[0].source, "user");
        let mut edited = data.playlists[0].clone();
        edited.name = "Warmup 2".into();
        upsert_playlist(&mut data, edited).unwrap();
        assert_eq!(data.playlists.len(), 1);
        assert_eq!(data.playlists[0].name, "Warmup 2");
        delete_playlist(&mut data, &id).unwrap();
        assert!(data.playlists.is_empty());
    }

    #[test]
    fn add_run_dedupes_by_source_file() {
        let core = DataCore::new(AppData::default());
        let first = core
            .mutate_opt(|d| Ok(add_run(d, &run("Scen A", "a.csv"))))
            .unwrap()
            .expect("first run recorded");
        assert!(first.0.is_new_task);
        assert_eq!(first.1, 1);
        let dup = core
            .mutate_opt(|d| Ok(add_run(d, &run("Scen A", "a.csv"))))
            .unwrap();
        assert!(dup.is_none());
        assert_eq!(core.revision(), 1, "duplicata não bumpa a revisão");
        let second = core
            .mutate_opt(|d| Ok(add_run(d, &run("scen a", "b.csv"))))
            .unwrap()
            .unwrap();
        assert!(!second.0.is_new_task);
        assert_eq!(second.0.task_id, first.0.task_id);
        let data = core.snapshot().1;
        assert_eq!(data.tasks.len(), 1);
        assert_eq!(data.tasks[0].sessions.len(), 2);
        assert_eq!(data.tasks[0].sessions[0].date, "2026-10-12");
        assert_eq!(data.active_task_id.as_deref(), Some(first.0.task_id.as_str()));
    }

    #[test]
    fn concurrent_add_run_same_file_records_once() {
        let core = DataCore::new(AppData::default());
        let recorded = AtomicUsize::new(0);
        thread::scope(|s| {
            for _ in 0..8 {
                s.spawn(|| {
                    if core.mutate_opt(|d| Ok(add_run(d, &run("S", "same.csv")))).unwrap().is_some() {
                        recorded.fetch_add(1, Ordering::SeqCst);
                    }
                });
            }
        });
        assert_eq!(recorded.load(Ordering::SeqCst), 1);
        assert_eq!(core.snapshot().1.tasks[0].sessions.len(), 1);
    }

    #[test]
    fn add_runs_batch_5k_existing_plus_5k_new() {
        let mut data = AppData::default();
        let existing: Vec<KovaakRun> = (0..5000)
            .map(|i| run(&format!("Scen {}", i % 50), &format!("old{i}.csv")))
            .collect();
        let first = add_runs_batch(&mut data, &existing, |_, _| false);
        assert_eq!(first, BatchOutcome { new: 5000, skipped: 0 });
        assert_eq!(data.tasks.len(), 50);

        let mut all = existing.clone();
        all.extend((0..5000).map(|i| run(&format!("scen {}", i % 60), &format!("new{i}.csv"))));
        let started = std::time::Instant::now();
        let out = add_runs_batch(&mut data, &all, |_, _| false);
        assert_eq!(out, BatchOutcome { new: 5000, skipped: 5000 });
        assert!(started.elapsed() < Duration::from_secs(5));
        let total: usize = data.tasks.iter().map(|t| t.sessions.len()).sum();
        assert_eq!(total, 10_000);
        assert_eq!(data.tasks.len(), 60, "nomes casam sem diferenciar maiúsculas");
        let sources: std::collections::HashSet<_> = data
            .tasks
            .iter()
            .flat_map(|t| t.sessions.iter().filter_map(|s| s.source_file.clone()))
            .collect();
        assert_eq!(sources.len(), 10_000);
    }

    #[test]
    fn add_runs_batch_dedupes_inside_batch_and_fixes_existing() {
        let mut data = AppData::default();
        let mut stale = run("A", "x.csv");
        stale.sens = 0.5;
        add_runs_batch(&mut data, &[stale], |_, _| false);
        let mut fixed = run("A", "x.csv");
        fixed.sens = 50.0;
        let batch = vec![fixed, run("B", "y.csv"), run("B", "y.csv")];
        let out = add_runs_batch(&mut data, &batch, |s, r| {
            if s.sens > 0.0 && s.sens < 2.5 && r.sens >= 2.5 {
                s.sens = r.sens;
                true
            } else {
                false
            }
        });
        assert_eq!(out, BatchOutcome { new: 2, skipped: 1 });
        assert_eq!(data.tasks[0].sessions[0].sens, 50.0);
        assert_eq!(data.tasks[1].sessions.len(), 1);
    }

    #[test]
    fn replace_all_bumps_revision_and_fixes_state() {
        let (core, _) = core_with_task();
        let rev = core.revision();
        let mut incoming = AppData { active_task_id: Some("ghost".into()), ..AppData::default() };
        incoming.tasks.push(Task { id: "t1".into(), name: "N".into(), ..Task::default() });
        incoming.tasks.push(Task { id: "t1".into(), name: "M".into(), ..Task::default() });
        let (_, new_rev, snap) = core.mutate(|d| { replace_all(d, incoming); Ok(()) }).unwrap();
        assert_eq!(new_rev, rev + 1);
        assert_eq!(snap.tasks.len(), 2);
        assert_ne!(snap.tasks[0].id, snap.tasks[1].id);
        assert_eq!(snap.active_task_id.as_deref(), Some(snap.tasks[0].id.as_str()));
    }

    fn game(name: &str, scenarios: &[(&str, f64)]) -> GamePlaylist {
        GamePlaylist {
            playlist_name: name.into(),
            playlist_id: None,
            scenario_list: scenarios
                .iter()
                .map(|(s, c)| crate::model::GamePlaylistItem {
                    scenario_name: (*s).into(),
                    play_count: *c,
                })
                .collect(),
            description: None,
        }
    }

    fn task_id_of(data: &AppData, name: &str) -> String {
        data.tasks.iter().find(|t| t.name == name).expect("task exists").id.clone()
    }

    fn item(id: &str, task_id: &str, mode: &str, value: f64) -> PlaylistItem {
        PlaylistItem {
            id: id.into(),
            task_id: task_id.into(),
            target_mode: mode.into(),
            target_value: value,
            ..Default::default()
        }
    }

    #[test]
    fn user_playlist_with_same_name_is_untouched() {
        let mut data = AppData::default();
        data.tasks.push(Task { id: "t1".into(), name: "Scen A".into(), ..Task::default() });
        data.playlists.push(Playlist {
            id: "pl_user".into(),
            name: "Warmup".into(),
            items: vec![item("i1", "t1", "time", 90.0)],
            created_at: "2026-01-01".into(),
            auto_advance_mode: None,
            source: "user".into(),
            ..Default::default()
        });
        let before = serde_json::to_string(&data.playlists).unwrap();

        let out = sync_game_playlists(
            &mut data,
            &[game(" warmup ", &[("Scen A", 3.0), ("Scen B", 2.0)])],
            &[],
        )
        .unwrap();

        assert_eq!(out, SyncOutcome { imported: 0, total: 1 });
        assert_eq!(serde_json::to_string(&data.playlists).unwrap(), before);
    }

    #[test]
    fn reordered_game_playlist_keeps_targets_by_task_id() {
        let mut data = AppData::default();
        let first = sync_game_playlists(&mut data, &[game("Routine", &[("A", 1.0), ("B", 1.0)])], &[])
            .unwrap();
        assert_eq!(first, SyncOutcome { imported: 1, total: 1 });
        let (a, b) = (task_id_of(&data, "A"), task_id_of(&data, "B"));
        {
            let items = &mut data.playlists[0].items;
            items[0].target_mode = "time".into();
            items[0].target_value = 90.0;
            items[1].target_value = 7.0;
        }

        let out = sync_game_playlists(
            &mut data,
            &[game("Routine", &[("B", 1.0), ("C", 4.0), ("A", 1.0)])],
            &[],
        )
        .unwrap();

        assert_eq!(out, SyncOutcome { imported: 0, total: 1 });
        let c = task_id_of(&data, "C");
        let pl = &data.playlists[0];
        assert_eq!(pl.source, "kovaak");
        let got: Vec<(&str, &str, f64)> = pl
            .items
            .iter()
            .map(|i| (i.task_id.as_str(), i.target_mode.as_str(), i.target_value))
            .collect();
        assert_eq!(
            got,
            vec![
                (b.as_str(), "reps", 7.0),
                (c.as_str(), "reps", 4.0),
                (a.as_str(), "time", 90.0),
            ]
        );
    }

    #[test]
    fn unchanged_game_playlist_is_not_rebuilt() {
        let mut data = AppData::default();
        sync_game_playlists(&mut data, &[game("Routine", &[("A", 1.0), ("B", 2.0)])], &[]).unwrap();
        data.playlists[0].items[0].target_value = 90.0;
        let before = serde_json::to_string(&data.playlists).unwrap();

        // mesmo conteúdo, com caixa diferente no nome do cenário: mesma tarefa, nada muda
        let out = sync_game_playlists(&mut data, &[game("Routine", &[("a", 1.0), ("B", 2.0)])], &[])
            .unwrap();

        assert_eq!(out, SyncOutcome { imported: 0, total: 1 });
        assert_eq!(serde_json::to_string(&data.playlists).unwrap(), before, "ids e alvos intactos");
        assert_eq!(data.tasks.len(), 2);
    }

    #[test]
    fn new_playlists_get_their_game_source_and_clean_names() {
        let mut data = AppData::default();
        let out = sync_game_playlists(
            &mut data,
            &[game("Kovaak Pack", &[("CsLevel.Lowgravity56.VT Suave.RX1H0T", 2.0)])],
            &[game("Aim Lab Path", &[("Pasu Small", 0.0)])],
        )
        .unwrap();

        assert_eq!(out, SyncOutcome { imported: 2, total: 2 });
        let kovaak = data.playlists.iter().find(|p| p.name == "Kovaak Pack").unwrap();
        assert_eq!(kovaak.source, "kovaak");
        assert_eq!(kovaak.items[0].target_value, 2.0);
        assert_eq!(kovaak.items[0].target_mode, "reps");
        assert_eq!(kovaak.items[0].task_id, task_id_of(&data, "VT Suave"));
        let aimlab = data.playlists.iter().find(|p| p.name == "Aim Lab Path").unwrap();
        assert_eq!(aimlab.source, "aimlab");
        assert_eq!(aimlab.items[0].target_value, 1.0, "0 vira 1");
        assert!(data.playlists.iter().all(|p| !p.id.is_empty() && !p.created_at.is_empty()));
        assert_eq!(data.tasks.len(), 2);
        assert!(data.tasks.iter().all(|t| t.category == DEFAULT_CATEGORY && t.subcategory == DEFAULT_SUBCATEGORY));
    }

    #[test]
    fn legacy_user_playlist_with_identical_tasks_is_migrated() {
        let mut data = AppData::default();
        data.tasks.push(Task { id: "tA".into(), name: "A".into(), ..Task::default() });
        data.tasks.push(Task { id: "tB".into(), name: "B".into(), ..Task::default() });
        data.playlists.push(Playlist {
            id: "pl_old".into(),
            name: "Routine".into(),
            items: vec![item("i1", "tA", "time", 60.0), item("i2", "tB", "reps", 3.0)],
            created_at: "2026-01-01".into(),
            auto_advance_mode: None,
            source: "user".into(),
            ..Default::default()
        });

        let out = sync_game_playlists(&mut data, &[game("routine", &[("A", 1.0), ("B", 1.0)])], &[])
            .unwrap();

        assert_eq!(out, SyncOutcome { imported: 0, total: 1 });
        let pl = &data.playlists[0];
        assert_eq!(pl.id, "pl_old");
        assert_eq!(pl.source, "kovaak");
        assert_eq!(pl.items.len(), 2);
        assert_eq!((pl.items[0].target_mode.as_str(), pl.items[0].target_value), ("time", 60.0));
        assert_eq!((pl.items[1].target_mode.as_str(), pl.items[1].target_value), ("reps", 3.0));
    }

    #[test]
    fn clean_name_and_target_rules_match_the_ts_fallback() {
        assert_eq!(clean_scenario_name("CsLevel.Lowgravity56.VT Suave.RX1H0T"), "VT Suave");
        assert_eq!(clean_scenario_name("CsLevel.VT Float.QZWM5U"), "VT Float");
        assert_eq!(clean_scenario_name("CsLevel-abc123"), "abc123");
        assert_eq!(clean_scenario_name("CsLevel"), "CsLevel");
        assert_eq!(clean_scenario_name("  Plain  "), "Plain");
        assert_eq!(target_reps(2.5), 3.0);
        assert_eq!(target_reps(0.2), 1.0);
        assert_eq!(target_reps(0.0), 1.0);
    }

    fn counting_persister(debounce_ms: u64) -> (Arc<DataCore>, Persister, Arc<AtomicUsize>, Arc<Mutex<usize>>) {
        let core = Arc::new(DataCore::new(AppData::default()));
        let writes = Arc::new(AtomicUsize::new(0));
        let last_tasks = Arc::new(Mutex::new(0usize));
        let (w, lt) = (writes.clone(), last_tasks.clone());
        let persister = Persister::spawn(core.clone(), Duration::from_millis(debounce_ms), move |d| {
            w.fetch_add(1, Ordering::SeqCst);
            *lt.lock().unwrap() = d.tasks.len();
            Ok(())
        });
        (core, persister, writes, last_tasks)
    }

    #[test]
    fn persister_writes_once_per_burst() {
        let (core, persister, writes, last) = counting_persister(150);
        for _ in 0..100 {
            core.mutate(|d| create_task(d, "t", "", "")).unwrap();
            persister.mark_dirty();
        }
        assert_eq!(writes.load(Ordering::SeqCst), 0, "ainda dentro do debounce");
        thread::sleep(Duration::from_millis(600));
        assert_eq!(writes.load(Ordering::SeqCst), 1);
        assert_eq!(*last.lock().unwrap(), 100);

        // segunda rajada => segunda escrita
        core.mutate(|d| create_task(d, "t", "", "")).unwrap();
        persister.mark_dirty();
        thread::sleep(Duration::from_millis(600));
        assert_eq!(writes.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn persister_flush_writes_immediately_and_only_when_dirty() {
        let (core, persister, writes, last) = counting_persister(5_000);
        persister.flush().unwrap();
        assert_eq!(writes.load(Ordering::SeqCst), 0, "sem mudança, sem escrita");
        core.mutate(|d| create_task(d, "t", "", "")).unwrap();
        persister.mark_dirty();
        persister.flush().unwrap();
        assert_eq!(writes.load(Ordering::SeqCst), 1);
        assert_eq!(*last.lock().unwrap(), 1);
        persister.flush().unwrap();
        assert_eq!(writes.load(Ordering::SeqCst), 1, "flush repetido não regrava");
    }

    #[test]
    fn persister_flush_reports_writer_error_and_retries() {
        let core = Arc::new(DataCore::new(AppData::default()));
        let fail = Arc::new(std::sync::atomic::AtomicBool::new(true));
        let f = fail.clone();
        let persister = Persister::spawn(core.clone(), Duration::from_millis(5_000), move |_| {
            if f.load(Ordering::SeqCst) { Err("disk".into()) } else { Ok(()) }
        });
        core.mutate(|d| create_task(d, "t", "", "")).unwrap();
        persister.mark_dirty();
        assert_eq!(persister.flush().unwrap_err(), "disk");
        fail.store(false, Ordering::SeqCst);
        persister.flush().unwrap();
    }
}
