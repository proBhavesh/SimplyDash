import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../create-assistant';
import { adminAuth, db } from '../../../src/lib/firebase-admin';
import axios from 'axios';
import formidable from 'formidable';

jest.mock('../../../src/lib/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: jest.fn(),
  },
  db: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    set: jest.fn(),
  },
}));

jest.mock('axios');
jest.mock('formidable');

describe('create-assistant API', () => {
  let mockReq: Partial<NextApiRequest>;
  let mockRes: Partial<NextApiResponse>;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      headers: {
        authorization: 'Bearer mock-token',
      },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    (formidable as unknown as jest.Mock).mockImplementation(() => ({
      parse: jest.fn().mockImplementation((req, callback) => {
        callback(null, { name: 'Test Assistant', systemPrompt: 'You are a helpful assistant.', firstMessage: 'Hello! How can I help you?' }, {});
      }),
    }));
  });

  it('should create a new assistant with firstMessage', async () => {
    const mockAssistantResponse = {
      data: {
        id: 'mock-assistant-id',
        name: 'Test Assistant',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      },
    };

    (adminAuth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'mock-uid' });
    (axios.post as jest.Mock).mockResolvedValue(mockAssistantResponse);

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);

    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        name: 'Test Assistant',
        model: expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'assistant', content: 'Hello! How can I help you?' },
          ]),
        }),
      }),
      expect.any(Object)
    );

    expect(db.collection('assistants').doc).toHaveBeenCalledWith('mock-assistant-id');
    expect(db.collection('assistants').doc().set).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mock-assistant-id',
        name: 'Test Assistant',
        systemPrompt: 'You are a helpful assistant.',
        firstMessage: 'Hello! How can I help you?',
        isSubscribed: false,
        userId: 'mock-uid',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      })
    );

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({ id: 'mock-assistant-id' });
  });

  it('should handle missing firstMessage', async () => {
    (formidable as unknown as jest.Mock).mockImplementation(() => ({
      parse: jest.fn().mockImplementation((req, callback) => {
        callback(null, { name: 'Test Assistant', systemPrompt: 'You are a helpful assistant.' }, {});
      }),
    }));

    const mockAssistantResponse = {
      data: {
        id: 'mock-assistant-id',
        name: 'Test Assistant',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      },
    };

    (adminAuth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'mock-uid' });
    (axios.post as jest.Mock).mockResolvedValue(mockAssistantResponse);

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);

    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        name: 'Test Assistant',
        model: expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'You are a helpful assistant.' },
          ]),
        }),
      }),
      expect.any(Object)
    );

    expect(db.collection('assistants').doc().set).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mock-assistant-id',
        name: 'Test Assistant',
        systemPrompt: 'You are a helpful assistant.',
        firstMessage: '',
        isSubscribed: false,
        userId: 'mock-uid',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      })
    );

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({ id: 'mock-assistant-id' });
  });

  it('should return 405 for non-POST requests', async () => {
    mockReq.method = 'GET';

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);

    expect(mockRes.status).toHaveBeenCalledWith(405);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Method not allowed' });
  });

  it('should handle errors during assistant creation', async () => {
    (adminAuth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'mock-uid' });
    (axios.post as jest.Mock).mockRejectedValue(new Error('API Error'));

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Internal server error',
      error: 'API Error',
    }));
  });
});