/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { withCsrfToken } from '@/webserver/middleware/csrfClient';
import { Form, Input, Modal, Pagination, Spin } from '@arco-design/web-react';
import { Search } from '@icon-park/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JQLogo from '../../../../public/en/JQ.png';

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

const CASES_PER_PAGE = 5;

// Helper function to format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Helper function to check if case is recently active (within 5 minutes)
function isRecentlyActive(timestamp: number): boolean {
  const now = Date.now();
  const diff = now - timestamp;
  return diff < 5 * 60 * 1000; // 5 minutes
}

export default function CaseSelection() {
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [toast, setToast] = useState<ToastState>({ type: null, message: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  // Filter cases based on search query
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const query = searchQuery.toLowerCase();
    return cases.filter((c) => c.title.toLowerCase().includes(query) || (c.case_number && c.case_number.toLowerCase().includes(query)));
  }, [cases, searchQuery]);

  // Paginate filtered cases
  const paginatedCases = useMemo(() => {
    const startIdx = (currentPage - 1) * CASES_PER_PAGE;
    return filteredCases.slice(startIdx, startIdx + CASES_PER_PAGE);
  }, [filteredCases, currentPage]);

  const totalPages = Math.ceil(filteredCases.length / CASES_PER_PAGE);

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
        console.log(
          '[CaseSelection] Loaded cases:',
          data.cases.map((c: CaseFile) => ({
            title: c.title,
            updated_at: c.updated_at,
            updated_date: new Date(c.updated_at).toISOString(),
          }))
        );
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
    void loadCases();
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

  const handleSelectCase = async (caseFileId: string) => {
    try {
      // Get conversations for this case
      const conversations = await ipcBridge.database.getConversationsByCase.invoke({
        caseFileId,
        page: 0,
        pageSize: 100,
      });

      if (conversations && conversations.length > 0) {
        // Sort by modifyTime to get the most recently active conversation
        const sorted = conversations.sort((a, b) => {
          const aTime = a.modifyTime || a.createTime;
          const bTime = b.modifyTime || b.createTime;
          return bTime - aTime;
        });
        // Navigate to the most recently active conversation
        Promise.resolve(navigate(`/${caseFileId}/conversation/${sorted[0].id}`)).catch((error) => {
          console.error('[CaseSelection] Navigation failed:', error);
        });
      } else {
        // No conversations yet - auto-create a default conversation with Auggie
        try {
          // Detect Auggie CLI path
          const cliResult = await ipcBridge.acpConversation.detectCliPath.invoke({ backend: 'auggie' });
          const cliPath = cliResult.success && cliResult.data?.path ? cliResult.data.path : 'augment';

          // ACP requires a model object but doesn't use it the same way as Gemini
          // Provide a minimal placeholder that satisfies TProviderWithModel
          const acpModel = {
            id: 'acp-auggie',
            platform: 'acp',
            name: 'Auggie',
            baseUrl: '',
            apiKey: '',
            useModel: 'haiku4.5',
          };

          const conversation = await ipcBridge.conversation.create.invoke({
            type: 'acp',
            name: 'New Conversation',
            model: acpModel,
            extra: {
              defaultFiles: [],
              workspace: '', // Will be populated by backend from case workspace
              backend: 'auggie',
              cliPath,
            },
            caseFileId,
          });

          if (!conversation || !conversation.id) {
            throw new Error('Failed to create conversation');
          }

          // Navigate directly to the new conversation
          Promise.resolve(navigate(`/${caseFileId}/conversation/${conversation.id}`)).catch((error) => {
            console.error('[CaseSelection] Navigation failed:', error);
          });
        } catch (createError) {
          console.error('[CaseSelection] Failed to auto-create conversation:', createError);
          // Fallback to guid page on error
          Promise.resolve(navigate(`/${caseFileId}/guid`)).catch((error) => {
            console.error('[CaseSelection] Navigation failed:', error);
          });
        }
      }
    } catch (error) {
      console.error('[CaseSelection] Failed to get conversations:', error);
      // Fallback to guid page on error
      Promise.resolve(navigate(`/${caseFileId}/guid`)).catch((navError) => {
        console.error('[CaseSelection] Navigation failed:', navError);
      });
    }
  };

  const handleSelectCaseWrapper = (caseFileId: string) => {
    void handleSelectCase(caseFileId);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
        padding: '60px 40px',
        position: 'relative',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Radial gradient accent */}
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(76, 175, 80, 0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Toast Notification */}
      {toast.type && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: '8px',
            backgroundColor: toast.type === 'success' ? '#00b42a' : toast.type === 'error' ? '#f53f3f' : '#165dff',
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={{ maxWidth: '1600px', margin: '0 auto', position: 'relative', zIndex: 1, width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <img src={JQLogo} alt='JusticeQuest' style={{ height: '60px', marginBottom: '20px' }} />
          <h1 style={{ margin: '0 0 8px 0', fontSize: '36px', fontWeight: 700, color: '#fff' }}>Welcome Back, Agent</h1>
          <p style={{ margin: 0, fontSize: '16px', color: 'rgba(255, 255, 255, 0.6)' }}>Select a case to continue or create a new one</p>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '40px', maxWidth: '500px', margin: '0 auto 40px' }}>
          <Input
            placeholder='Search cases by title or number...'
            prefix={<Search size='16' />}
            value={searchQuery}
            onChange={setSearchQuery}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: '#fff',
              backdropFilter: 'blur(10px)',
              height: '40px',
            }}
            onInput={(e) => {
              setSearchQuery((e.target as HTMLInputElement).value);
              setCurrentPage(1); // Reset to first page on search
            }}
          />
        </div>

        {/* Pagination Above Grid */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
            <Pagination current={currentPage} total={filteredCases.length} pageSize={CASES_PER_PAGE} onChange={setCurrentPage} style={{ color: '#fff' }} />
          </div>
        )}

        {/* Cases Grid */}
        <div style={{ width: '100%', overflowY: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
          <Spin loading={loading} style={{ display: 'block', width: '100%' }}>
            {filteredCases.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: 'rgba(255, 255, 255, 0.6)',
                }}
              >
                <p style={{ fontSize: '16px', margin: 0 }}>{cases.length === 0 ? 'No cases found. Create your first case to get started.' : 'No cases match your search. Try a different query.'}</p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '24px',
                    marginBottom: '40px',
                    width: '100%',
                  }}
                >
                  {/* Create New Case Card */}
                  <div
                    onClick={() => setCreateModalVisible(true)}
                    style={{
                      background: 'transparent',
                      backdropFilter: 'blur(16px)',
                      border: '2px dashed rgba(255, 255, 255, 0.2)',
                      borderRadius: '20px',
                      padding: '32px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '240px',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      color: 'rgba(255, 255, 255, 0.6)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(76, 175, 80, 0.05)';
                      (e.currentTarget as HTMLElement).style.borderColor = '#4caf50';
                      (e.currentTarget as HTMLElement).style.color = '#4caf50';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      (e.currentTarget as HTMLElement).style.color = 'rgba(255, 255, 255, 0.6)';
                    }}
                  >
                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>+</div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600 }}>Initialize New Case</h3>
                    <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>Start a fresh investigation</span>
                  </div>

                  {/* Case Cards */}
                  {paginatedCases.map((caseFile) => (
                    <div
                      key={caseFile.id}
                      onClick={() => handleSelectCaseWrapper(caseFile.id)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '20px',
                        padding: '24px',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        color: '#fff',
                        minHeight: '200px',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.08)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-8px)';
                        (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 40px rgba(0,0,0,0.2)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.03)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.08)';
                      }}
                    >
                      {/* Folder Icon */}
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '14px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '24px',
                          fontSize: '24px',
                        }}
                      >
                        📂
                      </div>

                      {/* Case Title */}
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600, lineHeight: '1.3' }}>{caseFile.title}</h3>

                      {/* Case Number */}
                      <p style={{ margin: '0', color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.875rem' }}>{caseFile.case_number || 'No case number'}</p>

                      {/* Spacer */}
                      <div style={{ flex: 1 }} />

                      {/* Meta Footer */}
                      <div
                        style={{
                          marginTop: 'auto',
                          paddingTop: '24px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.875rem',
                          color: 'rgba(255, 255, 255, 0.5)',
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <span>🕒 {formatRelativeTime(caseFile.updated_at)}</span>
                        {isRecentlyActive(caseFile.updated_at) && (
                          <span
                            style={{
                              background: 'rgba(76, 175, 80, 0.2)',
                              color: '#81c784',
                              padding: '4px 12px',
                              borderRadius: '100px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Spin>
        </div>
      </div>

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
          <Form.Item label='Case Title' field='title' rules={[{ required: true, message: 'Please enter a case title' }]}>
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
