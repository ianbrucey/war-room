/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'os';
import path from 'path';

/**
 * Node.js-only constants
 * These constants use Node.js APIs and should ONLY be imported in main/process code
 * DO NOT import this file in renderer code
 */

// ===== 系统路径相关常量 =====
export const JUSTICE_QUEST_WORK_DIR = path.join(os.homedir(), '.justicequest');

