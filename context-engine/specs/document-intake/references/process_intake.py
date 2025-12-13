#!/usr/bin/env python3
"""
Document Intake Processing Script
Version: 4.0 - Multi-File Type Support
Last Updated: 2025-10-30

Automated document processing workflow with 3-phase architecture:

PHASE 1: TEXT EXTRACTION (Parallel Processing, Multi-File Type)
- Parallel processing of all supported files (10 files simultaneously)
- Mistral OCR API for documents (PDF, DOCX, PPTX) and images
- Mistral Audio API for audio transcription (MP3, WAV, M4A, OGG)
- Pandas for structured data (CSV, XLSX)
- Gemini Vision for image descriptions (legal evidence photos)
- Automatic page break insertion for legal citations (--- Page X ---)
- Cost: ~$1 per 1,000 pages (OCR), ~$0.10 per minute (audio)
- Speed: ~2-5 minutes for 16 documents

Supported File Types:
- Documents: PDF, DOCX, PPTX (Mistral OCR)
- Data: CSV, XLSX (Pandas)
- Text: TXT, MD (Direct copy)
- Media: JPG, PNG, GIF, BMP, TIFF, AVIF (Mistral OCR + Gemini Vision)
- Audio: MP3, WAV, M4A, OGG (Mistral Audio Transcription)

PHASE 2: DOCUMENT SUMMARIES (Parallel Processing)
- Parallel Gemini calls (10 documents simultaneously)
- Reads extracted text files (faster than source files)
- Structured JSON output with document classification
- Automatic retry with exponential backoff for rate limits
- Speed: ~60-90 seconds for 10 documents

PHASE 3: CASE SUMMARY SYNTHESIS (Comprehensive Analysis)
- Single Gemini call with ALL document summaries
- Cross-document synthesis and conflict detection
- Comprehensive Case Summary and Timeline generation
- Speed: ~60-120 seconds one-time

Usage:
    # Run all phases automatically (default)
    python scripts/process_intake.py cases/[CASE_ID]/Intake

    # Run specific phase only
    python scripts/process_intake.py cases/[CASE_ID]/Intake --phase extract
    python scripts/process_intake.py cases/[CASE_ID]/Intake --phase summarize
    python scripts/process_intake.py cases/[CASE_ID]/Intake --phase synthesize

    # Resume from specific phase
    python scripts/process_intake.py cases/[CASE_ID]/Intake --resume-from summarize
"""

import os
import sys
import json
import subprocess
import re
import time
import argparse
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from multiprocessing import Pool, cpu_count
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import Gemini Interface (handle both direct execution and module import)
try:
    from scripts.gemini_interface import GeminiInterface
    GEMINI_INTERFACE_AVAILABLE = True
except ImportError:
    try:
        # Try relative import for when script is run directly
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from scripts.gemini_interface import GeminiInterface
        GEMINI_INTERFACE_AVAILABLE = True
    except ImportError:
        GEMINI_INTERFACE_AVAILABLE = False
        print("⚠️  WARNING: GeminiInterface not available. Falling back to CLI only.")

# Import Mistral API client
try:
    from mistralai import Mistral
    MISTRAL_AVAILABLE = True
except ImportError:
    MISTRAL_AVAILABLE = False
    print("⚠️  WARNING: mistralai package not installed. Mistral OCR will not be available.")

# Document Indexer (no-AI) import
try:
    from scripts.document_indexer import rebuild_index as _REBUILD_DOC_INDEX
    DOC_INDEXER_AVAILABLE = True
except ImportError:
    try:
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from scripts.document_indexer import rebuild_index as _REBUILD_DOC_INDEX
        DOC_INDEXER_AVAILABLE = True
    except ImportError:
        DOC_INDEXER_AVAILABLE = False
        print("⚠️  WARNING: document_indexer not available. Document index will not be built automatically.")

# Exhibit Extractor import
try:
    from scripts.exhibit_extractor import ExhibitExtractor
    EXHIBIT_EXTRACTOR_AVAILABLE = True
except ImportError:
    try:
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from scripts.exhibit_extractor import ExhibitExtractor
        EXHIBIT_EXTRACTOR_AVAILABLE = True
    except ImportError:
        EXHIBIT_EXTRACTOR_AVAILABLE = False
        print("⚠️  WARNING: exhibit_extractor not available. Exhibit extraction will be disabled.")

# Document type patterns for filename-based detection
DOCUMENT_TYPE_PATTERNS = {
    'Motion': ['motion', 'mtd', 'mtc', 'mts', 'mtv'],
    'Response': ['response', 'opposition', 'reply', 'answer'],
    'Complaint': ['complaint', 'petition', 'amended complaint'],
    'Order': ['order', 'ruling', 'judgment', 'decree'],
    'Notice': ['notice', 'notification', 'noa'],
    'Evidence': ['exhibit', 'evidence', 'attachment', 'affidavit'],
    'Research': ['memo', 'research', 'analysis', 'brief']
}

# Supported file types for multi-file intake processing
SUPPORTED_FILE_TYPES = {
    'pdf': ['.pdf'],
    'docx': ['.docx'],
    'pptx': ['.pptx'],
    'csv': ['.csv'],
    'xlsx': ['.xlsx', '.xls'],
    'txt': ['.txt'],
    'md': ['.md', '.markdown'],
    'image': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.avif'],
    'audio': ['.mp3', '.wav', '.m4a', '.ogg']
}

# ═══════════════════════════════════════════════════════════════
# STATIC WORKER FUNCTIONS (for multiprocessing - avoid pickling issues)
# ═══════════════════════════════════════════════════════════════

def _generate_summary_worker_static(doc_info: Dict) -> Dict:
    """Static worker function for parallel summary generation (avoids pickling self.gemini)

    This function is called by multiprocessing.Pool.map() and must be picklable.
    It generates a document summary using Gemini CLI (subprocess) instead of the API.
    """
    try:
        # For TXT/MD files, use original file directly (no extraction needed)
        # For other files, use full_text_extraction.txt
        text_file = doc_info['doc_folder'] / "full_text_extraction.txt"

        if not text_file.exists():
            # Check if original file is TXT/MD and use it directly
            original_file = doc_info.get('file_path')
            if original_file and original_file.suffix.lower() in ['.txt', '.md', '.markdown']:
                text_file = original_file
            else:
                raise Exception(f"No text extraction found and original file is not plaintext")

        output_json = doc_info['doc_folder'] / "document_summary.json"

        # Build prompt for Gemini CLI
        workspace_root = Path(__file__).resolve().parent.parent
        absolute_text = text_file.absolute()
        absolute_output = output_json.absolute()
        relative_text = absolute_text.relative_to(workspace_root)
        relative_output = absolute_output.relative_to(workspace_root)

        prompt = f"""Analyze this legal document text and create a JSON summary.

Read the document text: @{relative_text}

Output JSON with this EXACT structure:
{{
  "document_summary": {{
    "executive_summary": "very detailed summary of the document",
    "document_type": "Motion/Response/Complaint/Order/Notice/Evidence/Research",
    "key_parties": ["list of parties involved - plaintiff, defendant, counsel, etc."],
    "main_arguments": ["list of primary legal arguments, claims, or requests"],
    "important_dates": ["list of critical dates, deadlines, or filing dates"],
    "jurisdiction": "where this case is being heard (if applicable)",
    "authorities": ["list of laws, statutes, or precedents cited"],
    "critical_facts": ["list of key factual allegations or findings"],
    "requested_relief": "what outcome or relief is being sought"
  }}
}}

IMPORTANT: Escape all control characters (newlines, tabs, etc.) in JSON strings.
Use \\n for newlines, \\t for tabs. Ensure valid JSON output.

Write to: {relative_output}
"""

        # Use Gemini CLI (subprocess) to avoid pickling issues
        cmd = [
            'gemini',
            '-m', 'gemini-2.5-flash',
            '-y',  # YOLO mode for file writes
            prompt
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=workspace_root
        )

        if result.returncode != 0:
            raise Exception(f"Gemini CLI failed: {result.stderr}")

        # Support both old (pdf_path) and new (file_path) keys for backward compatibility
        file_ref = doc_info.get('file_path') or doc_info.get('pdf_path')

        return {
            'file_path': file_ref,
            'doc_folder': doc_info['doc_folder'],
            'doc_type': doc_info.get('doc_type', 'Unknown'),
            'success': True,
            'token_stats': None  # Token stats not available in multiprocessing context
        }
    except Exception as e:
        # Support both old (pdf_path) and new (file_path) keys for backward compatibility
        file_ref = doc_info.get('file_path') or doc_info.get('pdf_path')

        return {
            'file_path': file_ref,
            'doc_folder': doc_info.get('doc_folder'),
            'success': False,
            'error': str(e)
        }

class DocumentProcessor:
    """Main document processing class with phased architecture"""

    def __init__(self, intake_path: str, verbose: bool = True, phase: Optional[str] = None, resume_from: Optional[str] = None,
                 verify_case_summary: bool = True,
                 verification_mode: str = "single",
                 verification_sources_dir: Optional[str] = None,
                 verification_sources_glob: Optional[str] = None,
                 verification_focus: Optional[List[str]] = None,
                 verification_timing: str = "immediate"):
        self.intake_path = Path(intake_path)
        self.verbose = verbose
        self.phase = phase  # Specific phase to run (extract, summarize, synthesize)
        self.resume_from = resume_from  # Resume from specific phase
        self.case_folder = self._find_case_folder()
        self.documents_folder = self.case_folder / "documents"
        self.log_file = self.documents_folder / "processing_log.txt"

        # Verification config
        self.verify_case_summary = bool(verify_case_summary)
        self.verification_mode = verification_mode or "single"
        self.verification_sources_dir = verification_sources_dir
        self.verification_sources_glob = verification_sources_glob
        self.verification_focus = verification_focus or ["facts", "claims", "procedural"]
        self.verification_timing = verification_timing or "immediate"

        # Phase tracking
        self.phase_start_time = None
        self.total_start_time = None

        # Ensure documents folder exists
        self.documents_folder.mkdir(exist_ok=True)

        # Load Gemini configuration from settings.json
        self.gemini_config = self._load_gemini_config()

        # Load exhibit extraction configuration
        self.exhibit_config = self._load_exhibit_config()

        # Initialize Gemini Interface (lazy - only when needed, to avoid pickling issues)
        self._gemini = None

        # Initialize logging
        self._log("INFO", f"Document Processor initialized (Version 4.0 - Multi-File Type Support)")
        self._log("INFO", f"Case folder: {self.case_folder.name}")
        if self.phase:
            self._log("INFO", f"Running specific phase: {self.phase}")
        if self.resume_from:
            self._log("INFO", f"Resuming from phase: {self.resume_from}")

    def _load_gemini_config(self) -> Dict:
        """Load Gemini configuration from settings.json"""
        try:
            # Find settings.json in repository root
            repo_root = Path(__file__).parent.parent
            settings_file = repo_root / "settings.json"

            if not settings_file.exists():
                self._log("WARNING", "settings.json not found, using default Gemini config")
                return {
                    "backend": "cli",
                    "model": "gemini-2.5-flash",
                    "temperature": 0.35,
                    "enable_token_tracking": True,
                    "timeout": 90,
                    "max_retries": 3
                }

            with open(settings_file, 'r') as f:
                settings = json.load(f)

            # Extract gemini config
            gemini_config = settings.get("gemini", {})

            # Set defaults for missing keys
            defaults = {
                "backend": "cli",
                "model": "gemini-2.5-flash",
                "temperature": 0.35,
                "enable_token_tracking": True,
                "timeout": 90,
                "max_retries": 3
            }

            for key, default_value in defaults.items():
                if key not in gemini_config:
                    gemini_config[key] = default_value

            return gemini_config

        except Exception as e:
            self._log("WARNING", f"Failed to load Gemini config: {e}, using defaults")
            return {
                "backend": "cli",
                "model": "gemini-2.5-flash",
                "temperature": 0.35,
                "enable_token_tracking": True,
                "timeout": 90,
                "max_retries": 3
            }

    def _load_exhibit_config(self) -> Dict:
        """Load exhibit extraction configuration from settings.json"""
        try:
            repo_root = Path(__file__).parent.parent
            settings_file = repo_root / "settings.json"

            if not settings_file.exists():
                return {"enabled": False}

            with open(settings_file, 'r') as f:
                settings = json.load(f)

            exhibit_config = settings.get("exhibit_extraction", {})

            return {
                "enabled": exhibit_config.get("enabled", False),
                "detection_method": exhibit_config.get("detection_method", "gemini"),
                "document_types": exhibit_config.get("document_types", ["Complaint", "Petition", "Motion", "Service Packet"]),
                "create_summaries": exhibit_config.get("create_summaries", False),
                "min_exhibit_pages": exhibit_config.get("min_exhibit_pages", 1)
            }

        except Exception as e:
            self._log("WARNING", f"Failed to load exhibit config: {e}, disabling exhibit extraction")
            return {"enabled": False}

    @property
    def gemini(self) -> Optional[object]:
        """Lazy initialization of Gemini Interface (to avoid pickling issues with multiprocessing)"""
        if self._gemini is None:
            self._gemini = self._init_gemini_interface()
        return self._gemini

    def _init_gemini_interface(self) -> Optional[object]:
        """Initialize Gemini Interface with configured backend"""
        if not GEMINI_INTERFACE_AVAILABLE:
            return None

        try:
            gemini = GeminiInterface(
                backend=self.gemini_config["backend"],
                model=self.gemini_config["model"],
                temperature=self.gemini_config["temperature"],
                enable_token_tracking=self.gemini_config["enable_token_tracking"],
                verbose=False  # We handle logging ourselves
            )

            backend_name = self.gemini_config["backend"].upper()
            self._log("INFO", f"Gemini Interface initialized: {backend_name} backend ({self.gemini_config['model']})")

            return gemini

        except Exception as e:
            self._log("WARNING", f"Failed to initialize GeminiInterface: {e}, will use subprocess fallback")
            return None

    # ═══════════════════════════════════════════════════════════════
    # FILE TYPE DETECTION & CENTRALIZED FOLDER MANAGEMENT
    # ═══════════════════════════════════════════════════════════════

    def _detect_file_type(self, file_path: Path) -> str:
        """Detect file type using extension-based detection

        Returns:
            File type category: 'pdf', 'docx', 'pptx', 'csv', 'xlsx', 'txt', 'md', 'image', 'audio', or 'unsupported'
        """
        ext = file_path.suffix.lower()

        # Map extension to type category
        for file_type, extensions in SUPPORTED_FILE_TYPES.items():
            if ext in extensions:
                return file_type

        return 'unsupported'

    def _create_centralized_extraction_folder(self) -> Path:
        """Create and return path to centralized full_text_extractions folder"""
        fte_folder = self.documents_folder / "full_text_extractions"
        fte_folder.mkdir(parents=True, exist_ok=True)
        return fte_folder

    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for centralized folder (remove extension, lowercase, replace special chars)"""
        # Remove extension
        name = filename.rsplit('.', 1)[0] if '.' in filename else filename

        # Lowercase and replace spaces/special chars with underscores
        name = name.lower()
        name = re.sub(r'[^a-z0-9_-]', '_', name)

        # Remove consecutive underscores
        name = re.sub(r'_+', '_', name)

        # Truncate to 200 chars
        name = name[:200]

        return name

    def _get_centralized_path(self, original_filename: str, suffix: str = '.txt') -> Path:
        """Get unique path in centralized folder with collision handling

        Args:
            original_filename: Original filename (with extension)
            suffix: File suffix for centralized copy (default: '.txt')

        Returns:
            Unique Path in centralized folder
        """
        fte_folder = self._create_centralized_extraction_folder()
        base_name = self._sanitize_filename(original_filename)

        # Handle collisions by appending counter
        counter = 0
        while True:
            if counter == 0:
                filename = f"{base_name}{suffix}"
            else:
                filename = f"{base_name}_{counter}{suffix}"

            path = fte_folder / filename
            if not path.exists():
                return path
            counter += 1

    def _discover_intake_files(self) -> List[Path]:
        """Discover all supported files in Intake folder

        Returns:
            List of Path objects for all supported files
        """
        all_files = []

        # Scan for each supported file type
        for file_type, extensions in SUPPORTED_FILE_TYPES.items():
            for ext in extensions:
                all_files.extend(self.intake_path.glob(f"*{ext}"))

        return sorted(all_files)  # Sort for consistent processing order

    # ═══════════════════════════════════════════════════════════════
    # MAIN ORCHESTRATION METHODS
    # ═══════════════════════════════════════════════════════════════

    def run_all_phases(self, skip_annotation_prompt: bool = False):
        """Run all 3 phases sequentially in a single call

        Args:
            skip_annotation_prompt: If True, skip annotation prompt after Phase 2 (for --all-phases flag)
        """
        self.total_start_time = time.time()

        try:
            # Phase 1: Extract text (parallel)
            self._log_phase_header("PHASE 1: TEXT EXTRACTION (Parallel Processing)")
            extracted_docs = self.phase_1_extract_all()
            self._log_phase_complete(1, len(extracted_docs), extracted_docs)

            if not extracted_docs:
                self._log("ERROR", "Phase 1 failed - no documents extracted")
                return

            # Phase 1.5: Extract exhibits (if enabled)
            if self.exhibit_config.get("enabled", False):
                self._log_phase_header("PHASE 1.5: EXHIBIT EXTRACTION (Hybrid AI + OCR)")
                all_exhibits = self.phase_1_5_extract_exhibits(extracted_docs)
                if all_exhibits:
                    self._log("INFO", f"Extracted {len(all_exhibits)} exhibits total")
                    # Add exhibits to extracted_docs for Phase 2 summarization
                    if self.exhibit_config.get("create_summaries", False):
                        extracted_docs.extend(all_exhibits)

            # Phase 2: Generate summaries (batch)
            self._log_phase_header("PHASE 2: DOCUMENT SUMMARIES (Batch Processing)")
            summarized_docs = self.phase_2_summarize_all(extracted_docs)
            self._log_phase_complete(2, len(summarized_docs), summarized_docs)

            if not summarized_docs:
                self._log("ERROR", "Phase 2 failed - no summaries generated")
                return

            # After Phase 2 completes, rebuild the document index for this case (no AI calls)
            self._rebuild_document_index()

            # ═══════════════════════════════════════════════════════════════
            # ANNOTATION CHECKPOINT (NEW)
            # ═══════════════════════════════════════════════════════════════
            # Stop after Phase 2 and prompt user to add contextual notes
            # unless --all-phases flag was used
            if not skip_annotation_prompt:
                self._prompt_for_annotations(summarized_docs)
                self._log("INFO", "")
                self._log("INFO", "To continue with case summary synthesis, run:")
                self._log("INFO", f"  python scripts/process_intake.py {self.intake_path} --phase synthesize")
                self._log("INFO", "")
                return  # Stop here - user must manually trigger Phase 3

            # Phase 3: Synthesize Case Summary (single comprehensive)
            self._log_phase_header("PHASE 3: CASE SUMMARY SYNTHESIS (Comprehensive Analysis)")
            self.phase_3_synthesize_case_summary(summarized_docs)
            self._log_phase_complete(3, 1, None)

            # Auto-verify after Phase 3 if configured
            if self.verify_case_summary and (self.verification_timing == "post_phase"):
                self._log("INFO", "Auto-verification (post-phase) enabled - running document verification...")
                self._run_verification_on_case_summary()


            # Final summary
            self._log_all_phases_complete()

        except KeyboardInterrupt:
            self._log("WARNING", "Processing interrupted by user")
            self._log("INFO", "You can resume with: --resume-from [phase]")
        except Exception as e:
            self._log("ERROR", f"Processing failed: {e}")
            raise

    def run_phase(self, phase_name: str):
        """Run a specific phase only"""
        self.total_start_time = time.time()

        if phase_name == "extract":
            self._log_phase_header("PHASE 1: TEXT EXTRACTION (Parallel Processing)")
            extracted_docs = self.phase_1_extract_all()
            self._log_phase_complete(1, len(extracted_docs), extracted_docs)

            # ═══════════════════════════════════════════════════════════════
            # EXHIBIT EXTRACTION TEMPORARILY DISABLED
            # ═══════════════════════════════════════════════════════════════
            # Phase 1.5: Extract exhibits (if enabled)
            # NOTE: Exhibit extraction has been temporarily disabled to prevent
            # automatic exhibit detection and splitting during document intake.
            # To re-enable, uncomment the lines below.
            # if self.exhibit_config.get("enabled", False):
            #     self._log_phase_header("PHASE 1.5: EXHIBIT EXTRACTION (Automatic Detection)")
            #     self.phase_1_5_extract_exhibits(extracted_docs)

        elif phase_name == "summarize":
            self._log_phase_header("PHASE 2: DOCUMENT SUMMARIES (Batch Processing)")
            extracted_docs = self._load_extracted_documents()
            summarized_docs = self.phase_2_summarize_all(extracted_docs)
            self._log_phase_complete(2, len(summarized_docs), summarized_docs)

            # After Phase 2 completes, rebuild the document index (no AI calls)
            if summarized_docs:
                self._rebuild_document_index()

        elif phase_name == "synthesize":
            self._log_phase_header("PHASE 3: CASE SUMMARY SYNTHESIS (Comprehensive Analysis)")
            summarized_docs = self._load_summarized_documents()
            self.phase_3_synthesize_case_summary(summarized_docs)
            self._log_phase_complete(3, 1, None)

        else:
            self._log("ERROR", f"Unknown phase: {phase_name}")
            return

        self._log_all_phases_complete()

    def resume_from_phase(self, phase_name: str):
        """Resume processing from a specific phase"""
        self.total_start_time = time.time()

        if phase_name == "summarize":
            self._log_phase_header("PHASE 2: DOCUMENT SUMMARIES (Batch Processing)")
            extracted_docs = self._load_extracted_documents()
            summarized_docs = self.phase_2_summarize_all(extracted_docs)
            self._log_phase_complete(2, len(summarized_docs), summarized_docs)

            # After Phase 2 completes, rebuild the document index (no AI calls)
            if summarized_docs:
                self._rebuild_document_index()

            self._log_phase_header("PHASE 3: CASE SUMMARY SYNTHESIS (Comprehensive Analysis)")
            self.phase_3_synthesize_case_summary(summarized_docs)
            self._log_phase_complete(3, 1, None)

        elif phase_name == "synthesize":
            self._log_phase_header("PHASE 3: CASE SUMMARY SYNTHESIS (Comprehensive Analysis)")
            summarized_docs = self._load_summarized_documents()
            self.phase_3_synthesize_case_summary(summarized_docs)
            self._log_phase_complete(3, 1, None)

        else:
            self._log("ERROR", f"Cannot resume from phase: {phase_name}")
            return

        self._log_all_phases_complete()

    # ═══════════════════════════════════════════════════════════════
    # PHASE 1: TEXT EXTRACTION (Parallel Processing)
    # ═══════════════════════════════════════════════════════════════

    def phase_1_extract_all(self) -> List[Dict]:
        """Phase 1: Extract text from all supported files with type-aware routing"""
        self.phase_start_time = time.time()

        # Get all supported files from Intake folder
        all_files = self._discover_intake_files()

        if not all_files:
            self._log("WARNING", "No supported files found in Intake folder")
            return []

        # Log file type breakdown
        file_types = {}
        for f in all_files:
            ftype = self._detect_file_type(f)
            file_types[ftype] = file_types.get(ftype, 0) + 1

        self._log("INFO", f"Found {len(all_files)} files to process:")
        for ftype, count in sorted(file_types.items()):
            self._log("INFO", f"  - {ftype.upper()}: {count} files")

        # Determine number of workers (max 10, or number of CPUs)
        max_workers = min(10, cpu_count(), len(all_files))
        self._log("INFO", f"Processing {len(all_files)} files in parallel ({max_workers} workers)")

        # Parallel processing with router
        with Pool(processes=max_workers) as pool:
            results = pool.map(self._extract_single_document_router, all_files)

        # Filter successful extractions
        successful = [r for r in results if r['success']]
        failed = [r for r in results if not r['success']]

        if failed:
            self._log("WARNING", f"{len(failed)} files failed extraction")
            for fail in failed:
                self._log("ERROR", f"  - {fail['file_path'].name}: {fail.get('error', 'Unknown error')}")

        # Log extraction method breakdown
        if successful:
            methods = {}
            for r in successful:
                method = r.get('extraction_method', 'unknown')
                methods[method] = methods.get(method, 0) + 1

            self._log("INFO", "Extraction methods used:")
            for method, count in sorted(methods.items()):
                self._log("INFO", f"  - {method}: {count} files")

        return successful

    def _extract_single_document_router(self, file_path: Path) -> Dict:
        """Route file to appropriate extraction method based on file type"""
        try:
            file_type = self._detect_file_type(file_path)

            # Create document folder
            doc_folder = self.documents_folder / file_path.stem
            doc_folder.mkdir(parents=True, exist_ok=True)

            # Move file from Intake to document folder
            moved_file = doc_folder / file_path.name
            if not moved_file.exists():
                file_path.rename(moved_file)
                self._log("INFO", f"Moved: {file_path.name} → {doc_folder.name}/")

            # Route to appropriate handler
            handlers = {
                'pdf': self._extract_mistral_ocr,
                'docx': self._extract_mistral_ocr,
                'pptx': self._extract_mistral_ocr,
                'image': self._extract_image_hybrid,
                'audio': self._extract_audio,
                'csv': self._extract_csv,
                'xlsx': self._extract_excel,
                'txt': self._extract_plaintext,
                'md': self._extract_plaintext,
            }

            handler = handlers.get(file_type, self._extract_unsupported)
            return handler(moved_file, doc_folder)

        except Exception as e:
            self._log("ERROR", f"Failed to route {file_path.name}: {e}")
            return {
                'file_path': file_path,
                'success': False,
                'error': str(e)
            }

    def _extract_single_document(self, pdf_path: Path) -> Dict:
        """DEPRECATED: Legacy PDF-only extraction method. Use _extract_single_document_router() instead.

        Kept for backward compatibility only."""
        try:
            # Detect document type
            doc_type = self.detect_document_type(pdf_path)

            # Create document folder
            doc_folder = self.documents_folder / pdf_path.stem
            doc_folder.mkdir(parents=True, exist_ok=True)

            # Move PDF from Intake to document folder
            moved_pdf = doc_folder / pdf_path.name
            if not moved_pdf.exists():
                pdf_path.rename(moved_pdf)
                self._log("INFO", f"Moved: {pdf_path.name} → {doc_type}/{pdf_path.name}")

            # Extract text with Mistral OCR (includes page breaks)
            extracted_text, metadata = self.extract_text_with_mistral(moved_pdf, doc_folder)

            # Save extracted text to file
            text_file = doc_folder / "full_text_extraction.txt"
            with open(text_file, 'w', encoding='utf-8') as f:
                f.write(extracted_text)

            self._log("SUCCESS", f"Saved text extraction: {text_file.name}")

            return {
                'pdf_path': moved_pdf,
                'doc_folder': doc_folder,
                'doc_type': doc_type,
                'success': True,
                'ocr_used': metadata.get('ocr_used', False),
                'ocr_method': metadata.get('ocr_method', 'mistral'),
                'page_count': metadata.get('page_count', 0),
                'page_breaks': metadata.get('page_count', 0),  # Page breaks = page count
                'processing_time': metadata.get('processing_time', 0),
                'cost_estimate': metadata.get('cost_estimate', 0)
            }

        except Exception as e:
            self._log("ERROR", f"Failed to extract {pdf_path.name}: {e}")
            return {
                'pdf_path': pdf_path,
                'success': False,
                'error': str(e)
            }

    # ═══════════════════════════════════════════════════════════════
    # EXTRACTION HANDLERS (Multi-File Type Support)
    # ═══════════════════════════════════════════════════════════════

    def _extract_mistral_ocr(self, file_path: Path, doc_folder: Path) -> Dict:
        """Extract text using Mistral OCR API (PDF, DOCX, PPTX)"""
        try:
            # Detect document type for classification
            doc_type = self.detect_document_type(file_path)

            # Extract text with Mistral OCR (includes page breaks for PDFs)
            extracted_text, metadata = self.extract_text_with_mistral(file_path, doc_folder)

            # Save to document folder
            text_file = doc_folder / "full_text_extraction.txt"
            with open(text_file, 'w', encoding='utf-8') as f:
                f.write(extracted_text)

            # Copy to centralized folder
            centralized_path = self._get_centralized_path(file_path.name, '.txt')
            with open(centralized_path, 'w', encoding='utf-8') as f:
                f.write(extracted_text)

            self._log("SUCCESS", f"Extracted: {file_path.name} → {centralized_path.name}")

            return {
                'file_path': file_path,
                'doc_folder': doc_folder,
                'doc_type': doc_type,
                'success': True,
                'extraction_method': 'mistral_ocr',
                'text_extracted': True,
                'centralized_copy': centralized_path,
                'metadata': metadata
            }

        except Exception as e:
            raise Exception(f"Mistral OCR failed: {e}")

    def _extract_image_hybrid(self, file_path: Path, doc_folder: Path) -> Dict:
        """Extract text (Mistral OCR) + visual description (Gemini Vision)"""
        try:
            # Step 1: Mistral OCR for text extraction
            extracted_text, ocr_metadata = self.extract_text_with_mistral(file_path, doc_folder)

            # Step 2: Gemini Vision for visual description
            visual_description = self._get_gemini_vision_description(file_path, doc_folder)

            # Combine text + description
            combined_content = f"""# Image Analysis: {file_path.name}

## Extracted Text (OCR)
{extracted_text if extracted_text.strip() else "[No text detected in image]"}

## Visual Description
{visual_description}
"""

            # Save to document folder
            text_file = doc_folder / "full_text_extraction.txt"
            with open(text_file, 'w', encoding='utf-8') as f:
                f.write(combined_content)

            # Copy to centralized folder
            centralized_path = self._get_centralized_path(file_path.name, '.txt')
            with open(centralized_path, 'w', encoding='utf-8') as f:
                f.write(combined_content)

            self._log("SUCCESS", f"Extracted (hybrid): {file_path.name} → {centralized_path.name}")

            return {
                'file_path': file_path,
                'doc_folder': doc_folder,
                'doc_type': 'IMAGE',
                'success': True,
                'extraction_method': 'hybrid_ocr_vision',
                'text_extracted': True,
                'centralized_copy': centralized_path,
                'metadata': {**ocr_metadata, 'visual_description_generated': True}
            }

        except Exception as e:
            raise Exception(f"Image extraction failed: {e}")

    def _get_gemini_vision_description(self, image_path: Path, output_folder: Path) -> str:
        """Get visual description using Gemini Vision"""
        workspace_root = Path(__file__).resolve().parent.parent
        relative_image = image_path.relative_to(workspace_root)

        prompt = f"""Analyze this legal evidence image and provide a detailed description.

Image: @{relative_image}

Provide a comprehensive description including:
- What is visible in the image
- Any relevant details for legal evidence (damage, conditions, identifying features)
- Any text or labels visible
- Overall context and significance

Be objective and factual. Focus on observable details."""

        try:
            result = subprocess.run(
                ["gemini", "-m", "gemini-2.5-flash", "-p", prompt],
                capture_output=True,
                text=True,
                timeout=60,
                cwd=workspace_root
            )

            if result.returncode == 0:
                return result.stdout.strip()
            else:
                self._log("WARNING", f"Gemini Vision failed with code {result.returncode}")
                return "[Visual description unavailable]"

        except Exception as e:
            self._log("WARNING", f"Gemini Vision failed: {e}")
            return "[Visual description unavailable]"

    def _extract_audio(self, file_path: Path, doc_folder: Path) -> Dict:
        """Transcribe audio using Mistral Audio API"""
        try:
            if not MISTRAL_AVAILABLE:
                raise Exception("Mistral API client not available")

            api_key = os.getenv('MISTRAL_API_KEY')
            if not api_key:
                raise Exception("MISTRAL_API_KEY not found in environment")

            client = Mistral(api_key=api_key)

            # Upload audio file
            with open(file_path, 'rb') as f:
                uploaded_audio = client.files.upload(
                    file={"file_name": file_path.name, "content": f},
                    purpose="audio"
                )

            # Get signed URL
            signed_url = client.files.get_signed_url(file_id=uploaded_audio.id)

            # Transcribe
            transcription = client.audio.transcriptions.complete(
                model="voxtral-mini-latest",
                file_url=signed_url.url
            )

            # Cleanup
            client.files.delete(file_id=uploaded_audio.id)

            # Format transcription
            transcription_text = f"""# Audio Transcription: {file_path.name}

**Model:** {transcription.model}
**Language:** {transcription.language}

## Transcription
{transcription.text}
"""

            # Save to document folder
            text_file = doc_folder / "full_text_extraction.txt"
            with open(text_file, 'w', encoding='utf-8') as f:
                f.write(transcription_text)

            # Copy to centralized folder
            centralized_path = self._get_centralized_path(file_path.name, '.txt')
            with open(centralized_path, 'w', encoding='utf-8') as f:
                f.write(transcription_text)

            self._log("SUCCESS", f"Transcribed: {file_path.name} → {centralized_path.name}")

            return {
                'file_path': file_path,
                'doc_folder': doc_folder,
                'doc_type': 'AUDIO',
                'success': True,
                'extraction_method': 'mistral_audio',
                'text_extracted': True,
                'centralized_copy': centralized_path,
                'metadata': {
                    'model': transcription.model,
                    'language': transcription.language,
                    'usage': transcription.usage.__dict__ if hasattr(transcription, 'usage') else {}
                }
            }

        except Exception as e:
            raise Exception(f"Audio transcription failed: {e}")

    def _extract_csv(self, file_path: Path, doc_folder: Path) -> Dict:
        """Extract CSV as formatted markdown table"""
        try:
            import pandas as pd

            # Read CSV
            df = pd.read_csv(file_path)

            # Convert to markdown table
            markdown_table = f"""# CSV Data: {file_path.name}

**Rows:** {len(df)}
**Columns:** {len(df.columns)}

## Data

{df.to_markdown(index=False)}
"""

            # Save to document folder
            text_file = doc_folder / "full_text_extraction.txt"
            with open(text_file, 'w', encoding='utf-8') as f:
                f.write(markdown_table)

            # Copy to centralized folder
            centralized_path = self._get_centralized_path(file_path.name, '.txt')
            with open(centralized_path, 'w', encoding='utf-8') as f:
                f.write(markdown_table)

            self._log("SUCCESS", f"Extracted CSV: {file_path.name} → {centralized_path.name}")

            return {
                'file_path': file_path,
                'doc_folder': doc_folder,
                'doc_type': 'CSV',
                'success': True,
                'extraction_method': 'pandas',
                'text_extracted': True,
                'centralized_copy': centralized_path,
                'metadata': {'rows': len(df), 'columns': len(df.columns)}
            }

        except Exception as e:
            raise Exception(f"CSV extraction failed: {e}")

    def _extract_excel(self, file_path: Path, doc_folder: Path) -> Dict:
        """Extract Excel as formatted markdown (all sheets)"""
        try:
            import pandas as pd

            # Read all sheets
            excel_file = pd.ExcelFile(file_path)

            markdown_content = f"# Excel Data: {file_path.name}\n\n"
            markdown_content += f"**Sheets:** {len(excel_file.sheet_names)}\n\n"

            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                markdown_content += f"## Sheet: {sheet_name}\n\n"
                markdown_content += f"**Rows:** {len(df)} | **Columns:** {len(df.columns)}\n\n"
                markdown_content += df.to_markdown(index=False)
                markdown_content += "\n\n---\n\n"

            # Save to document folder
            text_file = doc_folder / "full_text_extraction.txt"
            with open(text_file, 'w', encoding='utf-8') as f:
                f.write(markdown_content)

            # Copy to centralized folder
            centralized_path = self._get_centralized_path(file_path.name, '.txt')
            with open(centralized_path, 'w', encoding='utf-8') as f:
                f.write(markdown_content)

            self._log("SUCCESS", f"Extracted Excel: {file_path.name} → {centralized_path.name}")

            return {
                'file_path': file_path,
                'doc_folder': doc_folder,
                'doc_type': 'EXCEL',
                'success': True,
                'extraction_method': 'pandas',
                'text_extracted': True,
                'centralized_copy': centralized_path,
                'metadata': {'sheets': len(excel_file.sheet_names)}
            }

        except Exception as e:
            raise Exception(f"Excel extraction failed: {e}")

    def _extract_plaintext(self, file_path: Path, doc_folder: Path) -> Dict:
        """Copy plaintext files (TXT, MD) directly to centralized folder only

        For TXT/MD files, we skip creating full_text_extraction.txt in the document folder
        since the file is already in text form. We only copy to centralized folder for verification.
        Phase 2 will read the original file directly for document summary generation.
        """
        try:
            # Read original file
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Copy ONLY to centralized folder (skip document folder copy - file is already text)
            centralized_path = self._get_centralized_path(file_path.name, '.txt')
            with open(centralized_path, 'w', encoding='utf-8') as f:
                f.write(content)

            self._log("SUCCESS", f"Copied plaintext: {file_path.name} → {centralized_path.name}")

            return {
                'file_path': file_path,
                'doc_folder': doc_folder,
                'doc_type': file_path.suffix[1:].upper(),
                'success': True,
                'extraction_method': 'direct_copy',
                'text_extracted': False,  # No extraction needed - already text
                'centralized_copy': centralized_path,
                'metadata': {'character_count': len(content)}
            }

        except Exception as e:
            raise Exception(f"Plaintext extraction failed: {e}")

    def _extract_unsupported(self, file_path: Path, doc_folder: Path) -> Dict:
        """Handle unsupported file types"""
        self._log("WARNING", f"Unsupported file type: {file_path.name}")
        return {
            'file_path': file_path,
            'doc_folder': doc_folder,
            'doc_type': 'UNSUPPORTED',
            'success': False,
            'error': f"Unsupported file type: {file_path.suffix}"
        }

    # ═══════════════════════════════════════════════════════════════
    # PHASE 1.5: EXHIBIT EXTRACTION (Automatic Detection)
    # ═══════════════════════════════════════════════════════════════
    # TEMPORARILY DISABLED - All methods below are commented out to prevent
    # automatic exhibit extraction during document intake processing.
    # To re-enable: Uncomment all three methods below and the calls in
    # run_all_phases() and run_phase() methods.
    # ═══════════════════════════════════════════════════════════════

    # def phase_1_5_extract_exhibits(self, extracted_docs: List[Dict]):
    #     """Phase 1.5: Detect and extract exhibits from legal documents"""
    #     self.phase_start_time = time.time()
    #
    #     # Filter documents by type (check if any configured type is in doc_type string)
    #     # Also check if filename contains keywords like "service", "packet", etc.
    #     eligible_docs = []
    #     for doc in extracted_docs:
    #         if not doc.get('success', False):
    #             continue
    #         doc_type = doc.get('doc_type', '').lower()
    #         # Check if any configured type appears in the document type
    #         is_eligible = any(dtype.lower() in doc_type for dtype in self.exhibit_config['document_types'])
    #         # Also check for common keywords that indicate legal documents with exhibits
    #         if not is_eligible:
    #             keywords = ['service', 'packet', 'filing', 'pleading']
    #             is_eligible = any(keyword in doc_type for keyword in keywords)
    #         if is_eligible:
    #             eligible_docs.append(doc)
    #
    #     if not eligible_docs:
    #         self._log("INFO", "No eligible documents for exhibit extraction")
    #         return
    #
    #     self._log("INFO", f"Checking {len(eligible_docs)} documents for exhibits...")
    #
    #     exhibits_found = 0
    #     for doc in eligible_docs:
    #         try:
    #             # Get PDF path (Gemini can parse PDFs directly)
    #             pdf_path = doc.get('file_path')
    #             if not pdf_path or not pdf_path.exists() or pdf_path.suffix.lower() != '.pdf':
    #                 continue
    #
    #             # Detect exhibits using Gemini (pass PDF directly)
    #             exhibits = self._detect_exhibits_with_gemini_pdf(pdf_path, doc['doc_folder'].name)
    #
    #             if not exhibits:
    #                 continue
    #
    #             # Filter by minimum pages
    #             exhibits = [
    #                 ex for ex in exhibits
    #                 if (ex['end_page'] - ex['start_page'] + 1) >= self.exhibit_config['min_exhibit_pages']
    #             ]
    #
    #             if not exhibits:
    #                 continue
    #
    #             self._log("INFO", f"📎 Found {len(exhibits)} exhibits in {doc['doc_folder'].name}")
    #
    #             # Split PDF into exhibits
    #             pdf_path = doc.get('file_path')
    #             if pdf_path and pdf_path.suffix.lower() == '.pdf':
    #                 self._split_pdf_by_exhibits(pdf_path, exhibits, doc['doc_folder'])
    #                 exhibits_found += len(exhibits)
    #
    #         except Exception as e:
    #             self._log("WARNING", f"Exhibit extraction failed for {doc['doc_folder'].name}: {e}")
    #             continue
    #
    #     elapsed = time.time() - self.phase_start_time
    #     if exhibits_found > 0:
    #         self._log("SUCCESS", f"Phase 1.5 complete: {exhibits_found} exhibits extracted in {elapsed:.1f}s")
    #     else:
    #         self._log("INFO", f"Phase 1.5 complete: No exhibits found in {elapsed:.1f}s")

    # def _detect_exhibits_with_gemini_pdf(self, pdf_path: Path, doc_name: str) -> List[Dict]:
    #     """Use Gemini to detect exhibits by analyzing PDF directly"""
    #     try:
    #         # Build prompt for Gemini to analyze PDF
    #         prompt = """Analyze this legal document PDF and identify all exhibits that are actually attached to this document.

    # TASK: Look through the entire PDF and find all exhibits with visible labels/markers.
    #
    # Common exhibit markers:
    # - "Exhibit A", "Exhibit B", "Exhibit 1", "Exhibit 2", etc.
    # - "Attachment A", "Attachment 1"
    # - "Appendix A", "Appendix 1"
    # - Page headers/footers with exhibit labels
    # - Cover pages that say "EXHIBIT [X]"
    #
    # For each exhibit you find, provide:
    # 1. Label - The exact exhibit label as it appears (e.g., "Exhibit A", "Exhibit 1")
    # 2. Start page - The page number where this exhibit begins
    # 3. End page - The last page of this exhibit (before the next exhibit or end of document)
    # 4. Description - Brief description of what the exhibit contains based on what you see
    #
    # IMPORTANT RULES:
    # ✓ DO scan the entire document thoroughly - exhibits are often at the end
    # ✓ DO look for exhibit labels in page headers, footers, and cover pages
    # ✓ DO report ALL exhibits you find with visible labels
    # ✓ DO describe what you actually see in each exhibit
    # ✗ DON'T fabricate exhibits that aren't there
    # ✗ DON'T report exhibits mentioned in the text but not actually attached
    # ✗ DON'T guess at page ranges - be accurate
    #
    # Output ONLY valid JSON (no markdown, no explanatory text):
    #
    # If exhibits found:
    # {
    #   "exhibits": [
    #     {
    #       "label": "Exhibit A",
    #       "description": "Declaration of Trust document",
    #       "start_page": 30,
    #       "end_page": 36
    #     },
    #     {
    #       "label": "Exhibit B",
    #       "description": "Death Certificate",
    #       "start_page": 37,
    #       "end_page": 37
    #     }
    #   ]
    # }
    #
    # If NO exhibits found:
    # {"exhibits": []}
    # """
    #
    #         # Use Gemini CLI to analyze PDF directly
    #         workspace_root = Path(__file__).resolve().parent.parent
    #
    #         # Convert to absolute path if needed, then make relative
    #         if not pdf_path.is_absolute():
    #             abs_pdf_path = workspace_root / pdf_path
    #         else:
    #             abs_pdf_path = pdf_path
    #
    #         relative_pdf = abs_pdf_path.relative_to(workspace_root)
    #
    #         # Use Gemini CLI with file input
    #         import subprocess
    #         cmd = [
    #             'gemini',
    #             '-m', 'gemini-2.0-flash-exp',
    #             '-y',  # YOLO mode
    #             f'@{relative_pdf}',
    #             prompt
    #         ]
    #
    #         self._log("INFO", f"Running Gemini CLI to analyze PDF: {pdf_path.name}")
    #         result = subprocess.run(
    #             cmd,
    #             cwd=workspace_root,
    #             capture_output=True,
    #             text=True,
    #             timeout=120
    #         )
    #
    #         if result.returncode != 0:
    #             self._log("WARNING", f"Gemini CLI failed: {result.stderr}")
    #             return []
    #
    #         response = result.stdout.strip()
    #
    #         # Debug: log first 500 chars of response
    #         self._log("INFO", f"Gemini response preview: {response[:500]}")
    #
    #         # Extract JSON from response (handle markdown fences and explanatory text)
    #         import re
    #
    #         # Try to find JSON object in response
    #         json_match = re.search(r'\{[^{}]*"exhibits"[^{}]*\[[^\]]*\][^{}]*\}', response, re.DOTALL)
    #         if json_match:
    #             json_str = json_match.group(0)
    #         else:
    #             # Fallback: try to clean markdown fences
    #             json_str = response
    #             if '```json' in json_str:
    #                 json_str = json_str.split('```json')[1].split('```')[0]
    #             elif '```' in json_str:
    #                 json_str = json_str.split('```')[1].split('```')[0]
    #             json_str = json_str.strip()
    #
    #         # Parse JSON
    #         result_json = json.loads(json_str)
    #         exhibits = result_json.get('exhibits', [])
    #
    #         self._log("INFO", f"Parsed {len(exhibits)} exhibits from Gemini response")
    #
    #         return exhibits
    #
    #     except Exception as e:
    #         self._log("WARNING", f"Exhibit detection failed: {e}")
    #         import traceback
    #         self._log("WARNING", f"Traceback: {traceback.format_exc()}")
    #         return []

    # def _split_pdf_by_exhibits(self, pdf_path: Path, exhibits: List[Dict], doc_folder: Path):
    #     """Split PDF into separate exhibit files using PyMuPDF"""
    #     try:
    #         import fitz  # PyMuPDF
    #
    #         # Create exhibits folder
    #         exhibits_folder = doc_folder / "exhibits"
    #         exhibits_folder.mkdir(exist_ok=True)
    #
    #         # Open source PDF
    #         doc = fitz.open(pdf_path)
    #
    #         for exhibit in exhibits:
    #             try:
    #                 # Create new PDF for this exhibit
    #                 exhibit_doc = fitz.open()
    #
    #                 # Extract pages (convert to 0-based indexing)
    #                 start_page = exhibit['start_page'] - 1
    #                 end_page = min(exhibit['end_page'], len(doc))  # Don't exceed document length
    #
    #                 for page_num in range(start_page, end_page):
    #                     if page_num < len(doc):
    #                         exhibit_doc.insert_pdf(doc, from_page=page_num, to_page=page_num)
    #
    #                 # Save exhibit PDF
    #                 label_safe = exhibit['label'].replace(' ', '_').replace('/', '_')
    #                 output_path = exhibits_folder / f"{label_safe}.pdf"
    #                 exhibit_doc.save(output_path)
    #                 exhibit_doc.close()
    #
    #                 self._log("SUCCESS", f"   Extracted: {exhibit['label']} (pages {exhibit['start_page']}-{exhibit['end_page']})")
    #
    #             except Exception as e:
    #                 self._log("WARNING", f"   Failed to extract {exhibit['label']}: {e}")
    #                 continue
    #
    #         doc.close()
    #
    #         # Save exhibit metadata
    #         metadata_path = doc_folder / "exhibits_index.json"
    #         with open(metadata_path, 'w') as f:
    #             json.dump({
    #                 'source_document': pdf_path.name,
    #                 'exhibits': exhibits,
    #                 'extraction_date': time.strftime('%Y-%m-%d %H:%M:%S')
    #             }, f, indent=2)
    #
    #     except ImportError:
    #         self._log("ERROR", "PyMuPDF (fitz) not installed. Run: pip install PyMuPDF")
    #     except Exception as e:
    #         self._log("ERROR", f"PDF splitting failed: {e}")

    # ═══════════════════════════════════════════════════════════════
    # PHASE 1.5: EXHIBIT EXTRACTION (Hybrid AI + OCR)
    # ═══════════════════════════════════════════════════════════════

    def phase_1_5_extract_exhibits(self, extracted_docs: List[Dict]) -> List[Dict]:
        """
        Phase 1.5: Extract exhibits from legal documents

        Runs between Phase 1 (text extraction) and Phase 2 (summarization).
        Detects exhibits using hybrid AI + OCR, splits PDFs, creates exhibit folders.

        Args:
            extracted_docs: List of document metadata from Phase 1

        Returns:
            List of exhibit metadata dicts (added to document index)
        """
        if not EXHIBIT_EXTRACTOR_AVAILABLE:
            self._log("WARNING", "ExhibitExtractor not available - skipping exhibit extraction")
            return []

        if not self.exhibit_config.get("enabled", False):
            self._log("INFO", "Exhibit extraction disabled in settings.json")
            return []

        self.phase_start_time = time.time()

        self._log("INFO", "")
        self._log("INFO", "═══════════════════════════════════════════════════════════════════")
        self._log("INFO", "PHASE 1.5: EXHIBIT EXTRACTION (Hybrid AI + OCR Detection)")
        self._log("INFO", "═══════════════════════════════════════════════════════════════════")
        self._log("INFO", "")
        self._log("INFO", f"Checking {len(extracted_docs)} documents for exhibits")
        self._log("INFO", f"Detection method: {self.exhibit_config.get('detection_method', 'gemini')}")
        self._log("INFO", f"Document types to check: {', '.join(self.exhibit_config.get('document_types', []))}")
        self._log("INFO", "")

        # Initialize exhibit extractor
        extractor = ExhibitExtractor(
            case_dir=self.case_folder,
            gemini_interface=self.gemini,
            config=self.exhibit_config
        )

        all_exhibits = []
        documents_with_exhibits = 0

        # Process each document
        for doc_meta in extracted_docs:
            doc_folder = Path(doc_meta['doc_folder'])

            # Handle different key names from extraction methods
            full_text_path = doc_folder / "full_text_extraction.txt"
            original_pdf_path = Path(doc_meta.get('file_path', doc_meta.get('pdf_path', '')))

            # Skip if not a PDF or if full text doesn't exist
            if not original_pdf_path.suffix.lower() == '.pdf' or not full_text_path.exists():
                continue

            document_type = doc_meta.get('document_type', doc_meta.get('doc_type', 'Unknown'))
            doc_id = doc_meta.get('doc_id', doc_folder.name)

            # Check if document type should be checked for exhibits
            if not extractor.should_extract_exhibits(document_type):
                continue

            # Extract exhibits
            try:
                exhibits = extractor.extract_exhibits(
                    document_folder=doc_folder,
                    full_text_path=full_text_path,
                    original_pdf_path=original_pdf_path,
                    document_type=document_type,
                    doc_id=doc_id
                )

                if exhibits:
                    documents_with_exhibits += 1
                    all_exhibits.extend(exhibits)

                    # Update parent document metadata
                    doc_meta['has_exhibits'] = True
                    doc_meta['exhibit_count'] = len(exhibits)
                    doc_meta['exhibits'] = [e['doc_id'] for e in exhibits]

                    self._log("SUCCESS", f"   ✅ Extracted {len(exhibits)} exhibits from {doc_id}")

            except Exception as e:
                self._log("ERROR", f"   ⚠️  Failed to extract exhibits from {doc_id}: {e}")
                continue

        # Run Phase 1 text extraction on exhibit PDFs
        if all_exhibits:
            self._log("INFO", "")
            self._log("INFO", f"Running text extraction on {len(all_exhibits)} exhibits...")

            for exhibit in all_exhibits:
                try:
                    exhibit_folder = Path(exhibit['folder'])
                    exhibit_pdf = Path(exhibit['original'])

                    # Extract text from exhibit PDF
                    result = self._extract_pdf_mistral(exhibit_pdf, exhibit_folder)

                    if result['success']:
                        exhibit['text'] = result['full_text_path']
                        self._log("SUCCESS", f"   ✅ Extracted text from {exhibit['exhibit_label']}")
                    else:
                        self._log("ERROR", f"   ⚠️  Failed to extract text from {exhibit['exhibit_label']}")

                except Exception as e:
                    self._log("ERROR", f"   ⚠️  Text extraction failed for {exhibit.get('exhibit_label', 'unknown')}: {e}")
                    continue

        elapsed = time.time() - self.phase_start_time

        # Log summary
        self._log("INFO", "")
        self._log("SUCCESS", f"Phase 1.5 complete in {elapsed:.1f}s")
        self._log("INFO", f"  Documents checked: {len(extracted_docs)}")
        self._log("INFO", f"  Documents with exhibits: {documents_with_exhibits}")
        self._log("INFO", f"  Total exhibits extracted: {len(all_exhibits)}")
        self._log("INFO", "")

        return all_exhibits

    # ═══════════════════════════════════════════════════════════════
    # PHASE 2: DOCUMENT SUMMARIES (Parallel Processing)
    # ═══════════════════════════════════════════════════════════════

    def phase_2_summarize_all(self, extracted_docs: List[Dict], num_workers: int = 10) -> List[Dict]:
        """Phase 2: Generate summaries in parallel using multiprocessing"""
        self.phase_start_time = time.time()

        if not extracted_docs:
            self._log("WARNING", "No extracted documents to summarize")
            return []

        self._log("INFO", f"═══════════════════════════════════════════════════════════════════")
        self._log("INFO", f"PHASE 2: DOCUMENT SUMMARIES (Parallel Processing)")
        self._log("INFO", f"═══════════════════════════════════════════════════════════════════")
        self._log("INFO", "")
        self._log("INFO", f"Generating summaries for {len(extracted_docs)} documents")
        self._log("INFO", f"Processing with {num_workers} parallel workers")
        self._log("INFO", f"Rate limit: 60 calls/minute (Gemini), using {num_workers} workers = safe")

        # Use multiprocessing pool with static worker function (avoids pickling self.gemini)
        with Pool(processes=min(num_workers, cpu_count())) as pool:
            results = pool.map(_generate_summary_worker_static, extracted_docs)

        # Separate successful and failed summaries
        successful = [r for r in results if r.get('success')]
        failed = [r for r in results if not r.get('success')]

        elapsed = time.time() - self.phase_start_time

        # Log results
        self._log("SUCCESS", f"Phase 2 complete: {len(successful)} summaries generated in {elapsed:.1f}s")
        if failed:
            self._log("WARNING", f"{len(failed)} summaries failed:")
            for fail in failed:
                self._log("ERROR", f"  - {fail['pdf_path'].name}: {fail.get('error', 'Unknown error')}")

        # Aggregate token stats from all workers if using API backend
        if self.gemini_config["backend"] == "api" and self.gemini_config["enable_token_tracking"]:
            total_calls = 0
            total_input_tokens = 0
            total_output_tokens = 0

            for result in successful:
                if result.get('token_stats'):
                    stats = result['token_stats']
                    total_calls += stats.get('total_calls', 0)
                    total_input_tokens += stats.get('total_input_tokens', 0)
                    total_output_tokens += stats.get('total_output_tokens', 0)

            if total_calls > 0:
                total_tokens = total_input_tokens + total_output_tokens
                # Gemini 2.5 Flash pricing: $0.075 per 1M input tokens, $0.30 per 1M output tokens
                estimated_cost = (total_input_tokens / 1_000_000 * 0.075) + (total_output_tokens / 1_000_000 * 0.30)

                self._log("INFO", f"📊 Token Usage (Phase 2):")
                self._log("INFO", f"   - Total calls: {total_calls}")
                self._log("INFO", f"   - Input tokens: {total_input_tokens:,}")
                self._log("INFO", f"   - Output tokens: {total_output_tokens:,}")
                self._log("INFO", f"   - Total tokens: {total_tokens:,}")
                self._log("INFO", f"   - Estimated cost: ${estimated_cost:.4f}")

        return successful

    def _generate_summary_worker(self, doc_info: Dict) -> Dict:
        """Worker function for parallel summary generation - uses static method to avoid pickling issues"""
        try:
            # Generate summary using static method (avoids pickling self.gemini)
            self._generate_summary_sync(doc_info)

            # Support both old (pdf_path) and new (file_path) keys for backward compatibility
            file_ref = doc_info.get('file_path') or doc_info.get('pdf_path')

            return {
                'file_path': file_ref,
                'doc_folder': doc_info['doc_folder'],
                'doc_type': doc_info.get('doc_type', 'Unknown'),
                'success': True,
                'token_stats': None  # Token stats not available in multiprocessing context
            }
        except Exception as e:
            # Support both old (pdf_path) and new (file_path) keys for backward compatibility
            file_ref = doc_info.get('file_path') or doc_info.get('pdf_path')

            return {
                'file_path': file_ref,
                'doc_folder': doc_info.get('doc_folder'),
                'success': False,
                'error': str(e)
            }

    def _generate_summary_sync(self, doc_info: Dict):
        """Generate summary from extracted text file using Gemini Interface with retry logic"""

        # For TXT/MD files, use original file directly (no extraction needed)
        # For other files, use full_text_extraction.txt
        text_file = doc_info['doc_folder'] / "full_text_extraction.txt"

        if not text_file.exists():
            # Check if original file is TXT/MD and use it directly
            original_file = doc_info.get('file_path')
            if original_file and original_file.suffix.lower() in ['.txt', '.md', '.markdown']:
                text_file = original_file
            else:
                raise Exception(f"No text extraction found and original file is not plaintext")

        output_json = doc_info['doc_folder'] / "document_summary.json"

        # Build prompt (different for CLI vs API)
        if self.gemini and self.gemini_config["backend"] == "api":
            # API backend: read file content directly
            prompt = f"""Analyze this legal document text and create a JSON summary.

Output JSON with this EXACT structure:
{{
  "document_summary": {{
    "executive_summary": "very detailed summary of the document",
    "document_type": "Motion/Response/Complaint/Order/Notice/Evidence/Research",
    "key_parties": ["list of parties involved - plaintiff, defendant, counsel, etc."],
    "main_arguments": ["list of primary legal arguments, claims, or requests"],
    "important_dates": ["list of critical dates, deadlines, or filing dates"],
    "jurisdiction": "where this case is being heard (if applicable)",
    "authorities": ["list of laws, statutes, or precedents cited"],
    "critical_facts": ["list of key factual allegations or findings"],
    "requested_relief": "what outcome or relief is being sought"
  }}
}}

IMPORTANT: Escape all control characters (newlines, tabs, etc.) in JSON strings.
Use \\n for newlines, \\t for tabs. Ensure valid JSON output."""
        else:
            # CLI backend: use @{path} syntax
            workspace_root = Path(__file__).resolve().parent.parent
            absolute_text = text_file.absolute()
            absolute_output = output_json.absolute()
            relative_text = absolute_text.relative_to(workspace_root)
            relative_output = absolute_output.relative_to(workspace_root)

            prompt = f"""Analyze this legal document text and create a JSON summary.

Read the document text: @{relative_text}

Output JSON with this EXACT structure:
{{
  "document_summary": {{
    "executive_summary": "very detailed summary of the document",
    "document_type": "Motion/Response/Complaint/Order/Notice/Evidence/Research",
    "key_parties": ["list of parties involved - plaintiff, defendant, counsel, etc."],
    "main_arguments": ["list of primary legal arguments, claims, or requests"],
    "important_dates": ["list of critical dates, deadlines, or filing dates"],
    "jurisdiction": "where this case is being heard (if applicable)",
    "authorities": ["list of laws, statutes, or precedents cited"],
    "critical_facts": ["list of key factual allegations or findings"],
    "requested_relief": "what outcome or relief is being sought"
  }}
}}

IMPORTANT: Escape all control characters (newlines, tabs, etc.) in JSON strings.
Use \\n for newlines, \\t for tabs. Ensure valid JSON output.

Write to: {relative_output}
"""

        # Use Gemini Interface if available, otherwise fallback to subprocess
        if self.gemini:
            try:
                self.gemini.generate_content(
                    prompt=prompt,
                    input_file=text_file if self.gemini_config["backend"] == "api" else None,
                    output_file=output_json,
                    timeout=self.gemini_config["timeout"],
                    max_retries=self.gemini_config["max_retries"]
                )

                if not output_json.exists():
                    raise Exception("Gemini did not create output file")

            except Exception as e:
                raise Exception(f"Gemini Interface failed: {e}")
        else:
            # Fallback to subprocess (CLI only)
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    result = subprocess.run(
                        ["gemini", "-m", "gemini-2.5-flash", "-p", prompt, "-y"],
                        capture_output=True,
                        text=True,
                        timeout=90
                    )

                    if result.returncode != 0:
                        if "rate limit" in result.stderr.lower() or "429" in result.stderr:
                            if attempt < max_retries - 1:
                                wait_time = (attempt + 1) * 2
                                self._log("WARNING", f"Rate limit hit, retrying in {wait_time}s...")
                                time.sleep(wait_time)
                                continue
                        raise Exception(f"Gemini failed: {result.stderr}")

                    if not output_json.exists():
                        raise Exception("Gemini did not create output file")

                    break

                except subprocess.TimeoutExpired:
                    if attempt < max_retries - 1:
                        self._log("WARNING", f"Timeout on attempt {attempt + 1}, retrying...")
                        continue
                    raise Exception("Gemini timeout after 3 attempts")

    def _find_case_folder(self) -> Path:
        """Find the case folder from intake path"""
        current = self.intake_path
        while current.name != "cases" and current.parent != current:
            if (current / "Intake").exists() or current.name.startswith("202"):
                return current
            current = current.parent
        raise ValueError(f"Could not find case folder from path: {self.intake_path}")

    def _log(self, level: str, message: str):
        """Log message to file and optionally console"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {level}: {message}\n"

        # Write to log file
        with open(self.log_file, "a") as f:
            f.write(log_entry)

        # Print to console if verbose
        if self.verbose:
            if level == "ERROR" or level == "CRITICAL":
                print(f"❌ {message}")
            elif level == "SUCCESS":
                print(f"✅ {message}")
            elif level == "INFO":
                print(f"ℹ️  {message}")
            else:
                print(f"   {message}")

    def _prompt_for_annotations(self, summarized_docs: List[Dict]):
        """Prompt user to add contextual annotations after Phase 2"""
        self._log("INFO", "")
        self._log("INFO", "=" * 70)
        self._log("SUCCESS", f"✅ Phase 1-2 Complete: {len(summarized_docs)} documents processed")
        self._log("INFO", "=" * 70)
        self._log("INFO", "")
        self._log("INFO", "📝 OPTIONAL: Add Contextual Notes to Documents")
        self._log("INFO", "")
        self._log("INFO", "Document summaries have been generated. You can now review them and")
        self._log("INFO", "add contextual notes that provide information AI cannot infer from")
        self._log("INFO", "the document content alone.")
        self._log("INFO", "")
        self._log("INFO", "Examples of useful contextual notes:")
        self._log("INFO", "  • Delivery confirmation details (certified mail tracking numbers)")
        self._log("INFO", "  • Handwritten text visible in photos/scans")
        self._log("INFO", "  • Verbal agreements not documented in writing")
        self._log("INFO", "  • Missing referenced exhibits or attachments")
        self._log("INFO", "  • Context about when/how document was received")
        self._log("INFO", "")
        self._log("INFO", "To add notes:")
        self._log("INFO", f"  python scripts/document_annotator.py --action add --document_id [ID] --notes \"[your notes]\"")
        self._log("INFO", "")
        self._log("INFO", "To review summaries:")
        self._log("INFO", f"  View summaries in: {self.documents_folder}")
        self._log("INFO", "")
        self._log("INFO", "=" * 70)

    # ═══════════════════════════════════════════════════════════════
    # PHASE 3: CASE SUMMARY SYNTHESIS (Comprehensive Analysis)
    # ═══════════════════════════════════════════════════════════════

    def _collect_user_notes(self, summarized_docs: List[Dict]) -> Dict[str, str]:
        """Collect user notes from all documents"""
        user_notes = {}

        for doc in summarized_docs:
            doc_folder = doc['doc_folder']
            metadata_file = doc_folder / ".document_metadata.json"

            if metadata_file.exists():
                try:
                    with open(metadata_file, 'r') as f:
                        metadata = json.load(f)

                    if metadata.get("user_notes") and metadata["user_notes"].get("notes"):
                        doc_id = doc_folder.name
                        user_notes[doc_id] = metadata["user_notes"]["notes"]
                except Exception as e:
                    self._log("WARNING", f"Failed to read user notes from {doc_folder.name}: {e}")

        return user_notes

    def _load_client_interview(self) -> Optional[str]:
        """Load client interview summary from Step 1.1"""
        interview_file = self.case_folder / "step_1_interview" / "1.1_client_interview" / "user_summary.md"

        if interview_file.exists():
            try:
                with open(interview_file, 'r') as f:
                    content = f.read()
                self._log("INFO", "✅ Client interview loaded from Step 1.1")
                return content
            except Exception as e:
                self._log("WARNING", f"Failed to read client interview: {e}")
                return None
        else:
            self._log("WARNING", "⚠️  Client interview not found (Step 1.1 incomplete)")
            return None

    def _load_party_identification(self) -> Optional[Dict]:
        """Load party identification from Step 1.2"""
        parties_file = self.case_folder / "step_1_interview" / "1.2_party_identification" / "parties.json"

        if parties_file.exists():
            try:
                with open(parties_file, 'r') as f:
                    parties_data = json.load(f)
                self._log("INFO", "✅ Party identification loaded from Step 1.2")
                return parties_data
            except Exception as e:
                self._log("WARNING", f"Failed to read party identification: {e}")
                return None
        else:
            self._log("WARNING", "⚠️  Party identification not found (Step 1.2 incomplete)")
            return None

    def phase_3_synthesize_case_summary(self, summarized_docs: List[Dict]):
        """Phase 3: Comprehensive synthesis from ALL Step 1 sources"""
        self.phase_start_time = time.time()

        if not summarized_docs:
            self._log("WARNING", "No summarized documents to synthesize")
            return

        # 1. Collect document summaries (existing)
        all_summaries = []
        for doc in summarized_docs:
            summary_file = doc['doc_folder'] / "document_summary.json"
            if summary_file.exists():
                with open(summary_file, 'r') as f:
                    content = f.read()
                    # Clean markdown code fences if present (Gemini API sometimes adds these)
                    content = content.strip()
                    if content.startswith('```json'):
                        content = content[7:]  # Remove ```json
                    if content.startswith('```'):
                        content = content[3:]  # Remove ```
                    if content.endswith('```'):
                        content = content[:-3]  # Remove trailing ```
                    content = content.strip()

                    summary_data = json.loads(content)
                    # Add metadata (support both old pdf_path and new file_path keys)
                    file_ref = doc.get('file_path') or doc.get('pdf_path')
                    summary_data['source_file'] = file_ref.name if file_ref else 'Unknown'
                    summary_data['ocr_used'] = doc.get('ocr_used', False)
                    summary_data['ocr_method'] = doc.get('ocr_method', 'unknown')
                    all_summaries.append(summary_data)

        if not all_summaries:
            self._log("ERROR", "No document summaries found to synthesize")
            return

        # 2. Collect user notes (NEW)
        user_notes = self._collect_user_notes(summarized_docs)
        if user_notes:
            self._log("INFO", f"✅ User notes found for {len(user_notes)} document(s)")

        # 3. Load client interview (NEW)
        client_interview = self._load_client_interview()

        # 4. Load party identification (NEW)
        party_data = self._load_party_identification()

        self._log("INFO", f"Synthesizing Case Summary from {len(all_summaries)} documents...")

        # Case Summary path
        case_summary_path = self.case_folder / "step_1_interview" / "1.4_fact_gathering" / "Case_Summary_and_Timeline.md"
        case_summary_path.parent.mkdir(parents=True, exist_ok=True)

        # Build enhanced prompt with all Step 1 sources
        if self.gemini and self.gemini_config["backend"] == "api":
            # API backend: include all sources directly in prompt
            prompt = f"""You are synthesizing a comprehensive Case Summary and Timeline from multiple sources.

═══════════════════════════════════════════════════════════════
PRIMARY SOURCE: CLIENT INTERVIEW (Step 1.1)
═══════════════════════════════════════════════════════════════

{client_interview if client_interview else "[NOT PROVIDED - Client interview incomplete]"}

═══════════════════════════════════════════════════════════════
PARTY IDENTIFICATION (Step 1.2)
═══════════════════════════════════════════════════════════════

{json.dumps(party_data, indent=2) if party_data else "[NOT PROVIDED - Party identification incomplete]"}

═══════════════════════════════════════════════════════════════
DOCUMENT SUMMARIES (Step 1.3 - AI-Generated)
═══════════════════════════════════════════════════════════════

{json.dumps(all_summaries, indent=2)}

═══════════════════════════════════════════════════════════════
USER CONTEXTUAL NOTES (Step 1.3 - User-Provided)
═══════════════════════════════════════════════════════════════

{json.dumps(user_notes, indent=2) if user_notes else "[NO USER NOTES PROVIDED]"}

═══════════════════════════════════════════════════════════════
SYNTHESIS INSTRUCTIONS
═══════════════════════════════════════════════════════════════

Create a comprehensive Case Summary and Timeline that:

**PRIORITIZATION HIERARCHY:**
1. PRIORITIZE client interview narrative as primary source of truth
2. Use document summaries to CORROBORATE and EXPAND on client narrative
3. Use user contextual notes to understand document context AI cannot infer
4. Cross-reference parties from interview with parties in documents
5. Flag conflicts between client narrative and document evidence

**REQUIRED SECTIONS:**

1. **Timeline** (chronological order)
   - Extract all dates and events from ALL sources
   - Order chronologically
   - Note legal significance of each event
   - Add source attribution: (Source: [filename/interview], Page X if available)
   - Highlight conflicts between sources

2. **Parties and Roles**
   - Use party identification data as primary source
   - Supplement with parties mentioned in documents
   - Include relationships, roles, contact information

3. **Factual Allegations**
   - Background and context (prioritize client narrative)
   - Key events and actions
   - Precipitating incident
   - Ongoing issues
   - Note where user contextual notes provide additional context

4. **Damages Claimed**
   - Financial damages with specific amounts
   - Non-financial harm
   - Ongoing damages

5. **Legal Theories and Authorities**
   - Primary legal theories
   - Secondary theories
   - Statutes and precedents cited
   - Elements and supporting facts

6. **Conflicts and Contradictions**
   - Flag any conflicting dates, facts, or claims between sources
   - Note: *[Conflict: Source A states X, Source B states Y]*
   - Identify which source is more reliable and why

7. **Evidence Inventory**
   - List each document with type, description, location
   - Note which documents required OCR processing
   - Highlight documents with user contextual notes

8. **Strategic Assessment**
   - Strengths and weaknesses
   - Critical success factors
   - Risk assessment
   - Gaps in evidence or information

Use the template structure from: workspace/step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.md"""
        else:
            # CLI backend: use relative paths
            workspace_root = Path(__file__).resolve().parent.parent
            absolute_case_summary = case_summary_path.absolute()
            relative_case_summary = absolute_case_summary.relative_to(workspace_root)

            prompt = f"""You are synthesizing a comprehensive Case Summary and Timeline from multiple sources.

═══════════════════════════════════════════════════════════════
PRIMARY SOURCE: CLIENT INTERVIEW (Step 1.1)
═══════════════════════════════════════════════════════════════

{client_interview if client_interview else "[NOT PROVIDED - Client interview incomplete]"}

═══════════════════════════════════════════════════════════════
PARTY IDENTIFICATION (Step 1.2)
═══════════════════════════════════════════════════════════════

{json.dumps(party_data, indent=2) if party_data else "[NOT PROVIDED - Party identification incomplete]"}

═══════════════════════════════════════════════════════════════
DOCUMENT SUMMARIES (Step 1.3 - AI-Generated)
═══════════════════════════════════════════════════════════════

{json.dumps(all_summaries, indent=2)}

═══════════════════════════════════════════════════════════════
USER CONTEXTUAL NOTES (Step 1.3 - User-Provided)
═══════════════════════════════════════════════════════════════

{json.dumps(user_notes, indent=2) if user_notes else "[NO USER NOTES PROVIDED]"}

═══════════════════════════════════════════════════════════════
SYNTHESIS INSTRUCTIONS
═══════════════════════════════════════════════════════════════

Create a comprehensive Case Summary and Timeline that:

**PRIORITIZATION HIERARCHY:**
1. PRIORITIZE client interview narrative as primary source of truth
2. Use document summaries to CORROBORATE and EXPAND on client narrative
3. Use user contextual notes to understand document context AI cannot infer
4. Cross-reference parties from interview with parties in documents
5. Flag conflicts between client narrative and document evidence

**REQUIRED SECTIONS:**

1. **Timeline** (chronological order)
   - Extract all dates and events from ALL sources
   - Order chronologically
   - Note legal significance of each event
   - Add source attribution: (Source: [filename/interview], Page X if available)
   - Highlight conflicts between sources

2. **Parties and Roles**
   - Use party identification data as primary source
   - Supplement with parties mentioned in documents
   - Include relationships, roles, contact information

3. **Factual Allegations**
   - Background and context (prioritize client narrative)
   - Key events and actions
   - Precipitating incident
   - Ongoing issues
   - Note where user contextual notes provide additional context

4. **Damages Claimed**
   - Financial damages with specific amounts
   - Non-financial harm
   - Ongoing damages

5. **Legal Theories and Authorities**
   - Primary legal theories
   - Secondary theories
   - Statutes and precedents cited
   - Elements and supporting facts

6. **Conflicts and Contradictions**
   - Flag any conflicting dates, facts, or claims between sources
   - Note: *[Conflict: Source A states X, Source B states Y]*
   - Identify which source is more reliable and why

7. **Evidence Inventory**
   - List each document with type, description, location
   - Note which documents required OCR processing
   - Highlight documents with user contextual notes

8. **Strategic Assessment**
   - Strengths and weaknesses
   - Critical success factors
   - Risk assessment
   - Gaps in evidence or information

Use the template structure from: workspace/step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.md

Write comprehensive Case Summary to: {relative_case_summary}
"""

        # Use Gemini Interface if available, otherwise fallback to subprocess
        # UPGRADE: Use gemini-2.5-pro for Phase 3 synthesis (better quality)
        try:
            if self.gemini:
                # Temporarily override model for Phase 3
                original_model = self.gemini.model
                self.gemini.model = "gemini-2.5-pro"

                self.gemini.generate_content(
                    prompt=prompt,
                    output_file=case_summary_path,
                    timeout=300,  # 5 minutes for comprehensive synthesis with Pro model
                    max_retries=self.gemini_config["max_retries"]
                )

                # Restore original model
                self.gemini.model = original_model
            else:
                # Fallback to subprocess (CLI only) - use gemini-2.5-pro
                result = subprocess.run(
                    ["gemini", "-m", "gemini-2.5-pro", "-p", prompt, "-y"],
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minutes for Pro model
                )

                if result.returncode != 0:
                    raise Exception(f"Gemini failed: {result.stderr}")

            if not case_summary_path.exists():
                raise Exception("Gemini did not create Case Summary file")

            self._log("SUCCESS", f"Case Summary synthesized: {case_summary_path.name}")

            # Check for conflict markers
            with open(case_summary_path, 'r') as f:
                content = f.read()
            if "[Conflict:" in content:
                self._log("WARNING", "⚠️  Information conflicts detected in Case Summary - review required")

            # Log token stats if using API backend
            if self.gemini and self.gemini_config["backend"] == "api" and self.gemini_config["enable_token_tracking"]:
                stats = self.gemini.get_token_stats()
                self._log("INFO", f"📊 Token Usage (Phase 3):")
                self._log("INFO", f"   - Total calls: {stats['total_calls']}")
                self._log("INFO", f"   - Input tokens: {stats['total_input_tokens']:,}")
                self._log("INFO", f"   - Output tokens: {stats['total_output_tokens']:,}")
                self._log("INFO", f"   - Total tokens: {stats['total_tokens']:,}")
                self._log("INFO", f"   - Estimated cost: ${stats['estimated_cost_usd']:.4f}")

            # Auto-verify immediately if configured
            if self.verify_case_summary and (self.verification_timing == "immediate"):
                self._log("INFO", "Auto-verification (immediate) enabled - running document verification...")
                self._run_verification_on_case_summary()

        except Exception as e:
            self._log("ERROR", f"Case Summary synthesis failed: {e}")
            raise


    def _run_verification_on_case_summary(self):
        """Run protocol-compliant verification on the synthesized Case Summary."""
        try:
            # Subject path
            subject = self.case_folder / "step_1_interview" / "1.4_fact_gathering" / "Case_Summary_and_Timeline.md"
            if not subject.exists():
                self._log("WARNING", f"Case Summary not found for verification: {subject}")
                return

            # Resolve sources
            sources: List[Path] = []
            workspace_root = Path(__file__).resolve().parent.parent

            # 1) Explicit directory
            if self.verification_sources_dir:
                src_dir = Path(self.verification_sources_dir)
                if not src_dir.is_absolute():
                    src_dir = workspace_root / src_dir
                if src_dir.exists() and src_dir.is_dir():
                    sources = [p for p in src_dir.rglob("*") if p.is_file()]
                else:
                    self._log("WARNING", f"Verification sources directory not found: {src_dir}")

            # 2) Glob pattern across framework
            if (not sources) and self.verification_sources_glob:
                pattern = self.verification_sources_glob
                try:
                    sources = [p for p in workspace_root.glob(pattern) if p.is_file()]
                except Exception as e:
                    self._log("ERROR", f"Invalid verification glob '{pattern}': {e}")

            # 3) PRIMARY DEFAULT: Centralized full_text_extractions folder (v4.0+)
            if not sources:
                fte_dir = self.documents_folder / "full_text_extractions"
                if fte_dir.exists() and fte_dir.is_dir():
                    sources = [p for p in fte_dir.rglob("*") if p.is_file()]
                    if sources:
                        self._log("INFO", f"Using centralized extractions folder: {len(sources)} files")

            # 4) FALLBACK: Individual document folders (legacy structure)
            if not sources:
                sources = [p for p in self.documents_folder.rglob("full_text_extraction.txt") if p.is_file()]
                if sources:
                    self._log("INFO", f"Using individual document folders: {len(sources)} files")


            if not sources:
                self._log("WARNING", "No source documents found for verification; skipping.")
                return

            # Import runner (with fallback)
            try:
                from scripts.verification_runner import VerificationConfig, verify_document
            except Exception:
                from verification_runner import VerificationConfig, verify_document

            cfg = VerificationConfig(
                subject=subject,
                sources=sources,
                case_id=self.case_folder.name,
                staging_root=None,
                focus=self.verification_focus,
                mode=self.verification_mode,
                notify_dir=None,
                json_out=None,
                summary_out=None,
                no_cleanup=False,
                timeout_seconds=300,
                max_retries=0,
            )

            code = verify_document(cfg)
            if code == 0:
                self._log("SUCCESS", "Document verification completed: no issues found.")
            elif code == 2:
                self._log("WARNING", "Document verification completed with issues. See notifications folder for triage.")
            else:
                self._log("ERROR", "Document verification failed.")
        except Exception as e:
            self._log("ERROR", f"Verification error: {e}")


    # ═══════════════════════════════════════════════════════════════
    # HELPER METHODS FOR PHASE CONTROL
    # ═══════════════════════════════════════════════════════════════

    def _load_extracted_documents(self) -> List[Dict]:
        """Load extracted documents from Phase 1 for Phase 2"""
        extracted_docs = []

        for doc_folder in self.documents_folder.glob("*/"):
            if not doc_folder.is_dir():
                continue

            text_file = doc_folder / "full_text_extraction.txt"
            if text_file.exists():
                # Find PDF file
                pdf_files = list(doc_folder.glob("*.pdf"))
                if pdf_files:
                    extracted_docs.append({
                        'pdf_path': pdf_files[0],
                        'doc_folder': doc_folder,
                        'doc_type': doc_folder.name,
                        'success': True
                    })

        self._log("INFO", f"Loaded {len(extracted_docs)} extracted documents from Phase 1")
        return extracted_docs

    def _load_summarized_documents(self) -> List[Dict]:
        """Load summarized documents from Phase 2 for Phase 3"""
        summarized_docs = []

        for doc_folder in self.documents_folder.glob("*/"):
            if not doc_folder.is_dir():
                continue

            summary_file = doc_folder / "document_summary.json"
            if summary_file.exists():
                # Find source file (any file type)
                source_files = [f for f in doc_folder.iterdir() if f.is_file() and f.suffix != '.json' and f.suffix != '.txt']
                if source_files:
                    # Load summary to get OCR info (clean markdown code fences if present)
                    with open(summary_file, 'r') as f:
                        content = f.read()
                        # Clean markdown code fences if present (Gemini API sometimes adds these)
                        content = content.strip()
                        if content.startswith('```json'):
                            content = content[7:]  # Remove ```json
                        if content.startswith('```'):
                            content = content[3:]  # Remove ```
                        if content.endswith('```'):
                            content = content[:-3]  # Remove trailing ```
                        content = content.strip()
                        summary_data = json.loads(content)

                    summarized_docs.append({
                        'file_path': source_files[0],  # Use file_path instead of pdf_path
                        'doc_folder': doc_folder,
                        'doc_type': doc_folder.name,
                        'success': True,
                        'ocr_used': summary_data.get('ocr_used', False),
                        'ocr_method': summary_data.get('ocr_method', 'unknown')
                    })

        self._log("INFO", f"Loaded {len(summarized_docs)} summarized documents from Phase 2")
        return summarized_docs

    def _log_phase_header(self, header: str):
        """Log phase header with visual separator"""
        separator = "═" * 70
        if self.verbose:
            print(f"\n{separator}")
            print(f"{header}")
            print(f"{separator}\n")
        self._log("INFO", header)

    def _log_phase_complete(self, phase_num: int, count: int, results: Optional[List[Dict]]):
        """Log phase completion with statistics"""
        elapsed = time.time() - self.phase_start_time

        if phase_num == 1 and results:
            ocr_count = sum(1 for r in results if r.get('ocr_used', False))
            self._log("SUCCESS", f"Phase {phase_num} complete: {count} documents extracted in {elapsed:.1f}s")
            if ocr_count > 0:
                self._log("INFO", f"  - {ocr_count} documents required OCR processing")
        elif phase_num == 2:
            self._log("SUCCESS", f"Phase {phase_num} complete: {count} summaries generated in {elapsed:.1f}s")
        elif phase_num == 3:
            self._log("SUCCESS", f"Phase {phase_num} complete: Case Summary synthesized in {elapsed:.1f}s")

    def _log_all_phases_complete(self):
        """Log final completion message"""
        total_elapsed = time.time() - self.total_start_time
        minutes = int(total_elapsed // 60)
        seconds = int(total_elapsed % 60)

        separator = "═" * 70
        if self.verbose:
            print(f"\n{separator}")
            print(f"✅ ALL PHASES COMPLETE")
            print(f"{separator}")
            print(f"Total time: {minutes} minutes {seconds} seconds")

            # Show Case Summary location
            case_summary_path = self.case_folder / "step_1_interview" / "1.4_fact_gathering" / "Case_Summary_and_Timeline.md"
            if case_summary_path.exists():
                print(f"Case Summary: {case_summary_path}")
            print(f"{separator}\n")

        self._log("SUCCESS", f"All phases complete in {minutes}m {seconds}s")

    def _rebuild_document_index(self):
        """Rebuild the case-level document index after Phase 2 completes.
        Uses scripts/document_indexer.py → rebuild_index(); no AI calls involved.
        """
        try:
            if DOC_INDEXER_AVAILABLE:
                self._log("INFO", f"Rebuilding document index at: {self.documents_folder}")
                _REBUILD_DOC_INDEX(self.documents_folder)
                self._log("SUCCESS", "Document index rebuilt")
            else:
                self._log("INFO", "Document indexer not available; skipping index rebuild")
        except Exception as e:
            self._log("ERROR", f"Document index rebuild failed: {e}")


    def detect_document_type(self, pdf_path: Path) -> str:
        """Detect document type using filename patterns only (NO GEMINI WASTE)"""
        filename_lower = pdf_path.stem.lower()

        # Try filename pattern matching
        for doc_type, patterns in DOCUMENT_TYPE_PATTERNS.items():
            for pattern in patterns:
                if pattern in filename_lower:
                    self._log("INFO", f"Document type detected from filename: {doc_type}")
                    return doc_type

        # Fallback: use the filename stem as folder name (NO GEMINI CALL)
        # Principle: Don't waste Gemini API calls on trivial classification
        self._log("INFO", f"Using filename as folder name: {pdf_path.stem}")
        return pdf_path.stem

    def create_document_folder(self, doc_type: str) -> Path:
        """Create organized folder for document type"""
        base_folder = self.documents_folder / doc_type

        # If folder exists, append counter
        if base_folder.exists():
            counter = 1
            while (self.documents_folder / f"{doc_type}_{counter}").exists():
                counter += 1
            folder = self.documents_folder / f"{doc_type}_{counter}"
        else:
            folder = base_folder

        folder.mkdir(parents=True, exist_ok=True)
        self._log("SUCCESS", f"Created folder: {folder.relative_to(self.case_folder)}")
        return folder

    def move_pdf(self, source: Path, destination_folder: Path) -> Path:
        """Move original PDF from Intake to processed folder"""
        destination = destination_folder / source.name

        try:
            source.rename(destination)
            self._log("SUCCESS", f"Moved PDF: {source.name}")
            return destination
        except Exception as e:
            self._log("ERROR", f"Failed to move PDF: {e}")
            raise

    # ═══════════════════════════════════════════════════════════════
    # DEPRECATED METHODS (V2.0 - Sequential Processing)
    # These methods are preserved for reference but no longer used in V3.0
    # ═══════════════════════════════════════════════════════════════

    def generate_gemini_summary(self, pdf_path: Path, output_json_path: Path, doc_type: str) -> Dict:
        """DEPRECATED: Use phase_2_summarize_all() instead

        Generate comprehensive content summary using Gemini CLI - writes directly to JSON file
        AND updates Case Summary and Timeline file incrementally"""
        self._log("INFO", "Generating Gemini content summary and updating Case Summary...")
        start_time = time.time()

        # CRITICAL: Use @ prefix to tell Gemini CLI to upload and read the PDF file
        # Use -y flag to allow file write operations without user approval
        # Use RELATIVE paths (Gemini CLI requires paths relative to workspace root)
        workspace_root = Path(__file__).resolve().parent.parent

        # Convert to absolute first, then make relative to workspace
        abs_output_path = output_json_path.absolute() if not output_json_path.is_absolute() else output_json_path
        abs_pdf_path = pdf_path.absolute() if not pdf_path.is_absolute() else pdf_path

        relative_output_path = abs_output_path.relative_to(workspace_root)
        relative_pdf_path = abs_pdf_path.relative_to(workspace_root)

        # NEW: Calculate Case Summary path
        case_summary_path = self.case_folder / "step_1_interview" / "1.4_fact_gathering" / "Case_Summary_and_Timeline.md"

        # Ensure the directory exists
        case_summary_path.parent.mkdir(parents=True, exist_ok=True)

        # Make relative to workspace
        relative_case_summary_path = case_summary_path.relative_to(workspace_root)

        prompt = f"""You have TWO tasks to complete in sequence:

═══════════════════════════════════════════════════════════════
TASK 1: Generate Document Summary JSON
═══════════════════════════════════════════════════════════════

Analyze this legal document and create a JSON file with a comprehensive summary.

Write the output to: {relative_output_path}

The JSON file should have this EXACT structure:
{{
  "document_summary": {{
    "executive_summary": "very detailed summary of the document",
    "key_parties": ["list of parties involved - plaintiff, defendant, counsel, etc."],
    "main_arguments": ["list of primary legal arguments, claims, or requests"],
    "important_dates": ["list of critical dates, deadlines, or filing dates"],
    "jurisdiction": "where this case is being heard (if applicable)",
    "authorities": ["list of laws, statutes, or precedents cited in the document. if none, then skip"],
    "critical_facts": ["list of key factual allegations or findings"],
    "requested_relief": "what outcome or relief is being sought"
  }}
}}

Analyze this document: @{relative_pdf_path}

Create the JSON file now with the comprehensive summary.

═══════════════════════════════════════════════════════════════
TASK 2: Update Case Summary and Timeline File
═══════════════════════════════════════════════════════════════

**PURPOSE**: The Case Summary and Timeline file serves as the foundation for any new agent or attorney onboarding onto the case. It provides a comprehensive overview of case facts, timeline, parties, and key events.

**INCREMENTAL UPDATE APPROACH**: After creating the document summary above, you must now update the Case Summary and Timeline file with detailed information learned from this document. This incremental approach prevents errors and reduces cognitive load compared to processing all documents at once.

**FILE LOCATION**: {relative_case_summary_path}

**WHAT TO UPDATE**:

1. **Timeline Entries** (Section: "Chronological Timeline")
   - Add new dates and events discovered in this document
   - Format: **[Specific Date]**: [Event description]
     - *Legal Significance*: [Why this event matters legally]
     - *Evidence Available*: [Source: {pdf_path.name}, Page X]
   - Maintain chronological order within phases
   - Create new phases if needed for new date ranges

2. **Factual Details** (Section: "Comprehensive Fact Summary")
   - Append new facts to relevant subsections:
     * Background and Context
     * Key Events and Actions
     * Precipitating Incident
     * Ongoing Issues
   - Add source attribution: (Source: {pdf_path.name}, Page X)

3. **Placeholder Replacement**
   - Fill in any `[PLACEHOLDER]`, `[TO BE DETERMINED]`, or bracketed fields if information is now available
   - Examples: [Case Number], [Filing Date], [Jurisdiction], [Party Names]

4. **Party Information** (Section: "Parties and Relationships")
   - Add or update party details: names, roles, addresses, contact info
   - Update relationship history if new information is available
   - Add key witnesses if identified in this document

5. **Damages and Harm** (Section: "Damages and Harm Analysis")
   - Add specific amounts to Financial Damages table
   - Document new categories of harm discovered
   - Note documentation availability: (Source: {pdf_path.name})

6. **Evidence Inventory** (Section: "Evidence Inventory")
   - Add this document to Documentary Evidence table
   - Category: [Motion/Response/Complaint/Order/etc.]
   - Description: [Brief description from executive summary]
   - Location: documents/{doc_type}/{pdf_path.name}
   - Legal Relevance: [How it supports the case]

7. **Legal Analysis** (Section: "Legal Analysis")
   - Add new legal theories if identified in this document
   - Update elements and supporting facts
   - Add authorities cited in this document

8. **Document Control** (Section: "Document Control")
   - Update "Last Updated" field with current timestamp
   - Update "Updated By" field: "Automated Document Processing - {pdf_path.name}"

**PRESERVATION REQUIREMENTS**:
- ✅ DO NOT remove existing information
- ✅ DO NOT overwrite information unless the new document provides more accurate/complete details
- ✅ Maintain chronological order in timeline sections
- ✅ Preserve the file's structure and formatting
- ✅ Add source attribution for all new information: (Source: {pdf_path.name}, Page X)
- ✅ If conflicting information exists, add a note: *[Conflict: Previous source stated X, this document states Y]*

**OUTPUT REQUIREMENTS**:
- Update the file in place (modify the existing file at {relative_case_summary_path})
- Maintain markdown formatting
- Use proper markdown tables where applicable
- Preserve all section headers and structure

**IF FILE DOES NOT EXIST**:
- Create the file using the template structure from workspace/step_1_interview/1.4_fact_gathering/Case_Summary_and_Timeline.md
- Populate all sections with information from this document
- Mark remaining fields as [TO BE DETERMINED] if not available in this document

Now complete BOTH tasks:
1. Create the document summary JSON at {relative_output_path}
2. Update the Case Summary and Timeline file at {relative_case_summary_path}

Confirm completion by stating: "TASK 1 COMPLETE: document_summary.json created. TASK 2 COMPLETE: Case_Summary_and_Timeline.md updated."
"""

        try:
            result = subprocess.run(
                ["gemini", "-m", "gemini-2.5-flash", "-p", prompt, "-y"],
                capture_output=True,
                text=True,
                timeout=120  # Increased timeout for two tasks
            )

            elapsed = time.time() - start_time

            # Check if Gemini wrote the document summary JSON successfully
            task1_success = output_json_path.exists()
            task2_success = case_summary_path.exists() and case_summary_path.stat().st_mtime > start_time

            if task1_success:
                try:
                    with open(output_json_path, 'r') as f:
                        gemini_output = json.load(f)

                    # Extract the document_summary section
                    if "document_summary" in gemini_output:
                        self._log("SUCCESS", f"Gemini summary generated ({elapsed:.1f}s)")

                        # Check if Case Summary was updated
                        if task2_success:
                            self._log("SUCCESS", "Case Summary and Timeline file updated incrementally")

                            # Check for conflict markers
                            with open(case_summary_path, 'r') as f:
                                content = f.read()
                            if "[Conflict:" in content:
                                self._log("WARNING", "⚠️  Information conflict detected in Case Summary - review required")
                        else:
                            self._log("WARNING", "Case Summary file was not created/updated by Gemini")

                        return gemini_output["document_summary"]
                    else:
                        self._log("WARNING", "Gemini wrote file but missing document_summary section")
                        return gemini_output  # Return whatever structure Gemini created

                except json.JSONDecodeError as e:
                    self._log("ERROR", f"Gemini wrote file but invalid JSON: {e}")
            else:
                self._log("WARNING", f"Gemini did not write file. Return code: {result.returncode}")
                if result.stdout:
                    self._log("DEBUG", f"Gemini stdout: {result.stdout[:200]}")
                if result.stderr:
                    self._log("DEBUG", f"Gemini stderr: {result.stderr[:200]}")

        except subprocess.TimeoutExpired:
            self._log("ERROR", "Gemini timeout after 90 seconds")

        except Exception as e:
            self._log("ERROR", f"Gemini summary generation failed: {e}")

        # Return placeholder on failure
        return {
            "executive_summary": "",
            "key_parties": [],
            "main_arguments": [],
            "important_dates": [],
            "jurisdiction": "Unknown",
            "legal_basis": [],
            "critical_facts": [],
            "requested_relief": "Unknown"
        }

    def _parse_gemini_summary(self, summary_text: str) -> Dict:
        """Parse Gemini's text output into structured format"""
        # This is a simplified parser - can be enhanced with more sophisticated NLP
        return {
            "executive_summary": summary_text[:500] if len(summary_text) > 500 else summary_text,
            "key_parties": self._extract_section(summary_text, "Key Parties"),
            "main_arguments": self._extract_section(summary_text, "Main Arguments"),
            "important_dates": self._extract_section(summary_text, "Important Dates"),
            "jurisdiction": self._extract_single_line(summary_text, "Jurisdiction"),
            "legal_basis": self._extract_section(summary_text, "Legal Basis"),
            "critical_facts": self._extract_section(summary_text, "Critical Facts"),
            "requested_relief": self._extract_single_line(summary_text, "Requested Relief")
        }

    def _extract_section(self, text: str, section_name: str) -> List[str]:
        """Extract bullet points from a section"""
        # Simple extraction - looks for section header and bullet points
        pattern = rf"{section_name}[:\s]+(.*?)(?=\n\n|\n[A-Z]|$)"
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            section_text = match.group(1)
            # Extract bullet points or lines
            lines = [line.strip() for line in section_text.split('\n') if line.strip()]
            return [line.lstrip('•-*').strip() for line in lines if line]
        return []

    def _extract_single_line(self, text: str, field_name: str) -> str:
        """Extract single line value"""
        pattern = rf"{field_name}[:\s]+([^\n]+)"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return "Unknown"

    def is_scanned_pdf(self, pdf_path: Path) -> bool:
        """Detect if PDF is scanned (image-based) and requires OCR"""
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(pdf_path)

            # Check first 3 pages (or all if less than 3)
            pages_to_check = min(3, len(doc))

            for page_num in range(pages_to_check):
                page = doc[page_num]
                text = page.get_text().strip()

                # If any page has extractable text, it's not fully scanned
                if text and len(text) > 50:  # At least 50 characters
                    doc.close()
                    return False

            doc.close()
            # No significant text found - likely scanned
            return True

        except Exception as e:
            self._log("ERROR", f"PDF scan detection failed: {e}")
            # Default to assuming it needs OCR (safer)
            return True

    def extract_text_with_mistral(self, pdf_path: Path, output_folder: Path) -> Tuple[str, Dict]:
        """
        Extract text using Mistral OCR API with page break markers.

        Returns:
            Tuple of (extracted_text, metadata_dict)
        """
        self._log("INFO", "Extracting text with Mistral OCR API...")

        if not MISTRAL_AVAILABLE:
            raise Exception("Mistral API client not available. Install with: pip install mistralai")

        # Get API key from environment
        api_key = os.getenv('MISTRAL_API_KEY')
        if not api_key:
            raise Exception("MISTRAL_API_KEY not found in environment. Check .env file.")

        start_time = time.time()

        try:
            # Initialize Mistral client
            client = Mistral(api_key=api_key)

            # Get page count for metadata
            try:
                import fitz  # PyMuPDF
                doc = fitz.open(pdf_path)
                page_count = len(doc)
                doc.close()
            except Exception:
                page_count = 0

            file_size_mb = pdf_path.stat().st_size / (1024 * 1024)
            self._log("INFO", f"File size: {file_size_mb:.1f}MB, Pages: {page_count}")

            # Step 1: Upload PDF to Mistral
            self._log("INFO", f"Uploading {pdf_path.name} to Mistral...")
            with open(pdf_path, 'rb') as file:
                uploaded_pdf = client.files.upload(
                    file={
                        "file_name": pdf_path.name,
                        "content": file,
                    },
                    purpose="ocr"
                )

            self._log("INFO", f"File uploaded with ID: {uploaded_pdf.id}")

            # Step 2: Get signed URL
            signed_url = client.files.get_signed_url(file_id=uploaded_pdf.id)
            self._log("INFO", "Got signed URL for processing")

            # Step 3: Process with Mistral OCR
            self._log("INFO", "Processing with Mistral OCR...")

            # For DOCX files, must use image_limit=0 when include_image_base64=False
            ocr_params = {
                "model": "mistral-ocr-latest",
                "document": {
                    "type": "document_url",
                    "document_url": signed_url.url,
                },
                "include_image_base64": False
            }

            # DOCX files require image_limit=0 when include_image_base64=False
            if pdf_path.suffix.lower() in ['.docx', '.pptx']:
                ocr_params["image_limit"] = 0

            ocr_response = client.ocr.process(**ocr_params)

            # Step 4: Extract text with page break markers
            extracted_text = ""
            actual_page_count = len(ocr_response.pages)

            for i, page in enumerate(ocr_response.pages):
                # Add page break marker in legal citation format
                extracted_text += f"--- Page {i + 1} ---\n"
                extracted_text += page.markdown + "\n\n"

            processing_time = time.time() - start_time

            self._log("INFO", f"✓ Successfully processed {actual_page_count} pages in {processing_time:.2f}s")

            # Step 5: Clean up uploaded file
            try:
                client.files.delete(file_id=uploaded_pdf.id)
                self._log("INFO", "✓ Cleaned up uploaded file")
            except Exception as cleanup_error:
                self._log("WARNING", f"Failed to cleanup uploaded file: {cleanup_error}")

            # Calculate cost estimate ($1 per 1,000 pages)
            cost_estimate = (actual_page_count / 1000.0) * 1.0

            # Build metadata
            metadata = {
                'page_count': actual_page_count,
                'processing_time': processing_time,
                'ocr_used': True,
                'ocr_method': 'mistral',
                'file_size_mb': file_size_mb,
                'cost_estimate': cost_estimate,
                'api_model': 'mistral-ocr-latest'
            }

            return extracted_text, metadata

        except Exception as e:
            processing_time = time.time() - start_time
            error_msg = f"Mistral OCR failed after {processing_time:.2f}s: {e}"
            self._log("ERROR", error_msg)
            raise Exception(error_msg)

    def extract_text_with_docling(self, pdf_path: Path, output_folder: Path) -> Tuple[str, Dict]:
        """Extract text using Docling CLI with structure preservation"""
        self._log("INFO", "Extracting text with Docling...")

        # Detect if PDF is scanned and needs OCR
        needs_ocr = self.is_scanned_pdf(pdf_path)
        if needs_ocr:
            self._log("INFO", "Scanned PDF detected - enabling OCR")

        # Calculate timeout based on file size (UPDATED: More generous timeouts for OCR)
        file_size_mb = pdf_path.stat().st_size / (1024 * 1024)
        if file_size_mb > 5:
            timeout = 900  # 15 minutes for very large files (>5MB)
        elif file_size_mb > 1:
            timeout = 600  # 10 minutes for large files (>1MB)
        else:
            timeout = 300  # 5 minutes for normal files (OCR can be slow)

        self._log("INFO", f"File size: {file_size_mb:.1f}MB, timeout: {timeout}s")

        start_time = time.time()

        try:
            # Build Docling command
            docling_cmd = [
                "docling",
                str(pdf_path.absolute()),
                "--output", str(output_folder.absolute()),
                "--to", "md",
                "--to", "json",
                "--image-export-mode", "placeholder",
                "--verbose"
            ]

            # Add OCR flags if needed
            if needs_ocr:
                docling_cmd.extend([
                    "--ocr",
                    "--ocr-engine", "tesseract"  # Use tesseract OCR engine
                ])

            # Run Docling CLI with size-based timeout
            result = subprocess.run(
                docling_cmd,
                capture_output=True,
                text=True,
                timeout=timeout
            )

            if result.returncode != 0:
                raise Exception(f"Docling failed: {result.stderr}")

            elapsed = time.time() - start_time
            self._log("SUCCESS", f"Docling extraction complete ({elapsed:.1f}s)")

            # Find output files
            md_file = output_folder / f"{pdf_path.stem}.md"
            json_file = output_folder / f"{pdf_path.stem}.json"

            if not md_file.exists() or not json_file.exists():
                raise Exception("Docling output files not found")

            # Read markdown and JSON
            with open(md_file, 'r') as f:
                markdown_text = f.read()

            with open(json_file, 'r') as f:
                metadata = json.load(f)

            # Delete intermediate markdown file (we'll create our own with page breaks)
            md_file.unlink()

            # Check if Docling actually extracted any text
            if needs_ocr and len(markdown_text.strip()) < 100:
                self._log("INFO", "Docling OCR returned minimal text - trying fallback method")
                return self._fallback_ocr_extraction(pdf_path, output_folder)

            # Add OCR flag to metadata for tracking
            metadata['ocr_used'] = needs_ocr

            return markdown_text, metadata

        except Exception as e:
            self._log("ERROR", f"Docling extraction failed: {e}")
            # Try fallback method for vector-based PDFs
            if needs_ocr:
                self._log("INFO", "Attempting fallback: PyMuPDF + pytesseract OCR")
                try:
                    return self._fallback_ocr_extraction(pdf_path, output_folder)
                except Exception as fallback_error:
                    self._log("ERROR", f"Fallback OCR also failed: {fallback_error}")
            raise

    def _fallback_ocr_extraction(self, pdf_path: Path, output_folder: Path) -> Tuple[str, Dict]:
        """Fallback OCR method for vector-based PDFs using PyMuPDF + pytesseract"""
        import fitz  # PyMuPDF
        import pytesseract
        from PIL import Image
        import io

        self._log("INFO", "Rasterizing PDF pages for OCR...")
        start_time = time.time()

        doc = fitz.open(pdf_path)
        full_text = ""
        page_data = []

        for page_num in range(len(doc)):
            page = doc[page_num]

            # Rasterize page to image (high DPI for better OCR)
            pix = page.get_pixmap(dpi=300)  # 300 DPI for good quality
            img_data = pix.tobytes("png")

            # Run OCR on the image
            image = Image.open(io.BytesIO(img_data))
            text = pytesseract.image_to_string(image)

            # Add page break marker
            full_text += f"\n--- Page {page_num + 1} ---\n{text}\n"

            page_data.append({
                "page_number": page_num + 1,
                "char_count": len(text),
                "dimensions": {
                    "width": page.rect.width,
                    "height": page.rect.height
                }
            })

            self._log("INFO", f"  Processed page {page_num + 1}/{len(doc)} ({len(text)} chars)")

        doc.close()

        elapsed = time.time() - start_time
        self._log("SUCCESS", f"Fallback OCR complete ({elapsed:.1f}s)")

        # Create metadata structure similar to Docling
        metadata = {
            "ocr_used": True,
            "ocr_method": "pymupdf_pytesseract",
            "page_count": len(page_data),
            "pages": page_data
        }

        return full_text, metadata

    def insert_page_breaks(self, markdown_text: str, metadata: Dict, output_folder: Path) -> Tuple[str, int]:
        """Insert page break markers using Docling metadata"""
        self._log("INFO", "Inserting page break markers...")

        try:
            # Check if page breaks already exist (from fallback OCR method)
            if "--- Page " in markdown_text:
                self._log("INFO", "Page breaks already present (from fallback OCR)")
                page_breaks_added = markdown_text.count("--- Page ")

                # Write to full_text_extraction.txt
                output_file = output_folder / "full_text_extraction.txt"
                with open(output_file, 'w') as f:
                    f.write(markdown_text)

                self._log("SUCCESS", f"Page breaks preserved ({page_breaks_added} breaks)")
                return markdown_text, page_breaks_added

            # Extract page information from metadata
            # Docling metadata structure varies, so we'll use a robust approach
            current_page = 1
            output_lines = []
            page_breaks_added = 0

            # Split markdown by lines and try to infer page breaks
            # This is a simplified approach - can be enhanced with Docling's detailed metadata
            lines = markdown_text.split('\n')

            # Estimate lines per page (typical legal document)
            lines_per_page = 50

            for i, line in enumerate(lines):
                # Insert page break every N lines (rough estimate)
                if i > 0 and i % lines_per_page == 0:
                    current_page += 1
                    output_lines.append(f"\n--- Page {current_page} ---\n")
                    page_breaks_added += 1

                output_lines.append(line)

            # Write to full_text_extraction.txt
            output_text = '\n'.join(output_lines)
            output_file = output_folder / "full_text_extraction.txt"

            with open(output_file, 'w') as f:
                f.write(output_text)

            self._log("SUCCESS", f"Page breaks inserted ({page_breaks_added} breaks)")
            return output_text, page_breaks_added

        except Exception as e:
            self._log("ERROR", f"Page break insertion failed: {e}")
            # Fallback: save without page breaks
            output_file = output_folder / "full_text_extraction.txt"
            with open(output_file, 'w') as f:
                f.write(markdown_text)
            return markdown_text, 0

    def extract_metadata_from_text(self, text: str, pdf_path: Path) -> Dict:
        """Extract case number, filing date, and parties from document text"""
        metadata = {
            "case_number": None,
            "filing_date": None,
            "parties": []
        }

        # Extract case number (various formats)
        case_patterns = [
            r'Case\s+No\.?\s*:?\s*([A-Z0-9-]+)',
            r'Civil\s+Action\s+No\.?\s*:?\s*([A-Z0-9-]+)',
            r'(\d{2}[A-Z]{2}\d{5})',  # Format like 24GC06809
        ]

        for pattern in case_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                metadata["case_number"] = match.group(1)
                break

        # Extract filing date
        date_patterns = [
            r'Filed:?\s*(\d{1,2}/\d{1,2}/\d{4})',
            r'Date:?\s*(\d{1,2}/\d{1,2}/\d{4})',
            r'(\w+\s+\d{1,2},\s+\d{4})',  # Format like "August 11, 2025"
        ]

        for pattern in date_patterns:
            match = re.search(pattern, text)
            if match:
                metadata["filing_date"] = match.group(1)
                break

        # Extract parties (simplified - looks for "Plaintiff" and "Defendant")
        plaintiff_match = re.search(r'([A-Z][A-Za-z\s]+),?\s+Plaintiff', text)
        if plaintiff_match:
            metadata["parties"].append(f"{plaintiff_match.group(1).strip()} (Plaintiff)")

        defendant_match = re.search(r'([A-Z][A-Za-z\s]+),?\s+Defendant', text)
        if defendant_match:
            metadata["parties"].append(f"{defendant_match.group(1).strip()} (Defendant)")

        return metadata

    def classify_document(self, doc_type: str, text: str) -> Dict:
        """Classify document into categories"""
        classification = {
            "is_evidence": False,
            "is_reference_material": False,
            "is_research": False,
            "is_case_filing": False,
            "is_court_order": False
        }

        # Rule-based classification
        if doc_type in ["Evidence", "Exhibit"]:
            classification["is_evidence"] = True
        elif doc_type in ["Research", "Memo"]:
            classification["is_research"] = True
        elif doc_type == "Order":
            classification["is_court_order"] = True
        elif doc_type in ["Motion", "Response", "Complaint"]:
            classification["is_case_filing"] = True

        # Text-based classification
        text_lower = text.lower()
        if "exhibit" in text_lower or "evidence" in text_lower:
            classification["is_evidence"] = True
        if "memorandum" in text_lower or "research" in text_lower:
            classification["is_research"] = True

        return classification

    def generate_document_summary_json(
        self,
        pdf_path: Path,
        doc_type: str,
        gemini_summary: Dict,
        extracted_text: str,
        docling_metadata: Dict,
        page_breaks_added: int,
        processing_time: float,
        output_folder: Path
    ):
        """Generate structured document_summary.json"""
        self._log("INFO", "Generating document_summary.json...")

        # Extract metadata from text
        text_metadata = self.extract_metadata_from_text(extracted_text, pdf_path)

        # Classify document
        classification = self.classify_document(doc_type, extracted_text)

        # Count pages and characters
        page_count = page_breaks_added + 1
        character_count = len(extracted_text)

        # Build complete JSON structure
        summary_data = {
            "document_metadata": {
                "original_filename": pdf_path.name,
                "document_type": doc_type,
                "processing_date": datetime.now().isoformat(),
                "processing_method": "Docling",
                "page_count": page_count,
                "character_count": character_count,
                "case_number": text_metadata["case_number"],
                "filing_date": text_metadata["filing_date"],
                "parties": text_metadata["parties"] if text_metadata["parties"] else gemini_summary.get("key_parties", []),
                "classification": classification
            },
            "document_summary": gemini_summary,
            "processing_details": {
                "page_breaks_added": page_breaks_added,
                "images_found": 0,  # Can be enhanced with image detection
                "extraction_quality": "high" if page_breaks_added > 0 else "medium",
                "gemini_summary_generated": bool(gemini_summary.get("executive_summary")),
                "ocr_used": docling_metadata.get("ocr_used", False),
                "is_scanned_document": docling_metadata.get("ocr_used", False),
                "docling_processing_time_seconds": processing_time,
                "total_processing_time_seconds": processing_time
            }
        }

        # Write JSON file
        json_file = output_folder / "document_summary.json"
        with open(json_file, 'w') as f:
            json.dump(summary_data, f, indent=2)

        self._log("SUCCESS", "document_summary.json created")

    def process_document(self, pdf_path: Path) -> bool:
        """Process a single PDF document through complete workflow"""
        self._log("INFO", f"\n{'='*60}")
        self._log("INFO", f"Processing: {pdf_path.name}")
        self._log("INFO", f"{'='*60}")

        start_time = time.time()

        try:
            # Step 1: Detect document type
            doc_type = self.detect_document_type(pdf_path)

            # Step 2: Create document folder
            doc_folder = self.create_document_folder(doc_type)

            # Step 3: Move original PDF
            moved_pdf = self.move_pdf(pdf_path, doc_folder)

            # Step 4: Generate Gemini summary (writes directly to temp JSON file)
            temp_gemini_json = doc_folder / "document_summary.json"
            gemini_summary = self.generate_gemini_summary(moved_pdf, temp_gemini_json, doc_type)

            # Step 5: Extract text with Docling
            markdown_text, docling_metadata = self.extract_text_with_docling(moved_pdf, doc_folder)

            # Step 6: Insert page breaks
            final_text, page_breaks = self.insert_page_breaks(markdown_text, docling_metadata, doc_folder)

            # Step 7: Generate metadata JSON
            processing_time = time.time() - start_time
            self.generate_document_summary_json(
                moved_pdf,
                doc_type,
                gemini_summary,
                final_text,
                docling_metadata,
                page_breaks,
                processing_time,
                doc_folder
            )

            # Step 8: Cleanup
            # Note: temp_gemini_json is now document_summary.json (final file), so don't delete it

            # Remove Docling's JSON metadata file (optional - keep for debugging)
            # docling_json = doc_folder / f"{moved_pdf.stem}.json"
            # if docling_json.exists():
            #     docling_json.unlink()

            total_time = time.time() - start_time
            self._log("SUCCESS", f"Processing complete ({total_time:.1f}s)")
            self._log("INFO", f"Output: {doc_folder.relative_to(self.case_folder)}")

            return True

        except Exception as e:
            self._log("CRITICAL", f"Processing failed for {pdf_path.name}: {e}")
            return False

    def process_batch(self) -> Tuple[int, int]:
        """Process all PDFs in intake folder"""
        # Find all PDFs
        if self.intake_path.is_file():
            pdf_files = [self.intake_path]
        else:
            pdf_files = list(self.intake_path.glob("*.pdf"))

        if not pdf_files:
            self._log("INFO", "No PDF files found in Intake folder")
            return 0, 0

        self._log("INFO", f"\n{'='*60}")
        self._log("INFO", f"🔄 Document Processing Started")
        self._log("INFO", f"{'='*60}")
        self._log("INFO", f"Found {len(pdf_files)} PDF(s) in Intake folder\n")

        successful = 0
        failed = 0

        for i, pdf_file in enumerate(pdf_files, 1):
            self._log("INFO", f"[{i}/{len(pdf_files)}] Processing: {pdf_file.name}")

            if self.process_document(pdf_file):
                successful += 1
            else:
                failed += 1

        # Summary
        self._log("INFO", f"\n{'='*60}")
        self._log("SUCCESS", "✅ Batch Processing Complete")
        self._log("INFO", f"   Total: {len(pdf_files)} documents")
        self._log("INFO", f"   Successful: {successful}")
        self._log("INFO", f"   Failed: {failed}")
        self._log("INFO", f"{'='*60}\n")

        return successful, failed


def main():
    """Main entry point for phased document processing"""
    parser = argparse.ArgumentParser(
        description="Process legal documents from Intake folder (Version 4.0 - Enhanced Synthesis)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run Phase 1-2, stop for annotations (default)
  python scripts/process_intake.py cases/test_case/Intake

  # Run all phases without stopping (skip annotation prompt)
  python scripts/process_intake.py cases/test_case/Intake --all-phases

  # Run specific phase only
  python scripts/process_intake.py cases/test_case/Intake --phase extract
  python scripts/process_intake.py cases/test_case/Intake --phase summarize
  python scripts/process_intake.py cases/test_case/Intake --phase synthesize

  # Resume from specific phase
  python scripts/process_intake.py cases/test_case/Intake --resume-from summarize
        """
    )

    parser.add_argument(
        "intake_path",
        help="Path to Intake folder"
    )

    parser.add_argument(
        "--phase",
        choices=["extract", "summarize", "synthesize"],
        help="Run specific phase only (extract, summarize, or synthesize)"
    )

    parser.add_argument(
        "--resume-from",
        choices=["summarize", "synthesize"],
        help="Resume processing from specific phase"
    )

    parser.add_argument(
        "--all-phases",
        action="store_true",
        help="Run all phases without stopping for annotation prompt (skip user notes)"
    )

    parser.add_argument(
        "--verbose",
        action="store_true",
        default=True,
        help="Enable verbose logging (default: True)"
    )

    args = parser.parse_args()

    # Validate intake path
    intake_path = Path(args.intake_path)
    if not intake_path.exists():
        print(f"❌ Error: Path does not exist: {intake_path}")
        sys.exit(1)

    # Load verification settings
    settings = {}
    try:
        settings_path = Path(__file__).resolve().parent.parent / "settings.json"
        if settings_path.exists():
            with open(settings_path, "r") as f:
                settings = json.load(f)
    except Exception as e:
        print(f"⚠️  Warning: Failed to read settings.json: {e}")
        settings = {}

    dv_cfg = settings.get("document_verification", {}) if isinstance(settings, dict) else {}

    verify_case_summary = bool(dv_cfg.get("auto_verify_case_summary", True))
    verification_mode = dv_cfg.get("verification_mode", "single")
    verification_focus = dv_cfg.get("verification_focus", ["facts", "claims", "procedural"])
    verification_timing = dv_cfg.get("verification_timing", "immediate")  # immediate | post_phase | off
    verification_sources_dir = dv_cfg.get("sources_dir")
    verification_sources_glob = dv_cfg.get("source_glob")
    if isinstance(verification_timing, str) and verification_timing.lower() == "off":
        verify_case_summary = False


    # Create processor
    try:
        processor = DocumentProcessor(
            str(intake_path),
            verbose=args.verbose,
            phase=args.phase,
            resume_from=args.resume_from,
            verify_case_summary=verify_case_summary,
            verification_mode=verification_mode,
            verification_sources_dir=verification_sources_dir,
            verification_sources_glob=verification_sources_glob,
            verification_focus=verification_focus,
            verification_timing=verification_timing,
        )

        # Run appropriate workflow
        if args.phase:
            # Run specific phase only
            processor.run_phase(args.phase)
        elif args.resume_from:
            # Resume from specific phase
            processor.resume_from_phase(args.resume_from)
        else:
            # Run all phases (default stops after Phase 2 for annotations)
            # Use --all-phases flag to skip annotation prompt
            processor.run_all_phases(skip_annotation_prompt=args.all_phases)

        sys.exit(0)

    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

