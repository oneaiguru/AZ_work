# AI Flow CLI (TypeScript)

This repository now houses the TypeScript-based implementation of AI Flow. The Python CLI has been retired in favour of `src/cli.ts`, and the web UI is implemented on Node.js/Fastify + Vue 3 inside `web/`. Supporting documentation lives under `docs/`.

## CLI quick start

```bash
npm install
npm run build
npm start -- <command>
```

- `npm run dev` runs the CLI through `ts-node` and is ideal during development.
- `npm run watch` rebuilds as files change.
- The CLI replicates the original workflows: `init-project`, `create-branch`, `new-step`, `diagram`, `time`, etc. See `src/cli.ts` for the implementation.

## Testing

```bash
npm test
```

The test suite rebuilds the CLI and exercises `init-project` plus the `time` subcommands inside temporary directories to ensure the core scaffolding and logging workflows stay operational.

## Web UI

```bash
cd web
npm install
npm run build
npm start
```

The Fastify server (`web/src/index.ts`) proxies JSON requests to `node ../dist/cli.js` and serves the Vue SPA (`web/templates/index.html`, `web/static`). The SPA fetches `/config`, `/projects`, and `/api/*` endpoints to drive the CLI without page reloads.

## Docs

All supplementary documents—including AGENTS, planning templates, journals, and the legacy README—live under `docs/`. Keep the README there if you need to reference the previous Python instructions or metadata.

## Development notes

- The CLI depends on `commander` and compiles to `dist/cli.js`.
- Use `npm run dev` (ts-node) when iterating on `src/cli.ts`.
- The TypeScript web server also ships with a build step (`web/npm run build`) and produces `web/dist/index.js`.
