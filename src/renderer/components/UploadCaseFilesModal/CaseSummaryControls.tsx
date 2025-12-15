/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Alert, Badge, Button, Divider, Progress, Space, Typography } from '@arco-design/web-react';
import { IconFile, IconPlus, IconRefresh } from '@arco-design/web-react/icon';
import React from 'react';

const { Text } = Typography;

interface CaseSummaryControlsProps {
  caseId: string;
  summaryStatus: 'generating' | 'generated' | 'stale' | 'failed' | null;
  summaryGeneratedAt: number | null;
  summaryVersion: number;
  summaryDocumentCount: number;
  currentDocumentCount: number; // total processed docs
  onGenerate: () => void;
  onUpdate: () => void;
  onRegenerate: () => void;
  onViewSummary: () => void;
  generationProgress?: {
    percent: number;
    currentBatch: number;
    totalBatches: number;
  };
}

/**
 * Get badge status and text for summary status
 */
const getStatusBadge = (status: 'generating' | 'generated' | 'stale' | 'failed' | null) => {
  switch (status) {
    case 'generating':
      return { status: 'processing' as const, text: 'Generating...' };
    case 'generated':
      return { status: 'success' as const, text: 'Generated' };
    case 'stale':
      return { status: 'warning' as const, text: 'Needs Update' };
    case 'failed':
      return { status: 'error' as const, text: 'Failed' };
    default:
      return { status: 'default' as const, text: 'Not Generated' };
  }
};

/**
 * Format timestamp to readable date
 */
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Case Summary Controls Component
 * Displays summary status and provides actions to generate/update/regenerate summaries
 */
export const CaseSummaryControls: React.FC<CaseSummaryControlsProps> = ({
  summaryStatus,
  summaryGeneratedAt,
  summaryVersion,
  summaryDocumentCount,
  currentDocumentCount,
  onGenerate,
  onUpdate,
  onRegenerate,
  onViewSummary,
  generationProgress,
}) => {
  const badge = getStatusBadge(summaryStatus);
  const newDocumentCount = currentDocumentCount - summaryDocumentCount;

  return (
    <div className="case-summary-controls">
      <Divider style={{ margin: '24px 0' }} />
      
      <div className="summary-header">
        <Text style={{ fontSize: 16, fontWeight: 600 }}>Case Summary</Text>
      </div>

      <div className="summary-content">
        <div className="summary-status-row">
          <Text>Status: </Text>
          <Badge status={badge.status} text={badge.text} />
        </div>

        {/* No Summary State */}
        {summaryStatus === null && (
          <>
            <Text type="secondary" style={{ display: 'block', margin: '12px 0' }}>
              No case summary has been generated yet. Generate a summary to create context for AI agents.
            </Text>
            <Button type="primary" icon={<IconRefresh />} onClick={onGenerate}>
              Generate Summary
            </Button>
          </>
        )}

        {/* Generating State */}
        {summaryStatus === 'generating' && generationProgress && (
          <>
            <Progress
              percent={generationProgress.percent}
              status="normal"
              style={{ margin: '12px 0' }}
            />
            <Text type="secondary">
              Processing batch {generationProgress.currentBatch} of {generationProgress.totalBatches}...
            </Text>
          </>
        )}

        {/* Generated State */}
        {summaryStatus === 'generated' && (
          <>
            <div className="summary-meta">
              <Text type="secondary">
                Last generated: {formatTimestamp(summaryGeneratedAt!)} (v{summaryVersion})
              </Text>
              <Text type="secondary">
                Documents included: {summaryDocumentCount}
              </Text>
            </div>
            <Space style={{ marginTop: 12 }}>
              <Button icon={<IconFile />} onClick={onViewSummary}>
                View Summary
              </Button>
              <Button icon={<IconRefresh />} onClick={onRegenerate}>
                Regenerate
              </Button>
            </Space>
          </>
        )}

        {/* Stale State */}
        {summaryStatus === 'stale' && (
          <>
            <div className="summary-meta">
              <Text type="secondary">
                Last generated: {formatTimestamp(summaryGeneratedAt!)} (v{summaryVersion})
              </Text>
              <Text type="secondary">
                Documents included: {summaryDocumentCount} of {currentDocumentCount} ({newDocumentCount} new)
              </Text>
            </div>
            <Alert
              type="warning"
              content="New documents have been added since last summary"
              style={{ margin: '12px 0' }}
            />
            <Space>
              <Button icon={<IconFile />} onClick={onViewSummary}>
                View
              </Button>
              <Button type="primary" icon={<IconPlus />} onClick={onUpdate}>
                Update Summary
              </Button>
              <Button icon={<IconRefresh />} onClick={onRegenerate}>
                Regenerate
              </Button>
            </Space>
          </>
        )}

        {/* Failed State */}
        {summaryStatus === 'failed' && (
          <>
            <Alert
              type="error"
              content="Summary generation failed. Please try again."
              style={{ margin: '12px 0' }}
            />
            <Button type="primary" status="danger" icon={<IconRefresh />} onClick={onGenerate}>
              Retry Generate
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

