import type { ConversationItem } from '../types';
import { saveMessageToFirestore } from './firestore';

export const sendToFunctionCallHandler = async (
  functionName: string,
  args: any,
  threadId: string
): Promise<string> => {
  try {
    console.log('Sending function call to handler:', functionName, args);

    const response = await fetch('/api/function-call-handler', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        functionName,
        arguments: args,
        threadId,
      }),
    });

    if (!response.ok) {
      throw new Error('Function handler request failed');
    }

    const data = await response.json();
    console.log('Function call handler response:', data);
    return data.result;
  } catch (error) {
    console.error('Error calling function handler:', error);
    throw error;
  }
};

export const handleFunctionCallResponse = async (
  functionName: string,
  args: any,
  message: string,
  assistantId: string,
  conversationId: string,
  userIdentifier: string | null,
  accessMethod: 'phone_number' | 'web' | null
) => {
  try {
    const functionOutputItem: ConversationItem = {
      id: `function-${Date.now()}`,
      role: 'system',
      type: 'function_call_output',
      content: message,
      status: 'completed',
      formatted: {
        output: message,
        tool: {
          name: functionName,
          arguments: JSON.stringify(args),
        },
      },
    };

    await saveMessageToFirestore(
      functionOutputItem,
      assistantId,
      conversationId,
      userIdentifier,
      accessMethod
    );

    return functionOutputItem;
  } catch (error) {
    console.error('Error handling function call response:', error);
    throw error;
  }
};

export const processFunctionCallArguments = async (
  data: any,
  threadIdRef: React.MutableRefObject<string>,
  wsRef: React.MutableRefObject<WebSocket | null>,
  addRealtimeEvent: (source: 'client' | 'server', event: string) => void,
  assistantId: string,
  conversationId: string,
  userIdentifier: string | null,
  accessMethod: 'phone_number' | 'web' | null
) => {
  const functionName = data.name;
  const args = JSON.parse(data.arguments);

  try {
    const handlerResponse = await sendToFunctionCallHandler(functionName, args, threadIdRef.current);
    const parsedResponse = JSON.parse(handlerResponse);
    const message = parsedResponse.message || "I'm sorry, I couldn't process your request.";

    if (parsedResponse.thread) {
      threadIdRef.current = parsedResponse.thread;
    }

    const functionOutputItem = await handleFunctionCallResponse(
      functionName,
      args,
      message,
      assistantId,
      conversationId,
      userIdentifier,
      accessMethod
    );

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const functionOutputEvent = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: data.call_id,
          output: message,
        },
      };
      wsRef.current.send(JSON.stringify(functionOutputEvent));
      addRealtimeEvent('client', 'conversation.item.create.function_call_output');

      wsRef.current.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ['text', 'audio'],
            instructions: `Respond to the user's request based on this information: ${message}. Be concise and friendly.`,
          },
        })
      );
      addRealtimeEvent('client', 'response.create');
    }

    return functionOutputItem;
  } catch (error) {
    console.error(`Error processing function ${functionName}:`, error);
    throw error;
  }
};
