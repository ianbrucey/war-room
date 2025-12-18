# Implementation Plan: Case Grounding

## Sequencing: Backend-Out

All changes follow the "Backend-Out" principle: Database → Services → IPC → Frontend

---

## Phase 1: Database & Repository (Backend Foundation)

### Ticket 1.1: Database Migration
**Files:** `src/process/database/migrations/xxx_add_narrative_tracking.ts`

- Add `narrative_updated_at` column to `case_files` table
- Add `grounding_status` column to `case_files` table
- Add index on `grounding_status`

**Acceptance Criteria:**
- Migration runs without error
- Columns exist with correct types
- Rollback works cleanly

### Ticket 1.2: CaseFileRepository Enhancement
**Files:** `src/process/database/repositories/CaseFileRepository.ts`

- Add `updateNarrativeTimestamp(caseFileId: string, timestamp: number)`
- Add `getGroundingStatus(caseFileId: string)`
- Add `updateGroundingStatus(caseFileId: string, status: string)`
- Modify existing staleness check to include narrative timestamp

**Acceptance Criteria:**
- Repository methods return expected values per `03-fixtures.json`
- Staleness detection triggers when `narrative_updated_at > case_summary_generated_at`

---

## Phase 2: Services Layer

### Ticket 2.1: NarrativeService (New)
**Files:** `src/process/documents/services/NarrativeService.ts`

- `saveNarrative(caseFileId, content, captureMethod)` → writes `user_narrative.md`
- `getNarrativeStatus(caseFileId)` → checks if file exists, returns metadata
- `loadNarrative(caseFileId)` → reads and parses `user_narrative.md`

**Acceptance Criteria:**
- File created at correct location with frontmatter
- Timestamps updated in database via CaseFileRepository

### Ticket 2.2: PartyExtractor (New)
**Files:** `src/process/documents/services/PartyExtractor.ts`

- `extractParties(narrativeContent)` → uses Gemini to identify parties
- `saveParties(caseFileId, parties)` → writes `parties.json`

**Acceptance Criteria:**
- Extracted parties match structure in `02-api-contract.json`
- parties.json created at `{workspace}/case-context/parties.json`

### Ticket 2.3: CaseSummaryGenerator Enhancement
**Files:** `src/process/documents/services/CaseSummaryGenerator.ts`

- Modify `generate()` to read `user_narrative.md` if exists
- Modify `generate()` to read `parties.json` if exists
- Update prompt to incorporate narrative as "user intent"

**Acceptance Criteria:**
- Summary generation works with narrative only
- Summary generation works with documents only
- Summary generation works with both (preferred path)
- Generated summary references narrative themes

---

## Phase 3: IPC Bridge

### Ticket 3.1: Grounding IPC Methods
**Files:** `src/process/ipc/caseGroundingBridge.ts` (new), `src/common/ipcBridge.ts`

- Implement IPC methods from `02-api-contract.json`:
  - `caseGrounding.getNarrativeStatus`
  - `caseGrounding.saveNarrative`
  - `caseGrounding.getGroundingStatus`
  - `caseGrounding.extractParties`

**Acceptance Criteria:**
- All methods callable from renderer process
- Responses match contract schema
- Error handling follows existing IPC patterns

---

## Phase 4: Frontend Components

### Ticket 4.1: CaseGroundingCard Component
**Files:** `src/renderer/components/CaseGroundingCard/index.tsx`

- Implement component per `04-ui-specs.md`
- Wire up to IPC methods for status
- Handle dismiss state (session storage)

**Acceptance Criteria:**
- Displays correct status from backend
- Actions trigger correct flows
- Dismiss persists for session

### Ticket 4.2: ChatLayout Integration
**Files:** `src/renderer/pages/conversation/ChatLayout.tsx`

- Inject CaseGroundingCard into middle panel
- Priority logic: Grounding card → File preview → Empty state

**Acceptance Criteria:**
- Card shows when not grounded
- Card hides when file is being previewed
- Card respects dismiss state

### Ticket 4.3: Narrative Mode in Chat
**Files:** `src/renderer/pages/conversation/gemini/GeminiChat.tsx` (or unified chat)

- Add `isNarrativeMode` state
- Add narrative mode header indicator
- Buffer messages when in narrative mode
- Call `saveNarrative` on exit

**Acceptance Criteria:**
- Visual indicator shows when active
- Messages buffered and concatenated
- Saved to correct file on complete

---

## Phase 5: Case Selection Flow Update

### Ticket 5.1: Auto-Create First Conversation
**Files:** `src/renderer/pages/cases/CaseSelection.tsx`

- When selecting case with no conversations:
  - Auto-create a default conversation
  - Navigate directly to conversation (skip Guid)

**Acceptance Criteria:**
- New cases skip Guid page
- Conversation created with sensible defaults
- Grounding card visible on arrival

---

## Estimated Effort

| Phase | Tickets | Estimated Hours |
|-------|---------|-----------------|
| 1. Database | 2 | 3-4 |
| 2. Services | 3 | 6-8 |
| 3. IPC | 1 | 2-3 |
| 4. Frontend | 3 | 8-10 |
| 5. Flow Update | 1 | 2-3 |
| **Total** | **10** | **21-28 hours** |

---

## Risk Areas

1. **Gemini prompt engineering** for party extraction - may need iteration
2. **Narrative mode state management** - ensure clean exit on edge cases
3. **Migration on existing data** - test with real case folders

