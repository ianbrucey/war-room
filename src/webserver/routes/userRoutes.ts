/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthMiddleware } from '@/webserver/auth/middleware/AuthMiddleware';
import { UserRepository } from '@/webserver/auth/repository/UserRepository';
import { AuthService } from '@/webserver/auth/service/AuthService';
import { requireAdmin } from '@/webserver/middleware/rbacMiddleware';
import { apiRateLimiter, authenticatedActionLimiter } from '@/webserver/middleware/security';
import type { Express, Request, Response } from 'express';

export function registerUserRoutes(app: Express): void {
  /**
   * List all users
   * GET /api/users
   */
  app.get('/api/users', apiRateLimiter, AuthMiddleware.authenticateToken, requireAdmin, (req: Request, res: Response) => {
    try {
      const users = UserRepository.listUsers();

      // Don't send password hashes or JWT secrets
      const sanitized = users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        is_active: u.is_active,
        created_at: u.created_at,
        last_login: u.last_login,
      }));

      res.json({
        success: true,
        users: sanitized,
      });
    } catch (error) {
      console.error('List users error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * Create new user
   * POST /api/users
   */
  app.post('/api/users', apiRateLimiter, AuthMiddleware.authenticateToken, requireAdmin, authenticatedActionLimiter, async (req: Request, res: Response) => {
    try {
      const { username, email, role, password } = req.body;

      // Validate input
      if (!username || !role) {
        res.status(400).json({
          success: false,
          error: 'Username and role are required',
        });
        return;
      }

      // Validate role
      const validRoles = ['super_admin', 'admin', 'user'];
      if (!validRoles.includes(role)) {
        res.status(400).json({
          success: false,
          error: 'Invalid role',
        });
        return;
      }

      // Only super_admins can create super_admins
      if (role === 'super_admin' && req.user!.role !== 'super_admin') {
        res.status(403).json({
          success: false,
          error: 'Only super admins can create super admin users',
        });
        return;
      }

      // Validate username
      const usernameValidation = AuthService.validateUsername(username);
      if (!usernameValidation.isValid) {
        res.status(400).json({
          success: false,
          error: 'Invalid username',
          details: usernameValidation.errors,
        });
        return;
      }

      // Check if username already exists
      const existingUser = UserRepository.findByUsername(username);
      if (existingUser) {
        res.status(400).json({
          success: false,
          error: 'Username already exists',
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
          details: passwordValidation.errors,
        });
        return;
      }

      // Hash password
      const passwordHash = await AuthService.hashPassword(finalPassword);

      // Create user
      const user = UserRepository.create(username, email, passwordHash, role, req.user!.id);

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        // Only return password if it was generated
        ...(password ? {} : { generatedPassword: finalPassword }),
      });
    } catch (error: any) {
      console.error('Create user error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  });

  /**
   * Update user
   * PATCH /api/users/:id
   */
  app.patch('/api/users/:id', apiRateLimiter, AuthMiddleware.authenticateToken, requireAdmin, authenticatedActionLimiter, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email, is_active } = req.body;

      // Cannot modify yourself
      if (id === req.user!.id) {
        res.status(400).json({
          success: false,
          error: 'Cannot modify your own account',
        });
        return;
      }

      // Check if user exists
      const user = UserRepository.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      UserRepository.update(id, { email, is_active }, req.user!.id);

      res.json({
        success: true,
        message: 'User updated successfully',
      });
    } catch (error: any) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  });

  /**
   * Change user role
   * PATCH /api/users/:id/role
   */
  app.patch('/api/users/:id/role', apiRateLimiter, AuthMiddleware.authenticateToken, authenticatedActionLimiter, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      // Validate role
      const validRoles = ['super_admin', 'admin', 'user'];
      if (!validRoles.includes(role)) {
        res.status(400).json({
          success: false,
          error: 'Invalid role',
        });
        return;
      }

      // Only super_admins can change roles to super_admin
      if (role === 'super_admin' && req.user!.role !== 'super_admin') {
        res.status(403).json({
          success: false,
          error: 'Only super admins can grant super admin role',
        });
        return;
      }

      // Admins can only change to 'user' role
      if (req.user!.role === 'admin' && role !== 'user') {
        res.status(403).json({
          success: false,
          error: 'Admins can only change users to user role',
        });
        return;
      }

      // Cannot change your own role
      if (id === req.user!.id) {
        res.status(400).json({
          success: false,
          error: 'Cannot change your own role',
        });
        return;
      }

      // Check if user exists
      const user = UserRepository.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      UserRepository.updateRole(id, role);

      res.json({
        success: true,
        message: 'Role updated successfully',
      });
    } catch (error: any) {
      console.error('Update role error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  });

  /**
   * Deactivate user
   * DELETE /api/users/:id
   */
  app.delete('/api/users/:id', apiRateLimiter, AuthMiddleware.authenticateToken, requireAdmin, authenticatedActionLimiter, (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Cannot delete yourself
      if (id === req.user!.id) {
        res.status(400).json({
          success: false,
          error: 'Cannot delete your own account',
        });
        return;
      }

      // Check if user exists
      const user = UserRepository.findById(id);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      // Check if last super_admin
      if (user.role === 'super_admin') {
        const superAdmins = UserRepository.findByRole('super_admin');
        if (superAdmins.length === 1) {
          res.status(400).json({
            success: false,
            error: 'Cannot delete the last super admin',
          });
          return;
        }
      }

      // Soft delete (set is_active = 0)
      UserRepository.deactivate(id);

      res.json({
        success: true,
        message: 'User deactivated successfully',
      });
    } catch (error: any) {
      console.error('Deactivate user error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  });
}

export default registerUserRoutes;
