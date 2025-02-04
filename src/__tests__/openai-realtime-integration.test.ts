import WebSocket from 'ws';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { wss } from '../../server/websocket-server';

jest.mock('@openai/realtime-api-beta');
jest.mock('../../src/utils/errorLogger');

describe('OpenAI Realtime API Integration', () => {
  let mockWs: WebSocket;
  let mockClient: jest.Mocked<RealtimeClient>;

  beforeEach(() => {
    mockWs = {
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
    } as unknown as jest.Mocked<WebSocket>;

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      realtime: {
        on: jest.fn(),
        send: jest.fn(),
      },
    } as unknown as jest.Mocked<RealtimeClient>;

    (RealtimeClient as jest.MockedClass<typeof RealtimeClient>).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should establish a connection with OpenAI Realtime API', async () => {
    process.env.OPENAI_API_KEY = 'test-api-key';

    await new Promise<void>((resolve) => {
      wss.emit('connection', mockWs);
      setTimeout(resolve, 100);
    });

    expect(RealtimeClient).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    expect(mockClient.connect).toHaveBeenCalled();
  });

  it('should handle messages from the client', async () => {
    process.env.OPENAI_API_KEY = 'test-api-key';

    await new Promise<void>((resolve) => {
      wss.emit('connection', mockWs);
      setTimeout(resolve, 100);
    });

    const messageHandler = (mockWs.on as jest.Mock).mock.calls.find(call => call[0] === 'message')[1];
    const testMessage = JSON.stringify({ type: 'test.event', data: 'test data' });

    messageHandler(testMessage);

    expect(mockClient.realtime.send).toHaveBeenCalledWith('test.event', { type: 'test.event', data: 'test data' });
  });

  it('should handle messages from OpenAI Realtime API', async () => {
    process.env.OPENAI_API_KEY = 'test-api-key';

    await new Promise<void>((resolve) => {
      wss.emit('connection', mockWs);
      setTimeout(resolve, 100);
    });

    const serverEventHandler = (mockClient.realtime.on as jest.Mock).mock.calls.find(call => call[0] === 'server.*')[1];
    const testEvent = { type: 'server.test', data: 'test data' };

    serverEventHandler(testEvent);

    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(testEvent));
  });

  it('should handle connection errors', async () => {
    process.env.OPENAI_API_KEY = 'test-api-key';
    mockClient.connect.mockRejectedValue(new Error('Connection failed'));

    await new Promise<void>((resolve) => {
      wss.emit('connection', mockWs);
      setTimeout(resolve, 100);
    });

    expect(mockWs.close).toHaveBeenCalledWith(1011, 'Failed to connect to OpenAI Realtime API');
  });

  it('should handle missing API key', async () => {
    delete process.env.OPENAI_API_KEY;

    await new Promise<void>((resolve) => {
      wss.emit('connection', mockWs);
      setTimeout(resolve, 100);
    });

    expect(mockWs.close).toHaveBeenCalledWith(1011, 'Server configuration error');
  });
});