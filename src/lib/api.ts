
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://app.almtrace.com/api',
});

apiClient.interceptors.response.use(
  response => response,
  async error => {
    if (error.response && error.response.status === 401) {
      // Don't redirect on login page to avoid loops
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        localStorage.removeItem('authCredentials');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
