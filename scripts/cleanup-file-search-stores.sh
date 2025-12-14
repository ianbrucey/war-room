#!/bin/bash

# Cleanup Script: Delete Lingering Google File Search Stores
# 
# This script discovers and deletes any existing File Search stores
# that may have been created during development/testing.
#
# Usage:
#   ./scripts/cleanup-file-search-stores.sh [--dry-run] [--pattern <pattern>] [--force]
#
# Options:
#   --dry-run    Show what would be deleted without actually deleting
#   --pattern    Only delete stores matching pattern (e.g., "store-" or "test-")
#   --force      Skip confirmation prompt
#
# Examples:
#   # Preview what would be deleted
#   ./scripts/cleanup-file-search-stores.sh --dry-run
#
#   # Delete all stores matching "store-" pattern (with confirmation)
#   ./scripts/cleanup-file-search-stores.sh
#
#   # Delete all stores matching "test-" pattern without confirmation
#   ./scripts/cleanup-file-search-stores.sh --pattern test- --force
#
#   # Delete all stores (no pattern filter)
#   ./scripts/cleanup-file-search-stores.sh --pattern "" --force

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if we're in the right directory
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  echo "❌ Error: Could not find package.json. Are you in the project root?"
  exit 1
fi

# Load .env file if it exists and API key not already set
if [ -z "$GEMINI_API_KEY" ] && [ -z "$GOOGLE_GEMINI_API_KEY" ]; then
  if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
  fi
fi

# Check if GEMINI_API_KEY is set after loading .env
if [ -z "$GEMINI_API_KEY" ] && [ -z "$GOOGLE_GEMINI_API_KEY" ]; then
  echo "❌ Error: GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY environment variable not set"
  echo ""
  echo "Please set your API key:"
  echo "  export GEMINI_API_KEY='your-api-key'"
  echo ""
  echo "Or load from .env file:"
  echo "  source .env"
  exit 1
fi

# Run the TypeScript script
cd "$PROJECT_ROOT"
npx ts-node "$SCRIPT_DIR/cleanup-file-search-stores.ts" "$@"

