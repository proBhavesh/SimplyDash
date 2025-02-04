#!/usr/bin/env node
import { Command } from 'commander';
import {
  viewLogs,
  getLogSummary,
  searchLogs,
  getLogsByComponent,
  getErrorLogs,
  getWarningLogs,
  getRecentInterruptions,
  getConnectionEvents,
} from './logViewer';
import fs from 'fs';
import path from 'path';

interface CommandOptions {
  lines?: string;
  follow?: boolean;
}

// Add colors for better readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const formatLine = (line: string): string => {
  if (line.includes('[ERROR]')) {
    return `${colors.red}${line}${colors.reset}`;
  }
  if (line.includes('[WARN]')) {
    return `${colors.yellow}${line}${colors.reset}`;
  }
  if (line.includes('===')) {
    return `${colors.bright}${line}${colors.reset}`;
  }
  return line;
};

const writeLine = (line: string) => {
  process.stdout.write(formatLine(line) + '\n');
};

const program = new Command();

program
  .version('1.0.0')
  .description('CLI tool for viewing and analyzing Realtime API logs');

program
  .command('summary')
  .description('Show a summary of all logs')
  .action(() => {
    const summary = getLogSummary();
    writeLine(summary);
  });

program
  .command('errors')
  .description('Show error logs')
  .option('-n, --lines <number>', 'Number of lines to show', '100')
  .action((options: CommandOptions) => {
    const logs = getErrorLogs(parseInt(options.lines || '100'));
    logs.forEach((line: string) => writeLine(line));
  });

program
  .command('warnings')
  .description('Show warning logs')
  .option('-n, --lines <number>', 'Number of lines to show', '100')
  .action((options: CommandOptions) => {
    const logs = getWarningLogs(parseInt(options.lines || '100'));
    logs.forEach((line: string) => writeLine(line));
  });

program
  .command('interruptions')
  .description('Show recent interruption sequences')
  .option('-n, --lines <number>', 'Number of lines to search through', '1000')
  .action((options: CommandOptions) => {
    const logs = getRecentInterruptions(parseInt(options.lines || '1000'));
    logs.forEach((line: string) => writeLine(line));
  });

program
  .command('connections')
  .description('Show WebSocket connection events')
  .option('-n, --lines <number>', 'Number of lines to search through', '1000')
  .action((options: CommandOptions) => {
    const logs = getConnectionEvents(parseInt(options.lines || '1000'));
    logs.forEach((line: string) => writeLine(line));
  });

program
  .command('component <name>')
  .description('Show logs for a specific component')
  .option('-n, --lines <number>', 'Number of lines to show', '100')
  .action((name: string, options: CommandOptions) => {
    const logs = getLogsByComponent(name, parseInt(options.lines || '100'));
    logs.forEach((line: string) => writeLine(line));
  });

program
  .command('search <term>')
  .description('Search logs for a specific term')
  .option('-n, --lines <number>', 'Number of lines to search through', '1000')
  .action((term: string, options: CommandOptions) => {
    const logs = searchLogs(term, parseInt(options.lines || '1000'));
    logs.forEach((line: string) => writeLine(line));
  });

program
  .command('tail')
  .description('Show last N lines of logs')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .option('-f, --follow', 'Follow log output')
  .action((options: CommandOptions) => {
    const logPath = path.join(process.cwd(), 'logs', 'realtime-api.log');
    const numLines = parseInt(options.lines || '50');

    // Show initial logs
    const logs = viewLogs(undefined, numLines);
    logs.forEach((line: string) => writeLine(line));

    if (options.follow) {
      process.stdout.write('\nWatching for new logs... (Ctrl+C to exit)\n\n');
      let lastSize = fs.statSync(logPath).size;
      const watcher = fs.watch(logPath, (eventType) => {
        if (eventType === 'change') {
          const stats = fs.statSync(logPath);
          if (stats.size > lastSize) {
            const content = fs.readFileSync(logPath, 'utf8');
            const newContent = content.slice(lastSize);
            const newLines = newContent.split('\n').filter(Boolean);
            newLines.forEach((line: string) => writeLine(line));
            lastSize = stats.size;
          }
        }
      });

      process.on('SIGINT', () => {
        watcher.close();
        process.exit(0);
      });
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

/*
Usage examples:

# Show log summary
npm run logs summary

# Show last 100 error logs
npm run logs errors

# Show last 100 warning logs
npm run logs warnings

# Show recent interruption sequences
npm run logs interruptions

# Show connection events
npm run logs connections

# Show logs for audio.ts
npm run logs component audio.ts

# Search logs for "WebSocket"
npm run logs search "WebSocket"

# Show last 50 lines and follow new logs
npm run logs tail -f

*/
