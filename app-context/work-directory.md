# Work Directory System

## Overview
AionUi uses a configurable work directory system where agents operate in isolated workspace folders. When you set a work directory in settings, agents create temporary subfolders within it for each conversation.

## Configuration Flow

### 1. User Settings
**Location:** Settings → System Settings → Work Directory

Users can configure the base work directory path via the UI (`SystemSettings.tsx`).

**Default Value:** `{userData}/data/` (e.g., `~/Library/Application Support/AionUi/data/`)

### 2. Storage
The work directory setting is stored in:
- **File:** `{userData}/config/.aionui-env`
- **Key:** `aionui.dir.workDir`

**Code Reference:** `src/process/initStorage.ts:398`
```typescript
workDir: dirConfig?.workDir || getDataPath()
```

## How Agents Use the Work Directory

### Workspace Creation Logic
**File:** `src/process/initAgent.ts`

When creating a new conversation, the `buildWorkspaceWidthFiles` function:

1. **Checks if user provided a custom workspace:**
   - If `workspace` parameter is provided → Use it directly
   - If not → Create a temp folder

2. **Creates temp folder (if needed):**
   ```
   {workDir}/{agent-type}-temp-{timestamp}/
   ```
   
   **Examples:**
   - `~/Library/Application Support/AionUi/data/gemini-temp-1738012345678/`
   - `~/Library/Application Support/AionUi/data/codex-temp-1738012345679/`

3. **Copies default files** (if provided) into the workspace

### Why You See a Subfolder

**What you set:** `/Users/ian/my-work-dir`

**What the agent reports:** `/Users/ian/my-work-dir/gemini-temp-1738012345678`

This is **intentional** for isolation:
- Each conversation gets its own isolated folder
- Prevents file conflicts between concurrent conversations
- Allows clean cleanup when conversation ends

## Agent-Specific Behavior

### Gemini Agent
```typescript
// src/process/initAgent.ts:60
const { workspace: newWorkspace } = await buildWorkspaceWidthFiles(
  `gemini-temp-${Date.now()}`,
  workspace,  // User's configured work dir
  defaultFiles
);
```

### ACP Agent
```typescript
// src/process/initAgent.ts:75
const { workspace } = await buildWorkspaceWidthFiles(
  `${extra.backend}-temp-${Date.now()}`,  // e.g., "claude-temp-..."
  extra.workspace,
  extra.defaultFiles
);
```

### Codex Agent
```typescript
// src/process/initAgent.ts:88
const { workspace } = await buildWorkspaceWidthFiles(
  `codex-temp-${Date.now()}`,
  extra.workspace,
  extra.defaultFiles
);
```

## Custom vs. Temp Workspaces

The system tracks whether a workspace is custom or temporary:

```typescript
const customWorkspace = !!workspace;  // true if user provided a path
```

**Stored in conversation:**
```typescript
extra: { 
  workspace: "/actual/path/used",
  customWorkspace: true/false
}
```

**UI Display:**
- Custom workspace → Shows the full path
- Temp workspace → Shows "临时工作区" (Temporary Workspace)

## Modification Considerations

If you want to change this behavior:

### Option 1: Use Work Directory Directly (No Temp Subfolder)
**File:** `src/process/initAgent.ts:15-21`

Change:
```typescript
if (!workspace) {
  const tempPath = getSystemDir().workDir;
  workspace = path.join(tempPath, defaultWorkspaceName);  // ← Remove this
  await fs.mkdir(workspace, { recursive: true });
}
```

To:
```typescript
if (!workspace) {
  workspace = getSystemDir().workDir;  // Use work dir directly
  // No mkdir needed
}
```

**Impact:** All conversations share the same directory (potential file conflicts)

### Option 2: Custom Naming Pattern
Change the temp folder naming:
```typescript
`gemini-temp-${Date.now()}`  // Current
// To:
`session-${conversationId}`  // More readable
```

### Option 3: Configurable Behavior
Add a setting to toggle between:
- Isolated mode (current: creates subfolders)
- Shared mode (uses work dir directly)
