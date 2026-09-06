use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use notify::{Event, EventKind, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::model::{
    AppData, ImportStats, KovaakRun, Session, Task, DEFAULT_CATEGORY, DEFAULT_SUBCATEGORY,
};
use crate::parser;
use crate::storage;
use crate::AppState;

pub struct WatcherHandle {
    shutdown: Arc<AtomicBool>,
    thread: Option<thread::JoinHandle<()>>,
}

impl WatcherHandle {
    pub fn stop(&mut self) {
        self.shutdown.store(true, Ordering::Relaxed);
        if let Some(handle) = self.thread.take() {
            let _ = handle.join();
        }
    }
}

pub fn spawn(app: AppHandle, path: PathBuf) -> Result<WatcherHandle, String> {
    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_loop = shutdown.clone();

    let thread = thread::Builder::new()
        .name("kovaak-watcher".into())
        .spawn(move || {
            let (tx, rx) = mpsc::channel::<Event>();

            let mut watcher = match notify::recommended_watcher(
                move |res: Result<Event, notify::Error>| {
                    if let Ok(event) = res {
                        let _ = tx.send(event);
                    }
                },
            ) {
                Ok(w) => w,
                Err(e) => {
                    let _ = app.emit("watcher_error", format!("Falha ao criar watcher: {e}"));
                    return;
                }
            };

            if let Err(e) = watcher.watch(&path, RecursiveMode::NonRecursive) {
                let _ = app.emit(
                    "watcher_error",
                    format!("Falha ao observar a pasta {}: {e}", path.display()),
                );
                return;
            }

            while !shutdown_loop.load(Ordering::Relaxed) {
                match rx.recv_timeout(Duration::from_millis(500)) {
                    Ok(event) => handle_event(&app, event),
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => break,
                }
            }
        })
        .map_err(|e| format!("Falha ao iniciar thread do watcher: {e}"))?;

    Ok(WatcherHandle {
        shutdown,
        thread: Some(thread),
    })
}

fn handle_event(app: &AppHandle, event: Event) {
    if !matches!(event.kind, EventKind::Create(_)) {
        return;
    }
    for path in event.paths {
        if is_stats_csv(&path) {
            let app = app.clone();
            thread::spawn(move || {
                let _ = process_new_csv(&app, &path);
            });
        }
    }
}

fn is_stats_csv(path: &Path) -> bool {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    name.ends_with(".csv") && name.contains("stats")
}

fn process_new_csv(app: &AppHandle, path: &Path) -> Result<bool, String> {
    let run = wait_for_parse(path)?;

    let state: State<AppState> = app.state();
    {
        let mut emitted = state.emitted.lock().unwrap();
        if !emitted.insert(run.source_file.clone()) {
            return Ok(false);
        }
    }
    let already_imported = {
        let data = state.data.lock().unwrap();
        has_source_file(&data.tasks, &run.source_file)
    };
    if already_imported {
        return Ok(false);
    }

    app.emit("new_run", &run).map_err(|e| e.to_string())?;

    let is_randomizer_enabled = {
        let s = state.settings.lock().unwrap();
        s.randomizer.enabled
    };

    if is_randomizer_enabled {
        let app_clone = app.clone();
        let scenario = run.scenario.clone();
        let score = run.score;
        thread::spawn(move || {
            let _ = crate::randomizer::apply_next_sens(&app_clone, Some(scenario), Some(score));
        });
    }

    Ok(true)
}

fn wait_for_parse(path: &Path) -> Result<KovaakRun, String> {
    let mut attempts = 0;
    loop {
        thread::sleep(Duration::from_millis(1000));
        if let Some(run) = parser::parse_stats_file(path) {
            return Ok(run);
        }
        attempts += 1;
        if attempts >= 10 {
            return Err(format!("Não foi possível ler o CSV: {}", path.display()));
        }
    }
}

pub fn import_existing(app: &AppHandle) -> Result<ImportStats, String> {
    let state: State<AppState> = app.state();

    let dir = {
        let settings = state.settings.lock().unwrap();
        settings
            .kovaak_stats_path
            .clone()
            .ok_or_else(|| "Nenhuma pasta do KovaaK's configurada".to_string())?
    };
    let dir = PathBuf::from(dir);

    let entries = fs::read_dir(&dir).map_err(|e| format!("Falha ao ler a pasta {}: {e}", dir.display()))?;
    let mut csvs: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| is_stats_csv(p))
        .collect();
    csvs.sort();

    let total = csvs.len();
    let mut new = 0usize;
    let mut skipped = 0usize;

    for path in &csvs {
        let run = match parser::parse_stats_file(path) {
            Some(r) => r,
            None => {
                skipped += 1;
                continue;
            }
        };

        let already = {
            let data = state.data.lock().unwrap();
            has_source_file(&data.tasks, &run.source_file)
        };
        if already {
            // Update session sensitivity if it changed (e.g. was 0.24, now converted to 68.0 cm/360)
            let mut data = state.data.lock().unwrap();
            for task in &mut data.tasks {
                for session in &mut task.sessions {
                    if session.source_file.as_deref() == Some(&run.source_file) {
                        if (session.sens - run.sens).abs() > 0.001 {
                            session.sens = run.sens;
                            new += 1;
                        }
                    }
                }
            }
            skipped += 1;
            continue;
        }

        add_session_to_data(&state, &run);
        new += 1;
    }

    if new > 0 {
        let data = state.data.lock().unwrap().clone();
        storage::save_app_data(app, &data)?;
    }

    let stats = ImportStats {
        total,
        new,
        skipped,
    };
    app.emit("import_complete", &stats).map_err(|e| e.to_string())?;
    Ok(stats)
}

pub fn migrate_existing_sensitivities(data: &mut AppData, stats_dir: Option<&str>) -> bool {
    let mut updated = false;
    let base_dir = stats_dir.map(PathBuf::from);

    for task in &mut data.tasks {
        for session in &mut task.sessions {
            // Any sensitivity < 2.5 is clearly an in-game sens rather than physical cm/360
            if session.sens > 0.0 && session.sens < 2.5 {
                let mut converted = false;

                // Try to re-parse from source file if available
                if let (Some(ref dir), Some(ref file_name)) = (&base_dir, &session.source_file) {
                    let csv_path = dir.join(file_name);
                    if csv_path.exists() {
                        if let Some(run) = parser::parse_stats_file(&csv_path) {
                            if run.sens > 2.5 {
                                session.sens = run.sens;
                                converted = true;
                                updated = true;
                            }
                        }
                    }
                }

                // If source file not found or couldn't be parsed, fallback to Valorant conversion
                if !converted {
                    session.sens = parser::convert_sens_to_cm(session.sens, Some("Valorant"), 800.0);
                    updated = true;
                }
            }
        }
    }

    updated
}

fn has_source_file(tasks: &[Task], source_file: &str) -> bool {
    tasks
        .iter()
        .any(|t| t.sessions.iter().any(|s| s.source_file.as_deref() == Some(source_file)))
}

fn add_session_to_data(state: &State<AppState>, run: &KovaakRun) {
    let date = run.datetime.get(..10).unwrap_or("").to_string();
    let session = Session {
        id: format!("sess_{}", timestamp_id()),
        date,
        sens: run.sens,
        pb: run.score,
        threshold: 0.0,
        source_file: Some(run.source_file.clone()),
    };

    let mut data = state.data.lock().unwrap();

    if let Some(task) = data
        .tasks
        .iter_mut()
        .find(|t| t.name.eq_ignore_ascii_case(&run.scenario))
    {
        task.sessions.push(session);
        return;
    }

    let task = Task {
        id: format!("task_{}", timestamp_id()),
        name: run.scenario.clone(),
        category: DEFAULT_CATEGORY.to_string(),
        subcategory: DEFAULT_SUBCATEGORY.to_string(),
        sessions: vec![session],
    };

    if data.active_task_id.is_none() {
        data.active_task_id = Some(task.id.clone());
    }
    data.tasks.push(task);
}

fn timestamp_id() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}