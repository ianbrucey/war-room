/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type Database from 'better-sqlite3';

/**
 * Migration script definition
 */
export interface IMigration {
  version: number; // Target version after this migration
  name: string; // Migration name for logging
  up: (db: Database.Database) => void; // Upgrade script
  down: (db: Database.Database) => void; // Downgrade script (for rollback)
}

/**
 * Migration v0 -> v1: Initial schema
 * This is handled by initSchema() in schema.ts
 */
const migration_v1: IMigration = {
  version: 1,
  name: 'Initial schema',
  up: (_db) => {
    // Already handled by initSchema()
    console.log('[Migration v1] Initial schema created by initSchema()');
  },
  down: (db) => {
    // Drop all tables (only core tables now)
    db.exec(`
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS conversations;
      DROP TABLE IF EXISTS users;
    `);
    console.log('[Migration v1] Rolled back: All tables dropped');
  },
};

/**
 * Migration v1 -> v2: Add indexes for better performance
 * Example of a schema change migration
 */
const migration_v2: IMigration = {
  version: 2,
  name: 'Add performance indexes',
  up: (db) => {
    db.exec(`
      -- Add composite index for conversation messages lookup
      CREATE INDEX IF NOT EXISTS idx_messages_conv_created_desc
        ON messages(conversation_id, created_at DESC);

      -- Add index for message search by type
      CREATE INDEX IF NOT EXISTS idx_messages_type_created
        ON messages(type, created_at DESC);

      -- Add index for user conversations lookup
      CREATE INDEX IF NOT EXISTS idx_conversations_user_type
        ON conversations(user_id, type);
    `);
    console.log('[Migration v2] Added performance indexes');
  },
  down: (db) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_messages_conv_created_desc;
      DROP INDEX IF EXISTS idx_messages_type_created;
      DROP INDEX IF EXISTS idx_conversations_user_type;
    `);
    console.log('[Migration v2] Rolled back: Removed performance indexes');
  },
};

/**
 * Migration v2 -> v3: Add full-text search support [REMOVED]
 *
 * Note: FTS functionality has been removed as it's not currently needed.
 * Will be re-implemented when search functionality is added to the UI.
 */
const migration_v3: IMigration = {
  version: 3,
  name: 'Add full-text search (skipped)',
  up: (_db) => {
    // FTS removed - will be re-added when search functionality is implemented
    console.log('[Migration v3] FTS support skipped (removed, will be added back later)');
  },
  down: (db) => {
    // Clean up FTS table if it exists from older versions
    db.exec(`
      DROP TABLE IF EXISTS messages_fts;
    `);
    console.log('[Migration v3] Rolled back: Removed full-text search');
  },
};

/**
 * Migration v3 -> v4: Removed (user_preferences table no longer needed)
 */
const migration_v4: IMigration = {
  version: 4,
  name: 'Removed user_preferences table',
  up: (_db) => {
    // user_preferences table removed from schema
    console.log('[Migration v4] Skipped (user_preferences table removed)');
  },
  down: (_db) => {
    console.log('[Migration v4] Rolled back: No-op (user_preferences table removed)');
  },
};

/**
 * Migration v4 -> v5: Remove FTS table
 * Cleanup for FTS removal - ensures all databases have consistent schema
 */
const migration_v5: IMigration = {
  version: 5,
  name: 'Remove FTS table',
  up: (db) => {
    // Remove FTS table created by old v3 migration
    db.exec(`
      DROP TABLE IF EXISTS messages_fts;
    `);
    console.log('[Migration v5] Removed FTS table (cleanup for FTS removal)');
  },
  down: (_db) => {
    // If rolling back, we don't recreate FTS table (it's deprecated)
    console.log('[Migration v5] Rolled back: FTS table remains removed (deprecated feature)');
  },
};

/**
 * Migration v5 -> v6: Add jwt_secret column to users table
 * Store JWT secret per user for better security and management
 */
const migration_v6: IMigration = {
  version: 6,
  name: 'Add jwt_secret to users table',
  up: (db) => {
    // Check if jwt_secret column already exists
    const tableInfo = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    const hasJwtSecret = tableInfo.some((col) => col.name === 'jwt_secret');

    if (!hasJwtSecret) {
      // Add jwt_secret column to users table
      db.exec(`ALTER TABLE users ADD COLUMN jwt_secret TEXT;`);
      console.log('[Migration v6] Added jwt_secret column to users table');
    } else {
      console.log('[Migration v6] jwt_secret column already exists, skipping');
    }
  },
  down: (db) => {
    // SQLite doesn't support DROP COLUMN directly, need to recreate table
    db.exec(`
      CREATE TABLE users_backup AS SELECT id, username, email, password_hash, avatar_path, created_at, updated_at, last_login FROM users;
      DROP TABLE users;
      ALTER TABLE users_backup RENAME TO users;
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    console.log('[Migration v6] Rolled back: Removed jwt_secret column from users table');
  },
};

/**
 * Migration v6 -> v7: Add role-based access control fields
 * Add role, is_active, created_by, updated_by columns for user management
 */
const migration_v7: IMigration = {
  version: 7,
  name: 'Add role-based access control fields',
  up: (db) => {
    // Check which columns already exist
    const tableInfo = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    const existingColumns = new Set(tableInfo.map((col) => col.name));

    // Add role column if it doesn't exist
    if (!existingColumns.has('role')) {
      db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' CHECK(role IN ('super_admin', 'admin', 'user'));`);
      console.log('[Migration v7] Added role column to users table');
    }

    // Add is_active column if it doesn't exist
    if (!existingColumns.has('is_active')) {
      db.exec(`ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;`);
      console.log('[Migration v7] Added is_active column to users table');
    }

    // Add created_by column if it doesn't exist
    if (!existingColumns.has('created_by')) {
      db.exec(`ALTER TABLE users ADD COLUMN created_by TEXT;`);
      console.log('[Migration v7] Added created_by column to users table');
    }

    // Add updated_by column if it doesn't exist
    if (!existingColumns.has('updated_by')) {
      db.exec(`ALTER TABLE users ADD COLUMN updated_by TEXT;`);
      console.log('[Migration v7] Added updated_by column to users table');
    }

    // Set existing admin user to super_admin role
    db.exec(`
      UPDATE users
      SET role = 'super_admin'
      WHERE username = 'admin' OR id = 'system_default_user';
    `);
    console.log('[Migration v7] Set existing admin user to super_admin role');
  },
  down: (db) => {
    // SQLite doesn't support DROP COLUMN easily, need to recreate table
    db.exec(`
      CREATE TABLE users_backup AS
      SELECT id, username, email, password_hash, avatar_path, jwt_secret,
             created_at, updated_at, last_login
      FROM users;

      DROP TABLE users;
      ALTER TABLE users_backup RENAME TO users;

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    console.log('[Migration v7] Rolled back: Removed RBAC columns from users table');
  },
};

/**
 * Migration v7 -> v8: Add case_files table
 * Create case_files table for case management feature
 */
const migration_v8: IMigration = {
  version: 8,
  name: 'Add case_files table',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS case_files (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        case_number TEXT,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_case_files_user_id ON case_files(user_id);
      CREATE INDEX IF NOT EXISTS idx_case_files_created_at ON case_files(created_at DESC);
    `);
    console.log('[Migration v8] Created case_files table');
  },
  down: (db) => {
    db.exec(`
      DROP TABLE IF EXISTS case_files;
    `);
    console.log('[Migration v8] Rolled back: Removed case_files table');
  },
};

/**
 * Migration v8 -> v9: Add case_file_id to conversations
 * Add case_file_id foreign key to conversations and migrate existing data
 */
const migration_v9: IMigration = {
  version: 9,
  name: 'Add case_file_id to conversations',
  up: (db) => {
    // Check if case_file_id column already exists
    const tableInfo = db.prepare('PRAGMA table_info(conversations)').all() as Array<{ name: string }>;
    const hasColumn = tableInfo.some((col) => col.name === 'case_file_id');

    if (!hasColumn) {
      // Step 1: Add case_file_id column as nullable
      db.exec(`ALTER TABLE conversations ADD COLUMN case_file_id TEXT;`);
      console.log('[Migration v9] Added case_file_id column to conversations table');
    }

    // Step 2: Create a "Default Case" for each user who has conversations
    const usersWithConversations = db
      .prepare(
        `
      SELECT DISTINCT user_id FROM conversations WHERE case_file_id IS NULL
    `
      )
      .all() as Array<{ user_id: string }>;

    const now = Date.now();
    const insertCaseStmt = db.prepare(`
      INSERT INTO case_files (id, title, case_number, user_id, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?, ?)
    `);

    const updateConversationsStmt = db.prepare(`
      UPDATE conversations SET case_file_id = ? WHERE user_id = ? AND case_file_id IS NULL
    `);

    for (const { user_id } of usersWithConversations) {
      const caseId = `case_${now}_${user_id.slice(-8)}`;
      insertCaseStmt.run(caseId, 'Default Case', user_id, now, now);
      updateConversationsStmt.run(caseId, user_id);
      console.log(`[Migration v9] Created default case ${caseId} for user ${user_id}`);
    }

    // Step 3: Add foreign key constraint by recreating the table
    // SQLite doesn't support adding FK constraints to existing columns
    db.exec(`
      -- Create new table with FK constraint
      CREATE TABLE conversations_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        case_file_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('gemini', 'acp', 'codex')),
        extra TEXT NOT NULL,
        model TEXT,
        status TEXT CHECK(status IN ('pending', 'running', 'finished')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (case_file_id) REFERENCES case_files(id) ON DELETE CASCADE
      );

      -- Copy data from old table
      INSERT INTO conversations_new
      SELECT id, user_id, case_file_id, name, type, extra, model, status, created_at, updated_at
      FROM conversations;

      -- Drop old table and rename new one
      DROP TABLE conversations;
      ALTER TABLE conversations_new RENAME TO conversations;

      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
      CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conversations_case_file_id ON conversations(case_file_id);
    `);
    console.log('[Migration v9] Added case_file_id foreign key constraint and index');
  },
  down: (db) => {
    // Recreate conversations table without case_file_id
    db.exec(`
      CREATE TABLE conversations_backup AS
      SELECT id, user_id, name, type, extra, model, status, created_at, updated_at
      FROM conversations;

      DROP TABLE conversations;
      ALTER TABLE conversations_backup RENAME TO conversations;

      CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
      CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
    `);
    console.log('[Migration v9] Rolled back: Removed case_file_id from conversations table');
  },
};

/**
 * Migration v9 -> v10: Add workspace_path to case_files
 * Add workspace_path column and create workspace directories for existing cases
 */
const migration_v10: IMigration = {
  version: 10,
  name: 'Add workspace_path to case_files',
  up: (db) => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const JUSTICE_QUEST_WORK_DIR = path.join(os.homedir(), '.justicequest');

    // 1. Add workspace_path column as nullable first
    db.exec(`ALTER TABLE case_files ADD COLUMN workspace_path TEXT;`);
    console.log('[Migration v10] Added workspace_path column to case_files table');

    // 2. For each existing case, generate workspace path and create folder
    const cases = db.prepare('SELECT * FROM case_files').all() as Array<{
      id: string;
      title: string;
      created_at: number;
    }>;

    const updateStmt = db.prepare('UPDATE case_files SET workspace_path = ? WHERE id = ?');

    // Ensure base workspace directory exists
    if (!fs.existsSync(JUSTICE_QUEST_WORK_DIR)) {
      fs.mkdirSync(JUSTICE_QUEST_WORK_DIR, { recursive: true });
    }

    for (const caseFile of cases) {
      // Generate filesystem-safe name
      const safeName = caseFile.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const timestamp = caseFile.created_at;
      const workspacePath = path.join(JUSTICE_QUEST_WORK_DIR, `${safeName}-${timestamp}`);

      // Create directory
      try {
        fs.mkdirSync(workspacePath, { recursive: true });

        // Copy template if it exists
        const templatePath = path.join(process.cwd(), 'case-folder-template');
        if (fs.existsSync(templatePath)) {
          // Copy all files from template
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

        updateStmt.run(workspacePath, caseFile.id);
        console.log(`[Migration v10] Created workspace for case ${caseFile.id}: ${workspacePath}`);
      } catch (error) {
        console.error(`[Migration v10] Failed to create workspace for case ${caseFile.id}:`, error);
        // Continue with other cases even if one fails
      }
    }

    // 3. Make workspace_path NOT NULL by recreating the table
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
    console.log('[Migration v10] Made workspace_path NOT NULL and recreated indexes');
  },
  down: (db) => {
    // Recreate table without workspace_path column
    db.exec(`
      CREATE TABLE case_files_backup AS
      SELECT id, title, case_number, user_id, created_at, updated_at
      FROM case_files;
      
      DROP TABLE case_files;
      ALTER TABLE case_files_backup RENAME TO case_files;
      
      CREATE INDEX IF NOT EXISTS idx_case_files_user_id ON case_files(user_id);
      CREATE INDEX IF NOT EXISTS idx_case_files_created_at ON case_files(created_at DESC);
    `);
    console.log('[Migration v10] Rolled back: Removed workspace_path from case_files table');
  },
};

/**
 * Migration v11: Add case_documents table for document intake system
 */
const migration_v11: IMigration = {
  version: 11,
  name: 'Add case_documents table',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS case_documents (
        id TEXT PRIMARY KEY,
        case_file_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        folder_name TEXT NOT NULL,
        document_type TEXT,
        file_type TEXT NOT NULL,
        page_count INTEGER,
        word_count INTEGER,

        processing_status TEXT DEFAULT 'pending' CHECK(processing_status IN ('pending', 'extracting', 'analyzing', 'indexing', 'complete', 'failed')),
        has_text_extraction INTEGER DEFAULT 0,
        has_metadata INTEGER DEFAULT 0,
        rag_indexed INTEGER DEFAULT 0,

        file_search_store_id TEXT,
        gemini_file_uri TEXT,

        uploaded_at INTEGER NOT NULL,
        processed_at INTEGER,

        FOREIGN KEY (case_file_id) REFERENCES case_files(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_case_documents_case_file_id ON case_documents(case_file_id);
      CREATE INDEX IF NOT EXISTS idx_case_documents_status ON case_documents(processing_status);
      CREATE INDEX IF NOT EXISTS idx_case_documents_type ON case_documents(document_type);
      CREATE INDEX IF NOT EXISTS idx_case_documents_uploaded_at ON case_documents(uploaded_at DESC);

      ALTER TABLE case_files ADD COLUMN file_search_store_id TEXT;
    `);
    console.log('[Migration v11] Added case_documents table and file_search_store_id to case_files');
  },
  down: (db) => {
    db.exec(`
      DROP TABLE IF EXISTS case_documents;

      CREATE TABLE case_files_backup (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        case_number TEXT,
        workspace_path TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      INSERT INTO case_files_backup (id, title, case_number, workspace_path, user_id, created_at, updated_at)
      SELECT id, title, case_number, workspace_path, user_id, created_at, updated_at
      FROM case_files;

      DROP TABLE case_files;
      ALTER TABLE case_files_backup RENAME TO case_files;

      CREATE INDEX IF NOT EXISTS idx_case_files_user_id ON case_files(user_id);
      CREATE INDEX IF NOT EXISTS idx_case_files_created_at ON case_files(created_at DESC);
    `);
    console.log('[Migration v11] Rolled back: Removed case_documents table and file_search_store_id column');
  },
};

/**
 * Migration v12: Add S3 storage columns to case_documents
 * These columns track S3 storage metadata for each document
 */
const migration_v12: IMigration = {
  version: 12,
  name: 'Add S3 storage columns to case_documents',
  up: (db) => {
    // Check which columns already exist
    const tableInfo = db.prepare('PRAGMA table_info(case_documents)').all() as Array<{ name: string }>;
    const existingColumns = new Set(tableInfo.map((col) => col.name));

    // Add s3_key column if it doesn't exist
    if (!existingColumns.has('s3_key')) {
      db.exec(`ALTER TABLE case_documents ADD COLUMN s3_key TEXT;`);
      console.log('[Migration v12] Added s3_key column to case_documents');
    }

    // Add s3_bucket column if it doesn't exist
    if (!existingColumns.has('s3_bucket')) {
      db.exec(`ALTER TABLE case_documents ADD COLUMN s3_bucket TEXT;`);
      console.log('[Migration v12] Added s3_bucket column to case_documents');
    }

    // Add s3_uploaded_at column if it doesn't exist
    if (!existingColumns.has('s3_uploaded_at')) {
      db.exec(`ALTER TABLE case_documents ADD COLUMN s3_uploaded_at INTEGER;`);
      console.log('[Migration v12] Added s3_uploaded_at column to case_documents');
    }

    // Add s3_version_id column if it doesn't exist
    if (!existingColumns.has('s3_version_id')) {
      db.exec(`ALTER TABLE case_documents ADD COLUMN s3_version_id TEXT;`);
      console.log('[Migration v12] Added s3_version_id column to case_documents');
    }

    // Add content_type column if it doesn't exist
    if (!existingColumns.has('content_type')) {
      db.exec(`ALTER TABLE case_documents ADD COLUMN content_type TEXT;`);
      console.log('[Migration v12] Added content_type column to case_documents');
    }

    // Add file_size_bytes column if it doesn't exist
    if (!existingColumns.has('file_size_bytes')) {
      db.exec(`ALTER TABLE case_documents ADD COLUMN file_size_bytes INTEGER;`);
      console.log('[Migration v12] Added file_size_bytes column to case_documents');
    }

    // Add index for S3 key lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_case_documents_s3_key ON case_documents(s3_key);
    `);
    console.log('[Migration v12] Added S3 storage columns and index to case_documents table');
  },
  down: (db) => {
    // Recreate table without S3 columns (SQLite doesn't support DROP COLUMN easily)
    db.exec(`
      DROP INDEX IF EXISTS idx_case_documents_s3_key;
      
      CREATE TABLE case_documents_backup (
        id TEXT PRIMARY KEY,
        case_file_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        folder_name TEXT NOT NULL,
        document_type TEXT,
        file_type TEXT NOT NULL,
        page_count INTEGER,
        word_count INTEGER,
        processing_status TEXT DEFAULT 'pending' CHECK(processing_status IN ('pending', 'extracting', 'analyzing', 'indexing', 'complete', 'failed')),
        has_text_extraction INTEGER DEFAULT 0,
        has_metadata INTEGER DEFAULT 0,
        rag_indexed INTEGER DEFAULT 0,
        file_search_store_id TEXT,
        gemini_file_uri TEXT,
        uploaded_at INTEGER NOT NULL,
        processed_at INTEGER,
        FOREIGN KEY (case_file_id) REFERENCES case_files(id) ON DELETE CASCADE
      );
      
      INSERT INTO case_documents_backup
      SELECT id, case_file_id, filename, folder_name, document_type, file_type,
             page_count, word_count, processing_status, has_text_extraction,
             has_metadata, rag_indexed, file_search_store_id, gemini_file_uri,
             uploaded_at, processed_at
      FROM case_documents;
      
      DROP TABLE case_documents;
      ALTER TABLE case_documents_backup RENAME TO case_documents;
      
      CREATE INDEX IF NOT EXISTS idx_case_documents_case_file_id ON case_documents(case_file_id);
      CREATE INDEX IF NOT EXISTS idx_case_documents_status ON case_documents(processing_status);
      CREATE INDEX IF NOT EXISTS idx_case_documents_type ON case_documents(document_type);
      CREATE INDEX IF NOT EXISTS idx_case_documents_uploaded_at ON case_documents(uploaded_at DESC);
    `);
    console.log('[Migration v12] Rolled back: Removed S3 storage columns from case_documents');
  },
};

/**
 * Migration v14: Add case summary tracking columns to case_files
 * These columns track the status and metadata of AI-generated case summaries
 */
const migration_v14: IMigration = {
  version: 14,
  name: 'Add case summary tracking columns to case_files',
  up: (db) => {
    // Check which columns already exist
    const tableInfo = db.prepare('PRAGMA table_info(case_files)').all() as Array<{ name: string }>;
    const existingColumns = new Set(tableInfo.map((col) => col.name));

    // Add case_summary_status column if it doesn't exist
    if (!existingColumns.has('case_summary_status')) {
      db.exec(`ALTER TABLE case_files ADD COLUMN case_summary_status TEXT DEFAULT NULL CHECK(case_summary_status IS NULL OR case_summary_status IN ('generating', 'generated', 'stale', 'failed'));`);
      console.log('[Migration v14] Added case_summary_status column to case_files');
    }

    // Add case_summary_generated_at column if it doesn't exist
    if (!existingColumns.has('case_summary_generated_at')) {
      db.exec(`ALTER TABLE case_files ADD COLUMN case_summary_generated_at INTEGER DEFAULT NULL;`);
      console.log('[Migration v14] Added case_summary_generated_at column to case_files');
    }

    // Add case_summary_version column if it doesn't exist
    if (!existingColumns.has('case_summary_version')) {
      db.exec(`ALTER TABLE case_files ADD COLUMN case_summary_version INTEGER DEFAULT 0;`);
      console.log('[Migration v14] Added case_summary_version column to case_files');
    }

    // Add case_summary_document_count column if it doesn't exist
    if (!existingColumns.has('case_summary_document_count')) {
      db.exec(`ALTER TABLE case_files ADD COLUMN case_summary_document_count INTEGER DEFAULT 0;`);
      console.log('[Migration v14] Added case_summary_document_count column to case_files');
    }

    // Add index for summary status lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_case_files_summary_status ON case_files(case_summary_status);
    `);
    console.log('[Migration v14] Added case summary tracking columns and index to case_files table');
  },
  down: (db) => {
    // Note: SQLite doesn't support DROP COLUMN directly
    // For rollback, we would need to recreate the table without these columns
    // For now, we'll just log a warning
    console.warn('[Migration v14 Rollback] SQLite does not support DROP COLUMN. Manual intervention required.');
    console.warn('[Migration v14 Rollback] Columns to remove: case_summary_status, case_summary_generated_at, case_summary_version, case_summary_document_count');

    // Drop the index
    db.exec(`DROP INDEX IF EXISTS idx_case_files_summary_status;`);
    console.log('[Migration v14 Rollback] Dropped idx_case_files_summary_status index');
  },
};

/**
 * Migration v14 -> v15: Add case grounding tracking
 * Add narrative_updated_at and grounding_status columns to case_files table
 */
const migration_v15: IMigration = {
  version: 15,
  name: 'Add case grounding tracking',
  up: (db) => {
    // Get existing columns to avoid duplicate column errors
    const existingColumns = new Set(
      db
        .prepare(`PRAGMA table_info(case_files)`)
        .all()
        .map((col: any) => col.name)
    );

    // Add narrative_updated_at column if it doesn't exist
    if (!existingColumns.has('narrative_updated_at')) {
      db.exec(`ALTER TABLE case_files ADD COLUMN narrative_updated_at INTEGER DEFAULT NULL;`);
      console.log('[Migration v15] Added narrative_updated_at column to case_files');
    }

    // Add grounding_status column if it doesn't exist
    if (!existingColumns.has('grounding_status')) {
      db.exec(`ALTER TABLE case_files ADD COLUMN grounding_status TEXT DEFAULT 'ungrounded';`);
      console.log('[Migration v15] Added grounding_status column to case_files');
    }

    // Add index for grounding status lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_case_files_grounding_status ON case_files(grounding_status);
    `);
    console.log('[Migration v15] Added case grounding tracking columns and index to case_files table');
  },
  down: (db) => {
    // Note: SQLite doesn't support DROP COLUMN directly
    // For rollback, we would need to recreate the table without these columns
    console.warn('[Migration v15 Rollback] SQLite does not support DROP COLUMN. Manual intervention required.');
    console.warn('[Migration v15 Rollback] Columns to remove: narrative_updated_at, grounding_status');

    // Drop the index
    db.exec(`DROP INDEX IF EXISTS idx_case_files_grounding_status;`);
    console.log('[Migration v15 Rollback] Dropped idx_case_files_grounding_status index');
  },
};

/**
 * All migrations in order
 */
export const ALL_MIGRATIONS: IMigration[] = [migration_v1, migration_v2, migration_v3, migration_v4, migration_v5, migration_v6, migration_v7, migration_v8, migration_v9, migration_v10, migration_v11, migration_v12, migration_v14, migration_v15];

/**
 * Get migrations needed to upgrade from one version to another
 */
export function getMigrationsToRun(fromVersion: number, toVersion: number): IMigration[] {
  return ALL_MIGRATIONS.filter((m) => m.version > fromVersion && m.version <= toVersion).sort((a, b) => a.version - b.version);
}

/**
 * Get migrations needed to downgrade from one version to another
 */
export function getMigrationsToRollback(fromVersion: number, toVersion: number): IMigration[] {
  return ALL_MIGRATIONS.filter((m) => m.version > toVersion && m.version <= fromVersion).sort((a, b) => b.version - a.version);
}

/**
 * Run migrations in a transaction
 */
export function runMigrations(db: Database.Database, fromVersion: number, toVersion: number): void {
  if (fromVersion === toVersion) {
    console.log('[Migrations] Already at target version');
    return;
  }

  if (fromVersion > toVersion) {
    throw new Error(`[Migrations] Downgrade not supported in production. Use rollbackMigration() for testing only.`);
  }

  const migrations = getMigrationsToRun(fromVersion, toVersion);

  if (migrations.length === 0) {
    console.log(`[Migrations] No migrations needed from v${fromVersion} to v${toVersion}`);
    return;
  }

  console.log(`[Migrations] Running ${migrations.length} migrations from v${fromVersion} to v${toVersion}`);

  // Run all migrations in a single transaction
  const runAll = db.transaction(() => {
    for (const migration of migrations) {
      try {
        console.log(`[Migrations] Running migration v${migration.version}: ${migration.name}`);
        migration.up(db);

        console.log(`[Migrations] ✓ Migration v${migration.version} completed`);
      } catch (error) {
        console.error(`[Migrations] ✗ Migration v${migration.version} failed:`, error);
        throw error; // Transaction will rollback
      }
    }
  });

  try {
    runAll();
    console.log(`[Migrations] All migrations completed successfully`);
  } catch (error) {
    console.error('[Migrations] Migration failed, all changes rolled back:', error);
    throw error;
  }
}

/**
 * Rollback migrations (for testing/emergency use)
 * WARNING: This can cause data loss!
 */
export function rollbackMigrations(db: Database.Database, fromVersion: number, toVersion: number): void {
  if (fromVersion <= toVersion) {
    throw new Error('[Migrations] Cannot rollback to a higher or equal version');
  }

  const migrations = getMigrationsToRollback(fromVersion, toVersion);

  if (migrations.length === 0) {
    console.log(`[Migrations] No rollback needed from v${fromVersion} to v${toVersion}`);
    return;
  }

  console.log(`[Migrations] Rolling back ${migrations.length} migrations from v${fromVersion} to v${toVersion}`);
  console.warn('[Migrations] WARNING: This may cause data loss!');

  // Run all rollbacks in a single transaction
  const rollbackAll = db.transaction(() => {
    for (const migration of migrations) {
      try {
        console.log(`[Migrations] Rolling back migration v${migration.version}: ${migration.name}`);
        migration.down(db);

        console.log(`[Migrations] ✓ Rollback v${migration.version} completed`);
      } catch (error) {
        console.error(`[Migrations] ✗ Rollback v${migration.version} failed:`, error);
        throw error; // Transaction will rollback
      }
    }
  });

  try {
    rollbackAll();
    console.log(`[Migrations] All rollbacks completed successfully`);
  } catch (error) {
    console.error('[Migrations] Rollback failed:', error);
    throw error;
  }
}

/**
 * Get migration history
 * Now simplified - just returns the current version
 */
export function getMigrationHistory(db: Database.Database): Array<{ version: number; name: string; timestamp: number }> {
  const currentVersion = db.pragma('user_version', { simple: true }) as number;

  // Return a simple array with just the current version
  return [
    {
      version: currentVersion,
      name: `Current schema version`,
      timestamp: Date.now(),
    },
  ];
}

/**
 * Check if a specific migration has been applied
 * Now simplified - checks if current version >= target version
 */
export function isMigrationApplied(db: Database.Database, version: number): boolean {
  const currentVersion = db.pragma('user_version', { simple: true }) as number;
  return currentVersion >= version;
}
