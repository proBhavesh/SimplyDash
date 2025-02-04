import { createMocks, RequestMethod } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';
import getAssistantHandler from '../get-assistant';
import { getAuth } from 'firebase-admin/auth';
import { db } from '../../../src/lib/firebase-admin';
import { vapiClient } from '../../../src/utils/vapiClient';

jest.mock('firebase-admin/auth');
jest.mock('../../../src/lib/firebase-admin');
jest.mock('../../../src/utils/vapiClient');

// Helper function to create mocks
function mockRequestResponse(method: RequestMethod = 'GET') {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method });
  // Removed the line 'req.env = {} as any;'
  return { req, res };
}

describe('/api/get-assistant', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns 405 for non-GET requests', async () => {
    const { req, res } = mockRequestResponse('POST');

    await getAssistantHandler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Method not allowed' });
  });

  it('returns 401 for unauthorized requests', async () => {
    const { req, res } = mockRequestResponse();
    req.headers = {};

    await getAssistantHandler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Unauthorized' });
  });

  it('returns 400 for invalid assistant ID', async () => {
    const { req, res } = mockRequestResponse();
    req.headers = { authorization: 'Bearer valid-token' };
    req.query = {};

    (getAuth().verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'mock-uid' });

    await getAssistantHandler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Invalid assistant ID' });
  });

  it('returns 404 when assistant is not found in Firestore', async () => {
    const { req, res } = mockRequestResponse();
    req.headers = { authorization: 'Bearer valid-token' };
    req.query = { id: 'non-existent-id' };

    (getAuth().verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'mock-uid' });
    (db.collection('assistants').doc as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: () => null }),
    });

    await getAssistantHandler(req, res);

    expect(res._getStatusCode()).toBe(404);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Assistant not found' });
  });

  it('returns 403 when user does not have access to the assistant', async () => {
    const { req, res } = mockRequestResponse();
    req.headers = { authorization: 'Bearer valid-token' };
    req.query = { id: 'existing-id' };

    (getAuth().verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'mock-uid' });
    (db.collection('assistants').doc as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: () => ({ userId: 'other-uid' }) }),
    });

    await getAssistantHandler(req, res);

    expect(res._getStatusCode()).toBe(403);
    expect(JSON.parse(res._getData())).toEqual({ message: 'Access denied' });
  });

  it('returns 200 with assistant data including firstMessage for valid request', async () => {
    const mockAssistant = {
      id: 'existing-id',
      name: 'Test Assistant',
      description: 'A test assistant',
      model: {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'assistant', content: 'Hello! How can I assist you today?' },
        ],
      },
    };

    const { req, res } = mockRequestResponse();
    req.headers = { authorization: 'Bearer valid-token' };
    req.query = { id: 'existing-id' };

    (getAuth().verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'mock-uid' });
    (db.collection('assistants').doc as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: () => ({ userId: 'mock-uid', isSubscribed: true }) }),
    });
    (vapiClient.getAssistant as jest.Mock).mockResolvedValue(mockAssistant);
    (vapiClient.getAnalytics as jest.Mock).mockResolvedValue([{ result: [] }]);

    await getAssistantHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData).toEqual(
      expect.objectContaining({
        ...mockAssistant,
        isSubscribed: true,
        usage: expect.any(Object),
        firstMessage: 'Hello! How can I assist you today?',
      })
    );
  });

  it('handles missing firstMessage in assistant data', async () => {
    const mockAssistant = {
      id: 'existing-id',
      name: 'Test Assistant',
      model: {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
        ],
      },
    };

    const { req, res } = mockRequestResponse();
    req.headers = { authorization: 'Bearer valid-token' };
    req.query = { id: 'existing-id' };

    (getAuth().verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'mock-uid' });
    (db.collection('assistants').doc as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: () => ({ userId: 'mock-uid', isSubscribed: false }) }),
    });
    (vapiClient.getAssistant as jest.Mock).mockResolvedValue(mockAssistant);
    (vapiClient.getAnalytics as jest.Mock).mockResolvedValue([{ result: [] }]);

    await getAssistantHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData).toEqual(
      expect.objectContaining({
        ...mockAssistant,
        isSubscribed: false,
        usage: expect.any(Object),
        firstMessage: '',
      })
    );
  });

  it('handles missing optional fields in assistant data', async () => {
    const mockAssistant = {
      id: 'existing-id',
      name: 'Test Assistant',
      // description is intentionally omitted
    };

    const { req, res } = mockRequestResponse();
    req.headers = { authorization: 'Bearer valid-token' };
    req.query = { id: 'existing-id' };

    (getAuth().verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'mock-uid' });
    (db.collection('assistants').doc as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: () => ({ userId: 'mock-uid', isSubscribed: false }) }),
    });
    (vapiClient.getAssistant as jest.Mock).mockResolvedValue(mockAssistant);
    (vapiClient.getAnalytics as jest.Mock).mockResolvedValue([{ result: [] }]);

    await getAssistantHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData).toEqual(
      expect.objectContaining({
        ...mockAssistant,
        isSubscribed: false,
        usage: expect.any(Object),
      })
    );
    expect(responseData.description).toBeUndefined();
    expect(responseData.firstMessage).toBe('');
  });
});
