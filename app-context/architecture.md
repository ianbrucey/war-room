# AionUi Architecture Overview

## High-Level Structure

AionUi is a hybrid application that runs as both a desktop application (Electron) and a web server (Express). It is designed to provide a modern chat interface for various AI agents.

**Type:** Monolithic codebase with modular internal structure.
**Frontend:** React 19, UnoCSS, Arco Design.
**Backend:** Node.js (Electron Main Process / Express Server).

## Key Components

### 1. Core Logic (`src/process`)

This directory appears to contain the central business logic of the application.

- **Database:** `src/process/database` handles persistence using SQLite (`better-sqlite3`).
- **Services:** `src/process/services` likely contains domain logic.
- **Bridge:** `src/process/bridge` manages communication between the core logic and the UI (IPC for Electron, likely adapted for Web).
- **Worker Management:** `src/process/WorkerManage.ts` orchestrates background workers.

### 2. Interfaces

- **Electron (Desktop):** Entry point `src/index.ts`. Uses `src/preload.ts` to expose APIs to the renderer.
- **WebUI (Server):** `src/webserver` implements an Express server.
  - **Routes:** `src/webserver/routes` defines API endpoints.
  - **Auth:** `src/webserver/auth` handles authentication (JWT).
  - **WebSocket:** `src/webserver/websocket` for real-time updates.

### 3. Frontend (`src/renderer`)

A React application that serves as the user interface. It likely communicates with the backend via a unified bridge abstraction that handles both IPC (Electron) and HTTP/WS (Web) transports.

### 4. Background Workers (`src/worker`)

Heavy tasks and AI agent interactions are offloaded to separate processes.

- **Forked Processes:** The `fork` directory and files like `gemini.ts`, `codex.ts` suggest usage of Node.js `child_process.fork`.
- **Agent Specifics:** Dedicated workers for Gemini, Codex, ACP, etc.

## Persistence

- **Database:** SQLite via `better-sqlite3`.
- **Location:** `{userData}/config/aionui.db`.
- **Architecture:**
  - **Main Process:** Direct access using `better-sqlite3` in WAL mode.
  - **Renderer:** Access via IPC Bridge.
  - **Schema Management:** Custom migration system (`src/process/database/migrations.ts`) with versioning.
- **File Storage:** Images and large files are stored in the file system (`{userData}/data/images/`), not the database.
- **ORM:** Custom wrapper in `src/process/database/index.ts`, not a standard ORM. Uses raw SQL with type safety from shared TypeScript interfaces.

## Queues & Async Processing

- **Mechanism:** Custom worker management via `src/process/WorkerManage.ts` and `src/worker`.
- **Type:** In-process (forked) Node.js processes. No external message broker (like Redis) is apparent.

## Frameworks & Libraries

- **UI:** React, Arco Design, UnoCSS, React Router.
- **Backend:** Electron, Express, Socket.io (or `ws`).
- **AI/LLM:** `@google/genai`, `@modelcontextprotocol/sdk`, OpenAI SDK.
- **Utils:** `zod` (validation), `swr` (data fetching), `i18next` (localization).

## Infrastructure

- **Build:** Electron Forge, Webpack.
- **Containerization:** No `Dockerfile` found in root (yet).
- **CI/CD:** GitHub Actions (implied by `.github` directory).

## Data Flow

1. **UI Action:** User interacts with React frontend.
2. **Bridge:** Request sent via Bridge (IPC in Electron, HTTP/WS in Web).
3. **Process Layer:** Core logic receives request.
4. **Worker:** If complex/long-running (e.g., AI inference), task delegated to `src/worker` process.
5. **Persistence:** State updated in SQLite via `src/process/database`.
6. **Response:** Result sent back through Bridge to UI.
