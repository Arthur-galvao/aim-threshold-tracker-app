//! Migrações versionadas do `AppData` (Plano 03, T3.6).
//!
//! Cada passo roda uma única vez e termina gravando `schema_version`. Este módulo não
//! depende de Tauri nem de `aimlab.rs` (a parte do Aim Lab que precisa de SQLite entra por
//! `MigrationCtx::pre_dedupe_hook`).

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use chrono::NaiveDateTime;

use crate::model::{AppData, KovaakRun, Session, CURRENT_SCHEMA_VERSION};
use crate::parser;
use crate::sens_ledger::{LedgerEntry, ROLE_UNKNOWN};
use crate::storage;

/// Progresso do re-parse é reportado a cada N arquivos.
pub const PROGRESS_EVERY: usize = 50;
/// Abaixo de 2.5 o valor guardado é quase certamente sens "in-game" e não cm/360.
const LEGACY_SENS_LIMIT: f64 = 2.5;

pub struct MigrationCtx<'a> {
    /// Pasta de dados do app (os backups vão em `<data_dir>/backups`).
    pub data_dir: &'a Path,
    pub stats_dir: Option<PathBuf>,
    pub fallback_dpi: f64,
    /// `source_file` -> entrada do ledger de sens.
    pub ledger_lookup: &'a dyn Fn(&str) -> Option<LedgerEntry>,
    /// `(feitos, total)` durante o re-parse dos CSVs.
    pub progress: &'a dyn Fn(usize, usize),
    /// Se houver mais sessões a re-parsear que isso, o re-parse é adiado (`deferred_reparse`)
    /// e deve ser feito depois com `collect_reparse` + `apply_reparse`.
    pub max_sync_reparse: usize,
    /// Passo extra antes do dedupe de tasks (ex.: renomear `CsLevel...` do Aim Lab, que usa
    /// SQLite e por isso vive em `aimlab.rs`). Devolve true se mudou algo.
    pub pre_dedupe_hook: Option<&'a dyn Fn(&mut AppData) -> bool>,
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct MigrationReport {
    pub from_version: u32,
    pub to_version: u32,
    /// `data` foi alterado (precisa persistir).
    pub changed: bool,
    pub backup_path: Option<PathBuf>,
    /// Migração abortada; `data` intacto.
    pub error: Option<String>,
    /// O re-parse dos CSVs (passo c) ficou para depois.
    pub deferred_reparse: bool,
    pub reparse_total: usize,
}

pub fn run_migrations(data: &mut AppData, ctx: &MigrationCtx) -> MigrationReport {
    let mut report = MigrationReport {
        from_version: data.schema_version,
        to_version: data.schema_version,
        ..Default::default()
    };
    if data.schema_version >= CURRENT_SCHEMA_VERSION {
        return report;
    }
    // 0 ou 1
    if data.tasks.is_empty() && data.playlists.is_empty() {
        data.schema_version = CURRENT_SCHEMA_VERSION;
        report.to_version = CURRENT_SCHEMA_VERSION;
        report.changed = true;
        return report;
    }
    v1_to_v2(data, ctx, &mut report);
    report
}

fn v1_to_v2(data: &mut AppData, ctx: &MigrationCtx, report: &mut MigrationReport) {
    // (a) backup obrigatório
    match storage::write_pre_backup(ctx.data_dir, "migration-v2", data) {
        Ok(p) => report.backup_path = Some(p),
        Err(e) => {
            report.error = Some(format!("Backup pré-migração falhou: {e}"));
            return;
        }
    }

    // (b) datetime a partir do nome do arquivo
    for_each_session(data, fill_datetime);

    // (c) re-parse dos CSVs (ou adiado)
    if let Some(dir) = ctx.stats_dir.as_deref() {
        let candidates = reparse_candidates(data, dir);
        report.reparse_total = candidates.len();
        if !candidates.is_empty() {
            if candidates.len() > ctx.max_sync_reparse {
                report.deferred_reparse = true;
            } else {
                let parsed = collect_reparse(&candidates, dir, ctx.fallback_dpi, ctx.progress);
                apply_reparse(data, &parsed);
            }
        }
    }

    // (d) Aim Lab: renomeação (hook) + dedupe de tasks
    if let Some(hook) = ctx.pre_dedupe_hook {
        hook(data);
    }
    dedupe_tasks_by_name(data);

    // (e) ledger / sens_role
    for_each_session(data, |s| apply_ledger(s, ctx.ledger_lookup));

    // (f)
    data.schema_version = CURRENT_SCHEMA_VERSION;
    report.to_version = CURRENT_SCHEMA_VERSION;
    report.changed = true;
}

fn for_each_session(data: &mut AppData, mut f: impl FnMut(&mut Session)) {
    for task in &mut data.tasks {
        for s in &mut task.sessions {
            f(s);
        }
    }
}

fn fill_datetime(s: &mut Session) {
    if s.datetime.as_deref().map(|d| !d.is_empty()).unwrap_or(false) {
        return;
    }
    if let Some(dt) = s.source_file.as_deref().and_then(datetime_from_source_file) {
        s.datetime = Some(dt);
    }
}

/// Acha `YYYY.MM.DD-HH.MM.SS` em qualquer ponto do nome e devolve `YYYY-MM-DDTHH:MM:SS`.
pub fn datetime_from_source_file(source_file: &str) -> Option<String> {
    const LEN: usize = 19;
    let bytes = source_file.as_bytes();
    if bytes.len() < LEN {
        return None;
    }
    for i in 0..=bytes.len() - LEN {
        // Formato estrito (o chrono aceita espaços/dígitos a menos e deslocaria a janela).
        let w = &bytes[i..i + LEN];
        let shape_ok = w.iter().enumerate().all(|(k, b)| match k {
            4 | 7 | 13 | 16 => *b == b'.',
            10 => *b == b'-',
            _ => b.is_ascii_digit(),
        });
        if !shape_ok {
            continue;
        }
        if let Ok(dt) = NaiveDateTime::parse_from_str(&source_file[i..i + LEN], "%Y.%m.%d-%H.%M.%S") {
            return Some(dt.format("%Y-%m-%dT%H:%M:%S").to_string());
        }
    }
    None
}

fn apply_ledger(s: &mut Session, lookup: &dyn Fn(&str) -> Option<LedgerEntry>) {
    if let Some(entry) = s.source_file.as_deref().and_then(lookup) {
        s.sens_role = Some(entry.role);
        s.roll_center_cm = entry.center_cm;
        s.lattice_k = entry.k;
    } else if s.sens_role.is_none() {
        s.sens_role = Some(ROLE_UNKNOWN.to_string());
    }
}

// ---------------------------------------------------------------------------
// Passo (c): re-parse dos CSVs
// ---------------------------------------------------------------------------

fn is_plain_file_name(sf: &str) -> bool {
    Path::new(sf).file_name().map(|n| n == std::ffi::OsStr::new(sf)).unwrap_or(false)
}

/// `source_file`s (únicos) de sessões não-Aim Lab cujo CSV existe em `stats_dir`.
pub fn reparse_candidates(data: &AppData, stats_dir: &Path) -> Vec<String> {
    if !stats_dir.is_dir() {
        return Vec::new();
    }
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for task in &data.tasks {
        for s in &task.sessions {
            if s.game.as_deref() == Some("aimlab") {
                continue;
            }
            let Some(sf) = s.source_file.as_deref() else { continue };
            if !is_plain_file_name(sf) || !seen.insert(sf.to_string()) {
                continue;
            }
            if stats_dir.join(sf).is_file() {
                out.push(sf.to_string());
            }
        }
    }
    out
}

/// Faz o I/O pesado (parse dos CSVs) sem tocar em `AppData`; pode rodar em outra thread.
pub fn collect_reparse(
    files: &[String],
    stats_dir: &Path,
    fallback_dpi: f64,
    progress: &dyn Fn(usize, usize),
) -> HashMap<String, KovaakRun> {
    let total = files.len();
    let mut out = HashMap::new();
    for (i, f) in files.iter().enumerate() {
        if let Some(run) = parser::parse_stats_file_with_fallback_dpi(&stats_dir.join(f), fallback_dpi) {
            out.insert(f.clone(), run);
        }
        let done = i + 1;
        if done % PROGRESS_EVERY == 0 || done == total {
            progress(done, total);
        }
    }
    out
}

fn fill<T>(slot: &mut Option<T>, value: Option<T>) -> bool {
    if slot.is_none() && value.is_some() {
        *slot = value;
        true
    } else {
        false
    }
}

/// Aplica os runs re-parseados: preenche só campos `None`; troca a sens só se a guardada for
/// `< 2.5` e o CSV tiver escala explícita (sens parseada > 0). Devolve true se mudou algo.
pub fn apply_reparse(data: &mut AppData, parsed: &HashMap<String, KovaakRun>) -> bool {
    let mut changed = false;
    for_each_session(data, |s| {
        if s.game.as_deref() == Some("aimlab") {
            return;
        }
        let Some(run) = s.source_file.as_deref().and_then(|sf| parsed.get(sf)) else { return };
        let st = &run.stats;
        if s.sens < LEGACY_SENS_LIMIT && run.sens > 0.0 && s.sens != run.sens {
            s.sens = run.sens;
            changed = true;
        }
        let game = (!run.game.is_empty()).then(|| run.game.clone());
        changed |= fill(&mut s.fov, (run.fov > 0.0).then_some(run.fov));
        changed |= fill(&mut s.game, game);
        changed |= fill(&mut s.shots, st.shots);
        changed |= fill(&mut s.hits, st.hits);
        changed |= fill(&mut s.accuracy, st.accuracy);
        changed |= fill(&mut s.kills, st.kills);
        changed |= fill(&mut s.avg_ttk, st.avg_ttk);
        changed |= fill(&mut s.damage_done, st.damage_done);
        changed |= fill(&mut s.damage_possible, st.damage_possible);
        changed |= fill(&mut s.fight_time, st.fight_time);
        changed |= fill(&mut s.pause_count, st.pause_count);
        changed |= fill(&mut s.pause_duration, st.pause_duration);
        changed |= fill(&mut s.avg_fps, st.avg_fps);
        changed |= fill(&mut s.game_version, st.game_version.clone());
        changed |= fill(&mut s.hash, st.hash.clone());
        changed |= fill(&mut s.dpi, st.dpi);
        if s.datetime.is_none() && !run.datetime.starts_with("1970-") {
            s.datetime = Some(run.datetime.clone());
            changed = true;
        }
    });
    changed
}

// ---------------------------------------------------------------------------
// Passo (d): dedupe de tasks (lógica que era de `aimlab::migrate_existing_aimlab_tasks`)
// ---------------------------------------------------------------------------

/// Funde tasks de mesmo nome (case-insensitive), deduplica sessões e redireciona
/// `active_task_id` e os itens de playlist. Devolve true se mudou algo.
pub fn dedupe_tasks_by_name(data: &mut AppData) -> bool {
    let mut changed = false;
    let mut deduplicated: Vec<crate::model::Task> = Vec::new();
    let mut id_redirects: HashMap<String, String> = HashMap::new();

    for task in data.tasks.drain(..) {
        if let Some(existing) = deduplicated
            .iter_mut()
            .find(|t| t.name.eq_ignore_ascii_case(&task.name))
        {
            id_redirects.insert(task.id, existing.id.clone());
            for sess in task.sessions {
                if let Some(dup_sess) = existing.sessions.iter_mut().find(|s| {
                    (s.source_file.is_some() && s.source_file == sess.source_file)
                        || (s.date == sess.date && (s.pb - sess.pb).abs() < f64::EPSILON)
                }) {
                    if dup_sess.sens <= 0.0 && sess.sens > 0.0 {
                        dup_sess.sens = sess.sens;
                    }
                } else {
                    existing.sessions.push(sess);
                }
            }
            changed = true;
        } else {
            deduplicated.push(task);
        }
    }
    data.tasks = deduplicated;

    if let Some(ref current_id) = data.active_task_id {
        if let Some(target_id) = id_redirects.get(current_id) {
            data.active_task_id = Some(target_id.clone());
        }
    }
    for pl in &mut data.playlists {
        for item in &mut pl.items {
            if let Some(target_id) = id_redirects.get(&item.task_id) {
                item.task_id = target_id.clone();
            }
        }
    }
    changed
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Playlist, PlaylistItem, Task};
    use std::fs;

    const FIXTURE: &str = "VT Pasu Intermediate S5 - Challenge - 2026.10.12-14.30.22 Stats.csv";

    fn tmp(name: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!("att-mig-{name}-{}", rand::random::<u64>()));
        fs::create_dir_all(&p).unwrap();
        p
    }

    fn sess(id: &str, sens: f64, sf: Option<&str>) -> Session {
        Session {
            id: id.into(),
            date: "2026-10-12".into(),
            sens,
            pb: 100.0 + sens,
            threshold: 90.0,
            source_file: sf.map(String::from),
            ..Default::default()
        }
    }

    fn task(id: &str, name: &str, sessions: Vec<Session>) -> Task {
        Task { id: id.into(), name: name.into(), category: "c".into(), subcategory: "s".into(), sessions }
    }

    fn v1(tasks: Vec<Task>) -> AppData {
        AppData { schema_version: 1, tasks, ..Default::default() }
    }

    fn no_ledger(_: &str) -> Option<LedgerEntry> {
        None
    }

    fn ctx<'a>(dir: &'a Path, stats: Option<PathBuf>, ledger: &'a dyn Fn(&str) -> Option<LedgerEntry>) -> MigrationCtx<'a> {
        MigrationCtx {
            data_dir: dir,
            stats_dir: stats,
            fallback_dpi: 800.0,
            ledger_lookup: ledger,
            progress: &|_, _| {},
            max_sync_reparse: 500,
            pre_dedupe_hook: None,
        }
    }

    fn backups(dir: &Path) -> Vec<PathBuf> {
        match fs::read_dir(dir.join("backups")) {
            Ok(rd) => rd.filter_map(|e| e.ok().map(|e| e.path())).collect(),
            Err(_) => vec![],
        }
    }

    fn stats_dir_with_fixture() -> PathBuf {
        let d = tmp("stats");
        // `ATT_FIXTURE_DIR` permite rodar fora do crate real (harness de verificação).
        let base = std::env::var("ATT_FIXTURE_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("test/fixtures/kovaak"));
        let src = base.join(FIXTURE);
        fs::copy(src, d.join(FIXTURE)).unwrap();
        d
    }

    #[test]
    fn fresh_install_just_bumps_version_without_backup() {
        let dir = tmp("fresh");
        let mut data = AppData { schema_version: 1, ..Default::default() };
        let rep = run_migrations(&mut data, &ctx(&dir, None, &no_ledger));
        assert_eq!(data.schema_version, CURRENT_SCHEMA_VERSION);
        assert!(rep.error.is_none() && rep.changed);
        assert!(backups(&dir).is_empty());
    }

    #[test]
    fn current_version_is_noop() {
        let dir = tmp("noop");
        let mut data = AppData { schema_version: CURRENT_SCHEMA_VERSION, tasks: vec![task("t", "A", vec![sess("s", 0.24, None)])], ..Default::default() };
        let rep = run_migrations(&mut data, &ctx(&dir, None, &no_ledger));
        assert!(!rep.changed);
        assert_eq!(data.tasks[0].sessions[0].sens, 0.24);
        assert!(backups(&dir).is_empty());
    }

    #[test]
    fn full_v1_fixture_migrates_and_is_idempotent() {
        let dir = tmp("full");
        let stats = stats_dir_with_fixture();
        let ledger = |sf: &str| {
            (sf == "ledger.csv").then(|| LedgerEntry { cm: 55.0, role: "random".into(), center_cm: Some(50.0), k: Some(3), ts: 1 })
        };
        let mut data = v1(vec![
            task("t1", "VT Pasu Intermediate S5", vec![
                sess("a", 0.35, Some(FIXTURE)),
                sess("b", 60.0, Some("Other - Challenge - 2026.03.04-05.06.07 Stats.csv")),
                sess("c", 0.24, None),
                sess("d", 70.0, Some("ledger.csv")),
            ]),
            task("t2", "vt pasu intermediate s5", vec![sess("e", 40.0, Some("zzz.csv"))]),
            task("t3", "Cs", vec![sess("f", 33.0, Some("AimLab_x_1_2026-01-01")) ]),
        ]);
        data.active_task_id = Some("t2".into());
        data.playlists.push(Playlist {
            id: "p".into(),
            items: vec![PlaylistItem { id: "i".into(), task_id: "t2".into(), ..Default::default() }],
            ..Default::default()
        });

        let c = ctx(&dir, Some(stats), &ledger);
        let rep = run_migrations(&mut data, &c);
        assert!(rep.error.is_none(), "{:?}", rep.error);
        assert_eq!(data.schema_version, 2);
        assert_eq!(backups(&dir).len(), 1);
        let name = backups(&dir)[0].file_name().unwrap().to_string_lossy().to_string();
        assert!(name.starts_with("pre-migration-v2-"), "{name}");

        // dedupe
        assert_eq!(data.tasks.len(), 2);
        assert_eq!(data.active_task_id.as_deref(), Some("t1"));
        assert_eq!(data.playlists[0].items[0].task_id, "t1");
        let ss = &data.tasks[0].sessions;
        let a = ss.iter().find(|s| s.id == "a").unwrap();
        // datetime vinda do nome + CSV re-parseado
        assert_eq!(a.datetime.as_deref(), Some("2026-10-12T14:30:22"));
        assert!(a.shots.is_some() && a.game.as_deref() == Some("kovaak") && a.fov.is_some());
        assert_eq!(a.sens, 45.0, "CSV com escala explícita substitui sens < 2.5");
        assert_eq!(a.sens_role.as_deref(), Some("unknown"));
        // timestamp sem CSV
        let b = ss.iter().find(|s| s.id == "b").unwrap();
        assert_eq!(b.datetime.as_deref(), Some("2026-03-04T05:06:07"));
        assert_eq!(b.sens, 60.0);
        // legado sem CSV não é convertido
        let c_ = ss.iter().find(|s| s.id == "c").unwrap();
        assert_eq!(c_.sens, 0.24);
        assert_eq!(c_.sens_role.as_deref(), Some("unknown"));
        // ledger
        let d = ss.iter().find(|s| s.id == "d").unwrap();
        assert_eq!(d.sens_role.as_deref(), Some("random"));
        assert_eq!(d.roll_center_cm, Some(50.0));
        assert_eq!(d.lattice_k, Some(3));
        assert!(ss.iter().any(|s| s.id == "e"));

        // idempotência: segunda rodada não muda nada
        let before = serde_json::to_string(&data).unwrap();
        let rep2 = run_migrations(&mut data, &c);
        assert!(!rep2.changed);
        assert_eq!(serde_json::to_string(&data).unwrap(), before);
        assert_eq!(backups(&dir).len(), 1);
        // e reaplicar o re-parse também é no-op
        let parsed = collect_reparse(&reparse_candidates(&data, c.stats_dir.as_deref().unwrap()), c.stats_dir.as_deref().unwrap(), 800.0, &|_, _| {});
        assert!(!apply_reparse(&mut data, &parsed));
    }

    #[test]
    fn legacy_cm_sens_is_preserved() {
        let dir = tmp("cm");
        let mut data = v1(vec![task("t1", "A", vec![sess("s1", 75.0, Some("run1.csv")), sess("s2", 50.0, Some("run2.csv"))])]);
        run_migrations(&mut data, &ctx(&dir, None, &no_ledger));
        assert_eq!(data.tasks[0].sessions[0].sens, 75.0);
        assert_eq!(data.tasks[0].sessions[1].sens, 50.0);
    }

    #[test]
    fn legacy_in_game_sens_without_csv_is_not_converted() {
        let dir = tmp("legacy");
        let mut data = v1(vec![task("t1", "A", vec![sess("s1", 0.24, None)])]);
        run_migrations(&mut data, &ctx(&dir, None, &no_ledger));
        assert_eq!(data.tasks[0].sessions[0].sens, 0.24);
    }

    #[test]
    fn failed_backup_aborts_and_leaves_data_untouched() {
        let base = tmp("fail");
        let file_as_dir = base.join("not-a-dir");
        fs::write(&file_as_dir, b"x").unwrap();
        let mut data = v1(vec![task("t1", "A", vec![sess("s1", 0.24, Some("a 2026.01.02-03.04.05 Stats.csv"))])]);
        let before = serde_json::to_string(&data).unwrap();
        let rep = run_migrations(&mut data, &ctx(&file_as_dir, None, &no_ledger));
        assert!(rep.error.is_some() && !rep.changed);
        assert_eq!(data.schema_version, 1);
        assert_eq!(serde_json::to_string(&data).unwrap(), before);
    }

    #[test]
    fn large_reparse_is_deferred_then_applied() {
        let dir = tmp("defer");
        let stats = stats_dir_with_fixture();
        let mut data = v1(vec![task("t1", "A", vec![sess("a", 0.35, Some(FIXTURE))])]);
        let mut c = ctx(&dir, Some(stats.clone()), &no_ledger);
        c.max_sync_reparse = 0;
        let rep = run_migrations(&mut data, &c);
        assert!(rep.deferred_reparse && rep.reparse_total == 1);
        assert_eq!(data.schema_version, 2);
        assert!(data.tasks[0].sessions[0].shots.is_none());
        assert_eq!(data.tasks[0].sessions[0].sens, 0.35);
        let files = reparse_candidates(&data, &stats);
        let parsed = collect_reparse(&files, &stats, 800.0, &|_, _| {});
        assert!(apply_reparse(&mut data, &parsed));
        assert!(data.tasks[0].sessions[0].shots.is_some());
        assert_eq!(data.tasks[0].sessions[0].sens, 45.0);
    }

    #[test]
    fn dedupe_merges_same_name_tasks() {
        let mut data = v1(vec![
            task("a", "VT Suave", vec![sess("s1", 45.0, Some("s1.csv"))]),
            task("b", "vt suave", vec![sess("s2", 46.0, Some("s2.csv"))]),
        ]);
        data.active_task_id = Some("b".into());
        assert!(dedupe_tasks_by_name(&mut data));
        assert_eq!(data.tasks.len(), 1);
        assert_eq!(data.tasks[0].sessions.len(), 2);
        assert_eq!(data.active_task_id.as_deref(), Some("a"));
        assert!(!dedupe_tasks_by_name(&mut data));
    }

    #[test]
    fn datetime_extraction() {
        assert_eq!(datetime_from_source_file("x - 2026.10.12-14.30.22 Stats.csv").as_deref(), Some("2026-10-12T14:30:22"));
        assert_eq!(datetime_from_source_file("AimLab_x_1"), None);
        assert_eq!(datetime_from_source_file("é"), None);
    }
}
