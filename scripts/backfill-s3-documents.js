#!/usr/bin/env node

/**
 * S3/MinIO Backfill Script for Existing Documents
 *
 * Uploads existing local documents to S3 and updates the database with S3 metadata.
 * Supports both AWS S3 and S3-compatible services (MinIO, Laravel Herd).
 *
 * Usage:
 *   node scripts/backfill-s3-documents.js [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be uploaded without actually uploading
 *
 * Environment variables:
 *   For AWS S3:
 *     - AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_DOCUMENTS_BUCKET
 *   For MinIO/Herd:
 *     - AWS_ENDPOINT, AWS_USE_PATH_STYLE_ENDPOINT=true, AWS_BUCKET
 */

const {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
} = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const os = require('os');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const BUCKET_NAME = process.env.AWS_BUCKET || process.env.S3_DOCUMENTS_BUCKET || 'justicequest-documents-dev';
const ENDPOINT = process.env.AWS_ENDPOINT;
const USE_PATH_STYLE = process.env.AWS_USE_PATH_STYLE_ENDPOINT === 'true';
const DRY_RUN = process.argv.includes('--dry-run');
const IS_MINIO = !!ENDPOINT;

// MIME type mapping
const CONTENT_TYPE_MAP = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
}

// Build S3 client configuration
const clientConfig = {
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

if (ENDPOINT) {
  clientConfig.endpoint = ENDPOINT;
  clientConfig.forcePathStyle = USE_PATH_STYLE;
}

const s3Client = new S3Client(clientConfig);

/**
 * Get the database path
 */
function getDatabasePath() {
  // Check common locations for the AionUI database
  const appName = 'AionUi';
  let dataDir;

  if (process.platform === 'darwin') {
    dataDir = path.join(os.homedir(), 'Library', 'Application Support', appName, 'aionui');
  } else if (process.platform === 'win32') {
    dataDir = path.join(process.env.APPDATA || os.homedir(), appName, 'aionui');
  } else {
    dataDir = path.join(os.homedir(), '.config', appName, 'aionui');
  }

  // Database is directly in the data directory (not in config subdirectory)
  return path.join(dataDir, 'aionui.db');
}

/**
 * Check if S3 bucket is accessible
 */
async function checkBucketAccess() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    return true;
  } catch (error) {
    console.error(`❌ Cannot access bucket ${BUCKET_NAME}:`, error.message);
    return false;
  }
}

/**
 * Upload a file to S3
 */
async function uploadToS3(filePath, s3Key, contentType) {
  const fileContent = fs.readFileSync(filePath);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileContent,
    ContentType: contentType,
    Metadata: {
      'uploaded-at': new Date().toISOString(),
      'backfill': 'true',
    },
  });

  const response = await s3Client.send(command);
  return {
    key: s3Key,
    versionId: response.VersionId,
    bucket: BUCKET_NAME,
  };
}

/**
 * Main backfill function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('📤 S3 Document Backfill Script');
  if (DRY_RUN) {
    console.log('   (DRY RUN - no actual uploads will be made)');
  }
  console.log('='.repeat(60));

  // Validate credentials
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('\n❌ Error: AWS credentials not found in environment variables');
    console.error('Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in .env');
    process.exit(1);
  }

  // Check bucket access
  console.log(`\n🔍 Checking bucket access: ${BUCKET_NAME}`);
  if (!(await checkBucketAccess())) {
    console.error('\n❌ Please run setup-s3-bucket.js first to create the bucket');
    process.exit(1);
  }
  console.log('✅ Bucket is accessible');

  // Open database
  const dbPath = getDatabasePath();
  console.log(`\n📁 Database path: ${dbPath}`);

  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database file not found. Have you run the application at least once?');
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: DRY_RUN });

  // Check if S3 columns exist
  const tableInfo = db.prepare('PRAGMA table_info(case_documents)').all();
  const hasS3Key = tableInfo.some((col) => col.name === 's3_key');

  if (!hasS3Key) {
    console.error('❌ S3 columns not found in database. Please run the app first to apply migration v12.');
    process.exit(1);
  }

  // Get documents without S3 key
  const documents = db.prepare(`
    SELECT 
      cd.id,
      cd.case_file_id,
      cd.filename,
      cd.folder_name,
      cd.s3_key,
      cf.workspace_path,
      cf.user_id
    FROM case_documents cd
    JOIN case_files cf ON cd.case_file_id = cf.id
    WHERE cd.s3_key IS NULL
    ORDER BY cd.uploaded_at DESC
  `).all();

  console.log(`\n📊 Found ${documents.length} documents to backfill\n`);

  if (documents.length === 0) {
    console.log('✅ No documents to backfill. All documents are already in S3.');
    process.exit(0);
  }

  // Prepare update statement
  const updateStmt = DRY_RUN ? null : db.prepare(`
    UPDATE case_documents
    SET s3_key = ?, s3_bucket = ?, s3_uploaded_at = ?, s3_version_id = ?, content_type = ?, file_size_bytes = ?
    WHERE id = ?
  `);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const doc of documents) {
    const docFolderPath = path.join(doc.workspace_path, 'documents', doc.folder_name);
    const originalFileName = `original${path.extname(doc.filename)}`;
    const filePath = path.join(docFolderPath, originalFileName);

    process.stdout.write(`  ${doc.filename}... `);

    // Check if local file exists
    if (!fs.existsSync(filePath)) {
      console.log('⚠️  SKIPPED (file not found)');
      skippedCount++;
      continue;
    }

    const contentType = getContentType(doc.filename);
    const fileSize = fs.statSync(filePath).size;
    const s3Key = `users/${doc.user_id}/cases/${doc.case_file_id}/documents/${doc.id}/${originalFileName}`;

    if (DRY_RUN) {
      console.log(`📋 WOULD UPLOAD to ${s3Key} (${(fileSize / 1024).toFixed(1)} KB)`);
      successCount++;
      continue;
    }

    try {
      const result = await uploadToS3(filePath, s3Key, contentType);

      // Update database
      updateStmt.run(
        result.key,
        result.bucket,
        Date.now(),
        result.versionId || null,
        contentType,
        fileSize,
        doc.id
      );

      console.log(`✅ Uploaded (${(fileSize / 1024).toFixed(1)} KB)`);
      successCount++;
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Backfill Summary');
  console.log('='.repeat(60));
  console.log(`  Total documents: ${documents.length}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Skipped: ${skippedCount}`);

  if (DRY_RUN) {
    console.log('\n💡 This was a dry run. Run without --dry-run to actually upload files.');
  }

  console.log('='.repeat(60));

  db.close();
}

main().catch((error) => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
