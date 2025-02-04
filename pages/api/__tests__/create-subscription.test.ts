import handler from '../create-subscription';
import { createMocks } from 'node-mocks-http';

describe('/api/create-subscription', () => {
  it('returns 200 and sessionId when called with valid data', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        Authorization: 'Bearer validToken',
        'content-type': 'application/json',
      },
      body: {
        assistantId: 'test-assistant-id',
      },
    });

    // Mock dependencies like Stripe and Firebase as needed

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data).toHaveProperty('sessionId');
  });
});