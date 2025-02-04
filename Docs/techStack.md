# Technology Stack

This document outlines the current technology choices for the SimplyTalk.ai dashboard project and the rationale behind these choices.

## Frontend

1. **Next.js**
   - Rationale: Provides server-side rendering, API routes, and excellent TypeScript support.
   - Version: [Insert current version]

2. **React**
   - Rationale: Component-based architecture, large ecosystem, and seamless integration with Next.js.
   - Version: [Insert current version]

3. **TypeScript**
   - Rationale: Adds static typing to JavaScript, improving code quality and developer experience.
   - Version: [Insert current version]

4. **Tailwind CSS**
   - Rationale: Utility-first CSS framework for rapid UI development and easy customization.
   - Version: [Insert current version]

## Backend

1. **Node.js**
   - Rationale: JavaScript runtime that allows for full-stack JavaScript development.
   - Version: [Insert current version]

2. **Firebase**
   - Authentication: Provides secure and easy-to-implement user authentication.
   - Firestore: NoSQL database for storing user and assistant data.
   - Rationale: Scalable, real-time database with good integration with Next.js and React.
   - Version: [Insert current version]

## API Integration

1. **vapi.ai SDK**
   - Rationale: Official SDK for interacting with vapi.ai services.
   - Version: [Insert current version]

2. **OpenAI Realtime API (Beta)**
   - Rationale: Enables real-time, streaming interactions with OpenAI's language models.
   - Implementation: 
     - Custom WebSocket server integrated with Next.js for handling real-time communication.
     - Uses `@openai/realtime-api-beta` package for client-side interactions.
     - Server-side implementation in `server/websocket-server.ts` handles WebSocket connections and relays messages between the client and OpenAI.
     - Custom `server.js` file to run both Next.js and WebSocket server concurrently.
   - Version: Beta (as of implementation)
   - Key Components:
     - `OpenAIRealtimePrototype.tsx`: React component for demonstrating real-time chat capabilities.
     - `pages/api/realtime-relay.ts`: API route for WebSocket upgrade and connection handling.
     - `server/websocket-server.ts`: WebSocket server implementation for OpenAI Realtime API.

## Payment Processing

1. **Stripe**
   - Rationale: Robust payment processing with excellent documentation and developer experience.
   - Version: [Insert current version]

## Development Tools

1. **ESLint**
   - Rationale: Linting tool to enforce code quality and consistency.
   - Version: [Insert current version]

2. **Prettier**
   - Rationale: Code formatter to ensure consistent code style across the project.
   - Version: [Insert current version]

3. **Jest**
   - Rationale: JavaScript testing framework with good React integration.
   - Version: [Insert current version]

4. **ts-node**
   - Rationale: Enables running TypeScript files directly, used for the custom server setup.
   - Version: [Insert current version]

## Deployment

1. **Vercel**
   - Rationale: Seamless deployment and hosting platform optimized for Next.js applications.
   - Version: N/A (Platform service)

## Version Control

1. **Git**
   - Rationale: Distributed version control system for tracking changes and collaborating.
   - Version: [Insert current version]

2. **GitHub**
   - Rationale: Hosting service for Git repositories with additional collaboration features.
   - Version: N/A (Platform service)

This tech stack is subject to change as the project evolves. Any major changes will be documented here along with the rationale for the change.