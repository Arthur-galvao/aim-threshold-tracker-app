# UI Declutter & Frontend Code Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the application interface according to Impeccable and Anti-UI-Slop principles by moving utility actions out of the Header into the Settings modal, redesigning SensRandomizerControls into a compact, unified layout, and eliminating over-engineered state and orphaned code identified by the Ponytail Audit.

**Architecture:**
1. In `src/components/Header.tsx`, remove the four data management buttons (Export, Import, Demo, Clear) and replace the unicode gear icon with a crisp SVG icon.
2. In `src/components/SettingsModal.tsx`, add a clean "Gestão de Dados" (Data Management) section housing Export, Import, Load Demo, and Clear Data with appropriate confirmation.
3. In `src/components/randomizer/SensRandomizerControls.tsx`, consolidate redundant states, inline range indicators, and eliminate duplicate telemetry cards into an elegant single-column/compact grid.
4. Remove orphaned `src/lib/links.ts` and consolidate `GUIDE_URL`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite.

**Spec:** Direct user decisions from interactive alignment on 2026-09-23.

## Global Constraints

- Absolute prohibition of emojis in all code, comments, UI text, logs, and documentation.
- Maintain humanized, fluid, and professional copy throughout.
- Retain all existing functionality: data export/import, demo loading, clear data, randomizer parameters, and telemetry.
- Zero TypeScript or Vite build errors (`npm run build`).

---

### Task 1: Consolidate Data Management into SettingsModal & Declutter Header

**Files:**
- Modify: `src/components/SettingsModal.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/i18n.tsx`
- Delete: `src/lib/links.ts`

- [ ] **Step 1: Pass data management handlers to `SettingsModal` in `src/App.tsx`**
  - Pass `onExport={exportData}`, `onImport={importData}`, `onLoadDemo={loadDemoData}`, and `onClear={clearAllData}` into `SettingsModal`.
  - Remove those props from `Header`.

- [ ] **Step 2: Add Data Management section in `src/components/SettingsModal.tsx`**
  - Add a distinct card section at the bottom of the modal: "Gestão de Dados" (`settings.dataSection`).
  - Add buttons for:
    - Exportar Backup (JSON)
    - Importar Backup (JSON file input)
    - Carregar Dados de Demonstração
    - Limpar Todos os Registros (com estilo sutil de atenção/alerta)

- [ ] **Step 3: Strip Header to essential navigation & controls in `src/components/Header.tsx`**
  - Remove buttons: Export, Import, Demo, Clear.
  - Replace unicode `⚙` with a proper inline SVG gear icon.
  - Import `GUIDE_URL` directly or keep single definition.
  - Keep: Logo/Brand, Navigation Tabs (Dashboard / Sens Randomizer), Watcher Status Pill, Guia, Idioma, Tema, Configurações.

- [ ] **Step 4: Remove orphaned file `src/lib/links.ts`**

- [ ] **Step 5: Verify build**
  - Run `npm run build` and ensure zero errors.

---

### Task 2: Simplify and Consolidate SensRandomizerControls

**Files:**
- Modify: `src/components/randomizer/SensRandomizerControls.tsx`

- [ ] **Step 1: Simplify state management**
  - Replace multiple disconnected string states with a clean local state or direct numeric handlers.
  - Remove duplicate range helper text cards (`(parsedBaseSens / parsedMaxCm)...`) that appeared redundantly in both cm and mult sections.

- [ ] **Step 2: Streamline layout**
  - Group parameter controls and driver telemetry into a cohesive, high-density dashboard card without massive empty space or visual noise.
  - Preserve the active sensitivity KPI, status badge, driver detection button, roll button, and toggle button.

- [ ] **Step 3: Verify build and user experience**
  - Run `npm run build` and `npm test` to verify full compilation and test integrity.
