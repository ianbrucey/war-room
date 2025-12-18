# Strategic Plan: User Narrative & Case Summary Onboarding

## 1. Vision: "Case Grounding"
Instead of a simple "Onboarding" wizard, we are implementing a **Case Grounding Phase**.
The goal is to teach the agent how to think about the case *before* it processes the raw evidence.

**Core Philosophy:**
1.  **Narrative First:** The user's intent and story provide the lens for interpreting documents.
2.  **Hybrid Interaction:** Use the natural conversational interface (Chat + Mic) for capture, but persist the output as a structured file (`user_narrative.md`).
3.  **Derived Summary:** The "Case Summary" is an AI-generated artifact derived from *both* the Narrative and the Documents.

## 2. Architecture & Data Flow

### A. New Artifact: `user_narrative.md`
A new file type stored in the case context.
-   **Location:** `/documents/user_narrative.md` (or similar context path)
-   **Content:** The raw or slightly cleaned user story.
-   **Metadata:** Source (Voice/Text), Timestamp, Version.

### B. The Workflow "Funnel"

1.  **Trigger:** User opens a new or un-grounded case.
    -   *UI:* Non-blocking prompt (e.g., "Ground this case to get started") in the top of the chat or workspace.
2.  **Step 1: Narrative Capture (Chat Mode)**
    -   User clicks "Tell Story".
    -   Chat enters `NARRATIVE_MODE`.
    -   Agent prompts: "Tell me what happened..."
    -   User speaks/types.
    -   **Action:** System saves content to `user_narrative.md`.
3.  **Step 2: Evidence Upload (Existing Modal)**
    -   Prompt: "Now that I know the story, upload the evidence."
    -   User opens `UploadCaseFilesModal`.
    -   Uploads files.
4.  **Step 3: Summary Generation (Existing + Enhanced)**
    -   **Input:** `user_narrative.md` + All Uploaded Documents.
    -   **Output:** `case_summary.md` (The "Source of Truth" for the agent).
    -   **Logic:** The prompt for summary generation must be updated to explicitly prioritize the narrative as the "User's Intent" and specific facts from documents as validation.

## 3. UI/UX Changes

### 1. Chat Interface
-   **New State:** `NarrativeCapture`
-   **Visuals:** Subtle distinct styling (e.g., "Recording Narrative") to differentiate from standard chat.
-   **Mic Integration:** Already exists, just need to route the stream to the narrative buffer.

### 2. Workspace / File Preview
-   **Prompt Card:** "Missing Context: Narrative".
-   **Document List:** Should list `user_narrative.md` as a special, editable file.

### 3. Case Summary Controls
-   **Staleness Logic:** Already exists. Needs to trigger if `user_narrative.md` changes, not just document counts.
-   *Current:* Checks `currentDocumentCount - summaryDocumentCount`.
-   *New:* Check `currentDocumentCount` OR `userNarrative.lastModified > summary.generatedAt`.

## 4. Implementation Steps (Plan)

1.  **Backend/IPC:**
    -   Ensure `saveFile` or strict handling for `user_narrative.md` exists.
    -   Update `getCaseSummaryContext` (or equivalent) to include `user_narrative.md`.
2.  **Frontend/Chat:**
    -   Implement the "Ground Case" prompt.
    -   Add `narrative_mode` to Chat state.
3.  **Frontend/Upload:**
    -   Modify `CaseSummaryControls` to respect narrative status.

## 5. Decision: Hybrid Approach
We will **NOT** build a dedicated form. We will use the **Chat Panel** for intake because:
-   It supports the multimodal (Voice) requirement natively.
-   It feels personal and "agentic".
-   We effectively "finalize" the session into a file, satisfying the need for persistence.

## 6. Next Actions
-   Create UI Spec for the "Ground Case" prompt.
-   Refine the `generateSummary` prompt to ingest narrative.
