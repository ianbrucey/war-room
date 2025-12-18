/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Radio } from '@arco-design/web-react';
import { IconClockCircle, IconFolder, IconPlus, IconRight } from '@arco-design/web-react/icon';
import React, { useState } from 'react';
import './mockup.css';

// Mock Data
const MOCK_CASES = [
  { id: '1', title: 'Investigation: Omega Red', case_number: 'CASE-2025-001', updated: '2 mins ago' },
  { id: '2', title: 'Audit: Project Blue Book', case_number: 'CASE-2024-892', updated: '4 hours ago' },
  { id: '3', title: 'Personnel Review: J. Doe', case_number: 'HR-2025-112', updated: '1 day ago' },
  { id: '4', title: 'Network Security Analysis', case_number: 'SEC-2025-044', updated: '3 days ago' },
];

export default function CaseSelectionMockup() {
  const [concept, setConcept] = useState<'A' | 'B'>('A');

  return (
    <div className='mockup-container'>
      <div className='mockup-switch'>
        <Radio.Group type='button' value={concept} onChange={setConcept} style={{ marginBottom: 20 }}>
          <Radio value='A'>Concept A: Dark & Modern</Radio>
          <Radio value='B'>Concept B: Clean & Professional</Radio>
        </Radio.Group>
        <p style={{ color: '#666' }}>
          Showing layout concept for Slash Cases page.
          <br />
          <i>Note: Functional logic is disabled in this mockup.</i>
        </p>
      </div>

      {concept === 'A' ? <ConceptA /> : <ConceptB />}
    </div>
  );
}

function ConceptA() {
  return (
    <div className='concept-a'>
      <div className='concept-a-header'>
        <img src='/en/JQ.png' alt='Logo' className='mockup-logo-img' />
        <h1 className='concept-a-title'>Welcome Back, Agent</h1>
        <p className='concept-a-subtitle'>Select an active case file to begin your session or initiate a new investigation.</p>
      </div>

      <div className='concept-a-grid'>
        {/* Create New Card */}
        <div className='concept-a-card create-new'>
          <IconPlus style={{ fontSize: 48, marginBottom: 16 }} />
          <h3>Initialize New Case</h3>
          <span style={{ fontSize: '0.9rem' }}>Start a fresh investigation</span>
        </div>

        {/* Existing Cases */}
        {MOCK_CASES.map((c) => (
          <div key={c.id} className='concept-a-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconFolder />
              </div>
              <IconRight style={{ opacity: 0.5 }} />
            </div>
            <h3>{c.title}</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', marginBottom: 16 }}>{c.case_number}</p>
            <div className='concept-a-meta'>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconClockCircle /> {c.updated}
              </span>
              <span style={{ color: '#4caf50' }}>Active</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConceptB() {
  return (
    <div className='concept-b'>
      <div className='concept-b-header'>
        <div className='concept-b-branding'>
          <img src='/en/JQ.png' alt='Logo' className='concept-b-logo-small' />
          <h2 className='concept-b-title'>Case Files</h2>
        </div>
        <button className='concept-b-btn'>+ New Case</button>
      </div>

      <div className='concept-b-list'>
        {MOCK_CASES.map((c) => (
          <div key={c.id} className='concept-b-item'>
            <div className='concept-b-item-main'>
              <div className='concept-b-icon-placeholder'>
                <IconFolder />
              </div>
              <div className='concept-b-item-info'>
                <h4>{c.title}</h4>
                <p>
                  {c.case_number} • Last updated {c.updated}
                </p>
              </div>
            </div>
            <IconRight className='concept-b-arrow' />
          </div>
        ))}
      </div>
    </div>
  );
}
