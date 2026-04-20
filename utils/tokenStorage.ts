import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'jwt_access_token';
const REFRESH_TOKEN_KEY = 'jwt_refresh_token';

export const tokenStorage = {
  saveTokens: async (accessToken: string, refreshToken: string): Promise<void> => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  },

  getAccessToken: (): Promise<string | null> =>
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),

  getRefreshToken: (): Promise<string | null> =>
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),

  clearTokens: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
