# AionUI Project Context for Document Intake Agents

**CRITICAL:** Read this entire document before starting any work. This provides the foundational context you need to implement your assigned tickets correctly.

---

## 1. What is AionUI?

AionUI is an **AI-powered legal case drafting assistant**. It helps lawyers:
- Manage legal case files
- Upload and analyze case documents (complaints, motions, briefs, evidence)
- Draft legal documents using AI agents
- Research case law and legal precedents

**Technology Stack:**
- **Backend:** Node.js + TypeScript + Express.js
- **Database:** SQLite (via `better-sqlite3`)
- **AI Integration:** Google Gemini SDK, Mistral API
- **Frontend:** React (but you're only working on backend)

---

## 2. WebUI Mode Architecture

AionUI can run in two modes. **You are working on WebUI mode only.**

**WebUI Mode:**
- Express.js server running on `http://localhost:3000`
- No Electron dependencies
- Browser connects directly to Express server
- Database at `~/.justicequest/aionui.db`

**Key Directories:**
```
src/
├── webserver/           # Express.js server (YOUR FOCUS)
│   ├── routes/          # HTTP route handlers
│   ├── middleware/      # Auth, error handling
│   ├── auth/
│   │   └── repository/  # Database repositories
│   └── websocket/       # WebSocket handlers
├── process/             # Core business logic
│   ├── database/        # Schema, migrations, types
│   └── documents/       # NEW - Your work goes here
└── renderer/            # Frontend (ignore)
```

---

## 3. Case File & Workspace Concept

**Case File:** A legal case being worked on (e.g., "Smith v. Jones")
- Stored in `case_files` database table
- Has a unique `id` (UUID)
- Has a `workspace_path` pointing to its folder

**Workspace:** A folder on disk for each case
- Located at: `~/.justicequest/{case-name}-{timestamp}/`
- Contains all case documents, extractions, metadata
- Structure you'll create:
```
~/.justicequest/smith-v-jones-1702500000000/
├── documents/
│   ├── originals/       # Uploaded files (complaint.pdf)
│   ├── extractions/     # Extracted text (complaint.txt)
│   └── metadata/        # AI-generated JSON (complaint.json)
└── case-documents-manifest.json
```

---

## 4. Database Patterns

### Getting Database Connection
```typescript
import { getDatabase } from '../../process/database/connection';

const db = getDatabase();
```

### Repository Pattern
All database access uses the Repository pattern. See `CaseFileRepository.ts`:

```typescript
import Database from 'better-sqlite3';
import { getDatabase } from '../../../process/database/connection';
import { ICaseDocument } from '../../../process/documents/types';

export class DocumentRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  create(doc: Omit<ICaseDocument, 'id'>): ICaseDocument {
    const id = crypto.randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO case_documents (id, case_file_id, filename, ...)
      VALUES (?, ?, ?, ...)
    `);
    stmt.run(id, doc.case_file_id, doc.filename, ...);
    return this.findById(id)!;
  }

  findById(id: string): ICaseDocument | null {
    const stmt = this.db.prepare('SELECT * FROM case_documents WHERE id = ?');
    return stmt.get(id) as ICaseDocument | null;
  }
}
```

### Key Tables
- `users` - User accounts
- `case_files` - Legal cases (has `workspace_path`)
- `case_documents` - Documents within cases (NEW - migration v11)

---

## 5. Express.js Patterns

### Route Registration
Routes are registered in `src/webserver/index.ts`. After creating your routes file, it must be imported and registered:

```typescript
// In src/webserver/index.ts
import documentRoutes from './routes/documentRoutes';

// After other routes
app.use('/api', documentRoutes);
```

### Route File Structure
```typescript
// src/webserver/routes/documentRoutes.ts
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// All routes require authentication
router.use(authMiddleware);

router.post('/cases/:caseFileId/documents/upload', 
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { caseFileId } = req.params;
      const userId = req.user!.id; // From authMiddleware
      const file = req.file;
      
      // Your logic here
      
      res.json({ success: true, documentId: '...' });
    } catch (error) {
      console.error('[DocumentIntake] Upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

export default router;
```

### Authentication
The `authMiddleware` adds `req.user` with user info:
```typescript
// After authMiddleware runs:
req.user = {
  id: 'user-uuid',
  email: 'user@example.com',
  // ... other user fields
}
```

---

## 6. Development Commands

```bash
# Start WebUI mode (development)
npm run webui

# Build the project (checks TypeScript)
npm run build

# Run tests
npm test

# Run specific test file
npm test -- src/process/documents/__tests__/integration.test.ts
```

**Database Location:** `~/.justicequest/aionui.db`

To inspect database:
```bash
sqlite3 ~/.justicequest/aionui.db
.tables
.schema case_documents
SELECT * FROM case_documents;
```

---

## 7. Environment Variables

Required API keys (set in `.env` or environment):
```
MISTRAL_API_KEY=your-mistral-key
GEMINI_API_KEY=your-gemini-key
```

Access in code:
```typescript
const mistralKey = process.env.MISTRAL_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
```

---

## 8. Code Standards

### TypeScript
- No `any` types - use proper interfaces
- Use `async/await`, not callbacks
- Export all public types/functions

### Error Handling
```typescript
try {
  // operation
} catch (error) {
  console.error('[DocumentIntake] Operation failed:', error);
  throw error; // or handle gracefully
}
```

### Logging
Prefix all logs with `[DocumentIntake]`:
```typescript
console.log('[DocumentIntake] Processing document:', filename);
console.error('[DocumentIntake] Extraction failed:', error);
```

### File Operations
Use `fs/promises` for async file operations:
```typescript
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

await mkdir(dirPath, { recursive: true });
await writeFile(filePath, content, 'utf-8');
const content = await readFile(filePath, 'utf-8');
```

---

## 9. Key Imports Reference

```typescript
// Database
import { getDatabase } from '../../process/database/connection';
import Database from 'better-sqlite3';

// Types (after Agent 1 creates them)
import { ICaseDocument, IDocumentMetadata, ProcessingStatus } from '../../process/documents/types';

// Repository (after Agent 1 creates it)
import { DocumentRepository } from '../auth/repository/DocumentRepository';

// Express
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

// File system
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join, basename, extname } from 'path';

// Gemini SDK
import { GoogleGenerativeAI } from '@google/generative-ai';

// UUID generation
import { randomUUID } from 'crypto';
```

---

## 10. Testing Patterns

```typescript
// src/process/documents/__tests__/example.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DocumentRepository } from '../../../webserver/auth/repository/DocumentRepository';

describe('DocumentRepository', () => {
  let repo: DocumentRepository;

  beforeEach(() => {
    repo = new DocumentRepository();
  });

  it('should create a document', () => {
    const doc = repo.create({
      case_file_id: 'test-case-id',
      filename: 'test.pdf',
      // ... other fields
    });
    
    expect(doc.id).toBeDefined();
    expect(doc.filename).toBe('test.pdf');
  });
});
```

---

## Next Steps

After reading this document:
1. Load your specific agent prompt (AGENT-1-PROMPT.md, etc.)
2. Load the context files listed in your prompt
3. Begin implementing your assigned tickets
4. Follow the patterns and standards described here

