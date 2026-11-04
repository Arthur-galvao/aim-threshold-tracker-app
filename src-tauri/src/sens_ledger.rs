//! Ledger de sensibilidade por run (Plano 03, T3.3).
//!
//! Substitui a reescrita dos CSVs do KovaaK's: o app nunca mais escreve na pasta stats do jogo.
//! A sens usada em cada run (e o sorteio que a gerou) fica em `sens_ledger.json`, indexado pelo
//! nome do arquivo da run. Na importação, a entrada do ledger sobrepõe a sens lida do CSV.

use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};

use crate::model::KovaakRun;
use crate::sampler::lattice_index;
use crate::storage;

pub const RETENTION_DAYS: i64 = 365;
const DAY_MS: i64 = 86_400_000;

pub const ROLE_RANDOM: &str = "random";
pub const ROLE_OFF: &str = "off";
pub const ROLE_UNKNOWN: &str = "unknown";

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LedgerEntry {
    /// Sens (cm/360) que estava ativa durante a run.
    pub cm: f64,
    /// "random" | "off"
    pub role: String,
    pub center_cm: Option<f64>,
    pub k: Option<i32>,
    /// Epoch ms do registro (fim da run).
    pub ts: i64,
}

/// Arquivo JSON é exatamente o mapa `source_file -> LedgerEntry`.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(transparent)]
pub struct SensLedger {
    pub entries: HashMap<String, LedgerEntry>,
}

impl SensLedger {
    /// Ausente ou inválido → ledger vazio.
    pub fn load(path: &Path) -> SensLedger {
        fs::read(path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<SensLedger>(&bytes).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        let bytes = serde_json::to_vec_pretty(self)
            .map_err(|e| format!("Falha ao serializar sens_ledger: {e}"))?;
        storage::atomic_write(path, &bytes)
    }

    pub fn record(&mut self, source_file: &str, entry: LedgerEntry) {
        self.entries.insert(source_file.to_string(), entry);
    }

    pub fn get(&self, source_file: &str) -> Option<&LedgerEntry> {
        self.entries.get(source_file)
    }

    /// Remove entradas com `ts` anterior a `max_age_days` atrás.
    pub fn prune(&mut self, now_ms: i64, max_age_days: i64) {
        let cutoff = now_ms - max_age_days * DAY_MS;
        self.entries.retain(|_, e| e.ts >= cutoff);
    }
}

// ---------------------------------------------------------------------------
// Instância compartilhada (carregada preguiçosamente do diretório de dados do app)
// ---------------------------------------------------------------------------

static LEDGER: OnceLock<Mutex<SensLedger>> = OnceLock::new();

fn shared(path: &Path) -> &'static Mutex<SensLedger> {
    LEDGER.get_or_init(|| Mutex::new(SensLedger::load(path)))
}

/// Registra a entrada, poda, e persiste. Em erro de IO a memória já está atualizada.
pub fn record_and_save(
    path: &Path,
    source_file: &str,
    entry: LedgerEntry,
    now_ms: i64,
) -> Result<(), String> {
    let mut guard = shared(path).lock().unwrap_or_else(|p| p.into_inner());
    guard.record(source_file, entry);
    guard.prune(now_ms, RETENTION_DAYS);
    guard.save(path)
}

pub fn lookup(path: &Path, source_file: &str) -> Option<LedgerEntry> {
    let guard = shared(path).lock().unwrap_or_else(|p| p.into_inner());
    guard.get(source_file).cloned()
}

// ---------------------------------------------------------------------------
// Lógica pura
// ---------------------------------------------------------------------------

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Monta a entrada do fim de uma run.
/// `active_sens` é o snapshot tirado ANTES do próximo sorteio; `roll_center_cm` é o centro do
/// sorteio que produziu essa sens. Com randomizer desligado, centro e índice não se aplicam.
pub fn entry_for_run(
    randomizer_enabled: bool,
    active_sens: f64,
    roll_center_cm: Option<f64>,
    ts: i64,
) -> LedgerEntry {
    if randomizer_enabled {
        LedgerEntry {
            cm: active_sens,
            role: ROLE_RANDOM.to_string(),
            center_cm: roll_center_cm,
            k: (active_sens > 0.0).then(|| lattice_index(active_sens)),
            ts,
        }
    } else {
        LedgerEntry {
            cm: active_sens,
            role: ROLE_OFF.to_string(),
            center_cm: None,
            k: None,
            ts,
        }
    }
}

/// Aplica o ledger a uma run recém-parseada.
/// - Entrada "random" com cm > 0: sens da run = cm do ledger.
/// - Entrada "off": sens do CSV é mantida (sem randomizer, o CSV é a verdade).
/// - Sem entrada: sens do CSV mantida, `sens_role = "unknown"`.
pub fn apply_to_run(entry: Option<&LedgerEntry>, run: &mut KovaakRun) {
    match entry {
        Some(e) => {
            run.sens_role = Some(e.role.clone());
            run.roll_center_cm = e.center_cm;
            run.lattice_k = e.k;
            if e.role == ROLE_RANDOM && e.cm > 0.0 {
                run.sens = e.cm;
            }
        }
        None => {
            run.sens_role = Some(ROLE_UNKNOWN.to_string());
            run.roll_center_cm = None;
            run.lattice_k = None;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_file(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "sens_ledger_test_{tag}_{}_{}",
            std::process::id(),
            now_ms()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir.join("sens_ledger.json")
    }

    fn entry(cm: f64, ts: i64) -> LedgerEntry {
        LedgerEntry {
            cm,
            role: ROLE_RANDOM.into(),
            center_cm: Some(50.0),
            k: Some(0),
            ts,
        }
    }

    const DAY: i64 = DAY_MS;
    const NOW: i64 = 1_800_000_000_000;

    #[test]
    fn record_and_get() {
        let mut l = SensLedger::default();
        l.record("a.csv", entry(40.0, NOW));
        assert_eq!(l.get("a.csv").map(|e| e.cm), Some(40.0));
        assert!(l.get("b.csv").is_none());
        l.record("a.csv", entry(55.0, NOW));
        assert_eq!(l.get("a.csv").map(|e| e.cm), Some(55.0));
        assert_eq!(l.entries.len(), 1);
    }

    #[test]
    fn save_load_roundtrip() {
        let path = temp_file("roundtrip");
        let mut l = SensLedger::default();
        l.record("run1.csv", entry(42.5, NOW));
        l.record(
            "run2.csv",
            LedgerEntry { cm: 30.0, role: ROLE_OFF.into(), center_cm: None, k: None, ts: NOW },
        );
        l.save(&path).expect("save");
        assert!(!path.with_file_name("sens_ledger.json.tmp").exists());

        let loaded = SensLedger::load(&path);
        assert_eq!(loaded, l);
        assert_eq!(loaded.get("run1.csv").unwrap().center_cm, Some(50.0));
        let _ = fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn load_missing_or_invalid_is_empty() {
        let path = temp_file("invalid");
        assert_eq!(SensLedger::load(&path), SensLedger::default());
        fs::write(&path, "{ not json").unwrap();
        assert_eq!(SensLedger::load(&path), SensLedger::default());
        let _ = fs::remove_dir_all(path.parent().unwrap());
    }

    #[test]
    fn prune_drops_entries_older_than_retention() {
        let mut l = SensLedger::default();
        l.record("old.csv", entry(40.0, NOW - 366 * DAY));
        l.record("edge.csv", entry(40.0, NOW - 365 * DAY));
        l.record("new.csv", entry(40.0, NOW - DAY));
        l.prune(NOW, RETENTION_DAYS);
        assert!(l.get("old.csv").is_none());
        assert!(l.get("edge.csv").is_some());
        assert!(l.get("new.csv").is_some());
    }

    #[test]
    fn entry_for_run_random_has_center_and_k() {
        let e = entry_for_run(true, 50.0, Some(48.0), NOW);
        assert_eq!(e.role, ROLE_RANDOM);
        assert_eq!(e.cm, 50.0);
        assert_eq!(e.center_cm, Some(48.0));
        assert_eq!(e.k, Some(lattice_index(50.0)));
        assert_eq!(e.k, Some(0));
        assert_eq!(e.ts, NOW);
    }

    #[test]
    fn entry_for_run_off_has_no_roll_info() {
        let e = entry_for_run(false, 40.0, Some(48.0), NOW);
        assert_eq!(e.role, ROLE_OFF);
        assert_eq!(e.center_cm, None);
        assert_eq!(e.k, None);
    }

    #[test]
    fn entry_for_run_random_zero_sens_has_no_k() {
        let e = entry_for_run(true, 0.0, None, NOW);
        assert_eq!(e.k, None);
    }

    fn csv_run(sens: f64) -> KovaakRun {
        KovaakRun { sens, ..Default::default() }
    }

    #[test]
    fn apply_random_entry_overrides_sens() {
        let mut run = csv_run(0.24);
        apply_to_run(Some(&entry(61.3, NOW)), &mut run);
        assert_eq!(run.sens, 61.3);
        assert_eq!(run.sens_role.as_deref(), Some(ROLE_RANDOM));
        assert_eq!(run.roll_center_cm, Some(50.0));
        assert_eq!(run.lattice_k, Some(0));
    }

    #[test]
    fn apply_off_entry_keeps_csv_sens() {
        let mut run = csv_run(33.0);
        let e = LedgerEntry { cm: 40.0, role: ROLE_OFF.into(), center_cm: None, k: None, ts: NOW };
        apply_to_run(Some(&e), &mut run);
        assert_eq!(run.sens, 33.0);
        assert_eq!(run.sens_role.as_deref(), Some(ROLE_OFF));
    }

    #[test]
    fn apply_without_entry_is_unknown() {
        let mut run = csv_run(33.0);
        run.roll_center_cm = Some(1.0);
        apply_to_run(None, &mut run);
        assert_eq!(run.sens, 33.0);
        assert_eq!(run.sens_role.as_deref(), Some(ROLE_UNKNOWN));
        assert_eq!(run.roll_center_cm, None);
        assert_eq!(run.lattice_k, None);
    }
}
