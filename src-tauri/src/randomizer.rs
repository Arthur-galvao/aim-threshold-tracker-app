use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use rand::Rng;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::model::{RandomizerSettings, RandomizerState};
use crate::sampler::{draw_index, grid_bounds, lattice_cm, SamplerState, MIN_CM};
use crate::AppState;

pub fn get_candidate_paths(configured_dir: Option<&str>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(dir) = configured_dir {
        if !dir.trim().is_empty() {
            candidates.push(PathBuf::from(dir));
        }
    }

    candidates.push(PathBuf::from(r"C:\Program Files\RawAccel"));
    candidates.push(PathBuf::from(r"C:\Program Files (x86)\RawAccel"));
    candidates.push(PathBuf::from(r"C:\RawAccel"));

    if let Some(user_profile) = dirs::home_dir() {
        candidates.push(user_profile.join(r"Downloads\RawAccel"));
        candidates.push(user_profile.join(r"Desktop\RawAccel"));
        candidates.push(user_profile.join(r"Documents\RawAccel"));
    }

    candidates
}

pub fn is_driver_registered() -> bool {
    #[cfg(windows)]
    {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;

        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if hklm.open_subkey(r"SYSTEM\CurrentControlSet\Services\rawaccel").is_ok() {
            return true;
        }

        let sys_driver = Path::new(r"C:\Windows\System32\drivers\rawaccel.sys");
        if sys_driver.exists() {
            return true;
        }
    }
    false
}

pub fn detect_rawaccel_dir(configured_dir: Option<&str>) -> Option<PathBuf> {
    let candidates = get_candidate_paths(configured_dir);

    for candidate in candidates {
        if is_valid_rawaccel_dir(&candidate) {
            return Some(candidate);
        }
    }

    if let Some(home) = dirs::home_dir() {
        let search_roots = [home.join("Downloads"), home.join("Desktop")];
        for root in search_roots {
            if let Ok(entries) = fs::read_dir(root) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
                        if name.contains("rawaccel") && is_valid_rawaccel_dir(&path) {
                            return Some(path);
                        }
                    }
                }
            }
        }
    }

    None
}

pub fn is_valid_rawaccel_dir(dir: &Path) -> bool {
    dir.is_dir()
        && dir.join("writer.exe").exists()
        && dir.join("settings.json").exists()
}

pub fn is_rawaccel_gui_running() -> bool {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("tasklist");
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.args(["/FI", "IMAGENAME eq rawaccel.exe", "/NH"]);
        if let Ok(output) = cmd.output() {
            let text = String::from_utf8_lossy(&output.stdout);
            return text.to_lowercase().contains("rawaccel.exe");
        }
    }
    false
}


pub fn check_rawaccel_availability(configured_dir: Option<&str>) -> (bool, Option<PathBuf>, Option<String>, bool) {
    let found_dir = detect_rawaccel_dir(configured_dir);
    let gui_running = is_rawaccel_gui_running();

    match found_dir {
        Some(dir) => {
            let driver_ok = is_driver_registered();
            if !driver_ok {
                (
                    false,
                    Some(dir),
                    Some("Pasta do RawAccel encontrada, mas o driver de kernel não está registrado. Execute o installer.exe e reinicie o PC.".into()),
                    gui_running,
                )
            } else if gui_running {
                (
                    true,
                    Some(dir),
                    Some("Aviso: A interface gráfica do Raw Accel (rawaccel.exe) está aberta. Feche a janela para evitar que ela reverta a sensibilidade sorteada.".into()),
                    true,
                )
            } else {
                (true, Some(dir), None, false)
            }
        }
        None => (
            false,
            None,
            Some("RawAccel não encontrado nos locais comuns nem configurado nas opções.".into()),
            gui_running,
        ),
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RangePreview {
    pub min_cm: f64,
    pub max_cm: f64,
    pub min_mult: f64,
    pub max_mult: f64,
    pub grid_cm: Vec<f64>,
}

pub fn resolve_range_cm(s: &RandomizerSettings, center_override: Option<f64>) -> (f64, f64) {
    let base = if s.base_sens_cm > 0.0 { s.base_sens_cm } else { 40.0 };
    if s.auto_scenario_sens {
        let center = center_override.or(s.scenario_ideal_cm).unwrap_or(base).max(MIN_CM);
        let p = (s.spread_percent / 100.0).clamp(0.01, 0.90);
        ((center * (1.0 - p)).max(MIN_CM), center * (1.0 + p))
    } else if s.range_mode.eq_ignore_ascii_case("multiplier") {
        let (a, b) = (s.min_mult.min(s.max_mult).max(0.01), s.min_mult.max(s.max_mult).max(0.01));
        ((base / b).max(MIN_CM), base / a)
    } else {
        (s.min_cm.min(s.max_cm).max(MIN_CM), s.min_cm.max(s.max_cm).max(MIN_CM))
    }
}

pub fn preview_sens_range_calc(s: &RandomizerSettings, center_cm: Option<f64>) -> RangePreview {
    let base = if s.base_sens_cm > 0.0 { s.base_sens_cm } else { 40.0 };
    let (min_cm, max_cm) = resolve_range_cm(s, center_cm);
    let (lo, hi) = grid_bounds(min_cm, max_cm);
    let grid_cm: Vec<f64> = (lo..=hi).map(lattice_cm).collect();
    let min_mult = ((base / max_cm) * 10000.0).round() / 10000.0;
    let max_mult = ((base / min_cm) * 10000.0).round() / 10000.0;
    RangePreview {
        min_cm: (min_cm * 100.0).round() / 100.0,
        max_cm: (max_cm * 100.0).round() / 100.0,
        min_mult,
        max_mult,
        grid_cm,
    }
}

pub fn generate_next_sens<R: Rng>(
    settings: &RandomizerSettings,
    center_override: Option<f64>,
    st: &mut SamplerState,
    rng: &mut R,
) -> (f64, f64) {
    let base_cm = if settings.base_sens_cm > 0.0 {
        settings.base_sens_cm
    } else {
        40.0
    };
    let (min_cm, max_cm) = resolve_range_cm(settings, center_override);
    let (lo, hi) = grid_bounds(min_cm, max_cm);
    let min_gap = if settings.avoid_repeats {
        if hi - lo + 1 >= 6 {
            2
        } else {
            1
        }
    } else {
        0
    };
    let k = draw_index(st, lo, hi, min_gap, rng);
    let cm = lattice_cm(k);
    let mult = ((base_cm / cm) * 10000.0).round() / 10000.0;
    (cm, mult)
}

use crate::storage::{self, RawAccelBackup};

pub fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    let tmp_path = path.with_extension("tmp");
    fs::write(&tmp_path, content)
        .map_err(|e| format!("Falha ao escrever arquivo temporário: {e}"))?;
    fs::rename(&tmp_path, path)
        .map_err(|e| format!("Falha ao substituir arquivo final: {e}"))?;
    Ok(())
}

pub type RawaccelLiveValues = (Option<f64>, Option<f64>, Option<f64>);

pub fn parse_rawaccel_live_values(json_content: &str) -> Result<RawaccelLiveValues, String> {
    let json: Value = serde_json::from_str(json_content)
        .map_err(|e| format!("JSON do RawAccel inválido: {e}"))?;
    let first_profile = json
        .get("profiles")
        .and_then(|p| p.as_array())
        .and_then(|arr| arr.first())
        .ok_or_else(|| "Nenhum profile encontrado no settings.json do RawAccel".to_string())?;

    let out_dpi = first_profile.get("Output DPI").and_then(|v| v.as_f64());
    let scale_whole = first_profile
        .get("Whole or horizontal accel parameters")
        .and_then(|w| w.get("scale"))
        .and_then(|v| v.as_f64());
    let scale_vert = first_profile
        .get("Vertical accel parameters")
        .and_then(|v| v.get("scale"))
        .and_then(|v| v.as_f64());

    Ok((out_dpi, scale_whole, scale_vert))
}

/// Aplica o multiplicador via "Output DPI" (base do backup * mult). O campo "scale" e ignorado
/// pelo RawAccel no modo noaccel, entao ele so e devolvido ao valor do backup (cura valores antigos).
pub fn apply_scale_to_rawaccel_json(json_content: &str, backup: &RawAccelBackup, mouse_dpi: f64, mult: f64) -> Result<String, String> {
    let mut json: Value = serde_json::from_str(json_content)
        .map_err(|e| format!("JSON do RawAccel inválido: {e}"))?;

    let profiles = json
        .get_mut("profiles")
        .and_then(|p| p.as_array_mut())
        .ok_or_else(|| "Campo 'profiles' inválido no settings.json".to_string())?;

    let first_profile = profiles
        .get_mut(0)
        .ok_or_else(|| "Nenhum profile no settings.json".to_string())?;

    let base_dpi = Some(mouse_dpi)
        .filter(|d| *d > 0.0)
        .ok_or_else(|| "DPI do mouse invalido".to_string())?;

    if let Some(obj) = first_profile.as_object_mut() {
        obj.insert("Output DPI".to_string(), serde_json::json!((base_dpi * mult * 100.0).round() / 100.0));
    }
    for (key, original) in [
        ("Whole or horizontal accel parameters", backup.scale_whole),
        ("Vertical accel parameters", backup.scale_vert),
    ] {
        if let (Some(scale), Some(params)) = (original, first_profile.get_mut(key).and_then(|w| w.as_object_mut())) {
            params.insert("scale".to_string(), serde_json::json!(scale));
        }
    }

    serde_json::to_string_pretty(&json)
        .map_err(|e| format!("Falha ao serializar settings.json: {e}"))
}
pub fn restore_rawaccel_json_from_backup(json_content: &str, backup: &RawAccelBackup) -> Result<String, String> {
    let mut json: Value = serde_json::from_str(json_content)
        .map_err(|e| format!("JSON do RawAccel inválido: {e}"))?;

    let profiles = json
        .get_mut("profiles")
        .and_then(|p| p.as_array_mut())
        .ok_or_else(|| "Campo 'profiles' inválido no settings.json".to_string())?;

    let first_profile = profiles
        .get_mut(0)
        .ok_or_else(|| "Nenhum profile no settings.json".to_string())?;

    if let Some(out_dpi) = backup.output_dpi {
        if let Some(obj) = first_profile.as_object_mut() {
            obj.insert("Output DPI".to_string(), serde_json::json!(out_dpi));
        }
    }

    if let Some(scale_whole) = backup.scale_whole {
        if let Some(whole_params) = first_profile
            .get_mut("Whole or horizontal accel parameters")
            .and_then(|w| w.as_object_mut())
        {
            whole_params.insert("scale".to_string(), serde_json::json!(scale_whole));
        }
    }

    if let Some(scale_vert) = backup.scale_vert {
        if let Some(vert_params) = first_profile
            .get_mut("Vertical accel parameters")
            .and_then(|v| v.as_object_mut())
        {
            vert_params.insert("scale".to_string(), serde_json::json!(scale_vert));
        }
    }

    serde_json::to_string_pretty(&json)
        .map_err(|e| format!("Falha ao serializar settings.json: {e}"))
}

pub fn ensure_rawaccel_backup(app: &AppHandle, rawaccel_dir: &Path) -> Result<RawAccelBackup, String> {
    let settings_path = rawaccel_dir.join("settings.json");
    if !settings_path.exists() {
        return Err(format!("settings.json não encontrado em {}", rawaccel_dir.display()));
    }
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Falha ao ler settings.json: {e}"))?;

    let (live_out_dpi, live_scale_whole, live_scale_vert) = parse_rawaccel_live_values(&content)?;
    let now_iso = chrono::Local::now().to_rfc3339();

    let backup_opt = storage::load_rawaccel_backup(app);
    match backup_opt {
        None => {
            let att_backup_path = rawaccel_dir.join("settings.json.att-backup");
            if !att_backup_path.exists() {
                let _ = fs::copy(&settings_path, &att_backup_path);
            }
            let backup = RawAccelBackup {
                output_dpi: live_out_dpi,
                scale_whole: live_scale_whole,
                scale_vert: live_scale_vert,
                last_written_output_dpi: live_out_dpi,
                last_written_scale: live_scale_whole,
                saved_at: now_iso,
            };
            storage::save_rawaccel_backup(app, &backup)?;
            Ok(backup)
        }
        Some(mut existing) => {
            let edited_externally = live_out_dpi.is_some()
                && live_out_dpi != existing.last_written_output_dpi
                && live_out_dpi != existing.output_dpi;
            if edited_externally {
                existing.output_dpi = live_out_dpi;
                existing.scale_whole = live_scale_whole;
                existing.scale_vert = live_scale_vert;
                existing.saved_at = now_iso;
                storage::save_rawaccel_backup(app, &existing)?;
            }
            Ok(existing)
        }
    }
}

pub fn run_writer(rawaccel_dir: &Path) -> Result<(), String> {
    let writer_path = rawaccel_dir.join("writer.exe");
    if !writer_path.exists() {
        return Err(format!("writer.exe não encontrado em {}", rawaccel_dir.display()));
    }

    #[cfg(windows)]
    let mut cmd = Command::new(&writer_path);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    #[cfg(windows)]
    cmd.current_dir(rawaccel_dir);
    #[cfg(windows)]
    cmd.arg("settings.json");

    #[cfg(not(windows))]
    let mut cmd = Command::new(&writer_path);
    #[cfg(not(windows))]
    cmd.current_dir(rawaccel_dir).arg("settings.json");

    let status = cmd
        .status()
        .map_err(|e| format!("Falha ao executar writer.exe: {e}"))?;

    if !status.success() {
        return Err(format!("writer.exe finalizou com código de erro: {:?}", status.code()));
    }

    Ok(())
}

pub fn update_and_apply_scale(app: &AppHandle, rawaccel_dir: &Path, mult: f64, mouse_dpi: f64) -> Result<(), String> {
    let settings_path = rawaccel_dir.join("settings.json");
    if !settings_path.exists() {
        return Err(format!("settings.json não encontrado em {}", rawaccel_dir.display()));
    }

    let mut backup = ensure_rawaccel_backup(app, rawaccel_dir)?;
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Falha ao ler settings.json: {e}"))?;

    let updated_content = apply_scale_to_rawaccel_json(&content, &backup, mouse_dpi, mult)?;
    atomic_write(&settings_path, &updated_content)?;

    backup.last_written_output_dpi = Some((mouse_dpi * mult * 100.0).round() / 100.0);
    backup.last_written_scale = Some(mult);
    storage::save_rawaccel_backup(app, &backup)?;
    run_writer(rawaccel_dir)
}

pub fn restore_from_backup(app: &AppHandle, rawaccel_dir: &Path) -> Result<(), String> {
    let settings_path = rawaccel_dir.join("settings.json");
    if !settings_path.exists() {
        return Err(format!("settings.json não encontrado em {}", rawaccel_dir.display()));
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Falha ao ler settings.json: {e}"))?;

    let updated_content = match storage::load_rawaccel_backup(app) {
        Some(backup) => restore_rawaccel_json_from_backup(&content, &backup)?,
        None => {
            eprintln!("[RawAccel] Backup não encontrado; mantendo settings atual");
            content.clone()
        }
    };

    atomic_write(&settings_path, &updated_content)?;
    run_writer(rawaccel_dir)
}

pub fn restore_base_sens(app: &AppHandle, rawaccel_dir: &Path) -> Result<(), String> {
    restore_from_backup(app, rawaccel_dir)
}

pub fn restore_on_exit(app: &AppHandle) {
    let state: State<AppState> = app.state();
    let (enabled, rawaccel_dir) = {
        let s = state.settings.lock().unwrap();
        (s.randomizer.enabled, s.randomizer.rawaccel_dir.clone())
    };
    if enabled {
        if let Some(dir) = detect_rawaccel_dir(rawaccel_dir.as_deref()) {
            let _ = restore_from_backup(app, &dir);
        }
    }
}

#[derive(Debug, Clone)]
pub struct RollContext {
    pub finished_scenario: Option<String>,
    pub reason: String,
}

pub fn record_last_run(app: &AppHandle, scenario: &str, score: f64) {
    let state: State<AppState> = app.state();
    let updated = {
        let mut r_state = state.randomizer_state.lock().unwrap();
        r_state.last_run_scenario = Some(scenario.to_string());
        r_state.last_run_score = Some(score);
        r_state.clone()
    };
    let _ = app.emit("sens_updated", &updated);
    let _ = app.emit("randomizer_state_patched", &updated);
}

pub fn apply_next_sens(
    app: &AppHandle,
    ctx: RollContext,
) -> Result<RandomizerState, String> {
    let state: State<AppState> = app.state();
    let _roll_guard = state.roll_lock.lock().unwrap();

    let settings = state.settings.lock().unwrap().randomizer.clone();

    let (available, found_dir, err_msg, gui_running) = check_rawaccel_availability(settings.rawaccel_dir.as_deref());

    if !available {
        let mut r_state = state.randomizer_state.lock().unwrap();
        r_state.available = false;
        r_state.rawaccel_gui_running = gui_running;
        r_state.error_message = err_msg.clone();
        drop(r_state);
        let _ = app.emit("randomizer_error", serde_json::json!({ "message": err_msg }));
        return Err(err_msg.unwrap_or_else(|| "RawAccel indisponível".into()));
    }

    let target_dir = found_dir.ok_or_else(|| "Diretório do RawAccel indefinido".to_string())?;

    let target_scenario = {
        let upcoming = state.upcoming_scenario.lock().unwrap().clone();
        upcoming.or_else(|| ctx.finished_scenario.clone())
    };

    let effective_center = target_scenario.as_ref().and_then(|scen| {
        let norm = scen.trim().to_lowercase();
        settings.center_overrides.get(&norm).copied()
            .or_else(|| state.scenario_centers.lock().unwrap().get(&norm).copied())
    }).or(settings.scenario_ideal_cm);

    let (next_cm, next_mult) = {
        let mut sampler = state.sampler.lock().unwrap();
        let mut rng = rand::thread_rng();
        let (cm, mult) = generate_next_sens(&settings, effective_center, &mut sampler, &mut rng);
        let actual_center = effective_center.unwrap_or(if settings.base_sens_cm > 0.0 { settings.base_sens_cm } else { 40.0 });
        sampler.last_roll_center_cm = Some(actual_center);
        (cm, mult)
    };

    update_and_apply_scale(app, &target_dir, next_mult, settings.mouse_dpi)?;

    let now_iso = chrono::Local::now().to_rfc3339();

    let new_state = {
        let mut r_state = state.randomizer_state.lock().unwrap();
        r_state.available = true;
        r_state.rawaccel_gui_running = gui_running;
        r_state.active_sens_cm = next_cm;
        r_state.active_mult = next_mult;
        r_state.last_run_scenario = ctx.finished_scenario.or(r_state.last_run_scenario.clone());
        r_state.last_roll_reason = Some(ctx.reason);
        r_state.last_updated = Some(now_iso);
        r_state.error_message = err_msg;
        r_state.clone()
    };

    app.emit("sens_updated", &new_state)
        .map_err(|e| e.to_string())?;

    Ok(new_state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::StdRng;
    use rand::SeedableRng;

    #[test]
    fn test_resolve_range_cm_auto_spread() {
        let settings = RandomizerSettings {
            base_sens_cm: 40.0,
            spread_percent: 25.0,
            auto_scenario_sens: true,
            scenario_ideal_cm: Some(40.0),
            ..RandomizerSettings::default()
        };

        let (min_cm, max_cm) = resolve_range_cm(&settings, None);
        assert!((min_cm - 30.0).abs() < 1e-4, "min_cm was {}, expected 30.0", min_cm);
        assert!((max_cm - 50.0).abs() < 1e-4, "max_cm was {}, expected 50.0", max_cm);

        // Override tem precedência
        let (min_ov, max_ov) = resolve_range_cm(&settings, Some(50.0));
        assert!((min_ov - 37.5).abs() < 1e-4, "min_ov was {}, expected 37.5", min_ov);
        assert!((max_ov - 62.5).abs() < 1e-4, "max_ov was {}, expected 62.5", max_ov);
    }

    #[test]
    fn test_resolve_range_cm_manual_modes() {
        let cm_settings = RandomizerSettings {
            base_sens_cm: 40.0,
            range_mode: "cm360".to_string(),
            min_cm: 30.0,
            max_cm: 60.0,
            auto_scenario_sens: false,
            ..RandomizerSettings::default()
        };
        let (min_cm, max_cm) = resolve_range_cm(&cm_settings, None);
        assert_eq!(min_cm, 30.0);
        assert_eq!(max_cm, 60.0);

        let mult_settings = RandomizerSettings {
            base_sens_cm: 40.0,
            range_mode: "multiplier".to_string(),
            min_mult: 0.8,
            max_mult: 1.25,
            auto_scenario_sens: false,
            ..RandomizerSettings::default()
        };
        let (m_min, m_max) = resolve_range_cm(&mult_settings, None);
        assert!((m_min - 32.0).abs() < 1e-4);
        assert!((m_max - 50.0).abs() < 1e-4);

        // Inversão normalizada e piso de 5 cm
        let floor_settings = RandomizerSettings {
            range_mode: "cm360".to_string(),
            min_cm: 10.0,
            max_cm: 2.0,
            auto_scenario_sens: false,
            ..RandomizerSettings::default()
        };
        let (f_min, f_max) = resolve_range_cm(&floor_settings, None);
        assert_eq!(f_min, 5.0);
        assert_eq!(f_max, 10.0);
    }

    #[test]
    fn test_preview_sens_range_calc() {
        let settings = RandomizerSettings {
            base_sens_cm: 40.0,
            spread_percent: 25.0,
            auto_scenario_sens: true,
            scenario_ideal_cm: Some(40.0),
            ..RandomizerSettings::default()
        };

        let preview = preview_sens_range_calc(&settings, None);
        assert_eq!(preview.min_cm, 30.0);
        assert_eq!(preview.max_cm, 50.0);
        assert!(preview.grid_cm.len() >= 3);
        assert_eq!(preview.min_mult, 0.8);
        assert_eq!(preview.max_mult, 1.3333);
    }

    #[test]
    fn test_generate_next_sens_deterministic_sampler() {
        let settings = RandomizerSettings {
            base_sens_cm: 50.0,
            spread_percent: 25.0,
            auto_scenario_sens: true,
            scenario_ideal_cm: Some(50.0),
            avoid_repeats: true,
            ..RandomizerSettings::default()
        };

        let mut st = SamplerState::default();
        let mut rng = StdRng::seed_from_u64(42);

        let preview = preview_sens_range_calc(&settings, None);
        let min_grid = preview.grid_cm.first().copied().unwrap();
        let max_grid = preview.grid_cm.last().copied().unwrap();

        for _ in 0..50 {
            let (cm, mult) = generate_next_sens(&settings, None, &mut st, &mut rng);
            assert!(
                cm >= min_grid - 0.01 && cm <= max_grid + 0.01,
                "cm {} not in grid range [{}, {}]",
                cm, min_grid, max_grid
            );
            let expected_mult = (50.0 / cm * 10000.0).round() / 10000.0;
            assert_eq!(mult, expected_mult);
        }
    }

    #[test]
    fn test_output_dpi_calculation() {
        let scale: f64 = 1.25;
        let dpi_800: f64 = 800.0;
        let out_800 = (scale * dpi_800 * 100.0).round() / 100.0;
        assert_eq!(out_800, 1000.0);

        let dpi_1600: f64 = 1600.0;
        let out_1600 = (scale * dpi_1600 * 100.0).round() / 100.0;
        assert_eq!(out_1600, 2000.0);
    }

    #[test]
    fn test_is_valid_rawaccel_dir_nonexistent() {
        let fake_dir = Path::new("C:\\nonexistent_dir_12345");
        assert!(!is_valid_rawaccel_dir(fake_dir));
    }

    #[test]
    fn test_parse_rawaccel_live_values_full_and_partial() {
        let full_json = r#"{
            "profiles": [
                {
                    "Output DPI": 1200.0,
                    "Whole or horizontal accel parameters": {
                        "scale": 1.5
                    },
                    "Vertical accel parameters": {
                        "scale": 1.2
                    }
                }
            ]
        }"#;
        let (dpi, whole, vert) = parse_rawaccel_live_values(full_json).expect("should parse");
        assert_eq!(dpi, Some(1200.0));
        assert_eq!(whole, Some(1.5));
        assert_eq!(vert, Some(1.2));

        let partial_json = r#"{
            "profiles": [
                {
                    "Output DPI": 800.0,
                    "Other Field": 42
                }
            ]
        }"#;
        let (p_dpi, p_whole, p_vert) = parse_rawaccel_live_values(partial_json).expect("should parse");
        assert_eq!(p_dpi, Some(800.0));
        assert_eq!(p_whole, None);
        assert_eq!(p_vert, None);

        let invalid_json = "not valid json {";
        assert!(parse_rawaccel_live_values(invalid_json).is_err());
    }

    #[test]
    fn test_apply_scale_to_rawaccel_json_writes_output_dpi() {
        let raw_json = r#"{
            "profiles": [
                {
                    "Output DPI": 1600.0,
                    "Whole or horizontal accel parameters": {
                        "scale": 1.0
                    },
                    "Vertical accel parameters": {
                        "scale": 1.0
                    },
                    "Acceleration": 0.05
                }
            ]
        }"#;

        let backup = RawAccelBackup {
            output_dpi: Some(1600.0),
            scale_whole: Some(1.0),
            scale_vert: Some(1.0),
            last_written_output_dpi: None,
            last_written_scale: None,
            saved_at: String::new(),
        };
        let transformed = apply_scale_to_rawaccel_json(raw_json, &backup, 1600.0, 1.25).expect("apply scale ok");
        let v: serde_json::Value = serde_json::from_str(&transformed).unwrap();
        let prof = &v["profiles"][0];

        // Output DPI carries the multiplier; other fields and scale stay at backup values
        assert_eq!(prof["Output DPI"].as_f64(), Some(2000.0));
        assert_eq!(prof["Acceleration"].as_f64(), Some(0.05));
        assert_eq!(prof["Whole or horizontal accel parameters"]["scale"].as_f64(), Some(1.0));
        assert_eq!(prof["Vertical accel parameters"]["scale"].as_f64(), Some(1.0));
    }

    #[test]
    fn test_restore_rawaccel_json_from_backup() {
        let backup = RawAccelBackup {
            output_dpi: Some(800.0),
            scale_whole: Some(1.0),
            scale_vert: Some(0.9),
            last_written_output_dpi: Some(800.0),
            last_written_scale: Some(1.5),
            saved_at: "2026-10-12T00:00:00Z".to_string(),
        };

        let current_json = r#"{
            "profiles": [
                {
                    "Output DPI": 800.0,
                    "Whole or horizontal accel parameters": {
                        "scale": 1.5
                    },
                    "Vertical accel parameters": {
                        "scale": 1.5
                    }
                }
            ]
        }"#;

        let restored_str = restore_rawaccel_json_from_backup(current_json, &backup).expect("restore ok");
        let v: serde_json::Value = serde_json::from_str(&restored_str).unwrap();
        let prof = &v["profiles"][0];

        assert_eq!(prof["Whole or horizontal accel parameters"]["scale"].as_f64(), Some(1.0));
        assert_eq!(prof["Vertical accel parameters"]["scale"].as_f64(), Some(0.9));
        assert_eq!(prof["Output DPI"].as_f64(), Some(800.0));
    }

    #[test]
    fn test_atomic_write_file() {
        let tmp_dir = std::env::temp_dir().join(format!("aim_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let _ = std::fs::create_dir_all(&tmp_dir);
        let target_file = tmp_dir.join("test_settings.json");

        let test_content = "{\"hello\":\"world\"}";
        atomic_write(&target_file, test_content).expect("atomic write should succeed");

        let read_back = std::fs::read_to_string(&target_file).expect("should read target file");
        assert_eq!(read_back, test_content);

        // Verify temp file does not remain
        let tmp_pattern = tmp_dir.join("test_settings.json.tmp");
        assert!(!tmp_pattern.exists());

        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    #[test]
    fn test_multiplier_calculation_independent_of_center_override() {
        let settings = RandomizerSettings {
            base_sens_cm: 50.0,
            spread_percent: 20.0,
            auto_scenario_sens: true,
            ..RandomizerSettings::default()
        };

        let mut st = SamplerState::default();
        let mut rng = StdRng::seed_from_u64(123);

        // Center override is 30.0 cm, but base is 50.0 cm
        let (cm, mult) = generate_next_sens(&settings, Some(30.0), &mut st, &mut rng);
        let expected_mult = (50.0 / cm * 10000.0).round() / 10000.0;
        assert_eq!(mult, expected_mult, "mult must always be base / target cm regardless of center override");
    }

    #[test]
    fn test_reroll_drift_threshold() {
        let last_center: f64 = 40.0;
        let threshold = 1.03_f64.ln();

        // 2% drift -> should not trigger reroll
        let center_2pct: f64 = 40.8;
        let drift_2pct = (center_2pct / last_center).ln().abs();
        assert!(drift_2pct < threshold);

        // 2.9% drift -> should not trigger reroll
        let center_2_9pct: f64 = 41.16;
        let drift_2_9pct = (center_2_9pct / last_center).ln().abs();
        assert!(drift_2_9pct < threshold);

        // 4% drift -> triggers reroll
        let center_4pct: f64 = 41.6;
        let drift_4pct = (center_4pct / last_center).ln().abs();
        assert!(drift_4pct > threshold);

        // -5% drift -> triggers reroll
        let center_minus_5pct: f64 = 38.0;
        let drift_minus_5pct = (center_minus_5pct / last_center).ln().abs();
        assert!(drift_minus_5pct > threshold);
    }
}
