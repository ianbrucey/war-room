# Research Vault & Button Specification

## Overview
The Research feature allows users to perform research tasks via an agent and store the results in a structured "Research Vault". It handles query input, tool selection (web search vs. deep research), and persistence of results as text/markdown files.

## Core Requirements
1.  **Research Input**: A dedicated UI for submitting research queries (max 500 chars).
2.  **Tool Selection**: The system/agent decides whether to use simple web search or deep research tools.
3.  **Persistence Toggle**: User can choose to save the result to the Research Vault.
4.  **Storage**: Research items are stored as Markdown files on the filesystem and indexed in the database.
5.  **Format**: All research inputs (including user uploads) must be converted to Text or Markdown.
6.  **Agent Access**: The CLI agent must have read access to the research vault (text/md files).

## Data Model

### `research_items` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| [id](file:///Users/ianbruce/code/aionui/src/process/bridge/caseBridge.ts#4-90) | TEXT | PRIMARY KEY | UUID |
| `case_file_id` | TEXT | FOREIGN KEY | Reference to the Case File |
| `title` | TEXT | NOT NULL | Title of the research |
| `original_filename` | TEXT | | Original filename if uploaded |
| `storage_path` | TEXT | NOT NULL | Path to the `extracted.md` file |
| `format` | TEXT | NOT NULL | [md](file:///Users/ianbruce/code/aionui/WARP.md) or [txt](file:///Users/ianbruce/code/aionui/cookies.txt) |
| `source_type` | TEXT | NOT NULL | `agent_generated` or `user_uploaded` |
| `created_by` | TEXT | | User ID |
| `created_at` | INTEGER | NOT NULL | Timestamp |

### Filesystem Structure
```
/cases/{case_id}/research/
  /{research_id}/
    original.pdf        (optional, restricted access)
    extracted.md        (required, agent accessible)
    metadata.json       (optional)
```

## Interaction Flow (Research Button)
1.  **Click Research Icon**: Opens Research Panel.
2.  **Input**: Text area (500 char limit). Placeholder: "Describe what you want researched...".
3.  **Options**: Toggle "Save result to Research Vault".
4.  **Submit**:
    -   Triggers Agent Task.
    -   Agent performs research.
    -   If "Save" is checked: Result is saved to FS and DB.
    -   Result is displayed in the UI.

## Interaction Flow (User Upload)
1.  **Upload**: User uploads PDF, DOCX, MD, or TXT to Research Vault.
2.  **Processing**:
    -   If PDF/DOCX: Convert to Markdown (using Mistral or similar).
    -   Save `extracted.md` to `{research_id}/extracted.md`.
    -   Create DB entry.
3.  **List**: Item appears in the Research List.

## Agent Responsibilities
1.  **Tooling**: Decide between `web_search_tool` and `deep_research_tool`.
2.  **Output**: Return structured content (Markdown).
3.  **Access**: Agent reads from `extracted.md` only. No direct PDF reading.
