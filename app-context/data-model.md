# Data Model & Database Architecture

## Overview

AionUi uses a local, embedded database strategy designed for desktop performance and simplicity.

- **Engine:** SQLite (via `better-sqlite3`)
- **Mode:** WAL (Write-Ahead Logging) for concurrency
- **Location:** `{userData}/config/aionui.db`
- **ORM:** None (Raw SQL with TypeScript wrappers)

## Schema

### 1. Users (`users`)

Stores user account and authentication details.

| Column            | Type        | Description                               |
| :---------------- | :---------- | :---------------------------------------- |
| `id`            | `TEXT`    | Primary Key (e.g.,`user_1738012345678`) |
| `username`      | `TEXT`    | Unique identifier                         |
| `password_hash` | `TEXT`    | bcrypt hash                               |
| `jwt_secret`    | `TEXT`    | Per-user secret for token signing         |
| `last_login`    | `INTEGER` | Timestamp                                 |

### 2. Conversations (`conversations`)

Represents a chat thread with a specific agent/model.

| Column      | Type     | Description                            |
| :---------- | :------- | :------------------------------------- |
| `id`      | `TEXT` | Primary Key                            |
| `user_id` | `TEXT` | Foreign Key ->`users.id`             |
| `type`    | `TEXT` | `gemini`, `acp`, `codex`         |
| `model`   | `TEXT` | JSON: Model configuration              |
| `extra`   | `TEXT` | JSON: Additional metadata              |
| `status`  | `TEXT` | `pending`, `running`, `finished` |

### 3. Messages (`messages`)

Individual messages within a conversation.

| Column              | Type     | Description                        |
| :------------------ | :------- | :--------------------------------- |
| `id`              | `TEXT` | Primary Key                        |
| `conversation_id` | `TEXT` | Foreign Key ->`conversations.id` |
| `content`         | `TEXT` | JSON: Message content structure    |
| `type`            | `TEXT` | Message type identifier            |
| `position`        | `TEXT` | UI alignment (`left`, `right`) |

## Storage Strategy

### Database vs. Filesystem

To keep the database lightweight and performant:

- **Structured Data:** Stored in SQLite (`users`, `conversations`, `messages`).
- **Binary Assets:** Images and large files are stored in the **filesystem** (`{userData}/data/images/`).
- **References:** The database stores paths/URIs to these files, not the blobs themselves.

## Portability Analysis (PostgreSQL / MySQL)

**Current Status:** High Coupling to SQLite.

Switching to a server-based database like PostgreSQL or MySQL is **non-trivial** and would require a major refactor.

### Key Blockers:

1. **Synchronous Architecture:**

   - The application uses `better-sqlite3`, which is **synchronous** (blocking).
   - The entire `AionUIDatabase` class and its consumers expect immediate return values.
   - PostgreSQL/MySQL drivers in Node.js are **asynchronous** (Promise-based).
   - **Impact:** Converting to async would ripple through the entire `src/process` layer.
2. **No Abstraction Layer:**

   - There is no ORM (e.g., Prisma, TypeORM) or query builder (e.g., Knex) abstracting the SQL dialect.
   - Raw SQL queries are written with SQLite-specific syntax.
3. **Embedded Assumptions:**

   - The app assumes a single-user, local-file deployment model in many places (though the schema supports multiple users).

### Migration Path (If required):

1. **Introduce Abstraction:** Replace direct `better-sqlite3` calls with an interface (e.g., `IDatabaseService`).
2. **Async Refactor:** Rewrite the database layer to be fully asynchronous.
3. **Adopt ORM:** Use a tool like Prisma or Kysely to handle dialect differences.
