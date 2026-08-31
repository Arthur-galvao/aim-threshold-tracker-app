# Aim Threshold Tracker

Aplicativo desktop (Tauri + React + TypeScript + Tailwind CSS) para rastreamento de limiares (thresholds) de mira com base no benchmark Viscose e padrão Escalate.

## Como rodar o projeto

### Pré-requisitos
- **Node.js** (v18+)
- **Rust** (Cargo) instalado para compilar o backend Tauri
- No Windows, também é necessário o **Microsoft C++ Build Tools**

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

O `npm run tauri:build` gera:
- `src-tauri/target/release/aim-threshold-tracker.exe` — o executável puro
- `src-tauri/target/release/bundle/nsis/Aim Threshold Tracker_1.0.0_x64-setup.exe` — o instalador (é esse que você distribui; instala sem precisar de admin)

### Gerando o `.exe` via GitHub Actions

O projeto já vem com um workflow (`.github/workflows/release.yml`) que builda o instalador automaticamente numa máquina Windows na nuvem, sem você precisar ter Windows localmente.

Pra disparar um build, cria uma tag de versão e dá push nela:
```bash
git tag v1.0.0
git push origin v1.0.0
```

O GitHub compila o app e cria um **Release em rascunho** no repositório, com o `.exe` já anexado. Basta revisar em **Releases** e publicar quando quiser deixar público.

Também dá pra disparar manualmente, sem tag: na aba **Actions** do repo, escolha o workflow "Release" e clique em "Run workflow".

## Estrutura do Projeto
- `src/` — Interface em React 19, Tailwind CSS e Chart.js
  - `components/` — Componentes da UI (Header, TaskSelector, MetricsCards, ProgressChart, HistoryTable, etc.)
  - `hooks/` — Hooks customizados (`useAppData`, `useKovaakWatcher`)
  - `lib/` — Lógica de cálculo de threshold, i18n (PT/EN), temas e integração Tauri
- `src-tauri/` — Backend em Rust (watcher de logs do KovaaK's, persistência e parser de CSV)
- `.github/workflows/` — Workflow de build e release automático do instalador Windows

## Licença

Este projeto é distribuído sob a licença MIT — veja o arquivo [LICENSE](./LICENSE) para detalhes. Contribuições são bem-vindas.
