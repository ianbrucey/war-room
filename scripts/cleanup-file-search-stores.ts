#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cleanup Script: Delete Lingering Google File Search Stores
 *
 * This script discovers and deletes any existing File Search stores
 * that may have been created during development/testing.
 *
 * Usage:
 *   npx ts-node scripts/cleanup-file-search-stores.ts [--dry-run] [--pattern <pattern>]
 *
 * Options:
 *   --dry-run    Show what would be deleted without actually deleting
 *   --pattern    Only delete stores matching pattern (e.g., "store-" or "test-")
 *   --force      Skip confirmation prompt
 */

import { GoogleGenAI } from '@google/genai';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const forceDelete = args.includes('--force');
const patternArg = args.find((arg, i) => args[i - 1] === '--pattern');
const pattern = patternArg || 'store-'; // Default pattern

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🔍 Discovering File Search stores...\n');

  const ai = new GoogleGenAI({ apiKey });

  try {
    // List all file search stores
    const stores = await ai.fileSearchStores.list();
    const storeList: any[] = [];

    for await (const store of stores) {
      storeList.push(store);
    }

    if (storeList.length === 0) {
      console.log('✅ No File Search stores found. Nothing to clean up.');
      return;
    }

    console.log(`Found ${storeList.length} File Search store(s):\n`);

    // Filter by pattern if specified
    const storesToDelete = storeList.filter((store) => {
      const displayName = store.config?.displayName || store.name || '';
      return displayName.includes(pattern) || store.name.includes(pattern);
    });

    if (storesToDelete.length === 0) {
      console.log(`✅ No stores matching pattern "${pattern}" found.`);
      console.log('\nAll stores:');
      storeList.forEach((store) => {
        console.log(`  - ${store.name} (${store.config?.displayName || 'no display name'})`);
      });
      return;
    }

    console.log(`Stores matching pattern "${pattern}":\n`);
    storesToDelete.forEach((store, index) => {
      console.log(`${index + 1}. ${store.name}`);
      console.log(`   Display Name: ${store.config?.displayName || 'N/A'}`);
      console.log(`   Created: ${store.createTime || 'N/A'}`);
      console.log();
    });

    if (isDryRun) {
      console.log(`\n📋 DRY RUN: Would delete ${storesToDelete.length} store(s)`);
      return;
    }

    // Confirm deletion
    if (!forceDelete) {
      console.log(`⚠️  This will DELETE ${storesToDelete.length} File Search store(s).`);
      console.log('   This action cannot be undone.\n');

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      return new Promise<void>((resolve) => {
        rl.question('Continue? (yes/no): ', async (answer: string) => {
          rl.close();

          if (answer.toLowerCase() !== 'yes') {
            console.log('\n❌ Cancelled.');
            resolve();
            return;
          }

          await deleteStores(ai, storesToDelete);
          resolve();
        });
      });
    } else {
      await deleteStores(ai, storesToDelete);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function deleteStores(ai: any, stores: any[]) {
  console.log(`\n🗑️  Deleting ${stores.length} store(s)...\n`);

  let deleted = 0;
  let failed = 0;

  for (const store of stores) {
    try {
      await ai.fileSearchStores.delete({
        name: store.name,
        config: { force: true },
      });

      console.log(`✅ Deleted: ${store.name}`);
      deleted++;
    } catch (error) {
      console.error(`❌ Failed to delete ${store.name}:`, error instanceof Error ? error.message : error);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Deleted: ${deleted}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Total: ${deleted + failed}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

