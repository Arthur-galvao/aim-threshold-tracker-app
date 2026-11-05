# Plano 04 — Threshold v2: meta móvel calibrada (Ondas 4–5)

Substitui o ratchet monotônico (`computeDayThreshold`: `max(prev, 0.93·PB, 2º melhor)`), que tem três defeitos:
1. **Nunca desce** → um dia outlier trava a meta acima do alcançável; hit rate desaba e para de informar.
2. **0.93 fixo** ignora a variância do cenário (cenário de CV alto precisa de margem maior).
3. **Avalia o dia inteiro**: aquecimento e runs em sens longe do centro (randomizer) contam como tentativas falhas.

Princípios (fontes: Voltaic Advice FAQ — benchmark mede, rotina melhora; warm-up decrement — Ajemian 2010 e dados do Aim Lab "in the wild"; variância multiplicativa de score → trabalhar em log):
- Unidade = **run**; agrupamento = **sessão de treino** (gap ≤ 45 min), não dia.
- Só **runs válidas** alimentam a meta.
- Tudo em `y = ln(score)`.
- A meta **pode descer**. O **PB** continua como registro separado e nunca é apagado.

---

## T4.1 [HAIKU] Utilitários estatísticos puros
**Arquivos:** novo `src/lib/skill/stats.ts`, novo `test/skill-stats.test.ts`.
```ts
export function median(xs: number[]): number            // [] → NaN
export function mad(xs: number[]): number               // mediana de |x - mediana|
export function robustSigma(xs: number[]): number       // 1.4826 * mad
export function theilSenSlope(xs: number[], ys: number[]): number // mediana das inclinações par a par; n<2 → 0
export function invNormCdf(p: number): number           // Acklam; p∈(0,1)
export function clamp(x: number, lo: number, hi: number): number
```
`invNormCdf` (Acklam, erro < 1.2e-9) — implementar exatamente:
```ts
const a=[-3.969683028665376e1,2.209460984245205e2,-2.759285104469687e2,1.383577518672690e2,-3.066479806614716e1,2.506628277459239];
const b=[-5.447609879822406e1,1.615858368580409e2,-1.556989798598866e2,6.680131188771972e1,-1.328068155288572e1];
const c=[-7.784894002430293e-3,-3.223964580411365e-1,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783];
const d=[7.784695709041462e-3,3.224671290700398e-1,2.445134137142996,3.754408661907416];
const pl=0.02425, ph=1-pl;
if(p<pl){const q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
if(p<=ph){const q=p-0.5,r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);}
const q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
```
**Testes:** `invNormCdf(0.5)=0`, `invNormCdf(0.975)≈1.959964` (±1e-6), `invNormCdf(0.8333)≈0.9673`; `robustSigma` de N(0,1) com 10k amostras (seed fixa) ≈ 1 ±0.05; Theil-Sen ignora 1 outlier em 10 pontos lineares.

## T4.2 [HAIKU] Sessões de treino
**Arquivos:** novo `src/lib/skill/sessions.ts`, `test/skill-sessions.test.ts`.
```ts
export interface RunRef { taskId: string; session: Session; t: number /* epoch ms */ }
export function runTime(s: Session): number   // datetime → ms; sem datetime: date 12:00 + índice*1ms (preserva ordem do array)
export function groupTrainingSessions(runs: RunRef[], gapMin = 45): RunRef[][] // ordena por t, quebra quando gap > gapMin; legado sem datetime: um grupo por date
export function sessionKey(group: RunRef[]): string  // ISO do primeiro run
```
Agrupamento é **global** (todos os cenários), depois filtrado por cenário — assim aquecimento em outro cenário conta.

## T4.3 [FORTE] Ajuste de score por sens
**Arquivos:** novo `src/lib/skill/sens-adjust.ts`, `test/skill-sens-adjust.test.ts`.

Modelo por cenário (efeito de sessão controlado pelo resíduo dentro da sessão — sem isso, melhora ao longo das semanas é confundida com sens):
- Para cada run com `sens > 0`: `center = rollCenterCm ?? mediana das sens do cenário na janela`; `Δ = ln(sens/center)`.
- `r = y − mediana(y das runs do mesmo cenário na mesma sessão)` (sessões com ≥ 2 runs).
- `b̂ = Σ(r·Δ²) / Σ(Δ⁴)` (MQO pela origem), `b̂ = min(b̂, 0)`.
- Encolhimento: `b = b̂ · N/(N + 30)`, N = nº de pares usados.
- **Confiável** se: `N ≥ 30`, ≥ 3 valores distintos de `latticeK` (ou sens distintas por bucket de 5%), ≥ 5 sessões com variação de sens.
- `yAdj = y − b·Δ²`, com correção limitada: `−b·Δ² ≤ ln(1.25)`.
- Janela: últimas 300 runs do cenário.
```ts
export interface SensAdjustModel { b: number; reliable: boolean; n: number; centerFallback: number }
export function fitSensAdjust(runs: RunRef[], sessions: RunRef[][]): SensAdjustModel
export function adjustLogScore(y: number, sens: number, center: number, m: SensAdjustModel): number
export function targetAtSens(targetCenter: number, sens: number, center: number, m: SensAdjustModel): number // T·exp(b·Δ²): meta equivalente na sens atual
```
**Testes:** dados sintéticos com b real = −2.0, 400 runs, ruído σ=0.05, tendência temporal +0.3%/sessão correlacionada com sens → `b` estimado entre −2.6 e −1.4 (prova que o controle por sessão funciona); com 20 runs → `reliable=false`.

## T4.4 [FORTE] Classificação de validade
**Arquivos:** novo `src/lib/skill/validity.ts`, `test/skill-validity.test.ts`.
```ts
export interface ValidityConfig { warmupRunsPerScenario: number /*1*/; sessionWarmupMinutes: number /*5*/; maxPauseSeconds: number /*10*/; baseBandRatio: number /*1.05*/ }
export type InvalidReason = "warmup" | "paused" | "no_score" | "off_center_unadjustable" | "manual_excluded"
export interface RunValidity { valid: boolean; weight: number; reason?: InvalidReason; y: number /* ln score possivelmente ajustado */ }
export function classifyRun(run: RunRef, ctx: { sessionGroup: RunRef[]; scenarioRunsInSession: RunRef[]; model: SensAdjustModel; cfg: ValidityConfig }): RunValidity
```
Regras, em ordem:
1. `pb <= 0` → inválida `no_score`.
2. `pauseDuration > maxPauseSeconds` → `paused`.
3. Índice da run entre as do cenário na sessão `< warmupRunsPerScenario` → `warmup`. Se tem `datetime`: run iniciada nos primeiros `sessionWarmupMinutes` da sessão → `warmup`.
4. `sensRole ∈ {base, anchor, off}` ou `|Δ| ≤ ln(baseBandRatio)` → válida, `y` bruto, `weight 1`.
5. Senão (randomizada/unknown fora da banda): se `model.reliable` → válida, `y = adjustLogScore`, `weight 0.6`; senão → inválida `off_center_unadjustable`.
6. `runMode === "measure"` → `weight *= 1.25` (cap 1.25).
Sessões legadas sem `sensRole`: tratar como `unknown`.

## T4.5 [FORTE] Modelo de habilidade e meta
**Arquivos:** novo `src/lib/skill/skill-model.ts`, `test/skill-model.test.ts`.
```ts
export interface TargetConfig { plannedRuns: number /*5*/; successProb: number /*0.6; fácil 0.75, difícil 0.45*/; rustK: number /*1*/; rustFullDays: number /*14*/ }
export interface SkillPoint { sessionKey: string; startedAt: number; nValid: number; sessionValue: number|null; muBefore: number; sigma: number; target: number /*escala de score*/; stretch: number; hit: boolean|null; muAfter: number }
export interface SkillSummary { points: SkillPoint[]; mu: number|null; sigma: number|null; cv: number|null; nextTarget: number|null; nextStretch: number|null; pb: number|null; hitRate14: number|null; trend: "up"|"flat"|"down"|"insufficient"; trendSlopePct: number|null; difficultyHint: "too_easy"|"too_hard"|null; model: SensAdjustModel }
export function computeSkill(task: Task, allRuns: RunRef[], cfg: { validity: ValidityConfig; target: TargetConfig }, now: number): SkillSummary
```
Algoritmo (por cenário, sessões em ordem):
1. **Valor da sessão:** `ys` = y das runs válidas, desc; `k = min(3, n)`; `s = mediana(ys[0..k])`; `wS = média(weights[0..k]) · min(1, n/3)`. Sessão sem válidas → não atualiza μ (gera ponto com `sessionValue=null`).
2. **σ (rolante, só com runs anteriores à sessão atual):** resíduos `y − média_da_sessão` das últimas 60 runs válidas de sessões com ≥ 2 válidas; `σ̂ = robustSigma`; com `c` resíduos e `c < 10`: `σ = (c·σ̂ + (10−c)·0.06)/10`; depois `clamp(σ, 0.015, 0.25)`.
3. **Ferrugem:** `g` = dias desde a sessão anterior; `μ_eff = μ − rustK·σ·min(1, g/rustFullDays)`.
4. **Meta antes da sessão:** `q = 1 − (1 − successProb)^(1/plannedRuns)`; `T = exp(μ_eff + σ·invNormCdf(1 − q))`; `stretch = exp(μ_eff + 2σ)`.
5. **Hit:** `max(ys) ≥ ln(T)` (null se sem válidas ou primeira sessão).
6. **Atualização:** `α = (idx < 5 ? 0.3 : 0.18) · wS`; `s* = clamp(s, μ − 2.5σ, μ + 2.5σ)`; `μ += α(s* − μ)`. Primeira sessão: `μ = s`.
7. **Próxima meta** (`nextTarget`): passo 3–4 com `g` = dias de hoje desde a última sessão.
8. **PB:** max score bruto de todas as runs (sem filtro).
9. **Hit rate 14:** hits/(hits+misses) nas últimas 14 sessões com hit≠null. `>0.75` → `too_easy`; `<0.35` (com ≥ 6 sessões) → `too_hard`.
10. **Tendência:** Theil-Sen de `muAfter` nas últimas 10 sessões com valor (precisa ≥ 8 e ≥ 30 runs válidas, senão `insufficient`). `slope` em log/sessão ≈ fração. `> 0.002` up; `< −0.004` down; senão flat (= platô).

**Testes (simulação, seed fixa):**
- μ real sobe 1%/sessão por 20 sessões, depois cai 5% e fica → `nextTarget` **cai** em até 4 sessões após a queda.
- Uma sessão com outlier +40% → μ sobe < 1.5σ.
- Regime estável, `successProb 0.6`, `plannedRuns 5`, 60 sessões → hitRate entre 0.45 e 0.75.
- 30 dias sem treinar → `nextTarget` < meta antes da pausa.
- Cenário com 4 runs → não quebra, `trend: "insufficient"`.

## T4.6 [HAIKU] Config persistida
**Arquivos:** parte de contrato (`src-tauri/src/model.rs`, `src/lib/types.ts`) é feita pelo agente de contrato da Onda 4, junto com o T5.1. Parte de UI: novo `src/components/dialogs/SettingsTrainingSection.tsx` + montar a seção em `src/components/dialogs/SettingsDialog.tsx` (único edit nesse arquivo).
- `AppSettings.training: { warmupRunsPerScenario: 1, sessionWarmupMinutes: 5, sessionGapMinutes: 45, plannedRuns: 5, difficulty: "easy"|"normal"|"hard" (normal), maxPauseSeconds: 10 }`.
- UI: "Dificuldade da meta" (segmented), "Runs de aquecimento por cenário", "Minutos de aquecimento", "Runs planejadas por cenário" (com explicação de 1 linha cada).

## T4.7 [HAIKU] Hook derivado
**Arquivos:** novo `src/hooks/useSkill.ts`.
- `useSkill(taskId)` → `SkillSummary`, memoizado por `(task.id, task.sessions.length, última sessionId, settings.training)`.
- `useAllSkills()` para breakdown/weakness (memo por revision; calcular em `requestIdleCallback` se > 200 tasks).
- `allRuns` global montado uma vez por revision (necessário para sessões globais).

## T4.8 [HAIKU, Onda 5] UI — substituir ratchet (um agente por arquivo)
Cada sub-tarefa edita **só** o arquivo listado e consome `useSkill`:
- **T4.8a** `KPIStrip.tsx`: KPIs = "Meta da próxima sessão" (com "meta na sens atual" via `targetAtSens` quando randomizer ativo), "Habilidade (μ)" em score, "Consistência (CV = σ)", "Hit rate 14 sessões", "PB". Streak sai do KPI principal (vai para tooltip).
- **T4.8b** `ChartCanvas.tsx` / `ProgressChart.tsx`: pontos = runs (válidas cheias, inválidas vazadas com tooltip do motivo), linha μ, faixa μ±σ, linha da meta por sessão (degrau), linha PB pontilhada.
- **T4.8c** `RatchetAnalytics.tsx` → renomear componente para `TargetAnalytics.tsx` (atualizar o import em `dashboard/index.tsx` — único edit permitido fora do arquivo): tendência (up/flat/down) + slope %/sessão, dica de dificuldade, nº de runs inválidas por motivo.
- **T4.8d** `DayHistoryCard.tsx` → agrupar por **sessão de treino**: início/fim, runs, válidas, melhor ajustado, meta, hit.
- **T4.8e** `SessionSheet.tsx` (lançamento manual): estimativa com `computeSkill` simulando as runs digitadas.
- **T4.8f** `TrackerWorkspaceContext.tsx`: `ComputedMetrics` → derivar de `SkillSummary`; remover `RatchetStatus`/`SimulatedOutcome` (substituir por `{ projectedTarget, willHit, willBreakPB }`).
- **T4.8g** `metric-deltas.ts` / `day-summary.ts`: reescrever sobre sessões e `SkillSummary`.
- **T4.8h** `usePlaylistRunner.ts`: modo `threshold` usa `nextTarget` (ou `targetAtSens` na sens ativa) e só conta **runs válidas**.
- **T4.8i** `threshold.ts`: remover `computeDayThreshold`, `recalculateAllTaskThresholds`, `recalculateAllTasks`, `estimateSessionThreshold`; `buildEscalateFormat` passa a usar `target` por sessão e o FOV real da run (hoje chumba 103). `Session.threshold` não é mais escrito (campo mantido só para leitura de dados antigos).
- **Testes antigos:** `test/threshold.test.ts` ("characterization tests (current behavior)") e partes de `v2-glass-hud.test.ts`/`challenger-empirical.test.ts` que validam o ratchet **devem ser substituídos** pelos testes do modelo novo — não "consertar" o modelo para passar nos testes antigos.

## T4.9 [HAIKU] Integração (i18n; textos explicativos curtos em PT/EN para: meta, μ, CV, hit rate, run inválida e motivos).
