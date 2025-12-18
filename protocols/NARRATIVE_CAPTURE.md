# Protocol: Narrative Capture

**Status:** Active  
**Owner:** Chat Agent (Augie)  
**Last Updated:** December 2024

---

## Purpose

Guide the agent through capturing the user's narrative—their personal account of what happened in their case. The narrative provides the **interpretive lens** through which documents should be analyzed, ensuring the case summary reflects the user's intent and perspective.

---

## When to Enter Narrative Mode

**Trigger Conditions:**

1. User explicitly requests: "Tell my story" / "Record my narrative" / "Ground this case"
2. System prompts user via CaseGroundingCard and user accepts
3. Agent detects `case-context/user_narrative.md` does not exist and case has documents awaiting processing

---

## Conversation Flow

### Phase 1: Opening Prompt

When entering narrative mode, send exactly ONE of these opening prompts (choose based on context):

**For new cases (no documents yet):**
> "I'd like to understand your situation in your own words. Tell me what happened—start wherever feels natural. You can speak or type, and take your time. I'm listening."

**For cases with documents uploaded:**
> "Before I analyze your documents, I need to understand the story from your perspective. Tell me what happened and what outcome you're hoping for. This helps me interpret the evidence through your lens."

**For cases returning to add narrative:**
> "Let's capture your account of what happened. Start from the beginning—who was involved, what happened, and how it affected you."

### Phase 2: Active Listening

During narrative capture:

1. **DO NOT interrupt** with questions unless the user pauses for >10 seconds
2. **DO NOT analyze** or offer legal opinions during this phase
3. **DO acknowledge** periodically with brief confirmations: "I understand", "Go on", "I'm following"
4. **DO note** any mentioned parties, dates, or key events (for later extraction)

### Phase 3: Clarifying Questions (Optional)

After the user indicates they're done (or after a natural pause):

1. Ask at most 2-3 clarifying questions about:
   - Timeline gaps: "You mentioned X happened, then Y. Approximately when did X occur?"
   - Key parties: "Who is [name] in relation to you?"
   - Desired outcome: "What resolution are you hoping for?"

2. **DO NOT** turn this into an interrogation. If the user seems finished, respect that.

### Phase 4: Confirmation & Exit

Before saving, confirm with the user:

> "Thank you for sharing that. I've captured your narrative. Here's a brief summary:
> - **Situation:** [1-2 sentence summary]
> - **Key parties:** [list names mentioned]
> - **Desired outcome:** [if stated]
> 
> Does this accurately reflect what you told me? I can make corrections before we proceed."

**On user confirmation:** Save to `case-context/user_narrative.md` and exit narrative mode.
**On user correction:** Re-enter Phase 2 for the specific correction, then re-confirm.

---

## Persistence

### Output File
- **Location:** `{workspace}/case-context/user_narrative.md`
- **Format:** Markdown with frontmatter

### File Structure
```markdown
---
captured_at: "2024-12-18T10:30:00Z"
capture_method: "voice" | "text" | "mixed"
version: 1
---

# User Narrative

[Raw narrative content as spoken/typed by user]

## Extracted Metadata

### Parties Mentioned
- [Party 1]: [Role/relationship]
- [Party 2]: [Role/relationship]

### Key Dates
- [Date]: [Event]

### Desired Outcome
[User's stated goal, if any]
```

---

## Post-Capture Actions

After saving `user_narrative.md`:

1. **Extract parties** → Write to `case-context/parties.json`
2. **Mark summary stale** → If `case_summary.md` exists, flag for regeneration
3. **Notify user** → "Your narrative has been saved. [Upload documents / Generate summary]"

---

## Exit Conditions

Exit narrative mode when ANY of the following occur:

1. User confirms the summary is accurate
2. User explicitly says "That's all" / "I'm done" / "Let's move on"
3. User asks an unrelated question (exit gracefully, then answer)
4. User requests to cancel/abort the narrative capture

---

## Visual Indicator

When in narrative mode, the UI should display:
- A subtle badge or indicator: "📝 Recording your story..."
- The microphone should be prominently available
- Send button label changes to "Done" or "Finish"

---

## Failure Handling

**If user abandons mid-narrative:**
- Save draft to `case-context/.narrative_draft.md`
- On next entry, offer: "I have a draft of your narrative from before. Would you like to continue where you left off?"

**If transcription fails:**
- Notify user: "I had trouble capturing that. Could you repeat the last part?"
- Fall back to text input if voice repeatedly fails

