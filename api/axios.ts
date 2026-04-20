// api/axios.ts
// @ts-nocheck
import axios from 'axios';

export const instance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// 하단은 요청/응답 로그를 출력
// 개발 환경에서만 사용할 것

// 요청 로그
instance.interceptors.request.use(config => {
  console.log('[REQ]', config.method?.toUpperCase(), config.baseURL + config.url, config.data, config.headers?.Authorization);
  return config;
});

// 응답 로그
instance.interceptors.response.use(
  res => {
    console.log('[RES]', res.status, res.config.url, res.data);
    return res;
  },
  err => {
    console.log('[ERR]', err.response?.status, err.config?.url, err.response?.data, err.code, err.message);
    return Promise.reject(err);
  },
);
