/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { emitter, useAddEventListener } from '@/renderer/utils/emitter';
import { Button, Card, Spin } from '@arco-design/web-react';
import { CheckOne, CloseSmall } from '@icon-park/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './styles.css';

interface CaseGroundingCardProps {
  caseFileId: string;
  onStartNarrative: () => void;
  onUploadDocuments: () => void;
  onGenerateSummary: () => void;
  onDismiss: () => void;
}

interface GroundingStatus {
  narrativeExists: boolean;
  narrativeUpdatedAt: number | null;
  documentCount: number;
  summaryStatus: string | null;
  summaryGeneratedAt: number | null;
  isStale: boolean;
  groundingStatus: string;
}

export const CaseGroundingCard: React.FC<CaseGroundingCardProps> = ({ caseFileId, onStartNarrative, onUploadDocuments, onGenerateSummary, onDismiss }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<GroundingStatus | null>(null);
  const [isSummaryGenerating, setIsSummaryGenerating] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const loadStatus = useCallback(
    async (showLoadingSpinner = true) => {
      try {
        if (showLoadingSpinner) setLoading(true);
        const response = await ipcBridge.caseGrounding.getGroundingStatus.invoke({ caseFileId });

        if (response.success && response.data) {
          setStatus(response.data);
          setIsSummaryGenerating(response.data.summaryStatus === 'generating');
        } else {
          console.error('[CaseGroundingCard] Failed to load status:', response.msg || 'Unknown error');
        }
      } catch (error) {
        console.error('[CaseGroundingCard] Error loading status:', error);
      } finally {
        if (showLoadingSpinner) setLoading(false);
      }
    },
    [caseFileId]
  );

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Poll for status when generating (to update spinner state)
  useEffect(() => {
    if (isSummaryGenerating && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        void loadStatus(false);
      }, 3000);
    }

    if (!isSummaryGenerating && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isSummaryGenerating, loadStatus]);

  // Listen for grounding status refresh events
  useAddEventListener('case.grounding.status.refresh', () => void loadStatus(false), [loadStatus]);

  // Refresh status when modal actions complete
  const handleUploadDocuments = useCallback(() => {
    onUploadDocuments();
    // Refresh after a delay to allow backend to update
    setTimeout(() => {
      void loadStatus(false);
      emitter.emit('case.grounding.status.refresh');
    }, 500);
  }, [onUploadDocuments, loadStatus]);

  const handleGenerateSummary = useCallback(() => {
    setIsSummaryGenerating(true);
    onGenerateSummary();
  }, [onGenerateSummary]);

  if (loading) {
    return (
      <div className='case-grounding-card-loading'>
        <Spin size={24} />
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const narrativeComplete = status.narrativeExists;
  const documentsComplete = status.documentCount > 0;
  const summaryComplete = status.summaryStatus === 'generated' && !status.isStale;
  const summaryStale = status.summaryStatus === 'generated' && status.isStale;
  const summaryDisabled = !narrativeComplete && !documentsComplete;

  return (
    <Card
      className='case-grounding-card'
      title={
        <div className='case-grounding-card-header'>
          <span className='case-grounding-card-title'>
            ☑️ {t('caseGrounding.title', 'Ground Your Case')}
            {isSummaryGenerating && <Spin size={16} style={{ marginLeft: 8 }} />}
          </span>
          <Button
            type='text'
            size='small'
            icon={<CloseSmall />}
            onClick={() => {
              onDismiss();
            }}
            className='case-grounding-card-dismiss'
          />
        </div>
      }
      bordered={false}
    >
      <div className='case-grounding-card-body'>
        <p className='case-grounding-card-description'>{t('caseGrounding.description', 'Help me understand your case better by completing these steps. You can skip any step and come back later.')}</p>

        {/* Step 1: Tell Your Story */}
        <div className={`grounding-step ${narrativeComplete ? 'complete' : ''}`}>
          <div className='grounding-step-header'>
            <div className='grounding-step-icon'>{narrativeComplete ? <CheckOne theme='filled' size='20' fill='#00b42a' /> : <span className='grounding-step-circle'>○</span>}</div>
            <div className='grounding-step-content'>
              <div className='grounding-step-title'>{t('caseGrounding.step1.title', '1. Tell Your Story')}</div>
              <div className='grounding-step-subtitle'>{t('caseGrounding.step1.subtitle', 'Share what happened in your own words')}</div>
            </div>
            <Button type='primary' size='small' onClick={onStartNarrative}>
              {narrativeComplete ? t('caseGrounding.step1.edit', 'Edit') : t('caseGrounding.step1.start', 'Start →')}
            </Button>
          </div>
        </div>

        {/* Step 2: Upload Evidence */}
        <div className={`grounding-step ${documentsComplete ? 'complete' : ''}`}>
          <div className='grounding-step-header'>
            <div className='grounding-step-icon'>{documentsComplete ? <CheckOne theme='filled' size='20' fill='#00b42a' /> : <span className='grounding-step-circle'>○</span>}</div>
            <div className='grounding-step-content'>
              <div className='grounding-step-title'>{t('caseGrounding.step2.title', '2. Upload Evidence')}</div>
              <div className='grounding-step-subtitle'>{documentsComplete ? t('caseGrounding.step2.count', '{{count}} documents uploaded', { count: status.documentCount }) : t('caseGrounding.step2.subtitle', 'Upload your case documents')}</div>
            </div>
            <Button type='primary' size='small' onClick={handleUploadDocuments}>
              {documentsComplete ? t('caseGrounding.step2.addMore', 'Add More') : t('caseGrounding.step2.upload', 'Upload')}
            </Button>
          </div>
        </div>

        {/* Step 3: Generate Summary */}
        <div className={`grounding-step ${summaryComplete ? 'complete' : ''} ${summaryDisabled || isSummaryGenerating ? 'disabled' : ''}`}>
          <div className='grounding-step-header'>
            <div className='grounding-step-icon'>
              {isSummaryGenerating ? (
                <Spin size={20} />
              ) : summaryComplete ? (
                <CheckOne theme='filled' size='20' fill='#00b42a' />
              ) : (
                <span className='grounding-step-circle'>○</span>
              )}
            </div>
            <div className='grounding-step-content'>
              <div className='grounding-step-title'>
                {t('caseGrounding.step3.title', '3. Generate Summary')}
                {summaryStale && !isSummaryGenerating && <span className='grounding-step-stale'>⚠️ {t('caseGrounding.step3.stale', 'Stale')}</span>}
              </div>
              <div className='grounding-step-subtitle'>
                {isSummaryGenerating
                  ? t('caseGrounding.step3.generating', 'Generating summary...')
                  : summaryComplete
                    ? t('caseGrounding.step3.complete', 'Case summary generated')
                    : t('caseGrounding.step3.subtitle', 'Let AI synthesize your case')}
              </div>
            </div>
            <Button type='primary' size='small' onClick={handleGenerateSummary} disabled={summaryDisabled || isSummaryGenerating} loading={isSummaryGenerating}>
              {summaryComplete || summaryStale ? t('caseGrounding.step3.regenerate', 'Regenerate') : t('caseGrounding.step3.generate', 'Generate')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
