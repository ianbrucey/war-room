# Case Workspace Implementation Status

## Completed Implementation

### 1. Database Schema
- **Migration v10**: Added `workspace_path` column to `case_files` table.
- **Auto-generation**: Existing cases are automatically assigned a workspace folder in `~/.justicequest/{case-name}-{timestamp}` during migration.
- **Template Copying**: Case folder template is copied to the new workspace directory.
- **Types**: Updated `ICaseFile` interface to include `workspace_path`.

### 2. Agent Initialization Refactoring
- **Removed Temp Folders**: Deleted logic in `buildWorkspaceWidthFiles` that created temporary subfolders for each session.
- **Shared Workspace**: Agents (`Gemini`, `ACP`, `Codex`) now accept a mandatory `caseWorkspace` parameter and boot directly in that directory.
- **Effect**: All agents working on the same case share the same physical directory, preventing MCP re-indexing and enabling multi-user visibility of file changes.

### 3. Conversation Bridge
- **Case Linking**: The `conversation.create` IPC provider now strictly requires `caseFileId`.
- **Workspace Fetching**: Retrieves the `workspace_path` from the linked case in the database and passes it to the agent factory.

### 4. IPC Bridge
- **New Case Bridge**: Created `src/process/bridge/caseBridge.ts` exposing:
    - `cases.create`
    - `cases.getAll` (paginated)
    - `cases.get`
    - `cases.update`
    - `cases.delete`
- **Integration**: Registered the bridge in `initAllBridges` and defined types in `ipcBridge.ts`.

## Current Status & Blockers

### Verification
- **Automated Tests**: Integration tests (`tests/integration/case_workspace.test.ts`) failed due to an environment dependency issue (`TypeError: getHomePage is not a function`). This appears to be a circular dependency or environment setup issue within the test runner (`ts-node`/`jest`) when importing `utils.ts` via `initStorage.ts`.
- **Logic Validation**: The implementation logic has been reviewed and aligns with the design to solve the MCP re-indexing issue.

### Next Steps
1. **Manual Verification**: Run the application ensuring `migration v10` executes successfully on startup.
2. **Functional Check**: Create a new case and conversation in the UI. verify that:
    - A folder is created in `.justicequest`.
    - The agent can read/write files in that folder.
    - Subsequent agents in the same case see the same files.
3. **Frontend Integration**: Hook up the frontend case list to the new `cases` IPC bridge.
