use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KovaakPlaylistItem {
    #[serde(alias = "scenario_name", alias = "scenarioName")]
    pub scenario_name: String,
    #[serde(alias = "play_Count", alias = "playCount", default = "default_play_count")]
    pub play_count: f64,
}

fn default_play_count() -> f64 {
    1.0
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KovaakPlaylist {
    #[serde(alias = "playlistName", alias = "playlist_name")]
    pub playlist_name: String,
    #[serde(alias = "scenarioList", alias = "scenario_list", default)]
    pub scenario_list: Vec<KovaakPlaylistItem>,
    #[serde(default)]
    pub description: Option<String>,
}

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

pub fn detect_kovaak_playlists_dir(stats_path: Option<&str>) -> Option<PathBuf> {
    if let Some(sp) = stats_path {
        let p = PathBuf::from(sp);
        if let Some(parent) = p.parent() {
            let candidate = parent.join(r"Saved\SaveGames\Playlists");
            if candidate.exists() && candidate.is_dir() {
                return Some(candidate);
            }
        }
        let direct = p.join(r"Saved\SaveGames\Playlists");
        if direct.exists() && direct.is_dir() {
            return Some(direct);
        }
    }

    let mut candidates: Vec<PathBuf> = Vec::new();

    #[cfg(windows)]
    if let Some(steam_path) = steam_install_path() {
        candidates.push(steam_path.join(r"steamapps\common\FPSAimTrainer\FPSAimTrainer\Saved\SaveGames\Playlists"));
        let vdf = steam_path.join(r"steamapps\libraryfolders.vdf");
        if let Ok(content) = fs::read_to_string(&vdf) {
            for line in content.lines() {
                if let Some(lib) = parse_library_vdf_line(line) {
                    candidates.push(lib.join(r"steamapps\common\FPSAimTrainer\FPSAimTrainer\Saved\SaveGames\Playlists"));
                }
            }
        }
    }

    #[cfg(not(windows))]
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".steam/steam/steamapps/common/FPSAimTrainer/FPSAimTrainer/Saved/SaveGames/Playlists"));
        candidates.push(home.join("Library/Steam/steamapps/common/FPSAimTrainer/FPSAimTrainer/Saved/SaveGames/Playlists"));
        candidates.push(home.join("Steam/steamapps/common/FPSAimTrainer/FPSAimTrainer/Saved/SaveGames/Playlists"));
    }

    candidates.push(PathBuf::from(r"C:\Program Files (x86)\Steam\steamapps\common\FPSAimTrainer\FPSAimTrainer\Saved\SaveGames\Playlists"));
    candidates.push(PathBuf::from(r"C:\Program Files\Steam\steamapps\common\FPSAimTrainer\FPSAimTrainer\Saved\SaveGames\Playlists"));

    candidates
        .into_iter()
        .find(|path| path.exists() && path.is_dir())
}

pub fn load_all_kovaak_playlists(stats_path: Option<&str>) -> Vec<KovaakPlaylist> {
    let dir = match detect_kovaak_playlists_dir(stats_path) {
        Some(d) => d,
        None => return Vec::new(),
    };

    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    let mut playlists = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext.eq_ignore_ascii_case("json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(parsed) = serde_json::from_str::<KovaakPlaylist>(&content) {
                            if !parsed.playlist_name.trim().is_empty() && !parsed.scenario_list.is_empty() {
                                playlists.push(parsed);
                            }
                        }
                    }
                }
            }
        }
    }
    playlists.sort_by(|a, b| a.playlist_name.to_lowercase().cmp(&b.playlist_name.to_lowercase()));
    playlists
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_kovaak_playlist_json() {
        let sample = r#"{
            "playlistName": "@thrFPS - ANATOMIA DO FLICK v1",
            "playlistId": 475286,
            "scenarioList": [
                {
                    "scenario_name": "WALLHACK - VBRClick Easy",
                    "play_Count": 2
                },
                {
                    "scenario_name": "1w2ts Pasu Perfected",
                    "play_Count": 1
                }
            ],
            "description": "Flick training"
        }"#;

        let parsed: KovaakPlaylist = serde_json::from_str(sample).expect("failed to parse playlist");
        assert_eq!(parsed.playlist_name, "@thrFPS - ANATOMIA DO FLICK v1");
        assert_eq!(parsed.scenario_list.len(), 2);
        assert_eq!(parsed.scenario_list[0].scenario_name, "WALLHACK - VBRClick Easy");
        assert_eq!(parsed.scenario_list[0].play_count, 2.0);
        assert_eq!(parsed.description, Some("Flick training".to_string()));
    }

    #[test]
    fn test_detect_kovaak_playlists_dir_from_stats_parent() {
        let fake_stats = PathBuf::from(r"C:\Games\Steam\steamapps\common\FPSAimTrainer\FPSAimTrainer\stats");
        let parent = fake_stats.parent().unwrap();
        let target = parent.join(r"Saved\SaveGames\Playlists");
        assert_eq!(target, PathBuf::from(r"C:\Games\Steam\steamapps\common\FPSAimTrainer\FPSAimTrainer\Saved\SaveGames\Playlists"));
    }

    #[test]
    fn test_load_all_kovaak_playlists() {
        let tmp_dir = std::env::temp_dir().join(format!("kovaak_pl_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
        let pl_dir = tmp_dir.join(r"Saved\SaveGames\Playlists");
        fs::create_dir_all(&pl_dir).unwrap();

        let pl1 = r#"{"playlistName": "Playlist B", "scenarioList": [{"scenario_name": "S1", "play_Count": 1}]}"#;
        let pl2 = r#"{"playlistName": "Playlist A", "scenarioList": [{"scenario_name": "S2", "play_Count": 3}]}"#;
        let invalid = r#"{"other": 123}"#;

        fs::write(pl_dir.join("b.json"), pl1).unwrap();
        fs::write(pl_dir.join("a.json"), pl2).unwrap();
        fs::write(pl_dir.join("invalid.json"), invalid).unwrap();

        let loaded = load_all_kovaak_playlists(Some(tmp_dir.to_str().unwrap()));
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].playlist_name, "Playlist A");
        assert_eq!(loaded[1].playlist_name, "Playlist B");
        assert_eq!(loaded[0].scenario_list[0].scenario_name, "S2");
        assert_eq!(loaded[0].scenario_list[0].play_count, 3.0);

        let _ = fs::remove_dir_all(tmp_dir);
    }
}