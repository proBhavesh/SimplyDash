import { NextApiResponse } from 'next';
import handler from '../list-assistants';
import { createMockNextApiRequest } from '../../../__mocks__/nextApiRequestMock';
import { vapiClient } from '../../../src/utils/vapiClient';

jest.mock('../../../src/utils/vapiClient', () => ({
  vapiClient: {
    listAssistants: jest.fn(),
  },
}));

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
  auth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'testUid' }),
  }),
  firestore: () => ({
    // Add any Firestore methods you're using in your handler
  }),
}));

describe('/api/list-assistants', () => {
  it('returns 200 and a list of assistants for an authenticated user', async () => {
    const mockAssistants = [
      { id: '1', name: 'Assistant 1' },
      { id: '2', name: 'Assistant 2' },
    ];

    (vapiClient.listAssistants as jest.Mock).mockResolvedValue(mockAssistants);

    const req = createMockNextApiRequest({
      method: 'GET',
      headers: {
        Authorization: 'Bearer validToken',
      },
    });

    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const res = {
      status,
    } as unknown as NextApiResponse;

    await handler(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(mockAssistants);
  });

  // Add more test cases as needed
});