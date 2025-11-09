# LangChain NestJS Agent

This package exposes a simple [NestJS](https://nestjs.com/) HTTP service that runs a [LangChain](https://python.langchain.com/docs/get_started/introduction) agent backed by a locally hosted YandexGPT model served through [Ollama](https://ollama.com/). The `/agent/run` endpoint accepts a prompt (and optional context object) and responds with the agent output alongside its intermediate reasoning steps.

## Features

- ✅ NestJS application with validation, dependency injection, and modular structure.
- ✅ LangChain agent executor configured with a time lookup and optional context lookup tool.
- ✅ Compatible with lightweight YandexGPT models distributed for Ollama.
- ✅ Extensive Vitest coverage with strict thresholds and isolated unit tests.

## Prerequisites

- Node.js 18+
- npm 9+
- [Ollama](https://ollama.com/) running locally
- A YandexGPT model pulled into Ollama (for example `ollama pull yandex-gpt-lite`)

## Getting Started

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

Run the development server (uses `ts-node`):

```bash
npm run start:dev
```

Alternatively, run the compiled server:

```bash
npm run build
npm start
```

The application listens on port `3000` by default. Configure the following environment variables as needed:

- `OLLAMA_BASE_URL` (optional): Base URL for your Ollama instance. Defaults to `http://localhost:11434`.
- `OLLAMA_MODEL` (optional): Model identifier to run via Ollama. Defaults to `yandex-gpt-lite`.
- `OLLAMA_TEMPERATURE` (optional): Sampling temperature passed to the model. Defaults to `0`.
- `PORT` (optional): Port number for the HTTP server.

### Example Request

```bash
curl -X POST http://localhost:3000/agent/run \
  -H "Content-Type: application/json" \
  -d '{
        "prompt": "Что сейчас за время и как называется проект?",
        "context": { "project": "LangChain Nest Agent" }
      }'
```

## Testing

Unit tests run with [Vitest](https://vitest.dev/) and enforce high coverage thresholds:

```bash
npm test
```

Coverage reports are written to the `coverage/` directory and printed to the console.

## Project Structure

```
agent/
├── src/
│   ├── controller/        # HTTP controller and request handling
│   ├── dto/               # Request DTO definitions with validation
│   ├── services/          # Agent execution logic and tool factory
│   ├── app.module.ts      # NestJS root module
│   └── main.ts            # Application bootstrap
├── vitest.config.ts       # Vitest configuration with strict coverage thresholds
├── vitest.setup.ts        # Shared mocks for LangChain dependencies in tests
├── package.json           # Scripts and dependencies
├── tsconfig*.json         # TypeScript build configurations
└── README.md              # This documentation
```

## Troubleshooting

- Ollama not running: Start the Ollama daemon (`ollama serve`) so the agent can reach the local model endpoint.
- Invalid `OLLAMA_TEMPERATURE`: Provide a numeric value (for example `0.3`) or omit the variable to fall back to the default.
- LangChain or NestJS dependency issues: Reinstall dependencies with `npm install` and ensure you're using Node.js 18 or newer.

Happy prompting!
