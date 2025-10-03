import axios from 'axios';

const envBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

let resolvedBaseUrl: string;

if (envBaseUrl && envBaseUrl.length > 0) {
  resolvedBaseUrl = envBaseUrl;
} else if (typeof window !== 'undefined') {
  const { protocol, hostname, port, origin } = window.location;
  if (port === '5173' || port === '4173') {
    resolvedBaseUrl = `${protocol}//${hostname}:3000`;
  } else {
    resolvedBaseUrl = origin;
  }
} else {
  resolvedBaseUrl = 'http://localhost:3000';
}

const api = axios.create({
  baseURL: resolvedBaseUrl,
  withCredentials: true
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('guss_token');
      localStorage.removeItem('guss_token_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
