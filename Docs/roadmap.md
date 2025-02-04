# Project Roadmap

This document outlines the long-term vision and planned feature implementations for the SimplyTalk.ai dashboard project. The timeline is divided into sprints, each lasting approximately two weeks.

## Completed Sprint: Sprint 2 - OpenAI Realtime API Integration and Core Functionality

- [x] Set up custom server for WebSocket support
- [x] Implement OpenAI Realtime API prototype
- [x] Create OpenAI Realtime API chat interface
- [x] Integrate OpenAI Realtime API with existing assistant framework
- [x] Implement full CRUD operations for assistants
- [x] Develop advanced chat interface with vapi.ai and OpenAI Realtime API integration
- [x] Create user profile management
- [x] Implement responsive design for mobile devices

## Current Sprint: Sprint 3 - Firestore Data Model Update

- [ ] Task 3.1: Design New Collections
  - [ ] Subtask 3.1.1: Define the structure for openaiAssistants collection.
    Fields: id, name, systemPrompt, firstMessage, createdAt, updatedAt, userId, isSubscribed, tokenUsage, messages, voiceDetails, transcriberDetails, trainingFiles, scrapedUrls, scrapedContent.
  - [ ] Subtask 3.1.2: Define the structure for tokenUsage collection.
    Fields: userId, totalTokens, inputTokens, outputTokens, usageHistory.

- [ ] Task 3.2: Implement Collection Creation
  - [ ] Subtask 3.2.1: Set up Firestore rules for the new collections.
  - [ ] Subtask 3.2.2: Initialize documents in tokenUsage for existing users.
    Script to iterate through users and create corresponding tokenUsage documents if they don't exist.

- [ ] Task 3.3: Update Existing users Collection
  - [ ] Subtask 3.3.1: Modify users documents to reference both assistants and openaiAssistants.
    Add separate arrays: vapiAssistants and openaiAssistants.

## Sprint 4: Backend API Development

- [ ] Task 4.1: Create API Endpoint for OpenAI Assistant Creation
  - [ ] Subtask 4.1.1: Set up pages/api/openai-create-assistant.ts.
  - [ ] Subtask 4.1.2: Implement form parsing and validation.
  - [ ] Subtask 4.1.3: Generate unique assistant IDs and store assistant details in openaiAssistants.
  - [ ] Subtask 4.1.4: Initialize tokenUsage tracking for the user.

- [ ] Task 4.2: Develop API Endpoints for Token Usage Tracking
  - [ ] Subtask 4.2.1: Create middleware to intercept OpenAI API interactions and capture token usage.
  - [ ] Subtask 4.2.2: Implement logic to update openaiAssistants and tokenUsage collections based on token consumption.
  - [ ] Subtask 4.2.3: Create endpoints to fetch token usage data for the frontend.

- [ ] Task 4.3: Implement Additional API Endpoints (Optional)
  - [ ] Subtask 4.3.1: Develop endpoints for fetching, updating, and deleting OpenAI assistants.
  - [ ] Subtask 4.3.2: Create endpoints for billing and payment processing integration (e.g., Stripe).

## Sprint 5: Frontend Development

- [ ] Task 5.1: Update Landing Page (src/components/landing-page.tsx)
  - [ ] Subtask 5.1.1: Add options for creating assistants via vapi.ai or OpenAI Realtime API.
  - [ ] Subtask 5.1.2: Modify the "Create Assistant" button to present creation method choices.
  - [ ] Subtask 5.1.3: Adjust the form submission handler to direct requests to the appropriate API endpoint based on user selection.

- [ ] Task 5.2: Develop OpenAI Assistant Detail Page
  - [ ] Subtask 5.2.1: Utilize src/components/OpenAIRealtimePrototype.tsx as the foundation.
  - [ ] Subtask 5.2.2: Integrate form elements for managing OpenAI assistants (e.g., editing prompts, viewing token usage).
  - [ ] Subtask 5.2.3: Ensure seamless interaction with the OpenAI Realtime API within this component.

- [ ] Task 5.3: Update Dashboard Page (src/components/dashboard-page.tsx)
  - [ ] Subtask 5.3.1: Modify useAssistants hook to fetch assistants from both assistants and openaiAssistants collections.
  - [ ] Subtask 5.3.2: Differentiate between vapi.ai and OpenAI assistants in the UI (e.g., labels, icons).
  - [ ] Subtask 5.3.3: Display aggregated usage data, combining minute-based and token-based metrics.

- [ ] Task 5.4: Create TokenUsageDisplay Component
  - [ ] Subtask 5.4.1: Develop src/components/TokenUsageDisplay.tsx to visualize token usage.
  - [ ] Subtask 5.4.2: Integrate this component into assistant detail pages and the dashboard.

- [ ] Task 5.5: Enhance User Interface for Billing Information
  - [ ] Subtask 5.5.1: Create BillingPage.tsx to display invoices and billing history.
  - [ ] Subtask 5.5.2: Integrate billing information into user profiles or dashboards as needed.

## Sprint 6: Token Usage Tracking

- [ ] Task 6.1: Implement Token Tracking in Backend
  - [ ] Subtask 6.1.1: Develop utility functions to calculate token usage.
  - [ ] Subtask 6.1.2: Integrate token tracking within API interactions with OpenAI Realtime API.
  - [ ] Subtask 6.1.3: Update Firestore documents (openaiAssistants and tokenUsage) with token consumption data.

- [ ] Task 6.2: Display Token Usage in Frontend
  - [ ] Subtask 6.2.1: Utilize TokenUsageDisplay component to show total, input, and output tokens.
  - [ ] Subtask 6.2.2: Implement usage history logs with timestamps and descriptions.

## Sprint 7: Billing Integration

- [ ] Task 7.1: Define Billing Logic
  - [ ] Subtask 7.1.1: Establish a conversion rate from tokens to minutes (e.g., 60 tokens = 1 minute).
  - [ ] Subtask 7.1.2: Set billing rates (e.g., $0.45 per minute).

- [ ] Task 7.2: Implement Billing Calculations
  - [ ] Subtask 7.2.1: Create utility functions to calculate billing amounts based on token usage.
  - [ ] Subtask 7.2.2: Integrate billing calculations within backend processes.

- [ ] Task 7.3: Set Up Payment Processing (Optional)
  - [ ] Subtask 7.3.1: Integrate with a payment gateway like Stripe.
  - [ ] Subtask 7.3.2: Develop API endpoints for handling payments and subscriptions.
  - [ ] Subtask 7.3.3: Create frontend components for managing payments and viewing invoices.

- [ ] Task 7.4: Automate Monthly Billing (Optional)
  - [ ] Subtask 7.4.1: Develop Firebase Cloud Functions to generate monthly invoices based on token usage.
  - [ ] Subtask 7.4.2: Automate the reset of token usage counters after billing cycles.

## Sprint 8: Security Enhancements

- [ ] Task 8.1: Update Firestore Security Rules
  - [ ] Subtask 8.1.1: Define access rules for openaiAssistants and tokenUsage collections.
  - [ ] Subtask 8.1.2: Ensure only authenticated users can access their own data.
  - [ ] Subtask 8.1.3: Implement admin-level access controls where necessary.

- [ ] Task 8.2: Secure API Endpoints
  - [ ] Subtask 8.2.1: Implement authentication middleware to protect API routes.
  - [ ] Subtask 8.2.2: Validate and sanitize all incoming data to prevent security vulnerabilities.

## Future Enhancements (Post-MVP)

- [ ] Implement team collaboration features
- [ ] Develop API for third-party integrations
- [ ] Create marketplace for assistant templates and plugins
- [ ] Implement advanced AI model fine-tuning capabilities
- [ ] Develop mobile application for on-the-go assistant management
- [ ] Explore integration of other AI providers and compare performance

This roadmap is subject to change based on user feedback, technical challenges, and evolving project priorities. It will be reviewed and updated at the end of each sprint.