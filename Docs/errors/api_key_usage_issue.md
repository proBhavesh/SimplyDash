# API Key Usage Issue

## Issue
The application was using the wrong API key (public instead of private) for server-side operations, resulting in 403 Forbidden errors when trying to fetch assistants.

## Solution
1. Updated `vapiClient.ts` to use different API keys for server-side and client-side operations.
2. Implemented separate methods (`fetchWithVapiAuth` and `fetchWithPublicAuth`) to handle different API key usage scenarios.
3. Ensured all server-side methods use the private API key (`VAPI_API_KEY`) for sensitive operations.
4. Updated client-side methods to use the public API key (`NEXT_PUBLIC_VAPI_API_KEY`).

## Prevention
- Clearly document which API key should be used for each type of operation.
- Implement a strict typing system or enum to differentiate between server-side and client-side API calls.
- Regularly audit the codebase to ensure API keys are being used correctly.
- Add unit tests to verify that the correct API key is being used in different contexts.