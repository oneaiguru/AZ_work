# AI Flow (TypeScript + Web)

This repository now keeps a **single TypeScript implementation** of AI Flow that powers both the CLI and the bundled web UI. All workflow helpers (project scaffolding, branch/step templates, git coordination, diagrams, and time logging) live in `src/project.ts`, while `src/cli.ts` and `src/web.ts` wire those helpers into the CLI and Fastify-powered API that drives the SPA inside `static/`.

## Getting started

```bash
npm install
npm run build
```

From there you can run:

| Target | Command |
| --- | --- |
| CLI | `npm run cli -- <command>` |
| Web UI | `npm run web` (serves `static/` and Fastify API on port 8000 by default) |

Use `npm run dev` to iterate via `ts-node src/index.ts`, or `npm run watch` for a continuous TypeScript build.

## CLI overview

The CLI exposes the same feature set as the legacy Python tool with consistent git-aware workflows:

- `init-project <path>` – scaffold `project.md`, `plan.md`, `journal.md`, `time_log.md`, `branches/`, and the default `A` branch.
- `create-branch <projectPath>` – create branch metadata, optionally link to a parent/from-step, and provision the first step (commits are made via git and branch pointers are fast-forwarded).
- `new-step <projectPath>` – add a new run folder (prompt/context/result/evaluation), commit it to `branch/step` git branches, and update the branch pointer.
- `switch [projectPath]` – checkout a branch or a specific step branch, guarding against dirty git trees.
- `diagram <projectPath>` – dump or save a Mermaid diagram of your branches and runs.
- `time start|stop|report <projectPath>` – log start/stop entries with `coding`, `reading`, or `AI` activity tags and report them by date or range.
- `web` – launch the Fastify server that hosts the SPA and exposes the same operations over REST.

Every step, branch, and diagram command relies on the same git helpers that the original Python version used: git repositories are initialized if missing, cleanliness is verified before destructive actions, and commit metadata falls back to a CLI identity when user config is absent.

## Web UI (SPA)

The SPA in `static/` renders a multi-screen experience. Each screen shares the same project selector, so choosing a project on any screen updates:

1. **Local storage** under the `ai-flow-selected-project` key.
2. **All screen pickers and manual inputs** to keep visible context consistent.
3. The **URL query string** via `?screen=<screen>&project=<path>`, so you can bookmark or share a screen + project combo.

### Screens

- **Overview** – project picker summary with shortcuts to Init, Time, and Projects screens.
- **Init** – create a new project with path, title, and date.
- **Time** – start/stop time logs (activities: `coding`, `reading`, `AI`) and generate per-date reports.
- **Projects** – refreshable catalog of detected projects under the configured `baseDir`.
- **Branch** – create branches, new steps, and switch branches/steps; forms wire to `/api/create-branch`, `/api/new-step`, and `/api/switch`.
- **Diagram** – trigger `/api/diagram` and preview the Mermaid output before saving.

All screens surface log messages so you see status updates and any error details without opening a console.

## REST API surface

The Fastify service mirrors the CLI commands and protects against invalid projects:

- `GET /projects` – list projects that already contain `project.md`.
- `POST /api/init` – create a project.
- `POST /api/create-branch` – same flags as the CLI branch command.
- `POST /api/new-step` – add a step inside a branch (supports `skip_git_check`).
- `POST /api/switch` – checkout branch or step branches.
- `POST /api/diagram` – regenerate the Mermaid graph (optionally save to disk).
- `POST /api/time/:action` (`start`/`stop`) – log time activity.
- `GET /api/time/report` – format log entries filtered by date or range.

Every endpoint requires that the project path sits inside the configured `baseDir`, so the SPA can ask for relative names (and even share them via URL params).

## Testing

```bash
npm test
```

The `test` script compiles the TypeScript sources and runs `node --test tests/cli.test.js tests/web.test.js`, covering:

- Project scaffolding + git-aware branch/step flow via the CLI.
- Time log `start`/`stop`/`report`.
- Fastify endpoints used by the SPA (init, branch, new-step, switch, diagram, time).

Tests rely on temporary directories and clean git repositories, so they are safe to run locally.

## Project layout

- `src/cli.ts` – `commander` CLI wiring for every command, including the `web` subcommand.
- `src/web.ts` – Fastify server, static hosting, and REST bridges to the shared helpers.
- `src/project.ts` – deterministic templates, git helpers, branch/step iterators, Mermaid diagram builder, and time logging helpers.
- `src/git.ts` – thin wrapper around `spawnSync("git", …)` so git is optional in restricted environments.
- `static/` – prebuilt SPA assets that talk to the REST API and mirror CLI actions across screens.
- `tests/` – integration-style tests that exercise both CLI and web code paths.
- `dist/` – compiled output (generated via `npm run build`) used by the `ai-flow` CLI entry point.

## Workflows and tips

- The same CLI logic that handled branch/step management in `ai_flow.py` now lives in TypeScript, so git branches are created/frozen per step and the branch pointer follows the latest run.
- The SPA keeps the selected project in sync between screens, local storage, and URLs, so you can jump back to a view after reopening the app.
- Time tracking logs everything to `time_log.md` inside the project so both CLI and UI share the same source of truth. Activities list: `coding`, `reading`, `AI`.
- When using the SPA, pick or type a project path on any screen before making requests—the API returns a helpful error if no project is selected.
