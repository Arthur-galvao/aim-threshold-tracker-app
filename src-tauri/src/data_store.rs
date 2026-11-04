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
    AppData, GamePlaylist, KovaakRun, Playlist, Session, Task, DEFAULT_CATEGORY,
    DEFAULT_SUBCATEGORY,
};
use crate::watcher::unique_id;

pub const ERR_EMPTY_NAME: &str = "empty_name";
pub const ERR_TASK_NOT_FOUND: &str = "task_not_found";
pub const ERR_SESSION_NOT_FOUND: &str = "session_not_found";
pub const ERR_PLAYLIST_NOT_FOUND: &str = "playlist_not_found";
pub const ERR_INVALID_PAYLOAD: &str = "invalid_payload";
pub const ERR_NOT_IMPLEMENTED: &str = "not_implemented";

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
    }
}

fn new_task_for_run(run: &KovaakRun, session: Session) -> Task {
    Task {
        id: unique_id("task"),
        name: run.scenario.clone(),
        category: DEFAULT_CATEGORY.to_string(),
        subcategory: DEFAULT_SUBCATEGORY.to_string(),
        sessions: vec![session],
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
    pub imported: usize,
}

/// T2.5: sincroniza playlists dos jogos (KovaaK's / Aim Lab) com `data.playlists`.
/// Ainda não implementado: o front cai no fallback em TS ao receber "not_implemented".
pub fn sync_game_playlists(
    _data: &mut AppData,
    _game_playlists: &[GamePlaylist],
) -> Result<SyncOutcome, String> {
    Err(ERR_NOT_IMPLEMENTED.to_string())
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
        assert_eq!(e(update_task_meta(&mut data, "nope", Some("x"), None, None)), "task_not_found");
        assert_eq!(e(update_task_meta(&mut data, &task_id, Some(" "), None, None)), "empty_name");
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
        update_task_meta(&mut data, &a, Some("A2"), Some("C2"), None).unwrap();
        assert_eq!(data.tasks[0].name, "A2");
        assert_eq!(data.tasks[0].category, "C2");
        assert_eq!(data.tasks[0].subcategory, DEFAULT_SUBCATEGORY);
        delete_task(&mut data, &b).unwrap();
        assert_eq!(data.active_task_id.as_deref(), Some(a.as_str()));
        delete_task(&mut data, &a).unwrap();
        assert_eq!(data.active_task_id, None);
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

    #[test]
    fn sync_game_playlists_is_a_stub_for_now() {
        let mut data = AppData::default();
        assert_eq!(sync_game_playlists(&mut data, &[]).unwrap_err(), "not_implemented");
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
