/**
 * TypeScript types for Evidence Bundle
 * Matches schema in case-folder-template/evidence/evidence-bundle.schema.json
 */

export interface KeyExcerpt {
  page: number | string;
  quote: string;
  relevance?: string;
}

export interface BatesRange {
  start: string;
  end: string;
}

export type ExhibitStatus = 'draft' | 'included' | 'excluded' | 'pending_review';

export interface Exhibit {
  exhibit_id: string;
  label: string;
  title: string;
  document_ref: string;
  description?: string | null;
  page_range?: string | null;
  key_excerpts?: KeyExcerpt[];
  supports_claims?: string[];
  bates_range?: BatesRange | null;
  status?: ExhibitStatus;
  notes?: string | null;
}

export interface BundleMetadata {
  total_exhibits?: number;
  total_pages?: number;
  filing_deadline?: string | null;
  notes?: string | null;
}

export interface EvidenceBundle {
  $schema?: string;
  bundle_id: string | null;
  purpose: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  exhibits: Exhibit[];
  metadata?: BundleMetadata;
}

/**
 * Empty/default evidence bundle for when file doesn't exist or is empty
 */
export const EMPTY_EVIDENCE_BUNDLE: EvidenceBundle = {
  bundle_id: null,
  purpose: null,
  created_at: null,
  updated_at: null,
  exhibits: [],
  metadata: {
    total_exhibits: 0,
    total_pages: 0,
    filing_deadline: null,
    notes: null,
  },
};

