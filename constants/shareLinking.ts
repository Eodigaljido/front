/** 공유·Universal Link 호스트 (EXPO_PUBLIC_SHARE_BASE_URL과 동일 도메인) */
export const SHARE_LINK_HOST = 'share.eodigaljido.rjsgud.com';

export const APP_SCHEME = 'eodigaljido';

export const linkingPrefixes = [
  `https://${SHARE_LINK_HOST}`,
  `${APP_SCHEME}://`,
] as const;

/** React Navigation linking */
export const appLinking = {
  prefixes: [...linkingPrefixes],
  config: {
    screens: {
      Tabs: {
        screens: {
          SharedRoute: {
            path: 'courses/public/:viewCourseId',
          },
          /** https://share.eodigaljido.rjsgud.com/friends/add/{friendCode} */
          All: {
            path: 'friends/add/:friendCode',
            parse: {
              friendCode: (code: string) => decodeURIComponent(String(code ?? '').trim()),
            },
          },
        },
      },
    },
  },
};
