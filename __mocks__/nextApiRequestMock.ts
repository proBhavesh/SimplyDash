import { NextApiRequest } from 'next';
import { IncomingMessage } from 'http';
import { Socket } from 'net';

export function createMockNextApiRequest(options: Partial<NextApiRequest> = {}): NextApiRequest {
  const socket = new Socket();
  const req = new IncomingMessage(socket);

  const mockReq: NextApiRequest = Object.assign(req, {
    env: {},
    cookies: {},
    query: {},
    body: null,
    ...options,
  });

  return mockReq;
}