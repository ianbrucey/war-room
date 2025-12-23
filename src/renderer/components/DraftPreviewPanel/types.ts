/**
 * Types for the draft JSON structure
 */

export interface DraftBlock {
  id: string;
  type: 'section_heading' | 'numbered_paragraph' | 'unnumbered_paragraph' | 'block_quote';
  content: string;
}

export interface DraftCaption {
  court_name?: string;
  court_division?: string;
  plaintiff?: string;
  defendant?: string;
  case_number?: string;
  document_title?: string;
}

export interface DraftSignatureBlock {
  respectfully_submitted_date?: string;
  attorney_name?: string;
  bar_number?: string;
  firm_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  representing?: string;
}

export interface DraftDocument {
  document_type: string;
  metadata?: {
    title?: string;
    created_at?: string;
    last_modified?: string;
    status?: string;
  };
  caption: DraftCaption;
  body: DraftBlock[];
  signature_block?: DraftSignatureBlock;
  footnotes?: Array<{ id: string; content: string }>;
}
