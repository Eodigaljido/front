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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

type LoginNavProp = NativeStackNavigationProp<RootStackParamList, "Login">;

export default function LoginScreen() {
  const navigation = useNavigation<LoginNavProp>();
  const [identifier, setIdentifier] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { displayPassword, realPasswordRef, handleInput, maskAll } =
    usePasswordMask();
  const loginStore = useAuthStore((s) => s.login);
  const passwordRef = useRef<TextInput>(null);

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
          navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
        }
      } catch {
        if (!cancelled) {
          setLoginError("테스트 자동 로그인에 실패했습니다.");
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
            <Text className="mb-12 text-2xl font-bold">
              어디
              <Text className="text-blue-500">
                갈<Text className="text-green-600">지</Text>도
              </Text>
            </Text>

            {/* 입력 */}
            <View className="w-full gap-6 mb-2">
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="이메일 또는 아이디 입력"
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
                className="w-full h-auto px-5 py-4 bg-gray-100 rounded-full"
              />
              <TextInput
                ref={passwordRef}
                value={displayPassword}
                onChangeText={handleInput}
                onBlur={maskAll}
                placeholder="비밀번호 입력"
                returnKeyType="done"
                className="w-full h-auto px-5 py-4 bg-gray-100 rounded-full"
              />
            </View>

            {/* 로그인 에러 */}
            <Text
              className="w-full px-4 mb-3 text-sm text-left text-red-500"
              style={{ minHeight: 20 }}
            >
              {loginError}
            </Text>

            {/* 버튼 */}
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isLoading}
              onPress={async () => {
                setLoginError("");
                if (!identifier.trim() || !realPasswordRef.current) {
                  setLoginError("아이디 혹은 비밀번호가 틀렸습니다.");
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
                    navigation.reset({
                      index: 0,
                      routes: [{ name: "OnBoardStart" }],
                    });
                  } else {
                    navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
                  }
                } catch {
                  setLoginError("아이디 혹은 비밀번호가 틀렸습니다.");
                } finally {
                  setIsLoading(false);
                }
              }}
              className="items-center justify-center w-full h-12 mt-2 bg-blue-500 rounded-full"
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-bold text-white">로그인</Text>
              )}
            </TouchableOpacity>

            {/* 링크 */}
            <View className="flex-row items-center gap-2 mt-2">
              <Text className="text-sm text-gray-700">비밀번호 찾기</Text>
              <Text className="text-base font-black text-gray-300">|</Text>
              <TouchableOpacity
                activeOpacity={0.3}
                onPress={() => navigation.navigate("Signup")}
              >
                <Text className="text-sm text-gray-700">회원가입</Text>
              </TouchableOpacity>
            </View>

            {/* 소셜 */}
            <View className="flex-row gap-4 mt-6">
              <TouchableOpacity
                activeOpacity={0.7}
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
    </SafeAreaView>
  );
}
