// pages/api/realtime-relay.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { Server as WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { admin } from '../../src/lib/firebase-admin'; // Import Firebase Admin SDK
import url from 'url';

const WebSocketServerInstance = new WebSocketServer({ noServer: true });

const handler = (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'GET') {
    if (res.socket && 'server' in res.socket) {
      const server = res.socket.server as any;
      if (!server.upgradeHandled) {
        server.on('upgrade', async (request: IncomingMessage, socket: Socket, head: Buffer) => {
          // Parse the query parameters to get assistantId
          const { query } = url.parse(request.url || '', true);
          const assistantId = query.assistantId as string;

          // Retrieve the assistant's API key from Firestore
          let apiKey = process.env.OPENAI_API_KEY;

          try {
            const db = admin.firestore();
            const assistantDoc = await db.collection('openaiAssistants').doc(assistantId).get();

            if (assistantDoc.exists) {
              const assistantData = assistantDoc.data();
              if (assistantData && assistantData.apiKey) {
                apiKey = assistantData.apiKey;
              }
            } else {
              console.error('Assistant document not found');
            }
          } catch (error) {
            console.error('Error fetching assistant data:', error);
          }

          WebSocketServerInstance.handleUpgrade(request, socket, head, (ws) => {
            WebSocketServerInstance.emit('connection', ws, request, apiKey);
          });
        });
        server.upgradeHandled = true;
      }
    }
    res.status(200).end();
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
};

function logMessage(direction: string, message: any) {
  if (typeof message === 'string') {
    try {
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.type === 'input_audio_buffer.append' || parsedMessage.type === 'response.audio.delta') {
        console.log(`${direction} audio data: ${parsedMessage.type}`);
      } else {
        console.log(`${direction} message:`, JSON.stringify(parsedMessage, null, 2));
      }
    } catch (error) {
      console.log(`${direction} message (unparseable):`, message);
    }
  } else {
    console.log(`${direction} message (non-string):`, message);
  }
}

WebSocketServerInstance.on('connection', (clientSocket: WebSocket, request: IncomingMessage, apiKey: string) => {
  console.log('Client connected to relay server.');

  if (!apiKey) {
    console.error('OpenAI API key is not available');
    clientSocket.close(1008, 'API key not configured');
    return;
  }

  // Connect to OpenAI Realtime API
  const openaiSocket = new WebSocket('wss://api.openai.com/v1/realtime', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  // Relay messages from client to OpenAI API
  clientSocket.on('message', (message) => {
    logMessage('Sent to OpenAI API', message);

    if (openaiSocket.readyState === WebSocket.OPEN) {
      openaiSocket.send(message);
    } else {
      console.log('OpenAI socket not ready, queueing message');
      openaiSocket.once('open', () => {
        openaiSocket.send(message);
        console.log('Sent queued message to OpenAI API');
      });
    }
  });

  // Relay messages from OpenAI API to client
  openaiSocket.on('message', (message) => {
    logMessage('Received from OpenAI API', message);

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(message);
    } else {
      console.log('Client socket not ready, message not sent');
    }
  });

  // Handle OpenAI socket events
  openaiSocket.on('open', () => {
    console.log('Connected to OpenAI Realtime API.');
  });

  openaiSocket.on('close', (code, reason) => {
    console.log(`OpenAI socket closed: ${code} - ${reason}`);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close();
    }
  });

  openaiSocket.on('error', (error) => {
    console.error('OpenAI socket error:', error);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close(1011, 'OpenAI socket error');
    }
  });

  // Handle client socket events
  clientSocket.on('close', (code, reason) => {
    console.log(`Client socket closed: ${code} - ${reason}`);
    if (openaiSocket.readyState === WebSocket.OPEN) {
      openaiSocket.close();
    }
  });

  clientSocket.on('error', (error) => {
    console.error('Client socket error:', error);
    if (openaiSocket.readyState === WebSocket.OPEN) {
      openaiSocket.close(1011, 'Client socket error');
    }
  });
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default handler;
