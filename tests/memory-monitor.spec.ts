import { test, expect, chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { MemoryMonitor } from '../src/utils/MemoryMonitor';

interface MemoryMetrics {
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  timestamp: number;
  wsState?: number;
}

interface MessageMetrics {
  processingTime: number;
  timeSinceLastMessage: number;
  memoryDelta: number;
  eventType: string;
}

interface FunctionPerformance {
  functionName: string;
  startTime: number;
  endTime: number;
  payloadSize: number;
  memoryBefore: number;
  memoryAfter: number;
}

interface EventListenerInfo {
  type: string;
  count: number;
}

interface TaskInfo {
  type: 'setInterval' | 'setTimeout';
  id: number;
  callbackInfo: string;
  startTime: number;
  runningTime: number;
}

interface UserInteraction {
  timestamp: number;
  action: string;
  responseTime?: number;
}

interface HeapSnapshot {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  objects: { [key: string]: number };
}

interface MemoryLog {
  minute: number;
  memory: MemoryMetrics;
  wsConnected: boolean;
  messageMetrics?: MessageMetrics[];
  functionPerformance?: FunctionPerformance[];
  totalMessagesReceived: number;
  totalMessagesProcessed: number;
  totalMessagesUnprocessed: number;
  eventListeners?: EventListenerInfo[];
  tasks?: TaskInfo[];
  userInteractions?: UserInteraction[];
  heapSnapshot?: HeapSnapshot;
}

interface TaskEntry {
  type: 'setInterval' | 'setTimeout';
  id: number;
  callbackInfo: string;
  startTime: number;
  timeout?: number;
  interval?: number;
}

type TaskMap = Map<number, TaskEntry>;

test('Monitor WebSocket memory usage', async ({ page }) => {
  // Reset MemoryMonitor instance at start of test
  MemoryMonitor.getInstance().reset();
  
  let wsConnected = false;
  const messageMetrics: MessageMetrics[] = [];
  const functionPerformance: FunctionPerformance[] = [];
  const userInteractions: UserInteraction[] = [];
  let totalMessagesReceived = 0;
  let totalMessagesProcessed = 0;
  let totalMessagesUnprocessed = 0;

  // Create test-results directory if it doesn't exist
  const resultsDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
    console.log('Created test-results directory at:', resultsDir);
  }

  // Listen for console logs to capture performance metrics
  page.on('console', async (msg) => {
    const text = msg.text();
    if (text.includes('Message processing complete')) {
      try {
        const details = JSON.parse(text.split('details:')[1]);
        messageMetrics.push({
          processingTime: details.processingTime,
          timeSinceLastMessage: details.timeSinceLastMessage || 0,
          memoryDelta: details.memoryDelta,
          eventType: details.eventType
        });
        console.log('Message Metrics:', details);
      } catch (e) {
        console.error('Failed to parse metrics:', e);
      }
    } else if (text.startsWith('FunctionPerformance:')) {
      try {
        const details = JSON.parse(text.replace('FunctionPerformance:', ''));
        functionPerformance.push(details);
        console.log('Function Performance:', details);
      } catch (e) {
        console.error('Failed to parse function performance:', e);
      }
    } else if (text.startsWith('UserInteraction:')) {
      try {
        const details = JSON.parse(text.replace('UserInteraction:', ''));
        userInteractions.push(details);
        console.log('User Interaction:', details);
      } catch (e) {
        console.error('Failed to parse user interaction:', e);
      }
    }
  });

  // Inject code into the page to profile key functions
  await page.addInitScript(() => {
    console.log('Initializing performance monitoring...');

    // Initialize tracking objects
    (window as any).messageCounts = {
      received: 0,
      processed: 0,
      unprocessed: 0
    };

    (window as any).eventListenerCounts = {
      click: 0,
      message: 0,
      keydown: 0,
      mousemove: 0
    };

    (window as any).activeTasks = new Map<number, TaskEntry>();

    // Track background tasks
    const originalSetTimeout = window.setTimeout;
    (window as any).setTimeout = function(handler: TimerHandler, timeout?: number, ...args: any[]): number {
      const taskId = originalSetTimeout.call(this, handler, timeout, ...args);
      ((window as any).activeTasks as TaskMap).set(taskId, {
        type: 'setTimeout',
        id: taskId,
        callbackInfo: handler.toString().substring(0, 100),
        startTime: Date.now(),
        timeout
      });
      return taskId;
    };

    const originalClearTimeout = window.clearTimeout;
    (window as any).clearTimeout = function(timeoutId?: number): void {
      if (timeoutId && ((window as any).activeTasks as TaskMap).has(timeoutId)) {
        ((window as any).activeTasks as TaskMap).delete(timeoutId);
      }
      return originalClearTimeout.call(this, timeoutId);
    };

    const originalSetInterval = window.setInterval;
    (window as any).setInterval = function(handler: TimerHandler, timeout?: number, ...args: any[]): number {
      const taskId = originalSetInterval.call(this, handler, timeout, ...args);
      ((window as any).activeTasks as TaskMap).set(taskId, {
        type: 'setInterval',
        id: taskId,
        callbackInfo: handler.toString().substring(0, 100),
        startTime: Date.now(),
        interval: timeout
      });
      return taskId;
    };

    const originalClearInterval = window.clearInterval;
    (window as any).clearInterval = function(intervalId?: number): void {
      if (intervalId && ((window as any).activeTasks as TaskMap).has(intervalId)) {
        ((window as any).activeTasks as TaskMap).delete(intervalId);
      }
      return originalClearInterval.call(this, intervalId);
    };

    // Track WebSocket messages
    const originalWsOnMessage = (window as any).WebSocket.prototype.onmessage;
    (window as any).WebSocket.prototype.onmessage = function (event: any) {
      (window as any).messageCounts.received++;
      if (originalWsOnMessage) {
        originalWsOnMessage.call(this, event);
        (window as any).messageCounts.processed++;
      } else {
        (window as any).messageCounts.unprocessed++;
      }
    };

    // Track event listeners
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type: string, ...args: any[]) {
      if ((window as any).eventListenerCounts[type] !== undefined) {
        (window as any).eventListenerCounts[type]++;
      }
      return originalAddEventListener.apply(this, [type, ...args]);
    };

    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.removeEventListener = function(type: string, ...args: any[]) {
      if ((window as any).eventListenerCounts[type] !== undefined) {
        (window as any).eventListenerCounts[type]--;
      }
      return originalRemoveEventListener.apply(this, [type, ...args]);
    };

    // Track user interactions
    document.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).matches('button')) {
        const action = (event.target as HTMLElement).innerText;
        const timestamp = Date.now();
        const startTime = performance.now();
        console.log('UserInteraction:', JSON.stringify({
          timestamp,
          action,
          target: (event.target as HTMLElement).outerHTML
        }));
        // Measure response time
        setTimeout(() => {
          const endTime = performance.now();
          console.log('UserInteractionResponse:', JSON.stringify({
            timestamp,
            action,
            responseTime: endTime - startTime
          }));
        }, 0);
      }
    });

    console.log('Performance monitoring initialized');
  });

  // Navigate to the page
  console.log('Navigating to Virtual Business Analyst page...');
  await page.goto('http://localhost:3000/564a605d-7390-428a-a163-149286120448/Virtual%20Business%20Analyst', {
    timeout: 30000,
    waitUntil: 'domcontentloaded'
  });

  // Wait for critical elements
  console.log('Waiting for page elements...');
  await page.waitForSelector('h1:has-text("Virtual Business Analyst")', {
    state: 'visible',
    timeout: 30000
  });

  // First connection attempt
  console.log('First connection attempt...');
  let connectButton = page.locator('button:has-text("Connect and Talk")').first();
  await connectButton.waitFor({ state: 'visible', timeout: 30000 });
  let wsPromise = page.waitForEvent('websocket', ws => ws.url().includes('realtime-relay'));
  await connectButton.click();
  let ws = await wsPromise;
  console.log('First WebSocket connected:', ws.url());

  // Wait a moment
  await page.waitForTimeout(2000);

  // Disconnect and cleanup
  console.log('Disconnecting...');
  const disconnectButton = page.locator('button:has-text("Disconnect")').first();
  await disconnectButton.click();
  
  // Important: Wait for cleanup to complete
  await page.waitForTimeout(2000);

  // Reset memory monitoring and cleanup intervals
  await page.evaluate(() => {
    // Get all intervals
    const intervals: number[] = [];
    let id = window.setInterval(() => {}, 0);
    while (id--) {
      window.clearInterval(id);
      intervals.push(id);
    }
    console.log('Cleared intervals:', intervals.length);

    // Get all timeouts
    const timeouts: number[] = [];
    id = window.setTimeout(() => {}, 0);
    while (id--) {
      window.clearTimeout(id);
      timeouts.push(id);
    }
    console.log('Cleared timeouts:', timeouts.length);

    // Reset all monitoring state
    (window as any).messageCounts = {
      received: 0,
      processed: 0,
      unprocessed: 0
    };

    (window as any).eventListenerCounts = {
      click: 0,
      message: 0,
      keydown: 0,
      mousemove: 0
    };

    // Clear task tracking
    if ((window as any).activeTasks) {
      (window as any).activeTasks.clear();
    }
  });

  // Reset MemoryMonitor instance
  MemoryMonitor.getInstance().reset();

  // Second connection attempt
  console.log('Second connection attempt...');
  connectButton = page.locator('button:has-text("Connect and Talk")').first();
  await connectButton.waitFor({ state: 'visible', timeout: 30000 });
  wsPromise = page.waitForEvent('websocket', ws => ws.url().includes('realtime-relay'));
  await connectButton.click();
  ws = await wsPromise;
  wsConnected = true;
  console.log('Second WebSocket connected:', ws.url());

  ws.on('close', () => {
    console.log('WebSocket closed:', ws.url());
    wsConnected = false;
  });

  // Wait for performance.memory to be available
  console.log('Waiting for performance metrics to be available...');
  await page.waitForFunction(() => {
    return (performance as any).memory &&
           (performance as any).memory.usedJSHeapSize > 0 &&
           (performance as any).memory.totalJSHeapSize > 0 &&
           (performance as any).memory.jsHeapSizeLimit > 0;
  }, { timeout: 30000 });

  console.log('Starting memory monitoring...');
  const memoryLogs: MemoryLog[] = [];

  // Capture initial heap snapshot
  console.log('Capturing initial heap snapshot...');
  const initialHeapSnapshot = await page.evaluate(() => {
    const memory = (performance as any).memory;
    const counts: {[key: string]: number} = {};
    try {
      for (const obj of Object.values((window as any))) {
        const constructor = obj?.constructor?.name;
        if (constructor) {
          counts[constructor] = (counts[constructor] || 0) + 1;
        }
      }
    } catch (e) {
      console.error('Error counting objects:', e);
    }
    return {
      timestamp: Date.now(),
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      objects: counts
    };
  });
  console.log('Initial heap snapshot:', initialHeapSnapshot);

  // Capture heap snapshot after WebSocket connection
  console.log('Capturing post-connection heap snapshot...');
  const postConnectionSnapshot = await page.evaluate(() => {
    const memory = (performance as any).memory;
    const counts: {[key: string]: number} = {};
    try {
      for (const obj of Object.values((window as any))) {
        const constructor = obj?.constructor?.name;
        if (constructor) {
          counts[constructor] = (counts[constructor] || 0) + 1;
        }
      }
    } catch (e) {
      console.error('Error counting objects:', e);
    }
    return {
      timestamp: Date.now(),
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      objects: counts
    };
  });
  console.log('Post-connection heap snapshot:', postConnectionSnapshot);

  for (let i = 0; i < 10; i++) {
    if (!wsConnected) {
      throw new Error('WebSocket connection lost during monitoring');
    }

    console.log(`\nMinute ${i + 1} of monitoring...`);

    // Get memory metrics
    const metrics = await page.evaluate(() => {
      const ws = (window as any).webSocket;
      const memory = (performance as any).memory;
      const messageCounts = (window as any).messageCounts;
      const eventListeners = Object.entries((window as any).eventListenerCounts).map(([type, count]) => ({
        type,
        count: count as number
      }));

      const taskEntries = Array.from(((window as any).activeTasks as TaskMap).entries());
      const tasks: TaskInfo[] = taskEntries.map(([id, task]) => ({
        type: task.type,
        id: task.id,
        callbackInfo: task.callbackInfo,
        startTime: task.startTime,
        runningTime: Date.now() - task.startTime
      }));

      const counts: {[key: string]: number} = {};
      try {
        for (const obj of Object.values((window as any))) {
          const constructor = obj?.constructor?.name;
          if (constructor) {
            counts[constructor] = (counts[constructor] || 0) + 1;
          }
        }
      } catch (e) {
        console.error('Error counting objects:', e);
      }

      return {
        memory: {
          usedJSHeapSize: memory.usedJSHeapSize || 0,
          totalJSHeapSize: memory.totalJSHeapSize || 0,
          jsHeapSizeLimit: memory.jsHeapSizeLimit || 0
        },
        timestamp: Date.now(),
        wsState: ws?.readyState,
        totalMessagesReceived: messageCounts.received,
        totalMessagesProcessed: messageCounts.processed,
        totalMessagesUnprocessed: messageCounts.unprocessed,
        eventListeners,
        tasks,
        heapSnapshot: {
          timestamp: Date.now(),
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          objects: counts
        }
      };
    });

    memoryLogs.push({
      minute: i + 1,
      memory: metrics,
      wsConnected: wsConnected,
      messageMetrics: messageMetrics.slice(),
      functionPerformance: functionPerformance.slice(),
      totalMessagesReceived: metrics.totalMessagesReceived,
      totalMessagesProcessed: metrics.totalMessagesProcessed,
      totalMessagesUnprocessed: metrics.totalMessagesUnprocessed,
      eventListeners: metrics.eventListeners,
      tasks: metrics.tasks,
      userInteractions: userInteractions.slice(),
      heapSnapshot: metrics.heapSnapshot,
    });

    console.log('Memory usage:', {
      usedJSHeapSize: `${Math.round(metrics.memory.usedJSHeapSize / (1024 * 1024))}MB`,
      totalJSHeapSize: `${Math.round(metrics.memory.totalJSHeapSize / (1024 * 1024))}MB`,
      jsHeapSizeLimit: `${Math.round(metrics.memory.jsHeapSizeLimit / (1024 * 1024))}MB`,
      wsConnected: wsConnected,
      totalMessagesReceived: metrics.totalMessagesReceived,
      totalMessagesProcessed: metrics.totalMessagesProcessed,
      totalMessagesUnprocessed: metrics.totalMessagesUnprocessed,
    });

    console.log('Event Listeners:', metrics.eventListeners);
    console.log('Active Background Tasks:', metrics.tasks);
    console.log('Function Performance Metrics:', functionPerformance.length ? functionPerformance : 'No function calls recorded');
    console.log('User Interactions:', userInteractions.length ? userInteractions : 'No user interactions recorded');

    if (metrics.heapSnapshot) {
      console.log('Heap Snapshot:', metrics.heapSnapshot);
    }

    // Clear metrics for next minute
    messageMetrics.length = 0;
    functionPerformance.length = 0;
    userInteractions.length = 0;

    if (i < 9) {
      await page.waitForTimeout(60000);
    }
  }

  // Final cleanup
  await page.evaluate(() => {
    // Get all intervals
    const intervals: number[] = [];
    let id = window.setInterval(() => {}, 0);
    while (id--) {
      window.clearInterval(id);
      intervals.push(id);
    }
    console.log('Final cleanup - cleared intervals:', intervals.length);

    // Get all timeouts
    const timeouts: number[] = [];
    id = window.setTimeout(() => {}, 0);
    while (id--) {
      window.clearTimeout(id);
      timeouts.push(id);
    }
    console.log('Final cleanup - cleared timeouts:', timeouts.length);

    // Reset monitoring state
    (window as any).messageCounts = {
      received: 0,
      processed: 0,
      unprocessed: 0
    };

    (window as any).eventListenerCounts = {
      click: 0,
      message: 0,
      keydown: 0,
      mousemove: 0
    };

    if ((window as any).activeTasks) {
      (window as any).activeTasks.clear();
    }
  });

  // Reset MemoryMonitor instance one final time
  MemoryMonitor.getInstance().reset();

  // Save memory logs
  const logPath = path.join(
    resultsDir,
    `memory-test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );

  fs.writeFileSync(logPath, JSON.stringify(memoryLogs, null, 2));
  console.log(`\nMemory logs saved to: ${logPath}`);

  // Analyze the logs
  console.log('\nAnalyzing collected metrics:');
  const allMessageMetrics = memoryLogs.flatMap(log => log.messageMetrics || []);
  if (allMessageMetrics.length > 0) {
    const avgProcessingTime = allMessageMetrics.reduce((sum, m) => sum + m.processingTime, 0) / allMessageMetrics.length;
    const maxProcessingTime = Math.max(...allMessageMetrics.map(m => m.processingTime));
    const avgTimeBetweenMessages = allMessageMetrics.reduce((sum, m) => sum + m.timeSinceLastMessage, 0) / allMessageMetrics.length;
    const totalMemoryGrowth = allMessageMetrics.reduce((sum, m) => sum + m.memoryDelta, 0);

    console.log('Message Processing Analysis:', {
      averageProcessingTime: `${avgProcessingTime.toFixed(2)}ms`,
      maxProcessingTime: `${maxProcessingTime.toFixed(2)}ms`,
      averageTimeBetweenMessages: `${avgTimeBetweenMessages.toFixed(2)}ms`,
      totalMemoryGrowth: `${(totalMemoryGrowth / (1024 * 1024)).toFixed(2)}MB`
    });
  } else {
    console.log('No message metrics collected during the test');
  }
});