# Incorrect Admin User Identification

## Issue
The application was incorrectly identifying admin users in the `pages/api/get-analytics.ts` file, resulting in admin users being treated as regular users and having their analytics data filtered.

## Root Cause
The admin check in the `pages/api/get-analytics.ts` file was using a generic `isAdmin` flag from the user data in Firestore, which was not correctly set or updated for admin users.

## Solution
1. Updated the admin check in `pages/api/get-analytics.ts` to specifically look for the admin user's email address:
   ```javascript
   const isAdmin = userData?.email === 'vincent@getinference.com';
   ```
2. This ensures that the specific admin user is correctly identified regardless of the `isAdmin` flag in Firestore.

## Prevention
1. Implement a more robust admin user management system, possibly using custom claims in Firebase Authentication.
2. Regularly audit and test admin-specific functionalities to ensure they work as expected.
3. Consider implementing a configuration file for admin users, making it easier to manage and update admin access.
4. Add unit tests specifically for admin user identification and related functionalities.

## Best Practices
1. Avoid hardcoding admin email addresses in the code. Consider moving this to an environment variable or a secure configuration system.
2. Implement logging for admin actions to maintain an audit trail.
3. Regularly review and update the admin identification process as the application scales.