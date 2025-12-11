#!/bin/bash

# Test script for logout functionality
# This script tests the logout endpoint to verify cookies are properly cleared

echo "=== Testing Logout Functionality ==="
echo ""

# Configuration
BASE_URL="http://localhost:25808"
COOKIE_FILE="test-cookies.txt"

# Clean up old cookie file
rm -f "$COOKIE_FILE"

echo "Step 1: Login"
echo "Enter password for admin user:"
read -s PASSWORD

LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"$PASSWORD\"}")

echo "$LOGIN_RESPONSE" | jq '.'

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  echo "✓ Login successful"
else
  echo "✗ Login failed"
  exit 1
fi

echo ""
echo "Step 2: Check cookies after login"
echo "Cookies in file:"
cat "$COOKIE_FILE" | grep -E "(aionui-session|aionui-csrf-token)"

echo ""
echo "Step 3: Extract CSRF token"
CSRF_TOKEN=$(grep aionui-csrf-token "$COOKIE_FILE" | awk '{print $7}')
echo "CSRF Token: $CSRF_TOKEN"

if [ -z "$CSRF_TOKEN" ]; then
  echo "✗ No CSRF token found"
  exit 1
fi

echo ""
echo "Step 4: Test authenticated endpoint"
USER_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/auth/user")
echo "$USER_RESPONSE" | jq '.'

if echo "$USER_RESPONSE" | grep -q '"success":true'; then
  echo "✓ Authenticated endpoint accessible"
else
  echo "✗ Not authenticated"
  exit 1
fi

echo ""
echo "Step 5: Logout"
LOGOUT_RESPONSE=$(curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" -X POST "$BASE_URL/logout" \
  -H "Content-Type: application/json" \
  -d "{\"_csrf\":\"$CSRF_TOKEN\"}")

echo "$LOGOUT_RESPONSE" | jq '.'

if echo "$LOGOUT_RESPONSE" | grep -q '"success":true'; then
  echo "✓ Logout successful"
else
  echo "✗ Logout failed"
  exit 1
fi

echo ""
echo "Step 6: Check cookies after logout"
echo "Cookies in file:"
cat "$COOKIE_FILE" | grep -E "(aionui-session|aionui-csrf-token)" || echo "(no session cookies found - this is expected)"

echo ""
echo "Step 7: Try to access authenticated endpoint after logout"
USER_RESPONSE_AFTER=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/auth/user")
echo "$USER_RESPONSE_AFTER"

if echo "$USER_RESPONSE_AFTER" | grep -q "Unauthorized"; then
  echo "✓ Correctly rejected - not authenticated"
  echo ""
  echo "=== ✓ ALL TESTS PASSED ==="
else
  echo "✗ Still authenticated after logout - BUG!"
  echo ""
  echo "=== ✗ TEST FAILED ==="
  exit 1
fi

# Clean up
rm -f "$COOKIE_FILE"

