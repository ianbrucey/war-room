-- Schema Changes for Case Grounding Feature
-- Run via migration in src/process/database/migrations/

-- ============================================================================
-- MIGRATION: Add narrative tracking to case_files table
-- ============================================================================

-- Add column to track when user narrative was last modified
-- This enables staleness detection without filesystem stat calls
ALTER TABLE case_files ADD COLUMN narrative_updated_at INTEGER DEFAULT NULL;

-- Add column to track grounding status (for quick UI queries)
-- Values: 'ungrounded' | 'narrative_only' | 'docs_only' | 'grounded'
ALTER TABLE case_files ADD COLUMN grounding_status TEXT DEFAULT 'ungrounded';

-- ============================================================================
-- NOTES
-- ============================================================================

-- Existing columns we leverage (no changes needed):
--   case_summary_status: 'generated' | 'generating' | 'stale' | 'failed' | NULL
--   case_summary_generated_at: INTEGER (timestamp)
--   workspace_path: TEXT (path to case folder)

-- Staleness Logic (in CaseFileRepository):
--   Summary is stale IF:
--     (narrative_updated_at > case_summary_generated_at) OR
--     (new documents added since last summary)
--
--   The existing staleness check in FileSearchIndexer.ts handles documents.
--   We need to ADD a check for narrative_updated_at.

-- ============================================================================
-- INDEXES (Optional, for performance)
-- ============================================================================

-- Index for quick grounding status queries (e.g., dashboard showing ungrounded cases)
CREATE INDEX IF NOT EXISTS idx_case_files_grounding_status 
  ON case_files(grounding_status);

