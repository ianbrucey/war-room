# UI Specifications: Case Grounding

## 1. CaseGroundingCard Component

**Location:** ChatLayout middle panel (when no file is being previewed)

### Visual Design

```
┌─────────────────────────────────────────────────────────────┐
│  ☑️ Ground Your Case                              [Dismiss] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Help me understand your case better by completing these    │
│  steps. You can skip any step and come back later.          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [○] 1. Tell Your Story                              │   │
│  │     Share what happened in your own words           │   │
│  │                                    [Start →]        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [✓] 2. Upload Evidence                              │   │
│  │     5 documents uploaded                            │   │
│  │                                    [Add More]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [○] 3. Generate Summary            [⚠️ Stale]       │   │
│  │     Let AI synthesize your case                     │   │
│  │                                    [Generate]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### States

| Step | Incomplete | Complete | Stale |
|------|------------|----------|-------|
| 1. Narrative | `○` Gray circle | `✓` Green check | N/A |
| 2. Documents | `○` Gray circle | `✓` Green check + count | N/A |
| 3. Summary | `○` Gray (disabled if no narrative AND no docs) | `✓` Green check | `⚠️` Orange warning |

### Interactions

1. **"Start" (Tell Your Story)**
   - Enters narrative mode in chat panel
   - Card remains visible but step 1 shows "Recording..."

2. **"Add More" (Upload Evidence)**
   - Opens existing `UploadCaseFilesModal`
   - On close, refreshes document count

3. **"Generate" (Generate Summary)**
   - Calls existing summary generation flow
   - Shows progress indicator
   - On complete, step shows green check

4. **"Dismiss"**
   - Hides card for this session
   - Card reappears on next case open if not fully grounded
   - Does NOT permanently dismiss (user can re-access via menu/button)

---

## 2. Narrative Mode Indicator

**Location:** Chat panel header

### When Active

```
┌─────────────────────────────────────────────────────────────┐
│  📝 Recording your story...                    [Done]       │
├─────────────────────────────────────────────────────────────┤
```

### Visual Changes in Narrative Mode

1. **Header** shows "📝 Recording your story..." badge
2. **Microphone button** is prominent/highlighted
3. **Send button** label changes to "Done" (or remains arrow but with tooltip)
4. **Chat input placeholder** changes to "Tell me what happened..."
5. **Subtle background tint** (optional) to indicate special mode

---

## 3. Conversation Panel Integration

**Location:** Left panel (Conversations list)

### Grounding Indicator on Case

When user views conversation list, each case shows grounding status:

```
┌─────────────────────────────────────┐
│ 📂 Smith v. Acme Corp               │
│ Last active: 2 hours ago   [○○○]    │  ← 3 dots = 3 steps, filled = complete
└─────────────────────────────────────┘
```

**Dot States:**
- Empty circle `○` = Step not complete
- Filled circle `●` = Step complete
- Order: Narrative | Documents | Summary

---

## 4. Empty State Handling

### Middle Panel Empty States (Priority Order)

1. **If not grounded:** Show CaseGroundingCard
2. **If grounded but no file selected:** Show "Select a file to preview"
3. **If file selected:** Show FilePreview

### Logic

```typescript
const getMiddlePanelContent = () => {
  // Check if user has dismissed for this session
  if (isGroundingDismissed) {
    return previewContent || <EmptyFilePrompt />;
  }
  
  // Check grounding status
  if (!groundingStatus.narrativeExists || !groundingStatus.documentCount) {
    return <CaseGroundingCard {...groundingStatus} />;
  }
  
  // Fully grounded - show preview or empty
  return previewContent || <EmptyFilePrompt />;
};
```

---

## 5. Accessibility

- All interactive elements have `aria-label`
- Progress indicators use `role="progressbar"` with `aria-valuenow`
- Dismiss button has `aria-label="Dismiss case grounding wizard"`
- Keyboard navigation: Tab through steps, Enter to activate
- Voice input status announced via `aria-live="polite"`

