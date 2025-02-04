# Adaptive Instructions

This document contains project-specific insights and learned user preferences. It is updated after each significant milestone or user interaction.

## Project Insights

1. Stripe Integration
   - Always double-check webhook secrets in both the Stripe dashboard and the `.env.local` file.
   - Use detailed logging in webhook handlers to diagnose issues quickly.
   - Test webhook functionality thoroughly after any changes to the integration.

2. Firebase Integration
   - Ensure Firestore security rules are properly set up to protect user data.
   - Use transactions when updating critical data like subscription status to ensure data integrity.

3. vapi.ai Integration
   - Keep the vapi.ai API key secure and never expose it on the client-side.
   - Implement proper error handling for all vapi.ai API calls.
   - Regularly verify the accuracy of usage data returned by the vapi.ai analytics API.

4. Usage Tracking and Limits
   - Implement a system to track monthly usage across all assistants for each user.
   - Set up automatic unpublishing of assistants when usage limits are reached.
   - Provide clear user feedback when approaching or exceeding usage limits.

## User Preferences

1. Dashboard Layout
   - Users prefer a clean, intuitive interface for managing their assistants.
   - Quick access to create new assistants and view existing ones is important.
   - Clearly display usage data and subscription status for each assistant.

2. Subscription Management
   - Users expect clear indication of their subscription status.
   - Provide easy access to upgrade or manage subscription.
   - Hide subscription options for already subscribed assistants.

3. Assistant Interaction
   - Users want a seamless chat interface to interact with their assistants.
   - Provide clear feedback on assistant status (e.g., thinking, ready, error, unpublished).
   - Offer clear explanations when an assistant becomes unavailable due to usage limits.

## Development Practices

1. Error Handling
   - Implement comprehensive error handling across the application.
   - Use a centralized logging system for easier debugging and monitoring.
   - Provide user-friendly error messages for common issues.

2. Testing
   - Write unit tests for critical components, especially those handling payments and API integrations.
   - Implement end-to-end tests for core user flows.
   - Regularly test with various user scenarios, including edge cases like exceeding usage limits.
   - Maintain a systematic approach to unit testing:
     - Place page tests in `pages/__tests__/`
     - Place API route tests in `pages/api/__tests__/`
     - Place component tests in `src/components/__tests__/`
   - Ensure all new features and bug fixes are accompanied by appropriate unit tests.

3. Documentation
   - Keep all documentation (like this file) up-to-date with each sprint.
   - Document complex logic or integrations inline with clear comments.
   - Maintain a clear and updated error log to track and prevent recurring issues.

4. Data Processing
   - Implement thorough validation and sanitation for all user inputs.
   - Double-check all calculations, especially those involving usage data and costs.
   - Use appropriate data types and consider using a library like decimal.js for financial calculations.

5. API Key Management
   - Always use environment variables for storing API keys.
   - Use `VAPI_API_KEY` for server-side operations and `NEXT_PUBLIC_VAPI_API_KEY` for client-side operations.
   - Never expose the private API key (`VAPI_API_KEY`) on the client-side.
   - Implement separate methods for server-side and client-side API calls in `vapiClient.ts`.
   - Regularly audit the codebase to ensure API keys are being used correctly.

6. Admin Operations
   - Use dedicated API routes for admin operations (e.g., `pages/api/admin/list-assistants.ts`).
   - Implement strict authentication checks in admin routes to ensure only authorized users can access them.
   - Keep admin routes separate from regular user routes to maintain clear separation of concerns.

7. Data Calculations
   - When dealing with time-based calculations (e.g., minutes), ensure the units are consistent throughout the application.
   - Do not divide minutes by 60 when the API already returns the value in minutes.
   - Implement unit tests for all calculation logic to catch potential errors early.

8. Code Organization
   - Maintain a clear separation between server-side and client-side code.
   - Use TypeScript interfaces to define clear data structures, especially for API responses.
   - Regularly review and refactor code to ensure it follows best practices and project guidelines.

9. Cost Calculations
   - The total cost for assistant usage is calculated as Minutes consumed multiplied by 0.45 (COST_PER_MINUTE).
   - This calculation is implemented in the `useAssistants` hook for both regular and admin users.
   - Ensure that any changes to the pricing model are reflected in this calculation.
   - Regularly verify that the cost calculation is accurate and consistent across the application.
   - When displaying cost information, always use the calculated value rather than relying on pre-calculated data from the API.

## Performance Considerations

1. API Calls
   - Implement caching strategies for frequently accessed data to reduce API calls.
   - Use pagination for lists that may grow large (e.g., conversation history).
   - Consider implementing background jobs for heavy operations like usage calculations.

2. Real-time Updates
   - Use WebSockets or server-sent events for real-time updates to improve user experience.
   - Implement efficient update mechanisms to reflect changes in assistant status or usage limits.

3. Resource Management
   - Implement lazy loading for components and data that are not immediately visible.
   - Optimize database queries to fetch only necessary data.
   - Consider implementing a queue system for resource-intensive operations.

This document will be continually updated as we learn more about user preferences and encounter new challenges in the development process.

## VapiChatInterface Component

The following information is crucial for understanding and working with the VapiChatInterface component:

1. SDK Integration:
   - The VapiChatInterface component is built using the vapi web SDK.
   - It uses the global `window.vapi` object for SDK functionality.
   - The SDK is initialized with the assistant ID and public API key.

2. Audio Interaction:
   - The interface handles real-time audio input and output.
   - It does not use text-based messages for communication.

3. Visual Feedback:
   - The component displays different GIF images based on whether the assistant is speaking or listening.
   - These images provide visual cues to the user about the current state of the interaction.

4. State Management:
   - The component likely manages its own state for the current interaction status.
   - It may use React hooks to handle side effects and state updates.

5. Error Handling:
   - Any error handling should be done carefully, considering the SDK's error events and methods.
   - Avoid modifying the core functionality without a deep understanding of the SDK and its integration.

6. Performance Considerations:
   - The real-time audio processing may have performance implications.
   - Be cautious about adding any heavy computations or rendering that might interfere with the audio interaction.

7. Customization:
   - Any visual or functional customizations should be done with care, ensuring they don't conflict with the SDK's operation.
   - Always refer to the vapi SDK documentation when considering changes or enhancements.

8. Testing:
   - Testing this component requires consideration of audio input/output scenarios.
   - Mocking the vapi SDK might be necessary for certain test cases.

Remember: Before making any changes to the VapiChatInterface component, ensure you have a thorough understanding of the vapi SDK and its integration in the current implementation. Always test changes extensively to avoid breaking the core functionality.

Important Note: When updating documentation or making changes, always add new content without deleting existing information. This ensures that valuable knowledge is preserved and accumulated over time.

## Admin User Management

What was done:
- Updated the admin user identification process in the `pages/api/get-analytics.ts` file.
- Implemented a temporary solution for identifying admin users based on their email address.

Problem found:
- The application was incorrectly identifying admin users, resulting in admin users being treated as regular users and having their analytics data filtered.
- The previous implementation was using a generic `isAdmin` flag from the user data in Firestore, which was not correctly set or updated for admin users.

Solution applied:
- Updated the admin check in `pages/api/get-analytics.ts` to specifically look for the admin user's email address:
  ```javascript
  const isAdmin = userData?.email === 'vincent@getinference.com';
  ```
- This ensures that the specific admin user is correctly identified regardless of the `isAdmin` flag in Firestore.

Best Practices:
1. Admin Identification:
   - The current approach of using email addresses for admin identification is temporary and should be replaced with a more robust system.
   - Consider implementing Firebase custom claims to securely store admin status.

2. Admin Management:
   - Create an admin management interface for adding or removing admin privileges.
   - Use environment variables or a secure configuration system to store admin email addresses.

3. Security Considerations:
   - Always verify admin status on the server-side, never relying on client-side information.
   - Implement comprehensive logging for all admin actions to maintain an audit trail.
   - Regularly audit admin access and permissions.
   - Avoid hardcoding admin email addresses in the code.

4. Testing:
   - Create specific test cases for admin-only features.
   - Implement integration tests that cover the entire admin user flow, from authentication to performing admin-specific actions.
   - Add unit tests for admin user identification and related functionalities.

5. API Routes:
   - Use dedicated API routes for admin operations (e.g., `pages/api/admin/list-assistants.ts`).
   - Implement strict authentication checks in admin routes to ensure only authorized users can access them.

Next Steps:
1. Research and implement Firebase custom claims for admin users.
2. Create an admin management interface for adding or removing admin privileges.
3. Move admin email addresses to environment variables or a secure configuration system.
4. Update all admin-related API routes to use the new admin identification system.
5. Implement logging for admin actions to maintain an audit trail.
6. Conduct a security audit of admin-specific routes and functionalities.

Remember: When implementing changes to the admin user management system, ensure backwards compatibility and plan for a smooth transition from the current system to the new one. Always prioritize security and scalability in admin-related features.

## Handling Optional Fields in Assistant Data Structure

The following guidelines should be followed when working with the assistant data structure, which includes optional fields:

1. Interface Definition:
   - The `Assistant` interface in `src/types/assistant.ts` includes optional fields to accommodate variations in the vapi.ai API response.
   - Regularly review and update this interface to ensure it accurately reflects the current API response structure.

2. Accessing Optional Fields:
   - When working with assistant data, always check for the existence of optional fields before accessing them.
   - Use optional chaining (`?.`) or nullish coalescing (`??`) operators to safely access potentially undefined properties.

3. Component Rendering:
   - In the `AssistantDetailPage` component, use conditional rendering for sections that depend on optional fields (e.g., voice, model, transcriber).
   - Provide fallback values or "Not available" messages for optional fields that might be undefined.

4. Data Updates:
   - When updating assistant data, be careful not to overwrite existing optional fields with undefined values.
   - Use spread operators or object merging techniques to preserve existing data when updating.

5. API Handling:
   - In API routes handling assistant data (e.g., `pages/api/get-assistant.ts`), ensure that the response includes all available fields from the vapi.ai API, even if they're optional.
   - Consider using a mapping function to transform API responses into your `Assistant` interface, handling missing fields gracefully.

6. Testing:
   - When testing, create test cases that cover scenarios with both present and missing optional fields to ensure robust handling.
   - Mock API responses should include variations of optional fields to test all possible scenarios.

Example of handling optional fields in components:
```typescript
{assistant.voice && (
  <div className="bg-white shadow sm:rounded-lg">
    <div className="px-4 py-5 sm:p-6">
      <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
        <MicIcon className="inline-block mr-2" />
        Voice Details
      </h3>
      <div className="space-y-2">
        <p><strong>Model:</strong> {assistant.voice.model}</p>
        <p><strong>Voice ID:</strong> {assistant.voice.voiceId}</p>
        {/* ... other voice details ... */}
      </div>
    </div>
  </div>
)}
```

Example of providing fallback values:
```typescript
<p><strong>First Message:</strong> {assistant.firstMessage || 'Not set'}</p>
```

Remember to update tests and documentation when changes are made to the assistant data structure or how optional fields are handled. This ensures that the codebase remains consistent and maintainable as the project evolves.

Important Note: When updating documentation or making changes, always add new content without deleting existing information. This ensures that valuable knowledge is preserved and accumulated over time.