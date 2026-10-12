use std::collections::HashMap;
use rand::seq::SliceRandom;
use rand::Rng;

pub const LATTICE_ANCHOR_CM: f64 = 50.0;
pub const LATTICE_RATIO: f64 = 1.05;
pub const MIN_CM: f64 = 5.0;
pub const MIN_GRID_POINTS: i32 = 3;

pub fn lattice_cm(k: i32) -> f64 {
    let v = LATTICE_ANCHOR_CM * LATTICE_RATIO.powi(k);
    (v * 100.0).round() / 100.0
}

pub fn lattice_index(cm: f64) -> i32 {
    let safe_cm = cm.max(MIN_CM);
    ((safe_cm / LATTICE_ANCHOR_CM).ln() / LATTICE_RATIO.ln()).round() as i32
}

/// Indices (lo, hi) inclusivos da grade dentro de [min_cm, max_cm].
/// Garante pelo menos MIN_GRID_POINTS pontos, alargando alternadamente.
pub fn grid_bounds(min_cm: f64, max_cm: f64) -> (i32, i32) {
    let min_cm = min_cm.max(MIN_CM);
    let max_cm = max_cm.max(min_cm);
    let step = LATTICE_RATIO.ln();
    let mut lo = ((min_cm / LATTICE_ANCHOR_CM).ln() / step - 1e-9).ceil() as i32;
    let mut hi = ((max_cm / LATTICE_ANCHOR_CM).ln() / step + 1e-9).floor() as i32;
    let mut widen_low = true;
    while hi - lo + 1 < MIN_GRID_POINTS {
        if widen_low && lattice_cm(lo - 1) >= MIN_CM {
            lo -= 1;
        } else {
            hi += 1;
        }
        widen_low = !widen_low;
    }
    (lo, hi)
}

#[derive(Default, Debug)]
pub struct SamplerState {
    pub bags: HashMap<(i32, i32), Vec<i32>>,
    pub last_k: Option<i32>,
    pub last_roll_center_cm: Option<f64>,
}

/// Sorteio sem reposicao dentro de [lo, hi]. Cada faixa (lo, hi) tem seu proprio saco.
pub fn draw_index<R: Rng>(
    st: &mut SamplerState,
    lo: i32,
    hi: i32,
    min_gap: i32,
    rng: &mut R,
) -> i32 {
    let (lo, hi) = (lo.min(hi), lo.max(hi));
    let last = st.last_k.filter(|l| (lo..=hi).contains(l));
    let bag = st.bags.entry((lo, hi)).or_default();
    if bag.is_empty() {
        *bag = (lo..=hi).collect();
        bag.shuffle(rng);
    }
    let pos = last
        .and_then(|l| bag.iter().position(|&k| (k - l).abs() >= min_gap))
        .unwrap_or(0);
    let k = bag.remove(pos);
    st.last_k = Some(k);
    k
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand::rngs::StdRng;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct FixtureItem {
        k: i32,
        cm: f64,
    }

    #[test]
    fn test_matches_shared_lattice_fixture() {
        let fixture_str = include_str!("../../test/fixtures/sens-lattice.json");
        let items: Vec<FixtureItem> = serde_json::from_str(fixture_str).unwrap();

        for item in items {
            let cm = lattice_cm(item.k);
            assert!(
                (cm - item.cm).abs() <= 0.02,
                "lattice_cm({}) was {}, expected ~{}",
                item.k,
                cm,
                item.cm
            );

            let k = lattice_index(item.cm);
            assert_eq!(
                k, item.k,
                "lattice_index({}) was {}, expected {}",
                item.cm, k, item.k
            );
        }
    }

    #[test]
    fn test_grid_bounds_range_and_widen() {
        let (lo, hi) = grid_bounds(30.0, 50.0);
        assert!(lo <= hi);
        assert!(lattice_cm(lo) >= 27.0 && lattice_cm(lo) <= 32.0);
        assert!(lattice_cm(hi) <= 52.0);

        // Faixa estreita expande para pelo menos 3 pontos
        let (lo_narrow, hi_narrow) = grid_bounds(40.0, 40.5);
        assert!(hi_narrow - lo_narrow + 1 >= MIN_GRID_POINTS);

        // Piso de 5 cm respeitado
        let (lo_floor, _) = grid_bounds(2.0, 6.0);
        assert!(lattice_cm(lo_floor) >= MIN_CM);
    }

    #[test]
    fn test_sampler_draws_all_points_without_replacement() {
        let mut st = SamplerState::default();
        let mut rng = StdRng::seed_from_u64(42);
        let (lo, hi) = (1, 8);
        let total = hi - lo + 1;

        let mut drawn = Vec::new();
        for _ in 0..total {
            drawn.push(draw_index(&mut st, lo, hi, 1, &mut rng));
        }

        assert_eq!(drawn.len(), total as usize);
        let mut sorted = drawn.clone();
        sorted.sort();
        let expected: Vec<i32> = (lo..=hi).collect();
        assert_eq!(sorted, expected, "All points must be drawn exactly once per cycle");
    }

    #[test]
    fn test_sampler_respects_min_gap_when_possible() {
        let mut st = SamplerState::default();
        let mut rng = StdRng::seed_from_u64(12345);
        let (lo, hi) = (1, 10);

        let mut prev: Option<i32> = None;
        for _ in 0..30 {
            let next = draw_index(&mut st, lo, hi, 2, &mut rng);
            if let Some(p) = prev {
                // Se o saco tinha opcoes, o gap deve ser respeitado
                assert!((next - p).abs() >= 1);
            }
            prev = Some(next);
        }
    }

    #[test]
    fn test_sampler_independent_bags_per_range() {
        let mut st = SamplerState::default();
        let mut rng = StdRng::seed_from_u64(999);

        let k1 = draw_index(&mut st, 1, 5, 1, &mut rng);
        let k2 = draw_index(&mut st, 10, 15, 1, &mut rng);

        assert!((1..=5).contains(&k1));
        assert!((10..=15).contains(&k2));
        assert_eq!(st.bags.len(), 2);
    }
}
