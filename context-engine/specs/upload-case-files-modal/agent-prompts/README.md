# Agent Prompt Documents - Upload Case Files Feature

## Overview

This directory contains detailed prompt documents for 3 agents to implement the "Upload Case Files" feature in parallel. Each agent has a specific focus area with clear tasks and acceptance criteria.

## Agent Assignments

### 🤖 Agent 1: Modal Component & Dropzone
**File:** `AGENT-1-MODAL-COMPONENT.md`

**Responsibilities:**
- Create `UploadCaseFilesModal` component shell
- Implement `DropzoneSection` with drag-and-drop
- Add file upload logic to backend API
- Handle multiple file uploads

**Key Deliverables:**
- `src/renderer/components/UploadCaseFilesModal/index.tsx`
- `src/renderer/components/UploadCaseFilesModal/DropzoneSection.tsx`
- `src/renderer/components/UploadCaseFilesModal/styles.css`

**Estimated Time:** 4-5 hours

---

### 🤖 Agent 2: Document List & Progress Tracking
**File:** `AGENT-2-DOCUMENT-LIST.md`

**Responsibilities:**
- Create `useWebSocketProgress` hook for real-time updates
- Build `DocumentListSection` with tabs and pagination
- Create `DocumentListItem` component with progress indicators
- Implement `ProgressIndicator` component
- Integrate WebSocket events

**Key Deliverables:**
- `src/renderer/hooks/useWebSocketProgress.ts`
- `src/renderer/components/UploadCaseFilesModal/DocumentListSection.tsx`
- `src/renderer/components/UploadCaseFilesModal/DocumentListItem.tsx`
- `src/renderer/components/UploadCaseFilesModal/ProgressIndicator.tsx`

**Estimated Time:** 5-6 hours

---

### 🤖 Agent 3: Integration & Polish
**File:** `AGENT-3-INTEGRATION.md`

**Responsibilities:**
- Add upload button to workspace panel
- Implement preview functionality
- Implement download functionality (may need backend endpoint)
- Add comprehensive error handling
- Add loading states
- Add internationalization support

**Key Deliverables:**
- Updated `src/renderer/pages/conversation/ChatWorkspace.tsx`
- Preview/download handlers
- Error handling logic
- Backend download endpoint (if needed)
- i18n translations

**Estimated Time:** 4-5 hours

---

## Execution Strategy

### Option 1: Sequential (Recommended for Single Developer)
1. Complete Agent 1 tasks first
2. Then complete Agent 2 tasks
3. Finally complete Agent 3 tasks
4. Test end-to-end

**Total Time:** 13-16 hours

### Option 2: Parallel (Recommended for Team)
1. Assign each agent prompt to a different developer
2. Agents 1 and 2 can work in parallel
3. Agent 3 starts after Agents 1 and 2 are ~80% complete
4. Integration testing at the end

**Total Time:** 6-8 hours (with 3 developers)

---

## Dependencies Between Agents

```
Agent 1 (Modal Shell)
    ↓
Agent 2 (Document List) ← Can start when Agent 1 has basic structure
    ↓
Agent 3 (Integration) ← Needs both Agent 1 and Agent 2 complete
```

**Agent 2 can start when Agent 1 has:**
- Modal component shell created
- Props interface defined
- Basic state management in place

**Agent 3 can start when:**
- Agent 1 has upload functionality working
- Agent 2 has document list rendering

---

## Testing Strategy

### Unit Testing (Each Agent)
- Agent 1: Test dropzone, file validation, upload logic
- Agent 2: Test WebSocket hook, pagination, filtering
- Agent 3: Test preview, download, error handling

### Integration Testing (After All Agents)
- End-to-end upload flow
- Real-time progress updates
- Preview and download
- Error scenarios
- WebSocket reconnection

### Manual Testing Checklist
See `AGENT-3-INTEGRATION.md` for comprehensive testing checklist.

---

## Common Resources

All agents should read:
- `../00-Brief.md` - Feature requirements
- `../02-reusable-components.md` - Existing infrastructure
- `../03-ui-component-structure.md` - Component architecture
- `../04-html-mockup.html` - Visual reference

---

## Communication Between Agents

### Agent 1 → Agent 2
**Handoff:** Modal component with props interface and state management

**What Agent 2 needs from Agent 1:**
```typescript
interface UploadCaseFilesModalProps {
  visible: boolean;
  caseFileId: string;
  onClose: () => void;
}

// State structure:
const [documents, setDocuments] = useState<ICaseDocument[]>([]);
const [uploading, setUploading] = useState<Map<string, number>>(new Map());
```

### Agent 2 → Agent 3
**Handoff:** Document list components and WebSocket hook

**What Agent 3 needs from Agent 2:**
```typescript
// Exported components:
export { DocumentListSection } from './DocumentListSection';
export { DocumentListItem } from './DocumentListItem';
export { ProgressIndicator } from './ProgressIndicator';

// Exported hook:
export { useWebSocketProgress } from '@/renderer/hooks/useWebSocketProgress';
```

---

## Key Design Decisions

### 1. Two Tabs Only
- **"Documents"** - Shows all documents
- **"Failed"** - Shows only failed documents
- Rationale: Simplifies UI, focuses on actionable items

### 2. Preview/Download for Completed Docs
- Only show action buttons when `processing_status === 'complete'`
- Preview shows extracted text and analysis
- Download retrieves original file

### 3. Real-Time Updates via WebSocket
- Subscribe to case file updates when modal opens
- Listen for `document:progress` events
- Update UI immediately when status changes

### 4. Pagination (10 docs/page)
- Prevents performance issues with large document sets
- Provides clear navigation
- Maintains fast UI responsiveness

---

## Troubleshooting

### Common Issues

**Issue:** WebSocket not connecting
- Check that WebSocket server is running
- Verify `window.__websocket` is available
- Check browser console for connection errors

**Issue:** Upload fails with 401
- Verify auth token is in localStorage
- Check token expiration
- Re-authenticate if needed

**Issue:** Progress updates not appearing
- Verify WebSocket subscription is active
- Check that `caseFileId` matches
- Look for `document:progress` events in DevTools

**Issue:** Modal not opening
- Check that `visible` prop is being set to `true`
- Verify modal is rendered in component tree
- Check for JavaScript errors in console

---

## Success Criteria

The feature is complete when:
- ✅ All 3 agents have completed their tasks
- ✅ All acceptance criteria are met
- ✅ Manual testing checklist is complete
- ✅ No console errors or warnings
- ✅ UI matches the HTML mockup
- ✅ Real-time progress updates work
- ✅ Preview and download work
- ✅ Error handling is comprehensive
- ✅ Code follows existing patterns

---

## Next Steps

1. **Review** all agent prompt documents
2. **Assign** agents to developers (or work sequentially)
3. **Execute** tasks according to agent prompts
4. **Test** after each agent completes
5. **Integrate** all components together
6. **Final testing** with comprehensive checklist
7. **Deploy** to production

---

## Questions?

For clarifications:
- Review the main specification documents in parent directory
- Check existing codebase for similar patterns
- Test API endpoints with curl before implementing UI
- Use browser DevTools to debug WebSocket events

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-13  
**Total Estimated Time:** 13-16 hours (sequential) or 6-8 hours (parallel)

