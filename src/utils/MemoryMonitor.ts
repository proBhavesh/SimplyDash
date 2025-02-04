export interface MemorySnapshot {
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  timestamp: number;
}

interface MemoryTrend {
  trend: 'stable' | 'increasing' | 'decreasing';
  averageGrowthMB: number;
}

type MemoryListener = (snapshot: MemorySnapshot) => void;

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private static intervalId = null as number | null;
  private static listeners: Set<MemoryListener> = new Set();
  private static snapshots: MemorySnapshot[] = [];
  private static readonly maxSnapshots = 10;
  private static readonly INSTANCE_KEY = Symbol.for('MemoryMonitor');

  private constructor() {
    // Ensure we clean up on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        MemoryMonitor.resetInstance();
      });
    }
  }

  public static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      // Determine the global scope
      const globalScope =
        typeof globalThis !== 'undefined'
          ? globalThis
          : typeof window !== 'undefined'
          ? window
          : typeof global !== 'undefined'
          ? global
          : {};

      // Check if an instance already exists in the global scope
      const globalInstance = (globalScope as any)[MemoryMonitor.INSTANCE_KEY] as MemoryMonitor;
      if (globalInstance) {
        MemoryMonitor.instance = globalInstance;
      } else {
        MemoryMonitor.instance = new MemoryMonitor();
        (globalScope as any)[MemoryMonitor.INSTANCE_KEY] = MemoryMonitor.instance;
      }
    }
    return MemoryMonitor.instance;
  }

  public isMonitoring(): boolean {
    return MemoryMonitor.intervalId !== null;
  }

  public startMonitoring(interval = 5000): void {
    // If already monitoring, do not start another interval
    if (this.isMonitoring()) {
      return;
    }

    // Clear any existing snapshots
    this.clearSnapshots();

    // Start new monitoring interval
    MemoryMonitor.intervalId = window.setInterval(() => {
      if (performance && (performance as any).memory) {
        const snapshot: MemorySnapshot = {
          memory: {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
          },
          timestamp: Date.now(),
        };

        // Add snapshot and maintain history limit
        MemoryMonitor.snapshots.push(snapshot);
        if (MemoryMonitor.snapshots.length > MemoryMonitor.maxSnapshots) {
          MemoryMonitor.snapshots.shift();
        }

        // Notify all listeners
        MemoryMonitor.listeners.forEach((listener) => {
          try {
            listener(snapshot);
          } catch (error) {
            console.error('Error in memory listener:', error);
          }
        });
      }
    }, interval);

    console.log('Memory monitoring started');
  }

  public stopMonitoring(): void {
    if (MemoryMonitor.intervalId !== null) {
      window.clearInterval(MemoryMonitor.intervalId);
      MemoryMonitor.intervalId = null;
      console.log('Memory monitoring stopped');
    }
  }

  public addListener(listener: MemoryListener): () => void {
    MemoryMonitor.listeners.add(listener);
    return () => {
      MemoryMonitor.listeners.delete(listener);
    };
  }

  public getMemoryTrend(): MemoryTrend {
    if (MemoryMonitor.snapshots.length < 2) {
      return { trend: 'stable', averageGrowthMB: 0 };
    }

    const changes: number[] = [];
    for (let i = 1; i < MemoryMonitor.snapshots.length; i++) {
      const change =
        MemoryMonitor.snapshots[i].memory.usedJSHeapSize -
        MemoryMonitor.snapshots[i - 1].memory.usedJSHeapSize;
      changes.push(change);
    }

    const averageChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const averageGrowthMB = averageChange / (1024 * 1024);

    if (Math.abs(averageGrowthMB) < 1) {
      return { trend: 'stable', averageGrowthMB };
    }
    return {
      trend: averageGrowthMB > 0 ? 'increasing' : 'decreasing',
      averageGrowthMB: Math.abs(averageGrowthMB),
    };
  }

  public getCurrentSnapshot(): MemorySnapshot | null {
    return MemoryMonitor.snapshots[MemoryMonitor.snapshots.length - 1] || null;
  }

  public getSnapshots(): MemorySnapshot[] {
    return [...MemoryMonitor.snapshots];
  }

  public clearSnapshots(): void {
    MemoryMonitor.snapshots = [];
  }

  public removeAllListeners(): void {
    MemoryMonitor.listeners.clear();
  }

  public reset(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    this.clearSnapshots();
  }

  public static resetInstance(): void {
    if (MemoryMonitor.instance) {
      MemoryMonitor.instance.reset();
      const globalScope =
        typeof globalThis !== 'undefined'
          ? globalThis
          : typeof window !== 'undefined'
          ? window
          : typeof global !== 'undefined'
          ? global
          : {};
      delete (globalScope as any)[MemoryMonitor.INSTANCE_KEY];
      MemoryMonitor.instance = undefined as any;
    }
  }
}
