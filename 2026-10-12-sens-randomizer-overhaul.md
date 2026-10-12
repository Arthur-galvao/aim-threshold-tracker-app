# Sens Randomizer Overhaul - Plano de Implementacao

> **Para agentes:** executar task a task, na ordem da secao "Ordem e dependencias". Passos usam checkbox (`- [ ]`). Rodar `npm test` e `cargo test` ao fim de cada task.

**Goal:** Trocar o sorteio continuo por uma grade discreta em escala log com sorteio sem reposicao, tornar a analise estatisticamente valida para esse tipo de dado, centrar o range no cenario que vai rodar (playlist mista e cenario unico), e corrigir os bugs de atribuicao de run, de restauracao do RawAccel e de front encontrados na auditoria (itens 1 a 26).

**Decisoes ja confirmadas:**
- Sorteio em grade discreta log, sem reposicao (saco embaralhado). Nao adaptativo.
- Uso real: playlist com cenarios mistos E um cenario por vez.
- Escopo: todos os 26 itens (25 da auditoria + o item 26 descoberto ao escrever o plano).

**Tech Stack:** Rust (Tauri 2, `rand` 0.8), React 19, TypeScript, Chart.js, Node Test Runner, Cargo.

## Constraints globais

- Sem emojis em codigo, comentarios, UI, logs e docs.
- Sens exibida com 1 casa quando nao inteira (67.5 cm) e sem casas quando inteira (50 cm).
- Operacoes destrutivas (sobrescrever `settings.json` do RawAccel, apagar dados) exigem backup antes.
- Arquivos de `src/lib/*.ts` testados pelo Node Test Runner usam imports relativos com extensao `.ts` (como `sens-analytics.ts` ja faz). O alias `@/` nao funciona nos testes.
- O script `npm test` em `package.json` lista os arquivos de teste explicitamente. Todo teste novo precisa entrar nessa lista.
- `cargo test` e `npm test` verdes ao fim de cada task.

## Mudancas de comportamento que o usuario vai perceber

1. O spread passa a ser multiplicativo: `+-25%` vira `centro/1.25` ate `centro*1.25` (antes: `centro*0.75` ate `centro*1.25`). Para centro 40: 32 a 50 cm em vez de 30 a 50. Atualizar o texto de `randomizer.spreadPercentDesc` nos dois idiomas.
2. Toda sens sorteada pertence a uma grade global (ancora 50 cm, razao 1.05). Valores como 52.5, 55.1, 57.9 cm. Dados antigos continuam validos: sao agrupados no ponto da grade mais proximo.
3. Toast de "sens atualizada" so aparece em acao manual (rolar agora, ligar/desligar, recalcular). Rolagem automatica ao fim da run nao gera toast (o KPI de sens ativa ja mostra).
4. Em dados sem variacao de sens a analise fica plana e diz "insuficiente". Isso e correto, nao ha informacao.

## Mapa dos itens da auditoria para tasks

| Itens | Task |
|---|---|
| 1, 11, 12 | T1, T3 |
| 2, 7, 17, 18, 21 | T2, T9 |
| 3 | T5 |
| 4, 24 | T0, T6 |
| 5, 26 | T4, T7 |
| 6, 8, 9, 10 | T8, T9 |
| 13 | T4 |
| 14 | T10 |
| 15, 16 | T11 |
| 19 | T12 |
| 20 | T13 |
| 22 | T14 |
| 23 | T15 |
| 25 | T16 (e testes dentro de cada task) |

**Nota sobre o item 14:** como o sorteio nao e adaptativo, o "aprender" fica assim: no modo auto o centro por cenario ja segue o pico estimado (T7 + T9), com limite de deslocamento por atualizacao para evitar oscilacao; no modo manual aparece uma sugestao de recentralizacao com botao (T10).

## Ordem e dependencias

```
T0 (verificacao manual)  ->  T6
T1 -> T3 -> T4 -> T5 -> T7
T1 -> T2 -> T8 -> T9 -> T10
T6 independe de T1 a T5 (pode rodar em paralelo, mas antes de T5 ser mergeado em main)
T11 antes de T12, T13, T14
T15 por ultimo entre as de front
T16 fecha
```

---

## T0: Verificar se `Output DPI` e `scale` compoe no RawAccel (item 24)

Hoje `update_and_apply_scale` grava `Output DPI = scale * dpi` e `scale = scale` no mesmo profile. Se os dois multiplicam, a sens real seria `scale^2`. Nao foi verificado; resolver antes de mexer em T6.

- [ ] **Passo 1:** Com a GUI do RawAccel fechada, em `settings.json` deixar `Output DPI = DPI` e `scale = 1.25`. Rodar `writer.exe settings.json`. Medir o cm/360 efetivo (regua + giro de 360 em jogo com sens conhecida). Esperado se so um dos dois vale: 1.25x.
- [ ] **Passo 2:** Repetir com `Output DPI = DPI * 1.25` e `scale = 1.0`. Repetir com os dois (como o app faz hoje).
- [ ] **Passo 3:** Registrar o resultado neste arquivo e decidir:
  - Os dois juntos dao 1.25x: manter como esta, documentar em comentario no Rust por que escreve os dois.
  - Os dois juntos dao 1.5625x: escrever so um. Preferir `scale` (nao muda a normalizacao de DPI do usuario), e parar de tocar em `Output DPI`. Ajustar `output_dpi` e o teste `test_output_dpi_calculation`.

---

## T1: Grade log global (Rust + TS com fixture compartilhada)

**Files:**
- Create: `src-tauri/src/sampler.rs`
- Create: `src/lib/sens-lattice.ts`
- Create: `test/fixtures/sens-lattice.json`
- Create: `test/sens-lattice.test.ts`
- Modify: `src-tauri/src/lib.rs` (`mod sampler;`), `package.json` (script `test`)

**Interfaces:** `lattice_cm(k)`, `lattice_index(cm)`, `grid_bounds(min_cm, max_cm)` (Rust); `latticeCm(k)`, `latticeIndex(cm)` (TS).

- [ ] **Passo 1: Constantes e funcoes em Rust**

```rust
pub const LATTICE_ANCHOR_CM: f64 = 50.0;
pub const LATTICE_RATIO: f64 = 1.05;
pub const MIN_CM: f64 = 5.0;
pub const MIN_GRID_POINTS: i32 = 3;

pub fn lattice_cm(k: i32) -> f64 {
    let v = LATTICE_ANCHOR_CM * LATTICE_RATIO.powi(k);
    (v * 100.0).round() / 100.0
}

pub fn lattice_index(cm: f64) -> i32 {
    ((cm / LATTICE_ANCHOR_CM).ln() / LATTICE_RATIO.ln()).round() as i32
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
        if widen_low && lattice_cm(lo - 1) >= MIN_CM { lo -= 1; } else { hi += 1; }
        widen_low = !widen_low;
    }
    (lo, hi)
}
```

- [ ] **Passo 2: Espelho em TS** (`src/lib/sens-lattice.ts`): mesmas constantes, `latticeCm(k) = Math.round(50 * 1.05 ** k * 100) / 100`, `latticeIndex(cm) = Math.round(Math.log(cm / 50) / Math.log(1.05))`.
- [ ] **Passo 3: Fixture compartilhada** `test/fixtures/sens-lattice.json` com ~20 pares `{ "k": -12, "cm": 27.84 }` etc., incluindo bordas (k = -20, 0, 1, 20) e valores legados fora da grade (`{ "cm": 33.37, "k": -8 }`). Os dois lados testam: `latticeIndex(cm) == k` e `|latticeCm(k) - cm| <= 0.01`. Rust le o JSON com `include_str!` + `serde_json`.
- [ ] **Passo 4: Testes Rust:** `grid_bounds(30.0, 50.0)` retorna pontos dentro do intervalo; range mais estreito que um passo (`grid_bounds(40.0, 40.5)`) devolve 3 pontos; piso de 5 cm respeitado.
- [ ] **Passo 5:** Adicionar `test/sens-lattice.test.ts` ao script `test`.

---

## T2: Construtor unico de pontos de run + baseline robusto (itens 2, 7, 17, 18, 21)

Hoje a normalizacao esta copiada em `SensRandomizerView`, `computePlaylistSensStats`, `getScenarioIdealSens` e `CategorySensCard`, e dois deles nem normalizam. `Session.pb` e na verdade o score de cada run (nome historico); nao renomear no disco, so documentar.

**Files:**
- Create: `src/lib/run-points.ts`, `test/run-points.test.ts`
- Modify: `src/lib/sens-analytics.ts` (`valorantToCm360` passa a exigir `dpi`)

**Interface:**

```ts
export interface RunPoint {
  taskId: string;
  sessionId: string;
  scenario: string;
  date: string;
  k: number;            // indice da grade (latticeIndex)
  sens: number;         // cm/360
  score: number;        // score bruto da run (Session.pb)
  rel: number;          // desempenho relativo ao baseline do cenario, 100 = tipico
  relReliable: boolean; // false se nao ha runs suficientes pra baseline
  threshold?: number;
}

export function buildRunPoints(
  tasks: Task[],
  opts: { dpi: number; window?: number }   // window default 8
): RunPoint[]   // ordenado por data crescente (empate: ordem original)
```

- [ ] **Passo 1:** Elegibilidade: `cm >= 5 && sess.pb > 0` com `cm = valorantToCm360(sess.sens, opts.dpi)`.
- [ ] **Passo 2:** Por cenario, ordenar sessoes por `date.localeCompare` (mesmo criterio de `threshold.ts`), indice original como desempate.
- [ ] **Passo 3: Baseline por run (item 2 e 7):** `baseline_i = mediana(scores dos vizinhos em +-window posicoes, excluindo i)`. Se houver menos de 6 vizinhos: mediana de todas as outras runs do cenario se houver >= 3; senao `rel = 100` e `relReliable = false`. `rel = score / baseline * 100`.
  - Por que funciona: com o saco embaralhado a janela fica balanceada em sens, entao a mediana movel remove a tendencia de aprendizado/aquecimento sem absorver o efeito da sens. Substitui a divisao pelo PB maximo, que usava uma run de sorte como denominador.
- [ ] **Passo 4:** Tornar `dpi` obrigatorio em `valorantToCm360`, `formatSensitivity`, `getScenarioIdealSens`. O compilador (`tsc -b`) aponta cada chamada que usa 800 fixo (View, CategorySensCard, preditor, `App.tsx`). Passar `settings.mouseDpi` em todas (item 18). Isso elimina a divergencia App vs Controls e o loop de ressincronizacao.
- [ ] **Passo 5:** Substituir as copias em `SensRandomizerView.relevantSessions`, `computePlaylistSensStats`, `CategorySensCard` e `getScenarioIdealSens` por `buildRunPoints` + filtro por escopo (item 21). Centralizar `DEFAULT_CATEGORY/SUBCATEGORY` de `viscose.ts` (remover os literais `"Click Timing"/"Precision"`).
- [ ] **Passo 6 (item 17):** `recentRuns` passa a vir de lista ja ordenada por data; manter `slice(-10).reverse()`.
- [ ] **Testes:** ordenacao por data; baseline ignora a propria run; cenario com < 3 runs gera `relReliable=false`; tendencia crescente de score com sens balanceada produz `rel` sem tendencia; dois cenarios com escalas 1000 e 40 produzem `rel` comparaveis.

---

## T3: Sorteador em grade com saco embaralhado (itens 1, 11, 12)

**Files:** `src-tauri/src/sampler.rs`, `src-tauri/src/randomizer.rs`

- [ ] **Passo 1: Estado do sorteador**

```rust
use std::collections::HashMap;
use rand::seq::SliceRandom;
use rand::Rng;

#[derive(Default)]
pub struct SamplerState {
    bags: HashMap<(i32, i32), Vec<i32>>,
    last_k: Option<i32>,
}

/// Sorteio sem reposicao dentro de [lo, hi]. Cada faixa (lo, hi) tem seu proprio saco,
/// entao cenarios com centros diferentes mantem cobertura independente.
pub fn draw_index<R: Rng>(st: &mut SamplerState, lo: i32, hi: i32, min_gap: i32, rng: &mut R) -> i32 {
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
```

- [ ] **Passo 2:** `min_gap = if settings.avoid_repeats { if hi - lo + 1 >= 6 { 2 } else { 1 } } else { 0 }`. O saco ja impede repeticao dentro de um ciclo; o gap evita vizinhos imediatos (item 12) e a emenda entre dois sacos.
- [ ] **Passo 3:** Reescrever `generate_next_sens(settings, center_override, st, rng) -> (f64, f64)`: resolver faixa em cm (T4), `grid_bounds`, `draw_index`, `cm = lattice_cm(k)`, `mult = round4(base_cm / cm)`. Os dois modos (`cm360` e `multiplier`) passam a usar a mesma grade; so muda como a faixa e especificada. Item 11 resolvido porque a grade e log-espacada.
- [ ] **Passo 4:** Guardar `SamplerState` em `AppState` (`Mutex<SamplerState>`). Nao persiste entre aberturas do app (reinicia o saco, sem problema).
- [ ] **Testes (RNG deterministico `StdRng::seed_from_u64`):**
  - Em N pontos de grade, N sorteios consecutivos cobrem todos os pontos exatamente uma vez.
  - Nenhum par consecutivo com `|dk| < min_gap` quando ha alternativa no saco, inclusive na emenda entre ciclos.
  - Grade de 3 pontos nao entra em loop.
  - Faixas distintas mantem sacos independentes.
  - Reescrever os testes antigos de `randomizer.rs` (`test_generate_next_sens_*`) para os novos limites multiplicativos; usar `..RandomizerSettings::default()` nos construtores.

---

## T4: Uma unica fonte de verdade para o range (item 13)

Hoje o front calcula `minCm/maxCm/minMult/maxMult` (`calculateSensRange`) e o Rust recalcula no modo auto, com clamps diferentes (Rust: 1% a 90% e piso 5 cm; TS: 1 a 90, sem piso; slider 5 a 75).

**Files:** `src-tauri/src/randomizer.rs`, `src-tauri/src/lib.rs`, `src/lib/sens-analytics.ts`, `SensRandomizerControls.tsx`, `SensRandomizerView.tsx`, `useSensRandomizer.ts`

- [ ] **Passo 1: Resolver faixa so no Rust**

```rust
pub struct RangePreview {
    pub min_cm: f64, pub max_cm: f64,
    pub min_mult: f64, pub max_mult: f64,
    pub grid_cm: Vec<f64>,
}

pub fn resolve_range_cm(s: &RandomizerSettings, center_override: Option<f64>) -> (f64, f64) {
    let base = if s.base_sens_cm > 0.0 { s.base_sens_cm } else { 40.0 };
    if s.auto_scenario_sens {
        let center = center_override.or(s.scenario_ideal_cm).unwrap_or(base).max(MIN_CM);
        let p = (s.spread_percent / 100.0).clamp(0.01, 0.90);
        ((center / (1.0 + p)).max(MIN_CM), center * (1.0 + p))
    } else if s.range_mode.eq_ignore_ascii_case("multiplier") {
        let (a, b) = (s.min_mult.min(s.max_mult).max(0.01), s.min_mult.max(s.max_mult).max(0.01));
        ((base / b).max(MIN_CM), base / a)
    } else {
        (s.min_cm.min(s.max_cm).max(MIN_CM), s.min_cm.max(s.max_cm).max(MIN_CM))
    }
}
```

- [ ] **Passo 2:** Comando `preview_sens_range(settings: RandomizerSettings, center_cm: Option<f64>) -> RangePreview` (inclui `grid_cm` para a UI mostrar os pontos reais).
- [ ] **Passo 3:** No front, apagar `calculateSensRange`. Criar `useRangePreview(settings, centerCm)` (invoke com debounce de 150 ms) e usar em Controls e View. `handleApplySens` e `syncScenarioSens` deixam de escrever `minCm/maxCm/minMult/maxMult` e **deixam de escrever `baseSensCm`** (item 26, ver T7 passo 6): `baseSensCm` e a sens real configurada no KovaaK's e so o usuario altera, no campo dedicado.
- [ ] **Passo 4:** Em `save_randomizer_settings`, validar: `base_sens_cm` entre 10 e 200, `spread_percent` entre 1 e 90, `mouse_dpi` entre 100 e 32000; retornar `Err` com mensagem clara (a UI mostra, T12).
- [ ] **Testes:** modo auto, cm manual, mult manual; piso 5 cm; `min > max` normalizado; centro 40 e spread 25 resulta em 32 a 50 cm.

---

## T5: Fluxo do watcher: rolar antes do parse, atribuir a sens certa, nao perder re-sorteio (item 3)

**Problemas atuais:** `wait_for_parse(...)?` retorna Err antes de `apply_next_sens` (sens nao troca); a nova sens so e aplicada apos parse (>= 1 s, ate 10 tentativas); a atribuicao usa `active_sens` lido no momento da criacao do CSV, entao uma run iniciada antes da troca pode ser carimbada com a sens nova.

**Files:** `src-tauri/src/watcher.rs`, `src-tauri/src/randomizer.rs`, `src-tauri/src/parser.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/model.rs`

- [ ] **Passo 1:** Expor `parser::scenario_from_file_name(&str) -> Option<String>` (usa `parse_filename_scenario`, sem ler o conteudo).
- [ ] **Passo 2: Novo `process_new_csv`** (ordem importa):

```rust
fn process_new_csv(app: &AppHandle, path: &Path) -> Result<bool, String> {
    let state: State<AppState> = app.state();
    let file_name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

    // 1. dedupe por nome de arquivo ANTES de qualquer efeito colateral (evita rolar duas vezes)
    if !state.emitted.lock().unwrap().insert(file_name.clone()) { return Ok(false); }

    // 2. snapshot da sens usada na run que acabou e do cenario que acabou
    let (enabled, used_cm, ..) = { /* settings + randomizer_state sob locks curtos */ };
    let finished = crate::parser::scenario_from_file_name(&file_name);

    // 3. rolar a proxima sens agora, sincrono, serializado por roll_lock
    if enabled {
        let _ = crate::randomizer::apply_next_sens(app, RollContext {
            finished_scenario: finished.clone(),
            reason: "run_end",
        });
    }

    // 4. reescrever CSV com used_cm e parsear (com override de sens)
    // 5. se o parse falhar: emit("run_import_failed", {file, error}) e retornar Err
    // 6. apos o parse ok: randomizer::record_last_run(app, &scenario, score) (emit "randomizer_state_patched")
}
```

- [ ] **Passo 3:** `AppState` ganha `roll_lock: Mutex<()>`; `apply_next_sens` e `trigger_randomize_now` adquirem o lock (serializa watcher, comando manual e reroll de T7).
- [ ] **Passo 4:** `apply_next_sens` deixa de receber `last_score` (so conhecido apos o parse). `last_run_scenario` vem do nome do arquivo; `record_last_run` completa o score depois.
- [ ] **Passo 5 (item 15, lado Rust):** Em `apply_next_sens`, quando RawAccel esta indisponivel, emitir `randomizer_error { message }` em vez de `sens_updated`. Adicionar `last_roll_reason: Option<String>` ao `RandomizerState` (`run_end`, `manual`, `toggle`, `reroll`).
- [ ] **Testes:** extrair a decisao para uma funcao pura (`plan_roll(enabled, dedupe_hit, ...)`) e testar: duplicata nao rola, parse falho nao impede o rolar, `used_cm` capturado antes do rolar. Teste de integracao leve com `update_kovaak_csv_sensitivity` ja existente em arquivo temporario.

---

## T6: Backup e restauracao do RawAccel + hook de saida (itens 4, 24)

**Problemas atuais:** `restore_base_sens` forca `scale = 1.0` e `Output DPI = mouse_dpi`, apagando o profile original; nao ha restauracao ao sair; `settings.json` e gravado in-place.

**Files:** `src-tauri/src/randomizer.rs`, `src-tauri/src/storage.rs`, `src-tauri/src/lib.rs`

- [ ] **Passo 1: Backup**

```rust
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawAccelBackup {
    pub output_dpi: Option<f64>,
    pub scale_whole: Option<f64>,
    pub scale_vert: Option<f64>,
    pub last_written_output_dpi: Option<f64>,
    pub last_written_scale: Option<f64>,
    pub saved_at: String,
}
```

Arquivo `rawaccel_backup.json` em `storage::data_dir`. Copiar tambem `settings.json` para `settings.json.att-backup` uma unica vez.
- [ ] **Passo 2: Quando capturar:** em `apply_next_sens`, antes da primeira escrita: se nao ha backup, capturar os valores vivos do primeiro profile. Se ha backup mas os valores vivos diferem de `last_written_*` e do backup, o usuario editou manualmente: recapturar.
- [ ] **Passo 3: Restaurar:** `restore_from_backup(app, dir)` grava `Output DPI`, `scale` (whole e vertical) a partir do backup. Sem backup, comportamento antigo (1.0, `mouse_dpi`) com `eprintln!` de aviso. Usar em desligar o randomizer.
- [ ] **Passo 4: Hook de saida.** Trocar `.run(tauri::generate_context!())` por `.build(...).expect(...).run(|app, event| { if let tauri::RunEvent::Exit = event { randomizer::restore_on_exit(app); } })`. O item "Sair" do tray ja chama `app.exit(0)`, que dispara `Exit`.
- [ ] **Passo 5: Recuperacao de crash.** `panic = "abort"` no release impede restaurar em falha. No `setup`: se `randomizer.enabled == false`, existe backup e os valores vivos batem com `last_written_*`, restaurar silenciosamente.
- [ ] **Passo 6: Escrita atomica** de `settings.json`: gravar em `settings.json.tmp` e `rename`.
- [ ] **Testes:** com diretorio temporario e `settings.json` falso (sem `writer.exe`, separar a funcao pura que transforma o JSON): capturar, aplicar, restaurar devolve valores originais; edicao manual intermediaria dispara recaptura; ausencia de backup usa fallback.

---

## T7: Centro por cenario para playlist mista e cenario unico (item 5)

**Problema:** o centro vem do `activeTask` do app e a sens e sorteada ao fim da run, antes de saber o proximo cenario. Em playlist mista o range do proximo cenario fica centrado no anterior.

**Design:**
- O front (dono da analise) publica um mapa `cenario -> centro (cm)` para o Rust.
- Cenario unico: o Rust assume que o proximo cenario e o mesmo que acabou (nome do arquivo, T5). Funciona sem nenhuma informacao extra.
- Playlist: o front publica o "cenario que vem a seguir"; ao mudar, o Rust faz um re-sorteio corretivo se o centro diferir mais de 3%.

**Files:** `src-tauri/src/lib.rs`, `src-tauri/src/randomizer.rs`, `src/App.tsx`, novo `src/hooks/useScenarioCentersSync.ts`, `src/hooks/usePlaylistRunner.ts`

- [ ] **Passo 1: Estado no Rust:** `AppState.scenario_centers: Mutex<HashMap<String, f64>>` (chave em minusculas e trim, igual a `findTaskByScenario`), `upcoming_scenario: Mutex<Option<String>>`, e `last_roll_center_cm` dentro do estado interno do sorteador.
- [ ] **Passo 2: Comandos:**
  - `set_scenario_centers(centers: HashMap<String, f64>)`
  - `set_upcoming_scenario(name: Option<String>, reroll: bool) -> Result<RandomizerState, String>`: se `reroll`, enabled, available e `|ln(novo_centro / last_roll_center)| > ln(1.03)`, chama `apply_next_sens` com `reason = "reroll"`.
- [ ] **Passo 3: Escolha do centro em `apply_next_sens`:** `upcoming = upcoming_scenario.or(finished_scenario)`; `center = scenario_centers.get(norm(upcoming)).or(scenario_ideal_cm).or(base)`.
- [ ] **Passo 4: Front, centros:** hook `useScenarioCentersSync` calcula, para cada task, `getScenarioIdealSens(task, tasks, dpi).value` (T9), aplica `stabilizeCenter(prev, next)` (deslocamento maximo de 10% por atualizacao, evita oscilacao e fecha o item 14 no modo auto) e invoca `set_scenario_centers` com debounce de 500 ms. Remove o `useEffect` de `App.tsx` que chamava `syncScenarioSens` e o campo unico `scenarioIdealCm` como fonte do sorteio (mantido so para exibir o ideal do cenario ativo).
- [ ] **Passo 5: Front, proximo cenario da playlist:** em `usePlaylistRunner`, expor `predictNextScenarioName()`: modo `reps`: se `progresso + 1 < alvo` retorna o item atual, senao o proximo item; modo `time`: item atual (sem como prever a duracao; o re-sorteio corretivo cobre a troca logo apos `new_run`). Em `App.tsx`, effect que chama `set_upcoming_scenario(name, true)` quando o valor muda; com o runner parado envia `null`. Conferir em `usePlaylistRunner.ts` os nomes reais do contador de reps.
- [ ] **Passo 6 (item 26): separar sens do jogo de centro do sorteio.** Hoje `handleApplySens` (View) grava `baseSensCm = sweet spot`. Mas o multiplicador enviado ao RawAccel e `base_cm / alvo_cm` e so e correto se `base_cm` for a sens REAL configurada no KovaaK's. Aplicar um sweet spot de 38 cm com o jogo ainda em 50 cm faz o app calcular multiplicadores contra 38, o cm/360 real fica errado (alvo 40 vira ~52.6 cm) e o CSV e carimbado com um valor que nao aconteceu, contaminando toda a analise. Correcao:
  - `baseSensCm` so muda pelo campo "Sens do jogo (KovaaK's)" nos Controls, com rotulo e texto de ajuda explicitos.
  - "Aplicar" (sweet spot, preditor, tabela) vira "Usar como centro": no modo auto grava um override por cenario em `RandomizerSettings.center_overrides: HashMap<String, f64>` (`#[serde(default)]`), que tem precedencia sobre o centro calculado em `set_scenario_centers`; no modo manual recentra a faixa (T10).
  - Nos cards de playlist e categoria, "Usar como centro" aplica o override a todos os cenarios do grupo.
  - Teste Rust: `mult = base / alvo` independe de qualquer override; teste TS: aplicar nunca altera `baseSensCm`.
- [ ] **Testes:** TS: `stabilizeCenter` limita deslocamento; Rust: centro escolhido segue `upcoming` e cai para `finished` quando `None`; re-sorteio so acima de 3%.

---

## T8: Modelo estatistico (itens 6, 7, 9, 10)

Substitui parabola nao centrada + buckets de 0.1 cm + encolhimento para a media global.

**Files:** Create `src/lib/sens-model.ts`, `test/sens-model.test.ts`

**Interfaces:**

```ts
export interface BinStat {
  k: number; cm: number; n: number;
  mean: number; sd: number | null;
  smooth: number;      // suavizado por kernel usando todos os bins
  looSmooth: number;   // suavizado excluindo o proprio bin (prior de vizinhos)
}

export function binByLattice(points: Array<{ k: number; rel: number }>): BinStat[];
export function kernelSmooth(bins: BinStat[], h?: number): (k: number) => number; // h default 1.5 passos

export interface QuadFit { a: number; b: number; c: number; vertexCm: number | null; r2: number }
export function fitQuadraticLog(
  pts: Array<{ cm: number; y: number; w?: number }>
): QuadFit | null;

export function bootstrapVertex(
  pts: Array<{ cm: number; y: number; w?: number }>,
  opts?: { b?: number; seed?: number }   // b default 300, seed fixo para teste
): { low: number; high: number; validFraction: number } | null;
```

- [ ] **Passo 1: `binByLattice`:** agrupa por `k` (indice da grade). Dados legados continuam validos porque `k = latticeIndex(cm)` agrupa por vizinhanca de 5%. Resolve o item 1 tambem para o historico.
- [ ] **Passo 2: `kernelSmooth`:** `smooth_k = soma_j(n_j * w(k - j) * mean_j) / soma_j(n_j * w(k - j))`, `w(d) = exp(-0.5 * (d / h)^2)`. `looSmooth` exclui `j = k`.
- [ ] **Passo 3: `fitQuadraticLog`:** `u = ln(cm / ref)` com `ref` = media geometrica ponderada; centrar e escalar `u` por `(u - mu) / sd`; resolver minimos quadrados ponderados pelas equacoes normais 3x3 com eliminacao de Gauss e pivoteamento parcial (sem Cramer, sem limiar absoluto). Retornar `null` a menos que **todas** valham:
  - n >= 12 pontos
  - >= 5 pontos de grade distintos
  - amplitude em `u` >= `ln(1.25)`
  - `a < 0` (concavo)
  - vertice dentro de `[uMin, uMax]` (sem extrapolar, ao contrario do atual 0.8x a 1.2x)
- [ ] **Passo 4: `bootstrapVertex`:** reamostrar com reposicao, ajustar, coletar vertices validos; exigir `validFraction >= 0.6`; IC = percentis 10 e 90. PRNG semeado (`mulberry32`) para testes deterministicos.
- [ ] **Testes:** dado sintetico com pico em 38 cm e ruido: vertice dentro de 5%; 4 pontos retornam `null`; faixa estreita retorna `null`; convexo retorna `null`; escala do score (x1000) nao muda o resultado; bootstrap com mesma semente reproduz; IC mais largo com mais ruido; dados com sens unica retornam `null` sem excecao.

---

## T9: Preditor, analytics e consumidores (itens 2, 6, 8, 9, 10)

**Files:** `src/lib/sens-analytics.ts` (vira fachada fina que reexporta e orquestra), `src/lib/viscose.ts`, `SensRandomizerAnalytics.tsx`, `CategorySensCard.tsx`, `PlaylistSensCard.tsx`, `test/sens-analytics.test.ts`

- [ ] **Passo 1: Perfis com semantica real (item 8).** Mantem os ids (`equilibrado`, `neutro`, `teorico`, `consistencia`) para compatibilidade, mas:

| Perfil | `wParam` (peso do vertice parametrico) | `lambda` (penalizacao de variabilidade) |
|---|---|---|
| equilibrado | 0.5 | 0.25 |
| neutro | 0.5 | 0 |
| teorico | 0.8 | 0 |
| consistencia | 0.3 | 1.0 |

Melhor bin empirico = `argmax_k( smooth_k - lambda * sd_k )` onde `sd_k` usa o desvio do bin quando `n_k >= 2` e o desvio global caso contrario. Agora "consistencia" realmente penaliza variancia, em vez de pesar o bin mais ruidoso.
- [ ] **Passo 2: `predictSens(points, profile, opts)`:**
  - `kernelBest` conforme acima; `vertex` de `fitQuadraticLog` (se valido).
  - `predictedCm = exp(w * ln(vertex) + (1 - w) * ln(kernelBest))` quando ha vertice; senao `kernelBest`. Arredondar para o ponto de grade mais proximo.
  - Opcoes **separadas** (item 9): `groupBlendK` (default 12, blend local/grupo) e `binPriorStrength` (default 2, prior de vizinhos em `weightedScore`). Remover `shrinkageK` e o par `minEligibleRuns: 1, shrinkageK: 1` dos componentes.
  - `weightedScore_k = (n_k * mean_k + m * looSmooth_k) / (n_k + m)` com `m = binPriorStrength`.
  - Blend hierarquico em log: `wLocal = nLocal / (nLocal + groupBlendK)`, ativo quando o grupo tem >= 4 bins. Em `SensRandomizerAnalytics` passar `groupRuns` (cenarios da mesma categoria) para o blend rodar tambem na aba principal.
  - Meia-vida de recencia: opcional, default desligado (os dados ja sao destendenciados por T2).
- [ ] **Passo 3: Confianca (item 10)** a partir de n, bins distintos e largura do IC (`(high - low) / predicted`):

| Nivel | Condicao |
|---|---|
| high | n >= 30, bins >= 6, IC <= 15% |
| medium | n >= 15, bins >= 5, IC <= 30% |
| low | n >= 8, bins >= 3 |
| insufficient | demais |

Retornar tambem `ci` e `reasons: string[]` (chaves i18n: pouco dado, pouca variedade de sens, IC largo) para a UI explicar.
- [ ] **Passo 4: `computeSweetSpotAnalytics`:** bins de grade, `minEligible = 2` se algum bin tem n >= 2, senao 1; ordenar por `weightedScore` desc com desempate por `sens` (comparador deterministico, remove a tolerancia 0.05). `isProvisional = best.n < 3`.
- [ ] **Passo 5: `getScenarioIdealSens(task, allTasks, dpi)`:** local por `predictSens` com `confidence` medium ou high; senao categoria usando `rel` pooled (corrige o pooling de score bruto, item 2); senao Viscose. Mesma regra em `CategorySensCard` e `computePlaylistSensStats`.
- [ ] **Testes:** remover/reescrever os casos que assertam bucket de 0.1 cm e parabola com 4 pontos; adicionar: pooling de cenarios com escalas diferentes nao muda o pico; consistencia penaliza bin ruidoso; blend hierarquico pesa mais o grupo quando n local e pequeno; comparador estavel.

---

## T10: Sugestao de recentralizacao no modo manual (item 14)

- [ ] **Passo 1:** `suggestRecenter(prediction, currentCenterCm)` retorna sugestao quando a confianca e medium/high e `|ln(pred / center)| > ln(1.08)`. Funcao pura em `sens-analytics.ts`.
- [ ] **Passo 2:** Em `SensRandomizerControls`, banner discreto quando `!autoScenarioSens` e ha sugestao: "Centro sugerido: X cm (atual: Y cm)" com botao Aplicar (recentra a faixa: em modo cm, reescreve `minCm/maxCm` em torno do centro sugerido mantendo a razao `max/min` atual; em modo multiplier, converte a faixa para mult; nunca toca em `baseSensCm`) e botao de dispensar (guarda o valor dispensado em memoria para nao reaparecer ate mudar).
- [ ] **Testes:** limiar de 8%, nao sugere com confianca baixa, nao reaparece apos dispensar o mesmo valor.

---

## T11: Provider unico do randomizer e listeners corretos (itens 15, 16)

`useSensRandomizer` e instanciado duas vezes (`App.tsx` e `SensRandomizerView`), entao com a aba aberta cada evento `sens_updated` dispara dois toasts e dois estados divergentes. Alem disso o cleanup do `useEffect` roda antes do `.then` definir `unlisten`.

**Files:** `src/hooks/useSensRandomizer.ts` (renomear para `.tsx`), `src/main.tsx` ou `App.tsx`, `SensRandomizerView.tsx`

- [ ] **Passo 1:** Criar `RandomizerProvider` (dentro de `AppProvider` e `I18nProvider`) com o estado e as acoes atuais; `useSensRandomizer()` passa a ler do contexto. Remover a segunda instancia.
- [ ] **Passo 2: Padrao de listener seguro**

```ts
useEffect(() => {
  let cancelled = false;
  const unlistens: Array<() => void> = [];
  const sub = async <T,>(name: string, cb: (p: T) => void) => {
    const un = await listen<T>(name, (e) => cb(e.payload));
    if (cancelled) un(); else unlistens.push(un);
  };
  void sub<RandomizerState>("sens_updated", onSens);
  void sub<RandomizerState>("randomizer_state_patched", setRandomizerState);
  void sub<{ message: string }>("randomizer_error", onError);
  void sub<RandomizerSettings>("randomizer_settings_updated", setSettings);
  void sub<{ file: string; error: string }>("run_import_failed", onImportFailed);
  return () => { cancelled = true; unlistens.forEach((u) => u()); };
}, []); // deps vazias; showToast e t via useRef com o valor mais recente
```

- [ ] **Passo 3: Regras de toast:**
  - `sens_updated`: toast so se `available` e `lastRollReason` em `manual`, `toggle`, `reroll`. Nunca em `run_end`.
  - `randomizer_error`: toast de erro, com limite de 1 por mensagem a cada 10 s.
  - `run_import_failed`: toast de aviso informando o arquivo.
- [ ] **Passo 4:** Corrigir o caso `activeMult === 1.0 && lastRunScenario === null` (hoje usado para inferir "restaurada") usando `lastRollReason === "restore"` explicito.

---

## T12: Controls com rascunho, validacao e indicador de alteracao (item 19)

**Problemas:** `useEffect([settings])` apaga a digitacao pendente; DPI e toggle salvam sozinhos, o resto so no botao; `parseFloat(x) || fallback` troca `0` pelo padrao em silencio; nao ha validacao de `min < max`.

**Files:** `SensRandomizerControls.tsx`, novo `src/lib/randomizer-draft.ts`, `test/randomizer-draft.test.ts`

- [ ] **Passo 1: Modelo.** `Draft` guarda strings dos campos continuos (base, min/max cm, min/max mult, spread, dpi texto) e um `Set` de campos tocados. Quando `settings` muda, so os campos nao tocados sao atualizados.
- [ ] **Passo 2: Regra de salvamento unica.** Controles discretos (toggle ligar/desligar, toggle auto, presets de DPI, presets de spread, modo cm/mult, avoid repeats) salvam ao clicar. Controles continuos (texto, slider) ficam no rascunho e o botao Salvar fica habilitado so quando `dirty`, com selo "alteracoes nao salvas".
- [ ] **Passo 3: Validacao** em `validateDraft(draft): Array<{ field; messageKey }>`: base entre 10 e 200; `min >= 5` e `min < max` (cm); `0 < minMult < maxMult`; DPI 100 a 32000; usar `Number.isFinite`, sem `||`. Erro inline sob o campo e Salvar desabilitado.
- [ ] **Passo 4:** Mostrar a grade real vinda de `useRangePreview` (T4): "10 pontos: 32.0, 33.6, ... 50.0 cm".
- [ ] **Testes:** valores invalidos geram erro; `0` nao vira padrao; atualizacao externa nao sobrescreve campo tocado; `dirty` correto.

---

## T13: Grafico com faixa ativa, vertice com IC e cobertura (item 20)

**Files:** `SensRandomizerChart.tsx`, novo `src/components/randomizer/SensCoverageBar.tsx`

- [ ] **Passo 1:** Eixo X logaritmico (`type: "logarithmic"`), coerente com a grade.
- [ ] **Passo 2:** Substituir `calculateParabolicTrendline` (e o `tension: 0.3` que suaviza uma parabola ja suave) por: curva do kernel (`kernelSmooth` amostrada por ponto de grade) e, se houver `QuadFit` valido, a curva quadratica amostrada em `u`.
- [ ] **Passo 3:** Datasets extras: duas linhas verticais tracejadas com `minCm` e `maxCm` da faixa ativa (de `preview_sens_range`); ponto do vertice com barra horizontal do IC (dataset de linha de 2 pontos em `y = estimativa`, de `ci.low` a `ci.high`).
- [ ] **Passo 4: `SensCoverageBar`:** barras simples (div/SVG, sem registrar `BarElement`) com a contagem de runs por ponto de grade no escopo atual. Pontos da faixa com 0 runs ficam destacados, dando para ver se o sorteio cobriu a faixa.
- [ ] **Passo 5:** Remover o parametro legado `scopeAllTasks/onToggleScope` do `SensRandomizerChartProps` se nao houver mais chamadores.

---

## T14: UI do Analytics e i18n (itens 17, 22)

**Files:** `SensRandomizerAnalytics.tsx`, `src/lib/i18n.tsx`

- [ ] **Passo 1:** Remover `minEligibleRuns: 1, shrinkageK: 1` das chamadas; usar `predictSens` e passar `groupRuns`.
- [ ] **Passo 2:** Exibir IC (`ci.low a ci.high cm`) e `reasons` quando a confianca for `low` ou `insufficient`. Coluna "Faixa" da tabela passa a usar `randomizer.colSens` (ja existe).
- [ ] **Passo 3 (item 22):** Renomear chaves i18n nos dois idiomas e em todas as referencias: `randomizer.optimalRange` para `randomizer.optimalSens`, `randomizer.useMidpoint` para `randomizer.applySens`. Os textos ja dizem "Sensibilidade Otima" e "Aplicar".
- [ ] **Passo 4:** Atualizar copy do spread (mudanca multiplicativa) e adicionar chaves novas: `randomizer.unsavedChanges`, `randomizer.gridPoints`, `randomizer.recenterSuggestion`, `randomizer.reasonFewRuns`, `randomizer.reasonFewSens`, `randomizer.reasonWideCi`, `toast.runImportFailed`, `toast.randomizerError`, erros de validacao.

---

## T15: Perfil do preditor nas settings (item 23)

- [ ] **Passo 1:** `RandomizerSettings` ganha `predictor_profile: String` (`#[serde(default = "default_profile")]`, `"equilibrado"`) em `model.rs` e `predictorProfile` no TS.
- [ ] **Passo 2:** Migracao unica no front: se existir `localStorage["att-predictor-profile"]` valido e as settings estiverem no padrao, salvar nas settings e remover a chave.
- [ ] **Passo 3:** `SensRandomizerAnalytics` le/grava via `saveSettings(..., silent = true)`.
- [ ] **Passo 4:** Atualizar os construtores de `RandomizerSettings` nos testes Rust para `..Default::default()`.

---

## T16: Testes faltantes, QA manual e fechamento (item 25)

- [ ] **Passo 1: Rust:** cobertura de saco embaralhado, gap minimo, grade com 3 pontos, `plan_roll` do watcher, backup/restauracao, `resolve_range_cm` nos tres modos, fixture da grade.
- [ ] **Passo 2: TS:** `sens-lattice`, `run-points`, `sens-model`, `randomizer-draft`, comparador de ordenacao, `stabilizeCenter`, `suggestRecenter`, pooling entre escalas. Registrar todos no script `test`.
- [ ] **Passo 3: QA manual (com KovaaK's e RawAccel reais):**
  - Ligar o randomizer, jogar 12 runs de um cenario: cada ponto de grade aparece uma vez antes de repetir; nenhum vizinho imediato quando ha alternativa.
  - Playlist com cenario de flick e de tracking: o range muda de centro na transicao (observar sens ativa logo apos a primeira run do novo cenario).
  - Forcar parse falho (CSV vazio): sens troca mesmo assim e aparece o aviso `run_import_failed`.
  - Ter um profile do RawAccel com `Output DPI` e `scale` diferentes do padrao: ligar, desligar e conferir que voltam ao original.
  - Ligar e fechar o app pelo tray: o profile original volta.
  - Aba aberta durante o sorteio: sem toasts duplicados; rolagem automatica sem toast; "Rolar agora" com toast.
  - Digitar no campo de base sem salvar enquanto o app troca de cenario: texto digitado nao some.
- [ ] **Passo 4:** `npm run build` (inclui `tsc -b`), `npm test`, `cargo test`, `cargo clippy` sem warnings novos.
- [ ] **Passo 5:** Atualizar `CONTRIBUTING.md`/README com a descricao da grade (ancora 50 cm, razao 1.05) e do comportamento de backup/restauracao do RawAccel.

---

## Riscos conhecidos

- Reescrever `sens-analytics.ts` invalida parte dos 1105 linhas de `test/sens-analytics.test.ts`. Reescrever os casos que dependem de bucket 0.1 cm e parabola de 4 pontos; manter os que testam conversoes (`valorantToCm360`, `cm360ToValorant`, `formatSensitivity`).
- O re-sorteio corretivo de T7 depende do front reagir em poucos segundos; no pior caso a primeira run do novo cenario usa uma sens do centro anterior (ainda dentro de uma faixa valida, so menos ideal). O baseline de T2 mitiga o efeito na analise.
- Dados antigos sem variacao de sens geram analise plana; esperado.
- T0 pode mudar o que T6 grava; fazer T0 primeiro.
