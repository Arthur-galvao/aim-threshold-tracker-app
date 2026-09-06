use std::path::Path;

use chrono::NaiveDateTime;

use crate::model::KovaakRun;

pub fn parse_stats_file(path: &Path) -> Option<KovaakRun> {
    let file_name = path.file_name()?.to_string_lossy().to_string();
    let content = std::fs::read_to_string(path).ok()?;

    if content.trim().is_empty() {
        return None;
    }

    let scenario = parse_filename_scenario(&file_name)
        .or_else(|| find_line_value(&content, &["scenario", "scenarioname"]))
        .or_else(|| find_csv_string_field(&content, &["scenario", "scenarioname"]))
        .unwrap_or_default();
    if scenario.is_empty() {
        return None;
    }

    let score = find_number(&content, &["score"])?;
    let raw_sens = find_number(&content, &["horizsens", "sens", "sensitivity"])
        .or_else(|| find_number(&content, &["sensscale"]))
        .unwrap_or(0.0);
    let sens_scale = find_line_value(&content, &["sensscale", "sensitivityscale", "scale"])
        .or_else(|| find_csv_string_field(&content, &["sensscale", "sensitivityscale", "scale"]));
    let dpi = find_number(&content, &["dpi"]).unwrap_or(800.0);

    let sens = convert_sens_to_cm(raw_sens, sens_scale.as_deref(), dpi);
    let fov = find_number(&content, &["fov"]).unwrap_or(103.0);
    let datetime = parse_filename_datetime(&file_name)
        .or_else(|| parse_datetime_field(&content))
        .unwrap_or_else(|| "1970-01-01T00:00:00".to_string());

    Some(KovaakRun {
        scenario,
        score,
        sens,
        fov,
        datetime,
        source_file: file_name,
    })
}

fn parse_filename_scenario(file_name: &str) -> Option<String> {
    let trimmed = file_name.strip_suffix(".csv")?;
    let trimmed = trimmed.strip_suffix("Stats").map(str::trim).unwrap_or(trimmed);
    let trimmed = trimmed.trim();

    let parts: Vec<&str> = trimmed.split(" - ").collect();
    if parts.len() < 2 {
        return None;
    }

    let timestamp_ok = NaiveDateTime::parse_from_str(parts[parts.len() - 1], "%Y.%m.%d-%H.%M.%S").is_ok();
    if !timestamp_ok {
        return None;
    }

    let end = if parts.len() >= 3 { parts.len() - 2 } else { 1 };
    let scenario = parts[..end].join(" - ");
    if scenario.is_empty() {
        return None;
    }
    Some(scenario)
}

fn parse_filename_datetime(file_name: &str) -> Option<String> {
    let trimmed = file_name.strip_suffix(".csv")?;
    let trimmed = trimmed.strip_suffix("Stats").map(str::trim).unwrap_or(trimmed);
    let trimmed = trimmed.trim();

    let ts = trimmed.rsplit(" - ").next()?;
    let parsed = NaiveDateTime::parse_from_str(ts, "%Y.%m.%d-%H.%M.%S").ok()?;
    Some(parsed.format("%Y-%m-%dT%H:%M:%S").to_string())
}

fn parse_datetime_field(content: &str) -> Option<String> {
    for line in content.lines().take(60) {
        let line = line.trim();
        if line.starts_with(',') || line.starts_with("Scenario") || line.starts_with("scenario") {
            continue;
        }
        let tokens: Vec<&str> = line.split(',').map(str::trim).collect();
        for token in tokens {
            if let Ok(parsed) = NaiveDateTime::parse_from_str(token, "%Y.%m.%d-%H.%M.%S") {
                return Some(parsed.format("%Y-%m-%dT%H:%M:%S").to_string());
            }
        }
    }
    None
}

pub fn convert_sens_to_cm(raw_sens: f64, scale_str: Option<&str>, dpi: f64) -> f64 {
    if raw_sens <= 0.0 || raw_sens.is_nan() || raw_sens.is_infinite() {
        return 0.0;
    }

    let effective_dpi = if dpi > 0.0 { dpi } else { 800.0 };
    let scale_norm = scale_str.map(normalize).unwrap_or_default();

    let yaw = match scale_norm.as_str() {
        // cm/360 scale: already in physical distance
        "cm360" | "cm" => return round_sens(raw_sens),

        // Valorant: yaw = 0.07 degrees
        "valorant" => 0.07,

        // Source / Apex Legends / CS:GO / CS2 / Quake: yaw = 0.022 degrees
        "source" | "quake" | "quakesource" | "apex" | "apexlegends" | "csgo" | "cs2"
        | "counterstrike" => 0.022,

        // Overwatch / Overwatch 2 / Call of Duty: yaw = 0.0066 degrees
        "overwatch" | "overwatch2" | "ow" | "callofduty" | "cod" | "modernwarfare" => 0.0066,

        // Fortnite Slider: yaw = 0.00555555 degrees (percent) or 0.555555 (decimal)
        "fortnite" | "fortniteslider" | "fortnitepercentage" => {
            if raw_sens > 1.0 {
                0.0055555555
            } else {
                0.55555555
            }
        }

        // Rainbow Six Siege: yaw = 0.00528 degrees
        "rainbowsix" | "rainbowsixsiege" | "r6" => 0.00528,

        // Fallback when scale is missing or unspecified:
        _ => {
            // Typical cm/360 physical range is 5.0 to 150.0
            if raw_sens >= 5.0 && raw_sens <= 150.0 {
                return round_sens(raw_sens);
            }
            // Small values (< 2.5) with no scale are almost certainly in-game sens (Valorant yaw = 0.07)
            0.07
        }
    };

    // cm/360 = (360 * 2.54) / (DPI * yaw * sens)
    // 360 * 2.54 = 914.4
    let cm = 914.4 / (effective_dpi * yaw * raw_sens);
    if cm.is_nan() || cm.is_infinite() {
        0.0
    } else {
        round_sens(cm)
    }
}

fn round_sens(val: f64) -> f64 {
    (val * 10.0).round() / 10.0
}

fn normalize(value: &str) -> String {
    value
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .flat_map(|c| c.to_lowercase())
        .collect()
}

fn find_number(content: &str, aliases: &[&str]) -> Option<f64> {
    find_line_value(content, aliases)
        .and_then(|v| v.parse::<f64>().ok())
        .or_else(|| find_csv_field(content, aliases))
}

fn find_line_value(content: &str, aliases: &[&str]) -> Option<String> {
    let normalized_aliases: Vec<String> = aliases.iter().map(|a| normalize(a)).collect();
    let lines: Vec<&str> = content.lines().collect();

    for alias in &normalized_aliases {
        for line in &lines {
            let trimmed = line.trim();
            let lower = trimmed.to_lowercase();

            for (idx, _) in lower.match_indices(':') {
                let before = lower[..idx].trim();
                if normalize(before) == *alias {
                    let after = trimmed[idx + 1..].trim();
                    let cleaned = after.trim_start_matches(',').trim();
                    let value: String = cleaned
                        .chars()
                        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || *c == '.' || *c == '/' || *c == '-' || *c == '_')
                        .collect();
                    let value = value.trim();
                    if !value.is_empty() {
                        return Some(value.to_string());
                    }
                }
            }
        }
    }

    None
}

fn find_csv_string_field(content: &str, aliases: &[&str]) -> Option<String> {
    let normalized_aliases: Vec<String> = aliases.iter().map(|a| normalize(a)).collect();

    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .has_headers(true)
        .from_reader(content.as_bytes());

    let headers = reader.headers().ok()?.clone();

    for alias in &normalized_aliases {
        if let Some(index) = headers.iter().position(|h| normalize(h) == *alias) {
            for record in reader.records().flatten() {
                if let Some(raw) = record.get(index) {
                    let value = raw.trim();
                    if !value.is_empty() {
                        return Some(value.to_string());
                    }
                }
            }
        }
    }
    None
}

fn find_csv_field(content: &str, aliases: &[&str]) -> Option<f64> {
    let normalized_aliases: Vec<String> = aliases.iter().map(|a| normalize(a)).collect();

    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .has_headers(true)
        .from_reader(content.as_bytes());

    let headers = reader.headers().ok()?.clone();

    for alias in &normalized_aliases {
        if let Some(index) = headers.iter().position(|h| normalize(h) == *alias) {
            for record in reader.records().flatten() {
                if let Some(raw) = record.get(index) {
                    let value = raw.trim();
                    if value.is_empty() {
                        continue;
                    }
                    if let Ok(num) = value.parse::<f64>() {
                        return Some(num);
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_temp(file_name: &str, content: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(file_name);
        std::fs::write(&path, content).unwrap();
        path
    }

    fn cleanup(path: &std::path::Path) {
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn parses_old_format_csv() {
        let path = write_temp(
            "kovaak_old_format.csv",
            "Scenario,Score,Accuracy,Sens Scale,Horiz Sens,Vert Sens,FOV,Run Date\n1w2ts Pasu Perfected,1000,80,1.0,45,45,103,2026.10.18-19.30.22\n",
        );
        let run = parse_stats_file(&path).expect("deveria parsear");
        assert_eq!(run.scenario, "1w2ts Pasu Perfected");
        assert_eq!(run.score, 1000.0);
        assert_eq!(run.sens, 45.0);
        assert_eq!(run.fov, 103.0);
        assert_eq!(run.datetime, "2026-10-18T19:30:22");
        cleanup(&path);
    }

    #[test]
    fn parses_summary_section_format() {
        let path = write_temp(
            "kovaak_summary_format.csv",
            "Scenario: 1w2ts Pasu Perfected\nScore: 1080\nAccuracy: 85\nSens Scale: 1.0\nHoriz Sens: 45\nFOV: 103\n",
        );
        let run = parse_stats_file(&path).expect("deveria parsear");
        assert_eq!(run.scenario, "1w2ts Pasu Perfected");
        assert_eq!(run.score, 1080.0);
        assert_eq!(run.sens, 45.0);
        assert_eq!(run.fov, 103.0);
        cleanup(&path);
    }

    #[test]
    fn parses_real_filename_with_mode() {
        let path = write_temp(
            "1w2ts Pasu Perfected - Challenge - 2026.10.18-19.30.22 Stats.csv",
            "Scenario,Score,Accuracy,Sens Scale,Horiz Sens,Vert Sens,FOV,Run Date\n1w2ts Pasu Perfected,1000,80,1.0,45,45,103,2026.10.18-19.30.22\n",
        );
        let run = parse_stats_file(&path).expect("deveria parsear");
        assert_eq!(run.scenario, "1w2ts Pasu Perfected");
        assert_eq!(run.datetime, "2026-10-18T19:30:22");
        assert_eq!(run.source_file, "1w2ts Pasu Perfected - Challenge - 2026.10.18-19.30.22 Stats.csv");
        cleanup(&path);
    }

    #[test]
    fn scenario_with_dashes_kept() {
        let path = write_temp(
            "VoxTargets Dodge - No Reload - Challenge - 2026.10.18-19.30.22 Stats.csv",
            "Scenario,Score,Accuracy,Sens Scale,Horiz Sens,Vert Sens,FOV,Run Date\nVoxTargets Dodge - No Reload,1000,80,1.0,45,45,103,2026.10.18-19.30.22\n",
        );
        let run = parse_stats_file(&path).expect("deveria parsear");
        assert_eq!(run.scenario, "VoxTargets Dodge - No Reload");
        cleanup(&path);
    }

    #[test]
    fn rejects_non_kovaak_file() {
        let path = write_temp("data.csv", "a,b,c\n1,2,3\n");
        assert!(parse_stats_file(&path).is_none());
        cleanup(&path);
    }

    #[test]
    fn prefers_filename_timestamp_over_csv() {
        let path = write_temp(
            "WALLHACK - VBRClick Easy - Challenge - 2026.10.20-09.15.00 Stats.csv",
            "Scenario,Score,Accuracy,Sens Scale,Horiz Sens,Vert Sens,FOV,Run Date\nWALLHACK - VBRClick Easy,920,88,1.0,55,55,103,2026.10.20-09.15.00\n",
        );
        let run = parse_stats_file(&path).expect("deveria parsear");
        assert_eq!(run.scenario, "WALLHACK - VBRClick Easy");
        assert_eq!(run.datetime, "2026-10-20T09:15:00");
        assert_eq!(run.score, 920.0);
        assert_eq!(run.sens, 55.0);
        cleanup(&path);
    }

    #[test]
    fn converts_valorant_sens_to_cm() {
        assert_eq!(convert_sens_to_cm(0.24013, Some("Valorant"), 800.0), 68.0);
        assert_eq!(convert_sens_to_cm(0.32676, Some("Valorant"), 800.0), 50.0);
        assert_eq!(convert_sens_to_cm(0.23, Some("Valorant"), 800.0), 71.0);
        assert_eq!(convert_sens_to_cm(50.0, Some("cm/360"), 800.0), 50.0);
    }

    #[test]
    fn parses_real_kovaak_valorant_format() {
        let content = "Score:,120.0\nScenario:,1w2ts Pasu\nSens Scale:,Valorant\nHoriz Sens:,0.24013\nDPI:,800\nFOV:,103.0\n";
        let path = write_temp("1w2ts Pasu - Challenge - 2026.07.28-19.24.07 Stats.csv", content);
        let run = parse_stats_file(&path).expect("deveria parsear");
        assert_eq!(run.sens, 68.0);
        cleanup(&path);
    }
}