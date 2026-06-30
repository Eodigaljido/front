import React from "react";
import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { usePasswordMask } from "../hooks/usePasswordMask";
import { useAuthStore } from "../store/authStore";
import { getOnboardingStatus } from "../api/onboard";
import {
  isTestAutoLoginEnabled,
  TEST_AUTO_LOGIN_IDENTIFIER,
  TEST_AUTO_LOGIN_PASSWORD,
} from "../constants/testLogin";
import { kakaoOAuth, googleOAuth } from "../api/auth";
import OAuthWebViewModal from "../components/OAuthWebViewModal";
import { tokenStorage } from "../utils/tokenStorage";
import { resetToMainAfterAuth } from "../utils/pendingShareLink";
import {
  signInWithGoogleNative,
  formatGoogleOAuthBackendError,
} from "../utils/googleSignIn";
import {
  authInputStyle,
  authTextInputColorProps,
} from "../constants/authFormTheme";

const KAKAO_REST_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? "";
const KAKAO_REDIRECT_URI = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URI ?? "";

const KAKAO_AUTH_URL =
  `https://kauth.kakao.com/oauth/authorize` +
  `?client_id=${KAKAO_REST_KEY}` +
  `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}` +
  `&response_type=code`;

type LoginNavProp = NativeStackNavigationProp<RootStackParamList, "Login">;

export default function LoginScreen() {
  const navigation = useNavigation<LoginNavProp>();
  const [identifier, setIdentifier] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleOAuthPending, setIsGoogleOAuthPending] = useState(false);
  const [oauthModal, setOauthModal] = useState<"kakao" | "google" | null>(null);
  const {
    displayPassword,
    realPasswordRef,
    handleInput,
    maskAll,
    revealed,
    toggleReveal,
  } = usePasswordMask();
  const loginStore = useAuthStore((s) => s.login);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const passwordRef = useRef<TextInput>(null);

  async function handleLogin() {
    setLoginError("");
    if (!identifier.trim() || !realPasswordRef.current) {
      const msg = "아이디 혹은 비밀번호가 틀렸습니다.";
      setLoginError(msg);
      return;
    }
    setIsLoading(true);
    try {
      await loginStore({
        identifier: identifier.trim(),
        password: realPasswordRef.current,
      });
      const accessToken = useAuthStore.getState().accessToken!;
      const { completed } = await getOnboardingStatus(accessToken);
      if (!completed) {
        navigation.reset({ index: 0, routes: [{ name: "OnBoardStart" }] });
      } else {
        await resetToMainAfterAuth(navigation);
      }
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "아이디 혹은 비밀번호가 틀렸습니다.";
      setLoginError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGooglePress() {
    if (isLoading || isGoogleOAuthPending) return;
    setLoginError("");
    setIsGoogleOAuthPending(true);
    try {
      const result = await signInWithGoogleNative();
      if (!result.ok) {
        if (result.reason !== "cancelled") {
          setLoginError(result.message ?? "구글 로그인에 실패했습니다.");
        }
        return;
      }
      await handleGoogleIdToken(result.idToken);
    } finally {
      setIsGoogleOAuthPending(false);
    }
  }

  async function handleGoogleIdToken(idToken: string) {
    setIsLoading(true);
    setLoginError("");
    try {
      const res = await googleOAuth({ idToken });

      await tokenStorage.saveTokens(res.accessToken, res.refreshToken);
      await tokenStorage.saveUserUuid(res.user.uuid);
      await setTokens(res.accessToken, res.refreshToken);
      setUser(res.user);
      await refreshProfile().catch(() => {});

      const { completed } = await getOnboardingStatus(res.accessToken);
      if (!completed) {
        navigation.reset({ index: 0, routes: [{ name: "OnBoardStart" }] });
      } else {
        await resetToMainAfterAuth(navigation);
      }
    } catch (err: unknown) {
      const backendMsg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setLoginError(formatGoogleOAuthBackendError(backendMsg, idToken));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOAuthCode(_provider: "kakao", code: string) {
    setOauthModal(null);
    setIsLoading(true);
    setLoginError("");
    try {
      const res = await kakaoOAuth({ code, redirectUri: KAKAO_REDIRECT_URI });

      await tokenStorage.saveTokens(res.accessToken, res.refreshToken);
      await tokenStorage.saveUserUuid(res.user.uuid);
      await setTokens(res.accessToken, res.refreshToken);
      setUser(res.user);
      await refreshProfile().catch(() => {});

      const { completed } = await getOnboardingStatus(res.accessToken);
      if (!completed) {
        navigation.reset({ index: 0, routes: [{ name: "OnBoardStart" }] });
      } else {
        await resetToMainAfterAuth(navigation);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "소셜 로그인에 실패했습니다. 다시 시도해주세요.";
      setLoginError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!isTestAutoLoginEnabled()) return;
    let cancelled = false;
    setIdentifier(TEST_AUTO_LOGIN_IDENTIFIER);
    setIsLoading(true);
    setLoginError("");
    (async () => {
      try {
        await loginStore({
          identifier: TEST_AUTO_LOGIN_IDENTIFIER,
          password: TEST_AUTO_LOGIN_PASSWORD,
        });
        if (cancelled) return;
        const accessToken = useAuthStore.getState().accessToken!;
        const { completed } = await getOnboardingStatus(accessToken);
        if (!completed) {
          navigation.reset({
            index: 0,
            routes: [{ name: "OnBoardStart" }],
          });
        } else {
          await resetToMainAfterAuth(navigation);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("[LoginScreen] 테스트 자동 로그인 실패:", err);
          const errorMessage =
            err?.response?.data?.message ||
            err?.message ||
            "테스트 자동 로그인에 실패했습니다.";
          setLoginError(errorMessage);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loginStore, navigation]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center justify-center flex-1 px-10 bg-white">
            {/* 로고 */}
            <Image
              source={require("@/assets/logo.png")}
              className="w-48 h-48 mb-3 rounded-2xl"
              resizeMode="contain"
            />

            {/* 타이틀 */}
            <Text className="mb-12 text-2xl font-bold text-gray-900">
              어디
              <Text className="text-blue-500">
                갈<Text className="text-green-600">지</Text>도
              </Text>
            </Text>

            {/* 입력 */}
            <View className="w-full gap-6 mb-2">
              <TextInput
                {...authTextInputColorProps}
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="이메일 또는 아이디 입력"
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
                className="w-full h-auto px-5 py-4 bg-gray-100 rounded-full"
                style={authInputStyle()}
              />
              <View className="justify-center w-full">
                <TextInput
                  {...authTextInputColorProps}
                  ref={passwordRef}
                  value={displayPassword}
                  onChangeText={handleInput}
                  onBlur={maskAll}
                  placeholder="비밀번호 입력"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  className="w-full h-auto px-5 py-4 pr-14 bg-gray-100 rounded-full"
                  style={authInputStyle()}
                />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={toggleReveal}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    position: "absolute",
                    right: 20,
                    top: 0,
                    bottom: 0,
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={revealed ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* 로그인 에러 */}
            {loginError && (
              <View
                className="w-full px-4 py-2.5 mb-4 bg-red-50 border border-red-300 rounded-lg"
                style={{ marginTop: 10 }}
              >
                <Text className="text-sm font-medium text-red-600">
                  {loginError}
                </Text>
              </View>
            )}

            {/* 버튼 */}
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isLoading}
              onPress={handleLogin}
              className="items-center justify-center w-full h-12 mt-2 bg-blue-500 rounded-full"
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-bold text-white">로그인</Text>
              )}
            </TouchableOpacity>

            {/* 링크 */}
            <View className="flex-row items-center gap-2 mt-4">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate("FindAccount")}
              >
                <Text className="text-sm text-gray-700">
                  계정을 잊으셨나요?
                </Text>
              </TouchableOpacity>
              <Text className="text-base font-black text-gray-300">|</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate("Signup")}
              >
                <Text className="text-sm text-blue-500">회원가입</Text>
              </TouchableOpacity>
            </View>

            {/* 소셜 */}
            <View className="flex-row gap-4 mt-6">
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isLoading}
                onPress={() => setOauthModal("kakao")}
                className="items-center justify-center w-12 h-12 bg-[#ffeb00] rounded-full overflow-hidden"
              >
                <Image
                  style={{ width: "75%", height: "75%" }}
                  source={require("@/assets/kakaotalk_sharing_btn/kakaotalk_sharing_btn_small.png")}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isLoading || isGoogleOAuthPending}
                onPress={() => void handleGooglePress()}
                className="items-center justify-center w-12 h-12 bg-white border border-gray-200 rounded-full"
              >
                <Image
                  style={{ width: "50%", height: "50%" }}
                  source={require("@/assets/Google_logo.png")}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {oauthModal === "kakao" && (
        <OAuthWebViewModal
          visible
          authUrl={KAKAO_AUTH_URL}
          redirectUri={KAKAO_REDIRECT_URI}
          onCode={(code) => handleOAuthCode("kakao", code)}
          onClose={() => setOauthModal(null)}
        />
      )}

      <Modal visible={isGoogleOAuthPending} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/40">
          <View className="items-center px-8 py-6 bg-white rounded-2xl">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="mt-4 text-base font-medium text-gray-800">
              구글 로그인 중…
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
