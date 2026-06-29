import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { appAlert } from '../utils/appAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { usePasswordMask } from '../hooks/usePasswordMask';
import {
  sendPhoneCode,
  verifyPhoneCode,
  kakaoOAuth,
  googleOAuth,
} from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { OtpModal } from '../components/OtpModal';
import OAuthWebViewModal from '../components/OAuthWebViewModal';
import { tokenStorage } from '../utils/tokenStorage';
import { getOnboardingStatus } from '../api/onboard';
import {
  signInWithGoogleNative,
  formatGoogleOAuthBackendError,
} from '../utils/googleSignIn';
import {
  authInputStyle,
  authTextInputColorProps,
} from '../constants/authFormTheme';

const KAKAO_REST_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '';
const KAKAO_REDIRECT_URI = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URI ?? '';

const KAKAO_AUTH_URL =
  `https://kauth.kakao.com/oauth/authorize` +
  `?client_id=${KAKAO_REST_KEY}` +
  `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}` +
  `&response_type=code`;

type SignupNavProp = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

const TIMER_SECONDS = 5 * 60;
const DEBOUNCE_MS = 500;

// 010-0000-0000 형태로 포맷 (숫자만 추출 후 하이픈 삽입)
function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function validateField(field: string, value: string): string {
  switch (field) {
    case 'userId':
      return !value.trim() ? '아이디를 입력해주세요.' : '';
    case 'email':
      return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? '올바른 이메일 형식이 아니에요.'
        : '';
    case 'nickname':
      return value.trim().length < 2 ? '닉네임은 2자 이상이어야해요.' : '';
    case 'password':
      return !/[~!@#$%^&*]/.test(value)
        ? '특수문자(~,!,@,#,$,%,^,&,*) 중 하나를 포함해야해요.'
        : '';
    case 'phone':
      return value.replace(/\D/g, '').length < 11
        ? '올바른 휴대전화 번호를 입력해주세요.'
        : '';
    default:
      return '';
  }
}

export default function SignupScreen() {
  const navigation = useNavigation<SignupNavProp>();
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleOAuthPending, setIsGoogleOAuthPending] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [oauthModal, setOauthModal] = useState<'kakao' | 'google' | null>(null);
  const [otpExpiry, setOtpExpiry] = useState(TIMER_SECONDS);
  const registerStore = useAuthStore(
    (s: ReturnType<typeof useAuthStore.getState>) => s.register,
  );
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const userIdRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const nicknameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  const {
    displayPassword,
    realPasswordRef,
    handleInput: maskHandleInput,
    maskAll,
    revealed,
    toggleReveal,
  } = usePasswordMask();

  // 언마운트 시 debounce 타이머 정리
  useEffect(() => {
    return () => {
      Object.values(debounceRefs.current).forEach(clearTimeout);
    };
  }, []);

  const setFieldError = useCallback((field: string, value: string) => {
    setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
  }, []);

  // 입력 중: touched된 필드만 debounce 후 검증
  const handleChange = useCallback(
    (field: string, value: string, setter: (v: string) => void) => {
      setter(value);
      if (!touched[field]) return;
      clearTimeout(debounceRefs.current[field]);
      debounceRefs.current[field] = setTimeout(() => {
        setFieldError(field, value);
      }, DEBOUNCE_MS);
    },
    [touched, setFieldError],
  );

  // 포커스 아웃: 즉시 검증 + touched 표시
  const handleBlur = useCallback(
    (field: string, value: string) => {
      clearTimeout(debounceRefs.current[field]);
      setTouched((prev) => ({ ...prev, [field]: true }));
      setFieldError(field, value);
    },
    [setFieldError],
  );

  const handlePasswordInput = useCallback(
    (inputText: string) => {
      const newReal = maskHandleInput(inputText);

      if (touched['password']) {
        clearTimeout(debounceRefs.current['password']);
        debounceRefs.current['password'] = setTimeout(
          () => setFieldError('password', newReal),
          DEBOUNCE_MS,
        );
      }
    },
    [touched, setFieldError, maskHandleInput],
  );

  const validateAll = () => {
    const values = {
      userId,
      email,
      nickname,
      password: realPasswordRef.current,
      phone,
    };
    const newErrors = Object.fromEntries(
      Object.entries(values).map(([field, value]) => [
        field,
        validateField(field, value),
      ]),
    );
    setErrors(newErrors);
    setTouched({
      userId: true,
      email: true,
      nickname: true,
      password: true,
      phone: true,
    });
    return newErrors;
  };

  const focusFirstError = (errs: Record<string, string>) => {
    if (errs.userId) userIdRef.current?.focus();
    else if (errs.email) emailRef.current?.focus();
    else if (errs.nickname) nicknameRef.current?.focus();
    else if (errs.password) passwordRef.current?.focus();
    else if (errs.phone) phoneRef.current?.focus();
  };

  const handleSignup = async () => {
    const errs = validateAll();
    if (Object.values(errs).some(Boolean)) {
      focusFirstError(errs);
      return;
    }
    if (!isPhoneVerified) {
      appAlert('', '휴대전화 인증 필요');
      return;
    }
    setIsLoading(true);
    try {
      await registerStore({
        userId: userId.trim(),
        email: email.trim(),
        password: realPasswordRef.current,
        nickname: nickname.trim(),
      });
      useAuthStore.getState().setPhoneVerified();
      navigation.navigate('OnBoardStart');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '회원가입에 실패했습니다.';
      appAlert('회원가입 실패', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGooglePress = async () => {
    if (isLoading || isGoogleOAuthPending) return;

    setIsGoogleOAuthPending(true);
    try {
      const result = await signInWithGoogleNative();
      if (!result.ok) {
        if (result.reason !== 'cancelled') {
          appAlert('', result.message ?? '구글 로그인에 실패했습니다.');
        }
        return;
      }
      await handleGoogleIdToken(result.idToken);
    } finally {
      setIsGoogleOAuthPending(false);
    }
  };

  const handleGoogleIdToken = async (idToken: string) => {
    setIsLoading(true);
    try {
      const res = await googleOAuth({ idToken });

      await tokenStorage.saveTokens(res.accessToken, res.refreshToken);
      await tokenStorage.saveUserUuid(res.user.uuid);
      await setTokens(res.accessToken, res.refreshToken);
      setUser(res.user);

      const { completed } = await getOnboardingStatus(res.accessToken);
      if (!completed) {
        navigation.reset({ index: 0, routes: [{ name: 'OnBoardStart' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        appAlert(
          '이미 가입된 계정',
          '동일한 이메일로 가입된 계정이 있습니다. 기존 계정으로 로그인해주세요.',
          [{ text: '확인', onPress: () => navigation.navigate('Login') }],
        );
      } else {
        appAlert(
          '오류',
          formatGoogleOAuthBackendError(err?.response?.data?.message, idToken),
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthCode = async (_provider: 'kakao', code: string) => {
    setOauthModal(null);
    setIsLoading(true);
    try {
      const res = await kakaoOAuth({ code, redirectUri: KAKAO_REDIRECT_URI });

      await tokenStorage.saveTokens(res.accessToken, res.refreshToken);
      await tokenStorage.saveUserUuid(res.user.uuid);
      await setTokens(res.accessToken, res.refreshToken);
      setUser(res.user);

      const { completed } = await getOnboardingStatus(res.accessToken);
      if (!completed) {
        navigation.reset({ index: 0, routes: [{ name: 'OnBoardStart' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        appAlert(
          '이미 가입된 계정',
          '동일한 이메일로 가입된 계정이 있습니다. 기존 계정으로 로그인해주세요.',
          [{ text: '확인', onPress: () => navigation.navigate('Login') }],
        );
      } else {
        appAlert('오류', '소셜 로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPress = async () => {
    const err = validateField('phone', phone);
    if (err) {
      setErrors((prev) => ({ ...prev, phone: err }));
      setTouched((prev) => ({ ...prev, phone: true }));
      phoneRef.current?.focus();
      return;
    }
    const rawPhone = phone.replace(/\D/g, '');
    setIsLoading(true);
    try {
      const { expiresInSeconds } = await sendPhoneCode({
        phone: rawPhone,
        purpose: 'REGISTER',
      });
      setOtpExpiry(expiresInSeconds);
      setIsPhoneVerified(false);
      setModalVisible(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? '인증번호 발송에 실패했습니다.';
      appAlert('오류', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full px-5 py-4 text-base rounded-full ${errors[field] ? 'bg-red-50' : 'bg-gray-100'}`;

  const inputStyle = (field: string) =>
    authInputStyle(
      errors[field] ? { borderWidth: 1, borderColor: '#fca5a5' } : undefined,
    );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1 px-10"
          contentContainerStyle={{
            justifyContent: 'center',
            flexGrow: 1,
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 헤더 */}
          <View className="mb-16">
            <Text className="text-4xl font-bold leading-tight text-black">
              사용자님의{'\n'}
              <Text className="text-blue-500">정보를</Text> 알려주세요.
            </Text>
          </View>

          {/* 입력 필드 */}
          <View className="gap-1">
            {/* 아이디 */}
            <View>
              <TextInput
                {...authTextInputColorProps}
                ref={userIdRef}
                value={userId}
                onChangeText={(text) => handleChange('userId', text, setUserId)}
                onBlur={() => handleBlur('userId', userId)}
                placeholder="아이디"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                blurOnSubmit={false}
                className={inputClass('userId')}
                style={inputStyle('userId')}
              />
              <Text
                className="mt-1 ml-2 text-sm text-red-400"
                style={{ minHeight: 20 }}
              >
                {errors.userId ?? ''}
              </Text>
            </View>

            {/* 이메일 */}
            <View>
              <TextInput
                {...authTextInputColorProps}
                ref={emailRef}
                value={email}
                onChangeText={(text) => handleChange('email', text, setEmail)}
                onBlur={() => handleBlur('email', email)}
                placeholder="이메일"
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => nicknameRef.current?.focus()}
                blurOnSubmit={false}
                className={inputClass('email')}
                style={inputStyle('email')}
              />
              <Text
                className="mt-1 ml-2 text-sm text-red-400"
                style={{ minHeight: 20 }}
              >
                {errors.email ?? ''}
              </Text>
            </View>

            {/* 닉네임 */}
            <View>
              <TextInput
                {...authTextInputColorProps}
                ref={nicknameRef}
                value={nickname}
                onChangeText={(text) =>
                  handleChange('nickname', text, setNickname)
                }
                onBlur={() => handleBlur('nickname', nickname)}
                placeholder="닉네임"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
                className={inputClass('nickname')}
                style={inputStyle('nickname')}
              />
              <Text
                className="mt-1 ml-2 text-sm text-red-400"
                style={{ minHeight: 20 }}
              >
                {errors.nickname ?? ''}
              </Text>
            </View>

            {/* 비밀번호 */}
            <View>
              <View className="justify-center">
                <TextInput
                  {...authTextInputColorProps}
                  ref={passwordRef}
                  value={displayPassword}
                  onChangeText={handlePasswordInput}
                  onBlur={() => {
                    clearTimeout(debounceRefs.current['password']);
                    maskAll();
                    setTouched((prev) => ({ ...prev, password: true }));
                    setFieldError('password', realPasswordRef.current);
                  }}
                  placeholder="비밀번호"
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  blurOnSubmit={false}
                  className={inputClass('password')}
                  style={[inputStyle('password'), { paddingRight: 48 }]}
                />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={toggleReveal}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    position: 'absolute',
                    right: 16,
                    top: 0,
                    bottom: 0,
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={revealed ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
              <Text
                className="mt-1 ml-2 text-sm text-red-400"
                style={{ minHeight: 20 }}
              >
                {errors.password ?? ''}
              </Text>
            </View>

            {/* 휴대전화 */}
            <View>
              <View
                className={`flex-row items-center rounded-full ${errors.phone ? 'bg-red-50' : 'bg-gray-100'}`}
                style={
                  errors.phone ? { borderWidth: 1, borderColor: '#fca5a5' } : {}
                }
              >
                <TextInput
                  {...authTextInputColorProps}
                  ref={phoneRef}
                  value={phone}
                  onChangeText={(text) =>
                    handleChange('phone', formatPhone(text), setPhone)
                  }
                  onBlur={() => handleBlur('phone', phone)}
                  placeholder="전화번호"
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  maxLength={13}
                  className="flex-1 py-4 pl-5 text-base"
                  style={authInputStyle()}
                />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleVerifyPress}
                  disabled={isPhoneVerified}
                  className={`self-stretch justify-center rounded-full px-7 ${isPhoneVerified ? 'bg-green-500' : 'bg-blue-500'}`}
                >
                  <Text className="text-sm font-semibold text-white">
                    {isPhoneVerified ? '완료' : '인증'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text
                className="mt-1 ml-2 text-sm text-red-400"
                style={{ minHeight: 20 }}
              >
                {errors.phone ?? ''}
              </Text>
            </View>
          </View>

          {/* 회원가입 버튼 */}
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={isLoading}
            onPress={handleSignup}
            className="items-center justify-center w-full mt-6 bg-blue-500 rounded-full h-14"
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-bold text-white">회원가입</Text>
            )}
          </TouchableOpacity>

          {/* 로그인 링크 */}
          <View className="flex-row items-center justify-center mt-7">
            <Text className="text-sm text-gray-500">
              이미 계정이 있으신가요?{' '}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Login')}
            >
              <Text className="text-sm font-semibold text-blue-500">
                로그인
              </Text>
            </TouchableOpacity>
          </View>

          {/* 소셜 버튼 */}
          <View className="flex-row gap-3 mt-8">
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isLoading}
              onPress={() => setOauthModal('kakao')}
              className="flex-1 flex-row items-center justify-center gap-2 h-12 bg-[#ffeb00] rounded-2xl"
            >
              <Image
                style={{ width: 22, height: 22, borderRadius: 9999 }}
                source={require('@/assets/kakaotalk_sharing_btn/kakaotalk_sharing_btn_medium.png')}
                resizeMode="contain"
              />
              <Text className="text-sm font-semibold text-gray-800">
                카카오로 시작하기
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isLoading}
              onPress={() => void handleGooglePress()}
              className="flex-row items-center justify-center flex-1 h-12 gap-2 bg-white border border-gray-200 rounded-2xl"
            >
              <Image
                style={{ width: 18, height: 18 }}
                source={require('@/assets/Google_logo.png')}
                resizeMode="contain"
              />
              <Text className="text-sm font-semibold text-gray-700">
                구글로 시작하기
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <OtpModal
        visible={modalVisible}
        initialSeconds={otpExpiry}
        onClose={() => setModalVisible(false)}
        onVerify={async (code) => {
          const rawPhone = phone.replace(/\D/g, '');
          await verifyPhoneCode(
            { phone: rawPhone, code, purpose: 'REGISTER' },
            '',
          );
        }}
        onVerified={() => {
          setIsPhoneVerified(true);
          setModalVisible(false);
        }}
        onResend={async () => {
          const rawPhone = phone.replace(/\D/g, '');
          const res = await sendPhoneCode({
            phone: rawPhone,
            purpose: 'REGISTER',
          });
          return res.expiresInSeconds;
        }}
      />

      {oauthModal === 'kakao' && (
        <OAuthWebViewModal
          visible
          authUrl={KAKAO_AUTH_URL}
          redirectUri={KAKAO_REDIRECT_URI}
          onCode={(code) => handleOAuthCode('kakao', code)}
          onClose={() => setOauthModal(null)}
        />
      )}

      <Modal visible={isGoogleOAuthPending} transparent animationType="fade">
        <View className="items-center justify-center flex-1 bg-black/40">
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
