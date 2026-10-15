import { speech } from './speech';

class NetworkMonitor {
  private online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: Set<(isOnline: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleStatusChange(true));
      window.addEventListener('offline', () => this.handleStatusChange(false));
    }
  }

  private handleStatusChange(isOnline: boolean) {
    const prev = this.online;
    this.online = isOnline;
    this.listeners.forEach((fn) => fn(this.online));

    if (prev && !isOnline) {
      speech.speak('Offline. Obstacle detection still works.', { priority: 'normal' });
    } else if (!prev && isOnline) {
      speech.speak('Online connection restored.', { priority: 'low' });
    }
  }

  public isOnline(): boolean {
    return this.online;
  }

  public subscribe(listener: (isOnline: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this.online);
    return () => this.listeners.delete(listener);
  }
}

export const network = new NetworkMonitor();
