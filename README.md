# Curdiff

Curdiff is a **Cursor focused fork** of [cpojer/codiff](https://github.com/cpojer/codiff) a beautiful, minimal, local diff viewer for reviewing staged and unstaged Git changes before committing. It is not the same as upstream releases. LLM features use the [Cursor SDK](https://cursor.com/docs/sdk/typescript), and you install from source (see below).

## What's different in this fork

- **Open File in Cursor:** Changed files open in **Cursor** by default (VS Code remains a fallback). Override with `CODIFF_EDITOR`.
- **Cursor SDK:** Replaced Codex CLI with `@cursor/sdk` for walkthroughs and inline **Ask**. Requires `CURSOR_API_KEY`; Codex / OpenAI model menu removed.
- **Model pickers + manual walkthrough:**
  - Searchable model and SDK parameter selectors for Ask and walkthrough; `-w` opens the walkthrough tab only
  - Changed to manually start walkthrough; pick a model and click **Start walkthrough**.
- **Conceptual walkthrough grouping:** Walkthrough is grouped by inferred concept instead of strategy/code review style more similar to Devin AI's AI Sort.

## Why Codiff

- **Fast Local Reviews:** See changes in any Git repository to review code before committing.
- **LLM Walkthroughs:** Run `codiff -w` to open the walkthrough tab, pick a model, and get a concept-grouped tour of the diff.
- **Inline Review Comments:** Comment directly on changed lines and copy all review comments as Markdown for follow-ups.

## Install

This fork is installed **from source**. Upstream [Homebrew](https://github.com/nkzw-tech/codiff) and [GitHub Releases](https://github.com/nkzw-tech/codiff/releases) will not include these Cursor SDK changes until a fork release is published.

Requires **Node ≥ 23** and **pnpm ≥ 11**.

### Setup

With [mise](https://mise.jdx.dev) (recommended):

```bash
git clone https://github.com/nkzw-tech/codiff.git
cd codiff
mise trust
mise install        # installs node + pnpm from mise.toml
mise run install    # pnpm install
mise run build      # build renderer to dist/
```

Without mise: ensure Node 23+ and pnpm 11+ are on your PATH, then run `pnpm install` and `pnpm exec vp build`.

If mise prints `gpg not found, skipping verification`, that is harmless — it skips optional signature checks. Install `gnupg` via Homebrew to silence it.

### Run Codiff

From the repo (no global install):

```bash
mise run codiff -- /path/to/repository
```

Or install the `codiff` CLI globally:

```bash
pnpm link --global
codiff /path/to/repository
```

### Cursor API key (required for walkthrough + Ask)

```bash
export CURSOR_API_KEY="cursor_..."   # from Cursor Dashboard → Integrations
codiff -w
```

Get an API key from [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations). For local development, add `CURSOR_API_KEY` to `.env` in the repo root — mise loads it for `mise run` tasks.

### Optional: macOS app bundle

```bash
mise run build
pnpm make:mac
```

The `.app` is written under `out/make/`. Open it from Finder, then use **Codiff → Install Terminal Helper** to add the `codiff` command to your shell.

## Command Line

```bash
codiff
```

Run it from any Git repository, or pass a path:

```bash
codiff /path/to/repository
```

Review a specific commit:

```bash
codiff a1b2c3d
```

Open the walkthrough tab (start manually in the sidebar):

```bash
codiff -w
codiff -w a1b2c3d
```

Show all available options:

```bash
codiff --help
```

Launching Codiff in multiple repositories opens a separate native window for each repository.

## Command Bar

Open the command bar with Cmd+Shift+P on macOS, or
Ctrl+Shift+P on other platforms. Type to filter commands, use
Up/Down to move through results, press Enter to run the selected
command, and press Esc to close it.

The command bar includes actions for common review workflows:

- Focus File Filter
- Find in Diffs
- Show File Tree, Show History, and Show Walkthrough
- Copy Review Comments
- Copy Review Comments and Close
- Toggle Viewed for the currently selected file
- Open the currently selected file in your editor
  Files open in **Cursor** by default. Override with `CODIFF_EDITOR='code -g "{file}"'` (or any editor command).
- Toggle Sidebar
- Reload Window

## Configuration

Codiff reads configuration from `~/.codiff/codiff.jsonc`. Open `Codiff > Open Config File...` to
create the file with defaults and open it in your editor. The file supports JSONC comments and
trailing commas, includes a JSON schema reference for editor completion, and is watched while Codiff
is running so changes apply to open windows.

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/nkzw-tech/codiff/main/src/config/codiff-config.schema.json",
  "settings": {
    "copyCommentsOnClose": false,
    "lastRepositoryPath": "",
    "askModel": "composer-2.5",
    "walkthroughModel": "composer-2.5",
    "showWhitespace": false,
    "theme": "system",
  },
  "keymap": {
    "commandBar": "Mod+Shift+p",
    "diffSearch": "Mod+f",
    "fileFilter": "Mod+p",
    "nextSearchMatch": "Enter",
    "prevSearchMatch": "Shift+Enter",
    "closeSearch": "Escape",
    "submitComment": "Mod+Enter",
    "discardComment": "Escape",
    "toggleSidebar": "Mod+b",
  },
}
```

Use `Mod` for Cmd on macOS and Ctrl on other platforms. Shortcut strings can
combine `Mod`, `Ctrl`, `Alt`, `Shift`, or `Meta` with a key, for example `Mod+Shift+p` or
`Alt+Enter`.

Model selections from the Ask and walkthrough pickers are persisted as `askModel`, `askModelParams`,
`walkthroughModel`, and `walkthroughModelParams`.

## Cursor integration

Codiff uses the [Cursor SDK](https://cursor.com/docs/sdk/typescript) for walkthroughs and inline review **Ask**. Set `CURSOR_API_KEY` before launching:

```bash
export CURSOR_API_KEY="cursor_..."   # from Cursor Dashboard → Integrations
codiff -w
```

When launching from Terminal, `bin/codiff.js` passes your shell environment to Electron. When opening the packaged app from Finder or Dock, Codiff resolves your login shell environment (the same approach VS Code uses), so `export CURSOR_API_KEY=...` in `.zshrc` or `.zprofile` is enough. Set `CODIFF_DISABLE_SHELL_ENV=1` to turn that off.

## Development

Requires **Node ≥ 23** and **pnpm ≥ 11**.

### Setup

With [mise](https://mise.jdx.dev) (recommended):

```bash
mise trust          # once per clone
mise install        # installs node + pnpm from mise.toml
mise run install    # pnpm install
```

Without mise: `pnpm install`.

**What is `vp`?** The `vp` command is the CLI from the local **vite-plus** npm package (`@voidzero-dev/vite-plus`). It is free, installed as a devDependency — not a separate paid tool. After `pnpm install`, run it as `pnpm exec vp …` or use the `mise run` tasks below.

If mise prints `gpg not found, skipping verification`, that is harmless — it skips optional signature checks. Install `gnupg` via Homebrew to silence it.

### Day-to-day editing (hot reload)

Use **two terminals** while implementing changes:

```bash
# Terminal 1 — leave running (Vite HMR for src/)
mise run dev

# Terminal 2 — restart after electron/ changes
mise run electron
```

Open a specific repo:

```bash
mise run codiff -- /path/to/repo
mise run codiff -- /path/to/repo -w   # walkthrough sidebar tab on launch
```

| Editing                                  | Action                                    |
| ---------------------------------------- | ----------------------------------------- |
| `src/` (React, CSS, components)          | Save — UI hot-reloads automatically       |
| `electron/` (main process, IPC, preload) | Quit Electron → `mise run electron` again |
| New npm dependency                       | `mise run install` → restart Electron     |

Add `CURSOR_API_KEY` to `.env` in the repo root (gitignored) for walkthrough and Ask during development. Mise loads it automatically for `mise run` tasks.

### Production-like run (no hot reload)

```bash
mise run build
mise run codiff -- /path/to/repo
```

### Checks

```bash
mise run check      # lint, format, typecheck
mise run test       # unit tests
mise run verify     # check + test + build
```

Equivalent without mise: `pnpm exec vp check --fix`, `pnpm test`, `pnpm exec vp build`.

See `[mise.toml](mise.toml)` for all tasks.
