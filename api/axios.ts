// api/axios.ts
// @ts-nocheck
import axios from 'axios';
import { tokenStorage } from '../utils/tokenStorage';

export const instance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// 요청마다 SecureStore에서 토큰을 읽어 Authorization 헤더 주입
instance.interceptors.request.use(async config => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (__DEV__) {
    console.log('[REQ]', config.method?.toUpperCase(), config.baseURL + config.url, config.data);
  }
  return config;
});

// 응답 로그 (개발 환경에서만 출력 — 프로덕션 console은 JS 스레드 부하)
instance.interceptors.response.use(
  res => {
    if (__DEV__) {
      console.log('[RES]', res.status, res.config.url, res.data);
    }
    return res;
  },
  err => {
    if (__DEV__) {
      console.log('[ERR]', err.response?.status, err.config?.url, err.response?.data);
    }
    return Promise.reject(err);
  },
);
