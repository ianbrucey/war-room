# Protocol: Workspace Creation

**Trigger**: User wants to work on a specific objective that requires focused, tracked work

**Purpose**: Create a properly structured workspace for organizing strategies, outlines, and drafts

---

## Part 1: When to Create a Workspace

Create a new workspace when:
- User wants to work on a specific objective (respond to motion, build a claim, draft a document)
- The work requires focus and will involve multiple steps
- The user explicitly says "new workspace" or "start fresh"

**Don't create a workspace for**:
- Simple questions at case root
- Quick research (research lives at case root)
- One-off tasks that don't need tracking

---

## Part 2: Creation Process

### Step 1: Determine Workspace Name

Use this format: `[descriptive_name]` (lowercase, underscores)

Examples:
- `motion_to_dismiss_response`
- `breach_of_contract_claim`
- `discovery_strategy`

### Step 2: Copy Template

```bash
cp -r workspaces/_template workspaces/[workspace_name]
```

### Step 3: Populate WORKSPACE.json

Replace placeholders:
- `workspace_id` → The workspace name
- `description` → Brief description of the workspace
- `created_at` → Current timestamp (ISO 8601 format)
- `objective` → Clear one-sentence objective

Example:
```json
{
  "workspace_id": "motion_to_dismiss_response",
  "description": "Workspace for responding to defendant's motion to dismiss",
  "created_at": "2024-12-19T00:00:00Z",
  "objective": "Draft a comprehensive response to the motion to dismiss filed on 12/15/2024",
  
  "active_focus": {
    "type": null,
    "id": null,
    "workflow_state": null
  },
  
  "strategies": [],
  "outlines": [],
  "drafts": [],
  
  "linked_research": []
}
```

### Step 4: Update README.md

Replace placeholders in README.md with actual values.

### Step 5: Update settings.json

Set `active_workspace` in `case-context/settings.json`:
```json
{
  "active_workspace": "motion_to_dismiss_response"
}
```

### Step 6: Announce to User

```
✅ Created workspace: [workspace_name]

Objective: [objective]

You're now working in this focused workspace. All strategies, outlines, and drafts will be organized here.
```

---

## Part 3: Workspace Lifecycle

1. **Created** - Empty, ready for work
2. **Active** - User is working in it (tracked in settings.json)
3. **Inactive** - User switched to different workspace or case root
4. **Complete** - Objective achieved (workspace remains for reference)

---

## Part 4: Important Rules

- **One active workspace at a time** - User can only focus on one workspace at a time
- **Workspace state is independent** - Each workspace tracks its own strategies/outlines/drafts
- **Research stays at case root** - Research files live in `research/` and can be linked to workspaces
- **Don't delete workspaces** - They serve as historical record of work done

