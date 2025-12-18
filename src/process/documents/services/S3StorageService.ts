/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';

/**
 * S3 Storage Service
 *
 * Provides file storage operations against Amazon S3 or S3-compatible services (MinIO, Laravel Herd).
 * S3 is the source of truth for all uploaded documents.
 * Local filesystem is used as a cache for processing.
 *
 * Supports custom endpoints for MinIO/Herd via:
 *   - AWS_ENDPOINT: Custom S3 endpoint URL
 *   - AWS_USE_PATH_STYLE_ENDPOINT: Use path-style addressing (required for MinIO)
 *   - AWS_BUCKET or S3_DOCUMENTS_BUCKET: Bucket name
 */
export class S3StorageService {
  private client: S3Client;
  private bucket: string;
  private endpoint?: string;

  constructor() {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
    const endpoint = process.env.AWS_ENDPOINT;
    const forcePathStyle = process.env.AWS_USE_PATH_STYLE_ENDPOINT === 'true';
    const disableSslVerification = process.env.AWS_DISABLE_SSL_VERIFICATION === 'true';

    // Build client configuration
    const clientConfig: {
      region: string;
      credentials: { accessKeyId: string; secretAccessKey: string };
      endpoint?: string;
      forcePathStyle?: boolean;
      requestHandler?: any;
    } = {
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    };

    // Add custom endpoint for MinIO/Herd
    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = forcePathStyle;
      console.log(`[S3Storage] Using custom endpoint: ${endpoint} (path-style: ${forcePathStyle})`);
    }

    // Disable SSL verification for local development (MinIO/Herd with self-signed certs)
    if (disableSslVerification) {
      const { NodeHttpHandler } = require('@smithy/node-http-handler');
      const { Agent } = require('https');

      clientConfig.requestHandler = new NodeHttpHandler({
        httpsAgent: new Agent({
          rejectUnauthorized: false,
        }),
      });
      console.log(`[S3Storage] SSL verification disabled (for local development only)`);
    }

    this.client = new S3Client(clientConfig);
    // Support both AWS_BUCKET (Herd/MinIO) and S3_DOCUMENTS_BUCKET env vars
    this.bucket = process.env.AWS_BUCKET || process.env.S3_DOCUMENTS_BUCKET || 'justicequest-documents-dev';
    this.endpoint = endpoint;

    console.log(`[S3Storage] Initialized with bucket: ${this.bucket}`);
  }

  /**
   * Get the bucket name
   */
  getBucket(): string {
    return this.bucket;
  }

  /**
   * Generate S3 key for a document
   *
   * @param userId - User ID
   * @param caseFileId - Case file ID
   * @param documentId - Document ID
   * @param filename - Filename (e.g., 'original.pdf')
   * @returns S3 key in format: users/{userId}/cases/{caseFileId}/documents/{documentId}/{filename}
   */
  generateKey(userId: string, caseFileId: string, documentId: string, filename: string): string {
    return `users/${userId}/cases/${caseFileId}/documents/${documentId}/${filename}`;
  }

  /**
   * Upload a file to S3
   *
   * @param filePath - Local file path to upload
   * @param s3Key - S3 object key
   * @param contentType - MIME type
   * @returns Upload result with key, versionId, and bucket
   */
  async uploadFile(filePath: string, s3Key: string, contentType: string): Promise<{ key: string; versionId?: string; bucket: string }> {
    const fileContent = await fs.readFile(filePath);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
      Metadata: {
        'uploaded-at': new Date().toISOString(),
        'original-filename': path.basename(filePath),
      },
    });

    const response = await this.client.send(command);

    console.log(`[S3Storage] Uploaded file to s3://${this.bucket}/${s3Key}`);

    return {
      key: s3Key,
      versionId: response.VersionId,
      bucket: this.bucket,
    };
  }

  /**
   * Upload buffer content directly to S3
   *
   * @param content - Buffer or string content
   * @param s3Key - S3 object key
   * @param contentType - MIME type
   * @returns Upload result
   */
  async uploadContent(content: Buffer | string, s3Key: string, contentType: string): Promise<{ key: string; versionId?: string; bucket: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: typeof content === 'string' ? Buffer.from(content, 'utf-8') : content,
      ContentType: contentType,
      Metadata: {
        'uploaded-at': new Date().toISOString(),
      },
    });

    const response = await this.client.send(command);

    console.log(`[S3Storage] Uploaded content to s3://${this.bucket}/${s3Key}`);

    return {
      key: s3Key,
      versionId: response.VersionId,
      bucket: this.bucket,
    };
  }

  /**
   * Download a file from S3 to local cache
   *
   * @param s3Key - S3 object key
   * @param localPath - Local file path to save to
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
      console.log(`[S3Storage] Downloaded s3://${this.bucket}/${s3Key} to ${localPath}`);
    }
  }

  /**
   * Generate a pre-signed URL for download/preview
   *
   * @param s3Key - S3 object key
   * @param expiresInSeconds - URL expiration time (default 1 hour)
   * @param options - Optional response content disposition and type
   * @returns Pre-signed URL
   */
  async getPresignedUrl(
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

    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    console.log(`[S3Storage] Generated pre-signed URL for s3://${this.bucket}/${s3Key} (expires in ${expiresInSeconds}s)`);

    return url;
  }

  /**
   * Check if a file exists in S3
   *
   * @param s3Key - S3 object key
   * @returns True if file exists
   */
  async exists(s3Key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });
      await this.client.send(command);
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata from S3
   *
   * @param s3Key - S3 object key
   * @returns File size and content type
   */
  async getMetadata(s3Key: string): Promise<{ size: number; contentType: string } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });
      const response = await this.client.send(command);
      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a file from S3
   *
   * @param s3Key - S3 object key
   */
  async deleteFile(s3Key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });
    await this.client.send(command);
    console.log(`[S3Storage] Deleted s3://${this.bucket}/${s3Key}`);
  }

  /**
   * Delete all files for a document (entire prefix)
   *
   * @param userId - User ID
   * @param caseFileId - Case file ID
   * @param documentId - Document ID
   */
  async deleteDocument(userId: string, caseFileId: string, documentId: string): Promise<void> {
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
          Objects: listResponse.Contents.map((obj) => ({ Key: obj.Key })),
        },
      });

      await this.client.send(deleteCommand);
      console.log(`[S3Storage] Deleted ${listResponse.Contents.length} files with prefix: ${prefix}`);
    } else {
      console.log(`[S3Storage] No files found with prefix: ${prefix}`);
    }
  }

  /**
   * Delete all files for a case (entire case prefix)
   *
   * @param userId - User ID
   * @param caseFileId - Case file ID
   */
  async deleteCase(userId: string, caseFileId: string): Promise<void> {
    const prefix = `users/${userId}/cases/${caseFileId}/`;

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
          Objects: listResponse.Contents.map((obj) => ({ Key: obj.Key })),
        },
      });

      await this.client.send(deleteCommand);
      console.log(`[S3Storage] Deleted ${listResponse.Contents.length} files for case: ${caseFileId}`);
    }
  }
}

// Singleton instance for convenience
let s3StorageInstance: S3StorageService | null = null;

/**
 * Get the singleton S3StorageService instance
 */
export function getS3StorageService(): S3StorageService {
  if (!s3StorageInstance) {
    s3StorageInstance = new S3StorageService();
  }
  return s3StorageInstance;
}
