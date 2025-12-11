# WebUI Authentication

## Overview

AionUi WebUI uses a JWT-based authentication system with secure cookies and comprehensive security measures.

## Core Components

### 1. AuthService (`src/webserver/auth/service/AuthService.ts`)

- **Token Management:** Generates and verifies JWTs.
- **Password Handling:** Uses `bcrypt` for hashing and verification.
- **Security:** Implements constant-time comparison to prevent timing attacks.
- **Key Management:** Rotates JWT secrets, storing them in the `users` table (admin record).

### 2. Middleware

- **AuthMiddleware (`src/webserver/auth/middleware/AuthMiddleware.ts`):**
  - Validates login/register inputs.
  - Applies security headers (X-Frame-Options, CSP, etc.).
- **TokenMiddleware (`src/webserver/auth/middleware/TokenMiddleware.ts`):**
  - Extracts tokens from:
    1. `Authorization: Bearer <token>` header
    2. `aionui-session` Cookie
    3. `token` Query parameter
  - Validates tokens and attaches user info to `req.user`.

### 3. Security (`src/webserver/middleware/security.ts`)

- **Rate Limiting:**
  - `authRateLimiter`: Strict limits for login (5 attempts/15min).
  - `apiRateLimiter`: General API limits.
  - `authenticatedActionLimiter`: Limits sensitive actions for logged-in users.
- **CSRF:** Implements CSRF token generation and validation.

## Authentication Flow

### Login (`POST /login`)

1. **Rate Limiting:** Checks `authRateLimiter`.
2. **Validation:** Validates username/password format.
3. **Verification:**
   - Fetches user from `UserRepository`.
   - Verifies password using `bcrypt` (constant-time).
4. **Token Generation:** Creates a JWT signed with the dynamic secret.
5. **Response:**
   - Sets `aionui-session` HttpOnly cookie.
   - Returns JSON with user info and token.

### Request Authentication

1. **Extraction:** Middleware extracts token from Header, Cookie, or Query.
2. **Verification:** Verifies JWT signature and expiration.
3. **User Lookup:** Confirms user exists in DB.
4. **Context:** Sets `req.user`.

### WebSocket Authentication

- Reuses the main session token.
- Endpoint `/api/ws-token` validates the session and returns the token for WS connection.

## Key Endpoints (`src/webserver/routes/authRoutes.ts`)

| Method   | Endpoint                      | Description                         | Protection    |
| :------- | :---------------------------- | :---------------------------------- | :------------ |
| `POST` | `/login`                    | User login                          | Rate Limited  |
| `POST` | `/logout`                   | User logout (clears cookie)         | Authenticated |
| `GET`  | `/api/auth/status`          | Check system status (setup needed?) | Rate Limited  |
| `GET`  | `/api/auth/user`            | Get current user info               | Authenticated |
| `POST` | `/api/auth/change-password` | Change password                     | Authenticated |
| `POST` | `/api/auth/refresh`         | Refresh session token               | Authenticated |
| `GET`  | `/api/ws-token`             | Get token for WebSocket             | Authenticated |

## Security Features

- **HttpOnly Cookies:** Prevents XSS attacks from stealing tokens.
- **Dynamic Secrets:** JWT secrets are generated and stored in DB, allowing rotation (`AuthService.invalidateAllTokens`).
- **Constant-Time Verification:** Mitigates timing attacks during login.
- **Strict Rate Limiting:** Protects against brute-force attacks.
