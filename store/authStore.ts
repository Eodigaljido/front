import { create } from 'zustand';
import type { AuthUser } from '../api/auth';
import { login as apiLogin, register as apiRegister } from '../api/auth';
import type { LoginRequest, RegisterRequest } from '../api/auth';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<string>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setPhoneVerified: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>(set => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,

  login: async data => {
    const res = await apiLogin(data);
    set({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      user: res.user,
      isAuthenticated: true,
    });
  },

  register: async data => {
    const res = await apiRegister(data);
    set({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      user: res.user,
      isAuthenticated: false, // 전화번호 인증 완료 후 true로 변경
    });
    return res.accessToken;
  },

  setTokens: (accessToken, refreshToken) => {
    set({ accessToken, refreshToken, isAuthenticated: true });
  },

  setPhoneVerified: () => {
    set({ isAuthenticated: true });
  },

  logout: () => {
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
  },
}));
