# Component Architecture - Upload Case Files Modal

## Component Tree

```
UploadCaseFilesModal (index.tsx)
│
├── ModalWrapper (existing)
│   └── Modal Shell
│
├── DropzoneSection (Agent 1)
│   ├── Drag & Drop Zone
│   └── File Browse Button
│
└── DocumentListSection (Agent 2) ⭐ NEW
    │
    ├── Tabs Component
    │   ├── "Documents (X)" Tab
    │   └── "Failed (X)" Tab
    │
    ├── Document List Container
    │   └── DocumentListItem (Agent 2) ⭐ NEW
    │       │
    │       ├── File Icon (📄)
    │       ├── File Info
    │       │   ├── Filename
    │       │   └── Timestamp
    │       ├── ProgressIndicator (Agent 2) ⭐ NEW
    │       │   └── Progress Bar (10-100%)
    │       ├── Status Badge
    │       │   └── Color-coded status
    │       └── Action Buttons (if complete)
    │           ├── Preview Button (👁️)
    │           └── Download Button (⬇️)
    │
    └── Pagination Component
        └── Page controls
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   WebSocket Server                          │
│            (documentProgress.ts)                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Emits: document:progress events
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│             useWebSocketProgress Hook                       │
│   - Subscribes to case file                                 │
│   - Listens for events                                      │
│   - Calls onProgress callback                               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Progress Event
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│          UploadCaseFilesModal Component                     │
│   - Maps event type → processing status                     │
│   - Updates document in state                               │
│   - Re-renders with new status                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Updated Documents Array
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│          DocumentListSection Component                      │
│   - Filters by tab (all/failed)                             │
│   - Paginates (10 per page)                                 │
│   - Renders list items                                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Document Props
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│          DocumentListItem Component                         │
│   - Shows file info                                         │
│   - Renders ProgressIndicator                               │
│   - Shows action buttons                                    │
└─────────────────────────────────────────────────────────────┘
```

## Status Flow

```
Upload File
    │
    ├─> pending (10%) ─────> Gray badge
    │
    ├─> extracting (30%) ───> Blue badge, Blue progress
    │
    ├─> analyzing (60%) ────> Blue badge, Blue progress
    │
    ├─> indexing (85%) ─────> Blue badge, Blue progress
    │
    └─> complete (100%) ────> Green badge, Green progress
        └─> Show Preview/Download buttons
```

## Event Types → Status Mapping

| WebSocket Event Type    | Processing Status | Progress % |
|------------------------|-------------------|------------|
| `document:upload`      | `pending`         | 10%        |
| `document:extracting`  | `extracting`      | 30%        |
| `document:analyzing`   | `analyzing`       | 60%        |
| `document:indexing`    | `indexing`        | 85%        |
| `document:complete`    | `complete`        | 100%       |
| `document:error`       | `failed`          | 0%         |

## File Structure

```
src/renderer/
├── hooks/
│   └── useWebSocketProgress.ts ⭐ NEW
│
└── components/
    └── UploadCaseFilesModal/
        ├── index.tsx (UPDATED)
        ├── DropzoneSection.tsx (Agent 1)
        ├── DocumentListSection.tsx ⭐ NEW
        ├── DocumentListItem.tsx ⭐ NEW
        ├── ProgressIndicator.tsx ⭐ NEW
        └── styles.css (Agent 1)
```

## Key Interactions

### 1. File Upload Flow
```
User drops file
    → DropzoneSection.onFilesAdded
    → index.handleFilesAdded
    → index.uploadFile (API call)
    → Add to documents state with "pending"
    → WebSocket emits progress events
    → Hook receives events
    → State updates → UI re-renders
```

### 2. Tab Switch Flow
```
User clicks "Failed" tab
    → DocumentListSection.onTabChange
    → index.handleTabChange
    → setActiveTab('failed')
    → setPage(1) (reset to first page)
    → DocumentListSection filters documents
    → Re-render with filtered list
```

### 3. Pagination Flow
```
User clicks page 2
    → Pagination.onChange
    → index.handlePageChange
    → setPage(2)
    → DocumentListSection slices array
    → Re-render with page 2 documents
```

## Props Interface

### UploadCaseFilesModal
- `visible: boolean` - Modal visibility
- `caseFileId: string` - Case to upload to
- `onClose: () => void` - Close handler

### DocumentListSection
- `documents: ICaseDocument[]` - All documents
- `activeTab: 'documents' | 'failed'` - Current tab
- `onTabChange: (tab) => void` - Tab change handler
- `page: number` - Current page
- `pageSize: number` - Items per page (10)
- `onPageChange: (page) => void` - Page change handler
- `onPreview: (id) => void` - Preview handler
- `onDownload: (id) => void` - Download handler

### DocumentListItem
- `document: ICaseDocument` - Document data
- `onPreview: (id) => void` - Preview handler
- `onDownload: (id) => void` - Download handler

### ProgressIndicator
- `status: ProcessingStatus` - Current status

---

**Legend:**
⭐ NEW - Created by Agent 2
UPDATED - Modified by Agent 2
