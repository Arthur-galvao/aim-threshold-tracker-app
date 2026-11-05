# Plano 05 — Randomizer v2 (Ondas 4–5)

**Decisão do Arthur:** o randomizer fica e continua no centro do treino: impede o piloto automático, força adaptação real e usa grupos musculares diferentes. O que muda é *como* ele varia e o fato de ele parar de poluir a meta.

Base:
- **Viscose ("Muscle memory is a myth (kinda)", Raw Input, jan/2024):** sens é ferramenta; trocar "doesn't hurt your aim"; "switch it up often when training to focus on different skillsets". Ela também usa de propósito uma sens desfavorável à tarefa: **lenta** em flick longo para velocidade de braço, **rápida** em precisão para controle de pulso. Na partida a sens fica fixa.
- **Aimlabs (abr/2026):** variar a sens quebra o piloto automático.
- **Wymbs et al. 2016:** praticar uma versão *levemente* modificada depois de reativar a habilidade original melhorou o aprendizado. → reativar na base antes de randomizar.
- **Consenso r/FPSAimTrainer:** o randomizer rende mais em tracking reativo; derruba score, então não serve para medir. → âncoras e passos de medição na base.
- **Voltaic:** "no concrete evidence… use it if you think it will benefit you" (sem evidência forte, mas sem dano conhecido).

O que **não** muda: a grade log discreta (razão 1.05, âncora 50 cm) e o sorteio sem reposição (saco embaralhado), mantidos como decisão anterior.

---

## Conceitos novos

### Fonte do centro (`centerSource`)
| Valor | Centro do cenário |
|---|---|
| `personal_relative` (**default**) | `baseSensCm × (viscose[sub] / mediana(todas as viscose[sub]))`. Mantém a escala pessoal do usuário e aplica a direção relativa da Viscose por subcategoria |
| `viscose_absolute` | `VISCOSE_RECOMMENDED_SENS[cat][sub]` |
| `base` | `baseSensCm` para tudo |
| `lab` | sugestão do Laboratório (Plano 06), **experimental**, opt-in |
| (sempre) | `centerOverrides[cenário]` manual vence qualquer fonte |

O preditor empírico **deixa de ser** o centro padrão (ver Plano 06).

### Modos (`mode`)
| Modo | Faixa (cm/360) | Para quê |
|---|---|---|
| `center` | `[c(1−p), c(1+p)]` | Variação geral (comportamento atual) |
| `directed` (Viscose) | centro deslocado: `c' = c·(1 + s·0.6p)`, `s = +1` (lenta), `−1` (rápida), `0` (neutra), por subcategoria; depois `[c'(1−p), c'(1+p)]` | Sens desfavorável de propósito para isolar o grupo muscular |
| `alternating` | blocos de `B` runs alternando a **metade rápida** `[c(1−p), c)` e a **metade lenta** `(c, c(1+p)]` | Rodízio dedo/pulso ↔ braço dentro da sessão |
| `explore` | `p` travado em ≥ 0.40 | Tracking livre, máxima variação |

Tabela de direção padrão do `directed` (editável na UI, rotulada "sugestão inicial"):
| Categoria | Subcategoria → direção |
|---|---|
| Flick Tech | Speed → lenta · Stability → neutra · Micro → rápida · Post-Flick → neutra |
| Click Timing | Precision → rápida · Reading → neutra · Stability → neutra |
| Control Tracking | Arm → lenta · Wrist → rápida · Fingertip → rápida · Blending → neutra |
| Reactive Tracking | Speed → lenta · Control → neutra · Reading → neutra |

### Estrutura da sessão (vale para todos os modos)
- **Reativação:** as primeiras `reactivationRuns` (default 2) runs de cada sessão de treino rodam no centro (`sensRole = "base"`). Coincide com o aquecimento do Plano 04, então nenhuma run de medição é desperdiçada.
- **Âncoras:** a cada `anchorEvery` (default 5) runs randomizadas, 1 run no centro (`sensRole = "anchor"`). Alimenta a meta com runs brutas válidas mesmo treinando quase sempre randomizado. `0` desliga.
- **Passo de medição** (Plano 07) ou playlist marcada como medição → randomizer pausado (`sensRole = "off"`, sens base aplicada).
- **Por categoria:** liga/desliga por categoria (default: todas ligadas; a UI mostra a dica "comunidade relata mais ganho em tracking").
- Nova sessão = gap > `sessionGapMinutes` (Plano 04) desde a última run → contadores zeram.

### Cue de grupo muscular
Para a sens ativa `x` e o centro `c`: `x < 0.92c` → "rápida · pulso/dedos"; `x > 1.08c` → "lenta · braço"; senão "base". Exibido no TopBar, no runner da playlist e (opcional) na notificação.

---

## T5.1 [FORTE] Contrato
**Arquivos:** `src-tauri/src/model.rs`, `src/lib/types.ts`, `src/hooks/useSensRandomizer.ts` (só interface/DEFAULT_SETTINGS), `src/lib/tauri-bridge.ts`, `src-tauri/src/lib.rs` (registro).
`RandomizerSettings` ganha (`#[serde(default)]`):
```
mode: "center"|"directed"|"alternating"|"explore" = "center"
centerSource: "personal_relative"|"viscose_absolute"|"base"|"lab" = "personal_relative"
directionOverrides: HashMap<"Cat/Sub", "fast"|"slow"|"neutral"> = {}
reactivationRuns: u32 = 2
anchorEvery: u32 = 5
alternatingBlock: u32 = 3
categoryEnabled: HashMap<String,bool> = {}   // ausente = true
```
- Remover `autoScenarioSens`/`scenarioIdealCm`/`predictorProfile` do uso (manter campos só para ler settings antigos; migrar: `autoScenarioSens=true` → `centerSource="personal_relative"`).
- Comando `set_scenario_centers` → substituir por `set_scenario_meta(meta: HashMap<String /*nome normalizado*/, { centerCm: f64, category: String, subcategory: String }>)`.

## T5.2 [FORTE] Planejador de sorteio puro (Rust)
**Arquivos:** `src-tauri/src/sampler.rs`, novo `src-tauri/src/roll_plan.rs`.
```rust
pub struct RollSessionState { pub last_run_at: Option<i64>, pub runs_in_session: u32, pub randomized_since_anchor: u32, pub alt_phase: u8 /*0 rápida,1 lenta*/, pub alt_count: u32 }
pub enum Role { Base, Anchor, Random, Off }
pub struct RollPlan { pub role: Role, pub center_cm: f64, pub lo_cm: f64, pub hi_cm: f64, pub bag_key: String }
pub fn plan_roll(s: &RandomizerSettings, sess: &mut RollSessionState, meta: &ScenarioMeta, now_ms: i64, gap_min: u32, measuring: bool) -> RollPlan
```
Ordem de decisão: `measuring` ou categoria desabilitada → `Off`/`Base`; gap > `gap_min` → reset do `sess`; `runs_in_session < reactivationRuns` → `Base`; `anchorEvery > 0 && randomized_since_anchor >= anchorEvery` → `Anchor` (zera o contador); senão `Random` com a faixa do modo (tabela acima).
- `Base`/`Anchor`: `lo = hi = center` (aplica o ponto da grade mais próximo do centro: `lattice_cm(lattice_index(center))`).
- `bag_key` = `"{lo_k}:{hi_k}:{mode}:{phase}"` → cada metade do `alternating` tem seu próprio saco.
- O `SamplerState.bags` passa a usar `bag_key: String`.
**Testes:** reativação (2 primeiras = Base); âncora exatamente na 6ª randomizada com `anchorEvery=5`; `alternating` troca de metade a cada `alternatingBlock`; `directed` lenta desloca o centro em +0.6p; gap de 60 min reseta; categoria desabilitada → Base.

## T5.3 [FORTE] Integração no `apply_next_sens`
**Arquivos:** `src-tauri/src/randomizer.rs`, `src-tauri/src/lib.rs` (campos novos do `AppState`: `roll_session`, `scenario_meta`, `rawaccel_cache`), `src-tauri/src/watcher.rs` (passar `measuring` e registrar no ledger o `role/center/k` da run que **terminou**).
- `apply_next_sens` usa `plan_roll` → `draw_index` (se Random) → `update_and_apply_scale`.
- `RandomizerState` ganha `activeRole`, `activeCenterCm`, `muscleCue: "fast"|"slow"|"base"`.
- **Cache do RawAccel (REV-10):** `rawaccel_cache: Mutex<Option<(PathBuf, bool /*driver ok*/)>>` preenchido no boot / ao mudar path / no "Testar". O hot path **não** chama `tasklist`, `read_dir` nem registro. `is_rawaccel_gui_running` só em `check_rawaccel_available` (aba aberta) e no "Testar".
- Comando `set_measuring(bool)` (chamado pelo runner da playlist, Plano 07).

## T5.4 [HAIKU] Persistir o estado do sorteio
**Arquivos:** `src-tauri/src/sampler.rs` (derive Serialize/Deserialize), `src-tauri/src/storage.rs` (`load/save_sampler_state`, atômico), `src-tauri/src/randomizer.rs` (salvar após cada sorteio).
- Arquivo `sampler_state.json` com `bags`, `last_k`, `roll_session`. Boot carrega. JSON inválido → default (sem quarentena; é estado descartável).

## T5.5 [HAIKU] `set_upcoming_scenario` só quando o nome muda
**Arquivos:** `src/App.tsx` (só o effect do upcoming).
- `const upcoming = useMemo(() => runner.isRunning ? runner.predictNextScenarioName() : null, [runner.isRunning, runner.currentStepIndex, runner.sessionCountAtStart, runner.activePlaylist?.id, currentTaskSessionsLen])`; um `useRef` guarda o último nome enviado; só faz `invoke` se mudou.

## T5.6 [HAIKU] Sincronizar meta de cenário
**Arquivos:** `src/hooks/useScenarioCentersSync.ts` (renomear para `useScenarioMetaSync.ts` e atualizar o import em `App.tsx`).
- Calcula `centerCm` por task conforme `centerSource` (tabela acima; `lab` lê do Plano 06 quando existir, senão cai para `personal_relative`) + `category/subcategory`; envia `set_scenario_meta` com debounce de 500 ms; não recalcula o preditor a cada mudança (REV-21).

## T5.7 [HAIKU, Onda 5] UI do randomizer (um agente por arquivo)
- **T5.7a** `components/views/randomizer/controls.tsx`: seletor de modo (4 cards com 1 linha de explicação cada), fonte do centro, spread, reativação, âncora a cada N, bloco do alternado.
- **T5.7b** novo `components/views/randomizer/direction-table.tsx`: tabela categoria/subcategoria × {rápida, neutra, lenta}, com botão "restaurar sugestão (Viscose)".
- **T5.7c** novo `components/views/randomizer/category-gates.tsx`: switches por categoria + dica sobre tracking.
- **T5.7d** `components/views/randomizer/range-presets.tsx`: presets nomeados: "Viscose direcionado" (`directed`, p 25%), "Rodízio muscular" (`alternating`, p 25%, bloco 3), "Exploração tracking" (`explore`), "Leve" (`center`, p 12%).
- **T5.7e** `components/shell/TopBar.tsx` + `components/views/playlist/StepSensCard.tsx`: chip com sens ativa, papel (base/âncora/random/off) e cue muscular; se o Plano 04 estiver pronto, "meta na sens atual" (`targetAtSens`).
- **T5.7f** `components/views/randomizer/coverage-bar.tsx`: cobertura da grade por cenário, colorindo as metades rápida/lenta e marcando as âncoras.
- **T5.7g** `lib/randomizer-draft.ts` + teste: validar campos novos (`anchorEvery` 0–20, `reactivationRuns` 0–5, `alternatingBlock` 1–10, spread 5–40%; `explore` força ≥ 40%).

## T5.8 [HAIKU] Integração (i18n PT/EN de modos, direções, cues e textos de ajuda com a fonte, ex.: "Base: Viscose — sens desfavorável de propósito isola o grupo muscular").
