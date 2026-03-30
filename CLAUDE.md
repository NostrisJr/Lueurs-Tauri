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

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->