# Upload Case Files Feature - Specification Package

## Overview

This specification package defines the "Upload Case Files" feature for AionUI - a full-screen modal interface for bulk document upload with real-time progress tracking.

## Package Contents

### 1. **00-Brief.md** - Feature Specification
- Executive summary and business context
- Success criteria and acceptance criteria
- Functional requirements (FR1-FR6)
- Non-functional requirements (NFR1-NFR3)
- Technical constraints and dependencies
- Risks and mitigations

**Key Highlights:**
- Reuses existing document intake API and WebSocket infrastructure
- Follows established UI patterns (ModalWrapper, useDragUpload)
- Supports bulk uploads with real-time progress tracking
- Integrates seamlessly with existing processing pipeline

### 2. **01-implementation-plan.md** - Task Breakdown
- 10 atomic, sequenceable tasks
- Backend-Out sequencing (verify APIs → build UI → integrate)
- Detailed acceptance criteria for each task
- Testing strategy and estimated effort (14 hours)

**Task Phases:**
1. **Phase 1:** Backend Verification (Tasks 1-2)
2. **Phase 2:** Core UI Components (Tasks 3-5)
3. **Phase 3:** Real-Time Updates (Tasks 6-7)
4. **Phase 4:** Integration & Polish (Tasks 8-10)

### 3. **02-reusable-components.md** - Existing Infrastructure
- Complete inventory of reusable backend APIs
- Existing frontend components and hooks
- WebSocket progress system documentation
- Database types and interfaces

**Reuse Ratio: ~70%**
- ✅ Document upload/list/get APIs
- ✅ WebSocket progress events
- ✅ Modal, drag-drop, file processing components
- ❌ Need to build: Modal UI, document list, progress indicators

### 4. **03-ui-component-structure.md** - Component Architecture
- Component hierarchy and relationships
- Props interfaces and state management
- Event flow diagrams
- Accessibility and performance considerations

**Key Components:**
- `UploadCaseFilesModal` - Main modal container
- `DropzoneSection` - Drag-and-drop upload zone
- `DocumentListSection` - Paginated document list
- `DocumentListItem` - Individual document row
- `ProgressIndicator` - Visual progress bar
- `useWebSocketProgress` - WebSocket integration hook

### 5. **04-html-mockup.html** - Visual Reference
- Interactive HTML mockup of the complete UI
- Demonstrates layout, styling, and interactions
- Shows all document states (pending, processing, complete, failed)
- Includes workspace panel context

**To View:**
```bash
open context-engine/specs/upload-case-files-modal/04-html-mockup.html
```

## Quick Start Guide

### For Product Managers
1. Read `00-Brief.md` for feature overview and requirements
2. Review `04-html-mockup.html` for visual design
3. Approve acceptance criteria before development starts

### For Developers
1. Read `01-implementation-plan.md` for task breakdown
2. Review `02-reusable-components.md` to understand existing infrastructure
3. Study `03-ui-component-structure.md` for component architecture
4. Follow tasks sequentially, testing each before moving to next

### For QA Engineers
1. Extract acceptance criteria from `01-implementation-plan.md`
2. Use `04-html-mockup.html` as visual reference for testing
3. Verify WebSocket events using browser DevTools
4. Test error scenarios defined in Task 10

## Technical Stack

### Frontend
- **Framework:** React + TypeScript
- **Styling:** UnoCSS utility classes
- **UI Library:** Arco Design (`@arco-design/web-react`)
- **Icons:** Icon Park (`@icon-park/react`)
- **State:** React hooks (useState, useEffect, useCallback)

### Backend
- **Server:** Express (port 25808)
- **File Upload:** Multer middleware
- **WebSocket:** ws library
- **Database:** SQLite (case_documents table)
- **Processing:** Mistral API (text extraction) + Gemini API (analysis + indexing)

## Key Design Decisions

### 1. Full-Screen Modal
**Rationale:** Bulk upload is a focused task that benefits from dedicated screen space. Full-screen modal provides:
- Maximum space for dropzone and document list
- Clear visual separation from main application
- Reduced cognitive load during upload process

### 2. Real-Time Progress via WebSocket
**Rationale:** Document processing can take 30-60 seconds per file. Real-time updates:
- Provide immediate feedback to users
- Reduce perceived wait time
- Allow users to monitor multiple uploads simultaneously
- Enable early detection of errors

### 3. Pagination (10 docs/page)
**Rationale:** Cases can have 100+ documents. Pagination:
- Maintains UI performance with large document sets
- Reduces initial load time
- Provides clear navigation structure
- Prevents overwhelming users with too much information

### 4. Reuse Existing Infrastructure
**Rationale:** The document intake pipeline already exists. Reusing it:
- Reduces development time by ~70%
- Ensures consistency with existing functionality
- Minimizes risk of introducing bugs
- Leverages battle-tested code

## Success Metrics

### User Experience
- [ ] Users can upload 10 documents in < 2 minutes
- [ ] Progress updates appear within 500ms of status change
- [ ] Modal opens in < 200ms
- [ ] Zero learning curve for drag-and-drop

### Technical Performance
- [ ] Handles 1000+ documents without performance degradation
- [ ] Supports files up to 100MB without timeout
- [ ] WebSocket reconnection works seamlessly
- [ ] No race conditions with simultaneous uploads

### Business Impact
- [ ] Reduces time to upload case documents by 80%
- [ ] Increases user satisfaction with document management
- [ ] Enables bulk document processing workflows
- [ ] Provides visibility into document processing status

## Dependencies

### Required Before Development
- ✅ Document intake API functional (`POST /api/cases/:caseFileId/documents/upload`)
- ✅ WebSocket server running and accessible
- ✅ Case file exists in database
- ✅ User authentication working (JWT tokens)

### Required During Development
- Node.js 18+ and npm
- TypeScript 5+
- React 18+
- Access to Mistral API (text extraction)
- Access to Gemini API (analysis + indexing)

## Testing Checklist

### Unit Tests
- [ ] Modal open/close behavior
- [ ] File upload logic
- [ ] WebSocket event handling
- [ ] Pagination logic
- [ ] Progress calculation

### Integration Tests
- [ ] End-to-end upload flow
- [ ] Real-time progress updates
- [ ] Error handling
- [ ] WebSocket reconnection

### Manual Tests
- [ ] Drag-and-drop multiple files
- [ ] Click-to-browse file selection
- [ ] Progress updates in real-time
- [ ] Pagination navigation
- [ ] Filter tabs functionality
- [ ] Modal dismissal (X button, ESC, click outside)
- [ ] Error scenarios (network failure, invalid file type, file too large)

## Next Steps

1. **Review & Approve** - Product team reviews specification package
2. **Kickoff Meeting** - Development team reviews implementation plan
3. **Task Assignment** - Assign tasks 1-10 to developers
4. **Development** - Execute tasks sequentially with testing
5. **QA Testing** - Comprehensive testing against acceptance criteria
6. **User Acceptance** - Product team validates against requirements
7. **Deployment** - Release to production

## Questions & Clarifications

### Open Questions
- Should we support drag-and-drop of folders (recursive upload)?
- Should we allow document deletion from the modal?
- Should we show document preview on click?
- Should we support batch operations (delete all, retry all)?

### Assumptions
- Users have stable internet connection for WebSocket
- Files are uploaded one at a time (not parallel)
- Document processing happens asynchronously on backend
- Users can close modal while uploads are in progress

## Contact

For questions or clarifications about this specification:
- **Product:** [Product Manager Name]
- **Engineering:** [Tech Lead Name]
- **Design:** [Designer Name]

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-13  
**Status:** Ready for Development

