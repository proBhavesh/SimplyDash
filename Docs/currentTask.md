# Current Task

## Project Overview
- Project complexity: MVP (Minimum Viable Product)
- Current stage: Finding out root cause of performance degradation of realtime api (Sprint 4)
- Project type: Responsive web app dashboard for vapi.ai and OpenAI Realtime API interaction

## Project Goals
Build a dashboard to interact with vapi.ai (https://docs.vapi.ai/introduction) and OpenAI Realtime API for conversational assistants , with integrated payment processing, usage tracking, and unified assistant management.

## Current Task

We need to identify and resolve the root cause of a performance issue observed during extended interactions with OpenAI realtime API assistants. Specifically, the problem occurs in components like @/src/components/VirtualBusinessAnalystPage.tsx or [assistant]. Over time, the responsiveness deteriorates, with delayed interruptions and slower responses. When we disconnect and reconnect the resonsiveness is immediate but again after a while deteriorate. we must follow the recommendations of the realtime api documentation. We must Avoid assumptions—verify everything carefully and we must Avoid unnecessary simplifications. Objective: Investigate why multiple intervals are still being created after modifying useRealtimeConnection.ts, leading to memory leaks. Analysis: It's possible that the component using useRealtimeConnection is being mounted multiple times, causing the setupMemoryMonitoring useEffect to run multiple times.
We need to examine src/components/VirtualBusinessAnalystPage.tsx to see how useRealtimeConnection is being utilized and whether the component lifecycle methods might be contributing to the issue.
we also need to enrich our tests : 
Enhance memory-monitor.spec.ts to track the memory usage evolution of the top 10 functions during test execution and display this information in the terminal output minute by minute.

Keep the existing tests and logic unchanged, including the two-step connection process (connect → disconnect → connect).

Use the Chrome DevTools Protocol (CDP) to collect accurate memory information. Track React components and hooks using the React DevTools global hook. Monitor WebSocket and audio processor activity through the existing counters.

Display the memory usage details dynamically in the terminal during test runs. Focus on the top 10 functions by live count and live size during each monitoring loop. Do not save memory logs to a file.

Format the output like this example:

Function Memory Usage Details:

Function: ws.onmessage
Live Count: 6,447
Count: 6,819
Live Size: 2,628,332 bytes
Total Size: 9,718,408 bytes
Source: useRealtimeConnection.ts:0

Make the display refresh minute by minute during test execution.


## Completed Steps
- [x] Fixed issue with Subscribe button display for subscribed assistants
- [x] Corrected usage data calculation for assistants
- [x] Implemented monthly usage allowance tracking
- [x] Added functionality to unpublish assistants when usage allowance is exceeded
- [x] Created unit tests for the useAssistants hook
- [x] Set up Jest configuration for running tests
- [x] Updated Firebase mock to include getApps function
- [x] Resolved the API key usage issue in vapiClient.ts:
  - [x] Implemented separate methods for server-side (private key) and client-side (public key) API calls
  - [x] Updated the vapiClient.ts file to handle both server-side and client-side scenarios correctly
  - [x] Ensured that the correct API key is used in each context (VAPI_API_KEY for server-side, NEXT_PUBLIC_VAPI_API_KEY for client-side)
- [x] Fixed incorrect minutes calculation by removing division by 60
- [x] Updated documentation (adaptive_instructions.md and errors.md) with lessons learned
- [x] Implemented correct cost calculation (Minutes consumed * 0.45) for both regular and admin users in useAssistants hook
- [x] Updated dashboard to refresh both assistants list and analytics data
- [x] Modified useAssistants hook to fetch assistants and analytics in a single function
- [x] Updated unit tests for useAssistants hook to reflect recent changes
- [x] Ensured that minutes consumed and total cost are refreshed when the user clicks the "Refresh Data" button
- [x] Implemented centralized error handling utility (errorHandler.ts)
- [x] Updated useAssistants hook to use the new error handling system
- [x] Updated dashboard-page component to handle the new ErrorResponse type
- [x] Implemented toast notifications for user feedback
- [x] Updated dashboard-page component to use toast notifications for various actions and error scenarios
- [x] Fixed incorrect Vapi API endpoint for fetching assistants
- [x] Updated Docs/errors.md with information about the Vapi API endpoint issue and its solution
- [x] Updated src/utils/vapiClient.ts to include getAssistant and getAnalytics functions
- [x] Exported vapiClient object with getAssistant and getAnalytics methods
- [x] Fixed incorrect subscription status for assistants in API response
- [x] Updated Docs/errors.md with information about the subscription status issue and its solution
- [x] Fixed incorrect admin user identification in pages/api/get-analytics.ts
- [x] Updated admin check to use specific email address instead of generic isAdmin flag
- [x] Implemented a temporary solution for admin user identification
- [x] Updated Docs/adaptive_instructions.md with information about the admin user management system
- [x] Updated VapiChatInterface component to use the new error handling system and errorLogger
- [x] Added comprehensive logging to src/lib/firebase-admin.ts for better debugging of Firebase initialization
- [x] Created a test endpoint (pages/api/test-firebase-init.ts) to verify Firebase initialization
- [x] Implemented scraping functionality in the landing page
- [x] Created new API endpoint for creating assistants with scraped content
- [x] Updated landing page to use the new create-assistant-with-scraping endpoint
- [x] Resolved issues with scraping process and assistant creation
- [x] Restructured error documentation:
  - [x] Created separate files for each error in Docs/errors/ directory
  - [x] Updated main Docs/errors.md file to serve as an index for all error files
  - [x] Ensured all error files contain detailed information about issues, solutions, and prevention strategies
- [x] Set up custom server for WebSocket support
- [x] Implemented OpenAI Realtime API prototype
- [x] Created OpenAI Realtime API chat interface
- [x] Updated techStack.md with OpenAI Realtime API information
- [x] Updated roadmap.md to include OpenAI Realtime API integration plans
- [x] Resolved TypeScript error related to 'formidable' by installing @types/formidable
- [x] Updated pages/api/realtime-relay.ts to handle WebSocket connections for OpenAI Realtime API
- [x] Define and implemented the structure for openaiAssistants templates on landing page.

## Next Steps
1.identify and resolve the root cause of a performance issue observed during extended interactions with OpenAI realtime API assistants


2. Implement full CRUD operations for assistants:
   a. Review and update existing CRUD operations to ensure compatibility with both vapi.ai and OpenAI Realtime API
   b. Implement any missing CRUD operations
   c. Update API routes to handle both vapi.ai and OpenAI Realtime API assistants

3. Develop advanced chat interface:
   a. Create a unified chat interface that can work with both vapi.ai and OpenAI Realtime API
   b. Implement real-time updates and streaming for OpenAI Realtime API responses
   c. Ensure smooth transitions between different assistant types in the chat interface

4. Create user profile management:
   a. Design and implement a user profile page
   b. Add functionality for users to update their information
   c. Implement settings for default assistant preferences

5. Implement responsive design for mobile devices:
   a. Review current components and layouts for mobile responsiveness
   b. Update CSS and component structures to ensure proper display on various screen sizes
   c. Test the application on multiple devices and browsers

6. Enhance error handling and logging:
   a. Review and update error handling for new OpenAI Realtime API integration
   b. Implement more detailed error logging for WebSocket connections and real-time communication
   c. Update error documentation with any new error types related to OpenAI Realtime API

7. Update testing suite:
   a. Create unit tests for new OpenAI Realtime API-related components and functions
   b. Update existing tests to account for the new integration
   c. Implement integration tests for the WebSocket server and OpenAI Realtime API communication

8. Documentation updates:
   a. Create a new section in the project documentation for OpenAI Realtime API integration
   b. Update user documentation to explain the new OpenAI Realtime API features
   c. Provide guidelines for developers on how to work with both vapi.ai and OpenAI Realtime API in the codebase

9. Performance optimization:
   a. Analyze and optimize WebSocket connections and real-time communication
   b. Implement efficient data management for real-time streaming responses
   c. Optimize the chat interface for handling large volumes of messages

10. Security enhancements:
    a. Review and enhance security measures for WebSocket connections
    b. Implement proper authentication and authorization for OpenAI Realtime API usage
    c. Ensure secure handling of API keys and sensitive data

11. Troubleshoot Firebase Storage initialization:
   a. Deploy the updated code with enhanced logging to the production environment
   b. Reproduce the error by accessing the assistant detail page
   c. Check server logs for detailed output from firebase-admin.ts
   d. Verify environment variables are correctly loaded in the production environment
   e. Use the new test endpoint (/api/test-firebase-init) to isolate Firebase initialization issues
   f. Based on the logs and test results, identify and resolve any configuration or initialization problems

12. Update API routes:
   a. Review all API routes (e.g., get-analytics, stripe-webhook, delete-assistant, get-assistant-usage, upload-gif, get-assistant, test-firebase-storage, update-assistant)
   b. Implement consistent error handling using the new errorHandler utility
   c. Ensure proper error responses are sent back to the client
   d. Update error logging in API routes to use errorLogger

13. Enhance error logging:
   a. Review the current error logging implementation in errorLogger.ts
   b. Implement more detailed error logging, including contextual information
   c. Consider implementing error tracking service integration (e.g., Sentry)

14. Update unit tests:
   a. Review and update existing unit tests to account for the new error handling system and toast notifications
   b. Add new unit tests for error scenarios in components and API routes
   c. Add integration tests that verify the correct subscription status is being returned for assistants

15. Documentation updates:
   a. Update the error handling section in the project documentation
   b. Add guidelines for using the new error handling system and toast notifications in the developer documentation
   c. Update documentation about the data structure and relationships between collections in Firestore

16. Code review and refactoring:
   a. Conduct a thorough code review of recent changes
   b. Identify and refactor any areas that could benefit from the new error handling system
   c. Ensure consistent coding style and best practices across the application

17. Verify subscription status display:
   a. Test the dashboard with various assistants (subscribed and unsubscribed)
   b. Ensure that the subscription status is correctly displayed for each assistant
   c. Verify that the "Subscribe" button is only shown for unsubscribed assistants

18. Implement robust assistant fetching:
   a. Review and update the assistant fetching logic in pages/api/list-assistants.ts
   b. Ensure proper error handling and logging for API calls
   c. Implement retry logic for failed API calls, especially for transient errors

19. Improve API endpoint management:
   a. Create a centralized configuration for API endpoints
   b. Implement integration tests to verify correct API endpoint construction
   c. Add detailed logging for all API calls, including constructed URLs

20. Implement a more robust admin user management system:
    a. Research and implement Firebase custom claims for admin users
    b. Create an admin management interface for adding or removing admin privileges
    c. Move admin email addresses to environment variables or a secure configuration system
    d. Update all admin-related API routes to use the new admin identification system
    e. Implement logging for admin actions to maintain an audit trail
    f. Conduct a security audit of admin-specific routes and functionalities

21. Thoroughly test the scraping functionality and assistant creation process
22. Update unit tests to cover new scraping-related functionality
23. Refine error handling for scraping and assistant creation processes
24. Update user documentation to explain the new scraping feature
25. Consider implementing rate limiting or other protective measures for the scraping functionality

## Recent Updates
- Implemented centralized error handling utility (errorHandler.ts)
- Updated useAssistants hook to use the new error handling system
- Modified dashboard-page component to handle the new ErrorResponse type
- Implemented toast notifications for user feedback
- Updated dashboard-page component to use toast notifications for various actions and error scenarios
- Fixed incorrect Vapi API endpoint for fetching assistants
- Updated Docs/errors.md with information about the Vapi API endpoint issue and its solution
- Implemented individual assistant fetching instead of bulk fetching
- Fixed issue with accessing getAssistant function in pages/api/get-assistant.ts
- Updated src/utils/vapiClient.ts to include getAssistant and getAnalytics functions
- Exported vapiClient object with getAssistant and getAnalytics methods
- Fixed incorrect subscription status for assistants in API response
- Updated Docs/errors.md with information about the subscription status issue and its solution
- Fixed incorrect admin user identification in pages/api/get-analytics.ts
- Updated admin check to use specific email address instead of generic isAdmin flag
- Implemented a temporary solution for admin user identification
- Updated Docs/adaptive_instructions.md with best practices and next steps for admin user management
- Updated VapiChatInterface component to use the new error handling system and errorLogger
- Added comprehensive logging to src/lib/firebase-admin.ts for debugging Firebase initialization issues
- Created a test endpoint (pages/api/test-firebase-init.ts) to verify Firebase initialization independently
- Updated error handling in pages/api/get-assistant.ts to provide more detailed error information
- Implemented scraping functionality in the landing page
- Created new API endpoint (pages/api/create-assistant-with-scraping.ts) to handle assistant creation with scraped content
- Updated landing page to use the new create-assistant-with-scraping endpoint
- Resolved issues with the scraping process and assistant creation
- Updated documentation to reflect recent changes and issues encountered
- Restructured error documentation for better organization and maintainability:
  - Created individual files for each error in Docs/errors/ directory
  - Updated main Docs/errors.md file to serve as an index for all error files
  - Ensured comprehensive documentation of issues, solutions, and prevention strategies in each error file
- Set up custom server for WebSocket support
- Implemented OpenAI Realtime API prototype
- Created OpenAI Realtime API chat interface
- Updated techStack.md with OpenAI Realtime API information
- Updated roadmap.md to include OpenAI Realtime API integration plans
- Resolved TypeScript error related to 'formidable' by installing @types/formidable
- Updated pages/api/realtime-relay.ts to handle WebSocket connections for OpenAI Realtime API
- Added make and function calling

## Recent User Feedback

- The "waiting" GIF displays correctly.
- Upon clicking "Connect and Talk", there was no audio playback, and the "talking" GIF did not appear.
- Requested the addition of real-time input/output visualizations for audio frequencies to confirm audio functionality.

## Next Steps

- Verify the implemented changes in the web environment to ensure all features function as expected.
- Test the assistant thoroughly to confirm that:
  - Audio playback works seamlessly.
  - Visual feedback components accurately represent voice activities.
  - The user experience is intuitive and responsive.

- Monitor for any further issues or user feedback for continuous improvement.
