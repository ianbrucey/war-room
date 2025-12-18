/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ensureDirectory, getDataPath } from '@process/utils';
import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { runMigrations as executeMigrations } from './migrations';
import { CURRENT_DB_VERSION, getDatabaseVersion, initSchema, setDatabaseVersion } from './schema';
import type { ICaseFile, ICaseFileRow, IConversationRow, IMessageRow, IPaginatedResult, IQueryResult, IUser, TChatConversation, TMessage } from './types';
import { conversationToRow, messageToRow, rowToCaseFile, rowToConversation, rowToMessage } from './types';

/**
 * Main database class for AionUi
 * Uses better-sqlite3 for fast, synchronous SQLite operations
 */
export class AionUIDatabase {
  private db: Database.Database;
  private readonly defaultUserId = 'system_default_user';
  private readonly systemPasswordPlaceholder = '';

  constructor(dbPath?: string) {
    const finalPath = dbPath || path.join(getDataPath(), 'aionui.db');
    console.log(`[Database] Initializing database at: ${finalPath}`);

    const dir = path.dirname(finalPath);
    ensureDirectory(dir);

    try {
      this.db = new BetterSqlite3(finalPath);
      this.initialize();
    } catch (error) {
      console.error('[Database] Failed to initialize, attempting recovery...', error);
      // 尝试恢复：关闭并重新创建数据库
      // Try to recover by closing and recreating database
      try {
        if (this.db) {
          this.db.close();
        }
      } catch (e) {
        // 忽略关闭错误
        // Ignore close errors
      }

      // 备份损坏的数据库文件
      // Backup corrupted database file
      if (fs.existsSync(finalPath)) {
        const backupPath = `${finalPath}.backup.${Date.now()}`;
        try {
          fs.renameSync(finalPath, backupPath);
          console.log(`[Database] Backed up corrupted database to: ${backupPath}`);
        } catch (e) {
          console.error('[Database] Failed to backup corrupted database:', e);
          // 备份失败则尝试直接删除
          // If backup fails, try to delete instead
          try {
            fs.unlinkSync(finalPath);
            console.log(`[Database] Deleted corrupted database file`);
          } catch (e2) {
            console.error('[Database] Failed to delete corrupted database:', e2);
            throw new Error('Database is corrupted and cannot be recovered. Please manually delete: ' + finalPath);
          }
        }
      }

      // 使用新数据库文件重试
      // Retry with fresh database file
      this.db = new BetterSqlite3(finalPath);
      this.initialize();
    }
  }

  private initialize(): void {
    try {
      initSchema(this.db);

      // Check and run migrations if needed
      const currentVersion = getDatabaseVersion(this.db);
      if (currentVersion < CURRENT_DB_VERSION) {
        this.runMigrations(currentVersion, CURRENT_DB_VERSION);
        setDatabaseVersion(this.db, CURRENT_DB_VERSION);
      }

      this.ensureSystemUser();
    } catch (error) {
      console.error('[Database] Initialization failed:', error);
      throw error;
    }
  }

  private runMigrations(from: number, to: number): void {
    executeMigrations(this.db, from, to);
  }

  private ensureSystemUser(): void {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT OR IGNORE INTO users (id, username, email, password_hash, avatar_path, created_at, updated_at, last_login, jwt_secret)
         VALUES (?, ?, NULL, ?, NULL, ?, ?, NULL, NULL)`
      )
      .run(this.defaultUserId, this.defaultUserId, this.systemPasswordPlaceholder, now, now);
  }

  getSystemUser(): IUser | null {
    const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(this.defaultUserId) as IUser | undefined;
    return user ?? null;
  }

  setSystemUserCredentials(username: string, passwordHash: string): void {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE users
         SET username = ?, password_hash = ?, updated_at = ?, created_at = COALESCE(created_at, ?)
         WHERE id = ?`
      )
      .run(username, passwordHash, now, now, this.defaultUserId);
  }
  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * ==================
   * User operations
   * 用户操作
   * ==================
   */

  /**
   * Create a new user in the database
   * 在数据库中创建新用户
   *
   * @param username - Username (unique identifier)
   * @param email - User email (optional)
   * @param passwordHash - Hashed password (use bcrypt)
   * @returns Query result with created user data
   */
  createUser(username: string, email: string | undefined, passwordHash: string): IQueryResult<IUser> {
    try {
      const userId = `user_${Date.now()}`;
      const now = Date.now();

      const stmt = this.db.prepare(`
        INSERT INTO users (id, username, email, password_hash, avatar_path, created_at, updated_at, last_login)
        VALUES (?, ?, ?, ?, NULL, ?, ?, NULL)
      `);

      stmt.run(userId, username, email ?? null, passwordHash, now, now);

      return {
        success: true,
        data: {
          id: userId,
          username,
          email,
          password_hash: passwordHash,
          role: 'user',
          is_active: 1,
          created_by: null,
          updated_by: null,
          created_at: now,
          updated_at: now,
          last_login: null,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user by user ID
   * 通过用户 ID 获取用户信息
   *
   * @param userId - User ID to query
   * @returns Query result with user data or error if not found
   */
  getUser(userId: string): IQueryResult<IUser> {
    try {
      const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as IUser | undefined;

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        data: user,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user by username (used for authentication)
   * 通过用户名获取用户信息（用于身份验证）
   *
   * @param username - Username to query
   * @returns Query result with user data or null if not found
   */
  getUserByUsername(username: string): IQueryResult<IUser | null> {
    try {
      const user = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as IUser | undefined;

      return {
        success: true,
        data: user ?? null,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Get all users (excluding system default user)
   * 获取所有用户（排除系统默认用户）
   *
   * @returns Query result with array of all users ordered by creation time
   */
  getAllUsers(): IQueryResult<IUser[]> {
    try {
      const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at ASC');
      const rows = stmt.all() as IUser[];

      return {
        success: true,
        data: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Get total count of users (excluding system default user)
   * 获取用户总数（排除系统默认用户）
   *
   * @returns Query result with user count
   */
  getUserCount(): IQueryResult<number> {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
      const row = stmt.get() as { count: number };

      return {
        success: true,
        data: row.count,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: 0,
      };
    }
  }

  /**
   * Check if any users exist in the database
   * 检查数据库中是否存在用户
   *
   * @returns Query result with boolean indicating if users exist
   */
  hasUsers(): IQueryResult<boolean> {
    try {
      // 只统计已设置密码的账户，排除尚未完成初始化的占位行
      // Count only accounts with a non-empty password to ignore placeholder entries
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM users WHERE password_hash IS NOT NULL AND TRIM(password_hash) != ''`);
      const row = stmt.get() as { count: number };
      return {
        success: true,
        data: row.count > 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update user's last login timestamp
   * 更新用户的最后登录时间戳
   *
   * @param userId - User ID to update
   * @returns Query result with success status
   */
  updateUserLastLogin(userId: string): IQueryResult<boolean> {
    try {
      const now = Date.now();
      this.db.prepare('UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?').run(now, now, userId);
      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: false,
      };
    }
  }

  /**
   * Update user's password hash
   * 更新用户的密码哈希
   *
   * @param userId - User ID to update
   * @param newPasswordHash - New hashed password (use bcrypt)
   * @returns Query result with success status
   */
  updateUserPassword(userId: string, newPasswordHash: string): IQueryResult<boolean> {
    try {
      const now = Date.now();
      this.db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newPasswordHash, now, userId);
      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: false,
      };
    }
  }

  /**
   * Update user's JWT secret
   * 更新用户的 JWT secret
   */
  updateUserJwtSecret(userId: string, jwtSecret: string): IQueryResult<boolean> {
    try {
      const now = Date.now();
      this.db.prepare('UPDATE users SET jwt_secret = ?, updated_at = ? WHERE id = ?').run(jwtSecret, now, userId);
      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: false,
      };
    }
  }

  /**
   * ==================
   * Case File operations
   * 案件文件操作
   * ==================
   */

  /**
   * Create a new case file
   * 创建新案件文件
   */
  createCaseFile(title: string, userId: string, caseNumber?: string): IQueryResult<ICaseFile> {
    try {
      const caseId = `case_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const now = Date.now();

      // Generate filesystem-safe name from title
      const safeName = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Import required modules
      const os = require('os');
      const JUSTICE_QUEST_WORK_DIR = path.join(os.homedir(), '.justicequest');
      const workspacePath = path.join(JUSTICE_QUEST_WORK_DIR, `${safeName}-${now}`);

      // Create workspace directory
      if (!fs.existsSync(JUSTICE_QUEST_WORK_DIR)) {
        fs.mkdirSync(JUSTICE_QUEST_WORK_DIR, { recursive: true });
      }
      fs.mkdirSync(workspacePath, { recursive: true });

      // Copy template if it exists
      const templatePath = path.join(process.cwd(), 'case-folder-template');
      if (fs.existsSync(templatePath)) {
        const files = fs.readdirSync(templatePath);
        for (const file of files) {
          const srcPath = path.join(templatePath, file);
          const destPath = path.join(workspacePath, file);
          const stat = fs.statSync(srcPath);
          if (stat.isDirectory()) {
            // Recursively copy directories
            fs.cpSync(srcPath, destPath, { recursive: true });
          } else {
            // Copy files
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }

      // Insert into database with workspace_path
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

  /**
   * Get case file by ID
   * 通过 ID 获取案件文件
   */
  getCaseFile(caseFileId: string): IQueryResult<ICaseFile> {
    try {
      const row = this.db.prepare('SELECT * FROM case_files WHERE id = ?').get(caseFileId) as ICaseFileRow | undefined;

      if (!row) {
        return {
          success: false,
          error: 'Case file not found',
        };
      }

      return {
        success: true,
        data: rowToCaseFile(row),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all case files for a user
   * 获取用户的所有案件文件
   *
   * Sorted by most recent activity across:
   * - Case file updates (updated_at)
   * - Conversation activity (conversations.updated_at)
   * - Document uploads (case_documents.uploaded_at)
   */
  getUserCaseFiles(userId: string, page = 0, pageSize = 50): IPaginatedResult<ICaseFile> {
    try {
      const countResult = this.db.prepare('SELECT COUNT(*) as count FROM case_files WHERE user_id = ?').get(userId) as {
        count: number;
      };

      const rows = this.db
        .prepare(
          `
            SELECT
              cf.*,
              MAX(
                cf.updated_at,
                COALESCE((SELECT MAX(updated_at) FROM conversations WHERE case_file_id = cf.id), 0),
                COALESCE((SELECT MAX(uploaded_at) FROM case_documents WHERE case_file_id = cf.id), 0)
              ) as last_activity_at
            FROM case_files cf
            WHERE cf.user_id = ?
            GROUP BY cf.id
            ORDER BY last_activity_at DESC
            LIMIT ? OFFSET ?
          `
        )
        .all(userId, pageSize, page * pageSize) as ICaseFileRow[];

      return {
        data: rows.map(rowToCaseFile),
        total: countResult.count,
        page,
        pageSize,
        hasMore: (page + 1) * pageSize < countResult.count,
      };
    } catch (error: any) {
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
      };
    }
  }

  /**
   * Update case file
   * 更新案件文件
   */
  updateCaseFile(caseFileId: string, updates: Partial<Pick<ICaseFile, 'title' | 'case_number'>>): IQueryResult<ICaseFile> {
    try {
      const now = Date.now();
      const setClauses: string[] = [];
      const values: any[] = [];

      if (updates.title !== undefined) {
        setClauses.push('title = ?');
        values.push(updates.title);
      }

      if (updates.case_number !== undefined) {
        setClauses.push('case_number = ?');
        values.push(updates.case_number);
      }

      if (setClauses.length === 0) {
        return this.getCaseFile(caseFileId);
      }

      setClauses.push('updated_at = ?');
      values.push(now);
      values.push(caseFileId);

      const stmt = this.db.prepare(`
        UPDATE case_files
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...values);

      return this.getCaseFile(caseFileId);
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete case file (and all associated conversations)
   * 删除案件文件（及所有关联的会话）
   */
  deleteCaseFile(caseFileId: string): IQueryResult<boolean> {
    try {
      const stmt = this.db.prepare('DELETE FROM case_files WHERE id = ?');
      const result = stmt.run(caseFileId);

      return {
        success: true,
        data: result.changes > 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        data: false,
      };
    }
  }

  /**
   * ==================
   * Conversation operations
   * ==================
   */

  createConversation(conversation: TChatConversation, userId?: string, caseFileId?: string): IQueryResult<TChatConversation> {
    try {
      if (!caseFileId) {
        return {
          success: false,
          error: 'case_file_id is required',
        };
      }

      const row = conversationToRow(conversation, userId || this.defaultUserId, caseFileId);

      const stmt = this.db.prepare(`
        INSERT INTO conversations (id, user_id, case_file_id, name, type, extra, model, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(row.id, row.user_id, row.case_file_id, row.name, row.type, row.extra, row.model, row.status, row.created_at, row.updated_at);

      return {
        success: true,
        data: conversation,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  getConversation(conversationId: string): IQueryResult<TChatConversation> {
    try {
      const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as IConversationRow | undefined;

      if (!row) {
        return {
          success: false,
          error: 'Conversation not found',
        };
      }

      return {
        success: true,
        data: rowToConversation(row),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  getUserConversations(userId?: string, page = 0, pageSize = 50): IPaginatedResult<TChatConversation> {
    try {
      const finalUserId = userId || this.defaultUserId;

      const countResult = this.db.prepare('SELECT COUNT(*) as count FROM conversations WHERE user_id = ?').get(finalUserId) as {
        count: number;
      };

      const rows = this.db
        .prepare(
          `
            SELECT *
            FROM conversations
            WHERE user_id = ?
            ORDER BY updated_at DESC LIMIT ?
            OFFSET ?
          `
        )
        .all(finalUserId, pageSize, page * pageSize) as IConversationRow[];

      return {
        data: rows.map(rowToConversation),
        total: countResult.count,
        page,
        pageSize,
        hasMore: (page + 1) * pageSize < countResult.count,
      };
    } catch (error: any) {
      console.error('[Database] Get conversations error:', error);
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
      };
    }
  }

  /**
   * Get conversations by case file ID
   * 通过案件文件 ID 获取会话
   */
  getConversationsByCase(caseFileId: string, page = 0, pageSize = 50): IPaginatedResult<TChatConversation> {
    try {
      const countResult = this.db.prepare('SELECT COUNT(*) as count FROM conversations WHERE case_file_id = ?').get(caseFileId) as {
        count: number;
      };

      const rows = this.db
        .prepare(
          `
            SELECT *
            FROM conversations
            WHERE case_file_id = ?
            ORDER BY updated_at DESC
            LIMIT ? OFFSET ?
          `
        )
        .all(caseFileId, pageSize, page * pageSize) as IConversationRow[];

      return {
        data: rows.map(rowToConversation),
        total: countResult.count,
        page,
        pageSize,
        hasMore: (page + 1) * pageSize < countResult.count,
      };
    } catch (error: any) {
      console.error('[Database] Get conversations by case error:', error);
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
      };
    }
  }

  updateConversation(conversationId: string, updates: Partial<TChatConversation>): IQueryResult<boolean> {
    try {
      // Get existing conversation to preserve case_file_id
      const existingRow = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as IConversationRow | undefined;
      if (!existingRow) {
        return {
          success: false,
          error: 'Conversation not found',
        };
      }

      const existing = rowToConversation(existingRow);
      const updated = {
        ...existing,
        ...updates,
        modifyTime: Date.now(),
      } as TChatConversation;
      const row = conversationToRow(updated, existingRow.user_id, existingRow.case_file_id);

      const stmt = this.db.prepare(`
        UPDATE conversations
        SET name       = ?,
            extra      = ?,
            model      = ?,
            status     = ?,
            updated_at = ?
        WHERE id = ?
      `);

      stmt.run(row.name, row.extra, row.model, row.status, row.updated_at, conversationId);

      return {
        success: true,
        data: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  deleteConversation(conversationId: string): IQueryResult<boolean> {
    try {
      const stmt = this.db.prepare('DELETE FROM conversations WHERE id = ?');
      const result = stmt.run(conversationId);

      return {
        success: true,
        data: result.changes > 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * ==================
   * Message operations
   * ==================
   */

  insertMessage(message: TMessage): IQueryResult<TMessage> {
    try {
      const row = messageToRow(message);

      const stmt = this.db.prepare(`
        INSERT INTO messages (id, conversation_id, msg_id, type, content, position, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(row.id, row.conversation_id, row.msg_id, row.type, row.content, row.position, row.status, row.created_at);

      return {
        success: true,
        data: message,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  getConversationMessages(conversationId: string, page = 0, pageSize = 100): IPaginatedResult<TMessage> {
    try {
      const countResult = this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?').get(conversationId) as {
        count: number;
      };

      const rows = this.db
        .prepare(
          `
            SELECT *
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC LIMIT ?
            OFFSET ?
          `
        )
        .all(conversationId, pageSize, page * pageSize) as IMessageRow[];

      return {
        data: rows.map(rowToMessage),
        total: countResult.count,
        page,
        pageSize,
        hasMore: (page + 1) * pageSize < countResult.count,
      };
    } catch (error: any) {
      console.error('[Database] Get messages error:', error);
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
      };
    }
  }

  /**
   * Update a message in the database
   * @param messageId - Message ID to update
   * @param message - Updated message data
   */
  updateMessage(messageId: string, message: TMessage): IQueryResult<boolean> {
    try {
      const row = messageToRow(message);

      const stmt = this.db.prepare(`
        UPDATE messages
        SET type     = ?,
            content  = ?,
            position = ?,
            status   = ?
        WHERE id = ?
      `);

      const result = stmt.run(row.type, row.content, row.position, row.status, messageId);

      return {
        success: true,
        data: result.changes > 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  deleteMessage(messageId: string): IQueryResult<boolean> {
    try {
      const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
      const result = stmt.run(messageId);

      return {
        success: true,
        data: result.changes > 0,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  deleteConversationMessages(conversationId: string): IQueryResult<number> {
    try {
      const stmt = this.db.prepare('DELETE FROM messages WHERE conversation_id = ?');
      const result = stmt.run(conversationId);

      return {
        success: true,
        data: result.changes,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get message by msg_id and conversation_id
   * Used for finding existing messages to update (e.g., streaming text accumulation)
   */
  getMessageByMsgId(conversationId: string, msgId: string): IQueryResult<TMessage | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT *
        FROM messages
        WHERE conversation_id = ?
          AND msg_id = ?
        ORDER BY created_at DESC LIMIT 1
      `);

      const row = stmt.get(conversationId, msgId) as IMessageRow | undefined;

      return {
        success: true,
        data: row ? rowToMessage(row) : null,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Vacuum database to reclaim space
   */
  vacuum(): void {
    this.db.exec('VACUUM');
    console.log('[Database] Vacuum completed');
  }

  /**
   * Execute a raw SQL statement (for user management operations)
   * Use with caution!
   */
  exec(sql: string, ...params: any[]): any {
    return this.db.prepare(sql).run(...params);
  }

  /**
   * Query database (for user management operations)
   */
  query(sql: string, ...params: any[]): any[] {
    return this.db.prepare(sql).all(...params);
  }

  /**
   * Query single row (for user management operations)
   */
  querySingle(sql: string, ...params: any[]): any {
    return this.db.prepare(sql).get(...params);
  }
}

// Export singleton instance
let dbInstance: AionUIDatabase | null = null;

export function getDatabase(): AionUIDatabase {
  if (!dbInstance) {
    dbInstance = new AionUIDatabase();
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
