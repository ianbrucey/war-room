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
    const usersWithConversations = db.prepare(`
      SELECT DISTINCT user_id FROM conversations WHERE case_file_id IS NULL
    `).all() as Array<{ user_id: string }>;

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
 * All migrations in order
 */
export const ALL_MIGRATIONS: IMigration[] = [
  migration_v1,
  migration_v2,
  migration_v3,
  migration_v4,
  migration_v5,
  migration_v6,
  migration_v7,
  migration_v8,
  migration_v9,
];


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
