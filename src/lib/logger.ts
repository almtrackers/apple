/**
 * Centralized logging service
 * Replaces console.log/error/warn with structured logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
  context?: string;
  userId?: number;
}

class Logger {
  private static instance: Logger;
  private isProduction = process.env.NODE_ENV === 'production';
  private logBuffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 100;

  private constructor() {
    // Flush logs periodically in production
    if (this.isProduction) {
      setInterval(() => this.flushLogs(), 30000); // Every 30 seconds
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: LogLevel, message: string, data?: any, context?: string): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      data: data ? (typeof data === 'object' ? JSON.stringify(data) : data) : undefined,
      context,
      userId: typeof window !== 'undefined' ? this.getUserId() : undefined,
    };
  }

  private getUserId(): number | undefined {
    try {
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user?.id;
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  }

  private log(level: LogLevel, message: string, data?: any, context?: string) {
    const entry = this.formatMessage(level, message, data, context);

    // In development, log to console
    if (!this.isProduction) {
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](`[${entry.timestamp}] [${level.toUpperCase()}]`, message, data || '');
    }

    // In production, buffer logs
    if (this.isProduction) {
      this.logBuffer.push(entry);
      if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
        this.logBuffer.shift(); // Remove oldest entry
      }

      // Send critical errors immediately
      if (level === 'error') {
        this.sendToErrorTracking(entry);
      }
    }
  }

  private async sendToErrorTracking(entry: LogEntry) {
    try {
      // TODO: Integrate with error tracking service (Sentry, LogRocket, etc.)
      // Example:
      // if (window.Sentry) {
      //   window.Sentry.captureException(new Error(entry.message), {
      //     extra: entry.data,
      //     tags: { context: entry.context },
      //   });
      // }

      // For now, send to API endpoint if available
      if (typeof window !== 'undefined' && navigator.onLine) {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        }).catch(() => {
          // Ignore errors - logging shouldn't break the app
        });
      }
    } catch {
      // Ignore errors
    }
  }

  private async flushLogs() {
    if (this.logBuffer.length === 0 || !navigator.onLine) {
      return;
    }

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await fetch('/api/logs/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logsToSend }),
      });
    } catch {
      // Re-add logs to buffer if send fails
      this.logBuffer.unshift(...logsToSend);
    }
  }

  debug(message: string, data?: any, context?: string) {
    this.log('debug', message, data, context);
  }

  info(message: string, data?: any, context?: string) {
    this.log('info', message, data, context);
  }

  warn(message: string, data?: any, context?: string) {
    this.log('warn', message, data, context);
  }

  error(message: string, error?: Error | any, context?: string) {
    const errorData = error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : error;

    this.log('error', message, errorData, context);
  }
}

export const logger = Logger.getInstance();

// Convenience exports
export const log = logger.info.bind(logger);
export const logError = logger.error.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logDebug = logger.debug.bind(logger);

