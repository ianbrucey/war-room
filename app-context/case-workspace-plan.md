# Plan: Case-Based Workspace Implementation

This document outlines the plan to refactor the application to use a case-based workspace system. The goal is for agents to operate within a dedicated, persistent folder for each "case," rather than in temporary, session-specific folders.

## Phase 1: Scaffolding and Configuration

1.  **Create Case Folder Template:**
    - A directory named `case-folder-template` has been created at the project root.
    - Inside this directory, a placeholder file `README.md` has been added.

2.  **Define Workspace Constants:**
    - **File:** `src/common/constants.ts`
    - **Action:** Add a new exported constant for the default base workspace. This involves using `os.homedir()` to ensure it's cross-platform.

      ```typescript
      import os from 'os';
      import path from 'path';

      export const JUSTICE_QUEST_WORK_DIR = path.join(os.homedir(), '.justicequest');
      ```

    - **File:** `src/process/initStorage.ts`
    - **Action:** Modify the `getSystemDir` function to use this new constant as the default `workDir` instead of `getDataPath()`. This centralizes the new default.

## Phase 2: Database Schema for Cases

1.  **Create New `cases` Table:**
    - **File:** `src/process/database/schema.ts`
    - **Action:** Add a new table definition to the `SCHEMA_SQL`.
      ```sql
      CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        workspace_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
      ```

2.  **Update Conversation Table:**
    - **File:** `src/process/database/schema.ts`
    - **Action:** Add a `case_id` column to the `conversations` table to link each conversation to a case. A `ON DELETE CASCADE` clause will ensure conversations are removed when a case is deleted.
      ```sql
      -- In CREATE TABLE conversations
      case_id TEXT,
      -- At the end of the definition
      FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE CASCADE
      ```
    - This will require a database migration for existing users.

3.  **Create Database Migration:**
    - **File:** `src/process/database/migrations.ts`
    - **Action:** Add a new migration to introduce the `cases` table and add the `case_id` column to the `conversations` table.

4.  **Update Database Service:**
    - **File:** `src/process/database/index.ts`
    - **Action:** Add new methods to the `AionUIDatabase` class for CRUD operations on cases:
      - `createCase(id, userId, name, workspacePath)`
      - `getCase(caseId)`
      - `getUserCases(userId)`

## Phase 3: Case Management API

1.  **Create IPC Bridge for Cases:**
    - **File:** `src/process/bridge/caseBridge.ts` (new file)
    - **Action:** Create a new bridge file to handle all case-related IPC messages.
    - **`ipcBridge.cases.create.provider`:**
      1.  Receives `{ name }` from the client.
      2.  Gets the `JUSTICE_QUEST_WORK_DIR` constant.
      3.  Checks if the directory exists using `fs.promises.access`. If not, creates it with `fs.promises.mkdir({ recursive: true })`.
      4.  Generates a unique, filesystem-safe folder name from the case name (e.g., slugify the name and add a timestamp).
      5.  Constructs the full `newCasePath`.
      6.  Copies the `case-folder-template` to the `newCasePath` using `fs.promises.cp(..., { recursive: true })`.
      7.  Calls `db.createCase()` to save the new case record to the database, storing `newCasePath` in the `workspace_path` column.
      8.  Returns the newly created case object.
    - **`ipcBridge.cases.getAll.provider`:**
      1.  Calls `db.getUserCases()` to retrieve all cases for the current user.
      2.  Returns the list.

## Phase 4: Agent Spawning Logic Refactor

1.  **Modify Conversation Creation:**
    - **File:** `src/process/bridge/conversationBridge.ts`
    - **Action:** The `ipcBridge.conversation.create.provider` must be updated to accept a `caseId`.
    - When creating a new conversation, it must now store the `caseId` in the `conversations` table.

2.  **Refactor `initAgent.ts`:**
    - **File:** `src/process/initAgent.ts`
    - **Action:** The functions `createGeminiAgent`, `createAcpAgent`, etc., need to be refactored. The logic for determining the workspace path must be changed.
    - **New Workflow:**
      1.  When a conversation task is built (e.g., in `WorkerManage.getTaskByIdRollbackBuild`), the logic must first fetch the `conversation` record from the database.
      2.  Using the `case_id` from the conversation, fetch the corresponding `case` record.
      3.  The `workspace_path` from the `case` record is the **final and only** working directory for the agent.
      4.  The `buildWorkspaceWidthFiles` function must be **removed or fundamentally changed**. Its responsibility for creating a temporary subfolder is no longer desired. The `workspace` parameter passed to agent constructors should be the `case.workspace_path`.
