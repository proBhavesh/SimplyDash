import fs from 'fs';
import path from 'path';

// Use process.cwd() to get the project root directory in Next.js
const LOG_FILE_PATH = path.join(process.cwd(), 'logs', 'realtime-api.log');

interface LogStats {
  totalLines: number;
  errors: number;
  warnings: number;
  info: number;
  components: { [key: string]: number };
  fileSize: string;
  lastModified: string;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatTimeDiff = (date: Date) => {
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const getLogStats = (): LogStats => {
  try {
    if (!fs.existsSync(LOG_FILE_PATH)) {
      return {
        totalLines: 0,
        errors: 0,
        warnings: 0,
        info: 0,
        components: {},
        fileSize: '0 B',
        lastModified: 'never'
      };
    }

    const content = fs.readFileSync(LOG_FILE_PATH, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const stats = fs.statSync(LOG_FILE_PATH);

    const logStats = {
      totalLines: lines.length,
      errors: 0,
      warnings: 0,
      info: 0,
      components: {} as { [key: string]: number },
      fileSize: formatFileSize(stats.size),
      lastModified: formatTimeDiff(stats.mtime)
    };

    lines.forEach(line => {
      if (line.includes('[ERROR]')) logStats.errors++;
      else if (line.includes('[WARN]')) logStats.warnings++;
      else if (line.includes('[INFO]')) logStats.info++;

      const componentMatch = line.match(/\] ([^:]+):/);
      if (componentMatch) {
        const component = componentMatch[1];
        logStats.components[component] = (logStats.components[component] || 0) + 1;
      }
    });

    return logStats;
  } catch (error) {
    console.error('Error getting log stats:', error);
    return {
      totalLines: 0,
      errors: 0,
      warnings: 0,
      info: 0,
      components: {},
      fileSize: '0 B',
      lastModified: 'never'
    };
  }
};

export const getLogSummary = (): string => {
  const stats = getLogStats();
  let summary = '=== Log Summary ===\n';
  summary += `File Size: ${stats.fileSize}\n`;
  summary += `Total Lines: ${stats.totalLines}\n`;
  summary += `Last Modified: ${stats.lastModified}\n`;
  summary += '=== Message Types ===\n';
  summary += `Errors: ${stats.errors}\n`;
  summary += `Warnings: ${stats.warnings}\n`;
  summary += `Info: ${stats.info}\n`;
  summary += '=== Component Breakdown ===\n';
  Object.entries(stats.components).forEach(([component, count]) => {
    summary += `${component}: ${count} messages\n`;
  });
  return summary;
};

export const viewLogs = (filter?: (line: string) => boolean, limit = 100) => {
  try {
    if (!fs.existsSync(LOG_FILE_PATH)) return [];
    const content = fs.readFileSync(LOG_FILE_PATH, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    const filteredLines = filter ? lines.filter(filter) : lines;
    return filteredLines.slice(-limit);
  } catch (error) {
    console.error('Error reading logs:', error);
    return [];
  }
};

export const getErrorLogs = (limit = 100) => {
  return viewLogs(line => line.includes('[ERROR]'), limit);
};

export const getWarningLogs = (limit = 100) => {
  return viewLogs(line => line.includes('[WARN]'), limit);
};

export const getRecentInterruptions = (limit = 1000) => {
  return viewLogs(line => line.includes('interrupted'), limit);
};

export const getConnectionEvents = (limit = 1000) => {
  return viewLogs(line => line.includes('WebSocket'), limit);
};

export const getLogsByComponent = (component: string, limit = 100) => {
  return viewLogs(line => line.includes(`${component}:`), limit);
};

export const searchLogs = (term: string, limit = 1000) => {
  return viewLogs(line => line.toLowerCase().includes(term.toLowerCase()), limit);
};
