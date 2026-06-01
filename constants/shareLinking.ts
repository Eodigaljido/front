import { getStateFromPath as defaultGetStateFromPath } from "@react-navigation/native";
import { useAuthStore } from "../store/authStore";
import { parseSharePathFromUrl } from "../utils/parseSharePath";
import { setPendingShareLink } from "../utils/pendingShareLink";

/** 공유·Universal Link 호스트 (EXPO_PUBLIC_SHARE_BASE_URL과 동일 도메인) */
export const SHARE_LINK_HOST = "eodigaljido.uk";

export const APP_SCHEME = "eodigaljido";

export const linkingPrefixes = [
  `https://${SHARE_LINK_HOST}`,
  `${APP_SCHEME}://`,
] as const;

const linkingConfig = {
  screens: {
    RouteCreate: {
      path: "routes/collaborative/:editRouteId",
      parse: {
        editRouteId: (id: string) =>
          decodeURIComponent(String(id ?? "").trim()),
        collaborative: () => true,
      },
    },
    Tabs: {
      screens: {
        Route: {
          path: "courses/public/:viewCourseId",
          parse: {
            viewCourseId: (id: string) =>
              decodeURIComponent(String(id ?? "").trim()),
            section: () => "shared" as const,
          },
        },
        /** https://eodigaljido.uk/friends/add/{friendCode} */
        All: {
          path: "friends/add/:friendCode",
          parse: {
            friendCode: (code: string) =>
              decodeURIComponent(String(code ?? "").trim()),
          },
        },
      },
    },
  },
} as const;

/** React Navigation linking — 비로그인 시 공유 URL 보관 후 Login */
export const appLinking = {
  prefixes: [...linkingPrefixes],
  config: linkingConfig,
  getStateFromPath(
    path: string,
    options?: Parameters<typeof defaultGetStateFromPath>[1],
  ) {
    const parsed = parseSharePathFromUrl(path);
    if (parsed && !useAuthStore.getState().isAuthenticated) {
      setPendingShareLink(parsed);
      return { routes: [{ name: "Login" as const }] };
    }
    return defaultGetStateFromPath(path, {
      ...options,
      screens: linkingConfig.screens as any,
    });
  },
};
