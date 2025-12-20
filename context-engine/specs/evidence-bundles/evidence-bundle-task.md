# Evidence Bundle Specification

## Overview
The Evidence Bundle is a named, ordered container that references existing case documents. It allows users to organize documents into "exhibits" (e.g., Exhibit A, Exhibit B) for use in drafts without duplicating the actual files.

## Core Requirements
1.  **Create Bundle**: Users can create a new bundle with a name and optional description.
2.  **Add Documents**: Users can select documents from the existing case files and add them to the bundle.
3.  **Labeling**: Each item in the bundle has an "Exhibit Label" (e.g., "A", "B", "1", "2") and an optional title.
4.  **Ordering**: Users can reorder items within the bundle.
5.  **Persistence**: Bundles must be saved to the database.
6.  **Read-Only Reference**: The bundle does not modify the original documents; it only references them.

## Data Model

### `evidence_bundles` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| [id](file:///Users/ianbruce/code/aionui/src/process/bridge/caseBridge.ts#4-90) | TEXT | PRIMARY KEY | UUID |
| `case_file_id` | TEXT | FOREIGN KEY | Reference to the Case File |
| `name` | TEXT | NOT NULL | Name of the bundle |
| `description` | TEXT | | Optional description |
| `created_by` | TEXT | | User ID who created it |
| `created_at` | INTEGER | NOT NULL | Timestamp |
| `updated_at` | INTEGER | NOT NULL | Timestamp |

### `evidence_bundle_items` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| [id](file:///Users/ianbruce/code/aionui/src/process/bridge/caseBridge.ts#4-90) | TEXT | PRIMARY KEY | UUID |
| `bundle_id` | TEXT | FOREIGN KEY | Reference to the Bundle |
| `document_id` | TEXT | FOREIGN KEY | Reference to `case_documents` |
| `exhibit_label` | TEXT | NOT NULL | e.g. "Exhibit A" |
| `exhibit_title` | TEXT | | Optional human-readable title |
| `sort_order` | INTEGER | NOT NULL | Order in the bundle |
| `created_at` | INTEGER | NOT NULL | Timestamp |

## UI/UX Flow
1.  **Entry**: "Evidence Bundles" tab or section in the Case Workspace.
2.  **List View**: Shows all bundles for the current case.
3.  **Create/Edit**:
    -   Modal or Page.
    -   Input: Name, Description.
    -   List of Current Items (sortable).
    -   "Add Document" button opens a file picker (showing case documents).
    -   Editable "Exhibit Label" for each item.

## Agent Interaction
-   The agent will receive the `bundle_id` and can resolve the list of documents and their labels.
-   The agent does not manage the bundle creation state; it consumes the final bundle.
