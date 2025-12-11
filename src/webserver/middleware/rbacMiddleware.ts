/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserRole } from '@/process/database/types';
import type { NextFunction, Request, Response } from 'express';

/**
 * Require specific roles to access endpoint
 * @param allowedRoles - Array of roles that are allowed to access the endpoint
 * @returns Express middleware function
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if user is authenticated
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Check if user has required role
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};

/**
 * Require admin or super_admin role
 * Convenience middleware for admin-only endpoints
 */
export const requireAdmin = requireRole(['super_admin', 'admin']);

/**
 * Require super_admin role only
 * Convenience middleware for super-admin-only endpoints
 */
export const requireSuperAdmin = requireRole(['super_admin']);
