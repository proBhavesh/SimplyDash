import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import path from 'path';
import { fileURLToPath } from 'url';
import { register } from 'ts-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up TypeScript compilation
register({
  project: path.join(__dirname, 'tsconfig.json'),
});

const { initializeWebSocket } = await import('./server/websocket-server.js');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = await initializeWebSocket();

  server.on('upgrade', (request, socket, head) => {
    const pathname = parse(request.url).pathname;

    if (pathname === '/api/realtime-relay') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
    console.log('> WebSocket server is running on /api/realtime-relay');

  });
});