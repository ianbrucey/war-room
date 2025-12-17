# Handoff: VS Code-Style Layout System & Case Navigation

## Overview
This document describes the implementation of a VS Code-style layout system for AionUI, including:
- Icon sidebar (60px) for toggling panels
- Dynamic left panel (200-600px, resizable)
- Conversation history panel
- Workspace file browser panel
- Smart case navigation to latest active conversation

**Status**: Core functionality complete. Panels load and toggle correctly. Conversation history loads. Chat panel width fixed.

---

## Architecture

### Component Hierarchy
```
Layout (wraps entire app with PanelProvider)
├── IconSidebar (60px icon bar)
├── LeftPanel (0-600px, slides in/out)
│   ├── ConversationPanel (when activePanel='conversations')
│   │   └── ChatHistory (lists conversations for case)
│   ├── WorkspacePanel (when activePanel='workspace')
│   └── (null when activePanel=null)
└── ArcoLayout.Content (main chat area, flex-1)
    ├── ChatLayout (header + content)
    └── Chat component (GeminiChat, AcpChat, CodexChat)
```

### State Management
- **PanelContext** (`src/renderer/context/PanelContext.tsx`): Global panel state
- **usePanelState** (`src/renderer/hooks/usePanelState.ts`): State logic (activePanel, width, min/max)
- **usePanelContext**: Hook to access global panel state

---

## Key Files

### Core Components
| File | Purpose |
|------|---------|
| `src/renderer/components/IconSidebar/index.tsx` | 60px icon bar with 5 icons |
| `src/renderer/components/LeftPanel/index.tsx` | Sliding panel container with drag-to-resize |
| `src/renderer/components/LeftPanel/LeftPanel.css` | Panel animations & styling |
| `src/renderer/components/ConversationPanel/index.tsx` | Wrapper for ChatHistory |
| `src/renderer/components/WorkspacePanel/index.tsx` | File browser for workspace |
| `src/renderer/context/PanelContext.tsx` | Global panel state provider |
| `src/renderer/hooks/usePanelState.ts` | Panel state logic |

### Integration Points
| File | Changes |
|------|---------|
| `src/renderer/layout.tsx` | Wraps app with PanelProvider, renders IconSidebar |
| `src/renderer/pages/conversation/ChatLayout.tsx` | Renders LeftPanel + main content |
| `src/renderer/pages/guid/index.tsx` | Renders LeftPanel for new conversation page |
| `src/renderer/pages/conversation/ChatHistory.tsx` | Accepts caseFileId prop, sorts by modifyTime |
| `src/renderer/pages/cases/CaseSelection.tsx` | Navigates to latest active conversation |
| `src/renderer/router.tsx` | CaseRedirect component for smart navigation |

---

## Known Issues & TODOs

### ✅ Fixed
- [x] Conversation history not loading → Pass caseFileId as prop
- [x] Chat panel width fixed → Add `min-w-0` to flex container
- [x] Icons not visible → Changed color to `#666666`
- [x] Panel state not shared → Created PanelContext

### 🔄 In Progress / Future
- [ ] Mobile responsiveness (full-screen overlay mode)
- [ ] Keyboard shortcuts (Cmd+B for sidebar, Cmd+Shift+E for explorer)
- [ ] File preview panel integration
- [ ] Settings panel
- [ ] Smooth transitions on panel open/close
- [ ] Minimum chat width enforcement (400px)

---

## How to Test

### Test Conversation History Loading
1. Navigate to a case with existing conversations
2. Click the 💬 icon in the sidebar
3. Verify conversations list appears and is sorted by most recently active (modifyTime)

### Test Panel Resizing
1. Open a panel (conversations or workspace)
2. Drag the right edge of the panel to resize
3. Double-click the drag handle to reset to 300px

### Test Case Navigation
1. Go to Cases page
2. Click a case card
3. Should navigate to the most recently active conversation (or guid if no conversations)

### Test Latest Active Conversation
1. Open conversation A, send a message
2. Open conversation B
3. Go back to Cases page
4. Click the case → Should go to conversation A (most recently active)

---

## Database Schema Notes

Conversations table has:
- `created_at`: When conversation was created
- `updated_at`: When conversation was last modified (used for "latest active")

The `modifyTime` property on `TChatConversation` maps to `updated_at` in the database.

---

## Next Steps for Next Agent

1. **Test mobile responsiveness**: Panels should become full-screen overlays on mobile
2. **Add keyboard shortcuts**: Cmd+B to toggle sidebar, Cmd+Shift+E for explorer
3. **Implement file preview panel**: Convert FilePreview modal to panel
4. **Add settings panel**: Settings should open in left panel instead of full page
5. **Polish animations**: Ensure smooth transitions and no jank
6. **Enforce minimum chat width**: Prevent chat area from becoming too narrow

---

## Useful Commands

```bash
# Start dev server
npm run webui

# Build
npm run build

# Type check
npm run type-check
```

---

## Questions?
- Check `context-engine/specs/vscode-layout-system/` for original design specs
- Review git history for implementation decisions
- Look at Arco Design docs for Layout component API

