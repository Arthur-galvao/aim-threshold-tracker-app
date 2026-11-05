//! Planejador de sorteio do randomizer v2 (Plano 05, T5.2). Lógica pura: sem IO, sem RNG.
//!
//! Ordem de decisão de `plan_roll`: gap de sessão (reset) -> medição (Off) -> categoria
//! desabilitada (Base) -> reativação (Base) -> âncora (Anchor) -> sorteio (Random) com a faixa
//! do modo.

use serde::{Deserialize, Serialize};

use crate::model::{RandomizerSettings, ScenarioMeta};
use crate::sampler::{grid_bounds, lattice_cm, lattice_index, MIN_CM};

/// Fração do spread usada para deslocar o centro no modo `directed`.
pub const DIRECTED_SHIFT: f64 = 0.6;
/// Spread mínimo do modo `explore`.
pub const EXPLORE_MIN_SPREAD: f64 = 0.40;

#[derive(Default, Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct RollSessionState {
    /// Epoch ms do último planejamento (fim da última run).
    pub last_run_at: Option<i64>,
    pub runs_in_session: u32,
    pub randomized_since_anchor: u32,
    /// 0 = metade rápida, 1 = metade lenta (modo `alternating`).
    pub alt_phase: u8,
    pub alt_count: u32,
    /// Estado anterior ao último `plan_roll`, para refazer o plano sem consumir contadores
    /// (reroll por troca de cenário / sorteio manual). Não persistido.
    #[serde(skip)]
    pub before_last: Option<Box<RollSessionState>>,
}

impl RollSessionState {
    /// Desfaz o efeito do último `plan_roll` nos contadores (no-op se não houver).
    pub fn rewind(&mut self) {
        if let Some(prev) = self.before_last.take() {
            *self = *prev;
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Base,
    Anchor,
    Random,
    Off,
}

impl Role {
    pub fn as_str(self) -> &'static str {
        match self {
            Role::Base => "base",
            Role::Anchor => "anchor",
            Role::Random => "random",
            Role::Off => "off",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct RollPlan {
    pub role: Role,
    pub center_cm: f64,
    pub lo_cm: f64,
    pub hi_cm: f64,
    pub bag_key: String,
}

/// Direção: -1 rápida, 0 neutra, +1 lenta.
pub fn default_direction(category: &str, subcategory: &str) -> i8 {
    let cat = category.trim().to_lowercase();
    let sub = subcategory.trim().to_lowercase();
    match (cat.as_str(), sub.as_str()) {
        ("flick tech", "speed") => 1,
        ("flick tech", "micro") => -1,
        ("click timing", "precision") => -1,
        ("control tracking", "arm") => 1,
        ("control tracking", "wrist") => -1,
        ("control tracking", "fingertip") => -1,
        ("reactive tracking", "speed") => 1,
        _ => 0,
    }
}

fn parse_direction(v: &str) -> Option<i8> {
    match v.trim().to_lowercase().as_str() {
        "fast" => Some(-1),
        "slow" => Some(1),
        "neutral" => Some(0),
        _ => None,
    }
}

/// Direção efetiva da subcategoria: override do usuário ("Cat/Sub") ou tabela padrão.
pub fn direction_for(s: &RandomizerSettings, category: &str, subcategory: &str) -> i8 {
    let key = format!("{}/{}", category.trim(), subcategory.trim());
    let found = s
        .direction_overrides
        .get(&key)
        .or_else(|| {
            s.direction_overrides
                .iter()
                .find(|(k, _)| k.trim().eq_ignore_ascii_case(&key))
                .map(|(_, v)| v)
        })
        .and_then(|v| parse_direction(v));
    found.unwrap_or_else(|| default_direction(category, subcategory))
}

pub fn category_enabled(s: &RandomizerSettings, category: &str) -> bool {
    s.category_enabled.get(category).copied().unwrap_or(true)
}

fn spread(s: &RandomizerSettings) -> f64 {
    (s.spread_percent / 100.0).clamp(0.01, 0.90)
}

/// Centro efetivo do cenário (cm/360): `meta.center_cm` ou a sens base.
pub fn effective_center(s: &RandomizerSettings, meta: &ScenarioMeta) -> f64 {
    let base = if s.base_sens_cm > 0.0 { s.base_sens_cm } else { 40.0 };
    let c = if meta.center_cm > 0.0 { meta.center_cm } else { base };
    c.max(MIN_CM)
}

/// Faixa contínua (lo, hi) em cm/360 do sorteio. `phase`: 0 rápida, 1 lenta (só `alternating`).
/// `None` em `phase` = faixa completa (usado no preview).
pub fn random_range(
    s: &RandomizerSettings,
    meta: &ScenarioMeta,
    center: f64,
    phase: Option<u8>,
) -> (f64, f64) {
    // Comportamento legado: ranges manuais (cm360/multiplicador) quando o auto-centro estava
    // desligado em settings antigos e o modo é o "center" original.
    if !s.auto_scenario_sens && s.mode == "center" {
        return crate::randomizer::resolve_range_cm(s, None);
    }
    let mut p = spread(s);
    if s.mode == "explore" {
        p = p.max(EXPLORE_MIN_SPREAD);
    }
    let (lo, hi) = match s.mode.as_str() {
        "directed" => {
            let dir = direction_for(s, &meta.category, &meta.subcategory) as f64;
            let c2 = center * (1.0 + dir * DIRECTED_SHIFT * p);
            (c2 * (1.0 - p), c2 * (1.0 + p))
        }
        "alternating" => match phase {
            Some(0) => (center * (1.0 - p), center),
            Some(_) => (center, center * (1.0 + p)),
            None => (center * (1.0 - p), center * (1.0 + p)),
        },
        _ => (center * (1.0 - p), center * (1.0 + p)),
    };
    (lo.max(MIN_CM), hi.max(MIN_CM))
}

fn point_plan(role: Role, center: f64, mode: &str) -> RollPlan {
    let k = lattice_index(center);
    let cm = lattice_cm(k);
    RollPlan { role, center_cm: center, lo_cm: cm, hi_cm: cm, bag_key: format!("{k}:{k}:{mode}:0") }
}

/// Planeja a sens da PRÓXIMA run. Atualiza os contadores de `sess`.
pub fn plan_roll(
    s: &RandomizerSettings,
    sess: &mut RollSessionState,
    meta: &ScenarioMeta,
    now_ms: i64,
    gap_min: u32,
    measuring: bool,
) -> RollPlan {
    let snapshot = RollSessionState { before_last: None, ..sess.clone() };
    sess.before_last = Some(Box::new(snapshot));

    let center = effective_center(s, meta);

    // Nova sessão: gap > session_gap_minutes desde o último plano.
    if let Some(last) = sess.last_run_at {
        let gap_ms = i64::from(gap_min) * 60_000;
        if now_ms.saturating_sub(last) > gap_ms {
            let before = sess.before_last.take();
            *sess = RollSessionState { before_last: before, ..RollSessionState::default() };
        }
    }
    sess.last_run_at = Some(now_ms);

    if measuring {
        return point_plan(Role::Off, base_center(s), &s.mode);
    }
    if !category_enabled(s, &meta.category) {
        return point_plan(Role::Base, center, &s.mode);
    }
    if sess.runs_in_session < s.reactivation_runs {
        sess.runs_in_session += 1;
        return point_plan(Role::Base, center, &s.mode);
    }
    if s.anchor_every > 0 && sess.randomized_since_anchor >= s.anchor_every {
        sess.randomized_since_anchor = 0;
        sess.runs_in_session += 1;
        return point_plan(Role::Anchor, center, &s.mode);
    }

    let alternating = s.mode == "alternating";
    let phase = if alternating { sess.alt_phase.min(1) } else { 0 };
    let (lo_cm, hi_cm) = random_range(s, meta, center, alternating.then_some(phase));
    let (lo_k, hi_k) = grid_bounds(lo_cm, hi_cm);
    let bag_key = format!("{lo_k}:{hi_k}:{}:{phase}", s.mode);

    sess.runs_in_session += 1;
    sess.randomized_since_anchor += 1;
    if alternating {
        sess.alt_count += 1;
        if sess.alt_count >= s.alternating_block.max(1) {
            sess.alt_phase = 1 - phase;
            sess.alt_count = 0;
        }
    }
    RollPlan { role: Role::Random, center_cm: center, lo_cm, hi_cm, bag_key }
}

/// Cue de grupo muscular para a sens ativa `x` e o centro `c`.
pub fn muscle_cue(x: f64, c: f64) -> &'static str {
    if x < 0.92 * c {
        "fast"
    } else if x > 1.08 * c {
        "slow"
    } else {
        "base"
    }
}

/// Sens base (usada com o randomizer pausado em passos de medição).
fn base_center(s: &RandomizerSettings) -> f64 {
    if s.base_sens_cm > 0.0 { s.base_sens_cm.max(MIN_CM) } else { 40.0 }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MIN: i64 = 60_000;

    fn settings() -> RandomizerSettings {
        RandomizerSettings {
            enabled: true,
            base_sens_cm: 40.0,
            spread_percent: 25.0,
            auto_scenario_sens: true,
            reactivation_runs: 2,
            anchor_every: 5,
            alternating_block: 3,
            ..RandomizerSettings::default()
        }
    }

    fn meta(center: f64, cat: &str, sub: &str) -> ScenarioMeta {
        ScenarioMeta { center_cm: center, category: cat.into(), subcategory: sub.into() }
    }

    fn roll(s: &RandomizerSettings, sess: &mut RollSessionState, m: &ScenarioMeta, t: i64) -> RollPlan {
        plan_roll(s, sess, m, t, 45, false)
    }

    #[test]
    fn reactivation_first_two_are_base() {
        let s = settings();
        let m = meta(40.0, "Click Timing", "Precision");
        let mut sess = RollSessionState::default();
        let roles: Vec<Role> = (0..4).map(|i| roll(&s, &mut sess, &m, i * MIN).role).collect();
        assert_eq!(roles, vec![Role::Base, Role::Base, Role::Random, Role::Random]);
    }

    #[test]
    fn base_plan_uses_nearest_lattice_point() {
        let s = settings();
        let m = meta(41.0, "Click Timing", "Precision");
        let mut sess = RollSessionState::default();
        let p = roll(&s, &mut sess, &m, 0);
        let expected = lattice_cm(lattice_index(41.0));
        assert_eq!(p.lo_cm, expected);
        assert_eq!(p.hi_cm, expected);
        assert_eq!(p.center_cm, 41.0);
    }

    #[test]
    fn anchor_after_every_n_randomized() {
        let s = settings();
        let m = meta(40.0, "Click Timing", "Precision");
        let mut sess = RollSessionState::default();
        let roles: Vec<Role> = (0..9).map(|i| roll(&s, &mut sess, &m, i * MIN).role).collect();
        // 2 base, 5 random, 1 anchor (a 6a pos-reativacao), depois volta a randomizar
        assert_eq!(
            roles,
            vec![
                Role::Base, Role::Base,
                Role::Random, Role::Random, Role::Random, Role::Random, Role::Random,
                Role::Anchor, Role::Random
            ]
        );
    }

    #[test]
    fn anchor_every_zero_disables_anchors() {
        let s = RandomizerSettings { anchor_every: 0, ..settings() };
        let m = meta(40.0, "", "");
        let mut sess = RollSessionState::default();
        for i in 0..30 {
            let r = roll(&s, &mut sess, &m, i * MIN).role;
            assert_ne!(r, Role::Anchor);
        }
    }

    #[test]
    fn alternating_switches_half_every_block() {
        let s = RandomizerSettings { mode: "alternating".into(), reactivation_runs: 0, anchor_every: 0, ..settings() };
        let m = meta(40.0, "", "");
        let mut sess = RollSessionState::default();
        let plans: Vec<RollPlan> = (0..7).map(|i| roll(&s, &mut sess, &m, i * MIN)).collect();
        for (i, p) in plans.iter().enumerate() {
            let slow = (i / 3) % 2 == 1;
            if slow {
                assert_eq!(p.lo_cm, 40.0, "plan {i}");
                assert!((p.hi_cm - 50.0).abs() < 1e-9);
                assert!(p.bag_key.ends_with(":alternating:1"), "{}", p.bag_key);
            } else {
                assert!((p.lo_cm - 30.0).abs() < 1e-9, "plan {i}");
                assert_eq!(p.hi_cm, 40.0);
                assert!(p.bag_key.ends_with(":alternating:0"), "{}", p.bag_key);
            }
        }
        assert_ne!(plans[0].bag_key, plans[3].bag_key);
        assert_eq!(plans[0].bag_key, plans[6].bag_key);
    }

    #[test]
    fn directed_slow_shifts_center_by_06p() {
        let s = RandomizerSettings { mode: "directed".into(), reactivation_runs: 0, anchor_every: 0, ..settings() };
        let m = meta(40.0, "Control Tracking", "Arm"); // lenta por padrao
        let mut sess = RollSessionState::default();
        let p = roll(&s, &mut sess, &m, 0);
        let c2 = 40.0 * (1.0 + 0.6 * 0.25);
        assert!((p.lo_cm - c2 * 0.75).abs() < 1e-9, "lo {}", p.lo_cm);
        assert!((p.hi_cm - c2 * 1.25).abs() < 1e-9);
        assert_eq!(p.center_cm, 40.0);
    }

    #[test]
    fn directed_fast_neutral_and_override() {
        let base = RandomizerSettings { mode: "directed".into(), reactivation_runs: 0, anchor_every: 0, ..settings() };
        let fast = meta(40.0, "Control Tracking", "Wrist");
        let p = roll(&base, &mut RollSessionState::default(), &fast, 0);
        assert!((p.lo_cm - 40.0 * (1.0 - 0.15) * 0.75).abs() < 1e-9);

        let neutral = meta(40.0, "Click Timing", "Reading");
        let p = roll(&base, &mut RollSessionState::default(), &neutral, 0);
        assert!((p.lo_cm - 30.0).abs() < 1e-9 && (p.hi_cm - 50.0).abs() < 1e-9);

        let mut ov = base.clone();
        ov.direction_overrides.insert("Click Timing/Reading".into(), "slow".into());
        let p = roll(&ov, &mut RollSessionState::default(), &neutral, 0);
        assert!((p.hi_cm - 40.0 * 1.15 * 1.25).abs() < 1e-9);

        ov.direction_overrides.insert("Control Tracking/Wrist".into(), "neutral".into());
        let p = roll(&ov, &mut RollSessionState::default(), &fast, 0);
        assert!((p.lo_cm - 30.0).abs() < 1e-9);
    }

    #[test]
    fn explore_forces_min_spread() {
        let s = RandomizerSettings { mode: "explore".into(), spread_percent: 10.0, reactivation_runs: 0, anchor_every: 0, ..settings() };
        let p = roll(&s, &mut RollSessionState::default(), &meta(50.0, "", ""), 0);
        assert!((p.lo_cm - 30.0).abs() < 1e-9 && (p.hi_cm - 70.0).abs() < 1e-9);
        let wide = RandomizerSettings { spread_percent: 60.0, ..s };
        let p = roll(&wide, &mut RollSessionState::default(), &meta(50.0, "", ""), 0);
        assert!((p.lo_cm - 20.0).abs() < 1e-9);
    }

    #[test]
    fn gap_resets_session() {
        let s = settings();
        let m = meta(40.0, "", "");
        let mut sess = RollSessionState::default();
        for i in 0..4 {
            roll(&s, &mut sess, &m, i * MIN);
        }
        assert!(sess.runs_in_session >= 4);
        // 60 min depois: nova sessao -> reativacao de novo
        let p = roll(&s, &mut sess, &m, 3 * MIN + 60 * MIN);
        assert_eq!(p.role, Role::Base);
        assert_eq!(sess.runs_in_session, 1);
        assert_eq!(sess.randomized_since_anchor, 0);
        // dentro do gap nao reseta
        let mut sess2 = RollSessionState::default();
        for i in 0..4 {
            roll(&s, &mut sess2, &m, i * MIN);
        }
        let p = roll(&s, &mut sess2, &m, 3 * MIN + 45 * MIN);
        assert_ne!(p.role, Role::Base);
    }

    #[test]
    fn disabled_category_is_base() {
        let mut s = RandomizerSettings { reactivation_runs: 0, ..settings() };
        s.category_enabled.insert("Flick Tech".into(), false);
        let mut sess = RollSessionState::default();
        let p = roll(&s, &mut sess, &meta(40.0, "Flick Tech", "Speed"), 0);
        assert_eq!(p.role, Role::Base);
        assert_eq!(sess.randomized_since_anchor, 0);
        let p = roll(&s, &mut sess, &meta(40.0, "Click Timing", "Precision"), MIN);
        assert_eq!(p.role, Role::Random);
    }

    #[test]
    fn measuring_is_off_with_base_sens() {
        let s = settings();
        let mut sess = RollSessionState::default();
        let p = plan_roll(&s, &mut sess, &meta(55.0, "", ""), 0, 45, true);
        assert_eq!(p.role, Role::Off);
        assert_eq!(p.lo_cm, lattice_cm(lattice_index(40.0)));
        assert_eq!(sess.runs_in_session, 0);
    }

    #[test]
    fn no_meta_falls_back_to_base_and_bag_key_format() {
        let s = RandomizerSettings { reactivation_runs: 0, anchor_every: 0, ..settings() };
        let p = roll(&s, &mut RollSessionState::default(), &ScenarioMeta::default(), 0);
        assert_eq!(p.center_cm, 40.0);
        let (lo, hi) = grid_bounds(30.0, 50.0);
        assert_eq!(p.bag_key, format!("{lo}:{hi}:center:0"));
    }

    #[test]
    fn muscle_cue_thresholds() {
        assert_eq!(muscle_cue(36.0, 40.0), "fast");
        assert_eq!(muscle_cue(36.9, 40.0), "base");
        assert_eq!(muscle_cue(43.1, 40.0), "base");
        assert_eq!(muscle_cue(43.4, 40.0), "slow");
    }

    #[test]
    fn rewind_restores_counters() {
        let s = settings();
        let m = meta(40.0, "", "");
        let mut sess = RollSessionState::default();
        for i in 0..3 {
            roll(&s, &mut sess, &m, i * MIN);
        }
        let before = sess.clone();
        roll(&s, &mut sess, &m, 4 * MIN);
        sess.rewind();
        assert_eq!(sess.runs_in_session, before.runs_in_session);
        assert_eq!(sess.randomized_since_anchor, before.randomized_since_anchor);
        assert_eq!(sess.last_run_at, before.last_run_at);
    }

    #[test]
    fn session_state_roundtrips_json() {
        let mut sess = RollSessionState { last_run_at: Some(5), runs_in_session: 3, ..Default::default() };
        sess.before_last = Some(Box::new(RollSessionState::default()));
        let json = serde_json::to_string(&sess).unwrap();
        let back: RollSessionState = serde_json::from_str(&json).unwrap();
        assert_eq!(back.runs_in_session, 3);
        assert!(back.before_last.is_none());
    }
}
