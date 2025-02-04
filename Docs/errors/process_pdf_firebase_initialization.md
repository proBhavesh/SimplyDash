# Process PDF Firebase Initialization Issue

## Issue Description
The PDF processing functionality was failing with the error:
```
FirebaseError: Bucket name not specified or invalid. Specify a valid bucket name via the storageBucket option when initializing the app, or specify the bucket name explicitly when calling the getBucket() method.
```

## Root Cause Analysis
1. The issue occurred because we were trying to initialize Firebase Admin SDK multiple times in different API routes (`process_pdf.ts` and `cleanup-pngs.ts`).
2. Each route was attempting its own Firebase initialization instead of using the already initialized instance from `src/lib/firebase-admin.ts`.
3. This caused conflicts in the Firebase Admin SDK initialization, particularly with the storage bucket configuration.

## Working vs Non-Working Code

### Non-Working Code (Original)
In `pages/api/process_pdf.ts`:
```typescript
// Attempting to initialize Firebase Admin again
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const bucket = admin.storage().bucket();
```

### Working Code (Fixed)
In `pages/api/process_pdf.ts`:
```typescript
import { storage } from '../../src/lib/firebase-admin';

// Using the already initialized Firebase Admin instance
const bucket = storage.bucket('simplytalk-admin.appspot.com');
```

## Solution
1. Removed duplicate Firebase initialization code from `process_pdf.ts` and `cleanup-pngs.ts`.
2. Imported the pre-initialized `storage` instance from `src/lib/firebase-admin.ts`.
3. Used the storage instance to get the bucket reference with an explicit bucket name.

## Expected Behavior and Logs
When the PDF processing is working correctly, you should see the following types of logs:

1. **PDF Processing Logs**:
   ```
   Processing page X
   Skipping page Y - excluded content
   Found Data Objects & Integrations page - stopping processing
   ```
   These logs indicate the PDF is being processed correctly, with pages being properly included or excluded.

2. **Generated URLs**:
   ```
   Final generated URLs: [
     'https://storage.googleapis.com/simplytalk-admin.appspot.com/uploads/png/case_type_[timestamp]_[page].png',
     ...
   ]
   ```
   These URLs confirm that the images were successfully uploaded to Firebase Storage.

3. **Next.js Compilation Logs**:
   ```
   - wait compiling /api/process_jira_subtasks (client and server)...
   - event compiled successfully in XX ms (YY modules)
   ```
   These are normal Next.js development mode logs showing routes being compiled on-demand.

4. **Firebase Initialization Logs**:
   ```
   Starting Firebase Admin SDK initialization
   Firebase Admin SDK already initialized
   Initializing Firebase services...
   ...
   All Firebase services initialized successfully
   ```
   These logs appear when an API route first accesses Firebase services. The "already initialized" message confirms that the singleton pattern is working correctly.

## Prevention
1. **Centralized Initialization**: Always use the centralized Firebase Admin initialization from `src/lib/firebase-admin.ts`.
2. **Import Pattern**: Follow the pattern used in `upload-gif.ts`, which correctly imports Firebase services:
   ```typescript
   import { admin, db, storage } from '../../src/lib/firebase-admin';
   ```
3. **Code Review**: When reviewing PRs, check for duplicate Firebase initializations.
4. **Documentation**: Keep Firebase-related documentation up to date and easily accessible.

## Best Practices
1. Initialize Firebase Admin SDK only once in the application, preferably in a dedicated file.
2. Export initialized services (auth, db, storage) from that file.
3. Import these services in API routes and other server-side code.
4. Use explicit bucket names when working with Firebase Storage.
5. Add comprehensive logging around Firebase operations to quickly identify issues.
6. Understand that Firebase initialization logs may appear multiple times in development mode, but verify that the "already initialized" message appears to confirm proper singleton behavior.

## Related Files
- `src/lib/firebase-admin.ts`: Central Firebase Admin initialization
- `pages/api/process_pdf.ts`: PDF processing endpoint
- `pages/api/cleanup-pngs.ts`: PNG cleanup endpoint
- `pages/api/upload-gif.ts`: Reference implementation for correct Firebase usage

## Testing
To verify the fix:
1. Test PDF upload and processing in both local and production environments.
2. Verify that PNG files are correctly stored in Firebase Storage.
3. Confirm that cleanup operations work as expected.
4. Check logs for any Firebase initialization warnings or errors.
5. Verify that you see the expected log patterns as described in the "Expected Behavior and Logs" section.

## Additional Notes
- The error was particularly visible in the production environment (Railway) despite working locally.
- Environment variables were correctly set in both environments, indicating that the issue was with the initialization pattern rather than configuration.
- The solution maintains the working functionality of avatar image uploads while fixing the PDF processing issues.
- The presence of Firebase initialization logs during development is normal and expected; what's important is seeing the "already initialized" message rather than multiple full initializations.
