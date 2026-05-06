import { create } from 'zustand';
import type { AuthUser } from '../api/auth';
import { login as apiLogin, register as apiRegister } from '../api/auth';
import type { LoginRequest, RegisterRequest } from '../api/auth';
import { tokenStorage } from '../utils/tokenStorage';
import { getMyProfile } from '../api/users';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<string>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setPhoneVerified: () => void;
  setUser: (user: AuthUser | null) => void;
  refreshProfile: () => Promise<void>;
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

  setUser: user => {
    set({ user });
  },

  refreshProfile: async () => {
    try {
      const me = await getMyProfile();
      set({
        user: {
          id: (me as any).id ?? 0,
          uuid: me.uuid,
          userId: me.userId ?? '',
          email: me.email ?? '',
          nickname: me.nickname ?? '',
          role: me.role ?? 'USER',
        },
      });
    } catch {
      // 인증 만료/네트워크 오류는 화면 단에서 안내
    }
  },

  logout: async () => {
    await tokenStorage.clearTokens();
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    const accessToken = await tokenStorage.getAccessToken();
    const refreshToken = await tokenStorage.getRefreshToken();
    if (accessToken && refreshToken) {
      set({ accessToken, refreshToken, isAuthenticated: true });
      try {
        const me = await getMyProfile();
        set({
          user: {
            id: (me as any).id ?? 0,
            uuid: me.uuid,
            userId: me.userId ?? '',
            email: me.email ?? '',
            nickname: me.nickname ?? '',
            role: me.role ?? 'USER',
          },
        });
      } catch {
        // 프로필 로드 실패 시에도 토큰 세션은 유지
      }
    }
  },
}));
