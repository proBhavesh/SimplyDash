# Incorrect Minutes Calculation

## Issue
The application was incorrectly dividing the minutes returned by the API by 60, resulting in inaccurate usage data display.

## Solution
1. Removed the division by 60 in the usage calculation logic.
2. Updated the `useAssistants` hook to use the minutes value directly as returned by the API.

## Prevention
- Clearly document the units of measurement for all API responses.
- Implement unit tests for all calculation logic, especially those involving time or financial data.
- When integrating with new APIs or updating existing integrations, always verify the units of measurement in the API documentation.