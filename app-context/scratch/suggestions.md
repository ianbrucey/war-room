Based on the notes in `talk.md`, here is a suggestion for how to manage agent configurations in a shared, multi-user case directory.

### Understanding the Problem

The core challenge is to provide unique startup configurations to multiple agent processes that must all share the same working directory to prevent a costly re-indexing by the MCP server. The traditional method of using a single `settings.json` file in the root of the workspace is not viable as it would create race conditions and conflicts between agents.

### Suggestion: Pass Configuration via IPC or Environment Variables

Instead of relying on the filesystem for per-agent configuration, you can pass this information directly to the agent process at the moment it is created. This avoids any filesystem I/O within the indexed case directory.

#### 1. Preferred Method: Inter-Process Communication (IPC)

When the main process forks a new agent worker (using Node.js's `child_process.fork`), you can immediately send the unique session configuration to it as a message.

- **Main Process (e.g., in `src/process/initAgent.ts`):**
  1.  Construct the agent's unique configuration object in memory (e.g., `{ activeTask: '...', sessionId: '...' }`).
  2.  Fork the agent worker script: `const worker = fork('path/to/agent/worker.js', [], { cwd: caseFolderPath });`
  3.  Send the configuration object to the new worker: `worker.send({ type: 'INIT_CONFIG', payload: configObject });`

- **Agent Worker (e.g., in `src/worker/gemini.ts`):**
  1.  Listen for the initial configuration message from the parent process.
  2.  `process.on('message', (message) => { if (message.type === 'INIT_CONFIG') { const config = message.payload; // Now the agent has its unique config in memory // Proceed with initialization... } });`

#### 2. Alternative Method: Environment Variables

This approach is conceptually similar but uses environment variables instead of the IPC message bus.

- **Main Process:**
  1.  Serialize the configuration object into a JSON string: `const configString = JSON.stringify(configObject);`
  2.  Pass this string as an environment variable when forking the worker:
      ```javascript
      fork('path/to/agent/worker.js', [], {
        cwd: caseFolderPath,
        env: { ...process.env, AGENT_CONFIG: configString },
      });
      ```

- **Agent Worker:**
  1.  On startup, read the environment variable: `const configString = process.env.AGENT_CONFIG;`
  2.  Parse it back into an object: `const config = JSON.parse(configString);`
  3.  The agent now has its unique configuration.

### Benefits of These Approaches

- **Zero Filesystem Footprint:** No `.json` config files are written to the shared case directory, completely avoiding the MCP re-indexing issue.
- **True Isolation:** Each agent process receives its own configuration in memory, preventing any conflicts or race conditions with other agents working on the same case.
- **Scalability:** This model cleanly supports any number of users/agents operating concurrently within the same directory.

This strategy directly addresses the technical constraints by decoupling the agent's working directory (which must be static for indexing) from its session-specific configuration (which must be dynamic and isolated).
