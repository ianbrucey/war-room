# Code Patterns & Examples

## Using Panel State in Components

### Access Panel State
```typescript
import { usePanelContext } from '@/renderer/context/PanelContext';

const MyComponent = () => {
  const { activePanel, panelWidth, setPanelWidth, togglePanel } = usePanelContext();
  
  return (
    <div>
      <button onClick={() => togglePanel('conversations')}>
        Toggle Conversations
      </button>
      <p>Current panel: {activePanel}</p>
      <p>Panel width: {panelWidth}px</p>
    </div>
  );
};
```

### Render Different Content Based on Active Panel
```typescript
const renderPanelContent = () => {
  switch (activePanel) {
    case 'conversations':
      return <ConversationPanel />;
    case 'workspace':
      return <WorkspacePanel conversation_id={id} workspace={dir} />;
    case 'preview':
      return <FilePreviewPanel />;
    default:
      return null;
  }
};
```

---

## Sorting Conversations by Latest Active

**Always use `modifyTime` for "latest active", not `createTime`:**

```typescript
// ✅ CORRECT - sorts by most recently active
const sorted = conversations.sort((a, b) => {
  const aTime = a.modifyTime || a.createTime;
  const bTime = b.modifyTime || b.createTime;
  return bTime - aTime;
});

// ❌ WRONG - sorts by creation date
const sorted = conversations.sort((a, b) => b.createTime - a.createTime);
```

---

## Passing caseFileId to Child Components

When rendering panels inside a case context, pass `caseFileId` explicitly:

```typescript
// In ConversationPanel
const { caseFileId } = useParams<{ caseFileId?: string }>();

return (
  <ChatHistory 
    caseFileId={caseFileId}  // ← Pass explicitly
    onSessionClick={onSessionClick}
  />
);

// In ChatHistory
const ChatHistory: React.FC<{ 
  caseFileId?: string;
  onSessionClick?: () => void;
}> = ({ caseFileId: propCaseFileId, onSessionClick }) => {
  const { caseFileId: routeCaseFileId } = useParams();
  // Use prop if provided, fallback to route param
  const caseFileId = propCaseFileId || routeCaseFileId;
  // ...
};
```

---

## Fetching Conversations by Case

```typescript
import { ipcBridge } from '@/common';

// Get conversations for a case, sorted by most recent
const conversations = await ipcBridge.database.getConversationsByCase.invoke({
  caseFileId: 'case_123',
  page: 0,
  pageSize: 100,
});

// Sort by modifyTime (most recently active first)
const sorted = conversations.sort((a, b) => {
  const aTime = a.modifyTime || a.createTime;
  const bTime = b.modifyTime || b.createTime;
  return bTime - aTime;
});

// Navigate to most active
navigate(`/${caseFileId}/conversation/${sorted[0].id}`);
```

---

## Flexbox Layout Pattern

**Always add `min-w-0` to flex containers to allow proper shrinking:**

```typescript
// ✅ CORRECT - allows content to shrink
<ArcoLayout.Content className='flex flex-col flex-1 min-w-0'>
  {children}
</ArcoLayout.Content>

// ❌ WRONG - content won't shrink, causes fixed width
<ArcoLayout.Content className='flex flex-col flex-1'>
  {children}
</ArcoLayout.Content>
```

---

## Panel Resize Drag Handler

The LeftPanel component handles dragging automatically. To add custom drag behavior:

```typescript
const handleDragStart = (e: React.MouseEvent) => {
  const startX = e.clientX;
  const startWidth = width;

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - startX;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
    onWidthChange(newWidth);
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};
```

---

## Navigation Patterns

### Navigate to Latest Conversation in Case
```typescript
const handleSelectCase = async (caseFileId: string) => {
  const conversations = await ipcBridge.database.getConversationsByCase.invoke({
    caseFileId,
    page: 0,
    pageSize: 100,
  });

  if (conversations?.length > 0) {
    const sorted = conversations.sort((a, b) => 
      (b.modifyTime || b.createTime) - (a.modifyTime || a.createTime)
    );
    navigate(`/${caseFileId}/conversation/${sorted[0].id}`);
  } else {
    navigate(`/${caseFileId}/guid`);
  }
};
```

### Navigate with Case Context
```typescript
// Always include caseFileId in path when inside a case
const targetPath = caseFileId 
  ? `/${caseFileId}/conversation/${id}` 
  : `/conversation/${id}`;
navigate(targetPath);
```

---

## CSS Classes Reference

| Class | Purpose |
|-------|---------|
| `left-panel` | Main panel container |
| `left-panel--open` | Panel is visible |
| `left-panel--closed` | Panel is hidden (width: 0) |
| `left-panel__content` | Panel content wrapper |
| `left-panel__drag-handle` | Resize handle (6px) |

---

## Common Mistakes to Avoid

1. **Don't use `createTime` for sorting active conversations** → Use `modifyTime`
2. **Don't forget `min-w-0` on flex containers** → Causes layout issues
3. **Don't forget to pass `caseFileId` to child components** → Causes history not to load
4. **Don't use `useParams` alone in nested components** → Pass as prop for reliability
5. **Don't hardcode panel widths** → Use state from `usePanelContext`

