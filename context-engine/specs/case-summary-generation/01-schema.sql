-- Case Summary Generation - Database Schema Changes
-- Migration v14: Add case summary tracking fields to case_files table

-- ============================================================================
-- MIGRATION: v14_add_case_summary_fields
-- ============================================================================

-- Add summary status tracking columns to case_files table
-- Status values: NULL (never generated), 'generating', 'generated', 'stale', 'failed'
ALTER TABLE case_files ADD COLUMN case_summary_status TEXT DEFAULT NULL
  CHECK(case_summary_status IS NULL OR case_summary_status IN ('generating', 'generated', 'stale', 'failed'));

-- Timestamp of when summary was last successfully generated (Unix milliseconds)
ALTER TABLE case_files ADD COLUMN case_summary_generated_at INTEGER DEFAULT NULL;

-- Version counter for summary (increments on each successful generation)
ALTER TABLE case_files ADD COLUMN case_summary_version INTEGER DEFAULT 0;

-- Count of documents included in the last generated summary
-- Used to detect if new documents were added (staleness check)
ALTER TABLE case_files ADD COLUMN case_summary_document_count INTEGER DEFAULT 0;

-- ============================================================================
-- INDICES
-- ============================================================================

-- Index for querying cases by summary status (e.g., find all stale summaries)
CREATE INDEX IF NOT EXISTS idx_case_files_summary_status ON case_files(case_summary_status);

-- ============================================================================
-- EXAMPLE QUERIES
-- ============================================================================

-- Get summary status for a case
-- SELECT id, title, case_summary_status, case_summary_generated_at, case_summary_version
-- FROM case_files WHERE id = ?;

-- Find all cases with stale summaries
-- SELECT id, title FROM case_files WHERE case_summary_status = 'stale';

-- Update status to generating
-- UPDATE case_files SET case_summary_status = 'generating' WHERE id = ?;

-- Mark summary as generated
-- UPDATE case_files 
-- SET case_summary_status = 'generated',
--     case_summary_generated_at = ?,
--     case_summary_version = case_summary_version + 1,
--     case_summary_document_count = ?
-- WHERE id = ?;

-- Mark summary as stale (called when new document completes processing)
-- UPDATE case_files 
-- SET case_summary_status = 'stale' 
-- WHERE id = ? AND case_summary_status = 'generated';

-- Mark summary as failed
-- UPDATE case_files SET case_summary_status = 'failed' WHERE id = ?;

-- ============================================================================
-- TYPESCRIPT INTERFACE CHANGES (for reference)
-- ============================================================================

-- Add to ICaseFile interface in src/common/storage.ts:
-- 
-- export interface ICaseFile {
--   id: string;
--   title: string;
--   case_number?: string | null;
--   workspace_path: string;
--   user_id: string;
--   created_at: number;
--   updated_at: number;
--   // NEW: Case Summary Fields
--   case_summary_status?: 'generating' | 'generated' | 'stale' | 'failed' | null;
--   case_summary_generated_at?: number | null;
--   case_summary_version?: number;
--   case_summary_document_count?: number;
-- }

-- Add to ICaseFileRow interface in src/process/database/types.ts:
--
-- export interface ICaseFileRow {
--   id: string;
--   title: string;
--   case_number?: string | null;
--   workspace_path: string;
--   user_id: string;
--   created_at: number;
--   updated_at: number;
--   // NEW: Case Summary Fields
--   case_summary_status?: string | null;
--   case_summary_generated_at?: number | null;
--   case_summary_version?: number | null;
--   case_summary_document_count?: number | null;
-- }

-- ============================================================================
-- STALENESS TRIGGER (Application Logic - NOT SQL Trigger)
-- ============================================================================

-- When DocumentRepository.updateStatus(documentId, 'complete') is called:
-- 1. Get the case_file_id from the document
-- 2. Check if case has summary status = 'generated'
-- 3. If yes, update status to 'stale'
--
-- This logic goes in DocumentRepository.ts, NOT as a SQL trigger
-- (SQLite triggers don't work well with our ORM pattern)

