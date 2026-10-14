# Plano 04: Aplicação de Apple Liquid Glass em 100% da Interface

## 1. Diagnóstico do Problema Atual
- Algumas superfícies secundárias (como inputs de texto/número, chips de runs, linhas e cabeçalhos da tabela de histórico, botões secundários, seletores dropdown e modais) ainda apresentavam aparência de caixas escuras comuns (opacas ou chapadas) em vez do efeito **Liquid Glass** contínuo.

---

## 2. Física Óptica do Apple Liquid Glass (`src/index.css`)

Substituir todas as classes de superfície antigas por 3 classes mestras de **Liquid Glass** que combinam **translucidez + saturação + dupla borda especular de refração (topo brilhante + base translúcida) + brilho interno radial**:

### 2.1. `.liquid-glass-panel` (Containers Principais: CommandBar, Cards Bento, Gráfico, Quick Composer, Session Ledger)
```css
.liquid-glass-panel {
  background: linear-gradient(
    145deg,
    oklch(24% 0.03 230 / 0.48) 0%,
    oklch(16% 0.025 250 / 0.34) 100%
  );
  backdrop-filter: blur(28px) saturate(190%) brightness(1.05);
  -webkit-backdrop-filter: blur(28px) saturate(190%) brightness(1.05);
  border: 1px solid oklch(100% 0 0 / 0.14);
  box-shadow:
    inset 0 1px 1px 0 oklch(100% 0 0 / 0.32),
    inset 0 -1px 1px 0 oklch(100% 0 0 / 0.06),
    inset 1px 0 1px 0 oklch(100% 0 0 / 0.08),
    0 20px 45px -15px oklch(6% 0.02 250 / 0.65);
  border-radius: 20px;
}
```

### 2.2. `.liquid-glass-control` (Todos os Inputs, Botões Secundários, NumberFields, Chips de Runs, Abas e Filtros `7D/30D/Tudo`)
```css
.liquid-glass-control {
  background: linear-gradient(
    180deg,
    oklch(30% 0.035 225 / 0.42) 0%,
    oklch(20% 0.025 245 / 0.28) 100%
  );
  backdrop-filter: blur(16px) saturate(170%);
  -webkit-backdrop-filter: blur(16px) saturate(170%);
  border: 1px solid oklch(100% 0 0 / 0.15);
  box-shadow:
    inset 0 1px 0.5px 0 oklch(100% 0 0 / 0.28),
    0 4px 12px -2px oklch(5% 0.02 250 / 0.4);
  border-radius: 12px;
  transition: all 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.liquid-glass-control:hover {
  background: linear-gradient(
    180deg,
    oklch(35% 0.04 220 / 0.52) 0%,
    oklch(24% 0.03 240 / 0.38) 100%
  );
  border-color: oklch(100% 0 0 / 0.26);
  box-shadow:
    inset 0 1px 1px 0 oklch(100% 0 0 / 0.4),
    0 6px 16px -3px oklch(5% 0.02 250 / 0.5);
}
```

### 2.3. `.liquid-glass-floating` (Popovers, Dropdowns do Select, Command Palette `Ctrl+K`, `NewTaskModal` e `TelemetryToast`)
```css
.liquid-glass-floating {
  background: linear-gradient(
    155deg,
    oklch(26% 0.04 230 / 0.68) 0%,
    oklch(17% 0.03 250 / 0.56) 100%
  );
  backdrop-filter: blur(36px) saturate(210%) brightness(1.08);
  -webkit-backdrop-filter: blur(36px) saturate(210%) brightness(1.08);
  border: 1px solid oklch(100% 0 0 / 0.22);
  box-shadow:
    inset 0 1.5px 1px 0 oklch(100% 0 0 / 0.42),
    0 28px 60px -12px oklch(4% 0.02 250 / 0.8);
  border-radius: 22px;
}
```

---

## 3. Lista Completa de Elementos que Devem Receber Liquid Glass

1. **`CommandBar`:** O container principal usa `.liquid-glass-panel`; o seletor de cenário, o trilho das abas Viscose, a pílula ativa da aba, o badge do Watcher e os botões de JSON/Tema usam `.liquid-glass-control`.
2. **`TelemetryBento` (4 Cards):** Todos os 4 cards usam `.liquid-glass-panel` combinados com um *tint* translúcido sutil de Esmeralda Aero no Card 1 (`Meta do Dia`) e Ciano Aero no Card 2 (`PB`). As barras de progresso usam trilho em vidro escuro translúcido (`bg-white/[0.07] border border-white/10`) e preenchimento luminoso com `box-shadow: 0 0 14px currentColor`.
3. **`SessionQuickComposer`:**
   - A caixa de adição de runs, cada *chip* individual de score, os campos `cm/360` e `FOV` (`NumberField`), o card de `LiveRatchetPreview` e o botão principal de salvar (vidro esmeralda bioluminescente translúcido com borda especular brilhante) devem usar camadas Liquid Glass.
4. **`SessionLedger` (Tabela de Histórico):**
   - O container da tabela usa `.liquid-glass-panel`.
   - O cabeçalho da tabela (`thead`) recebe `bg-white/[0.04] backdrop-blur-md border-b border-white/10`.
   - Cada linha de sessão (`tr`) é uma cápsula interativa translúcida no hover (`hover:bg-white/[0.06]`) e, quando expandida (`Collapsible.Panel`), abre uma gaveta interna em `.liquid-glass-control` exibindo os chips das runs daquele dia.
5. **Modais, Dropdowns e Toasts:** Nenhum modal ou menu pode ter fundo cinza/preto sólido (`bg-slate-900` ou `bg-zinc-900` puros estão proibidos); todos devem usar `.liquid-glass-floating`.

---

## 4. Verificação no Antigravity (Gemini 3.8)
- [ ] Inspecionar todos os componentes e remover classes sólidas opacas (`bg-slate-900`, `bg-gray-900`, `bg-zinc-900`, `bg-black`) substituindo-as pelas classes `.liquid-glass-*`.
- [ ] Verificar que todos os painéis possuem o reflexo especular superior (`inset 0 1px 1px oklch(100% 0 0 / 0.32)`).
