import { instance as authApi } from "../axios";

export { authApi };

// ── 공통 타입 ────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  uuid: string;
  userId: string;
  email: string;
  nickname: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
}

export interface ApiError {
  status: number;
  message: string;
  timestamp: string;
}
