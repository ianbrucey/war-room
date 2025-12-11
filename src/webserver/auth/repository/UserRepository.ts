/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDatabase } from '@process/database/export';
import type { IQueryResult, IUser } from '@process/database/types';

/**
 * 认证用户类型，仅包含必要的认证字段
 * Authentication user type containing only essential auth fields
 */
export type AuthUser = Pick<IUser, 'id' | 'username' | 'email' | 'password_hash' | 'role' | 'is_active' | 'jwt_secret' | 'created_at' | 'updated_at' | 'last_login'>;


/**
 * 解包数据库查询结果，失败时抛出异常
 * Unwrap database query result, throw error on failure
 * @param result - 查询结果 / Query result
 * @param errorMessage - 错误消息 / Error message
 * @returns 解包后的数据 / Unwrapped data
 */
function unwrap<T>(result: IQueryResult<T>, errorMessage: string): T {
  if (!result.success || typeof result.data === 'undefined' || result.data === null) {
    throw new Error(result.error || errorMessage);
  }
  return result.data;
}

/**
 * 将数据库用户记录映射为认证用户对象
 * Map database user record to auth user object
 * @param row - 数据库用户记录 / Database user record
 * @returns 认证用户对象 / Auth user object
 */
function mapUser(row: IUser): AuthUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    password_hash: row.password_hash,
    role: row.role,
    is_active: row.is_active,
    jwt_secret: row.jwt_secret ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login: row.last_login ?? null,
  };
}

/**
 * 用户仓库 - 提供用户数据访问接口
 * User Repository - Provides user data access interface
 */
export const UserRepository = {
  /**
   * 检查系统中是否存在用户
   * Check if any users exist in the system
   * @returns 是否存在用户 / Whether users exist
   */
  hasUsers(): boolean {
    const db = getDatabase();
    const result = db.hasUsers();
    if (!result.success) {
      throw new Error(result.error || 'Failed to check users');
    }
    // 数据层已经过滤掉未设置密码的占位用户
    // Database layer already ignores placeholder rows without passwords
    return Boolean(result.data);
  },

  getSystemUser(): AuthUser | null {
    const db = getDatabase();
    const system = db.getSystemUser();
    if (!system) {
      return null;
    }
    return mapUser(system);
  },

  setSystemUserCredentials(username: string, passwordHash: string): void {
    const db = getDatabase();
    db.setSystemUserCredentials(username, passwordHash);
  },

  /**
   * 创建新用户
   * Create a new user
   * @param username - 用户名 / Username
   * @param passwordHash - 密码哈希 / Password hash
   * @returns 创建的用户 / Created user
   */
  createUser(username: string, passwordHash: string): AuthUser {
    const db = getDatabase();
    const result = db.createUser(username, undefined, passwordHash);
    const user = unwrap(result, 'Failed to create user');
    return mapUser(user);
  },

  /**
   * 根据用户名查找用户
   * Find user by username
   * @param username - 用户名 / Username
   * @returns 用户对象或 null / User object or null
   */
  findByUsername(username: string): AuthUser | null {
    const db = getDatabase();
    const result = db.getUserByUsername(username);
    if (!result.success || !result.data) {
      return null;
    }
    return mapUser(result.data);
  },

  /**
   * 根据用户 ID 查找用户
   * Find user by ID
   * @param id - 用户 ID / User ID
   * @returns 用户对象或 null / User object or null
   */
  findById(id: string): AuthUser | null {
    const db = getDatabase();
    const result = db.getUser(id);
    if (!result.success || !result.data) {
      return null;
    }
    return mapUser(result.data);
  },

  /**
   * 获取所有用户列表
   * Get list of all users
   * @returns 用户数组 / Array of users
   */
  listUsers(): AuthUser[] {
    const db = getDatabase();
    const result = db.getAllUsers();
    if (!result.success || !result.data) {
      return [];
    }
    return result.data.map(mapUser);
  },

  /**
   * 统计用户总数
   * Count total number of users
   * @returns 用户数量 / Number of users
   */
  countUsers(): number {
    const db = getDatabase();
    const result = db.getUserCount();
    if (!result.success) {
      throw new Error(result.error || 'Failed to count users');
    }
    return result.data ?? 0;
  },

  /**
   * 更新用户密码
   * Update user password
   * @param userId - 用户 ID / User ID
   * @param passwordHash - 新的密码哈希 / New password hash
   */
  updatePassword(userId: string, passwordHash: string): void {
    const db = getDatabase();
    const result = db.updateUserPassword(userId, passwordHash);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update user password');
    }
  },

  /**
   * 更新用户最后登录时间
   * Update user's last login time
   * @param userId - 用户 ID / User ID
   */
  updateLastLogin(userId: string): void {
    const db = getDatabase();
    const result = db.updateUserLastLogin(userId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update last login');
    }
  },

  /**
   * 更新用户的 JWT secret
   * Update user's JWT secret
   * @param userId - 用户 ID / User ID
   * @param jwtSecret - JWT secret 字符串 / JWT secret string
   */
  updateJwtSecret(userId: string, jwtSecret: string): void {
    const db = getDatabase();
    const result = db.updateUserJwtSecret(userId, jwtSecret);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update JWT secret');
    }
  },

  /**
   * 创建用户（支持角色）
   * Create user with role support
   * @param username - 用户名 / Username
   * @param email - 邮箱 / Email
   * @param passwordHash - 密码哈希 / Password hash
   * @param role - 用户角色 / User role
   * @param createdBy - 创建者ID / Creator ID
   * @returns 创建的用户 / Created user
   */
  create(username: string, email: string | undefined, passwordHash: string, role: string, createdBy?: string): AuthUser {
    const db = getDatabase();
    const result = db.createUser(username, email, passwordHash);
    const user = unwrap(result, 'Failed to create user');
    
    // Update role if not default 'user'
    if (role !== 'user') {
      db.exec('UPDATE users SET role = ?, created_by = ? WHERE id = ?', role, createdBy || null, user.id);
    } else if (createdBy) {
      db.exec('UPDATE users SET created_by = ? WHERE id = ?', createdBy, user.id);
    }
    
    // Fetch the updated user
    const updatedUser = this.findById(user.id);
    if (!updatedUser) {
      throw new Error('Failed to fetch created user');
    }
    
    return updatedUser;
  },

  /**
   * 更新用户信息
   * Update user information
   * @param userId - 用户 ID / User ID
   * @param updates - 更新的字段 / Fields to update
   * @param updatedBy - 更新者ID / Updater ID
   */
  update(userId: string, updates: { email?: string; is_active?: number }, updatedBy?: string): void {
    const db = getDatabase();
    const now = Date.now();
    
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email);
    }
    
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active);
    }
    
    if (updatedBy) {
      fields.push('updated_by = ?');
      values.push(updatedBy);
    }
    
    fields.push('updated_at = ?');
    values.push(now);
    
    values.push(userId);
    
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    db.exec(sql, ...values);
  },

  /**
   * 更新用户角色
   * Update user role
   * @param userId - 用户 ID / User ID
   * @param role - 新角色 / New role
   */
  updateRole(userId: string, role: string): void {
    const db = getDatabase();
    const now = Date.now();
    db.exec('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', role, now, userId);
  },

  /**
   * 停用用户（软删除）
   * Deactivate user (soft delete)
   * @param userId - 用户 ID / User ID
   */
  deactivate(userId: string): void {
    const db = getDatabase();
    const now = Date.now();
    db.exec('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?', now, userId);
  },

  /**
   * 根据角色查找用户
   * Find users by role
   * @param role - 用户角色 / User role
   * @returns 用户数组 / Array of users
   */
  findByRole(role: string): AuthUser[] {
    const db = getDatabase();
    const users = db.query('SELECT * FROM users WHERE role = ?', role) as IUser[];
    return users.map(mapUser);
  },
};

