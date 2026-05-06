import { create } from 'zustand';
import type { AuthUser } from '../api/auth';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/auth';
import type { LoginRequest, RegisterRequest } from '../api/auth';
import { tokenStorage } from '../utils/tokenStorage';
import { instance as authApi } from '../api/axios';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<string>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setPhoneVerified: () => void;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(set => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,

  login: async data => {
    const res = await apiLogin(data);
    await tokenStorage.saveTokens(res.accessToken, res.refreshToken);
    set({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      user: res.user,
      isAuthenticated: true,
    });
  },

  register: async data => {
    const res = await apiRegister(data);
    await tokenStorage.saveTokens(res.accessToken, res.refreshToken);
    set({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      user: res.user,
      isAuthenticated: false, // 전화번호 인증 완료 후 true로 변경
    });
    return res.accessToken;
  },

  setTokens: async (accessToken, refreshToken) => {
    await tokenStorage.saveTokens(accessToken, refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },

  setPhoneVerified: () => {
    set({ isAuthenticated: true });
  },

  logout: async () => {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await apiLogout(refreshToken);
      } catch {
        // 서버 오류가 나도 로컬 토큰은 반드시 제거
      }
    }
    await tokenStorage.clearTokens();
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    const accessToken = await tokenStorage.getAccessToken();
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!accessToken || !refreshToken) return;

    try {
      const res = await authApi.get<AuthUser>('auth/me');
      set({ accessToken, refreshToken, user: res.data, isAuthenticated: true });
    } catch {
      // 토큰은 있지만 /auth/me 실패(401 → 자동 갱신 후 재시도됨, 그 외 네트워크 오류 등)
      // 갱신 성공 시 interceptor가 store를 업데이트하므로 여기선 토큰만 세팅
      const stillValid = await tokenStorage.getAccessToken();
      if (stillValid) {
        set({ accessToken: stillValid, refreshToken, isAuthenticated: true });
      }
    }
  },
}));
