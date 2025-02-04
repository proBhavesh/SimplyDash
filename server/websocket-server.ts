import { WebSocket, WebSocketServer } from 'ws';
import { errorLogger } from '../src/utils/errorLogger.js';

const wss = new WebSocketServer({ noServer: true });

async function initializeWebSocket() {
  wss.on('connection', connectionHandler);
  return wss;
}

async function connectionHandler(ws: WebSocket) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is not set');
    errorLogger.error(error);
    ws.close(1011, 'Server configuration error');
    return;
  }

  console.log('New WebSocket connection');

  let openAIWs: WebSocket | null = null;

  // Connect to OpenAI WebSocket
  try {
    openAIWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'openai-beta': 'realtime=v1'
      },
    });
    
    openAIWs.on('open', () => {
      console.log('Connected to OpenAI WebSocket');
    });

    openAIWs.on('message', (data) => {
      // Only log message type, not the full content
      const message = JSON.parse(data.toString());
      console.debug('OpenAI message:', message.type);
      ws.send(data.toString());
    });

    openAIWs.on('close', () => {
      console.log('Disconnected from OpenAI WebSocket');
      ws.close(1000, 'OpenAI connection closed');
    });

    openAIWs.on('error', (error) => {
      console.error('OpenAI WebSocket error:', error);
      errorLogger.error(new Error(`OpenAI WebSocket error: ${error.message}`));
      ws.close(1011, 'OpenAI connection error');
    });

  } catch (error) {
    errorLogger.error(new Error(`Error connecting to OpenAI: ${(error as Error).message}`));
    ws.close(1011, 'Failed to connect to OpenAI');
    return;
  }

  // Handle messages from the client
  ws.on('message', (data) => {
    if (openAIWs?.readyState === WebSocket.OPEN) {
      openAIWs.send(data.toString());
    } else {
      console.warn('OpenAI WebSocket not ready, message not sent');
    }
  });

  ws.on('close', () => {
    console.log('Client WebSocket connection closed');
    if (openAIWs) {
      openAIWs.close();
    }
  });

  ws.on('error', (error) => {
    errorLogger.error(new Error(`Client WebSocket error: ${error.message}`));
  });
}

export { initializeWebSocket, wss };