# Aim Threshold Tracker

Aplicativo desktop (Tauri + React + TypeScript + Tailwind CSS) para rastreamento de limiares (thresholds) de mira com base no benchmark Viscose e padrão Escalate.

## Como rodar o projeto

### Pré-requisitos
- **Node.js** (v18+)
- **Rust** (Cargo) instalado para compilar o backend Tauri

### Instalação
```bash
npm install
```

### Executar em Desenvolvimento

- **Aplicativo Desktop (Tauri):**
  ```bash
  npm run tauri:dev
  ```

- **Apenas Frontend Web (Vite):**
  ```bash
  npm run dev
  ```

### Build de Produção
```bash
# Build desktop
npm run tauri:build

# Build web estático
npm run build
```

## Estrutura do Projeto
- `src/` — Interface em React 19, Tailwind CSS e Chart.js
  - `components/` — Componentes da UI (Header, TaskSelector, MetricsCards, ProgressChart, HistoryTable, etc.)
  - `hooks/` — Hooks customizados (`useAppData`, `useKovaakWatcher`)
  - `lib/` — Lógica de cálculo de threshold, i18n (PT/EN), temas e integração Tauri
- `src-tauri/` — Backend em Rust (watcher de logs do KovaaK's, persistência e parser de CSV)
