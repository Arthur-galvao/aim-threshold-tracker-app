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
    let sens = find_number(&content, &["horizsens", "sens", "sensscale", "sensitivity"])
        .unwrap_or(0.0);
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
                    let value: String = after
                        .chars()
                        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || *c == '.')
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
}