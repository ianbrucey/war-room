# Case Summary Generation - UI Specifications

## 1. Location

**Component:** `UploadCaseFilesModal` (existing)  
**File:** `src/renderer/components/UploadCaseFilesModal/index.tsx`

The summary controls will be added as a new section within the upload modal, below the document list.

---

## 2. New Component: CaseSummaryControls

### 2.1 Placement in Modal

```
┌─────────────────────────────────────────────────────────┐
│  Upload Case Files                               [X]    │
├─────────────────────────────────────────────────────────┤
│  [Search: _______________]                              │
│                                                         │
│  ┌─ Documents ──────────────────────────────────────┐   │
│  │  📄 Complaint.pdf          ✓ Complete            │   │
│  │  📄 Motion.pdf             ⏳ Processing         │   │
│  │  📄 Evidence.pdf           ✓ Complete            │   │
│  └──────────────────────────────────────────────────┘   │
│  Pagination: < 1 2 3 >                                  │
│                                                         │
│  ═══════════════════════════════════════════════════    │
│                                                         │
│  ┌─ Case Summary ───────────────────────────────────┐   │  <-- NEW SECTION
│  │                                                   │   │
│  │  Status: [Badge: Generated ✓ | Stale ⚠ | None]   │   │
│  │  Last generated: Jan 15, 2024 at 3:45 PM         │   │
│  │  Documents included: 5 of 7                      │   │
│  │                                                   │   │
│  │  [Generate Summary]  [Update]  [Regenerate]      │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Component States

#### State: No Summary (status = null)
```
┌─ Case Summary ───────────────────────────────────────┐
│                                                       │
│  Status: [Badge: Not Generated]                       │
│                                                       │
│  No case summary has been generated yet.              │
│  Generate a summary to create context for AI agents.  │
│                                                       │
│  [🔄 Generate Summary]                                │
│                                                       │
└───────────────────────────────────────────────────────┘
```

#### State: Summary Generated (status = 'generated')
```
┌─ Case Summary ───────────────────────────────────────┐
│                                                       │
│  Status: [Badge: Generated ✓ (green)]                 │
│  Last generated: Jan 15, 2024 at 3:45 PM (v2)        │
│  Documents included: 5                                │
│                                                       │
│  [📄 View Summary]  [🔄 Regenerate]                   │
│                                                       │
└───────────────────────────────────────────────────────┘
```

#### State: Summary Stale (status = 'stale')
```
┌─ Case Summary ───────────────────────────────────────┐
│                                                       │
│  Status: [Badge: Needs Update ⚠ (orange)]             │
│  Last generated: Jan 15, 2024 at 3:45 PM (v2)        │
│  Documents included: 5 of 7 (2 new)                   │
│                                                       │
│  ⚠️ New documents have been added since last summary  │
│                                                       │
│  [📄 View]  [➕ Update Summary]  [🔄 Regenerate]      │
│                                                       │
└───────────────────────────────────────────────────────┘
```

#### State: Generating (status = 'generating')
```
┌─ Case Summary ───────────────────────────────────────┐
│                                                       │
│  Status: [Badge: Generating... (blue, animated)]      │
│                                                       │
│  [====================================    ] 75%       │
│  Processing batch 3 of 4...                           │
│                                                       │
│  [Cancel] (disabled for MVP)                          │
│                                                       │
└───────────────────────────────────────────────────────┘
```

#### State: Failed (status = 'failed')
```
┌─ Case Summary ───────────────────────────────────────┐
│                                                       │
│  Status: [Badge: Failed ✗ (red)]                      │
│                                                       │
│  ❌ Summary generation failed. Please try again.      │
│                                                       │
│  [🔄 Retry Generate]                                  │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### 2.3 Button Behaviors

| Button | Visible When | Action | Confirmation? |
|--------|--------------|--------|---------------|
| Generate Summary | status = null | POST /generate | No |
| Update Summary | status = stale | POST /update | No |
| Regenerate | status = generated OR stale | POST /regenerate | Yes: "This will rebuild the entire summary" |
| View Summary | status = generated OR stale | Open case_summary.md in viewer | No |
| Retry Generate | status = failed | POST /generate | No |

### 2.4 Arco Design Components to Use

- `Badge` - Status indicator
- `Button` - Action buttons
- `Progress` - Generation progress bar
- `Typography.Text` - Labels and timestamps
- `Alert` - Stale warning message
- `Divider` - Section separator
- `Space` - Button grouping

---

## 3. Props Interface

```typescript
interface CaseSummaryControlsProps {
  caseId: string;
  summaryStatus: 'generating' | 'generated' | 'stale' | 'failed' | null;
  summaryGeneratedAt: number | null;
  summaryVersion: number;
  summaryDocumentCount: number;
  currentDocumentCount: number; // total processed docs
  onGenerate: () => void;
  onUpdate: () => void;
  onRegenerate: () => void;
  generationProgress?: {
    percent: number;
    currentBatch: number;
    totalBatches: number;
  };
}
```

---

## 4. Integration with Existing Modal

Add to `UploadCaseFilesModal/index.tsx`:
1. Fetch summary status via `GET /api/cases/:caseId/summary/status`
2. Subscribe to WebSocket events for real-time progress
3. Render `<CaseSummaryControls />` below document list

