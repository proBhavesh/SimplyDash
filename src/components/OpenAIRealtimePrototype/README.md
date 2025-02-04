# OpenAIRealtimePrototype Component

This folder contains the OpenAIRealtimePrototype component and its related subcomponents and hooks. The component has been broken down into smaller, more manageable parts for better maintainability and readability.

## File Structure

- `OpenAIRealtimePrototype.tsx`: The main component that combines all subcomponents and hooks.
- `ConversationDisplay.tsx`: Displays the conversation items.
- `AudioVisualization.tsx`: Handles the audio visualization for input and output.
- `useRealtimeConnection.ts`: Custom hook for managing the realtime connection.
- `useTokenUsage.ts`: Custom hook for managing token usage.
- `useAudioVisualization.ts`: Custom hook for managing audio visualization.
- `index.ts`: Exports all components and hooks for easy importing.

## Usage

To use the OpenAIRealtimePrototype component in your project, import it from this folder:

```typescript
import OpenAIRealtimePrototype from '../components/OpenAIRealtimePrototype';

const YourComponent = () => {
  return (
    <div>
      <OpenAIRealtimePrototype />
    </div>
  );
};
```

## Components

### ConversationDisplay

Displays the conversation items, including user and assistant messages.

### AudioVisualization

Provides visual feedback for audio input and output.

## Custom Hooks

### useRealtimeConnection

Manages the realtime connection with the OpenAI API, handling events and state related to the conversation.

### useTokenUsage

Tracks and manages token usage throughout the conversation.

### useAudioVisualization

Handles the logic for visualizing audio input and output.

## Dependencies

This component relies on the following external libraries and utilities:

- @openai/realtime-api-beta
- firebase/auth
- ../utils/conversation_config
- ../utils/firestore
- ../utils/wav_renderer
- ../lib/wavtools

Make sure these dependencies are properly installed and configured in your project.

## Note

This component is designed to work with the OpenAI Realtime API and requires proper setup and configuration of API keys and other necessary credentials. Refer to the OpenAI documentation for more information on setting up and using the Realtime API.