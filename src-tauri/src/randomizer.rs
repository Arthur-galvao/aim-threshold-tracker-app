use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use rand::Rng;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::model::{RandomizerSettings, RandomizerState};
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

pub fn check_rawaccel_availability(configured_dir: Option<&str>) -> (bool, Option<PathBuf>, Option<String>) {
    let found_dir = detect_rawaccel_dir(configured_dir);

    match found_dir {
        Some(dir) => {
            let driver_ok = is_driver_registered();
            if !driver_ok {
                (
                    false,
                    Some(dir),
                    Some("Pasta do RawAccel encontrada, mas o driver de kernel não está registrado. Execute o installer.exe e reinicie o PC.".into()),
                )
            } else {
                (true, Some(dir), None)
            }
        }
        None => (
            false,
            None,
            Some("RawAccel não encontrado nos locais comuns nem configurado nas opções.".into()),
        ),
    }
}

pub fn generate_next_sens(settings: &RandomizerSettings, current_sens: f64) -> (f64, f64) {
    let mut rng = rand::thread_rng();
    let base_cm = if settings.base_sens_cm > 0.0 {
        settings.base_sens_cm
    } else {
        40.0
    };

    let is_cm_mode = settings.range_mode.eq_ignore_ascii_case("cm360");

    let min_cm = settings.min_cm.min(settings.max_cm).max(5.0);
    let max_cm = settings.min_cm.max(settings.max_cm).max(5.0);

    let min_mult = settings.min_mult.min(settings.max_mult).max(0.1);
    let max_mult = settings.min_mult.max(settings.max_mult).max(0.1);

    let mut target_cm = current_sens;
    let mut target_mult = 1.0;

    for _ in 0..15 {
        if is_cm_mode {
            target_cm = rng.gen_range(min_cm..=max_cm);
            target_mult = base_cm / target_cm;
        } else {
            target_mult = rng.gen_range(min_mult..=max_mult);
            target_cm = base_cm / target_mult;
        }

        if !settings.avoid_repeats || current_sens <= 0.0 {
            break;
        }

        let delta_ratio = ((target_cm - current_sens).abs()) / current_sens;
        if delta_ratio >= 0.05 {
            break;
        }
    }

    let rounded_cm = (target_cm * 100.0).round() / 100.0;
    let rounded_mult = (target_mult * 10000.0).round() / 10000.0;

    (rounded_cm, rounded_mult)
}

pub fn update_and_apply_scale(rawaccel_dir: &Path, scale: f64) -> Result<(), String> {
    let settings_path = rawaccel_dir.join("settings.json");
    let writer_path = rawaccel_dir.join("writer.exe");

    if !settings_path.exists() {
        return Err(format!("settings.json não encontrado em {}", rawaccel_dir.display()));
    }
    if !writer_path.exists() {
        return Err(format!("writer.exe não encontrado em {}", rawaccel_dir.display()));
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Falha ao ler settings.json: {e}"))?;

    let mut json: Value = serde_json::from_str(&content)
        .map_err(|e| format!("Formato de JSON inválido no settings.json: {e}"))?;

    if let Some(profiles) = json.get_mut("profiles").and_then(|p| p.as_array_mut()) {
        if let Some(first_profile) = profiles.get_mut(0) {
            if let Some(whole_params) = first_profile
                .get_mut("Whole or horizontal accel parameters")
                .and_then(|w| w.as_object_mut())
            {
                whole_params.insert("scale".to_string(), serde_json::json!(scale));
            }
            if let Some(vert_params) = first_profile
                .get_mut("Vertical accel parameters")
                .and_then(|v| v.as_object_mut())
            {
                vert_params.insert("scale".to_string(), serde_json::json!(scale));
            }
        }
    }

    let updated_content = serde_json::to_string_pretty(&json)
        .map_err(|e| format!("Falha ao serializar settings.json: {e}"))?;

    fs::write(&settings_path, updated_content)
        .map_err(|e| format!("Falha ao escrever settings.json: {e}"))?;

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

pub fn apply_next_sens(
    app: &AppHandle,
    last_scenario: Option<String>,
    last_score: Option<f64>,
) -> Result<RandomizerState, String> {
    let state: State<AppState> = app.state();

    let (settings, current_cm) = {
        let s = state.settings.lock().unwrap();
        let current = state.randomizer_state.lock().unwrap().active_sens_cm;
        (s.randomizer.clone(), current)
    };

    let (available, found_dir, err_msg) = check_rawaccel_availability(settings.rawaccel_dir.as_deref());

    if !available {
        let mut r_state = state.randomizer_state.lock().unwrap();
        r_state.available = false;
        r_state.error_message = err_msg.clone();
        let clone = r_state.clone();
        drop(r_state);
        let _ = app.emit("sens_updated", &clone);
        return Err(err_msg.unwrap_or_else(|| "RawAccel indisponível".into()));
    }

    let target_dir = found_dir.ok_or_else(|| "Diretório do RawAccel indefinido".to_string())?;

    let (next_cm, next_mult) = generate_next_sens(&settings, current_cm);

    update_and_apply_scale(&target_dir, next_mult)?;

    let now_iso = chrono::Local::now().to_rfc3339();

    let new_state = {
        let mut r_state = state.randomizer_state.lock().unwrap();
        r_state.available = true;
        r_state.active_sens_cm = next_cm;
        r_state.active_mult = next_mult;
        r_state.last_run_scenario = last_scenario;
        r_state.last_run_score = last_score;
        r_state.last_updated = Some(now_iso);
        r_state.error_message = None;
        r_state.clone()
    };

    app.emit("sens_updated", &new_state)
        .map_err(|e| e.to_string())?;

    Ok(new_state)
}
