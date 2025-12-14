# Cleanup Google File Search Stores

**Purpose:** Remove lingering File Search stores created during development/testing.

**Status:** Ready to use

---

## Quick Start

### 1. Preview What Will Be Deleted (Recommended First Step)

```bash
# Dry run - shows what would be deleted without actually deleting
./scripts/cleanup-file-search-stores.sh --dry-run
```

### 2. Delete with Confirmation

```bash
# Delete all stores matching "store-" pattern (default)
./scripts/cleanup-file-search-stores.sh
```

You'll be prompted to confirm before deletion.

### 3. Delete Without Confirmation

```bash
# Delete all stores matching "store-" pattern without prompt
./scripts/cleanup-file-search-stores.sh --force
```

---

## Advanced Usage

### Delete Stores Matching Specific Pattern

```bash
# Delete only stores starting with "test-"
./scripts/cleanup-file-search-stores.sh --pattern test- --force

# Delete only stores starting with "dev-"
./scripts/cleanup-file-search-stores.sh --pattern dev- --force

# Delete ALL stores (no pattern filter)
./scripts/cleanup-file-search-stores.sh --pattern "" --force
```

### Combine Options

```bash
# Preview deletion of stores matching "case-"
./scripts/cleanup-file-search-stores.sh --pattern case- --dry-run

# Delete stores matching "case-" without confirmation
./scripts/cleanup-file-search-stores.sh --pattern case- --force
```

---

## Prerequisites

### 1. Set Gemini API Key

The script requires your Gemini API key. Set it one of these ways:

**Option A: Environment Variable**
```bash
export GEMINI_API_KEY='your-api-key-here'
./scripts/cleanup-file-search-stores.sh
```

**Option B: Load from .env**
```bash
source .env
./scripts/cleanup-file-search-stores.sh
```

**Option C: Inline**
```bash
GEMINI_API_KEY='your-api-key-here' ./scripts/cleanup-file-search-stores.sh
```

### 2. Ensure Script is Executable

```bash
chmod +x scripts/cleanup-file-search-stores.sh
```

---

## What It Does

### Discovery Phase
1. Connects to Google Gemini API
2. Lists all File Search stores in your project
3. Filters by pattern (default: "store-")
4. Shows matching stores with details

### Deletion Phase (if confirmed)
1. Deletes each matching store with `force: true`
2. Reports success/failure for each store
3. Shows summary statistics

---

## Output Examples

### Dry Run Output
```
🔍 Discovering File Search stores...

Found 3 File Search store(s):

Stores matching pattern "store-":

1. fileSearchStores/store-case-abc123
   Display Name: Case ABC123
   Created: 2025-12-14T10:30:00Z

2. fileSearchStores/store-case-def456
   Display Name: Case DEF456
   Created: 2025-12-14T11:45:00Z

3. fileSearchStores/store-test-xyz789
   Display Name: Test Store
   Created: 2025-12-14T12:00:00Z

📋 DRY RUN: Would delete 3 store(s)
```

### Deletion Output
```
🗑️  Deleting 3 store(s)...

✅ Deleted: fileSearchStores/store-case-abc123
✅ Deleted: fileSearchStores/store-case-def456
✅ Deleted: fileSearchStores/store-test-xyz789

📊 Summary:
   ✅ Deleted: 3
   ❌ Failed: 0
   Total: 3
```

---

## Error Handling

### API Key Not Set
```
❌ Error: GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY environment variable not set
```

**Solution:** Set your API key (see Prerequisites section)

### No Stores Found
```
✅ No File Search stores found. Nothing to clean up.
```

**Meaning:** Your project has no File Search stores to delete.

### Deletion Failed
```
❌ Failed to delete fileSearchStores/store-xyz:
    Error: Permission denied
```

**Possible Causes:**
- Invalid API key
- Insufficient permissions
- Store doesn't exist (already deleted)

---

## TypeScript Script

If you prefer to run the TypeScript script directly:

```bash
# Dry run
npx ts-node scripts/cleanup-file-search-stores.ts --dry-run

# Delete with confirmation
npx ts-node scripts/cleanup-file-search-stores.ts

# Delete without confirmation
npx ts-node scripts/cleanup-file-search-stores.ts --force

# Delete stores matching pattern
npx ts-node scripts/cleanup-file-search-stores.ts --pattern test- --force
```

---

## Safety Features

✅ **Dry Run Mode** - Preview deletions without making changes  
✅ **Confirmation Prompt** - Requires user confirmation before deletion  
✅ **Pattern Filtering** - Only delete stores matching specified pattern  
✅ **Error Reporting** - Shows which stores failed to delete  
✅ **Summary Statistics** - Reports total deleted/failed

---

## When to Use This Script

### Scenarios
- **Development Cleanup** - Remove test stores after development
- **Testing Cleanup** - Clean up stores created during testing
- **Fresh Start** - Clear all File Search stores before production
- **Troubleshooting** - Remove orphaned stores causing issues

### NOT Recommended For
- ❌ Production environments with active data
- ❌ Shared projects without coordination
- ❌ Without backup/verification of data

---

## Related Documentation

- [File Search Deletion Notes](../specs/document-intake/file-search-deletion-notes.md)
- [File Search API Docs](https://ai.google.dev/gemini-api/docs/file-search)
- [Document Intake Architecture](../domain-contexts/document-intake-architecture.md)

