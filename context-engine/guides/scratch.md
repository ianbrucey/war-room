### me

All right, so here's what we have next on Justice Quest. We have to, um... We have to have, like, an agent orientation or an agent onboarding workflow. That's like Ground Zero. Um, we've already worked on document uploads and case summary generation based on that. But the missing piece is the nuance from the user. You know what I mean? Like, sometimes documents don't tell the whole story. Or sometimes a user narrative may fill in gaps that documents alone may not be able to fill. Um... So, with that said... Um... When a user opens a case... They should have some prompt, be it in the, like, file preview area, or be it, like, some space in the top bar in the chat layout... That prompts them to begin the agent onboarding. And their first step is to complete the user narrative. Now, this is optional. They don't have to. They don't even have to generate a summary, but it would be best, right? So the first thing they would be required to do is just tell their story. And they can do that via typing or speaking. And we already have, like, a microphone icon working on the chat input. So we would just need to transfer that functionality into whatever we use to capture the user's story. But then again, we could also use the chat panel to do this as well. So I'm not sure. I'm not sure if we should reuse the chat panel for this or repurpose. Not even repurpose, but just include it. Or if we should have a dedicated user narrative box. Now, once the user gives their narrative, this is going to be saved in the case context folder under a file, likely called usernarrative.md or something like that, or userstory.md. And then after that, they will be prompted to upload to step two, which is upload your evidence or your case files, which we already have a modal for this, although I'm not sure if we should, again, use the file preview section since it's a little bit more cleaner. And then they could do their case summary over there. So, yeah, this is just a reminder that I have to put this into my IDE when I get home to work it out.

# Gpt

You’re thinking about this the *right* way already — what you’re really designing here is  **agent grounding** , not just onboarding. The nuance you’re describing is exactly the kind of thing documents alone can’t solve.

I’ll break this into  **decisions** ,  **recommendation** , and  **concrete structure you can drop into the IDE** .

---

## 1. What this workflow *actually* is

This is not:

* A form
* A wizard
* A one-time setup

This is a **Case Grounding Phase** whose job is to:

* Capture *human context*
* Fill evidentiary gaps
* Establish narrative intent
* Anchor downstream AI reasoning

Think of it as:

> “Teach the agent how to think about *this* case.”

That framing should guide everything.

---

## 2. Chat panel vs dedicated narrative box (key decision)

### Option A: Reuse the chat panel

**Pros**

* Zero new UI paradigm
* Already supports typing + microphone
* Feels conversational and low-pressure
* Natural for “tell your story”

**Cons**

* Chat is ephemeral by default
* Risk of narrative getting buried in messages
* Less clear that this is a *foundational artifact*

---

### Option B: Dedicated “User Narrative” panel

**Pros**

* Signals importance
* Clear ownership of the artifact
* Easy to version, re-edit, and reference
* Maps cleanly to `user_narrative.md`

**Cons**

* Slightly more UI work
* Requires mic integration outside chat

---

### ✅ Recommended: **Hybrid (best of both)**

Use  **chat for capture** , but  **persist into a dedicated artifact** .

This mirrors how good IDEs work:

* Input happens conversationally
* Output becomes a first-class file

---

## 3. Recommended UX flow (clean and intentional)

### When a case is opened for the first time

**Soft, non-blocking prompt** (important):

> **“Ground this case for your agent (optional but recommended)”**

Not a modal that blocks work.
This should feel like guidance, not friction.

Placement options (ranked):

1. **File preview / workspace panel (top card)**
2. Subtle banner above chat
3. Empty-state card inside the case workspace

---

### Step 1: User Narrative (Ground Zero)

**Interaction**

* User clicks “Tell Your Story”
* Chat panel switches into **Narrative Capture Mode**
* Mic + typing enabled
* Agent prompts lightly, not interrogatively

Example agent prompt:

> “Tell me what happened in your own words. Include anything you think matters — even if it’s not in the documents.”

Key rule:

* **No structured questions yet**
* Let them speak freely first

---

### Persistence model (important)

Once the narrative capture ends:

* Chat messages are summarized or lightly edited
* Saved as:
  ```
  /case_context/
    user_narrative.md
  ```

With metadata:

```md
---
source: user
input_mode: voice|text|mixed
created_at: timestamp
last_updated: timestamp
confidence: self-reported
---
```

This file becomes:

* Readable by the agent
* Editable by the user later
* Versionable

---

### Step 2: Evidence / Document Upload

You already have this — just  **sequence it after narrative** .

Recommendation:

* Use the  **file preview section** , not a modal
* Modal = transactional
* File preview = contextual

Label it as:

> **“Attach supporting documents (optional)”**

---

### Step 3: Case Summary (derived, not authored)

Important distinction:

* User does **not** write the summary
* The agent *derives* it from:
  * User narrative
  * Documents
  * Metadata

This reinforces trust:

> “The system understands  *me* , not just my files.”

---

## 4. Why chat should not be the permanent home

Even if you *capture* via chat, do **not** leave the narrative trapped there.

Reasons:

* Agents need deterministic grounding
* Chat history is noisy
* You’ll want to:
  * Re-run summaries
  * Compare narratives vs evidence
  * Detect inconsistencies later

`user_narrative.md` becomes a  **pillar file** , like:

* `strategy.md`
* `claims.md`
* `facts.md`

---

## 5. Naming matters (internally + UX)

Avoid:

* “Onboarding”
* “Setup”
* “Wizard”

Use language like:

* **Case Grounding**
* **Agent Context**
* **Narrative Intake**
* **Tell Your Story**

This signals depth, not bureaucracy.

---

## 6. Minimal engineering note (so this doesn’t balloon)

You do **not** need:

* A new chat system
* A complex form
* Speech-specific UI

You need:

* A chat *mode flag*
* A persistence hook
* A file writer

Pseudo-logic:

```text
if chat_mode === "narrative_capture":
  buffer messages
on complete:
  compile → user_narrative.md
  attach to case context
```

---

## 7. Strategic insight (why this is a big deal)

What you’re designing is the difference between:

* “AI that reads documents”
* **AI that understands cases**

Most legal tools stop at ingestion.

This step:

* Gives JusticeQuest defensibility
* Makes War Room dramatically stronger
* Enables later features like:
  * Narrative vs evidence conflict detection
  * Credibility scoring
  * Timeline reconstruction
  * Strategy divergence analysis

---

### Bottom line

Use  **chat for capture** , but  **files for truth** .

Make the user narrative:

* Optional
* Easy
* Respected
* Persistent

If you want, next we can:

* Design the exact agent prompts
* Define the narrative-to-summary transformation
* Or map how this context flows into War Room inference without leakage
