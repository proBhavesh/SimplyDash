import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE_PATH = path.join(LOG_DIR, 'realtime-api.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initialize log file with header if it doesn't exist
if (!fs.existsSync(LOG_FILE_PATH)) {
  const header = `=== Realtime API Logs ===\nStarted: ${new Date().toISOString()}\n`;
  fs.writeFileSync(LOG_FILE_PATH, header);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { timestamp, component, line, type, message, data } = req.body;

    // Validate required fields
    if (!timestamp || !component || !line || !type || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Format log entry
    const dataString = data ? ` ${JSON.stringify(data)}` : '';
    const logLine = `[${timestamp}] [${type.toUpperCase()}] ${component}:${line} - ${message}${dataString}\n`;

    // Append to log file
    fs.appendFileSync(LOG_FILE_PATH, logLine);

    // Check file size and rotate if needed
    const stats = fs.statSync(LOG_FILE_PATH);
    const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

    if (stats.size > MAX_LOG_SIZE) {
      const oldPath = `${LOG_FILE_PATH}.old`;
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
      fs.renameSync(LOG_FILE_PATH, oldPath);
      const header = `=== Realtime API Logs ===\nStarted: ${new Date().toISOString()}\n`;
      fs.writeFileSync(LOG_FILE_PATH, header);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error writing to log file:', error);
    res.status(500).json({ error: 'Failed to write log' });
  }
}
