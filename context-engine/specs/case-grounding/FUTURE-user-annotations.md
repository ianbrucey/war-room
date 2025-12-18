# Future Enhancement: User Annotations on Documents

**Status:** Deferred  
**Priority:** Medium  
**Prerequisite:** Case Grounding feature must be complete first

---

## Concept

Allow users to add contextual annotations to individual documents that the AI cannot infer from the document content alone. These annotations enhance the case summary by providing human context.

---

## Use Cases

1. **Explain significance:** "This email proves they knew about the issue before the meeting"
2. **Add context:** "The 'John' mentioned here is John Smith, not John Davis"
3. **Flag importance:** "This is the most important document - it shows intent"
4. **Correct AI misinterpretation:** "The AI summary missed that this was sarcasm"
5. **Note contradictions:** "This contradicts what they said in Document #3"

---

## Proposed Workflow

```
1. User uploads documents → Documents process through pipeline
2. User views document summaries in File Preview panel
3. User clicks "Add Note" on any document
4. User types annotation (short text, not voice)
5. Annotation saved to document's metadata.json:
   {
     "user_annotations": [
       {
         "text": "This proves prior knowledge",
         "created_at": "2024-12-18T10:00:00Z",
         "updated_at": null
       }
     ]
   }
6. Summary regeneration reads annotations and incorporates them
```

---

## Technical Considerations

### Storage Location
- Store in existing `{workspace}/documents/{doc-id}/metadata.json`
- Add `user_annotations` array field
- No new database columns needed

### Staleness
- Adding/editing an annotation should mark summary as stale
- Need to track annotation timestamps for staleness comparison

### UI
- "Add Note" button on document cards in File Preview
- Inline text input (not modal)
- Show existing annotations below document summary
- Edit/delete capability

---

## Why Deferred

1. **Scope creep risk** — Adding annotations significantly increases the feature surface area
2. **Dependency on preview UX** — Need stable document preview experience first
3. **Narrative is higher value** — User narrative provides 80% of the contextual value; annotations are incremental
4. **Complexity** — Requires changes to document processing pipeline, not just case-level logic

---

## Revisit When

- Case Grounding feature is shipped and stable
- User feedback indicates demand for document-level notes
- File Preview panel has solidified UX patterns

---

## Related

- `STEP_1_INTERVIEW_PREREQUISITES.md` (prototype) mentioned user annotations in Phase 4
- Current staleness detection only tracks document count, not content changes

