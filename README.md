# Lueurs

Application de prise de notes Markdown personnelle (Tauri 2 + React).

> Outil taillé pour un usage spécifique, pas vocation à être généraliste.

## Prérequis

- [Node.js](https://nodejs.org/) + [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) (via rustup)
- Dépendances système Tauri : [guide officiel](https://tauri.app/start/prerequisites/)

## Installation & lancement

```bash
pnpm install
pnpm tauri dev
```

> Les dépendances Rust sont gérées via `src-tauri/Cargo.toml`, pas besoin de `cargo install` séparé.

## Autres commandes

```bash
pnpm dev              # Frontend seul (Vite)
pnpm build            # Build de production (TS check + Vite)
pnpm macos:build      # Binaire macOS (voir ci-dessous)
pnpm biome check src/ # Lint
```