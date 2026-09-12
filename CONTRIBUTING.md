# Contributing

[English](CONTRIBUTING.md) | [Português (Brasil)](CONTRIBUTING.pt-BR.md)

Thank you for your interest in contributing to Aim Threshold Tracker.

## Running the project locally

Prerequisites:
- Node.js 18+
- Rust (via [rustup](https://rustup.rs))
- On Windows, Microsoft C++ Build Tools

```bash
npm install
npm run tauri:dev    # desktop app with hot reload
npm run dev           # frontend only, in browser (without Tauri backend features)
```

## Local installer build

```bash
npm run tauri:build
```

The installer will be generated in `src-tauri/target/release/bundle/nsis/`.

## Publishing a new release

The repository includes a GitHub Actions workflow (`.github/workflows/release.yml`) that automatically builds the Windows installer and creates a draft Release.

```bash
git tag v1.0.1
git push origin v1.0.1
```

After pushing the tag, review the draft release created under the Releases tab and publish it.

## Project structure

- `src/` — UI frontend (React, Tailwind, Chart.js)
  - `components/` — UI components
  - `hooks/` — custom hooks (`useAppData`, `useKovaakWatcher`, `useSensRandomizer`)
  - `lib/` — threshold algorithms, i18n, themes, and Tauri bridge
- `src-tauri/` — Rust backend (KovaaK's folder detection & file watcher, local persistence, CSV parsing, Raw Accel configuration writer)
- `.github/workflows/` — automated installer build and release pipeline

## Submitting changes

1. Fork the repository
2. Create a branch from `main`
3. Open a Pull Request describing your changes
