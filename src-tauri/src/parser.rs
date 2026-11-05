use std::collections::HashMap;
use std::path::Path;

use chrono::NaiveDateTime;

use crate::model::{KovaakRun, RunStats};

/// Totais da tabela de armas (cabeçalho `Weapon,...` + linhas seguintes).
#[derive(Debug, Default, PartialEq)]
struct WeaponTotals {
    shots: Option<u32>,
    hits: Option<u32>,
    damage_done: Option<f64>,
    damage_possible: Option<f64>,
}

pub fn parse_stats_file_with_fallback_dpi(path: &Path, fallback_dpi: f64) -> Option<KovaakRun> {
    let file_name = path.file_name()?.to_string_lossy().to_string();
    let content = std::fs::read_to_string(path).ok()?;

    if content.trim().is_empty() {
        return None;
    }

    // Uma única passada: chave normalizada -> valor (primeira ocorrência vence).
    let summary = build_summary_map(&content);

    let scenario = parse_filename_scenario(&file_name)
        .or_else(|| lookup(&summary, &["scenario", "scenarioname"]).map(str::to_string))
        .or_else(|| find_csv_string_field(&content, &["scenario", "scenarioname"]))
        .unwrap_or_default();
    if scenario.is_empty() {
        return None;
    }

    // Run completa só com Score E tabela de armas (senão o jogo ainda está escrevendo).
    let score = number_or_csv(&summary, &content, &["score"])?;
    let weapons = parse_weapon_table(&content)?;

    let raw_sens = number_or_csv(&summary, &content, &["horizsens", "sens", "sensitivity"])
        .or_else(|| number_or_csv(&summary, &content, &["sensscale"]))
        .unwrap_or(0.0);
    let sens_scale = lookup(&summary, &["sensscale", "sensitivityscale", "scale"])
        .map(str::to_string)
        .or_else(|| find_csv_string_field(&content, &["sensscale", "sensitivityscale", "scale"]));
    let fov = number_or_csv(&summary, &content, &["fov"]).unwrap_or(103.0);
    let datetime = parse_filename_datetime(&file_name)
        .or_else(|| parse_datetime_field(&content))
        .unwrap_or_else(|| "1970-01-01T00:00:00".to_string());

    let accuracy = match (weapons.shots, weapons.hits) {
        (Some(shots), Some(hits)) if shots > 0 => Some(f64::from(hits) / f64::from(shots)),
        _ => None,
    };

    let stats = RunStats {
        dpi: stat_num(&summary, &["dpi"]),
        shots: weapons.shots,
        hits: weapons.hits,
        accuracy,
        kills: stat_u32(&summary, &["kills"]),
        avg_ttk: stat_num(&summary, &["avgttk"]),
        damage_done: stat_num(&summary, &["damagedone"]).or(weapons.damage_done),
        damage_possible: weapons.damage_possible,
        fight_time: stat_num(&summary, &["fighttime"]),
        pause_count: stat_num(&summary, &["pausecount"]),
        pause_duration: stat_num(&summary, &["pauseduration"]),
        avg_fps: stat_num(&summary, &["avgfps"]),
        game_version: stat_str(&summary, &["gameversion"]),
        hash: stat_str(&summary, &["hash"]),
    };

    let default_dpi = if fallback_dpi > 0.0 { fallback_dpi } else { 800.0 };
    let dpi = stats.dpi.unwrap_or(default_dpi);
    let sens = convert_sens_to_cm(raw_sens, sens_scale.as_deref(), dpi);

    Some(KovaakRun {
        scenario,
        score,
        sens,
        fov,
        datetime,
        source_file: file_name,
        game: "kovaak".to_string(),
        stats,
        ..Default::default()
    })
}

pub fn scenario_from_file_name(file_name: &str) -> Option<String> {
    parse_filename_scenario(file_name)
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

        // Escala ausente ou desconhecida: só aceita valor já em cm/360 plausível.
        // Fora de 5..=150 não há como saber a escala, então não chutamos (0.0 = desconhecido).
        _ => {
            if (5.0..=150.0).contains(&raw_sens) {
                return round_sens(raw_sens);
            }
            return 0.0;
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

/// Lê um número, ignorando sufixos de unidade (ex.: "0.512s" -> 0.512).
fn parse_number(raw: &str) -> Option<f64> {
    let trimmed = raw
        .trim()
        .trim_end_matches(|c: char| c.is_alphabetic() || c == '%' || c.is_whitespace());
    trimmed.parse::<f64>().ok().filter(|v| v.is_finite())
}

/// Varre o conteúdo uma vez e indexa cada linha `Chave:,valor` pela chave normalizada.
fn build_summary_map(content: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for line in content.lines() {
        let Some(sep) = line.find(":,") else {
            continue;
        };
        let key = normalize(&line[..sep]);
        if key.is_empty() {
            continue;
        }
        let value = line[sep + 2..].trim();
        map.entry(key).or_insert_with(|| value.to_string());
    }
    map
}

/// Primeiro alias presente com valor não vazio.
fn lookup<'a>(summary: &'a HashMap<String, String>, aliases: &[&str]) -> Option<&'a str> {
    for alias in aliases {
        if let Some(value) = summary.get(&normalize(alias)) {
            if !value.is_empty() {
                return Some(value.as_str());
            }
        }
    }
    None
}

/// Número do mapa; se a chave não existe no mapa, cai no cabeçalho CSV (formato antigo).
fn number_or_csv(summary: &HashMap<String, String>, content: &str, aliases: &[&str]) -> Option<f64> {
    match lookup(summary, aliases) {
        Some(raw) => parse_number(raw),
        None => find_csv_field(content, aliases),
    }
}

fn stat_num(summary: &HashMap<String, String>, aliases: &[&str]) -> Option<f64> {
    lookup(summary, aliases).and_then(parse_number)
}

fn stat_u32(summary: &HashMap<String, String>, aliases: &[&str]) -> Option<u32> {
    lookup(summary, aliases)
        .and_then(parse_number)
        .filter(|v| *v >= 0.0)
        .map(|v| v.round() as u32)
}

fn stat_str(summary: &HashMap<String, String>, aliases: &[&str]) -> Option<String> {
    lookup(summary, aliases).map(str::to_string)
}

/// Localiza o cabeçalho `Weapon,...` e soma Shots/Hits/Damage das linhas até a
/// primeira linha vazia ou linha `Chave:,valor`. `None` se o cabeçalho não existir.
fn parse_weapon_table(content: &str) -> Option<WeaponTotals> {
    let mut lines = content.lines();

    let header: Vec<&str> = loop {
        let line = lines.next()?;
        let fields: Vec<&str> = line.split(',').map(str::trim).collect();
        if fields.first().copied() == Some("Weapon") {
            break fields;
        }
    };

    let column = |name: &str| header.iter().position(|h| normalize(h) == normalize(name));
    let shots_idx = column("Shots");
    let hits_idx = column("Hits");
    let dmg_done_idx = column("Damage Done");
    let dmg_possible_idx = column("Damage Possible");

    let mut totals = WeaponTotals {
        shots: shots_idx.map(|_| 0),
        hits: hits_idx.map(|_| 0),
        damage_done: dmg_done_idx.map(|_| 0.0),
        damage_possible: dmg_possible_idx.map(|_| 0.0),
    };

    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.contains(":,") {
            break;
        }
        let fields: Vec<&str> = line.split(',').map(str::trim).collect();
        let field = |idx: Option<usize>| idx.and_then(|i| fields.get(i)).copied();

        accumulate_u32(&mut totals.shots, field(shots_idx));
        accumulate_u32(&mut totals.hits, field(hits_idx));
        accumulate_f64(&mut totals.damage_done, field(dmg_done_idx));
        accumulate_f64(&mut totals.damage_possible, field(dmg_possible_idx));
    }

    Some(totals)
}

fn accumulate_u32(sum: &mut Option<u32>, raw: Option<&str>) {
    if let (Some(sum), Some(value)) = (sum.as_mut(), raw.and_then(parse_number)) {
        *sum = sum.saturating_add(value.max(0.0).round() as u32);
    }
}

fn accumulate_f64(sum: &mut Option<f64>, raw: Option<&str>) {
    if let (Some(sum), Some(value)) = (sum.as_mut(), raw.and_then(parse_number)) {
        *sum += value;
    }
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

    const WEAPON_TABLE: &str = "Weapon,Shots,Hits,Damage Done,Damage Possible\nrifle,10,8,100.0,120.0\n";

    const VOLTAIC_NAME: &str = "1w4ts Voltaic - Challenge - 2026.10.13-09.05.10 Stats.csv";
    const VOLTAIC: &str =
        include_str!("../../test/fixtures/kovaak/1w4ts Voltaic - Challenge - 2026.10.13-09.05.10 Stats.csv");
    const VT_PASU_NAME: &str = "VT Pasu Intermediate S5 - Challenge - 2026.10.12-14.30.22 Stats.csv";
    const VT_PASU: &str =
        include_str!("../../test/fixtures/kovaak/VT Pasu Intermediate S5 - Challenge - 2026.10.12-14.30.22 Stats.csv");
    const SMOOTHBOT_NAME: &str = "Smoothbot Goated - Challenge - 2025.01.20-21.10.00 Stats.csv";
    const SMOOTHBOT: &str =
        include_str!("../../test/fixtures/kovaak/Smoothbot Goated - Challenge - 2025.01.20-21.10.00 Stats.csv");
    const PARTIAL_NAME: &str = "Partial Write - Challenge - 2026.10.14-10.00.00 Stats.csv";
    const PARTIAL: &str =
        include_str!("../../test/fixtures/kovaak/Partial Write - Challenge - 2026.10.14-10.00.00 Stats.csv");

    /// Escreve o conteúdo num diretório temporário único, com o nome original do arquivo
    /// (o parser usa o nome para cenário e data) e faz o parse.
    fn parse_fixture(tag: &str, file_name: &str, content: &str) -> Option<KovaakRun> {
        let dir = std::env::temp_dir().join(format!("att_kovaak_fixture_{}_{tag}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(file_name);
        std::fs::write(&path, content).unwrap();
        let run = parse_stats_file_with_fallback_dpi(&path, 800.0);
        let _ = std::fs::remove_dir_all(&dir);
        run
    }

    fn write_temp(file_name: &str, content: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(file_name);
        std::fs::write(&path, content).unwrap();
        path
    }

    fn cleanup(path: &std::path::Path) {
        let _ = std::fs::remove_file(path);
    }

    fn parse_path(path: &std::path::Path) -> Option<KovaakRun> {
        parse_stats_file_with_fallback_dpi(path, 800.0)
    }

    fn assert_close(actual: Option<f64>, expected: f64, tol: f64) {
        let value = actual.expect("campo deveria estar preenchido");
        assert!((value - expected).abs() <= tol, "{value} != {expected}");
    }

    #[test]
    fn parses_old_format_csv() {
        let content = format!(
            "Scenario,Score,Accuracy,Sens Scale,Horiz Sens,Vert Sens,FOV,Run Date\n1w2ts Pasu Perfected,1000,80,1.0,45,45,103,2026.10.18-19.30.22\n{WEAPON_TABLE}"
        );
        let path = write_temp("kovaak_old_format.csv", &content);
        let run = parse_path(&path).expect("deveria parsear");
        assert_eq!(run.scenario, "1w2ts Pasu Perfected");
        assert_eq!(run.score, 1000.0);
        assert_eq!(run.sens, 45.0);
        assert_eq!(run.fov, 103.0);
        assert_eq!(run.datetime, "2026-10-18T19:30:22");
        cleanup(&path);
    }

    #[test]
    fn parses_summary_section_format() {
        let content = format!(
            "{WEAPON_TABLE}Kills:,5\nScenario:,1w2ts Pasu Perfected\nScore:,1080\nSens Scale:,1.0\nHoriz Sens:,45\nFOV:,103\n"
        );
        let path = write_temp("kovaak_summary_format.csv", &content);
        let run = parse_path(&path).expect("deveria parsear");
        assert_eq!(run.scenario, "1w2ts Pasu Perfected");
        assert_eq!(run.score, 1080.0);
        assert_eq!(run.sens, 45.0);
        assert_eq!(run.fov, 103.0);
        assert_eq!(run.stats.kills, Some(5));
        cleanup(&path);
    }

    #[test]
    fn parses_real_filename_with_mode() {
        let content = format!(
            "Scenario,Score,Accuracy,Sens Scale,Horiz Sens,Vert Sens,FOV,Run Date\n1w2ts Pasu Perfected,1000,80,1.0,45,45,103,2026.10.18-19.30.22\n{WEAPON_TABLE}"
        );
        let path = write_temp("1w2ts Pasu Perfected - Challenge - 2026.10.18-19.30.22 Stats.csv", &content);
        let run = parse_path(&path).expect("deveria parsear");
        assert_eq!(run.scenario, "1w2ts Pasu Perfected");
        assert_eq!(run.datetime, "2026-10-18T19:30:22");
        assert_eq!(run.source_file, "1w2ts Pasu Perfected - Challenge - 2026.10.18-19.30.22 Stats.csv");
        cleanup(&path);
    }

    #[test]
    fn scenario_with_dashes_kept() {
        let content = format!(
            "Scenario,Score,Accuracy,Sens Scale,Horiz Sens,Vert Sens,FOV,Run Date\nVoxTargets Dodge - No Reload,1000,80,1.0,45,45,103,2026.10.18-19.30.22\n{WEAPON_TABLE}"
        );
        let path = write_temp("VoxTargets Dodge - No Reload - Challenge - 2026.10.18-19.30.22 Stats.csv", &content);
        let run = parse_path(&path).expect("deveria parsear");
        assert_eq!(run.scenario, "VoxTargets Dodge - No Reload");
        cleanup(&path);
    }

    #[test]
    fn rejects_non_kovaak_file() {
        let path = write_temp("data.csv", "a,b,c\n1,2,3\n");
        assert!(parse_path(&path).is_none());
        cleanup(&path);
    }

    #[test]
    fn prefers_filename_timestamp_over_csv() {
        let content = format!(
            "Scenario,Score,Accuracy,Sens Scale,Horiz Sens,Vert Sens,FOV,Run Date\nWALLHACK - VBRClick Easy,920,88,1.0,55,55,103,2026.10.20-09.15.00\n{WEAPON_TABLE}"
        );
        let path = write_temp("WALLHACK - VBRClick Easy - Challenge - 2026.10.20-09.15.00 Stats.csv", &content);
        let run = parse_path(&path).expect("deveria parsear");
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
    fn unknown_scale_is_not_guessed_as_valorant() {
        // Sem escala e fora de 5..=150: desconhecido, não Valorant.
        assert_eq!(convert_sens_to_cm(0.35, None, 800.0), 0.0);
        assert_eq!(convert_sens_to_cm(0.35, Some("Foo"), 800.0), 0.0);
        assert_eq!(convert_sens_to_cm(2.5, None, 800.0), 0.0);
        assert_eq!(convert_sens_to_cm(4.9, None, 800.0), 0.0);
        assert_eq!(convert_sens_to_cm(151.0, None, 800.0), 0.0);
        // Dentro de 5..=150 sem escala: já é cm/360.
        assert_eq!(convert_sens_to_cm(5.0, None, 800.0), 5.0);
        assert_eq!(convert_sens_to_cm(45.0, None, 800.0), 45.0);
        assert_eq!(convert_sens_to_cm(150.0, None, 800.0), 150.0);
    }

    #[test]
    fn parses_real_kovaak_valorant_format() {
        let content = format!(
            "{WEAPON_TABLE}Score:,120.0\nScenario:,1w2ts Pasu\nSens Scale:,Valorant\nHoriz Sens:,0.24013\nDPI:,800\nFOV:,103.0\n"
        );
        let path = write_temp("1w2ts Pasu - Challenge - 2026.07.28-19.24.07 Stats.csv", &content);
        let run = parse_path(&path).expect("deveria parsear");
        assert_eq!(run.sens, 68.0);
        cleanup(&path);
    }

    #[test]
    fn parses_with_custom_fallback_dpi() {
        // Arquivo sem linha de DPI
        let content = format!(
            "{WEAPON_TABLE}Score:,120.0\nScenario:,1w2ts Pasu\nSens Scale:,Valorant\nHoriz Sens:,0.24013\nFOV:,103.0\n"
        );
        let path = write_temp("1w2ts Pasu No DPI - Challenge - 2026.07.28-19.24.07 Stats.csv", &content);
        let run = parse_stats_file_with_fallback_dpi(&path, 1600.0).expect("deveria parsear");
        // Com 1600 DPI, sens cai pela metade (68 / 2 = 34.0)
        assert_eq!(run.sens, 34.0);
        cleanup(&path);
    }

    #[test]
    fn first_summary_occurrence_wins() {
        let content = format!("{WEAPON_TABLE}Score:,100\nScore:,200\nScenario:,Test\nSens Scale:,cm/360\nHoriz Sens:,40\n");
        let run = parse_fixture("first_wins", "Test - Challenge - 2026.10.20-09.15.00 Stats.csv", &content)
            .expect("deveria parsear");
        assert_eq!(run.score, 100.0);
    }

    #[test]
    fn parse_number_strips_units() {
        assert_eq!(parse_number("0.512s"), Some(0.512));
        assert_eq!(parse_number(" 120 "), Some(120.0));
        assert_eq!(parse_number("12%"), Some(12.0));
        assert_eq!(parse_number("Valorant"), None);
        assert_eq!(parse_number("1920x1080"), None);
    }

    #[test]
    fn fixture_voltaic_valorant_two_weapons() {
        let run = parse_fixture("voltaic", VOLTAIC_NAME, VOLTAIC).expect("deveria parsear");
        assert_eq!(run.game, "kovaak");
        assert_eq!(run.scenario, "1w4ts Voltaic");
        assert_eq!(run.score, 1043.0);
        assert_eq!(run.datetime, "2026-10-13T09:05:10");
        assert_close(Some(run.sens), 46.7, 0.1);
        assert_eq!(run.fov, 103.0);
        assert_eq!(run.stats.shots, Some(150));
        assert_eq!(run.stats.hits, Some(105));
        assert_close(run.stats.accuracy, 0.7, 1e-9);
        assert_eq!(run.stats.kills, Some(52));
        assert_close(run.stats.avg_ttk, 1.104, 1e-9);
        assert_close(run.stats.damage_done, 1050.0, 1e-9);
        assert_close(run.stats.damage_possible, 1500.0, 1e-9);
        assert_close(run.stats.fight_time, 60.0, 1e-9);
        assert_close(run.stats.pause_count, 0.0, 1e-9);
        assert_close(run.stats.pause_duration, 0.0, 1e-9);
        assert_close(run.stats.avg_fps, 239.7, 1e-9);
        assert_close(run.stats.dpi, 800.0, 1e-9);
        assert_eq!(run.stats.game_version.as_deref(), Some("3.7.2.2025-03-01-1234"));
        assert_eq!(run.stats.hash.as_deref(), Some("ffee0011"));
    }

    #[test]
    fn fixture_vt_pasu_cm360_single_weapon() {
        let run = parse_fixture("vt_pasu", VT_PASU_NAME, VT_PASU).expect("deveria parsear");
        assert_eq!(run.game, "kovaak");
        assert_eq!(run.scenario, "VT Pasu Intermediate S5");
        assert_eq!(run.score, 812.5);
        assert_eq!(run.datetime, "2026-10-12T14:30:22");
        assert_eq!(run.sens, 45.0);
        assert_eq!(run.fov, 103.0);
        assert_eq!(run.stats.shots, Some(85));
        assert_eq!(run.stats.hits, Some(70));
        assert_close(run.stats.accuracy, 70.0 / 85.0, 1e-9);
        assert_eq!(run.stats.kills, Some(70));
        assert_close(run.stats.avg_ttk, 0.812, 1e-9);
        assert_close(run.stats.damage_done, 70.0, 1e-9);
        assert_close(run.stats.damage_possible, 85.0, 1e-9);
        assert_close(run.stats.fight_time, 60.012, 1e-9);
        assert_close(run.stats.pause_count, 1.0, 1e-9);
        assert_close(run.stats.pause_duration, 2.5, 1e-9);
        assert_close(run.stats.avg_fps, 240.1, 1e-9);
        assert_eq!(run.stats.hash.as_deref(), Some("a1b2c3d4e5f6"));
        assert_eq!(run.stats.game_version.as_deref(), Some("3.7.2.2025-03-01-1234"));
    }

    #[test]
    fn fixture_smoothbot_old_version_without_optional_fields() {
        let run = parse_fixture("smoothbot", SMOOTHBOT_NAME, SMOOTHBOT).expect("deveria parsear");
        assert_eq!(run.scenario, "Smoothbot Goated");
        assert_eq!(run.score, 2950.0);
        assert_eq!(run.datetime, "2025-01-20T21:10:00");
        assert_eq!(run.sens, 38.0);
        assert_eq!(run.stats.shots, Some(3600));
        assert_eq!(run.stats.hits, Some(2950));
        assert_close(run.stats.accuracy, 2950.0 / 3600.0, 1e-9);
        assert_eq!(run.stats.kills, Some(0));
        assert_close(run.stats.avg_ttk, 0.0, 1e-9);
        assert_eq!(run.stats.pause_count, None);
        assert_eq!(run.stats.avg_fps, None);
        assert_eq!(run.stats.hash, None);
        assert_eq!(run.stats.game_version.as_deref(), Some("3.4.1.2024-06-10-0001"));
    }

    #[test]
    fn fixture_partial_write_is_incomplete() {
        assert!(parse_fixture("partial", PARTIAL_NAME, PARTIAL).is_none());
    }
}
