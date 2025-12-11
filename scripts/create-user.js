#!/usr/bin/env node
/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

const BetterSqlite3 = require('better-sqlite3');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
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

// Ensure directory exists
function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Hash password using bcrypt
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

// Generate a random password
function generateRandomPassword() {
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each required character type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Create a new user
 */
async function createUser(options) {
  let db = null;
  
  try {
    // Get database path
    const dbPath = path.join(getDataPath(), 'aionui.db');
    
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    ensureDirectory(dir);
    
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
    
    // Validate role
    const validRoles = ['super_admin', 'admin', 'user'];
    if (!validRoles.includes(options.role)) {
      console.error(`\n❌ Invalid role. Must be one of: ${validRoles.join(', ')}\n`);
      process.exit(1);
    }
    
    // Check if username already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(options.username);
    if (existing) {
      console.error(`\n❌ User '${options.username}' already exists\n`);
      process.exit(1);
    }
    
    // Generate password if not provided
    const password = options.password || generateRandomPassword();
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create user
    const userId = `user_${Date.now()}`;
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(userId, options.username, options.email || null, passwordHash, options.role, now, now);
    
    // Success!
    console.log('\n✅ User created successfully!\n');
    console.log('━'.repeat(60));
    console.log(`  Username:  ${options.username}`);
    console.log(`  Email:     ${options.email || 'N/A'}`);
    console.log(`  Role:      ${options.role}`);
    console.log(`  Password:  ${password}`);
    console.log('━'.repeat(60));
    console.log('\n⚠️  Save these credentials securely!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating user:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
const options = {
  username: null,
  email: null,
  role: 'user',
  password: null
};

for (const arg of args) {
  if (arg.startsWith('--username=')) {
    options.username = arg.split('=')[1];
  } else if (arg.startsWith('--email=')) {
    options.email = arg.split('=')[1];
  } else if (arg.startsWith('--role=')) {
    options.role = arg.split('=')[1];
  } else if (arg.startsWith('--password=')) {
    options.password = arg.split('=')[1];
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: npm run user:create -- [options]

Options:
  --username=<name>     Username (required)
  --email=<email>       Email address (optional)
  --role=<role>         User role: super_admin, admin, or user (default: user)
  --password=<pass>     Password (optional, will be auto-generated if not provided)
  --help, -h            Show this help message

Examples:
  # Create a super admin
  npm run user:create -- --username=admin --role=super_admin

  # Create an admin with email
  npm run user:create -- --username=jane --email=jane@firm.com --role=admin

  # Create a regular user with custom password
  npm run user:create -- --username=john --password=MySecure123!
`);
    process.exit(0);
  }
}

// Validate required arguments
if (!options.username) {
  console.error('\n❌ Error: --username is required\n');
  console.log('Run with --help for usage information\n');
  process.exit(1);
}

// Run the creation
createUser(options);
