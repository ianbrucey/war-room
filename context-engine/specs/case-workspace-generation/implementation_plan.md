# Case-Based Workspace Implementation

This plan implements a persistent, case-based workspace system where agents operate within dedicated case folders instead of temporary session-specific directories. The system must support multiple users working concurrently on the same case while maintaining a single workspace to prevent MCP server re-indexing.

## User Review Required

> [!IMPORTANT]
> **Multi-User Concurrency Design Decision**
> 
> The brainstorm document identifies a critical constraint: multiple users may work on the same case simultaneously, but we cannot create per-session subfolders because the MCP server would re-index for each new folder. 
>
> **Proposed Solution:** Each agent will boot with the case workspace path, but we'll rely on the conversation ID (which is unique per session) to isolate agent state. The workspace itself will be shared, but each agent instance will maintain its own in-memory state and settings. This means:
> - ✅ MCP server indexes the case workspace once
> - ✅ Multiple agents can work in the same workspace concurrently
> - ⚠️ Users working on the same case will see each other's file changes in real-time
> - ⚠️ No per-session isolation at the filesystem level
>
> **Alternative Approach (if the above is unacceptable):** We could implement a session-specific settings file (e.g., `.aionui-session-{conversation_id}.json`) within the case workspace to provide per-session configuration without creating subfolders. Please advise if this is necessary.

> [!WARNING]
> **Breaking Change: Database Migration Required**
>
> This implementation requires adding a `workspace_path` column to the existing `case_files` table. Existing cases will need to have workspace paths generated and folders created during migration. The migration will:
> 1. Add `workspace_path TEXT NOT NULL` column to `case_files`
> 2. For each existing case, generate a workspace path and create the folder
> 3. Copy the `case-folder-template` to each case's workspace

## Proposed Changes

### Database Layer

#### [MODIFY] [migrations.ts](file:///Users/ianbruce/code/aionui/src/process/database/migrations.ts)

Add migration v9 → v10 to add `workspace_path` column to `case_files` table:

```typescript
const migration_v10: IMigration = {
  version: 10,
  name: 'Add workspace_path to case_files',
  up: (db) => {
    // 1. Add workspace_path column
    db.exec(`ALTER TABLE case_files ADD COLUMN workspace_path TEXT;`);
    
    // 2. For each existing case, generate workspace path and create folder
    const cases = db.prepare('SELECT * FROM case_files').all();
    const updateStmt = db.prepare('UPDATE case_files SET workspace_path = ? WHERE id = ?');
    
    for (const caseFile of cases) {
      const safeName = caseFile.title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const timestamp = caseFile.created_at;
      const workspacePath = path.join(JUSTICE_QUEST_WORK_DIR, `${safeName}-${timestamp}`);
      
      // Create directory and copy template
      fs.mkdirSync(workspacePath, { recursive: true });
      const templatePath = path.join(process.cwd(), 'case-folder-template');
      if (fs.existsSync(templatePath)) {
        fs.cpSync(templatePath, workspacePath, { recursive: true });
      }
      
      updateStmt.run(workspacePath, caseFile.id);
    }
    
    // 3. Make workspace_path NOT NULL after populating
    db.exec(`
      CREATE TABLE case_files_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        case_number TEXT,
        workspace_path TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      
      INSERT INTO case_files_new SELECT * FROM case_files;
      DROP TABLE case_files;
      ALTER TABLE case_files_new RENAME TO case_files;
      
      CREATE INDEX IF NOT EXISTS idx_case_files_user_id ON case_files(user_id);
      CREATE INDEX IF NOT EXISTS idx_case_files_created_at ON case_files(created_at DESC);
    `);
  },
  down: (db) => {
    // Recreate without workspace_path column
    db.exec(`
      CREATE TABLE case_files_backup AS
      SELECT id, title, case_number, user_id, created_at, updated_at
      FROM case_files;
      
      DROP TABLE case_files;
      ALTER TABLE case_files_backup RENAME TO case_files;
      
      CREATE INDEX IF NOT EXISTS idx_case_files_user_id ON case_files(user_id);
      CREATE INDEX IF NOT EXISTS idx_case_files_created_at ON case_files(created_at DESC);
    `);
  },
};
```

Update `ALL_MIGRATIONS` array and `CURRENT_DB_VERSION` in [schema.ts](file:///Users/ianbruce/code/aionui/src/process/database/schema.ts).

#### [MODIFY] [types.ts](file:///Users/ianbruce/code/aionui/src/process/database/types.ts)

Add `workspace_path` to [ICaseFile](file:///Users/ianbruce/code/aionui/src/process/database/types.ts#44-52) and [ICaseFileRow](file:///Users/ianbruce/code/aionui/src/process/database/types.ts#90-98) interfaces:

```typescript
export interface ICaseFile {
  id: string;
  title: string;
  case_number?: string | null;
  workspace_path: string;  // NEW
  user_id: string;
  created_at: number;
  updated_at: number;
}
```

Update [caseFileToRow](file:///Users/ianbruce/code/aionui/src/process/database/types.ts#144-157) and [rowToCaseFile](file:///Users/ianbruce/code/aionui/src/process/database/types.ts#158-171) conversion functions to include `workspace_path`.

#### [MODIFY] [index.ts](file:///Users/ianbruce/code/aionui/src/process/database/index.ts)

Update [createCaseFile](file:///Users/ianbruce/code/aionui/src/process/database/index.ts#386-420) method to:
1. Generate a filesystem-safe folder name from the case title
2. Create the workspace directory at `JUSTICE_QUEST_WORK_DIR/{safe-name}-{timestamp}`
3. Copy `case-folder-template` to the new workspace
4. Store `workspace_path` in the database

```typescript
createCaseFile(title: string, userId: string, caseNumber?: string): IQueryResult<ICaseFile> {
  try {
    const caseId = `case_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const now = Date.now();
    
    // Generate filesystem-safe name
    const safeName = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const workspacePath = path.join(JUSTICE_QUEST_WORK_DIR, `${safeName}-${now}`);
    
    // Create workspace directory
    fs.mkdirSync(workspacePath, { recursive: true });
    
    // Copy template
    const templatePath = path.join(process.cwd(), 'case-folder-template');
    if (fs.existsSync(templatePath)) {
      fs.cpSync(templatePath, workspacePath, { recursive: true });
    }
    
    // Insert into database
    const stmt = this.db.prepare(`
      INSERT INTO case_files (id, title, case_number, workspace_path, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(caseId, title, caseNumber ?? null, workspacePath, userId, now, now);
    
    return {
      success: true,
      data: {
        id: caseId,
        title,
        case_number: caseNumber ?? null,
        workspace_path: workspacePath,
        user_id: userId,
        created_at: now,
        updated_at: now,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
```

---

### Agent Initialization Layer

#### [MODIFY] [initAgent.ts](file:///Users/ianbruce/code/aionui/src/process/initAgent.ts)

**Critical Change:** Remove temp folder creation logic from [buildWorkspaceWidthFiles](file:///Users/ianbruce/code/aionui/src/process/initAgent.ts#15-58). The workspace should ALWAYS be the case workspace path, never a temp subfolder.

```typescript
const buildWorkspaceWidthFiles = async (
  caseWorkspace: string,  // Changed: now expects the case workspace directly
  defaultFiles?: string[]
) => {
  // Workspace is provided by the case - no temp folder creation
  const workspace = caseWorkspace;
  
  // Copy default files if provided
  if (defaultFiles) {
    for (const file of defaultFiles) {
      const absoluteFilePath = path.isAbsolute(file) ? file : path.resolve(file);
      
      try {
        await fs.access(absoluteFilePath);
      } catch (error) {
        console.warn(`[AionUi] Source file does not exist, skipping: ${absoluteFilePath}`);
        continue;
      }
      
      let fileName = path.basename(absoluteFilePath);
      
      // Remove AionUI timestamp suffix if present
      const { cacheDir } = getSystemDir();
      const tempDir = path.join(cacheDir, 'temp');
      if (absoluteFilePath.startsWith(tempDir)) {
        fileName = fileName.replace(AIONUI_TIMESTAMP_REGEX, '$1');
      }
      
      const destPath = path.join(workspace, fileName);
      
      try {
        await fs.copyFile(absoluteFilePath, destPath);
      } catch (error) {
        console.error(`[AionUi] Failed to copy file from ${absoluteFilePath} to ${destPath}:`, error);
      }
    }
  }
  
  return { workspace, customWorkspace: true };  // Always custom now
};

export const createGeminiAgent = async (
  model: TProviderWithModel,
  caseWorkspace: string,  // Changed: now required
  defaultFiles?: string[],
  webSearchEngine?: 'google' | 'default'
): Promise<TChatConversation> => {
  const { workspace } = await buildWorkspaceWidthFiles(caseWorkspace, defaultFiles);
  return {
    type: 'gemini',
    model,
    extra: { workspace, customWorkspace: true, webSearchEngine },
    desc: workspace,
    createTime: Date.now(),
    modifyTime: Date.now(),
    name: workspace,
    id: uuid(),
  };
};

// Similar updates for createAcpAgent and createCodexAgent
```

---

### Conversation Bridge Layer

#### [MODIFY] [conversationBridge.ts](file:///Users/ianbruce/code/aionui/src/process/bridge/conversationBridge.ts)

Update `ipcBridge.conversation.create.provider` to:
1. Fetch the case from the database using `caseFileId`
2. Extract `workspace_path` from the case
3. Pass `workspace_path` to the agent creation functions

```typescript
ipcBridge.conversation.create.provider(async (params): Promise<TChatConversation> => {
  const { type, extra, name, model, id, caseFileId } = params;
  
  if (!caseFileId) {
    throw new Error('caseFileId is required');
  }
  
  // Fetch case to get workspace path
  const db = getDatabase();
  const caseResult = db.getCaseFile(caseFileId);
  
  if (!caseResult.success || !caseResult.data) {
    throw new Error(`Case file not found: ${caseFileId}`);
  }
  
  const caseWorkspace = caseResult.data.workspace_path;
  
  const buildConversation = () => {
    if (type === 'gemini') {
      return createGeminiAgent(
        model,
        caseWorkspace,  // Pass case workspace instead of extra.workspace
        extra.defaultFiles,
        extra.webSearchEngine
      );
    }
    if (type === 'acp') {
      return createAcpAgent({
        ...params,
        extra: { ...extra, workspace: caseWorkspace }
      });
    }
    if (type === 'codex') {
      return createCodexAgent({
        ...params,
        extra: { ...extra, workspace: caseWorkspace }
      });
    }
    throw new Error('Invalid conversation type');
  };
  
  // ... rest of the function remains the same
});
```

---

### IPC Bridge Layer

#### [NEW] [caseBridge.ts](file:///Users/ianbruce/code/aionui/src/process/bridge/caseBridge.ts)

Create a new bridge for case management operations:

```typescript
import { ipcBridge } from '@/common';
import { getDatabase } from '@process/database';
import { JUSTICE_QUEST_WORK_DIR } from '@/common/constants';
import fs from 'fs/promises';
import path from 'path';

export function initCaseBridge(): void {
  // Create new case
  ipcBridge.cases.create.provider(async ({ title, caseNumber, userId }) => {
    try {
      const db = getDatabase();
      const result = db.createCaseFile(title, userId, caseNumber);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { success: true, data: result.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // Get all cases for user
  ipcBridge.cases.getAll.provider(async ({ userId, page, pageSize }) => {
    try {
      const db = getDatabase();
      const result = db.getUserCaseFiles(userId, page, pageSize);
      
      return {
        success: true,
        data: result.data,
        total: result.total,
        hasMore: result.hasMore,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // Get single case
  ipcBridge.cases.get.provider(async ({ caseId }) => {
    try {
      const db = getDatabase();
      const result = db.getCaseFile(caseId);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { success: true, data: result.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // Update case
  ipcBridge.cases.update.provider(async ({ caseId, updates }) => {
    try {
      const db = getDatabase();
      const result = db.updateCaseFile(caseId, updates);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { success: true, data: result.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // Delete case
  ipcBridge.cases.delete.provider(async ({ caseId }) => {
    try {
      const db = getDatabase();
      const result = db.deleteCaseFile(caseId);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
```

#### [MODIFY] [initBridge.ts](file:///Users/ianbruce/code/aionui/src/process/initBridge.ts)

Import and initialize the case bridge:

```typescript
import { initCaseBridge } from './bridge/caseBridge';

// ... in initialization function
initCaseBridge();
```

---

### Common Types Layer

#### [MODIFY] [ipcBridge.ts](file:///Users/ianbruce/code/aionui/src/common/ipcBridge.ts)

Add IPC bridge definitions for case operations:

```typescript
export const ipcBridge = {
  // ... existing bridges
  cases: {
    create: createBridge<
      { title: string; caseNumber?: string; userId: string },
      { success: boolean; data?: ICaseFile; error?: string }
    >('cases.create'),
    getAll: createBridge<
      { userId: string; page?: number; pageSize?: number },
      { success: boolean; data?: ICaseFile[]; total?: number; hasMore?: boolean; error?: string }
    >('cases.getAll'),
    get: createBridge<
      { caseId: string },
      { success: boolean; data?: ICaseFile; error?: string }
    >('cases.get'),
    update: createBridge<
      { caseId: string; updates: Partial<Pick<ICaseFile, 'title' | 'case_number'>> },
      { success: boolean; data?: ICaseFile; error?: string }
    >('cases.update'),
    delete: createBridge<
      { caseId: string },
      { success: boolean; error?: string }
    >('cases.delete'),
  },
};
```

---

### Case Folder Template

#### [MODIFY] [README.md](file:///Users/ianbruce/code/aionui/case-folder-template/README.md)

Update the template README with useful information:

```markdown
# Case Workspace

This is your case workspace. All files and work related to this case should be stored here.

## Structure

You can organize your case files however you like. Some suggested folders:

- `documents/` - Case documents, evidence, filings
- `research/` - Legal research, notes
- `drafts/` - Work in progress
- `final/` - Completed work products

## Notes

- This workspace is shared across all conversations in this case
- The AI agent can read and write files in this workspace
- Files are persisted and will be available in future sessions
```

## Verification Plan

### Automated Tests

**Database Migration Test:**

```bash
# Run from project root
npm test -- src/process/database/migrations.test.ts
```

This test should verify:
- Migration v10 successfully adds `workspace_path` column
- Existing cases get workspace paths generated
- Workspace folders are created and template is copied
- Rollback works correctly

**Case CRUD Test:**

```bash
# Run from project root
npm test -- src/process/database/index.test.ts
```

This test should verify:
- [createCaseFile](file:///Users/ianbruce/code/aionui/src/process/database/index.ts#386-420) creates workspace folder and copies template
- [getCaseFile](file:///Users/ianbruce/code/aionui/src/process/database/index.ts#421-447) returns case with `workspace_path`
- [getUserCaseFiles](file:///Users/ianbruce/code/aionui/src/process/database/index.ts#448-487) returns paginated results
- [deleteCaseFile](file:///Users/ianbruce/code/aionui/src/process/database/index.ts#533-554) removes case from database (workspace folder cleanup is manual)

### Manual Verification

1. **Start the application** and log in
2. **Navigate to the cases page** (should be the default landing page after login)
3. **Create a new case:**
   - Click "Create Case" button
   - Enter title: "Test Case 123"
   - Enter case number: "2024-CV-001" (optional)
   - Click "Create"
4. **Verify workspace creation:**
   - Open terminal and navigate to `~/.justicequest`
   - Verify a folder exists with a name like `test-case-123-{timestamp}`
   - Verify the folder contains [README.md](file:///Users/ianbruce/code/aionui/src/process/database/README.md) from the template
5. **Create a conversation in the case:**
   - Select the case
   - Click "New Conversation"
   - Choose agent type (Gemini/ACP/Codex)
   - Send a message asking the agent to list files in the workspace
6. **Verify workspace persistence:**
   - Ask the agent to create a test file: "Create a file called test.txt with content 'Hello World'"
   - Close the conversation
   - Create a new conversation in the same case
   - Ask the agent to read test.txt
   - Verify the content is "Hello World" (proves workspace is shared and persistent)
7. **Verify multi-user scenario (if possible):**
   - Create a second user account
   - Log in as the second user
   - Navigate to cases and verify the first user's case is NOT visible
   - Create a new case for the second user
   - Verify the workspace is created in `~/.justicequest` with a different name
