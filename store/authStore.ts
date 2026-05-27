import { create } from 'zustand';
import type { AuthUser } from '../api/auth';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/auth';
import type { LoginRequest, RegisterRequest } from '../api/auth';
import { tokenStorage } from '../utils/tokenStorage';
import { getMyProfile } from '../api/users';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** 프로필 이미지 URL이 같아도 갤러리 변경 후 UI 갱신용 */
  profileImageCacheBust: number;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<string>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setPhoneVerified: () => void;
  setUser: (user: AuthUser | null) => void;
  bumpProfileImageCache: () => void;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

function userFromProfile(me: Awaited<ReturnType<typeof getMyProfile>>): AuthUser {
  return {
    id: (me as any).id ?? 0,
    uuid: me.uuid,
    userId: me.userId ?? '',
    email: me.email ?? '',
    nickname: me.nickname ?? '',
    role: me.role ?? 'USER',
    profileImageUrl: me.profileImageUrl ?? null,
  };
}

export const useAuthStore = create<AuthState>(set => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  profileImageCacheBust: 0,

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
      isAuthenticated: false,
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

  bumpProfileImageCache: () => {
    set({ profileImageCacheBust: Date.now() });
  },

  refreshProfile: async () => {
    try {
      const me = await getMyProfile();
      set({ user: userFromProfile(me) });
    } catch {
      // 인증 만료/네트워크 오류는 화면 단에서 안내
    }
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
      const me = await getMyProfile();
      set({
        accessToken,
        refreshToken,
        user: userFromProfile(me),
        isAuthenticated: true,
      });
    } catch {
      const stillValid = await tokenStorage.getAccessToken();
      if (stillValid) {
        set({ accessToken: stillValid, refreshToken, isAuthenticated: true });
      }
    }
  },
}));
