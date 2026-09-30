# Likeable — AI App Builder (Lovable end to end)

An AI coding agent that builds React apps from a natural-language prompt, the same way Lovable/v0/bolt.new work: describe what you want, the agent plans, writes code, installs dependencies, and runs it live in a cloud sandbox — with the results streamed to you in real time.

## Architecture

```
User prompt → LangGraph agent (planner → tool-calling agent ⇄ tools)
                                              ↓
                               E2B cloud sandbox (React + Vite + Tailwind)
                                              ↓
              File writes persisted to Postgres ← WebSocket → Frontend (chat, editor, live preview)
```

## Stack

| Component | Technology |
|---|---|
| Agent orchestration | LangGraph (planner node + tool-calling agent node) |
| LLM | Groq (OpenAI-compatible endpoint, free tier) |
| Code execution | E2B cloud sandboxes |
| Web search tool | Exa (optional) |
| Database | PostgreSQL + Prisma |
| Realtime | WebSocket (streams agent progress, tool calls, file events) |
| API | Express |
| Frontend | Next.js + React Query + Monaco Editor |

## What the agent can do

The agent has real tools, not just chat: `write`, `write-multiple-files`, `read`, `delete-file`, `rename-file`, `list-directories`, `add-dependency`, `execute-command`, `test-build`, `start_dev_server`, and `search` (web search). It plans first (3-6 steps), then executes with tool calls in a loop until the app is built and the dev server is running, streaming every step back to the UI live.

## Project structure

```
apps/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express app + HTTP/WS server
│   │   ├── ws/server.ts          # WebSocket server: auth, start_agent handler
│   │   ├── orchestration/graph.ts # LangGraph agent (planner + tool-calling loop)
│   │   ├── tools/tool.ts         # Agent tools (file ops, shell, search) — emits progress events
│   │   ├── services/sandbox.service.ts # E2B sandbox lifecycle
│   │   ├── controllers/          # auth, project (CRUD + files + sandbox)
│   │   ├── routes/
│   │   ├── middlewares/auth.middleware.ts
│   │   ├── prompts/              # system prompt + planning prompt
│   │   └── config/llm.ts         # Groq LLM config
│   ├── e2b/                      # E2B sandbox template definition + build scripts
│   └── prisma/schema.prisma
└── frontend/
    ├── app/
    │   ├── (home)/sign-in, sign-up
    │   ├── projects/[id]/page.tsx  # Main workspace: chat + file explorer + editor + live preview
    │   ├── components/            # ChatSection, EditorSection, FileExplorer, ProjectInfo, ...
    │   └── hooks/                 # useWebSocket, useAgentSession, useProjectQueries
```

## Quick start

### Prerequisites

- Node.js 18+ and pnpm (`corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- Docker (for local Postgres)
- Free accounts: [Groq](https://console.groq.com/keys) (LLM), [E2B](https://e2b.dev) (sandbox execution). Optional: [Exa](https://exa.ai) (web search).

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start Postgres and run migrations

```bash
docker compose up -d postgres
cd apps/backend
cp .env.example .env
```

Fill in `.env`:
- `JWT_SECRET` — generate with `openssl rand -hex 32`
- `GROQ_API_KEY` — from [console.groq.com/keys](https://console.groq.com/keys)
- `E2B_API_KEY` — from [e2b.dev](https://e2b.dev)
- `EXASEARCH_API_KEY` — optional, from [exa.ai](https://exa.ai)

Then apply migrations:
```bash
npx prisma migrate deploy
```

### 3. Build the E2B sandbox template (one-time)

The agent needs a custom sandbox image with React/Vite/Tailwind pre-installed:
```bash
pnpm --filter agent build-template
```
This builds and aliases it as `likeable-react-base` (matches the default in `.env.example` — don't use `build-template-dev`, that uses a different alias).

### 4. Start the backend

```bash
cd apps/backend
pnpm dev
```
Runs on `http://localhost:3010` (both the REST API and the WebSocket server share this port).

### 5. Start the frontend

```bash
cd apps/frontend
pnpm dev
```
Runs on `http://localhost:3000`.

### 6. Use it

1. Go to `http://localhost:3000/sign-up`, create an account
2. Create a project with a prompt like "Build a todo app with categories"
3. Watch the agent plan, write files, install dependencies, and start the dev server live in the chat panel
4. Click **Preview** in the top bar once the sandbox is ready to see the running app

## Verified working (without live LLM/sandbox calls, which need your own API keys)

- Backend compiles cleanly (`pnpm --filter agent build`)
- Frontend compiles and production-builds cleanly (`pnpm --filter frontend build`)
- Auth: register (bcrypt-hashed passwords) + login tested against real Postgres
- Project CRUD, file tree, and sandbox info REST endpoints tested end-to-end
- WebSocket auth tested: valid token connects and receives `{e: "connected"}`; missing/invalid token closes with `4001`; missing project ID closes with `4000`; a project that isn't yours closes with `4003`

## Notable fixes made to get this running

- **No server entry point existed** — `index.ts` was a hardcoded test script that ran "Create a Todo application" on every boot, with no real routes or WebSocket server. Rewrote it as a real Express + WS server.
- **The core feature — the workflow/agent execution loop streaming to the UI — didn't exist.** The frontend had a fully-built WebSocket client and event formatter (`useWebSocket`, `useAgentSession`) expecting specific events (`stage_update`, `plan_generated`, `tool_started`, `file_created`, etc.), but nothing on the backend ever sent them. Built the WebSocket server and threaded an `emit` callback through the LangGraph nodes and every tool.
- **`system_message.ts` (the agent's core instructions — sandbox layout, available tools, design rules) was never wired into the graph at all.** The agent was calling the LLM with zero system prompt.
- **Tool event names didn't match what the frontend expects** — tools were named `write_file`, `read_file` (snake_case) while the frontend's event formatter only recognizes kebab-case names like `write`, `read`. Every tool event would have been silently dropped by the UI.
- **Missing REST endpoints** the frontend already called: file tree, file content, and sandbox create/get/delete — none existed on the backend.
- **`@langchain/openai` and `@langchain/core` version mismatch** — the declared version ranges resolved to incompatible versions, causing an `ERR_PACKAGE_PATH_NOT_EXPORTED` crash on boot. Pinned to compatible versions.
- **Paid LLM by default** — was hardcoded to OpenRouter's `gpt-4o-mini`. Swapped to Groq (OpenAI-compatible endpoint, free tier) since Groq exposes the same interface `ChatOpenAI` already used.
- Fixed a typo (`numResuls` → `numResults`) and made the Exa search tool degrade gracefully instead of crashing when `EXASEARCH_API_KEY` is unset.
- `sandboxUrl` was never actually persisted to the database despite being a schema field.
- Removed unused dependencies (`@langchain/exa`, `@langchain/google-genai` — neither was imported anywhere) and two stray `package-lock.json` files conflicting with the pnpm workspace.
- Added `dev`/`build`/`start` scripts to the backend (none existed).
- Fixed a Prisma 7 + strict-TypeScript quirk (`exactOptionalPropertyTypes` + `declaration: true` combination) that broke `tsc` on the generated Prisma client.

## License

MIT
