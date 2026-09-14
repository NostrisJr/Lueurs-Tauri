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

# Test (Vitest)
pnpm test               # Run frontend tests once (colocated *.test.ts files)
pnpm test:watch         # Watch mode
# Coverage: modules purs uniquement pour l'instant (fileTreeHelpers, formulas,
# wikilinkRewrite, refPaths...) — pas encore de hooks React ni de code Tauri.

# Rust (inside src-tauri/)
cargo check             # Check compilation
cargo test              # Run Rust tests (aspirationnel : aucun #[test] pour l'instant)
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

### Convention des chemins dans le corps des notes

Toute référence à un fichier écrite dans le corps markdown d'une note — image, bloc
audio, wikilink, `ref()` de formule — est **toujours stockée relative à la racine du
vault** (ex: `resources/images/photo.png`, jamais `/Users/.../vault/resources/images/photo.png`).
C'est la seule convention : pas de branche « legacy absolu » à maintenir dans le code
d'affichage.

La résolution en chemin lisible (absolu disque, puis `asset://` via `convertFileSrc`,
ou lecture d'octets sur Android/iOS) se fait **uniquement au rendu**, jamais en
persistant un chemin absolu dans le markdown. Voir `imageNodeView.ts` (images),
`audio-block/config.ts` (audio), `proseToTypst.ts` (export) pour le pattern à suivre :
`isAbsolutePath(src) ? src : `${vaultPath}/${src}``, résolu juste avant affichage/export.

(Ceci est distinct de la convention `PATH_FIELDS`/tree ids dans `vaultIO.ts`, qui
concerne les chemins de nœuds de l'arbre en mémoire — toujours absolus là — et les
champs frontmatter `__Template__`/`__Base__`/`__Children__` sur disque.)

### Thème clair / sombre (obligatoire sur toute nouvelle UI)

Toute fonctionnalité se livre **avec ses deux thèmes**. Le sombre n'est pas une passe de
finition ultérieure : une UI qui n'a été regardée qu'en clair n'est pas terminée.

**Source unique : `src/theme.css`.** Les rôles (`--color-surface`, `--color-ink-3`,
`--color-line-2`, `--color-accent`…) sont déclarés dans `@theme static` avec leurs valeurs
claires, puis redéfinis sous `:root[data-theme="dark"]`. Un composant n'écrit **jamais** de
couleur : ni hex, ni `rgba()`, ni palette Tailwind par défaut (`bg-white`, `text-gray-400`),
ni `var(--color-gray-200)`. Il ne consomme que des rôles (`bg-surface-2`, `text-ink-3`,
`border-line`). `src/shared/lib/themeTokens.test.ts` échoue sinon — son `BACKLOG` doit
rester vide.

- **Une couleur nouvelle → un nouveau rôle dans `theme.css`**, nommé par son usage et non
  par sa valeur, avec ses deux variantes. Jamais un hex dans le composant « en attendant ».
- **Le sombre n'est pas une inversion.** C'est un charbon chaud qui prolonge l'encre
  `#1a1918`, jamais un gris bleuté. Et certains rôles changent de *logique*, pas seulement
  de valeur :
  - voiles : `--color-tint` est un noir translucide en clair, un **blanc** en sombre (un
    voile noir est invisible sur fond sombre) ;
  - `bg-inverse` vaut quasi blanc en sombre : pour une pastille sélectionnée posée sur du
    verre, utiliser `--color-selected` / `--color-on-selected` (un cran au-dessus du fond),
    sinon on obtient un disque éblouissant ;
  - fondu sous une barre flottante : `--bar-fade` / `--bar-fade-2`, jamais les surfaces du
    clair (`from-surface-5`), qui *éclaircissent* en sombre alors qu'un voile doit
    assombrir ;
  - verre (`--glass-*`) : en sombre le remplissage doit être **plus sombre que la page**
    (il creuse le fond) et les reflets blancs tombent très bas, sinon la pill paraît
    allumée ;
  - pastilles et surlignages : même teinte, alpha abaissé ou fond sourd + encre claire —
    reprendre les pastels du clair donne des pavés fluorescents.
- **Pas de modificateur d'opacité Tailwind (`/90`) sur une couleur de thème** : Tailwind v4
  compile en `color-mix(oklab)`, non supporté par certaines WebView Android. Utiliser un
  token qui porte déjà son alpha, passé en `style` si besoin (cf. `FloatingComponent`,
  `FileTreeBottomBar`).
- **Côté JS** (canvas, libs tierces, masques) : `themeColor(token)` relit la valeur
  calculée — à rappeler à chaque changement de thème ; `maskStop(alpha)` pour un
  `mask-image`, qui n'a pas de couleur (seul l'alpha compte) et ne bascule donc pas.
- Le variant `dark:` suit `data-theme`, pas `prefers-color-scheme` : le réglage utilisateur
  doit pouvoir contredire le système. Le réserver à ce qu'un token ne couvre pas (ombres,
  opacités, filtres).

Pièges détaillés et valeurs retenues : `Documentation-technique.md` § Thème clair / sombre.

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

- **Vérifier l'existant avant toute nouvelle fonctionnalité** — avant de proposer une approche ou d'écrire du code, chercher s'il existe déjà du code réutilisable (hooks, composants, utilitaires) qui couvre tout ou partie du besoin. Ex : demande de scroll automatique → vérifier s'il existe déjà des hooks de scroll ; demande d'une UI particulière → vérifier si un composant équivalent existe déjà. But : maximiser la réutilisation et éviter du code redondant qui entre en conflit avec l'existant.
- **Toute mutation de fichier passe par `useFileReferences`** — renommage, déplacement ou suppression d'une note/d'un média/d'un dossier doit systématiquement ré-indexer ou désindexer les références entrantes via ce hook (`propagateRename` pour un renommage/déplacement, `confirmAndCleanupReferences` avant une suppression). Il balaie tout le vault : wikilinks et blocs image/audio du corps, champs path du frontmatter (`__Template__`, `__Base__`, `__Children__`, `__DefaultFolder__`) et `ref()` de formule. Ne jamais écrire un nettoyage à la main sur un seul champ : on laisse alors des références mortes partout ailleurs.
- **Mode sombre systématique** — toute nouvelle UI se développe *et se vérifie* dans les deux thèmes, uniquement via les tokens de `src/theme.css` (cf. § Thème clair / sombre). Ne jamais écrire une couleur en dur en se disant qu'on la tokenisera plus tard : c'est une dette invisible tant qu'on ne bascule pas le thème.
- **Valider avant de coder** — pour toute tâche non triviale, proposer l'approche technique et attendre validation avant d'écrire du code.
- **Tests avant le code** — pour toute nouvelle fonctionnalité, ou toute fonctionnalité existante sur laquelle on retombe et qui n'a pas encore de tests, commencer par mettre en place ses tests avant de coder/modifier le comportement. Objectif : ne plus coder à l'aveugle sans filet de régression.
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