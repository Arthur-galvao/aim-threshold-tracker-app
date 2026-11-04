use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};

use serde::de::DeserializeOwned;
use tauri::{AppHandle, Manager};

use crate::model::{AppData, AppSettings};

pub const APP_DATA_FILE: &str = "app_data.json";
pub const APP_DATA_BACKUPS: usize = 5;
pub const SETTINGS_FILE: &str = "settings.json";
pub const SETTINGS_BACKUPS: usize = 3;

/// Resultado do carregamento de um arquivo de dados.
/// `kind`: "loaded" | "missing" | "recovered".
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadReport {
    pub kind: String,
    pub quarantined: Option<String>,
    pub from_backup: Option<String>,
}

impl LoadReport {
    pub fn loaded() -> Self {
        Self { kind: "loaded".into(), quarantined: None, from_backup: None }
    }

    pub fn missing() -> Self {
        Self { kind: "missing".into(), quarantined: None, from_backup: None }
    }
}

pub fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Falha ao resolver app_data_dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Falha ao criar app_data_dir: {e}"))?;
    Ok(dir)
}

pub fn sanitize_app_data(data: &mut AppData) -> bool {
    let mut changed = false;
    let mut seen_task_ids = std::collections::HashSet::new();
    let mut seen_session_ids = std::collections::HashSet::new();

    for task in &mut data.tasks {
        if task.id.is_empty() || seen_task_ids.contains(&task.id) {
            task.id = crate::watcher::unique_id("task");
            changed = true;
        }
        seen_task_ids.insert(task.id.clone());

        for session in &mut task.sessions {
            if session.id.is_empty() || seen_session_ids.contains(&session.id) {
                session.id = crate::watcher::unique_id("sess");
                changed = true;
            }
            seen_session_ids.insert(session.id.clone());
        }
    }

    changed
}

pub fn load_app_data(app: &AppHandle) -> (AppData, LoadReport) {
    let dir = match data_dir(app) {
        Ok(dir) => dir,
        Err(e) => {
            eprintln!("[storage] {e}");
            return (AppData::default(), LoadReport::missing());
        }
    };
    let (mut data, report) = load_with_recovery::<AppData>(&dir, APP_DATA_FILE, APP_DATA_BACKUPS);
    if sanitize_app_data(&mut data) {
        let _ = save_app_data(app, &data);
    }
    (data, report)
}

pub fn save_app_data(app: &AppHandle, data: &AppData) -> Result<(), String> {
    let dir = data_dir(app)?;
    write_json(&dir.join(APP_DATA_FILE), data)
}

pub fn load_settings(app: &AppHandle) -> (AppSettings, LoadReport) {
    match data_dir(app) {
        Ok(dir) => load_with_recovery::<AppSettings>(&dir, SETTINGS_FILE, SETTINGS_BACKUPS),
        Err(e) => {
            eprintln!("[storage] {e}");
            (AppSettings::default(), LoadReport::missing())
        }
    }
}

pub fn save_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let dir = data_dir(app)?;
    write_json(&dir.join(SETTINGS_FILE), settings)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RawAccelBackup {
    pub output_dpi: Option<f64>,
    pub scale_whole: Option<f64>,
    pub scale_vert: Option<f64>,
    pub last_written_output_dpi: Option<f64>,
    pub last_written_scale: Option<f64>,
    pub saved_at: String,
}

pub fn load_rawaccel_backup(app: &AppHandle) -> Option<RawAccelBackup> {
    data_dir(app).ok().and_then(|d| read_json(d.join("rawaccel_backup.json")).ok())
}

pub fn save_rawaccel_backup(app: &AppHandle, backup: &RawAccelBackup) -> Result<(), String> {
    let dir = data_dir(app)?;
    write_json(&dir.join("rawaccel_backup.json"), backup)
}

/// Escrita atômica: grava em `<nome>.tmp` ao lado do destino, sincroniza e renomeia por cima.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let file_name = path
        .file_name()
        .ok_or_else(|| format!("Caminho sem nome de arquivo: {}", path.display()))?;
    let mut tmp_name = file_name.to_os_string();
    tmp_name.push(".tmp");
    let tmp_path = path.with_file_name(tmp_name);

    if let Err(e) = write_and_sync(&tmp_path, bytes) {
        let _ = fs::remove_file(&tmp_path);
        return Err(format!("Falha ao escrever arquivo temporário: {e}"));
    }

    fs::rename(&tmp_path, path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        format!("Falha ao substituir arquivo final: {e}")
    })
}

fn write_and_sync(tmp_path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let mut file = fs::File::create(tmp_path)?;
    file.write_all(bytes)?;
    file.sync_all()
}

/// Carrega `dir/name`. Arquivo ausente vira default ("missing"). Arquivo que não parseia
/// é renomeado para `<stem>.corrupt-<timestamp>.json` e o backup válido mais recente é
/// usado (restaurado em `dir/name`); sem backup, devolve o default sem gravar nada.
pub fn load_with_recovery<T>(dir: &Path, name: &str, keep: usize) -> (T, LoadReport)
where
    T: DeserializeOwned + Default,
{
    let path = dir.join(name);
    match fs::read_to_string(&path) {
        Ok(text) => match serde_json::from_str::<T>(&text) {
            Ok(data) => (data, LoadReport::loaded()),
            Err(e) => {
                eprintln!("[storage] {} inválido: {e}", path.display());
                recover::<T>(dir, name, keep)
            }
        },
        Err(e) if e.kind() == ErrorKind::NotFound => (T::default(), LoadReport::missing()),
        Err(e) => {
            eprintln!("[storage] falha ao ler {}: {e}", path.display());
            recover::<T>(dir, name, keep)
        }
    }
}

fn recover<T>(dir: &Path, name: &str, keep: usize) -> (T, LoadReport)
where
    T: DeserializeOwned + Default,
{
    let path = dir.join(name);
    let quarantined = quarantine(dir, name);
    let quarantined_str = quarantined.as_ref().map(|p| p.to_string_lossy().into_owned());

    match latest_valid_backup::<T>(dir, name, keep) {
        Some((data, backup)) => {
            // Só regrava o arquivo principal se o original já está preservado no quarentenado.
            if quarantined.is_some() {
                let restored = fs::read(&backup)
                    .map_err(|e| e.to_string())
                    .and_then(|bytes| atomic_write(&path, &bytes));
                if let Err(e) = restored {
                    eprintln!("[storage] falha ao restaurar backup: {e}");
                }
            }
            (
                data,
                LoadReport {
                    kind: "recovered".into(),
                    quarantined: quarantined_str,
                    from_backup: Some(backup.to_string_lossy().into_owned()),
                },
            )
        }
        None => (
            T::default(),
            LoadReport {
                kind: "recovered".into(),
                quarantined: quarantined_str,
                from_backup: None,
            },
        ),
    }
}

/// Move o arquivo corrompido para `<stem>.corrupt-<timestamp>.json`. Se o rename falhar,
/// copia. Retorna `None` só se nenhum dos dois funcionou (original fica no lugar).
fn quarantine(dir: &Path, name: &str) -> Option<PathBuf> {
    let path = dir.join(name);
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let target = unique_path(dir, &format!("{}.corrupt-{stamp}", backup_stem(name)), "json");

    if fs::rename(&path, &target).is_ok() {
        return Some(target);
    }
    match fs::copy(&path, &target) {
        Ok(_) => Some(target),
        Err(e) => {
            eprintln!("[storage] falha ao preservar {}: {e}", path.display());
            None
        }
    }
}

fn backup_stem(name: &str) -> String {
    Path::new(name)
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| name.to_string())
}

fn backup_file(dir: &Path, name: &str, index: usize) -> PathBuf {
    dir.join("backups").join(format!("{}.{index}.json", backup_stem(name)))
}

/// Primeiro caminho `<base>.<ext>` (ou `<base>-N.<ext>`) que ainda não existe em `dir`.
fn unique_path(dir: &Path, base: &str, ext: &str) -> PathBuf {
    let first = dir.join(format!("{base}.{ext}"));
    if !first.exists() {
        return first;
    }
    let mut n = 2;
    loop {
        let candidate = dir.join(format!("{base}-{n}.{ext}"));
        if !candidate.exists() {
            return candidate;
        }
        n += 1;
    }
}

/// Backups rotativos em `dir/backups/`: `<stem>.1.json` é o mais novo, `<stem>.<keep>.json` o mais antigo.
/// Copia `dir/name` (se existir) para `.1`, empurrando os demais.
pub fn rotate_backups(dir: &Path, name: &str, keep: usize) -> Result<(), String> {
    if keep == 0 {
        return Ok(());
    }
    let source = dir.join(name);
    if !source.exists() {
        return Ok(());
    }

    let backups = dir.join("backups");
    fs::create_dir_all(&backups).map_err(|e| format!("Falha ao criar pasta de backups: {e}"))?;

    let bytes = fs::read(&source).map_err(|e| format!("Falha ao ler para backup: {e}"))?;
    // Sem mudança desde o último backup: não gira (evita encher os slots com cópias iguais).
    if fs::read(backup_file(dir, name, 1)).is_ok_and(|prev| prev == bytes) {
        return Ok(());
    }

    let oldest = backup_file(dir, name, keep);
    if oldest.exists() {
        fs::remove_file(&oldest).map_err(|e| format!("Falha ao remover backup antigo: {e}"))?;
    }
    for index in (1..keep).rev() {
        let from = backup_file(dir, name, index);
        if from.exists() {
            fs::rename(&from, backup_file(dir, name, index + 1))
                .map_err(|e| format!("Falha ao girar backup: {e}"))?;
        }
    }

    atomic_write(&backup_file(dir, name, 1), &bytes)
}

/// Backup mais recente (1..=keep) que parseia como `T`.
pub fn latest_valid_backup<T: DeserializeOwned>(dir: &Path, name: &str, keep: usize) -> Option<(T, PathBuf)> {
    for index in 1..=keep {
        let path = backup_file(dir, name, index);
        let Ok(text) = fs::read_to_string(&path) else {
            continue;
        };
        if let Ok(data) = serde_json::from_str::<T>(&text) {
            return Some((data, path));
        }
    }
    None
}

/// Cópia do estado atual em `dir/backups/pre-<reason>-<timestamp>.json`, antes de uma
/// substituição total dos dados (`reason`: "import", "demo", "clear").
pub fn write_pre_backup(dir: &Path, reason: &str, data: &AppData) -> Result<PathBuf, String> {
    let backups = dir.join("backups");
    fs::create_dir_all(&backups).map_err(|e| format!("Falha ao criar pasta de backups: {e}"))?;
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let target = unique_path(&backups, &format!("pre-{reason}-{stamp}"), "json");
    let bytes = serde_json::to_vec(data).map_err(|e| e.to_string())?;
    atomic_write(&target, &bytes)?;
    Ok(target)
}

/// Cópia do estado atual em `dir/backups/pre-import-<timestamp>.json`, antes de um import.
pub fn write_pre_import_backup(dir: &Path, data: &AppData) -> Result<PathBuf, String> {
    write_pre_backup(dir, "import", data)
}

fn read_json<T: serde::de::DeserializeOwned>(path: PathBuf) -> Result<T, String> {
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

fn write_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let bytes = serde_json::to_vec(value).map_err(|e| e.to_string())?;
    atomic_write(path, &bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Session, Task};

    fn temp_case_dir(tag: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("att_storage_{tag}_{nanos}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn sample_data(task_id: &str) -> AppData {
        AppData {
            active_task_id: None,
            tasks: vec![Task {
                id: task_id.into(),
                name: "Task".into(),
                category: "Clicking".into(),
                subcategory: "Precision".into(),
                sessions: vec![],
            }],
            playlists: vec![],
            ..Default::default()
        }
    }

    #[test]
    fn test_sanitize_app_data_deduplicates_tasks_and_sessions() {
        let mut data = AppData {
            active_task_id: Some("task_1".into()),
            tasks: vec![
                Task {
                    id: "task_dupe".into(),
                    name: "Task A".into(),
                    category: "Clicking".into(),
                    subcategory: "Precision".into(),
                    sessions: vec![
                        Session {
                            id: "sess_dupe".into(),
                            date: "2026-10-10".into(),
                            sens: 50.0,
                            pb: 100.0,
                            threshold: 90.0,
                            source_file: None,
                            ..Default::default()
                        },
                    ],
                },
                Task {
                    id: "task_dupe".into(),
                    name: "Task B".into(),
                    category: "Clicking".into(),
                    subcategory: "Precision".into(),
                    sessions: vec![
                        Session {
                            id: "sess_dupe".into(),
                            date: "2026-10-10".into(),
                            sens: 50.0,
                            pb: 110.0,
                            threshold: 95.0,
                            source_file: None,
                            ..Default::default()
                        },
                    ],
                },
            ],
            playlists: vec![],
            ..Default::default()
        };

        let changed = sanitize_app_data(&mut data);
        assert!(changed);
        assert_ne!(data.tasks[0].id, data.tasks[1].id);
        assert_ne!(data.tasks[0].sessions[0].id, data.tasks[1].sessions[0].id);
        assert_eq!(data.tasks[0].id, "task_dupe");
        assert!(data.tasks[1].id.starts_with("task_"));
    }

    #[test]
    fn atomic_write_roundtrip_leaves_no_tmp() {
        let dir = temp_case_dir("roundtrip");
        let target = dir.join("app_data.json");

        atomic_write(&target, b"{\"a\":1}").expect("first write");
        assert_eq!(fs::read(&target).unwrap(), b"{\"a\":1}");
        assert!(!dir.join("app_data.json.tmp").exists());

        atomic_write(&target, b"{\"a\":2}").expect("overwrite");
        assert_eq!(fs::read_to_string(&target).unwrap(), "{\"a\":2}");
        assert!(!dir.join("app_data.json.tmp").exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn atomic_write_into_missing_dir_returns_err() {
        let dir = temp_case_dir("missing_dir");
        let target = dir.join("nope").join("app_data.json");
        assert!(atomic_write(&target, b"{}").is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn truncated_json_is_quarantined_and_not_overwritten() {
        let dir = temp_case_dir("truncated");
        let original = r#"{"tasks":[{"id":"a""#;
        fs::write(dir.join("app_data.json"), original).unwrap();

        let (data, report): (AppData, LoadReport) = load_with_recovery(&dir, "app_data.json", 5);
        assert_eq!(report.kind, "recovered");
        assert!(report.from_backup.is_none());
        assert!(data.tasks.is_empty());

        let quarantined = PathBuf::from(report.quarantined.expect("quarantined path"));
        let file_name = quarantined.file_name().unwrap().to_string_lossy().into_owned();
        assert!(file_name.starts_with("app_data.corrupt-"), "got {file_name}");
        assert!(file_name.ends_with(".json"));
        assert_eq!(fs::read_to_string(&quarantined).unwrap(), original);

        // Nenhum default foi gravado no lugar do arquivo original.
        assert!(!dir.join("app_data.json").exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn recovers_from_latest_valid_backup() {
        let dir = temp_case_dir("backup_recovery");
        let good = serde_json::to_string(&sample_data("backup_task")).unwrap();
        fs::write(dir.join("app_data.json"), &good).unwrap();
        rotate_backups(&dir, "app_data.json", 5).expect("rotate");

        fs::write(dir.join("app_data.json"), r#"{"tasks":[{"id":"a""#).unwrap();

        let (data, report): (AppData, LoadReport) = load_with_recovery(&dir, "app_data.json", 5);
        assert_eq!(report.kind, "recovered");
        assert!(report.from_backup.is_some());
        assert!(report.quarantined.is_some());
        assert_eq!(data.tasks.len(), 1);
        assert_eq!(data.tasks[0].id, "backup_task");

        // O arquivo principal foi restaurado a partir do backup, então o próximo boot carrega normalmente.
        let (again, next): (AppData, LoadReport) = load_with_recovery(&dir, "app_data.json", 5);
        assert_eq!(next.kind, "loaded");
        assert_eq!(again.tasks[0].id, "backup_task");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_file_loads_default_with_missing_report() {
        let dir = temp_case_dir("missing_file");
        let (data, report): (AppData, LoadReport) = load_with_recovery(&dir, "app_data.json", 5);
        assert_eq!(report.kind, "missing");
        assert!(data.tasks.is_empty());
        assert!(!dir.join("app_data.json").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rotate_backups_keeps_five_newest_first() {
        let dir = temp_case_dir("rotate");
        for i in 1..=6 {
            fs::write(dir.join("app_data.json"), format!("{{\"n\":{i}}}")).unwrap();
            rotate_backups(&dir, "app_data.json", 5).expect("rotate");
        }

        let backups = dir.join("backups");
        let count = fs::read_dir(&backups).unwrap().count();
        assert_eq!(count, 5);
        assert_eq!(fs::read_to_string(backups.join("app_data.1.json")).unwrap(), "{\"n\":6}");
        assert_eq!(fs::read_to_string(backups.join("app_data.5.json")).unwrap(), "{\"n\":2}");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rotate_backups_skips_unchanged_content() {
        let dir = temp_case_dir("rotate_same");
        fs::write(dir.join("app_data.json"), "{\"n\":1}").unwrap();
        for _ in 0..4 {
            rotate_backups(&dir, "app_data.json", 5).expect("rotate");
        }
        assert_eq!(fs::read_dir(dir.join("backups")).unwrap().count(), 1);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn latest_valid_backup_skips_broken_newest() {
        let dir = temp_case_dir("skip_broken");
        fs::write(dir.join("app_data.json"), serde_json::to_string(&sample_data("a")).unwrap()).unwrap();
        rotate_backups(&dir, "app_data.json", 5).expect("rotate a");
        fs::write(dir.join("app_data.json"), serde_json::to_string(&sample_data("b")).unwrap()).unwrap();
        rotate_backups(&dir, "app_data.json", 5).expect("rotate b");

        // .1 (b) fica corrompido; deve cair para .2 (a).
        fs::write(dir.join("backups").join("app_data.1.json"), r#"{"tasks":["#).unwrap();

        let (data, path): (AppData, PathBuf) =
            latest_valid_backup(&dir, "app_data.json", 5).expect("valid backup");
        assert!(path.ends_with("app_data.2.json"));
        assert_eq!(data.tasks[0].id, "a");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn pre_backup_uses_the_reason_in_the_file_name() {
        let dir = temp_case_dir("pre_demo");
        let path = write_pre_backup(&dir, "demo", &sample_data("current")).expect("pre-demo backup");
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        assert!(name.starts_with("pre-demo-") && name.ends_with(".json"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn pre_import_backup_is_written_under_backups() {
        let dir = temp_case_dir("pre_import");
        let path = write_pre_import_backup(&dir, &sample_data("current")).expect("pre-import backup");
        assert!(path.starts_with(dir.join("backups")));
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        assert!(name.starts_with("pre-import-") && name.ends_with(".json"));
        let saved: AppData = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(saved.tasks[0].id, "current");
        let _ = fs::remove_dir_all(&dir);
    }
}
