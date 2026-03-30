# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm tauri dev          # Full Tauri app (Rust + React, hot-reload)
pnpm dev                # Frontend only (Vite dev server)

# Build
pnpm build              # TypeScript check + Vite production build
pnpm tauri build        # Full desktop app binary

# Lint/Format (Biome)
pnpm biome check src/   # Lint
pnpm biome format src/  # Format

# Rust (inside src-tauri/)
cargo check             # Check compilation
cargo test              # Run Rust tests
```

## Architecture Overview

Lueurs is a personal Markdown note-taking desktop app (Tauri 2 + React). Notes are `.md` files with YAML frontmatter stored in a user-selected vault folder on disk.

### State Management (Jotai)

All global state lives in `src/lib/atoms.ts`:
- `treeAtom` — the full hierarchical file tree (source of truth for note data)
- `activeNoteIdAtom` — currently open note path
- `activeNoteAtom` — derived atom: current note object from tree
- `folderPathAtom` — selected vault path (persisted to localStorage)
- `kanbanCardsAtom` — derived Kanban state computed from note children

### Data Flow

```
Vault folder → useFileTree → treeAtom → activeNoteAtom → Editor
     ↑                                                       |
     └──── FS watcher (debounced) ←── writeTextFile ─────────┘
```

Key behavior: edits update state immediately, then write to disk after 1000ms debounce. `writingPathsRegistry` (in `vaultIO.ts`) tracks in-progress writes so the FS watcher ignores our own changes.

### Frontmatter System Fields

System properties use double-underscore prefixes and are stored in YAML frontmatter:

| Field | Purpose |
|-------|---------|
| `__Type__` | Note type: `__note__`, `__template__`, `__base__`, `__folder__` |
| `__Template__` | Templates constraining this note's properties |
| `__Base__` | Bases this note belongs to (auto-maintained) |
| `__Children__` | Child notes of a base (auto-maintained) |
| `__View__` | Base view mode: `"default"`, `"kanban"`, `"table"` |
| `__KanbanKey__` | Property used as Kanban column discriminator |
| `__KanbanColumns__` | Kanban column definitions `[{ id, label }]` |
| `__TableColumns__` | Table column widths |

### Template Propagation

When a template's properties change, `useTemplateSync` collects affected note paths and calls the Rust command `propagate_template_change`. Rust processes files in parallel (Tokio) and writes changes directly to disk. Frontend reloads the tree after completion.

### Frontend-Backend (Tauri Commands)

Defined in `src-tauri/src/lib.rs`:
- `allow_vault_path(vault_path)` — register vault folder in Tauri FS scope
- `copy_resource_to_vault(src, vault, sub_dir, filename)` — copy media into vault
- `propagate_template_change(affected_paths, change)` — bulk frontmatter update in parallel

### Base Views (Table / Kanban)

Base notes aggregate child notes. The `BaseView` component (`src/components/BaseView/`) renders them in Table or Kanban mode. Kanban drag-and-drop (`@dnd-kit`) updates the dragged card's frontmatter property directly.

### Key Hooks

- `useFileTree()` — load tree, watch FS, create/delete/rename notes
- `useNote()` — note selection, body/frontmatter change handling
- `useFrontmatter()` — frontmatter edit logic, template cleanup on rename
- `useTemplateSync()` — invoke Rust for template propagation
- `useKanban()` — Kanban cards/columns state and drag handlers

### Notable Utilities

- `src/lib/fileTreeHelpers.ts` — pure tree mutations and frontmatter parse/serialize
- `src/lib/vaultIO.ts` — all Tauri FS read/write operations, `writingPathsRegistry`
- `src/lib/atoms.ts` — all Jotai atoms

## Language Note

Variable names, comments, and UI strings are in French throughout the codebase.

## Collaboration Guidelines

- **Valider avant de coder** — pour toute tâche non triviale, proposer l'approche technique et attendre validation avant d'écrire du code.
- **Pas de patch sur patch** — quand une solution ne fonctionne pas, retirer le code ajouté avant d'essayer autre chose. Ne jamais empiler des correctifs.
- **Commentaires FR, minimalistes** — uniquement pour les subtilités, points d'attention et TODO. Pas de commentaires qui paraphrasent le code.
- **Logging permanent** — utiliser `src/lib/logger.ts` avec des messages précis et contextualisés, destinés à rester dans le code.
- **Fichiers courts** — factoriser en sous-composants ou sous-fonctions dans des fichiers séparés dès qu'un fichier devient trop long.
- **Mettre à jour la documentation** dès qu'une fonctionnalité est validée (code complet, débogué, et passage à autre chose demandé). Deux fichiers à maintenir :
  - `Documentation.md` — documentation **utilisateur** : comportements, fonctionnalités, pas de détails d'implémentation.
  - `Documentation-technique.md` — documentation **technique** : choix d'architecture, subtilités d'implémentation, bugs contournés, raisons des décisions non-évidentes.
