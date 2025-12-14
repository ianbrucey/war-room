# S3 Storage Integration Spec

**Created:** 2025-12-13  
**Status:** Draft  
**Author:** Gemini (Claude)  
**Related:** `00-task-plan.md`, `document-intake-architecture.md`

---

## 1. Executive Summary

Integrate Amazon S3 as the **durable source of truth** for all uploaded documents in JusticeQuest. The local filesystem becomes a cache, and S3 provides:

- **Durability**: 99.999999999% (11 9s) data durability
- **Multi-device access**: Foundation for future web/mobile clients
- **Backup/Recovery**: Versioning, cross-region replication
- **Secure Access**: Pre-signed URLs for time-limited preview/download

### Key Architectural Change

```
BEFORE:
  Upload → Local Filesystem (source of truth) → Gemini File Search

AFTER:
  Upload → S3 (source of truth) → Local Cache → Gemini File Search
              ↓
         Pre-signed URLs for preview/download
```

---

## 2. S3 Bucket Architecture

### 2.1 Bucket Structure

```
justicequest-documents-{environment}/
├── users/
│   └── {user_id}/
│       └── cases/
│           └── {case_file_id}/
│               └── documents/
│                   └── {document_id}/
│                       ├── original.{ext}        # Original uploaded file
│                       ├── extracted-text.txt     # Text extraction
│                       ├── metadata.json          # AI-generated metadata
│                       └── thumbnails/            # Generated previews (optional)
│                           ├── page-1.png
│                           └── page-2.png
```

### 2.2 Bucket Naming Convention

| Environment | Bucket Name |
|-------------|-------------|
| Development | `justicequest-documents-dev` |
| Staging | `justicequest-documents-staging` |
| Production | `justicequest-documents-prod` |

### 2.3 S3 Key Format

```
users/{user_id}/cases/{case_file_id}/documents/{document_id}/{filename}
```

**Example:**
```
users/usr_abc123/cases/case_1765622644973_set3agv0/documents/6c31fabe-d5b6-4589-b20a-80f13fb46258/original.pdf
```

---

## 3. Database Schema Changes

### 3.1 New Columns for `case_documents` Table

```sql
ALTER TABLE case_documents ADD COLUMN s3_key TEXT;
ALTER TABLE case_documents ADD COLUMN s3_bucket TEXT;
ALTER TABLE case_documents ADD COLUMN s3_uploaded_at INTEGER;
ALTER TABLE case_documents ADD COLUMN s3_version_id TEXT;
ALTER TABLE case_documents ADD COLUMN content_type TEXT;
ALTER TABLE case_documents ADD COLUMN file_size_bytes INTEGER;
```

### 3.2 Updated TypeScript Interface

```typescript
export interface ICaseDocument {
  // ... existing fields ...
  
  // S3 Storage
  s3_key?: string;              // Full S3 object key
  s3_bucket?: string;           // Bucket name
  s3_uploaded_at?: number;      // Unix timestamp (ms)
  s3_version_id?: string;       // S3 version ID (if versioning enabled)
  content_type?: string;        // MIME type (application/pdf, video/mp4, etc.)
  file_size_bytes?: number;     // File size for display/validation
}
```

---

## 4. Upload Flow

### 4.1 Sequence Diagram

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  WebUI   │     │ Express  │     │ S3Service│     │ LocalFS  │     │ TextExtr │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │                │
     │ POST /upload   │                │                │                │
     │───────────────>│                │                │                │
     │                │                │                │                │
     │                │ uploadToS3()   │                │                │
     │                │───────────────>│                │                │
     │                │                │──────┐         │                │
     │                │                │      │ PUT     │                │
     │                │                │<─────┘         │                │
     │                │    s3Key       │                │                │
     │                │<───────────────│                │                │
     │                │                │                │                │
     │                │ saveToLocalCache()              │                │
     │                │────────────────────────────────>│                │
     │                │                │                │                │
     │                │ DB.create(s3_key, ...)          │                │
     │                │──────┐         │                │                │
     │                │      │         │                │                │
     │                │<─────┘         │                │                │
     │                │                │                │                │
     │  { documentId }│                │                │                │
     │<───────────────│                │                │                │
     │                │                │                │                │
     │                │ startExtraction() (async)       │                │
     │                │─────────────────────────────────────────────────>│
     │                │                │                │                │
```

### 4.2 Upload Implementation

```typescript
// src/process/documents/services/S3StorageService.ts

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';

export class S3StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucket = process.env.S3_DOCUMENTS_BUCKET || 'justicequest-documents-dev';
  }

  /**
   * Generate S3 key for a document
   */
  generateKey(userId: string, caseFileId: string, documentId: string, filename: string): string {
    return `users/${userId}/cases/${caseFileId}/documents/${documentId}/${filename}`;
  }

  /**
   * Upload a file to S3
   */
  async uploadFile(
    filePath: string,
    s3Key: string,
    contentType: string
  ): Promise<{ key: string; versionId?: string; bucket: string }> {
    const fileContent = await fs.readFile(filePath);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
      // Optional: Add metadata
      Metadata: {
        'uploaded-at': new Date().toISOString(),
        'original-filename': path.basename(filePath),
      },
    });

    const response = await this.client.send(command);

    return {
      key: s3Key,
      versionId: response.VersionId,
      bucket: this.bucket,
    };
  }

  /**
   * Download a file from S3 to local cache
   */
  async downloadToCache(s3Key: string, localPath: string): Promise<void> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });

    const response = await this.client.send(command);
    const bodyContents = await response.Body?.transformToByteArray();
    
    if (bodyContents) {
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, bodyContents);
    }
  }

  /**
   * Generate a pre-signed URL for download/preview
   */
  async getSignedUrl(
    s3Key: string,
    expiresInSeconds: number = 3600,
    options?: {
      responseContentDisposition?: string;
      responseContentType?: string;
    }
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ResponseContentDisposition: options?.responseContentDisposition,
      ResponseContentType: options?.responseContentType,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Check if a file exists in S3
   */
  async exists(s3Key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });
      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(s3Key: string): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });
    await this.client.send(command);
  }

  /**
   * Delete all files for a document
   */
  async deleteDocument(userId: string, caseFileId: string, documentId: string): Promise<void> {
    const { ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
    
    const prefix = `users/${userId}/cases/${caseFileId}/documents/${documentId}/`;
    
    // List all objects with this prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    });
    
    const listResponse = await this.client.send(listCommand);
    
    if (listResponse.Contents && listResponse.Contents.length > 0) {
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: listResponse.Contents.map(obj => ({ Key: obj.Key })),
        },
      });
      
      await this.client.send(deleteCommand);
    }
  }
}
```

---

## 5. Preview & Download with Signed URLs

### 5.1 Content Type Mapping

```typescript
// src/process/documents/utils/contentTypeMapper.ts

export const CONTENT_TYPE_MAP: Record<string, string> = {
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.rtf': 'application/rtf',
  
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.tiff': 'image/tiff',
  '.bmp': 'image/bmp',
  
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  
  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.wmv': 'video/x-ms-wmv',
  
  // Archives (for reference, won't preview inline)
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
};

export function getContentType(filename: string): string {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
}

export function isPreviewable(contentType: string): boolean {
  return (
    contentType.startsWith('image/') ||
    contentType.startsWith('video/') ||
    contentType.startsWith('audio/') ||
    contentType === 'application/pdf' ||
    contentType.startsWith('text/')
  );
}

export function getPreviewType(contentType: string): 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'office' | 'none' {
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('text/')) return 'text';
  if (contentType.includes('word') || contentType.includes('document')) return 'office';
  return 'none';
}
```

### 5.2 API Endpoints

```typescript
// src/webserver/routes/documentRoutes.ts (updated)

/**
 * GET /api/documents/:documentId/preview-url
 * 
 * Returns a pre-signed URL for inline preview (Content-Disposition: inline)
 */
router.get('/documents/:documentId/preview-url', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const document = DocumentRepository.findById(documentId);
    
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    
    if (!document.s3_key) {
      res.status(404).json({ error: 'Document not uploaded to S3' });
      return;
    }
    
    const s3Service = new S3StorageService();
    const contentType = document.content_type || getContentType(document.filename);
    const previewType = getPreviewType(contentType);
    
    // Generate pre-signed URL with inline disposition for preview
    const signedUrl = await s3Service.getSignedUrl(document.s3_key, 3600, {
      responseContentType: contentType,
      responseContentDisposition: `inline; filename="${encodeURIComponent(document.filename)}"`,
    });
    
    res.json({
      url: signedUrl,
      contentType,
      previewType,
      filename: document.filename,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('[DocumentIntake] Preview URL error:', error);
    res.status(500).json({ error: 'Failed to generate preview URL' });
  }
});

/**
 * GET /api/documents/:documentId/download-url
 * 
 * Returns a pre-signed URL for download (Content-Disposition: attachment)
 */
router.get('/documents/:documentId/download-url', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const document = DocumentRepository.findById(documentId);
    
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    
    if (!document.s3_key) {
      // Fallback to local file if not in S3
      res.status(404).json({ error: 'Document not uploaded to S3' });
      return;
    }
    
    const s3Service = new S3StorageService();
    
    // Generate pre-signed URL with attachment disposition for download
    const signedUrl = await s3Service.getSignedUrl(document.s3_key, 3600, {
      responseContentDisposition: `attachment; filename="${encodeURIComponent(document.filename)}"`,
    });
    
    res.json({
      url: signedUrl,
      filename: document.filename,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('[DocumentIntake] Download URL error:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});
```

### 5.3 Frontend Preview Component

```typescript
// src/renderer/components/DocumentPreview/index.tsx

import React, { useEffect, useState } from 'react';
import { Spin, Message } from '@arco-design/web-react';

interface PreviewData {
  url: string;
  contentType: string;
  previewType: 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'office' | 'none';
  filename: string;
}

interface DocumentPreviewProps {
  documentId: string;
  onClose: () => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ documentId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreviewUrl = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/preview-url`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to get preview URL');
        }
        
        const data = await response.json();
        setPreviewData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Preview failed');
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewUrl();
  }, [documentId]);

  if (loading) {
    return <div className="preview-loading"><Spin size={40} /></div>;
  }

  if (error || !previewData) {
    return <div className="preview-error">{error || 'Preview unavailable'}</div>;
  }

  const renderPreview = () => {
    switch (previewData.previewType) {
      case 'pdf':
        return (
          <iframe
            src={previewData.url}
            className="preview-iframe"
            title={previewData.filename}
          />
        );

      case 'image':
        return (
          <img
            src={previewData.url}
            alt={previewData.filename}
            className="preview-image"
          />
        );

      case 'video':
        return (
          <video
            src={previewData.url}
            controls
            className="preview-video"
          >
            Your browser does not support video playback.
          </video>
        );

      case 'audio':
        return (
          <div className="preview-audio-container">
            <div className="audio-filename">{previewData.filename}</div>
            <audio
              src={previewData.url}
              controls
              className="preview-audio"
            >
              Your browser does not support audio playback.
            </audio>
          </div>
        );

      case 'text':
        return (
          <iframe
            src={previewData.url}
            className="preview-iframe preview-text"
            title={previewData.filename}
          />
        );

      case 'office':
        // For Word documents, use Microsoft Office Online viewer or Google Docs Viewer
        // Note: These require the document to be publicly accessible or use alternative approaches
        return (
          <div className="preview-office">
            <p>Word document preview requires download.</p>
            <a href={previewData.url} target="_blank" rel="noopener noreferrer">
              Open in new tab
            </a>
          </div>
        );

      default:
        return (
          <div className="preview-unavailable">
            <p>Preview not available for this file type.</p>
            <p>Click download to view the file.</p>
          </div>
        );
    }
  };

  return (
    <div className="document-preview-modal">
      <div className="preview-header">
        <span className="preview-filename">{previewData.filename}</span>
        <button onClick={onClose} className="preview-close">×</button>
      </div>
      <div className="preview-content">
        {renderPreview()}
      </div>
    </div>
  );
};
```

### 5.4 Preview Styles

```css
/* src/renderer/components/DocumentPreview/styles.css */

.document-preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--color-bg-2);
  border-bottom: 1px solid var(--color-border);
}

.preview-filename {
  font-weight: 600;
  color: var(--color-text-1);
}

.preview-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--color-text-2);
}

.preview-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: auto;
  padding: 24px;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
  border-radius: 8px;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.preview-video {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
}

.preview-audio-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 48px;
  background: var(--color-bg-2);
  border-radius: 16px;
}

.audio-filename {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-1);
}

.preview-audio {
  width: 400px;
}

.preview-loading,
.preview-error,
.preview-unavailable,
.preview-office {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  text-align: center;
  color: var(--color-text-2);
}
```

---

## 6. Word Document Preview Options

Word documents (.doc, .docx) are challenging to preview directly in browsers. Here are the recommended approaches:

### 6.1 Option A: Convert to PDF Server-Side (Recommended)

Use a library like `libreoffice` or a service to convert Word docs to PDF for preview:

```typescript
// On document upload, generate a PDF preview
async function generateWordPreview(s3Key: string, documentId: string): Promise<string> {
  // Download original
  const localPath = `/tmp/${documentId}/original.docx`;
  await s3Service.downloadToCache(s3Key, localPath);
  
  // Convert to PDF using LibreOffice (requires libreoffice installed)
  execSync(`libreoffice --headless --convert-to pdf --outdir /tmp/${documentId} ${localPath}`);
  
  // Upload PDF preview to S3
  const pdfPath = `/tmp/${documentId}/original.pdf`;
  const previewKey = s3Key.replace(/\.(doc|docx)$/, '-preview.pdf');
  await s3Service.uploadFile(pdfPath, previewKey, 'application/pdf');
  
  return previewKey;
}
```

### 6.2 Option B: Microsoft Office Online Viewer

Use Microsoft's public viewer (requires document to be publicly accessible):

```typescript
const officeViewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(signedUrl)}`;
```

**Note:** This requires the S3 object to have a public pre-signed URL, which works with our approach.

### 6.3 Option C: Google Docs Viewer

Similar to Microsoft, Google offers a document viewer:

```typescript
const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(signedUrl)}&embedded=true`;
```

---

## 7. Updated Upload Flow

### 7.1 Modified Document Routes

```typescript
// src/webserver/routes/documentRoutes.ts (updated upload handler)

router.post('/cases/:caseFileId/documents/upload',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { caseFileId } = req.params;
      const file = req.file;
      const user = req.user; // From auth middleware

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Get workspace path from case file
      const caseFile = CaseFileRepository.findById(caseFileId);
      if (!caseFile) {
        res.status(404).json({ error: 'Case file not found' });
        return;
      }

      // Detect file type and content type
      const fileType = await detectFileType(file.originalname);
      const contentType = getContentType(file.originalname);
      const folderName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');

      // Create document record first (with pending status)
      const documentId = randomUUID();
      
      // Initialize S3 service
      const s3Service = new S3StorageService();
      
      // Generate S3 key
      const s3Key = s3Service.generateKey(
        user.id,
        caseFileId,
        documentId,
        `original${path.extname(file.originalname)}`
      );

      // Upload to S3
      const s3Result = await s3Service.uploadFile(file.path, s3Key, contentType);

      // Create database record with S3 info
      const createdDoc = DocumentRepository.create({
        id: documentId,
        case_file_id: caseFileId,
        filename: file.originalname,
        folder_name: folderName,
        file_type: fileType,
        content_type: contentType,
        file_size_bytes: file.size,
        processing_status: 'pending',
        has_text_extraction: 0,
        has_metadata: 0,
        rag_indexed: 0,
        uploaded_at: Date.now(),
        s3_key: s3Result.key,
        s3_bucket: s3Result.bucket,
        s3_version_id: s3Result.versionId,
        s3_uploaded_at: Date.now(),
      });

      // Also save to local cache for processing
      const workspacePath = caseFile.workspace_path;
      const intakePath = path.join(workspacePath, 'intake');
      fs.mkdirSync(intakePath, { recursive: true });
      const localPath = path.join(intakePath, file.originalname);
      fs.renameSync(file.path, localPath);

      // Start async text extraction
      const textExtractor = new TextExtractor(
        process.env.MISTRAL_API_KEY || '',
        process.env.GEMINI_API_KEY || ''
      );
      textExtractor.extractDocument(createdDoc.id, caseFileId, localPath).catch(err => {
        console.error('[DocumentIntake] Background processing failed:', err);
      });

      res.json({ 
        success: true, 
        documentId: createdDoc.id,
        s3Key: s3Result.key,
      });
    } catch (error) {
      console.error('[DocumentIntake] Upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);
```

---

## 8. Environment Configuration

### 8.1 Required Environment Variables

```bash
# .env

# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# S3 Configuration
S3_DOCUMENTS_BUCKET=justicequest-documents-dev

# Optional: Use IAM role instead of access keys (for EC2/ECS)
# AWS_USE_IAM_ROLE=true
```

### 8.2 IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "JusticeQuestDocumentAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::justicequest-documents-*",
        "arn:aws:s3:::justicequest-documents-*/*"
      ]
    }
  ]
}
```

### 8.3 S3 Bucket Configuration

```json
{
  "Versioning": "Enabled",
  "LifecycleRules": [
    {
      "ID": "DeleteOldVersions",
      "Status": "Enabled",
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 90
      }
    }
  ],
  "CorsConfiguration": {
    "CORSRules": [
      {
        "AllowedOrigins": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["Content-Disposition", "Content-Type"],
        "MaxAgeSeconds": 3600
      }
    ]
  },
  "PublicAccessBlock": {
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  }
}
```

---

## 9. Migration Strategy

### 9.1 Phase 1: Add S3 Upload (Parallel Write)

1. Add S3 upload to the upload flow
2. Continue writing to local filesystem
3. Store S3 key in database
4. S3 becomes **additional** storage

### 9.2 Phase 2: Switch Preview/Download to S3

1. Update preview endpoint to use S3 signed URLs
2. Update download endpoint to use S3 signed URLs
3. Fallback to local filesystem if S3 key is missing

### 9.3 Phase 3: Local Becomes Cache (Optional)

1. Remove local filesystem as source of truth
2. Local files are cached copies, auto-deleted after 7 days
3. Re-download from S3 when needed

### 9.4 Backfill Existing Documents

```typescript
// Migration script to upload existing documents to S3

async function backfillS3() {
  const documents = DocumentRepository.findAll();
  
  for (const doc of documents) {
    if (doc.s3_key) continue; // Already in S3
    
    const caseFile = CaseFileRepository.findById(doc.case_file_id);
    const localPath = path.join(
      caseFile.workspace_path,
      'documents',
      doc.folder_name,
      `original${path.extname(doc.filename)}`
    );
    
    if (!fs.existsSync(localPath)) {
      console.warn(`Missing local file for ${doc.id}`);
      continue;
    }
    
    const s3Key = s3Service.generateKey(
      caseFile.user_id,
      doc.case_file_id,
      doc.id,
      `original${path.extname(doc.filename)}`
    );
    
    await s3Service.uploadFile(localPath, s3Key, getContentType(doc.filename));
    
    DocumentRepository.updateS3Info(doc.id, {
      s3_key: s3Key,
      s3_bucket: s3Service.bucket,
      s3_uploaded_at: Date.now(),
    });
    
    console.log(`Uploaded ${doc.filename} to S3`);
  }
}
```

---

## 10. Cost Estimation

### 10.1 S3 Pricing (us-east-1)

| Item | Price |
|------|-------|
| Storage (Standard) | $0.023/GB/month |
| PUT requests | $0.005 per 1,000 |
| GET requests | $0.0004 per 1,000 |
| Data transfer OUT | $0.09/GB (first 10TB) |

### 10.2 Example: Small Law Firm

- **100 cases** with **10 documents each** = 1,000 documents
- **Average document size**: 5MB
- **Total storage**: 5GB
- **Monthly GETs**: 5,000 (previews/downloads)

**Monthly cost:**
- Storage: 5GB × $0.023 = **$0.12**
- PUT requests: 1,000 × $0.005/1000 = **$0.005**
- GET requests: 5,000 × $0.0004/1000 = **$0.002**
- **Total: ~$0.13/month**

---

## 11. Security Considerations

### 11.1 Pre-signed URL Security

- URLs expire after 1 hour (configurable)
- URLs are unique per request (include signature)
- Cannot be guessed or reused after expiration

### 11.2 Access Control

- All S3 access goes through backend API
- User authentication required before generating signed URL
- Backend verifies user owns the document before generating URL

### 11.3 Bucket Security

- Block all public access
- Versioning enabled (protect against accidental deletion)
- Server-side encryption (SSE-S3 or SSE-KMS)

---

## 12. Task Checklist

### Phase 1: Foundation
- [ ] Add AWS SDK dependencies (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- [ ] Create `S3StorageService` class
- [ ] Add S3-related columns to database schema (migration)
- [ ] Update `ICaseDocument` type definition
- [ ] Add content type mapper utility

### Phase 2: Upload Integration
- [ ] Modify upload endpoint to write to S3
- [ ] Store S3 key and metadata in database
- [ ] Add backfill script for existing documents

### Phase 3: Preview & Download
- [ ] Create `/preview-url` endpoint
- [ ] Create `/download-url` endpoint
- [ ] Build `DocumentPreview` React component
- [ ] Add preview support for PDF, images, audio, video
- [ ] Implement Word document preview solution

### Phase 4: Cleanup
- [ ] Update delete endpoint to remove from S3
- [ ] Add local cache cleanup job (optional)
- [ ] Add monitoring/logging for S3 operations

### Phase 5: Testing
- [ ] Unit tests for S3StorageService
- [ ] Integration tests for upload/preview/download flow
- [ ] Test signed URL expiration
- [ ] Test all supported file types

---

## 13. Open Questions

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | **Where to host bucket?** | Same region as users vs. CDN | Start with us-east-1, add CloudFront later if needed |
| 2 | **Word doc preview?** | Convert to PDF vs. external viewer | Convert to PDF server-side for best UX |
| 3 | **Cache strategy?** | Keep local cache vs. pure S3 | Keep local cache for processing, optional cleanup |
| 4 | **Encryption?** | SSE-S3 vs. SSE-KMS | SSE-S3 for simplicity (KMS for enterprise) |

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-13  
**Next Review:** After Phase 1 implementation
