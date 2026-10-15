export interface AskLogItem {
  transcript: string;
  tool: string;
  source: 'local' | 'gemini' | 'mock';
  latencyMs?: number;
  confidence: number;
  timestamp: number;
}

class AskLogManager {
  private logs: AskLogItem[] = [];
  private listeners: Set<(logs: AskLogItem[]) => void> = new Set();

  public add(item: Omit<AskLogItem, 'timestamp'>): void {
    const entry: AskLogItem = {
      ...item,
      timestamp: Date.now(),
    };
    this.logs.unshift(entry);
    if (this.logs.length > 5) {
      this.logs = this.logs.slice(0, 5);
    }
    this.notify();
  }

  public getLogs(): AskLogItem[] {
    return [...this.logs];
  }

  public subscribe(listener: (logs: AskLogItem[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const current = this.getLogs();
    this.listeners.forEach((l) => l(current));
  }

  public clear(): void {
    this.logs = [];
    this.notify();
  }
}

export const askLog = new AskLogManager();
