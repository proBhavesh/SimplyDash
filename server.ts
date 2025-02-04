// server.ts

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Define __filename and __dirname first
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local and force override
dotenv.config({ path: path.resolve(__dirname, ".env.local"), override: true });

// Adjust the import for the WebSocket server
import { initializeWebSocket } from "./server/websocket-server.js"; // Added .js extension

console.log("Initializing WebSocket server", initializeWebSocket);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = await initializeWebSocket();

  console.log("WebSocket server initialized", wss);

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = parse(request.url!);

    if (pathname === "/api/realtime-relay") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err?: Error) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
    console.log("> WebSocket server is running on /api/realtime-relay");
  });
});
