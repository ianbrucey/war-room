#!/usr/bin/env node
/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

const BetterSqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Get data path (same logic as the app)
function getDataPath() {
  const appName = 'AionUi';
  const platform = process.platform;
  
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName, 'aionui');
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName, 'aionui');
  } else {
    return path.join(os.homedir(), '.config', appName, 'aionui');
  }
}

/**
 * List all users in the system
 */
function listUsers() {
  let db = null;
  
  try {
    // Get database path
    const dbPath = path.join(getDataPath(), 'aionui.db');
    
    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      console.error('\n❌ Database not found');
      console.log('\nPlease run AionUi at least once to initialize the database:');
      console.log('  npm run webui\n');
      process.exit(1);
    }
    
    // Connect to database
    db = new BetterSqlite3(dbPath);
    
    // Check if users table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    
    if (!tableExists) {
      console.error('\n❌ Database is not initialized yet');
      console.log('\nPlease run AionUi at least once to initialize the database:');
      console.log('  npm run webui\n');
      process.exit(1);
    }
    
    // Get all users
    const users = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all();
    
    if (users.length === 0) {
      console.log('\n📋 No users found\n');
      process.exit(0);
    }
    
    // Display users in a table
    console.log('\n📋 Users:\n');
    console.log('━'.repeat(100));
    console.log(
      'Username'.padEnd(20),
      'Email'.padEnd(30),
      'Role'.padEnd(15),
      'Active'.padEnd(10),
      'Last Login'
    );
    console.log('━'.repeat(100));
    
    users.forEach(user => {
      const lastLogin = user.last_login 
        ? new Date(user.last_login).toLocaleString()
        : 'Never';
      
      console.log(
        user.username.padEnd(20),
        (user.email || 'N/A').padEnd(30),
        (user.role || 'user').padEnd(15),
        (user.is_active ? '✅ Yes' : '❌ No').padEnd(10),
        lastLogin
      );
    });
    
    console.log('━'.repeat(100));
    console.log(`\nTotal: ${users.length} user${users.length === 1 ? '' : 's'}\n`);
    
    // Show role breakdown
    const roleCount = users.reduce((acc, user) => {
      const role = user.role || 'user';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Role Breakdown:');
    Object.entries(roleCount).forEach(([role, count]) => {
      console.log(`  ${role}: ${count}`);
    });
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error listing users:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: npm run user:list

Lists all users in the system with their roles and status.

No options required.
`);
  process.exit(0);
}

// Run the list command
listUsers();
