# Firebase Initialization Error in Test Environment

## Issue
The tests were failing due to Firebase initialization errors, specifically with the `getApps()` function not being recognized.

## Solution
1. Updated the Firebase mock in `src/__mocks__/firebase.ts` to include the `getApps` function:
   ```javascript
   export const getApps = jest.fn(() => []);
   ```
2. This mock ensures that the `getApps()` function is available in the test environment without actually initializing Firebase.

## Prevention
- Ensure that all Firebase functions used in the application are properly mocked in the test environment.
- Regularly review and update mocks as new Firebase functionality is added to the application.