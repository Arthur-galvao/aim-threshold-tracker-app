# Contribuindo

Obrigado pelo interesse em contribuir com o Aim Threshold Tracker.

## Rodando o projeto localmente

Pré-requisitos:
- Node.js 18+
- Rust (via [rustup](https://rustup.rs))
- No Windows, o Microsoft C++ Build Tools

```bash
npm install
npm run tauri:dev    # app desktop, com hot reload
npm run dev           # só o frontend, no navegador (sem os recursos do Tauri)
```

## Build local do instalador

```bash
npm run tauri:build
```

O instalador é gerado em `src-tauri/target/release/bundle/nsis/`.

## Publicando uma nova versão

O repositório tem um workflow do GitHub Actions (`.github/workflows/release.yml`) que builda o instalador Windows automaticamente e cria um Release em rascunho.

```bash
git tag v1.0.1
git push origin v1.0.1
```

Depois é só revisar o rascunho gerado na aba Releases e publicar.

## Estrutura do projeto

- `src/` — interface (React, Tailwind, Chart.js)
  - `components/` — componentes de UI
  - `hooks/` — hooks customizados (`useAppData`, `useKovaakWatcher`)
  - `lib/` — cálculo de threshold, i18n, temas e ponte com o Tauri
- `src-tauri/` — backend Rust (detecção e watcher da pasta do KovaaK's, persistência local, parser de CSV)
- `.github/workflows/` — build e release automático do instalador

## Enviando mudanças

1. Faça um fork do repositório
2. Crie uma branch a partir da `main`
3. Abra um Pull Request descrevendo a mudança
