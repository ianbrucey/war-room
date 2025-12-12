# Agent Work Directory: Analysis

This document details how the AionUI application determines and manages the working directory for its AI agents.

## 1. Configuration

The agent work directory is a user-configurable setting.

### UI Configuration

- **Location:** The setting is exposed in the frontend application under `Settings > System Settings > Work Directory`.
- **Component:** The UI is implemented in the React component located at `src/renderer/pages/settings/SystemSettings.tsx`.
- **Mechanism:**
  1. A user clicks a button which triggers an IPC call (`ipcBridge.invoke('select-dir')`) to open a native directory selection dialog.
  2. Upon selection, the chosen path is set in a form field.
  3. The form's `onValuesChange` handler fires, invoking another IPC call: `ipcBridge.invoke('update-system-config', { workDir: '...' })`.

### Storage

- **IPC Handler:** The `update-system-config` message is handled in the main process by the `updateSystemConfig` function in `src/process/initStorage.ts`.
- **Storage File:** The configuration is persisted in a `.env`-style file named `.aionui-env` located in the user's application configuration directory (`{userData}/config/.aionui-env`).
- **Key:** The work directory path is stored under the key `aionui.dir.workDir`.

### Default Value

- **Fallback:** If the `aionui.dir.workDir` key is not set in the configuration file, the system defaults to a `data` folder within the application's user data directory.
- **Code:** This logic is located in `src/process/initStorage.ts`:
  ```typescript
  // from getSystemDir() function
  workDir: dirConfig?.workDir || getDataPath();
  ```

## 2. Workspace Determination

When a new agent conversation is initiated, a specific, isolated workspace is created for that session. The agent does **not** operate directly in the configured work directory.

### Workspace Creation

- **Trigger:** A workspace is created when a new conversation is started, which calls functions in `src/process/initAgent.ts`.
- **Core Function:** The key logic resides in the `buildWorkspaceWidthFiles` function within `src/process/initAgent.ts`.

### The Process

1. **Get Base Path:** The function retrieves the configured work directory path from the system configuration (as loaded by `initStorage.ts`).
2. **Check for Custom Workspace:** The system allows for a "custom workspace" to be passed in for a specific conversation. This is not the standard flow from the UI.
3. **Create Temporary Subfolder:** If no custom workspace is provided, the system creates a new, unique subfolder within the base work directory.
   - **Naming Convention:** The folder is named using the agent type and a timestamp, for example: `gemini-temp-1738012345678`.
   - **Code:**
     ```typescript
     // src/process/initAgent.ts
     if (!workspace) {.
       const tempPath = getSystemDir().workDir;
       workspace = path.join(tempPath, defaultWorkspaceName); // defaultWorkspaceName is e.g., "gemini-temp-..."
       await fs.mkdir(workspace, { recursive: true });
     }
     ```
4. **Return Path:** The full path to this newly created temporary subfolder is returned and used as the agent's current working directory for the duration of the conversation.

## Summary

The agent's working directory is determined by a two-step process:

1.  **A base `workDir` is set by the user** and stored persistently.
2.  **For each conversation, a temporary, isolated subfolder is created inside that `workDir`**. This subfolder is the agent's actual `cwd`.

This design ensures that each agent conversation has a clean, isolated environment, preventing file conflicts between concurrent sessions. The agent's reported working directory will therefore always be a subdirectory of the path set in the settings.
