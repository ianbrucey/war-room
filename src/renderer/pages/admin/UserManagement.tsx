/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { withCsrfToken } from '@/webserver/middleware/csrfClient';
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Table } from '@arco-design/web-react';
import { IconDelete, IconEdit, IconPlus } from '@arco-design/web-react/icon';
import React, { useEffect, useState } from 'react';

interface User {
  id: string;
  username: string;
  email?: string;
  role: 'super_admin' | 'admin' | 'user';
  is_active: number;
  created_at: number;
  last_login?: number;
}

// Toast notification state type
interface ToastState {
  type: 'success' | 'error' | 'info' | null;
  message: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [toast, setToast] = useState<ToastState>({ type: null, message: '' });

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

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        showToast('error', data.error || 'Failed to load users');
      }
    } catch (error) {
      showToast('error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async () => {
    try {
      const values = await form.validate();
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(withCsrfToken(values)),
      });

      const data = await response.json();

      if (data.success) {
        showToast('success', 'User created successfully');

        // Show generated password if applicable
        if (data.generatedPassword) {
          Modal.info({
            title: 'User Created',
            content: (
              <div>
                <p>
                  <strong>Username:</strong> {values.username}
                </p>
                <p>
                  <strong>Password:</strong> <code>{data.generatedPassword}</code>
                </p>
                <p style={{ color: 'var(--color-danger-6)', marginTop: 12 }}>⚠️ Save this password! It won't be shown again.</p>
              </div>
            ),
          });
        }

        setCreateModalVisible(false);
        form.resetFields();
        loadUsers();
      } else {
        showToast('error', data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Create user error:', error);
    }
  };

  const handleEditUser = async () => {
    try {
      const values = await editForm.validate();
      const response = await fetch(`/api/users/${selectedUser!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(withCsrfToken(values)),
      });

      const data = await response.json();

      if (data.success) {
        showToast('success', 'User updated successfully');
        setEditModalVisible(false);
        setSelectedUser(null);
        editForm.resetFields();
        loadUsers();
      } else {
        showToast('error', data.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Update user error:', error);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(withCsrfToken({ role: newRole })),
      });

      const data = await response.json();

      if (data.success) {
        showToast('success', 'Role updated successfully');
        loadUsers();
      } else {
        showToast('error', data.error || 'Failed to update role');
      }
    } catch (error) {
      showToast('error', 'Failed to update role');
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(withCsrfToken({})),
      });

      const data = await response.json();

      if (data.success) {
        showToast('success', 'User deactivated');
        loadUsers();
      } else {
        showToast('error', data.error || 'Failed to deactivate user');
      }
    } catch (error) {
      showToast('error', 'Failed to deactivate user');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    editForm.setFieldsValue({
      email: user.email,
      is_active: user.is_active,
    });
    setEditModalVisible(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'red';
      case 'admin':
        return 'orange';
      default:
        return 'blue';
    }
  };

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      width: 150,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      width: 200,
      render: (email?: string) => email || <span style={{ color: 'var(--color-text-3)' }}>N/A</span>,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      width: 150,
      render: (role: string, record: User) => (
        <Select size='small' value={role} onChange={(value) => handleChangeRole(record.id, value)} style={{ width: 120 }}>
          <Select.Option value='user'>User</Select.Option>
          <Select.Option value='admin'>Admin</Select.Option>
          <Select.Option value='super_admin'>Super Admin</Select.Option>
        </Select>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      width: 100,
      render: (active: number) => (active ? <span style={{ color: 'var(--color-success-6)' }}>✅ Active</span> : <span style={{ color: 'var(--color-danger-6)' }}>❌ Inactive</span>),
    },
    {
      title: 'Last Login',
      dataIndex: 'last_login',
      width: 180,
      render: (timestamp?: number) => (timestamp ? new Date(timestamp).toLocaleString() : <span style={{ color: 'var(--color-text-3)' }}>Never</span>),
    },
    {
      title: 'Actions',
      width: 200,
      render: (_: any, record: User) => (
        <Space>
          <Button type='text' size='small' icon={<IconEdit />} onClick={() => openEditModal(record)}>
            Edit
          </Button>
          <Popconfirm title='Are you sure you want to deactivate this user?' onOk={() => handleDeactivateUser(record.id)}>
            <Button type='text' status='danger' size='small' icon={<IconDelete />}>
              Deactivate
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Toast Notification */}
      {toast.type && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 1000,
            padding: '12px 20px',
            borderRadius: 8,
            backgroundColor: toast.type === 'success' ? 'var(--color-success-6)' : toast.type === 'error' ? 'var(--color-danger-6)' : 'var(--color-primary-6)',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>User Management</h2>
          <p style={{ color: 'var(--color-text-3)', marginTop: 4 }}>Manage users and their roles</p>
        </div>
        <Button type='primary' icon={<IconPlus />} onClick={() => setCreateModalVisible(true)}>
          Create User
        </Button>
      </div>

      <Table columns={columns} data={users} loading={loading} rowKey='id' pagination={{ pageSize: 10 }} />

      {/* Create User Modal */}
      <Modal
        title='Create New User'
        visible={createModalVisible}
        onOk={handleCreateUser}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        autoFocus={false}
        focusLock={true}
      >
        <Form form={form} layout='vertical' autoComplete='off'>
          <Form.Item label='Username' field='username' rules={[{ required: true, message: 'Username is required' }]}>
            <Input placeholder='Enter username' />
          </Form.Item>

          <Form.Item label='Email' field='email'>
            <Input placeholder='Enter email (optional)' type='email' />
          </Form.Item>

          <Form.Item label='Role' field='role' rules={[{ required: true, message: 'Role is required' }]} initialValue='user'>
            <Select placeholder='Select role'>
              <Select.Option value='user'>User</Select.Option>
              <Select.Option value='admin'>Admin</Select.Option>
              <Select.Option value='super_admin'>Super Admin</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label='Password' field='password' extra='Leave empty to auto-generate a secure password'>
            <Input.Password placeholder='Leave empty to auto-generate' />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        title='Edit User'
        visible={editModalVisible}
        onOk={handleEditUser}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedUser(null);
          editForm.resetFields();
        }}
        autoFocus={false}
        focusLock={true}
      >
        <Form form={editForm} layout='vertical' autoComplete='off'>
          <Form.Item label='Email' field='email'>
            <Input placeholder='Enter email' type='email' />
          </Form.Item>

          <Form.Item label='Status' field='is_active' initialValue={1}>
            <Select>
              <Select.Option value={1}>Active</Select.Option>
              <Select.Option value={0}>Inactive</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
