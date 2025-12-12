/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { withCsrfToken } from '@/webserver/middleware/csrfClient';
import { Button, Card, Empty, Form, Input, Modal, Spin } from '@arco-design/web-react';
import { IconPlus } from '@arco-design/web-react/icon';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface CaseFile {
  id: string;
  title: string;
  case_number?: string | null;
  user_id: string;
  created_at: number;
  updated_at: number;
}

interface ToastState {
  type: 'success' | 'error' | 'info' | null;
  message: string;
}

export default function CaseSelection() {
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [toast, setToast] = useState<ToastState>({ type: null, message: '' });
  const navigate = useNavigate();

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast.type) {
      const timer = setTimeout(() => setToast({ type: null, message: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
  };

  const loadCases = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cases', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setCases(data.cases);
      } else {
        showToast('error', data.error || 'Failed to load cases');
      }
    } catch (error) {
      showToast('error', 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const handleCreateCase = async () => {
    try {
      const values = await form.validate();
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(withCsrfToken(values)),
      });

      const data = await response.json();

      if (data.success) {
        showToast('success', 'Case created successfully');
        setCreateModalVisible(false);
        form.resetFields();
        await loadCases();
      } else {
        showToast('error', data.error || 'Failed to create case');
      }
    } catch (error) {
      showToast('error', 'Failed to create case');
    }
  };

  const handleSelectCase = (caseFileId: string) => {
    navigate(`/${caseFileId}/guid`);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toast.type && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: '4px',
            backgroundColor: toast.type === 'success' ? '#00b42a' : toast.type === 'error' ? '#f53f3f' : '#165dff',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Select a Case</h1>
        <Button type='primary' icon={<IconPlus />} onClick={() => setCreateModalVisible(true)}>
          Create New Case
        </Button>
      </div>

      <Spin loading={loading}>
        {cases.length === 0 ? (
          <Empty description='No cases found. Create your first case to get started.' />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {cases.map((caseFile) => (
              <Card
                key={caseFile.id}
                hoverable
                style={{ cursor: 'pointer' }}
                onClick={() => handleSelectCase(caseFile.id)}
              >
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{caseFile.title}</h3>
                  {caseFile.case_number && (
                    <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-3)', fontSize: '14px' }}>
                      Case #: {caseFile.case_number}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Spin>

      {/* Create Case Modal */}
      <Modal
        title='Create New Case'
        visible={createModalVisible}
        onOk={handleCreateCase}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        autoFocus={false}
        focusLock={true}
      >
        <Form form={form} layout='vertical'>
          <Form.Item
            label='Case Title'
            field='title'
            rules={[{ required: true, message: 'Please enter a case title' }]}
          >
            <Input placeholder='Enter case title' />
          </Form.Item>
          <Form.Item label='Case Number (Optional)' field='case_number'>
            <Input placeholder='Enter case number (optional)' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

