import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../update-assistant';
import { adminAuth } from '../../../src/lib/firebase-admin';
import { vapiClient } from '../../../src/utils/vapiClient';
import { errorLogger } from '../../../src/utils/errorLogger';

jest.mock('../../../src/lib/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: jest.fn(),
  },
}));

jest.mock('../../../src/utils/vapiClient', () => ({
  vapiClient: {
    updateAssistant: jest.fn(),
    getAssistant: jest.fn(),
  },
}));

jest.mock('../../../src/utils/errorLogger', () => ({
  errorLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('update-assistant API', () => {
  let mockReq: Partial<NextApiRequest>;
  let mockRes: Partial<NextApiResponse>;

  beforeEach(() => {
    mockReq = {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer mock-token',
      },
      body: {
        id: 'mock-assistant-id',
        firstMessage: 'Updated first message',
      },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('should update assistant with new firstMessage', async () => {
    const updatedAssistant = {
      id: 'mock-assistant-id',
      firstMessage: 'Updated first message',
      // ... other assistant properties
    };

    (adminAuth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'mock-uid' });
    (vapiClient.updateAssistant as jest.Mock).mockResolvedValue(updatedAssistant);
    (vapiClient.getAssistant as jest.Mock).mockResolvedValue(updatedAssistant);

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);

    expect(vapiClient.updateAssistant).toHaveBeenCalledWith('mock-assistant-id', expect.objectContaining({
      firstMessage: 'Updated first message',
    }));
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(updatedAssistant);
  });

  it('should return 401 if no authorization header is present', async () => {
    mockReq.headers = {};

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
  });

  it('should return 400 if assistant ID is missing', async () => {
    mockReq.body = {};

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Assistant ID is required' });
  });

  it('should handle errors from Vapi API', async () => {
    (adminAuth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'mock-uid' });
    (vapiClient.updateAssistant as jest.Mock).mockRejectedValue(new Error('Vapi API error: 400 Bad Request. Details: Invalid data'));

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Bad Request',
      details: 'Invalid data'
    }));
  });

  it('should log errors', async () => {
    const error = new Error('Test error');
    (adminAuth.verifyIdToken as jest.Mock).mockRejectedValue(error);

    await handler(mockReq as NextApiRequest, mockRes as NextApiResponse);

    expect(errorLogger.error).toHaveBeenCalledWith('Failed to update assistant', expect.objectContaining({
      assistantId: 'mock-assistant-id',
      error: expect.any(Object),
      stack: expect.any(String)
    }));
  });
});