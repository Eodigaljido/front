import { create } from 'zustand';
import type { AuthUser } from '../api/auth';
import { login as apiLogin, register as apiRegister } from '../api/auth';
import type { LoginRequest, RegisterRequest } from '../api/auth';
import { tokenStorage } from '../utils/tokenStorage';

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
    await tokenStorage.saveUserUuid(res.user.uuid);
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
    await tokenStorage.saveUserUuid(res.user.uuid);
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
    await tokenStorage.clearTokens();
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    const accessToken = await tokenStorage.getAccessToken();
    const refreshToken = await tokenStorage.getRefreshToken();
    const userUuid = await tokenStorage.getUserUuid();
    if (accessToken && refreshToken) {
      set({
        accessToken,
        refreshToken,
        isAuthenticated: true,
        // user는 uuid만 복원 — 나머지 필드는 필요 시 프로필 API로 갱신
        user: userUuid ? { uuid: userUuid } as any : null,
      });
    }
  },
}));
