# User Management System - Implementation Plan

## Overview
Add role-based user management to support multi-user legal firm deployments. Each firm runs their own isolated instance (separate database and infrastructure).

## Architecture Decisions

### ✅ Confirmed
- **Infrastructure-level multi-tenancy** (separate deployments per firm)
- **No tenant_id needed** (each DB = one firm)
- **Three roles:** `super_admin`, `admin`, `user`
- **CLI tool** for bootstrapping first user
- **Admin UI** for ongoing user management

### Role Permissions

| Permission | Super Admin | Admin | User |
|-----------|-------------|-------|------|
| Create users | ✅ | ✅ | ❌ |
| Edit users | ✅ | ✅ | ❌ |
| Delete users | ✅ | ✅ | ❌ |
| Change roles | ✅ (all roles) | ✅ (user only) | ❌ |
| View users | ✅ | ✅ | ❌ |
| Use AI agents | ✅ | ✅ | ✅ |

---

## Phase 1: Database Schema

### 1.1 Update `users` Table
**File:** `src/process/database/schema.ts`

Add columns:
```sql
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' 
  CHECK(role IN ('super_admin', 'admin', 'user'));
ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN created_by TEXT;
ALTER TABLE users ADD COLUMN updated_by TEXT;
```

### 1.2 Create Migration
**File:** `src/process/database/migrations.ts`

```typescript
const migration_v7: IMigration = {
  version: 7,
  name: 'Add user roles and management fields',
  up: (db) => {
    db.exec(`
      ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
      ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;
      ALTER TABLE users ADD COLUMN created_by TEXT;
      ALTER TABLE users ADD COLUMN updated_by TEXT;
      
      -- Set existing admin to super_admin
      UPDATE users SET role = 'super_admin' 
      WHERE username = 'admin' OR id = 'system_default_user';
    `);
  },
  down: (db) => {
    // SQLite doesn't support DROP COLUMN easily
    // Document manual rollback if needed
  }
};
```

### 1.3 Update TypeScript Types
**File:** `src/process/database/types.ts`

```typescript
export type UserRole = 'super_admin' | 'admin' | 'user';

export interface IUser {
  id: string;
  username: string;
  email?: string;
  password_hash: string;
  role: UserRole;  // NEW
  is_active: number;  // NEW (0 or 1)
  created_by?: string;  // NEW
  updated_by?: string;  // NEW
  avatar_path?: string;
  jwt_secret?: string | null;
  created_at: number;
  updated_at: number;
  last_login?: number | null;
}
```

---

## Phase 2: CLI Tool

### 2.1 Create User Management Script
**File:** `scripts/create-user.js`

```javascript
#!/usr/bin/env node
const { getDatabase } = require('../.webpack/main/process/database/export');
const { AuthService } = require('../.webpack/main/webserver/auth/service/AuthService');
const crypto = require('crypto');

async function createUser(options) {
  const db = getDatabase();
  
  // Validate role
  const validRoles = ['super_admin', 'admin', 'user'];
  if (!validRoles.includes(options.role)) {
    console.error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    process.exit(1);
  }
  
  // Generate password if not provided
  const password = options.password || AuthService.generateRandomPassword();
  const passwordHash = await AuthService.hashPassword(password);
  
  // Create user
  const result = db.createUser(
    options.username,
    options.email,
    passwordHash
  );
  
  if (!result.success) {
    console.error('Failed to create user:', result.error);
    process.exit(1);
  }
  
  // Update role
  db.db.prepare('UPDATE users SET role = ? WHERE id = ?')
    .run(options.role, result.data.id);
  
  console.log('\n✅ User created successfully!\n');
  console.log('━'.repeat(50));
  console.log(`Username: ${options.username}`);
  console.log(`Email:    ${options.email || 'N/A'}`);
  console.log(`Role:     ${options.role}`);
  console.log(`Password: ${password}`);
  console.log('━'.repeat(50));
  console.log('\n⚠️  Save these credentials securely!\n');
}

// Parse CLI arguments
const args = process.argv.slice(2);
const options = {
  username: args.find(a => a.startsWith('--username='))?.split('=')[1],
  email: args.find(a => a.startsWith('--email='))?.split('=')[1],
  role: args.find(a => a.startsWith('--role='))?.split('=')[1] || 'user',
  password: args.find(a => a.startsWith('--password='))?.split('=')[1]
};

if (!options.username) {
  console.error('Usage: npm run user:create -- --username=<name> [--email=<email>] [--role=<role>] [--password=<pass>]');
  process.exit(1);
}

createUser(options).catch(console.error);
```

### 2.2 Add NPM Script
**File:** `package.json`

```json
{
  "scripts": {
    "user:create": "node scripts/create-user.js",
    "user:list": "node scripts/list-users.js"
  }
}
```

### 2.3 Create List Users Script
**File:** `scripts/list-users.js`

```javascript
#!/usr/bin/env node
const { getDatabase } = require('../.webpack/main/process/database/export');

function listUsers() {
  const db = getDatabase();
  const result = db.getAllUsers();
  
  if (!result.success) {
    console.error('Failed to list users:', result.error);
    process.exit(1);
  }
  
  console.log('\n📋 Users:\n');
  console.log('━'.repeat(80));
  console.log('Username'.padEnd(20), 'Email'.padEnd(30), 'Role'.padEnd(15), 'Active');
  console.log('━'.repeat(80));
  
  result.data.forEach(user => {
    console.log(
      user.username.padEnd(20),
      (user.email || 'N/A').padEnd(30),
      user.role.padEnd(15),
      user.is_active ? '✅' : '❌'
    );
  });
  
  console.log('━'.repeat(80));
  console.log(`\nTotal: ${result.data.length} users\n`);
}

listUsers();
```

---

## Phase 3: RBAC Middleware

### 3.1 Create RBAC Middleware
**File:** `src/webserver/middleware/rbacMiddleware.ts`

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@/process/database/types';

/**
 * Require specific roles to access endpoint
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};

/**
 * Require admin or super_admin role
 */
export const requireAdmin = requireRole(['super_admin', 'admin']);

/**
 * Require super_admin role only
 */
export const requireSuperAdmin = requireRole(['super_admin']);
```

### 3.2 Update Express Types
**File:** `src/webserver/types/express.d.ts`

```typescript
import type { UserRole } from '@/process/database/types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: UserRole;  // ADD THIS
      };
    }
  }
}
```

---

## Phase 4: User Management API

### 4.1 Create User Management Routes
**File:** `src/webserver/routes/userRoutes.ts`

```typescript
import type { Express, Request, Response } from 'express';
import { AuthService } from '@/webserver/auth/service/AuthService';
import { UserRepository } from '@/webserver/auth/repository/UserRepository';
import { requireAdmin, requireSuperAdmin } from '@/webserver/middleware/rbacMiddleware';
import { AuthMiddleware } from '@/webserver/auth/middleware/AuthMiddleware';
import { apiRateLimiter } from '@/webserver/middleware/security';

export function registerUserRoutes(app: Express): void {
  
  /**
   * List all users
   * GET /api/users
   */
  app.get(
    '/api/users',
    apiRateLimiter,
    AuthMiddleware.authenticateToken,
    requireAdmin,
    (req: Request, res: Response) => {
      try {
        const users = UserRepository.findAll();
        
        // Don't send password hashes or JWT secrets
        const sanitized = users.map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          role: u.role,
          is_active: u.is_active,
          created_at: u.created_at,
          last_login: u.last_login
        }));
        
        res.json({
          success: true,
          users: sanitized
        });
      } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * Create new user
   * POST /api/users
   */
  app.post(
    '/api/users',
    apiRateLimiter,
    AuthMiddleware.authenticateToken,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { username, email, role, password } = req.body;
        
        // Validate input
        if (!username || !role) {
          res.status(400).json({
            success: false,
            error: 'Username and role are required'
          });
          return;
        }
        
        // Validate role
        const validRoles = ['super_admin', 'admin', 'user'];
        if (!validRoles.includes(role)) {
          res.status(400).json({
            success: false,
            error: 'Invalid role'
          });
          return;
        }
        
        // Only super_admins can create super_admins
        if (role === 'super_admin' && req.user!.role !== 'super_admin') {
          res.status(403).json({
            success: false,
            error: 'Only super admins can create super admin users'
          });
          return;
        }
        
        // Validate username
        const usernameValidation = AuthService.validateUsername(username);
        if (!usernameValidation.isValid) {
          res.status(400).json({
            success: false,
            error: 'Invalid username',
            details: usernameValidation.errors
          });
          return;
        }
        
        // Generate or validate password
        const finalPassword = password || AuthService.generateRandomPassword();
        const passwordValidation = AuthService.validatePasswordStrength(finalPassword);
        if (!passwordValidation.isValid) {
          res.status(400).json({
            success: false,
            error: 'Password does not meet requirements',
            details: passwordValidation.errors
          });
          return;
        }
        
        // Hash password
        const passwordHash = await AuthService.hashPassword(finalPassword);
        
        // Create user
        const result = UserRepository.create({
          username,
          email,
          password_hash: passwordHash,
          role,
          created_by: req.user!.id
        });
        
        if (!result.success) {
          res.status(400).json({
            success: false,
            error: result.error || 'Failed to create user'
          });
          return;
        }
        
        res.json({
          success: true,
          user: {
            id: result.data!.id,
            username: result.data!.username,
            email: result.data!.email,
            role: result.data!.role
          },
          // Only return password if it was generated
          ...(password ? {} : { generatedPassword: finalPassword })
        });
      } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * Update user
   * PATCH /api/users/:id
   */
  app.patch(
    '/api/users/:id',
    apiRateLimiter,
    AuthMiddleware.authenticateToken,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { email, is_active } = req.body;
        
        // Cannot modify yourself
        if (id === req.user!.id) {
          res.status(400).json({
            success: false,
            error: 'Cannot modify your own account'
          });
          return;
        }
        
        const result = UserRepository.update(id, {
          email,
          is_active,
          updated_by: req.user!.id
        });
        
        if (!result.success) {
          res.status(400).json({
            success: false,
            error: result.error || 'Failed to update user'
          });
          return;
        }
        
        res.json({
          success: true,
          message: 'User updated successfully'
        });
      } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * Change user role
   * PATCH /api/users/:id/role
   */
  app.patch(
    '/api/users/:id/role',
    apiRateLimiter,
    AuthMiddleware.authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const { role } = req.body;
        
        // Validate role
        const validRoles = ['super_admin', 'admin', 'user'];
        if (!validRoles.includes(role)) {
          res.status(400).json({
            success: false,
            error: 'Invalid role'
          });
          return;
        }
        
        // Only super_admins can change roles to super_admin
        if (role === 'super_admin' && req.user!.role !== 'super_admin') {
          res.status(403).json({
            success: false,
            error: 'Only super admins can grant super admin role'
          });
          return;
        }
        
        // Admins can only change to 'user' role
        if (req.user!.role === 'admin' && role !== 'user') {
          res.status(403).json({
            success: false,
            error: 'Admins can only change users to user role'
          });
          return;
        }
        
        // Cannot change your own role
        if (id === req.user!.id) {
          res.status(400).json({
            success: false,
            error: 'Cannot change your own role'
          });
          return;
        }
        
        const result = UserRepository.updateRole(id, role);
        
        if (!result.success) {
          res.status(400).json({
            success: false,
            error: result.error || 'Failed to update role'
          });
          return;
        }
        
        res.json({
          success: true,
          message: 'Role updated successfully'
        });
      } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * Deactivate user
   * DELETE /api/users/:id
   */
  app.delete(
    '/api/users/:id',
    apiRateLimiter,
    AuthMiddleware.authenticateToken,
    requireAdmin,
    (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        
        // Cannot delete yourself
        if (id === req.user!.id) {
          res.status(400).json({
            success: false,
            error: 'Cannot delete your own account'
          });
          return;
        }
        
        // Check if last super_admin
        const user = UserRepository.findById(id);
        if (user?.role === 'super_admin') {
          const superAdmins = UserRepository.findByRole('super_admin');
          if (superAdmins.length === 1) {
            res.status(400).json({
              success: false,
              error: 'Cannot delete the last super admin'
            });
            return;
          }
        }
        
        // Soft delete (set is_active = 0)
        const result = UserRepository.deactivate(id);
        
        if (!result.success) {
          res.status(400).json({
            success: false,
            error: result.error || 'Failed to deactivate user'
          });
          return;
        }
        
        res.json({
          success: true,
          message: 'User deactivated successfully'
        });
      } catch (error) {
        console.error('Deactivate user error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );
}

export default registerUserRoutes;
```

### 4.2 Update UserRepository
**File:** `src/webserver/auth/repository/UserRepository.ts`

Add methods:
```typescript
// Find all active users
findAll(): AuthUser[]

// Find users by role
findByRole(role: UserRole): AuthUser[]

// Create user with role
create(data: CreateUserData): IQueryResult<AuthUser>

// Update user
update(id: string, data: UpdateUserData): IQueryResult<boolean>

// Update role
updateRole(id: string, role: UserRole): IQueryResult<boolean>

// Deactivate user (soft delete)
deactivate(id: string): IQueryResult<boolean>
```

### 4.3 Register Routes
**File:** `src/webserver/index.ts`

```typescript
import registerUserRoutes from './routes/userRoutes';

// ... in startWebServer function
registerUserRoutes(app);
```

---

## Phase 5: Admin UI

### 5.1 Create User Management Page
**File:** `src/renderer/pages/admin/UserManagement.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Button, Table, Modal, Form, Input, Select, Message, Popconfirm } from '@arco-design/web-react';
import { IconPlus, IconEdit, IconDelete } from '@arco-design/web-react/icon';
import { ipcBridge } from '@/common';

interface User {
  id: string;
  username: string;
  email?: string;
  role: 'super_admin' | 'admin' | 'user';
  is_active: number;
  created_at: number;
  last_login?: number;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      Message.error('Failed to load users');
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
        body: JSON.stringify(values)
      });
      
      const data = await response.json();
      
      if (data.success) {
        Message.success('User created successfully');
        
        // Show generated password if applicable
        if (data.generatedPassword) {
          Modal.info({
            title: 'User Created',
            content: (
              <div>
                <p><strong>Username:</strong> {values.username}</p>
                <p><strong>Password:</strong> {data.generatedPassword}</p>
                <p style={{ color: 'red' }}>⚠️ Save this password! It won't be shown again.</p>
              </div>
            )
          });
        }
        
        setCreateModalVisible(false);
        form.resetFields();
        loadUsers();
      } else {
        Message.error(data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Create user error:', error);
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        Message.success('User deactivated');
        loadUsers();
      } else {
        Message.error(data.error || 'Failed to deactivate user');
      }
    } catch (error) {
      Message.error('Failed to deactivate user');
    }
  };

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username'
    },
    {
      title: 'Email',
      dataIndex: 'email',
      render: (email?: string) => email || 'N/A'
    },
    {
      title: 'Role',
      dataIndex: 'role',
      render: (role: string) => {
        const colors = {
          super_admin: 'red',
          admin: 'orange',
          user: 'blue'
        };
        return <span style={{ color: colors[role as keyof typeof colors] }}>{role}</span>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      render: (active: number) => active ? '✅ Active' : '❌ Inactive'
    },
    {
      title: 'Last Login',
      dataIndex: 'last_login',
      render: (timestamp?: number) => 
        timestamp ? new Date(timestamp).toLocaleString() : 'Never'
    },
    {
      title: 'Actions',
      render: (_: any, record: User) => (
        <div>
          <Popconfirm
            title="Are you sure you want to deactivate this user?"
            onOk={() => handleDeactivateUser(record.id)}
          >
            <Button type="text" status="danger" icon={<IconDelete />}>
              Deactivate
            </Button>
          </Popconfirm>
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>User Management</h2>
        <Button type="primary" icon={<IconPlus />} onClick={() => setCreateModalVisible(true)}>
          Create User
        </Button>
      </div>

      <Table
        columns={columns}
        data={users}
        loading={loading}
        rowKey="id"
      />

      <Modal
        title="Create New User"
        visible={createModalVisible}
        onOk={handleCreateUser}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Username" field="username" rules={[{ required: true }]}>
            <Input placeholder="Enter username" />
          </Form.Item>
          
          <Form.Item label="Email" field="email">
            <Input placeholder="Enter email (optional)" />
          </Form.Item>
          
          <Form.Item label="Role" field="role" rules={[{ required: true }]} initialValue="user">
            <Select>
              <Select.Option value="user">User</Select.Option>
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="super_admin">Super Admin</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item label="Password" field="password">
            <Input.Password placeholder="Leave empty to auto-generate" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

### 5.2 Add Route
**File:** `src/renderer/router.tsx`

```typescript
import UserManagement from './pages/admin/UserManagement';

// Add to routes
{
  path: '/admin/users',
  element: <UserManagement />
}
```

### 5.3 Add Navigation Link
**File:** `src/renderer/sider.tsx`

Add link to admin section (only visible to admins):

```typescript
{currentUser?.role === 'admin' || currentUser?.role === 'super_admin' ? (
  <Menu.Item key="admin-users">
    <Link to="/admin/users">User Management</Link>
  </Menu.Item>
) : null}
```

---

## Testing Plan

### Manual Testing Checklist

**CLI Tool:**
- [ ] Create super_admin user
- [ ] Create admin user
- [ ] Create regular user
- [ ] List all users
- [ ] Verify password generation

**API:**
- [ ] Login as super_admin
- [ ] Create user via API
- [ ] List users
- [ ] Update user
- [ ] Change user role
- [ ] Deactivate user
- [ ] Verify permissions (admin cannot create super_admin)

**UI:**
- [ ] Navigate to User Management
- [ ] View user list
- [ ] Create new user
- [ ] See generated password modal
- [ ] Deactivate user
- [ ] Verify role-based UI visibility

---

## Deployment Guide

### For New Firm Setup

```bash
# 1. Deploy infrastructure
npm run webui:remote

# 2. Create first super admin
npm run user:create -- \
  --username=admin \
  --email=admin@firm.com \
  --role=super_admin

# 3. Login with generated credentials
# Navigate to http://localhost:25808

# 4. Create additional users via UI
```

### Upgrading Existing Deployment

```bash
# 1. Stop server
# 2. Pull latest code
# 3. Run migrations (automatic on restart)
# 4. Restart server
npm run webui:remote

# 5. Existing admin user is auto-promoted to super_admin
```

---

## Security Considerations

1. **Password Requirements:**
   - Minimum 8 characters
   - Must include: uppercase, lowercase, number, special char
   - Auto-generated passwords meet all requirements

2. **Role Escalation Prevention:**
   - Admins cannot promote to super_admin
   - Users cannot change their own role
   - Cannot delete last super_admin

3. **Audit Trail:**
   - `created_by` and `updated_by` fields track who made changes
   - Consider adding audit log table in future

4. **Session Management:**
   - Deactivated users' tokens remain valid until expiry
   - Consider adding token revocation in future

---

## Future Enhancements

- [ ] Audit log table
- [ ] Token revocation on user deactivation
- [ ] Email notifications for new users
- [ ] Password reset flow
- [ ] Two-factor authentication
- [ ] User activity tracking
- [ ] Bulk user import (CSV)
- [ ] User groups/teams
