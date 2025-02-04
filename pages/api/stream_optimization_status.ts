// pages/api/stream_optimization_status.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { IncomingMessage, ServerResponse, ClientRequest } from 'http';
import { Socket } from 'net';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

const sseProxy = createProxyMiddleware({
  target: 'https://jira.simplytalk.ai',
  changeOrigin: true,
  ws: true,
  secure: false,
  pathRewrite: {
    '^/api/stream_optimization_status': '/stream_optimization_status',
  },
  headers: {
    Connection: 'keep-alive',
  },
  on: {
    proxyReq: (
      proxyReq: ClientRequest,
      req: IncomingMessage,
      res: ServerResponse
    ) => {
      // Remove content-length to prevent buffering
      proxyReq.removeHeader('Content-Length');

      // Set headers to ensure SSE works correctly
      proxyReq.setHeader('Connection', 'keep-alive');
      proxyReq.setHeader('Accept-Encoding', ''); // Disable compression
    },
    proxyRes: (
      proxyRes: IncomingMessage,
      req: IncomingMessage,
      res: ServerResponse
    ) => {
      // Disable response buffering
      res.setHeader('X-Accel-Buffering', 'no');

      // Ensure the correct content type
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');

      // Remove content-length to prevent buffering
      delete proxyRes.headers['content-length'];
    },
    error: (err: Error, req: IncomingMessage, res: ServerResponse | Socket) => {
      console.error('Proxy error:', err);
      
      if (res instanceof ServerResponse) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        res.end(`Proxy error: ${err.message}`);
      } else if (res instanceof Socket) {
        // Handle WebSocket connection errors
        if (!res.destroyed) {
          res.destroy();
        }
      }
    }
  }
});

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set headers to ensure SSE works correctly
  req.headers['Connection'] = 'keep-alive';
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');

  // Remove content-length to prevent buffering
  delete req.headers['content-length'];

  // Forward the request to the target server
  return new Promise((resolve, reject) => {
    const handleProxyNext = (err?: unknown) => {
      if (err) {
        console.error('Proxy error:', err);
        res.status(500).end('Proxy error');
        return reject(err);
      }
      resolve(true);
    };

    sseProxy(req, res, handleProxyNext);
  });
}
