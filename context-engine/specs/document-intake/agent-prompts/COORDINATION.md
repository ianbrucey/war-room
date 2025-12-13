# Document Intake Implementation: Agent Coordination Guide

## Overview
This document outlines the parallel execution strategy for implementing the document intake system across 3 agents, with a lead agent (you) coordinating and reviewing their work.

## Document Structure

All agents should load documents in this order:
1. **SHARED-CONTEXT.md** - Project fundamentals (required for all agents)
2. **Agent-specific prompt** - Their assigned tickets and requirements
3. **Task plan** - Full architectural details
4. **Reference files** - Code patterns and examples

---

## Execution Strategy

### Wave-Based Parallel Execution
Agents work in **5 waves**, with synchronization points between waves to ensure dependencies are met.

```
Wave 1: [COMPLETE] ✅
  - Ticket 1: Database Migration v11 (Lead Agent)

Wave 2: [3 agents parallel]
  - Agent 1: Tickets 2, 4 (Interfaces, Repository)
  - Agent 2: Tickets 3, 5 (HTTP Endpoints, TextExtractor)
  - Agent 3: Tickets 6, 7 (Mistral OCR, pdf-parse)

Wave 3: [3 agents parallel]
  - Agent 1: Ticket 8 (File Type Detector)
  - Agent 2: Ticket 9 (Manifest Generator)
  - Agent 3: Ticket 10 (Summarization Prompt)

Wave 4: [3 agents parallel]
  - Agent 1: Ticket 11 (DocumentAnalyzer)
  - Agent 2: Ticket 12 (Retry Logic)
  - Agent 3: Tickets 13, 14, 15 (File Search, Metadata Filter, Agent Tools)

Wave 5: [3 agents parallel]
  - Agent 1: Ticket 16 (WebSocket Progress)
  - Agent 2: Ticket 17 (Integration Tests)
  - Agent 3: Ticket 18 (E2E Tests)
```

---

## Agent Assignments

### Agent 1: Foundation & Core Services
**Tickets:** 2, 4, 8, 11, 16
**Focus:** Infrastructure, database, utilities, core services
**Deliverables:**
- TypeScript interfaces
- Document repository
- File type detector
- Document analyzer
- WebSocket progress

### Agent 2: HTTP Endpoints & Orchestration
**Tickets:** 3, 5, 9, 12, 17
**Focus:** API layer, orchestration, error handling, testing
**Deliverables:**
- HTTP upload endpoint
- Text extraction orchestrator
- Manifest generator
- Retry logic
- Integration tests

### Agent 3: Extraction Handlers & RAG Integration
**Tickets:** 6, 7, 10, 13, 14, 15, 18
**Focus:** Extraction implementations, AI integration, agent tools
**Deliverables:**
- Mistral OCR handler
- pdf-parse fallback
- Summarization prompt
- File Search indexer
- Metadata filtering
- Agent tools
- E2E tests

---

## Lead Agent (You): Review Protocol

### After Each Wave

**1. Collect Deliverables**
- Request all files from each agent
- Verify all expected files are present

**2. Code Review Checklist**
For each file, verify:
- [ ] Compiles without TypeScript errors
- [ ] Follows AionUI code patterns
- [ ] Proper error handling (try/catch)
- [ ] Async/await (no callbacks)
- [ ] Proper typing (no `any`)
- [ ] Logging with `[DocumentIntake]` prefix
- [ ] JSDoc comments on public APIs
- [ ] Matches task plan specifications

**3. Integration Testing**
- [ ] Files integrate with existing codebase
- [ ] Database operations work correctly
- [ ] HTTP endpoints respond properly
- [ ] External API calls succeed (or mock correctly)
- [ ] WebSocket events emit correctly

**4. Dependency Verification**
- [ ] Agent 1's interfaces used by Agents 2 & 3
- [ ] Agent 1's repository used by all agents
- [ ] Agent 2's orchestrator calls Agent 3's handlers
- [ ] All imports resolve correctly

**5. Standards Compliance**
- [ ] Uses `better-sqlite3` for database
- [ ] Uses Gemini SDK (not CLI)
- [ ] Uses Mistral API correctly
- [ ] Follows Express.js patterns
- [ ] Proper authentication on routes

---

## Review Commands

### Compile Check
```bash
cd /Users/ianbruce/code/aionui
npm run build
```

### Run Tests
```bash
npm test -- src/process/documents/__tests__
```

### Database Migration Test
```bash
# Start app and verify migration runs
npm run dev
# Check database version
sqlite3 ~/.justicequest/aionui.db "PRAGMA user_version;"
# Should return: 11
```

### Manual Integration Test
```bash
# Upload a test document
curl -X POST http://localhost:3000/api/cases/{caseFileId}/documents/upload \
  -H "Authorization: Bearer {token}" \
  -F "file=@test.pdf"

# Check processing status
curl http://localhost:3000/api/documents/{documentId} \
  -H "Authorization: Bearer {token}"
```

---

## Common Issues & Fixes

### Issue: TypeScript Compilation Errors
**Fix:** Check imports, ensure all types are exported, verify interface definitions

### Issue: Database Errors
**Fix:** Verify migration ran, check table schema, ensure foreign keys exist

### Issue: API Integration Failures
**Fix:** Check API keys in environment, verify request format, check rate limits

### Issue: File Path Errors
**Fix:** Verify workspace directory exists, check file permissions, use absolute paths

### Issue: WebSocket Not Emitting
**Fix:** Verify WebSocket server running, check room names, ensure events registered

---

## Approval Criteria

### Wave 2 Approval
- [ ] All interfaces compile
- [ ] Repository CRUD operations work
- [ ] HTTP endpoints respond
- [ ] TextExtractor orchestrates correctly
- [ ] Mistral OCR extracts text
- [ ] pdf-parse fallback works

### Wave 3 Approval
- [ ] File type detection accurate
- [ ] Manifest generates correctly
- [ ] Summarization prompt produces valid JSON

### Wave 4 Approval
- [ ] DocumentAnalyzer calls Gemini successfully
- [ ] Retry logic handles failures
- [ ] File Search indexes documents
- [ ] Metadata filtering works
- [ ] Agent tools query correctly

### Wave 5 Approval
- [ ] WebSocket events emit during processing
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Full pipeline works end-to-end

---

## Final Integration Checklist

Before marking the feature complete:

- [ ] All 18 tickets implemented
- [ ] All files compile without errors
- [ ] All tests pass
- [ ] Database migration applied successfully
- [ ] HTTP endpoints work via Postman/curl
- [ ] Document upload → extraction → analysis → indexing works
- [ ] AI agents can query documents
- [ ] WebSocket progress updates work
- [ ] Error handling graceful
- [ ] Logging comprehensive
- [ ] Code follows AionUI standards
- [ ] Documentation updated (if needed)

---

## Communication Protocol

### Agent Submission Format
Each agent should submit:
1. List of files created/modified
2. Brief description of changes
3. Any issues encountered
4. Dependencies on other agents
5. Test results (if applicable)

### Lead Agent Feedback Format
For each agent:
1. Files reviewed
2. Issues found (with line numbers)
3. Required changes
4. Approval status (Approved / Changes Requested)

---

## Timeline Estimate

- **Wave 2:** 6-8 hours (parallel)
- **Wave 3:** 2-3 hours (parallel)
- **Wave 4:** 6-8 hours (parallel)
- **Wave 5:** 3-4 hours (parallel)
- **Review & Integration:** 2-3 hours per wave

**Total:** ~20-26 hours of agent work + ~10 hours review = **30-36 hours**

With 3 agents working in parallel: **2-3 days** to completion.

---

## Success Metrics

The implementation is successful when:
1. ✅ All 18 tickets complete
2. ✅ Full pipeline tested end-to-end
3. ✅ AI agents can query documents
4. ✅ Code quality meets standards
5. ✅ No critical bugs
6. ✅ Performance acceptable (< 30s per document)
7. ✅ Error handling robust
8. ✅ Documentation complete

