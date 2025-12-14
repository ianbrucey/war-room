#!/usr/bin/env node

/**
 * S3/MinIO Bucket Setup Script
 *
 * Creates the S3 bucket for document storage and configures CORS.
 * Supports both AWS S3 and S3-compatible services (MinIO, Laravel Herd).
 *
 * Usage:
 *   node scripts/setup-s3-bucket.js
 *
 * Environment variables:
 *   For AWS S3:
 *     - AWS_REGION
 *     - AWS_ACCESS_KEY_ID
 *     - AWS_SECRET_ACCESS_KEY
 *     - S3_DOCUMENTS_BUCKET
 *
 *   For MinIO/Herd:
 *     - AWS_ENDPOINT (e.g., https://minio.herd.test)
 *     - AWS_USE_PATH_STYLE_ENDPOINT=true
 *     - AWS_ACCESS_KEY_ID
 *     - AWS_SECRET_ACCESS_KEY
 *     - AWS_BUCKET
 */

const {
  S3Client,
  CreateBucketCommand,
  PutBucketCorsCommand,
  HeadBucketCommand,
  ListBucketsCommand,
} = require('@aws-sdk/client-s3');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const BUCKET_NAME = process.env.AWS_BUCKET || process.env.S3_DOCUMENTS_BUCKET || 'justicequest-documents-dev';
const ENDPOINT = process.env.AWS_ENDPOINT;
const USE_PATH_STYLE = process.env.AWS_USE_PATH_STYLE_ENDPOINT === 'true';

// Determine if we're using MinIO/Herd
const IS_MINIO = !!ENDPOINT;

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
 * Check if bucket exists
 */
async function bucketExists() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    // For MinIO, also check if it's a 403 (bucket exists but we need to verify)
    if (IS_MINIO && error.$metadata?.httpStatusCode === 403) {
      // Try listing buckets instead
      try {
        const list = await s3Client.send(new ListBucketsCommand({}));
        return list.Buckets?.some(b => b.Name === BUCKET_NAME) || false;
      } catch {
        return false;
      }
    }
    throw error;
  }
}

/**
 * Create the S3 bucket
 */
async function createBucket() {
  console.log(`\n📦 Creating bucket: ${BUCKET_NAME}`);

  // Check if bucket already exists
  try {
    if (await bucketExists()) {
      console.log(`✅ Bucket ${BUCKET_NAME} already exists`);
      return true;
    }
  } catch (error) {
    console.log(`⚠️  Could not check if bucket exists: ${error.message}`);
    console.log(`   Attempting to create anyway...`);
  }

  try {
    const createParams = {
      Bucket: BUCKET_NAME,
    };

    // Only add LocationConstraint for non-us-east-1 regions (and not for MinIO)
    if (!IS_MINIO && REGION !== 'us-east-1') {
      createParams.CreateBucketConfiguration = {
        LocationConstraint: REGION,
      };
    }

    await s3Client.send(new CreateBucketCommand(createParams));
    console.log(`✅ Created bucket: ${BUCKET_NAME}`);
    return true;
  } catch (error) {
    if (error.name === 'BucketAlreadyOwnedByYou' || error.name === 'BucketAlreadyExists') {
      console.log(`✅ Bucket ${BUCKET_NAME} already exists`);
      return true;
    }
    
    if (error.$metadata?.httpStatusCode === 403) {
      console.error(`\n❌ Permission denied (403 Forbidden)`);
      if (IS_MINIO) {
        console.error(`\nFor MinIO/Herd, check:`);
        console.error(`  1. The bucket might already exist - this is OK!`);
        console.error(`  2. Verify credentials in .env match your Herd MinIO setup`);
      } else {
        console.error(`\nFor AWS S3, check:`);
        console.error(`  1. The IAM user/role doesn't have s3:CreateBucket permission`);
        console.error(`  2. The bucket name might already be taken globally`);
      }
    } else {
      console.error(`❌ Failed to create bucket:`, error.message || error.name);
    }
    
    // For MinIO with Herd, the bucket might already exist which is fine
    if (IS_MINIO) {
      console.log(`\n💡 Note: With Laravel Herd, the default bucket 'herd-bucket' is pre-created.`);
      console.log(`   If you're using AWS_BUCKET=herd-bucket, you're good to go!`);
      return true;
    }
    return false;
  }
}

/**
 * Configure CORS for the bucket (optional for MinIO)
 */
async function configureCors() {
  console.log(`\n🌐 Configuring CORS...`);

  try {
    await s3Client.send(
      new PutBucketCorsCommand({
        Bucket: BUCKET_NAME,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ['*'],
              AllowedMethods: ['GET', 'HEAD', 'PUT'],
              AllowedHeaders: ['*'],
              ExposeHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
    console.log(`✅ CORS configured`);
    return true;
  } catch (error) {
    if (IS_MINIO) {
      console.log(`⚠️  CORS configuration skipped (not required for MinIO/Herd local development)`);
      return true;
    }
    console.error(`❌ Failed to configure CORS:`, error.message);
    return false;
  }
}

/**
 * Test connection by listing bucket contents
 */
async function testConnection() {
  console.log(`\n🔗 Testing connection...`);
  
  try {
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    await s3Client.send(new ListObjectsV2Command({ 
      Bucket: BUCKET_NAME,
      MaxKeys: 1
    }));
    console.log(`✅ Connection successful! Bucket is accessible.`);
    return true;
  } catch (error) {
    console.error(`❌ Connection test failed:`, error.message);
    return false;
  }
}

/**
 * Main setup function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('🚀 S3/MinIO Bucket Setup Script');
  console.log('='.repeat(60));
  
  console.log(`\nConfiguration:`);
  console.log(`  Mode: ${IS_MINIO ? 'MinIO/Laravel Herd' : 'AWS S3'}`);
  if (IS_MINIO) {
    console.log(`  Endpoint: ${ENDPOINT}`);
    console.log(`  Path Style: ${USE_PATH_STYLE}`);
  }
  console.log(`  Region: ${REGION}`);
  console.log(`  Bucket: ${BUCKET_NAME}`);
  console.log(`  Access Key ID: ${process.env.AWS_ACCESS_KEY_ID?.slice(0, 8)}...`);

  // Validate credentials
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('\n❌ Error: AWS credentials not found in environment variables');
    console.error('Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in .env');
    process.exit(1);
  }

  let success = true;

  // Step 1: Create bucket (or verify it exists)
  if (!(await createBucket())) {
    success = false;
  }

  // Step 2: Configure CORS (optional for MinIO)
  if (success) {
    await configureCors();
  }

  // Step 3: Test connection
  if (success) {
    success = await testConnection();
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (success) {
    console.log('✅ S3/MinIO bucket setup complete!');
    console.log(`\nBucket is ready for use: ${BUCKET_NAME}`);
    if (IS_MINIO) {
      console.log(`Endpoint: ${ENDPOINT}`);
    }
    console.log('\nNext steps:');
    console.log('  1. Start the application to test document uploads');
    console.log('  2. Optionally run the backfill script for existing documents:');
    console.log('     node scripts/backfill-s3-documents.js --dry-run');
  } else {
    console.log('❌ Setup encountered issues. Please check the errors above.');
    if (IS_MINIO) {
      console.log('\n💡 For Laravel Herd with MinIO:');
      console.log('   The default bucket "herd-bucket" should work out of the box.');
      console.log('   Make sure AWS_BUCKET=herd-bucket is set in your .env');
    }
    process.exit(1);
  }
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
