# OpenAI Assistant Display and Function Calling Implementation

## Display and Consistency

The OpenAI assistant is displayed across three main areas in the application, each serving a different purpose while maintaining visual and functional consistency:

### 1. Embedded Assistant (`public/embed.js` and `pages/embed/[workspaceId]/[assistantName].tsx`)
- Provides a lightweight, embeddable version of the assistant
- Maintains consistent avatar display using the same GIF assets:
  ```javascript
  const imageSrc = isAssistantSpeaking 
    ? assistantData?.talkingGifUrl || '/static/yubotot.gif'
    : assistantData?.waitingGifUrl || '/static/yuboto.gif';
  ```
- Features a minimalist interface with just the essential elements:
  - Avatar
  - Connect/Disconnect button
  - Audio visualization
  - Microphone status indicator

### 2. Assistant Detail Page (`src/components/OpenAIAssistantDetailPage.tsx`)
- Provides a full-featured management interface for assistant configuration
- Includes the same avatar display logic but with additional controls:
  ```javascript
  const renderAvatar = () => {
    const imageSrc = isAssistantSpeaking && !isMicrophoneActive
      ? assistantData?.talkingGifUrl || '/static/yubotot.gif'
      : assistantData?.waitingGifUrl || '/static/yuboto.gif';
    return (
      <div className="relative w-32 h-32 mx-auto mb-4 cursor-pointer">
        <Image src={imageSrc} alt="Avatar" width={128} height={128} />
      </div>
    );
  };
  ```
- Features comprehensive controls and settings:
  - Avatar customization
  - Voice settings
  - Instructions management
  - Analytics display
  - Training content management

### 3. Public Assistant Page (`pages/[workspaceId]/[assistantName].tsx`)
- Provides a public-facing interface for end users
- Maintains the same avatar consistency:
  ```javascript
  const renderAvatar = () => {
    const imageSrc = isAssistantSpeaking && !isMicrophoneActive
      ? assistantData?.talkingGifUrl || '/static/yubotot.gif'
      : assistantData?.waitingGifUrl || '/static/yuboto.gif';
    return (
      <div className="relative w-64 h-64 mx-auto mb-4">
        <Image src={imageSrc} alt="Avatar" width={256} height={256} />
      </div>
    );
  };
  ```
- Includes:
  - Avatar display
  - Connection controls
  - Audio visualization
  - Conversation display

## Supporting Scripts and Their Roles

### 1. OpenAI Assistant Config (`pages/api/openai-assistant-config.ts`)
- Manages assistant configuration retrieval
- Provides essential settings for all display contexts:
  ```typescript
  const config = {
    workspaceId: workspaceId,
    assistantName: assistantName,
    assistantId: assistantDoc.id,
    waitingGifUrl: assistantData.waitingGifUrl,
    talkingGifUrl: assistantData.talkingGifUrl,
    makeWebhookUrl: assistantData.makeWebhookUrl,
    instructions: assistantData.instructions || '',
    voiceSettings: assistantData.voiceSettings || 'alloy',
    threshold: assistantData.threshold !== undefined ? assistantData.threshold : 0.5,
    prefix_padding_ms: assistantData.prefix_padding_ms !== undefined ? assistantData.prefix_padding_ms : 500,
    silence_duration_ms: assistantData.silence_duration_ms !== undefined ? assistantData.silence_duration_ms : 300,
    temperature: assistantData.temperature !== undefined ? assistantData.temperature : 0.6,
    modalities: assistantData.modalities || ['audio'],
    input_audio_format: assistantData.input_audio_format || 'pcm_s16le',
    output_audio_format: assistantData.output_audio_format || 'pcm_s16le',
    input_audio_transcription: assistantData.input_audio_transcription || {
      model: 'whisper-1',
    },
    turn_detection: assistantData.turn_detection || {
      type: 'server_vad',
      threshold: assistantData.threshold !== undefined ? assistantData.threshold : 0.5,
      prefix_padding_ms: assistantData.prefix_padding_ms !== undefined ? assistantData.prefix_padding_ms : 500,
      silence_duration_ms: assistantData.silence_duration_ms !== undefined ? assistantData.silence_duration_ms : 300,
    },
    tool_choice: assistantData.tool_choice || 'auto',
    functionDefinitions: assistantData.functionDefinitions || [],
  };
  ```

### 2. Embed Script (`public/embed.js`)
- Enables third-party website integration
- Creates and manages the embedded assistant frame:
  ```javascript
  function createAssistantFrame(config) {
    const container = document.createElement('div');
    container.id = 'assistant-container';
    // ... container styling ...

    const chatIcon = document.createElement('div');
    // ... chat icon creation and styling ...

    const frame = document.createElement('iframe');
    frame.id = 'assistant-frame';
    frame.src = `${config.baseUrl}/embed/${config.workspaceId}/${config.assistantName}`;
    frame.allow = "microphone; autoplay";
    // ... frame styling ...

    container.appendChild(frame);
    container.appendChild(chatIcon);
    document.body.appendChild(container);
  }
  ```

### 3. Realtime Connection (`src/components/OpenAIRealtimePrototype/useRealtimeConnection.ts`)
- Manages WebSocket connections for real-time communication
- Defines and manages function calls:
  ```typescript
  const sendSessionUpdate = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const sessionUpdateEvent = {
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'],
          instructions: instructions,
          voice: config.voiceSettings,
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1',
          },
          turn_detection: {
            type: 'server_vad',
            threshold: config.threshold,
            prefix_padding_ms: config.prefixPaddingMs,
            silence_duration_ms: config.silenceDurationMs,
          },
          tool_choice: 'auto',
          temperature: config.temperature,
          tools: [
            {
              type: 'function',
              name: 'question_and_answer',
              description: 'Get answers to customer questions',
              parameters: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                },
                required: ['question'],
              },
            },
            {
              type: 'function',
              name: 'book_tow',
              description: 'Book a service for a customer',
              parameters: {
                type: 'object',
                properties: {
                  address: { type: 'string' },
                },
                required: ['address'],
              },
            },
          ],
        },
      };
      wsRef.current.send(JSON.stringify(sessionUpdateEvent));
    }
  }, [instructions, config, wsRef]);
  ```

### 4. Function Call Handler (`pages/api/function-call-handler.ts`)
- Processes function calls from the assistant
- Routes function calls to appropriate handlers:
  ```typescript
  const functionRoutes = {
    'question_and_answer': '3',
    'book_tow': '4',
  };

  export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { functionName, arguments: args, threadId } = req.body;

    const route = functionRoutes[functionName];
    if (!route) {
      return res.status(400).json({ error: `Unknown function called: ${functionName}` });
    }

    const payload = {
      route: route,
      data1: '',
      data2: '',
    };

    try {
      if (functionName === 'question_and_answer') {
        const question = args.question;
        payload.data1 = question;
        payload.data2 = threadId || '';
      } else if (functionName === 'book_tow') {
        const address = args.address;
        payload.data1 = address;
      }

      const response = await fetch(process.env.NEXT_PUBLIC_MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const responseText = await response.text();
        return res.status(200).json({ result: responseText });
      } else {
        return res.status(500).json({ error: 'Webhook request failed' });
      }
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  ```

## Function Definitions and Implementation Flow

### 1. Core Function Definitions
The core function definitions are centralized in `src/components/OpenAIRealtimePrototype/useRealtimeConnection.ts`. These definitions are sent to the OpenAI API during session initialization through the `sendSessionUpdate` function shown above.

### 2. Function Call Flow Across Display Contexts

#### A. Assistant Configuration and ID Flow
1. Each assistant instance is identified by an `assistantId` stored in Firestore
2. The assistant configuration is retrieved through `/api/openai-assistant-config.ts`:
   ```typescript
   const assistantQuerySnapshot = await db
     .collection('openaiAssistants')
     .where('workspaceId', '==', workspaceId)
     .where('name', '==', assistantName)
     .where('isPublished', '==', true)
     .limit(1)
     .get();

   const assistantDoc = assistantQuerySnapshot.docs[0];
   const assistantData = assistantDoc.data();
   ```

3. This configuration is used by all display contexts through their respective components.

#### B. Function Execution Flow
1. When a function is called by the OpenAI API, it's handled in `useRealtimeConnection.ts`:
   ```typescript
   case 'response.function_call_arguments.done': {
     const functionName = data.name;
     const args = JSON.parse(data.arguments);
     const handlerResponse = await sendToFunctionCallHandler(functionName, args);
     
     const parsedResponse = JSON.parse(handlerResponse);
     const message = parsedResponse.message || "I'm sorry, I couldn't process your request.";

     if (parsedResponse.thread) {
       threadIdRef.current = parsedResponse.thread;
     }

     const functionOutputEvent = {
       type: 'conversation.item.create',
       item: {
         type: 'function_call_output',
         call_id: data.call_id,
         output: message,
       },
     };
     wsRef.current?.send(JSON.stringify(functionOutputEvent));
   }
   ```

### 3. Display-Specific Implementation Details

#### A. Embedded Assistant Implementation
In `pages/embed/[workspaceId]/[assistantName].tsx`:
```typescript
const RELAY_SERVER_URL = `/api/realtime-relay?assistantId=${encodeURIComponent(assistantData?.assistantId || '')}`;

const {
  isConnected,
  isLoading,
  error: connectionError,
  isMicrophoneActive,
  connectConversation,
  disconnectConversation,
  handleInterruption,
} = useRealtimeConnection(
  RELAY_SERVER_URL,
  assistantData?.instructions || '',
  updateTokenUsage,
  wavStreamPlayerRef,
  config,
  assistantData?.assistantId || ''
);
```

#### B. Public Assistant Page Implementation
In `pages/[workspaceId]/[assistantName].tsx`:
```typescript
const {
  isConnected,
  isLoading,
  error: connectionError,
  conversationItems,
  realtimeEvents,
  rateLimits: connectionRateLimits,
  isMicrophoneActive: isMicrophoneActiveFromHook,
  sessionId: hookSessionId,
  conversationId: hookConversationId,
  connectConversation,
  disconnectConversation,
  handleInterruption,
} = useRealtimeConnection(
  RELAY_SERVER_URL,
  assistantData?.instructions || '',
  updateTokenUsage,
  wavStreamPlayerRef,
  config,
  assistantId
);
```

#### C. Assistant Detail Page Implementation
In `src/components/OpenAIAssistantDetailPage.tsx`:
```typescript
const {
  isConnected,
  isLoading,
  error: connectionError,
  conversationItems,
  realtimeEvents,
  rateLimits,
  isMicrophoneActive,
  sessionId,
  conversationId,
  connectConversation,
  disconnectConversation,
  handleInterruption,
  isAssistantStreaming,
  setIsAssistantStreaming,
} = useRealtimeConnection(
  RELAY_SERVER_URL,
  assistantInstructions,
  updateTokenUsageCallback,
  wavStreamPlayerRef,
  config,
  assistantId
);
```

## Adding New Functions

To add a new function to the system:

1. Add the function definition in `src/components/OpenAIRealtimePrototype/useRealtimeConnection.ts`:
```javascript
// In the sendSessionUpdate function's tools array
{
  type: 'function',
  name: 'new_function_name',
  description: 'Description of what the function does',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string' },
      param2: { type: 'number' },
      // Add more parameters as needed
    },
    required: ['param1']
  }
}
```

2. Add the function route in `pages/api/function-call-handler.ts`:
```javascript
const functionRoutes = {
  'question_and_answer': '3',
  'book_tow': '4',
  'new_function_name': '5', // Add new route
};
```

3. Implement the function handling logic in the same file:
```javascript
if (functionName === 'new_function_name') {
  const param1 = args.param1;
  const param2 = args.param2;
  
  payload.data1 = param1;
  payload.data2 = param2;
  
  // Add any additional processing logic
  console.log('Processing new function:', { param1, param2 });
}
```

4. The function will automatically be available across all display contexts because they all use the same `useRealtimeConnection` hook.

## Best Practices for Function Implementation

1. Keep function definitions centralized in `useRealtimeConnection.ts`
2. Maintain clear parameter documentation in the function definitions
3. Implement proper error handling in the function-call-handler
4. Use type-safe parameter validation
5. Maintain webhook payload consistency
6. Test functions across all display contexts
7. Monitor function usage through the assistant detail page
8. Keep function names consistent across all components
9. Document any new functions in the assistant configuration
10. Implement proper error responses for failed function calls
