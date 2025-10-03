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

export const API_BASE_URL = resolvedBaseUrl;
export const TOKEN_STORAGE_KEY = 'guss_token';
export const USER_STORAGE_KEY = `${TOKEN_STORAGE_KEY}_user`;

const api = axios.create({
  baseURL: resolvedBaseUrl
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401 && typeof window !== 'undefined') {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(USER_STORAGE_KEY);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
