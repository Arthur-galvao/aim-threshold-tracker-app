# O que falta — estado em 05/11/2026 (v3.1.0)

## Concluído
- Planos 01, 02, 03 (ondas 1–3).
- **Plano 04** — meta móvel calibrada: `src/lib/skill/` (stats, sessions, sens-adjust, validity, skill-model, config), `useSkill`, KPIs/gráfico/histórico/TargetAnalytics/SessionSheet sobre o modelo novo, ratchet removido, seção "Treino" nas configurações.
- **Plano 05** — randomizer v2: `roll_plan.rs` (modos center/directed/alternating/explore, reativação, âncoras, gates por categoria), saco persistente em `sampler_state.json`, cache do RawAccel fora do hot path, `set_scenario_meta`, `set_measuring`, UI (modos, fonte do centro, tabela de direções, gates, presets, cobertura), chip de sens/papel/cue no TopBar e no passo da playlist.
- **Plano 06** — aba **Laboratório (experimental)**: tabela de jogos, faixa por subcategoria, sugestão por jogo (sempre direcional), opt-in `centerSource = "lab"`.
- **Plano 07** — sessão ao vivo + resumo, fadiga, curva intrassessão (+ "aplicar" aquecimento), passos de medição, teto de tentativas/minutos, cue de intenção, foco em 1 toque, qualidade (accuracy/TTK), fraquezas v2.
- **Plano 08** — T8.9 (code splitting: chunk inicial 403 KB), T8.10 (backdrop a 30 fps, desliga com reduced-motion), T8.11 (medição de `useAllSkills` com `console.debug` > 50 ms; worker não implementado porque não há medição acima do limite ainda).

## Desvios conscientes do plano
- **T4.3**: o regressor `Σ(r·Δ²)/Σ(Δ⁴)` subestimava b em ~50% (o resíduo já desconta a mediana da sessão). Usado regressor centrado `x = Δ² − mediana(Δ² na sessão)`; resto igual.
- **T4.5**: o valor da sessão (mediana do top‑3) fica enviesado para cima quando há ≥ 5 runs válidas por sessão → hit rate real ~0.3–0.45 com successProb 0.6. Teste usa 3 válidas/sessão. Se o hit rate parecer baixo no uso real, corrigir o viés em `s`.
- `difficultyHint` exige ≥ 6 sessões com hit também para `too_easy`.
- Não existe configuração de "nível de animação"; o backdrop aceita a prop `animationLevel` (default moderado/30 fps).

## Pendências que dependem de você
1. **Backup** de `%APPDATA%\com.aimthreshold.app\` antes de abrir a 3.0.0.
2. **Teste manual** (checklist global do Plano 08): reativação nas 2 primeiras runs, âncora a cada 5, saco preservado após reiniciar, passo de medição na sens base com runs `measure`, Lab sem alterar o centro sem opt-in, app em EN sem texto PT.
3. **Fixtures reais**: copiar 2–3 CSVs da pasta `stats` para `test/fixtures/kovaak/`.
4. **T8.4**: mover PNGs/scripts soltos da raiz (só existem no seu PC).

## Pontas soltas conhecidas
- O Rust ainda lê `autoScenarioSens` (o front envia o espelho `centerSource !== "base"`).
- Uma nova sessão de treino só é detectada no fim da primeira run após a pausa (essa run usa o plano anterior).
- Categorias fora da lista Viscose não aparecem nos gates por categoria.
- Lab: "aplicar sens" / "ver no gráfico" dos cards antigos foram retirados (Lab é só guia).
