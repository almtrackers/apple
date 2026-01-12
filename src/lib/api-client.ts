/**
 * Enhanced API client with retry logic, error handling, and subdomain isolation
 */

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from './logger';

/**
 * Get the current subdomain for request isolation
 */
function getCurrentSubdomain(): string | null {
  if (typeof window === 'undefined') return null; // Server-side

  const hostname = window.location.hostname;

  // Skip for localhost development
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return null;
  }

  // Extract subdomain from *.almtrace.com
  const parts = hostname.split('.');
  if (parts.length >= 3 && parts[parts.length - 2] === 'almtrace' && parts[parts.length - 1] === 'com') {
    return parts[0]; // e.g., 'ebill' or 'apple'
  }

  return null;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  data?: any;
}

class ApiClient {
  private client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://app.almtrace.com/api',
    timeout: 30000, // 30 seconds
    // Explicitly disable withCredentials to prevent cross-subdomain cookie leakage
    withCredentials: false,
  });

  private retryConfig = {
    maxRetries: 3,
    retryDelay: 1000, // Start with 1 second
    retryableStatuses: [408, 429, 500, 502, 503, 504],
    retryableErrors: ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'],
  };

  constructor() {
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('API Request', {
          method: config.method,
          url: config.url,
        }, 'api-client');

        // Add subdomain header for tracking and debugging
        const subdomain = getCurrentSubdomain();
        if (subdomain) {
          config.headers['X-Subdomain'] = subdomain;
        }

        // Log cross-subdomain requests for debugging
        if (config.url && config.url.includes('almtrace.com') && !config.url.includes(subdomain || '')) {
          logger.warn(`Cross-subdomain request detected: ${config.url} from subdomain: ${subdomain}`, {}, 'api-client');
        }

        return config;
      },
      (error) => {
        logger.error('API Request Error', error, 'api-client');
        return Promise.reject(error);
      }
    );

    // Response interceptor with retry logic
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('API Response', {
          status: response.status,
          url: response.config.url,
        }, 'api-client');
        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

        // Don't retry if already retried or no config
        if (!config || config._retry) {
          return this.handleError(error);
        }

        // Check if error is retryable
        const shouldRetry = this.shouldRetry(error, config._retryCount || 0);

        if (shouldRetry) {
          config._retry = true;
          config._retryCount = (config._retryCount || 0) + 1;

          const delay = this.calculateRetryDelay(config._retryCount);
          logger.warn(`Retrying API request (attempt ${config._retryCount}/${this.retryConfig.maxRetries})`, {
            url: config.url,
            delay,
          }, 'api-client');

          await this.sleep(delay);
          return this.client(config);
        }

        return this.handleError(error);
      }
    );
  }

  private shouldRetry(error: AxiosError, retryCount: number): boolean {
    if (retryCount >= this.retryConfig.maxRetries) {
      return false;
    }

    // Don't retry on 401 (authentication errors)
    if (error.response?.status === 401) {
      return false;
    }

    // Retry on network errors
    if (!error.response && error.code) {
      return this.retryConfig.retryableErrors.includes(error.code);
    }

    // Retry on specific HTTP status codes
    if (error.response?.status) {
      return this.retryConfig.retryableStatuses.includes(error.response.status);
    }

    return false;
  }

  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return Math.min(
      this.retryConfig.retryDelay * Math.pow(2, retryCount - 1),
      10000 // Max 10 seconds
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private handleError(error: AxiosError): Promise<never> {
    const apiError: ApiError = {
      message: this.getErrorMessage(error),
      status: error.response?.status,
      code: error.code,
      data: error.response?.data,
    };

    // Handle 401 - Unauthorized
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        logger.warn('Unauthorized - redirecting to login', {}, 'api-client');
        localStorage.removeItem('authCredentials');
        sessionStorage.clear();
        window.location.href = '/login';
      }
    }

    logger.error('API Error', apiError, 'api-client');
    return Promise.reject(apiError);
  }

  private getErrorMessage(error: AxiosError): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }

  // Public methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  // Set authorization header
  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Basic ${token}`;
  }

  // Remove authorization header
  clearAuth() {
    delete this.client.defaults.headers.common['Authorization'];
  }
}

export const apiClient = new ApiClient();

// Export default for backward compatibility
export default apiClient;

