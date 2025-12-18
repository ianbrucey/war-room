/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Progress } from '@arco-design/web-react';
import type { ProcessingStatus } from '@process/documents/types';

interface ProgressIndicatorProps {
  status: ProcessingStatus;
}

/**
 * Get progress percentage from processing status
 */
const getProgress = (status: ProcessingStatus): number => {
  switch (status) {
    case 'pending':
      return 10;
    case 'extracting':
      return 30;
    case 'analyzing':
      return 60;
    case 'indexing':
      return 85;
    case 'complete':
      return 100;
    case 'failed':
      return 0;
    default:
      return 0;
  }
};

/**
 * Get progress bar color from processing status
 */
const getProgressColor = (status: ProcessingStatus): string => {
  if (status === 'complete') return 'green';
  if (status === 'failed') return 'red';
  return 'blue';
};

/**
 * Progress indicator component for document processing
 * Maps processing status to visual progress bar
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ status }) => {
  const progress = getProgress(status);
  const color = getProgressColor(status);

  return <Progress percent={progress} status={status === 'failed' ? 'error' : undefined} color={color} size='small' />;
};
