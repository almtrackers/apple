/**
 * Offline Queue Manager
 * Queues API requests when offline and syncs when online
 */

import { logger } from './logger';

export interface QueuedRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  timestamp: number;
  retries: number;
  maxRetries?: number;
}

class OfflineQueue {
  private static instance: OfflineQueue;
  private readonly STORAGE_KEY = 'offline_queue';
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly MAX_RETRIES = 3;
  private syncInProgress = false;
  private syncListeners: Array<() => void> = [];

  private constructor() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.syncQueue());
      window.addEventListener('offline', () => {
        logger.info('Device went offline - requests will be queued', {}, 'offline-queue');
      });
    }
  }

  static getInstance(): OfflineQueue {
    if (!OfflineQueue.instance) {
      OfflineQueue.instance = new OfflineQueue();
    }
    return OfflineQueue.instance;
  }

  /**
   * Add request to queue
   */
  async enqueue(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    const queuedRequest: QueuedRequest = {
      ...request,
      id: this.generateId(),
      timestamp: Date.now(),
      retries: 0,
      maxRetries: request.maxRetries || this.MAX_RETRIES,
    };

    const queue = this.getQueue();

    // Prevent queue overflow
    if (queue.length >= this.MAX_QUEUE_SIZE) {
      logger.warn('Offline queue is full - removing oldest request', {}, 'offline-queue');
      queue.shift();
    }

    queue.push(queuedRequest);
    this.saveQueue(queue);

    logger.info('Request queued for offline sync', {
      id: queuedRequest.id,
      method: queuedRequest.method,
      url: queuedRequest.url,
    }, 'offline-queue');

    // Try to sync immediately if online
    if (navigator.onLine) {
      this.syncQueue();
    }

    return queuedRequest.id;
  }

  /**
   * Remove request from queue
   */
  dequeue(id: string): void {
    const queue = this.getQueue();
    const filtered = queue.filter(req => req.id !== id);
    this.saveQueue(filtered);
  }

  /**
   * Get all queued requests
   */
  getQueue(): QueuedRequest[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear all queued requests
   */
  clearQueue(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    logger.info('Offline queue cleared', {}, 'offline-queue');
  }

  /**
   * Sync queued requests when online
   */
  async syncQueue(): Promise<void> {
    if (!navigator.onLine || this.syncInProgress) {
      return;
    }

    const queue = this.getQueue();
    if (queue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    logger.info(`Syncing ${queue.length} queued requests`, {}, 'offline-queue');

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://app.almtrace.com/api';
    const successful: string[] = [];
    const failed: QueuedRequest[] = [];

    for (const request of queue) {
      try {
        const url = request.url.startsWith('http') ? request.url : `${apiBaseUrl}${request.url}`;
        
        // Get auth header from localStorage/sessionStorage if available
        const authHeader = typeof window !== 'undefined' 
          ? (sessionStorage.getItem('authCredentials_session') || 
             localStorage.getItem('authCredentials_local') || 
             '')
          : '';

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...request.headers,
        };

        if (authHeader) {
          headers['Authorization'] = `Basic ${authHeader}`;
        }

        const response = await fetch(url, {
          method: request.method,
          headers,
          body: request.data ? JSON.stringify(request.data) : undefined,
        });

        if (response.ok) {
          successful.push(request.id);
          logger.info('Queued request synced successfully', {
            id: request.id,
            url: request.url,
          }, 'offline-queue');
        } else {
          // Retry logic
          request.retries++;
          if (request.retries < (request.maxRetries || this.MAX_RETRIES)) {
            failed.push(request);
            logger.warn('Queued request failed, will retry', {
              id: request.id,
              retries: request.retries,
            }, 'offline-queue');
          } else {
            logger.error('Queued request failed after max retries', {
              id: request.id,
              url: request.url,
            }, 'offline-queue');
          }
        }
      } catch (error) {
        request.retries++;
        if (request.retries < (request.maxRetries || this.MAX_RETRIES)) {
          failed.push(request);
        } else {
          logger.error('Queued request sync error', error, 'offline-queue');
        }
      }
    }

    // Update queue with failed requests
    this.saveQueue(failed);

    // Notify listeners
    this.syncListeners.forEach(listener => listener());

    this.syncInProgress = false;

    logger.info('Queue sync completed', {
      successful: successful.length,
      failed: failed.length,
    }, 'offline-queue');
  }

  /**
   * Add listener for sync completion
   */
  onSync(listener: () => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  /**
   * Get queue statistics
   */
  getStats(): { total: number; oldest: number | null; newest: number | null } {
    const queue = this.getQueue();
    if (queue.length === 0) {
      return { total: 0, oldest: null, newest: null };
    }

    const timestamps = queue.map(req => req.timestamp);
    return {
      total: queue.length,
      oldest: Math.min(...timestamps),
      newest: Math.max(...timestamps),
    };
  }

  private saveQueue(queue: QueuedRequest[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      logger.error('Failed to save offline queue', error, 'offline-queue');
    }
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const offlineQueue = OfflineQueue.getInstance();

