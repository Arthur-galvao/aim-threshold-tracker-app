# Sens Randomizer - Correcoes pos-overhaul

> **Para agentes:** este documento corrige apenas o que o plano `2026-10-12-sens-randomizer-overhaul.md` deixou errado ou incompleto. Assumir que o overhaul ja foi implementado. Rodar `npm test` ao fim de cada correcao.

**Origem:** simulacao do pipeline do overhaul sobre `aim_thresholds_backup_2026-10-12.json` (451 runs, 152 cenarios). Cenario de referencia: `WALLHACK - VBRClick Easy`, 94 runs.

**Fato dos dados que motivou as correcoes:** 67 das 94 runs tem a mesma sens da run vizinha (41 em 50 cm, 13 em 68 cm). So as 21 mais recentes foram sorteadas continuamente (28.6 a 98.0 cm, 21 valores distintos). Alem disso `Session.date` so tem o dia: 15 runs caem em 2026-07-28 e 15 em 2026-09-07.

## Resumo

| # | Correcao | Arquivo principal | Severidade |
|---|---|---|---|
| C1 | Ordenar por horario do `sourceFile`, nao por `date` | `src/lib/run-points.ts` | Alta |
| C2 | Trocar a mediana movel por backfitting (tendencia + efeito da sens) | `src/lib/run-points.ts` | Alta |
| C3 | Conferir regra de suporte minimo do melhor bin | `src/lib/sens-model.ts` | Media |
| C4 | Conferir encolhimento do desvio por bin no perfil consistencia | `src/lib/sens-analytics.ts` | Media |
| C5 | Teste de aceitacao com os dados reais | `test/` | Media |

C3 e C4 ja constam no plano do overhaul; verificar se entraram no codigo e, se nao, implementar como abaixo.

---

## C1: Ordenar por horario do arquivo

**Problema:** `buildRunPoints` ordena por `date` (so o dia) com o indice original como desempate. Dentro de um dia a ordem fica dependente da ordem de insercao, que muda depois de reimportar CSVs ou mesclar backups. A destendencia (C2) depende da ordem temporal correta.

**Correcao:**

- [ ] **Passo 1:** Adicionar `ts: string` ao `RunPoint` (formato `YYYYMMDDHHmmss`).
- [ ] **Passo 2:** Extrair do `sourceFile` com a regex `(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})`. Sem match: `date.replace(/-/g, "") + "000000"`.

```ts
const TS_RE = /(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/;

export function runTimestamp(sess: { date: string; sourceFile?: string }): string {
  const m = sess.sourceFile?.match(TS_RE);
  return m ? m.slice(1, 7).join("") : sess.date.replace(/-/g, "") + "000000";
}
```

- [ ] **Passo 3:** Ordenar cada cenario por `ts` crescente; desempate pelo indice original. Usar o mesmo criterio em `recentRuns` (View/Analytics) para o item 17 ficar coerente.
- [ ] **Testes:** tres runs no mesmo dia com `sourceFile` fora de ordem saem ordenadas pelo horario; sessao sem `sourceFile` cai no fallback sem lancar erro; ordem estavel quando dois `ts` sao iguais.

---

## C2: Backfitting no lugar da mediana movel

**Problema:** a baseline por mediana movel (+-8 runs, excluindo a propria) remove a tendencia, mas dentro de blocos de sens fixa a mediana dos vizinhos ja contem o efeito da sens, que e removido junto. Nos dados reais o contraste entre 60-70 cm e 49-51 cm caiu de 6.3 para 4.7 pontos de desempenho (cerca de 25% de atenuacao). Quanto mais blocos fixos no historico, pior.

**Correcao:** estimar tendencia temporal e efeito da sens juntos, alternando as duas estimativas.

- [ ] **Passo 1:** Implementar em `src/lib/run-points.ts` (por cenario, runs ja ordenadas por `ts`):

```
sc[i]  = score da run i;   k[i] = indice de grade (latticeIndex)
trend  = mediana movel de sc em +-W                  // so inicializacao; W = 10
repetir 12 vezes:
    bins   = media e n de (sc - trend) agrupados por k
    f(k)   = kernelSmooth(bins, h = 1.5)(k)           // de sens-model.ts
    f      = f - media(f nas runs)                    // f carrega so forma, nao nivel
    trend  = mediana movel de (sc - f(k[i])) em +-W
y[i]   = sc[i] - trend[i]
rel[i] = 100 + y[i] / mediana(sc) * 100
```

- [ ] **Passo 2:** `RunPoint.rel` passa a ser `100 + desvio vs tendencia, em % da mediana`, mantendo o efeito da sens. Atualizar o comentario da interface. O consumo em `sens-model.ts` e `sens-analytics.ts` nao muda (continua lendo `rel`).
- [ ] **Passo 3:** Opcao `trendWindow` (default 10) no lugar de `window` (default 8).
- [ ] **Passo 4: Confiabilidade.** `relReliable = false` quando o cenario tem menos de 12 runs elegiveis ou menos de 3 pontos de grade distintos. Nesse caso `rel = score / mediana(score) * 100`, sem destendenciar. Os modelos ja ignoram pontos nao confiaveis em analises agrupadas.
- [ ] **Passo 5:** Dependencia circular: `kernelSmooth` mora em `sens-model.ts`, que importa `RunPoint`. Mover `binByLattice` e `kernelSmooth` para `src/lib/sens-kernel.ts` (sem dependencia de `RunPoint`) e importar nos dois lados.
- [ ] **Identificabilidade (documentar em comentario):** o que separa tendencia de sens sao as transicoes e os retornos (50 para 68 e de volta para 50). Dados com um unico bloco de sens continuam sem informacao, o que e correto.

**Testes (`test/run-points.test.ts`):**

- [ ] Tendencia crescente de score com sens balanceada produz `rel` sem tendencia (inclinacao da regressao de `rel` no tempo proxima de zero).
- [ ] **Blocos de sens fixa:** sequencia sintetica `50 x30, 68 x15, 50 x15, 68 x15`, onde 68 rende +4% de verdade e ha tendencia de +0.2% por run. O contraste medido entre as medias de `rel` em 68 e em 50 deve ficar em pelo menos 80% do contraste verdadeiro (4 pontos). Repetir com a mediana movel simples como controle para confirmar que ela fica abaixo.
- [ ] Cenario com 11 runs ou com 2 pontos de grade distintos gera `relReliable=false`.
- [ ] Dois cenarios com escalas 1000 e 40 produzem `rel` comparaveis.

---

## C3: Suporte minimo do melhor bin (verificar)

**Problema:** sem regra de suporte, uma unica run extrema vence o argmax do suavizado, porque o suavizado de um bin isolado e a propria media dele. Na simulacao, o argmax puro oscilava de 67 a 99 cm conforme o perfil.

- [ ] **Passo 1:** Em `sens-model.ts`, expor `kernelSupport(k) = soma_j(n_j * w(k - j))`.
- [ ] **Passo 2:** So pontos de grade com `kernelSupport(k) >= max(3, 0.05 * n_total)` podem ser o melhor empirico.
- [ ] **Teste:** uma unica run isolada a 136 cm entre 45 runs concentradas entre 37 e 82 cm nunca vira o melhor empirico.

## C4: Encolhimento do desvio por bin (verificar)

**Problema:** um bin com 2 runs parecidas parece "super consistente" e o perfil `consistencia` o escolhe.

- [ ] **Passo 1:** Em `sens-analytics.ts`, usar no argmax `smooth_k - lambda * sd_k` com

```
sd_k = sqrt(((n_k - 1) * sd_bin^2 + 3 * sd_global^2) / (n_k - 1 + 3))
```

e `sd_bin = sd_global` quando `n_k = 1`.
- [ ] **Teste:** bin com n=2 e desvio quase zero nao vence o perfil `consistencia` contra um bin com n=15 e desvio moderado.

---

## C5: Teste de aceitacao com os dados reais

Criar fixture reduzida (so `sens`, `pb`, `date`, `sourceFile` do cenario `WALLHACK - VBRClick Easy`, sem dados pessoais alem disso) em `test/fixtures/wallhack-vbrclick-easy.json` e `test/real-data-acceptance.test.ts`.

Valores esperados (tolerancia de +-1 ponto de grade, isto e, ~5%, porque dependem de detalhes de implementacao):

| Metrica | Esperado |
|---|---|
| Runs elegiveis | 94 |
| Sens sorteadas continuamente (ultimas 21) | 21 valores distintos |
| Aba antiga | melhor bucket 57.7 cm com n=1 (referencia, nao testar) |
| Pico previsto (perfil neutro) | 67.0 cm |
| Confianca | `low` (nunca `medium` ou `high`) |
| Vertice parabolico | `null` (guardas rejeitam) |

Desempenho medio por regiao apos C2, em % da mediana do cenario (tolerancia de +-1.5 ponto):

| Regiao (cm) | Runs | Score bruto medio | Desempenho destendenciado |
|---|---|---|---|
| < 45 | 12 | 1019 | -0.6% |
| 49 a 51 | 41 | 1002 | -2.4% |
| 51 a 60 | 8 | 994 | +0.4% |
| 60 a 70 | 18 | 1039 | +3.8% |
| 70 a 80 | 8 | 976 | -0.1% |
| 80 a 120 | 7 | 1044 | +2.9% |

- [x] **Criterio principal:** nenhum cenario dos dados reais pode produzir confianca `medium` ou `high`, porque 41 das 94 runs estao em 50 cm e 13 em 68 cm. Se produzir, o modelo esta confiante demais.
- [x] **Leitura esperada pelo usuario:** ha indicio de que 60 a 70 cm rende acima de 50 cm, mas o modelo nao afirma. A confianca baixa e o resultado correto.

---

## Limites desta validacao

- O backfitting foi validado em um unico cenario real. O teste sintetico de blocos (C2) e o criterio acima existem para detectar regressao, nao provam que ele e ideal para todos os cenarios.
- Os valores de C5 vieram de uma simulacao em Python equivalente ao algoritmo, nao da implementacao em TS. Se a implementacao divergir por mais de 1 ponto de grade, investigar antes de ajustar a tolerancia.
