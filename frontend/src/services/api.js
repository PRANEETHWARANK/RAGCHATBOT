import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000  // 2 min timeout for LLM responses
});

// Add response error interceptor
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      'Unknown error';
    const enriched = new Error(message);
    enriched.status = err.response?.status;
    return Promise.reject(enriched);
  }
);

export default api;
