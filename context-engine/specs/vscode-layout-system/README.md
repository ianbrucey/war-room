# VS Code-Style Layout System

## Status: 📋 SPEC PHASE

**Current Phase:** Archaeology Complete → Ready for Architecture

---

## Quick Links

- **[00-Brief.md](./00-Brief.md)** - Strategic intent, claims, success verdicts
- **[00.5-existing-infrastructure.md](./00.5-existing-infrastructure.md)** - What exists, what to reuse, what to build

---

## What This Feature Does

Transforms the conversation interface from a traditional chat layout to a VS Code-style layout:

**Before:**
```
┌──────────┬──────────┬──────────────┐
│ Sidebar  │Workspace │ Chat Content │
│ (convos) │ (files)  │              │
└──────────┴──────────┴──────────────┘
```

**After:**
```
┌──┬──────────────┬──────────────────┐
│🔵│ Conversation │                  │
│💬│ History      │   Chat Content   │
│📁│ - Conv 1     │                  │
│📄│ - Conv 2     │                  │
│⚙️│              │                  │
└──┴──────────────┴──────────────────┘
```

**Key Features:**
- 48px icon sidebar with 5 icons (Conversations, Workspace, Preview, Settings, User)
- Toggleable left panel (300px default, 200-600px draggable)
- Only one panel open at a time (mutual exclusivity)
- File preview opens in left panel (not modal)
- Smooth animations (200ms slide transitions)
- State persistence (localStorage)

---

## Why This Matters

### User Benefits
1. **More screen real estate** - Icon sidebar is 80% narrower than current sidebar
2. **Contextual panels** - Only see what you need, when you need it
3. **Familiar UX** - Matches VS Code, Cursor, and other modern dev tools
4. **File preview integration** - View files without leaving the conversation

### Technical Benefits
1. **Modular architecture** - Panels are independent, swappable components
2. **Reuses existing code** - ChatHistory, ChatWorkspace, WorkspaceFilePreview
3. **Extensible** - Easy to add new panels (search, git, etc.)
4. **Performance** - Only renders active panel, not all panels at once

---

## Implementation Phases

### Phase 1: Icon Sidebar ✅ (Start Here)
- [ ] Create `IconSidebar` component (48px, 5 icons)
- [ ] Add active state styling
- [ ] Integrate into `Layout` component
- [ ] Replace existing `Sider` component

### Phase 2: Panel Management System
- [ ] Create `LeftPanel` container component
- [ ] Create `usePanelState` hook (which panel is open)
- [ ] Add slide-in/out animations
- [ ] Implement mutual exclusivity logic

### Phase 3: Integrate Existing Components
- [ ] Create `ConversationPanel` (wraps ChatHistory)
- [ ] Create `WorkspacePanel` (wraps ChatWorkspace)
- [ ] Update `ChatLayout` to handle dynamic widths
- [ ] Remove old workspace from ChatLayout

### Phase 4: File Preview Integration
- [ ] Convert `WorkspaceFilePreview` from modal to panel
- [ ] Create `FilePreviewPanel` component
- [ ] Add tab bar for open files
- [ ] Update workspace double-click handler

### Phase 5: Draggable Dividers
- [ ] Extract drag logic from `useSiderWidthWithDrag`
- [ ] Create shared `DraggableDivider` component
- [ ] Add width constraints (panel: 200-600px, chat: 400px min)
- [ ] Add double-click reset

### Phase 6: Polish & Persistence
- [ ] Save panel state to localStorage
- [ ] Add keyboard shortcuts (Cmd+B, Cmd+Shift+E)
- [ ] Mobile responsive behavior (full-screen overlay)
- [ ] Smooth transitions and animations

---

## Open Questions (Awaiting User Input)

1. **Default Panel State:** Should workspace panel be open by default when entering a conversation?
   - Option A: Workspace open (shows files immediately)
   - Option B: No panel open (maximize chat space)
   - Option C: Remember last state (localStorage)

2. **File Preview Tabs:** Support multiple open files in tabs?
   - MVP: One file at a time
   - Future: Multiple tabs

3. **Preview Icon:** Should it be context-aware (only visible when file selected)?
   - Option A: Always visible, disabled when no file
   - Option B: Only appears when file selected
   - Option C: Remove it (double-click is enough)

4. **Sidebar Expand:** Should users be able to expand sidebar to show labels?
   - Yes: Add toggle (48px → 200px)
   - No: Keep icon-only always

5. **Chat Minimum Width:** Is 400px sufficient?
   - Current spec: 400px
   - Alternative: 500px? 600px?

---

## Next Steps

**User Decision Required:** Review open questions above, then proceed to implementation.

**Recommended Approach:** Build incrementally (Phase 1 → Phase 2 → etc.) with testing at each phase.

**Estimated Effort:**
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours
- Phase 3: 2-3 hours
- Phase 4: 3-4 hours
- Phase 5: 2-3 hours
- Phase 6: 2-3 hours
- **Total:** 14-20 hours

---

## Files to Create

### New Components
- `src/renderer/components/IconSidebar/index.tsx`
- `src/renderer/components/LeftPanel/index.tsx`
- `src/renderer/components/ConversationPanel/index.tsx`
- `src/renderer/components/WorkspacePanel/index.tsx`
- `src/renderer/components/FilePreviewPanel/index.tsx`
- `src/renderer/components/DraggableDivider/index.tsx`

### New Hooks
- `src/renderer/hooks/usePanelState.ts`

### Modified Files
- `src/renderer/layout.tsx` (integrate IconSidebar + LeftPanel)
- `src/renderer/pages/conversation/ChatLayout.tsx` (remove workspace, add dynamic sizing)
- `src/renderer/pages/conversation/ChatWorkspace.tsx` (update double-click handler)
- `src/renderer/components/WorkspaceFilePreview/index.tsx` (convert modal to panel)

### Removed Files
- `src/renderer/sider.tsx` (replaced by IconSidebar)
- `src/renderer/pages/conversation/ChatSider.tsx` (replaced by panel system)

---

**Ready to proceed?** Answer the open questions, then we'll generate the implementation plan (01-implementation-plan.md).

