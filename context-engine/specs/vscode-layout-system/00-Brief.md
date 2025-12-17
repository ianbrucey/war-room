# VS Code-Style Layout System - Strategic Brief

## 1. Strategic Intent

**Goal:** Transform the conversation interface to use a VS Code-style layout with an icon sidebar, toggleable left panels, and dynamic content resizing.

**Success Verdict:** 
- [ ] Icon sidebar (48px) displays 5 icons: Conversations, Workspace, Preview, Settings, User
- [ ] Clicking an icon toggles its associated panel (open/close)
- [ ] Only ONE panel can be open at a time (mutual exclusivity)
- [ ] Left panel slides in/out smoothly (200ms animation)
- [ ] Chat content dynamically resizes to fill remaining space (min 400px)
- [ ] Draggable divider between left panel and chat works (200px-600px range)
- [ ] Double-clicking file in workspace opens it in File Preview Panel
- [ ] Layout persists across page reloads (localStorage)
- [ ] Mobile: Panel becomes full-screen overlay

## 2. The Claims (Features)

| Claim ID | Description | Verdict (Test) |
|----------|-------------|----------------|
| CLAIM-01 | Icon sidebar with 5 clickable icons | Click each icon → associated panel opens |
| CLAIM-02 | Conversation History Panel toggles on/off | Click 💬 icon → panel slides in with conversation list |
| CLAIM-03 | Workspace Explorer Panel toggles on/off | Click 📁 icon → panel slides in with file tree |
| CLAIM-04 | File Preview Panel opens when file double-clicked | Double-click workspace file → preview opens in left panel |
| CLAIM-05 | Only one panel open at a time | Open panel A → click panel B icon → A closes, B opens |
| CLAIM-06 | Draggable divider resizes panels | Drag divider → left panel width changes (200-600px) |
| CLAIM-07 | Chat content maintains minimum width | Resize panel to max → chat remains at least 400px wide |
| CLAIM-08 | Panel state persists across reloads | Open panel → reload page → same panel still open |
| CLAIM-09 | Smooth animations for panel transitions | Open/close panel → 200ms slide animation plays |

## 3. The Elements (Required Components)

| Element | Purpose | Belongs To Claim |
|---------|---------|------------------|
| `IconSidebar` | 48px icon bar with 5 buttons | CLAIM-01 |
| `LeftPanel` | Container for dynamic panel content | CLAIM-02, CLAIM-03, CLAIM-04 |
| `ConversationPanel` | Wraps existing ChatHistory component | CLAIM-02 |
| `WorkspacePanel` | Wraps existing ChatWorkspace component | CLAIM-03 |
| `FilePreviewPanel` | Displays file preview with tab bar | CLAIM-04 |
| `usePanelState` | Hook for managing panel state (which is open) | CLAIM-05, CLAIM-08 |
| `DraggableDivider` | Resize handle between panel and chat | CLAIM-06 |
| `ChatContentArea` | Dynamically sized chat container | CLAIM-07 |
| `PanelTransition` | CSS/animation wrapper for slide effects | CLAIM-09 |

## 4. The Evidence (Inputs & Constraints)

**Tech Stack:**
- React 18 + TypeScript
- Arco Design Layout components
- UnoCSS for styling
- React hooks (useState, useEffect, useCallback, useContext)
- localStorage for persistence
- CSS transforms for animations

**External APIs:** None (pure frontend refactor)

**Sample Data:** 
- Existing conversation data from `ChatHistory`
- Existing workspace files from `ChatWorkspace`
- File preview content from `WorkspaceFilePreview`

---

## 5. Existing Infrastructure (CRITICAL for Brownfield Projects)

### Related Existing Components
| Component | Purpose | Location | Reuse or Extend? |
|-----------|---------|----------|------------------|
| `ChatHistory` | Lists conversations for current case | `src/renderer/pages/conversation/ChatHistory.tsx` | REUSE (wrap in panel) |
| `ChatWorkspace` | File tree for workspace | `src/renderer/pages/conversation/ChatWorkspace.tsx` | REUSE (wrap in panel) |
| `WorkspaceFilePreview` | Renders markdown/HTML files | `src/renderer/components/WorkspaceFilePreview/index.tsx` | REUSE (integrate into panel) |
| `ChatLayout` | Current conversation layout | `src/renderer/pages/conversation/ChatLayout.tsx` | EXTEND (add panel system) |
| `Sider` | Current left sidebar | `src/renderer/sider.tsx` | REPLACE (with IconSidebar) |
| `Layout` | Main app layout | `src/renderer/layout.tsx` | EXTEND (integrate new sidebar) |

### Related Existing State Management
| State | Current Location | New Location |
|-------|------------------|--------------|
| Sidebar collapsed state | `Layout` component | Keep in Layout |
| Right sider collapsed | `ChatLayout` component | Rename to `leftPanelOpen` |
| File preview modal | `ChatWorkspace` component | Move to panel system |

### Known Constraints
- [ ] Must not break existing conversation functionality
- [ ] Must preserve workspace file operations (rename, delete, etc.)
- [ ] Must maintain mobile responsiveness
- [ ] Must work with existing WebSocket connections
- [ ] Must respect existing authentication/routing

## 6. Pre-Mortem (Risk Assessment)

**What could break?**
- Existing drag-and-drop in workspace might conflict with new divider
- Animation performance on low-end devices
- localStorage quota exceeded if storing too much state
- Z-index conflicts with existing modals

**What assumptions are we making?**
- Users want VS Code-style layout (not everyone likes it)
- 400px is sufficient minimum width for chat
- Only one panel open at a time is acceptable (no split panels)
- File preview in left panel is better than modal

**What do we NOT know yet?**
- Optimal default panel width (300px? 350px?)
- Should sidebar be collapsible to show labels?
- Should we support keyboard shortcuts (Cmd+B, etc.)?
- Should file preview support multiple tabs or just one?

## 7. Approval Gate

**Status:** [ ] DRAFT  [X] APPROVED

**Approved By:** User

**Date:** 2025-12-17

---

> ⚠️ **EXIT CONDITION:** This Brief is approved. Proceed to Archaeology phase to scan existing code, then Architecture phase to generate implementation plan.

