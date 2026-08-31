use std::fs;
use std::path::PathBuf;

pub fn detect_kovaak_path() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    #[cfg(windows)]
    if let Some(steam_path) = steam_install_path() {
        candidates.push(steam_path.join(r"steamapps\common\FPSAimTrainer\FPSAimTrainer\stats"));
        let vdf = steam_path.join(r"steamapps\libraryfolders.vdf");
        if let Ok(content) = fs::read_to_string(&vdf) {
            for line in content.lines() {
                if let Some(lib) = parse_library_vdf_line(line) {
                    candidates.push(lib.join(r"steamapps\common\FPSAimTrainer\FPSAimTrainer\stats"));
                }
            }
        }
    }

    #[cfg(not(windows))]
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".steam/steam/steamapps/common/FPSAimTrainer/FPSAimTrainer/stats"));
        candidates.push(home.join("Library/Steam/steamapps/common/FPSAimTrainer/FPSAimTrainer/stats"));
        candidates.push(home.join("Steam/steamapps/common/FPSAimTrainer/FPSAimTrainer/stats"));
    }

    candidates.push(PathBuf::from(r"C:\Program Files (x86)\Steam\steamapps\common\FPSAimTrainer\FPSAimTrainer\stats"));
    candidates.push(PathBuf::from(r"C:\Program Files\Steam\steamapps\common\FPSAimTrainer\FPSAimTrainer\stats"));

    candidates
        .into_iter()
        .find(|path| path.exists() && path.is_dir())
}

#[cfg(windows)]
fn steam_install_path() -> Option<PathBuf> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let steam = hkcu.open_subkey(r"Software\Valve\Steam").ok()?;
    let raw: String = steam.get_value("SteamPath").ok()?;
    let raw = raw.replace('/', r"\");
    Some(PathBuf::from(raw))
}

fn parse_library_vdf_line(line: &str) -> Option<PathBuf> {
    let trimmed = line.trim();
    let quoted: Vec<&str> = trimmed
        .split('"')
        .filter(|s| !s.trim().is_empty())
        .collect();

    if quoted.len() < 2 {
        return None;
    }

    let key = quoted[0].trim();
    if key.parse::<u32>().is_err() {
        return None;
    }

    let raw = quoted[1].replace('/', r"\");
    Some(PathBuf::from(raw))
}