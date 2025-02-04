# Public Page Templating Guide

This document explains how the public page templating system works in our application and provides details on the `VirtualBusinessAnalystPage` component.

## Overview

Our assistant system allows users to select from predefined templates when creating and publishing OpenAI-powered assistants. The public page displayed for each assistant adapts its design and functionality based on the selected assistant template, creating a custom experience for each assistant type.

## Templating System

### Dynamic Route

The dynamic route `pages/[workspaceId]/[assistantName].tsx` is responsible for rendering the public page of an assistant. It fetches the assistant data from Firestore, including the template information, and determines which component to render based on the assistant's template.

### Template Components Mapping

A `templateComponents` object maps assistant templates to their corresponding components:

```typescript
import VirtualBusinessAnalystPage from '../../src/components/VirtualBusinessAnalystPage';
import DefaultAssistantPage from '../../src/components/DefaultAssistantPage';
// Import other assistant components as needed

const templateComponents: { [key: string]: React.FC<any> } = {
  virtual_business_analyst: VirtualBusinessAnalystPage,
  default: DefaultAssistantPage,
  // Add other templates here
  // other_template: OtherTemplatePage,
};
```

The template is extracted from the assistant data and used to select the appropriate component:

```typescript
const template = assistantData?.template || 'default';
const TemplateComponent = templateComponents[template];

if (TemplateComponent) {
  return <TemplateComponent assistantData={assistantData} />;
}

// Render the default assistant page if no specific template is found
return <DefaultAssistantPage assistantData={assistantData} />;
```

### Adding New Templates

To add a new assistant template:

1. **Create a New Component**: Develop a new component for the template in `src/components/`, e.g., `NewTemplatePage.tsx`.

2. **Import the Component**: Import the new component in `pages/[workspaceId]/[assistantName].tsx`.

3. **Update Template Mapping**: Add the new template to the `templateComponents` mapping:

   ```typescript
   import NewTemplatePage from '../../src/components/NewTemplatePage';

   const templateComponents: { [key: string]: React.FC<any> } = {
     virtual_business_analyst: VirtualBusinessAnalystPage,
     new_template: NewTemplatePage,
     default: DefaultAssistantPage,
   };
   ```

4. **Set Assistant Template**: Ensure that the assistant's `template` field in Firestore matches the key used in the `templateComponents` object.

## VirtualBusinessAnalystPage Component

### Purpose

The `VirtualBusinessAnalystPage` component provides a custom public page for assistants using the `virtual_business_analyst` template. It incorporates specific design and functionality tailored to this assistant type, including an updated Jira processing workflow.

### Features

- **PDF Upload**: Allows users to upload a PDF document containing user stories or requirements.
- **Vector Store Creation**: Processes the uploaded PDF to create a vector store for AI analysis.
- **Jira Subtask Processing**: Initiates processing of Jira subtasks based on the vector store data.
- **Progress Feedback**: Displays real-time progress and status updates during processing.
- **Assistant Notification**: Notifies the assistant upon completion of processing to fetch prioritized issues.
- **Transcript Display**: Shows the conversation between the user and the assistant.
- **Responsive Design**: Adapts to various screen sizes for an optimal user experience.

### Workflow

1. **Upload PDF Document**

   - **File Selection**: Users select a PDF file using an `<input>` element.
   - **Event Handling**: `handlePdfFileChange` updates the state with the selected file.
   - **Upload Initiation**: Upon clicking the upload button, `handleUploadPdf` is called to upload the file.

2. **Create Vector Store**

   - **API Call**: `createVectorStore` sends a POST request to `/api/create-vector-store` with the `fileId`.
   - **Response Handling**: Receives a `vectorStoreId` for the next steps.

3. **Trigger Archy Upload**

   - **External API Call**: `triggerArchyUpload` sends a POST request to an external service with the `vectorStoreId`.
   - **Proceed to Processing**: If successful, moves on to processing Jira subtasks.

4. **Process Jira Subtasks**

   - **API Call**: `processJiraSubtasks` sends a POST request to initiate Jira subtask processing.
   - **Status Check**: Verifies if the processing has started and begins polling for updates.

5. **Polling for Status Updates**

   - **Polling Setup**: `startPolling` sets up intervals to poll `/api/get-processing-status`.
   - **UI Updates**: Updates the UI based on the current processing status.
   - **Completion Check**: Stops polling when processing is complete.

6. **Notify Assistant**

   - **Assistant Interaction**: `notifyAssistant` sends a message to the assistant to fetch P1 issues.
   - **Transcript Update**: Updates the transcript with the assistant's response and processing results.

### Component Structure

- **State Management**: Uses React `useState` hooks to manage state variables like `pdfFile`, `uploadProgress`, `isProcessing`, `processStatus`, `error`, and `transcript`.

- **Effect Hooks**: Utilizes `useEffect` to clean up polling intervals on component unmount.

- **Event Handlers**:

  - `handlePdfFileChange`: Handles file selection.
  - `handleUploadPdf`: Manages the file upload process.
  - `createVectorStore`: Initiates vector store creation.
  - `triggerArchyUpload`: Triggers external processing.
  - `processJiraSubtasks`: Starts Jira processing.
  - `startPolling`: Polls for processing status.
  - `notifyAssistant`: Communicates with the assistant.

- **Rendering Logic**: Uses conditional rendering to display components based on the current state, such as loading indicators, error messages, and processing status.

### User Interface

- **Left Section**:

  - **Assistant Details**: Displays the assistant's name and image.
  - **Transcript Area**: Shows the conversation transcript between the user and the assistant.
  - **Voice Visualizations**: Placeholder for future implementation of voice activity visualizations.

- **Right Section**:

  - **Instructions**: Provides a step-by-step guide on how to use the assistant.
  - **File Upload**: Includes an input field for selecting a PDF file and an upload button.
  - **Progress Indicators**: Shows upload progress and processing status messages.
  - **Error Handling**: Displays error messages within a styled container.

### Technologies Used

- **React**: Functional components and hooks for state and lifecycle management.
- **Axios**: For making HTTP requests to APIs and external services.
- **Next.js**: Integration within a Next.js application for routing and server-side rendering.
- **TypeScript**: Provides static typing for safer code and better developer experience.
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development and responsive design.

## Conclusion

The public page templating system enhances the user experience by providing customized public pages for different assistant templates. The `VirtualBusinessAnalystPage` is a tailored component that offers specific functionalities required by a virtual business analyst assistant, such as processing user stories and integrating with Jira workflows.

By structuring the templating system with a dynamic route and a template components mapping, we can easily add new templates and customize public pages without disrupting existing functionality.
