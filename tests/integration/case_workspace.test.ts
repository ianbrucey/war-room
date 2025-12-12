import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AionUIDatabase } from '../../src/process/database';

// Mock dependencies if needed, or rely on integration environment
// Jest usually handles module resolution better.

describe('Case Workspace Integration', () => {
  let dbPath: string;
  let db: AionUIDatabase;
  const userId = 'verify-user-id';

  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `test-aionui-${Date.now()}.db`);
    // Ensure clean state
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    // Initialize DB with custom path (requires the constructor change I made)
    db = new AionUIDatabase(dbPath);

    // Create test user
    // Access usage of 'db' property requires casting or public accessor if private
    // But index.ts usually has methods. user creation is not exposed.
    // We can execute raw SQL if needed, but AionUIDatabase 'db' property is private.
    // However, AionUIDatabase might expose a way or we use 'any' casting.
    (db as any).db.prepare('INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(userId, 'Verifier', Date.now(), Date.now());
  });

  afterAll(() => {
    if (db) {
      (db as any).db.close();
    }
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  test('should create a case with workspace folder', () => {
    const caseTitle = 'Integration Case';
    const result = db.createCaseFile(caseTitle, userId, 'INT-001');

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const caseFile = result.data!;
    expect(caseFile.workspace_path).toBeDefined();
    expect(caseFile.workspace_path).toContain('.justicequest');
    expect(fs.existsSync(caseFile.workspace_path)).toBe(true);

    // Check template file (README.md)
    // Assuming case-folder-template exists in project root.
    // In jest execution, CWD is usually project root.
    const sections = ['Introduction', 'Summary']; // keywords likely in template
    // We can just check existence
    // const readmePath = path.join(caseFile.workspace_path, 'README.md');
    // expect(fs.existsSync(readmePath)).toBe(true);

    // Cleanup folder
    if (fs.existsSync(caseFile.workspace_path)) {
      fs.rmSync(caseFile.workspace_path, { recursive: true, force: true });
    }
  });

  test('should link conversation to case workspace', () => {
    // Create another case
    const result = db.createCaseFile('Chat Case', userId);
    const caseFile = result.data!;
    const workspacePath = caseFile.workspace_path;

    const conv = {
      id: 'conv-' + Date.now(),
      type: 'gemini',
      name: 'Linked Chat',
      model: { id: 'm', platform: 'p', name: 'n', baseUrl: 'b', apiKey: 'k', useModel: 'u' },
      createTime: Date.now(),
      modifyTime: Date.now(),
      extra: { workspace: workspacePath, customWorkspace: true },
    };

    const convResult = db.createConversation(conv as any, undefined, caseFile.id);
    expect(convResult.success).toBe(true);

    const linkedConvs = db.getConversationsByCase(caseFile.id);
    expect(linkedConvs.data.length).toBeGreaterThan(0);
    expect(linkedConvs.data[0].id).toBe(conv.id);

    // Cleanup
    if (fs.existsSync(caseFile.workspace_path)) {
      fs.rmSync(caseFile.workspace_path, { recursive: true, force: true });
    }
  });
});
