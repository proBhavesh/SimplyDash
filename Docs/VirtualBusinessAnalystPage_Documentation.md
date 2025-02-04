# VirtualBusinessAnalystPage Documentation

## Overview

The `VirtualBusinessAnalystPage` component is a specialized public page designed for the `virtual_business_analyst` assistant template in our application. Its primary purpose is to provide a user-friendly interface that allows users to upload PDF documents containing user stories or requirements. The page facilitates the processing of these documents, optimizes and prioritizes the user stories, interacts with external services like Jira, and integrates with the assistant to fetch and display the most critical issues.

This component supports the assistant workflow by automating the complex process of transforming user-provided documents into actionable items within a project management system. It serves as a bridge between the user's initial input (the PDF document) and the assistant's ability to provide valuable insights and updates based on that input.

## Workflow Sequence

The `VirtualBusinessAnalystPage` operates through a series of interconnected functions and state updates, guiding the user from uploading a document to viewing the final processed results. Below is a detailed sequence of operations:

1. **PDF Upload**

   - **File Selection**
     - **Component Interaction**: The user selects a PDF file using the `<input>` element.
     - **State Update**: The `handlePdfFileChange` event handler updates the `pdfFile` state with the selected file.
   - **Upload Initiation**
     - **User Action**: The user clicks the "Upload PDF" button.
     - **Function Call**: `handleUploadPdf` is invoked.
     - **State Updates**:
       - Sets `isProcessing` to `true` to indicate that processing has started.
       - Resets `uploadProgress` to `0`.
       - Clears any existing `error` messages.
     - **File Upload**:
       - Creates a `FormData` object and appends the selected PDF file.
       - Sends a POST request to `/api/upload-pdf` with the form data.
       - Monitors upload progress and updates `uploadProgress` accordingly.

2. **Trigger Archy Upload**

   - **Function Call**: After a successful file upload, `triggerArchyUpload` is called.
   - **API Interaction**:
     - Sends a POST request to `https://c5kpj2.buildship.run/archyupload`.
     - **Request Body**:
       ```json
       {
         "message": "extract the content for all Case Types in the document as instructed"
       }
       ```
     - This message instructs the processing service to extract content for all case types as per the given instructions.
   - **Response Handling**:
     - If the response status is `200`, the function automatically proceeds to call `processJiraSubtasks()` without additional conditions.
     - If the response indicates an error, the function updates the `error` state and sets `isProcessing` to `false`.

3. **Process Jira Subtasks**

   - **Function Call**: `processJiraSubtasks` initiates the processing of Jira subtasks.
   - **API Interaction**:
     - Sends a POST request to `/api/process_jira_subtasks`.
   - **Response Handling**:
     - Expects a response indicating the processing status.
     - If the status is `'processing'`, `'success'`, or `'idle'`, sets up an SSE connection to receive updates.
     - If unexpected data is received, sets an `error` message and stops processing.

4. **Server-Sent Events (SSE) for Processing Updates**

   - **Function Call**: `setupSSEConnection` sets up an SSE connection to receive real-time updates on the processing status.
   - **API Interaction**:
     - Opens an SSE connection to `/api/stream_optimization_status`.
   - **Event Handling**:
     - **On Open**: Logs a message indicating the connection is open and resets the retry count.
     - **On Message**:
       - Parses the incoming data and updates `processStatus` if the data has changed.
       - If the status is `'completed'`, `'failed'`, or `'success'`, updates `processStatus`, stops the SSE connection, and calls `notifyAssistant`.
     - **On Error**:
       - Logs the error and updates the `error` state.
       - Attempts to reconnect if the retry count is below the maximum limit.

5. **Notify Assistant**

   - **Function Call**: `notifyAssistant` is invoked after processing is complete.
   - **API Interaction**:
     - Sends a POST request to `/api/realtime-relay` with:
       - `assistantId`: The ID of the assistant to notify.
       - `message`: A prompt indicating that user stories have been optimized and requesting the assistant to fetch P1 issues.
   - **State Update**:
     - Appends a formatted message to the `transcript` state, including details from `processingResult`.
   - **Error Handling**:
     - Updates the `error` state if the notification fails.

6. **UI Updates and User Feedback**

   - **Progress Indicators**:
     - Displays upload progress using a progress bar tied to `uploadProgress`.
     - Shows processing messages and notes based on `processStatus`.
   - **Error Messages**:
     - Renders any errors stored in the `error` state within a styled container for visibility.
   - **Transcript Display**:
     - Updates the conversation area with messages exchanged between the user and the assistant.
     - Provides a running log of interactions and results.

7. **Cleanup and Reset**

   - **Component Unmounting**:
     - Uses `useEffect` to clean up the SSE connection when the component is unmounted.
   - **State Reset**:
     - After processing is complete, users may choose to upload a new PDF, resetting relevant states (`pdfFile`, `uploadProgress`, `processStatus`, etc.).

## End Goal

The ultimate goal of the `VirtualBusinessAnalystPage` is to streamline the workflow of transforming user-provided documentation into actionable tasks within a project management system, specifically Jira. By automating the upload and processing of PDF documents containing user stories, the component reduces manual effort and speeds up project initiation and management.

This page achieves the following:

- **Automates Complex Processes**: Handles the end-to-end sequence from document upload to assistant notification without requiring manual intervention at each step.
- **Integrates Multiple Services**:
  - **Internal APIs**: Interacts with custom API endpoints like `/api/upload-pdf`, `/api/process_jira_subtasks`, and `/api/realtime-relay`.
  - **External Services**: Communicates with external APIs like the Archy upload service and Jira processing endpoint.
- **Enhances User Experience**:
  - Provides real-time feedback and status updates to keep the user informed.
  - Displays errors clearly to assist in troubleshooting.
  - Offers a conversational interface via the assistant to present final results and insights.

By unifying these operations within a single, cohesive interface, the `VirtualBusinessAnalystPage` simplifies the user's workflow, allowing them to focus on higher-level tasks rather than the technical details of data processing and integration. It serves as a critical component that ties together document management, data processing, and intelligent assistance within the broader application ecosystem.
