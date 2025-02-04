// Chrome-specific performance memory API
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

declare const performance: ExtendedPerformance;

export enum Components {
  WEBSOCKET = 'WebSocket',
  AUDIO = 'Audio',
  USER = 'User',
  ASSISTANT = 'Assistant',
  STREAM_PROCESSOR = 'StreamProcessor'
}

type LogType = 'info' | 'warn' | 'error';

interface TimingMetric {
  start: number;
  end?: number;
  duration?: number;
}

interface StateMetric {
  timestamp: number;
  component: Components;
  name: string;
  value: any;
}

interface PerformanceLog {
  timestamp: number;
  type: 'state' | 'timing' | 'latency' | 'error' | 'warning';
  component: Components;
  data: any;
  sessionId?: string;
  conversationId?: string;
}

export interface LogContext {
  component: Components;
  line?: number;
  type?: LogType;
  details?: Record<string, any>;
}

class PerformanceLogger {
  private timings: Map<string, TimingMetric> = new Map();
  private states: StateMetric[] = [];
  private messageLatencies: number[] = [];
  private audioLatencies: number[] = [];
  private lastMessageTime: number | null = null;
  private lastAudioTime: number | null = null;
  private sessionStartTime: number = Date.now();
  private static readonly MAX_LOGS = 50;
  private logs: PerformanceLog[] = [];
  private isClient = typeof window !== 'undefined';
  private static readonly STORAGE_KEY = 'performance_logs';
  protected isEnabled = true;

  // NEW: Public method to check if logging is enabled
  public isLoggingEnabled(): boolean {
    return this.isEnabled;
  }

  constructor() {
    if (this.isClient) {
      // Clear any existing logs
      localStorage.removeItem(PerformanceLogger.STORAGE_KEY);
      
      // Listen for page unload to clean up
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }

  private cleanup() {
    this.timings.clear();
    this.states = [];
    this.messageLatencies = [];
    this.audioLatencies = [];
    this.lastMessageTime = null;
    this.lastAudioTime = null;
    this.logs = [];

    if (this.isClient) {
      localStorage.removeItem(PerformanceLogger.STORAGE_KEY);
    }
  }

  public enable() {
    this.isEnabled = true;
  }

  public disable() {
    this.isEnabled = false;
    this.cleanup();
  }

  public addLog(log: PerformanceLog) {
    if (!this.isEnabled) return;

    // Only store critical logs
    if (log.type === 'error' || 
        (log.type === 'warning' && log.data?.message?.includes('critical'))) {
      this.logs.push(log);
      
      // Keep only recent logs
      if (this.logs.length > PerformanceLogger.MAX_LOGS) {
        this.logs.shift();
      }
    }
  }

  public getLogs(): PerformanceLog[] {
    if (!this.isEnabled || !this.isClient) return [];
    return [...this.logs];
  }

  startTiming(id: string) {
    if (!this.isEnabled) return;
    this.timings.set(id, { start: performance.now() });
  }

  endTiming(id: string) {
    if (!this.isEnabled) return;
    const timing = this.timings.get(id);
    if (timing) {
      timing.end = performance.now();
      timing.duration = timing.end - timing.start;
      
      // Only log long operations
      if (timing.duration > 1000) {
        this.addLog({
          timestamp: Date.now(),
          type: 'warning',
          component: Components.WEBSOCKET,
          data: { 
            message: `Critical: Long operation detected: ${id} took ${timing.duration.toFixed(2)}ms`,
            duration: timing.duration
          }
        });
      }
      
      this.timings.delete(id);
    }
  }

  logState(component: Components, name: string, value: any) {
    if (!this.isEnabled) return;
    
    // Only log critical states
    if (name.includes('error') || 
        name.includes('critical') || 
        (name.includes('warning') && JSON.stringify(value).includes('critical'))) {
      const metric: StateMetric = {
        timestamp: performance.now(),
        component,
        name,
        value
      };
      this.states.push(metric);
      
      // Keep only recent states
      if (this.states.length > 10) {
        this.states.shift();
      }

      this.addLog({
        timestamp: Date.now(),
        type: 'state',
        component,
        data: { name, value }
      });
    }
  }

  logMessageLatency(latency: number) {
    if (!this.isEnabled) return;
    
    // Only log high latencies
    if (latency > 1000) {
      this.messageLatencies.push(latency);
      
      // Keep only recent latencies
      if (this.messageLatencies.length > 10) {
        this.messageLatencies.shift();
      }

      this.addLog({
        timestamp: Date.now(),
        type: 'warning',
        component: Components.WEBSOCKET,
        data: { 
          message: `Critical: High message latency: ${latency.toFixed(2)}ms`,
          latency
        }
      });
    }
  }

  logAudioLatency(latency: number) {
    if (!this.isEnabled) return;
    
    // Only log high latencies
    if (latency > 200) {
      this.audioLatencies.push(latency);
      
      // Keep only recent latencies
      if (this.audioLatencies.length > 10) {
        this.audioLatencies.shift();
      }

      this.addLog({
        timestamp: Date.now(),
        type: 'warning',
        component: Components.AUDIO,
        data: { 
          message: `Critical: High audio latency: ${latency.toFixed(2)}ms`,
          latency
        }
      });
    }
  }

  getPerformanceReport() {
    if (!this.isEnabled) {
      return {
        messageLatencies: { min: 0, max: 0, average: 0 },
        audioLatencies: { min: 0, max: 0, average: 0 },
        significantStates: []
      };
    }

    return {
      messageLatencies: this.messageLatencies.length > 0 ? {
        max: Math.max(...this.messageLatencies),
        count: this.messageLatencies.length
      } : null,
      audioLatencies: this.audioLatencies.length > 0 ? {
        max: Math.max(...this.audioLatencies),
        count: this.audioLatencies.length
      } : null,
      significantStates: this.states.length,
      sessionDuration: Date.now() - this.sessionStartTime
    };
  }

  downloadLogs() {
    if (!this.isEnabled || !this.isClient) return;
    
    const logBlob = new Blob([JSON.stringify(this.logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(logBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance_logs_${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  clearLogs() {
    this.cleanup();
  }

  reset() {
    this.cleanup();
    this.sessionStartTime = Date.now();
  }
}

// PROFILING: Create and expose logger instance
const performanceLogger = new PerformanceLogger();

// PROFILING: Expose logger to window for testing
if (typeof window !== 'undefined') {
  (window as any).performanceLogger = performanceLogger;
}

export { performanceLogger };

export const log = (message: string, context: LogContext) => {
  // Use the new public method
  if (!performanceLogger.isLoggingEnabled()) return;

  // Only log errors and critical warnings
  if (context.type === 'error' || 
    (context.type === 'warn' && message.includes('critical'))) {
    const timestamp = new Date().toISOString();
    console[context.type === 'error' ? 'error' : 'warn'](
      `[${timestamp}] [${context.component}] ${message}`
    );

    performanceLogger.addLog({
      timestamp: Date.now(),
      type: context.type === 'error' ? 'error' : 'warning',
      component: context.component,
      data: { 
        message,
        line: context.line,
        ...(context.details && { details: context.details })
      }
    });
  }
};
