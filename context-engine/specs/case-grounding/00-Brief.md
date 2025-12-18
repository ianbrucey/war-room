# Feature Brief: Case Grounding & Narrative Capture

**Status:** Approved  
**Author:** Planning Session (Augment + User)  
**Created:** 2024-12-18

---

## Problem Statement

Users can upload documents and generate case summaries, but the AI has no understanding of the user's perspective, intent, or desired outcome. This leads to:

1. **Misinterpreted evidence** — Documents analyzed in isolation, missing context only the user can provide
2. **Generic summaries** — Case summaries that read like document inventories rather than case narratives
3. **No grounding** — The agent starts "cold" without understanding what the user is trying to achieve

---

## Success Criteria (The Verdict)

1. ✅ User can tell their story via voice or text before/after document upload
2. ✅ Narrative is persisted to `case-context/user_narrative.md`
3. ✅ Parties are auto-extracted from narrative to `case-context/parties.json`
4. ✅ Case summary generation incorporates narrative + parties + documents
5. ✅ Summary becomes stale when narrative OR documents change
6. ✅ Non-blocking UX — user can skip grounding and proceed if desired

---

## Scope

### In Scope
- Narrative capture workflow via chat
- `user_narrative.md` file creation and persistence
- Party extraction from narrative
- Enhanced `CaseSummaryGenerator` to read narrative
- Staleness detection for narrative changes
- CaseGroundingCard UI component in ChatLayout middle panel

### Out of Scope (Deferred)
- User annotations on individual documents (see `FUTURE-user-annotations.md`)
- Guided interview wizard/form (using chat instead)
- Multi-phase document intake workflow (existing pipeline sufficient)

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Capture UI | Chat panel (not form) | Leverages existing voice/text infrastructure, feels conversational |
| Entry point | ChatLayout middle panel | Visible on all case pages, not just first entry |
| File location | `case-context/` folder | Alongside case_summary.md, not in documents/ |
| Grounding trigger | Non-blocking card | User can dismiss and proceed without grounding |
| Staleness tracking | Timestamp comparison | Simple, sufficient for MVP |
| Route after case select | Direct to conversation (remove Guid for new cases) | Grounding is case-level, not conversation-level |

---

## Workflow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ User opens case                                                  │
├─────────────────────────────────────────────────────────────────┤
│ IF no conversations exist:                                       │
│   → Auto-create first conversation, navigate there               │
│                                                                   │
│ ChatLayout middle panel checks grounding status:                 │
│   - narrative exists? (user_narrative.md)                        │
│   - documents uploaded? (document count > 0)                     │
│   - summary generated? (case_summary.md)                         │
│                                                                   │
│ IF not fully grounded:                                           │
│   → Show CaseGroundingCard with checklist                        │
│                                                                   │
│ User clicks "Tell Your Story":                                   │
│   → Chat enters NARRATIVE_MODE                                   │
│   → Agent follows protocols/NARRATIVE_CAPTURE.md                 │
│   → On complete: Save to case-context/user_narrative.md          │
│   → Post-process: Extract parties to parties.json                │
│                                                                   │
│ User triggers "Generate Summary":                                │
│   → CaseSummaryGenerator reads:                                  │
│     1. user_narrative.md (user intent)                           │
│     2. parties.json (extracted parties)                          │
│     3. All document metadata.json files                          │
│   → Outputs: case_summary.md                                     │
│                                                                   │
│ On ANY context change:                                           │
│   → Mark summary stale                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack Constraints

- **Framework:** React + TypeScript (Electron renderer)
- **Chat:** Existing SendBox + useAudioRecorder hook
- **Backend:** Gemini CLI for AI operations
- **Database:** SQLite via better-sqlite3
- **IPC:** Custom ipcBridge pattern

---

## Dependencies

- Existing `CaseSummaryGenerator.ts` (to be enhanced)
- Existing `useAudioRecorder.ts` (voice input)
- Existing `ChatLayout.tsx` (middle panel injection point)
- New `protocols/NARRATIVE_CAPTURE.md` (agent instructions)

