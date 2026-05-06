// api/axios.ts
// @ts-nocheck
import axios from 'axios';
import { tokenStorage } from '../utils/tokenStorage';

export const instance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

instance.interceptors.request.use(async config => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('[REQ]', config.method?.toUpperCase(), config.baseURL + config.url, config.data);
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function processQueue(newToken: string) {
  refreshQueue.forEach(resolve => resolve(newToken));
  refreshQueue = [];
}

instance.interceptors.response.use(
  res => {
    console.log('[RES]', res.status, res.config.url, res.data);
    return res;
  },
  async err => {
    console.log('[ERR]', err.response?.status, err.config?.url, err.response?.data);

    const originalRequest = err.config;

    // 401이 아니거나, 리프레시 요청 자체가 실패하면 즉시 reject
    if (err.response?.status !== 401 || originalRequest._retry || originalRequest.url === 'auth/refresh') {
      return Promise.reject(err);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      // 이미 갱신 중이면 완료 후 재시도
      return new Promise(resolve => {
        refreshQueue.push((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(instance(originalRequest));
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) throw new Error('no refresh token');

      const { data } = await instance.post('auth/refresh', { refreshToken });
      const newAccess: string = data.accessToken;
      const newRefresh: string = data.refreshToken ?? refreshToken;

      await tokenStorage.saveTokens(newAccess, newRefresh);

      // zustand store도 동기화 (hooks 없이 getState 사용)
      const { useAuthStore } = await import('../store/authStore');
      useAuthStore.getState().setTokens(newAccess, newRefresh);

      processQueue(newAccess);
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return instance(originalRequest);
    } catch (refreshErr) {
      refreshQueue = [];
      await tokenStorage.clearTokens();
      const { useAuthStore } = await import('../store/authStore');
      useAuthStore.setState({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);
