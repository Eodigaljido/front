import Constants from "expo-constants";

/**
 * `.env`에 `TEST_LOGIN=1` 또는 `EXPO_PUBLIC_TEST_LOGIN=1` (app.config.js extra로 전달됨)
 * 로그인 화면에서 지정 계정으로 자동 로그인합니다. 상용 빌드에서는 반드시 끄세요.
 */
export function isTestAutoLoginEnabled(): boolean {
  const fromExtra = Constants.expoConfig?.extra?.testLogin;
  const raw =
    (fromExtra != null && String(fromExtra).trim() !== ""
      ? String(fromExtra).trim()
      : typeof process !== "undefined"
        ? String(process.env.EXPO_PUBLIC_TEST_LOGIN ?? "").trim()
        : "") || "";
  return raw === "1" || /^true$/i.test(raw) || /^yes$/i.test(raw);
}

/** 테스트 자동 로그인 전용 계정 (TEST_LOGIN=1 일 때만 사용) */
export const TEST_AUTO_LOGIN_IDENTIFIER = "rjsgud49";
export const TEST_AUTO_LOGIN_PASSWORD = "rjsgud49!!";
