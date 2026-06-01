// @ts-nocheck
import axios from "axios";
import { tokenStorage } from "../utils/tokenStorage";

/** preview APK 등 __DEV__=false 빌드에서 EAS env `EXPO_PUBLIC_APK_DEBUG=1` 로 API 로그 활성화 */
const apkDebug = String(process.env.EXPO_PUBLIC_APK_DEBUG ?? "").trim() === "1";
const apiLogEnabled = typeof __DEV__ !== "undefined" && __DEV__ ? true : apkDebug;

export const instance = axios.create({
  baseURL: String(process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, ""),
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

instance.interceptors.request.use(async config => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // APK(릴리스) 포함: 기본 application/json 이 FormData에 붙으면 업로드 전부 실패
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    const h = config.headers;
    if (h) {
      delete h["Content-Type"];
      delete h["content-type"];
      if (typeof h.delete === "function") {
        h.delete("Content-Type");
        h.delete("content-type");
      }
    }
  }
  if (apiLogEnabled) {
    const base = String(config.baseURL ?? "").replace(/\/+$/, "");
    const url = String(config.url ?? "").replace(/^\/+/, "");
    const hasAuth = Boolean((config.headers as any)?.Authorization);
    const isMultipart =
      typeof FormData !== "undefined" && config.data instanceof FormData;
    console.log(
      "[REQ]",
      config.method?.toUpperCase(),
      `${base}/${url}`,
      { hasAuth, multipart: isMultipart },
    );
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function processQueue(newToken: string) {
  const queue = refreshQueue ?? [];
  queue.forEach((resolve) => resolve(newToken));
  refreshQueue = [];
}

instance.interceptors.response.use(
  res => {
    if (apiLogEnabled) {
      console.log("[RES]", res.status, res.config.url);
    }
    return res;
  },
  async err => {
    const silentOptional = err.config?._silentOptional === true;
    const status = err.response?.status;
    const url = String(err.config?.url ?? "");
    if (
      !(
        silentOptional &&
        (status === 404 || status === 501)
      )
    ) {
      const msg =
        err.response?.data?.message ??
        err.response?.data?.error ??
        err.message;
      console.warn("[ERR]", status, url, msg, err.response?.data);
    }

    const originalRequest = err.config;

    // 401이 아니거나, 리프레시 요청 자체가 실패하면 즉시 reject
    const refreshPath = 'auth/token/refresh';
    if (
      err.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url === refreshPath ||
      originalRequest.url === 'auth/refresh'
    ) {
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

      const { data } = await instance.post(refreshPath, { refreshToken });
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
