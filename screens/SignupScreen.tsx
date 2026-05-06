import { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { usePasswordMask } from '../hooks/usePasswordMask';
import { sendPhoneCode, verifyPhoneCode } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { OtpModal } from '../components/OtpModal';

type SignupNavProp = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

const TIMER_SECONDS = 5 * 60;
const DEBOUNCE_MS = 500;

function validateField(field: string, value: string): string {
  switch (field) {
    case 'userId':
      return !value.trim() ? '아이디를 입력해주세요.' : '';
    case 'email':
      return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '올바른 이메일 형식이 아니에요.' : '';
    case 'nickname':
      return value.trim().length < 2 ? '닉네임은 2자 이상이어야해요.' : '';
    case 'password':
      return !/[~!@#$%^&*]/.test(value)
        ? '특수문자(~,!,@,#,$,%,^,&,*) 중 하나를 포함해야해요.'
        : '';
    case 'phone':
      return value.replace(/\D/g, '').length < 11 ? '올바른 휴대전화 번호를 입력해주세요.' : '';
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
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState(TIMER_SECONDS);
  const registerStore = useAuthStore(s => s.register);

  const userIdRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const nicknameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const {
    displayPassword,
    realPasswordRef,
    handleInput: maskHandleInput,
    maskAll,
  } = usePasswordMask();

  // 언마운트 시 debounce 타이머 정리
  useEffect(() => {
    return () => {
      Object.values(debounceRefs.current).forEach(clearTimeout);
    };
  }, []);

  const setFieldError = useCallback((field: string, value: string) => {
    setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
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
      setTouched(prev => ({ ...prev, [field]: true }));
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
    const values = { userId, email, nickname, password: realPasswordRef.current, phone };
    const newErrors = Object.fromEntries(
      Object.entries(values).map(([field, value]) => [field, validateField(field, value)]),
    );
    setErrors(newErrors);
    setTouched({ userId: true, email: true, nickname: true, password: true, phone: true });
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
      Alert.alert('휴대전화 인증 필요', '인증 버튼을 눌러 휴대전화 인증을 완료해주세요.');
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
      Alert.alert('회원가입 실패', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPress = async () => {
    const err = validateField('phone', phone);
    if (err) {
      setErrors(prev => ({ ...prev, phone: err }));
      setTouched(prev => ({ ...prev, phone: true }));
      phoneRef.current?.focus();
      return;
    }
    const rawPhone = phone.replace(/\D/g, '');
    setIsLoading(true);
    try {
      const { expiresInSeconds } = await sendPhoneCode({ phone: rawPhone, purpose: 'REGISTER' });
      setOtpExpiry(expiresInSeconds);
      setIsPhoneVerified(false);
      setModalVisible(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '인증번호 발송에 실패했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full px-5 py-4 text-base rounded-full ${errors[field] ? 'bg-red-50' : 'bg-gray-100'}`;

  const inputStyle = (field: string) =>
    errors[field] ? { borderWidth: 1, borderColor: '#fca5a5' } : {};

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1 px-10"
          contentContainerStyle={{ justifyContent: 'center', flexGrow: 1, paddingBottom: 40 }}
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
                ref={userIdRef}
                value={userId}
                onChangeText={text => handleChange('userId', text, setUserId)}
                onBlur={() => handleBlur('userId', userId)}
                placeholder="아이디"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                blurOnSubmit={false}
                className={inputClass('userId')}
                style={inputStyle('userId')}
              />
              <Text className="mt-1 ml-2 text-sm text-red-400" style={{ minHeight: 20 }}>
                {errors.userId ?? ''}
              </Text>
            </View>

            {/* 이메일 */}
            <View>
              <TextInput
                ref={emailRef}
                value={email}
                onChangeText={text => handleChange('email', text, setEmail)}
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
              <Text className="mt-1 ml-2 text-sm text-red-400" style={{ minHeight: 20 }}>
                {errors.email ?? ''}
              </Text>
            </View>

            {/* 닉네임 */}
            <View>
              <TextInput
                ref={nicknameRef}
                value={nickname}
                onChangeText={text => handleChange('nickname', text, setNickname)}
                onBlur={() => handleBlur('nickname', nickname)}
                placeholder="닉네임"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
                className={inputClass('nickname')}
                style={inputStyle('nickname')}
              />
              <Text className="mt-1 ml-2 text-sm text-red-400" style={{ minHeight: 20 }}>
                {errors.nickname ?? ''}
              </Text>
            </View>

            {/* 비밀번호 */}
            <View>
              <TextInput
                ref={passwordRef}
                value={displayPassword}
                onChangeText={handlePasswordInput}
                onBlur={() => {
                  clearTimeout(debounceRefs.current['password']);
                  maskAll();
                  setTouched(prev => ({ ...prev, password: true }));
                  setFieldError('password', realPasswordRef.current);
                }}
                placeholder="비밀번호"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                blurOnSubmit={false}
                className={inputClass('password')}
                style={inputStyle('password')}
              />
              <Text className="mt-1 ml-2 text-sm text-red-400" style={{ minHeight: 20 }}>
                {errors.password ?? ''}
              </Text>
            </View>

            {/* 휴대전화 */}
            <View>
              <View
                className={`flex-row items-center rounded-full ${errors.phone ? 'bg-red-50' : 'bg-gray-100'}`}
                style={errors.phone ? { borderWidth: 1, borderColor: '#fca5a5' } : {}}
              >
                <TextInput
                  ref={phoneRef}
                  value={phone}
                  onChangeText={text => handleChange('phone', text, setPhone)}
                  onBlur={() => handleBlur('phone', phone)}
                  placeholder="휴대전화(-제외)"
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  className="flex-1 py-4 pl-5 text-base"
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
              <Text className="mt-1 ml-2 text-sm text-red-400" style={{ minHeight: 20 }}>
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
            <Text className="text-sm text-gray-500">이미 계정이 있으신가요? </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Login')}>
              <Text className="text-sm font-semibold text-blue-500">로그인</Text>
            </TouchableOpacity>
          </View>

          {/* 소셜 버튼 */}
          <View className="flex-row gap-3 mt-8">
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-1 flex-row items-center justify-center gap-2 h-12 bg-[#ffeb00] rounded-2xl"
            >
              <Image
                style={{ width: 22, height: 22, borderRadius: 9999 }}
                source={require('@/assets/kakaotalk_sharing_btn/kakaotalk_sharing_btn_medium.png')}
                resizeMode="contain"
              />
              <Text className="text-sm font-semibold text-gray-800">카카오로 시작하기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center justify-center flex-1 h-12 gap-2 bg-white border border-gray-200 rounded-2xl"
            >
              <Image
                style={{ width: 18, height: 18 }}
                source={require('@/assets/Google_logo.png')}
                resizeMode="contain"
              />
              <Text className="text-sm font-semibold text-gray-700">구글로 시작하기</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <OtpModal
        visible={modalVisible}
        initialSeconds={otpExpiry}
        onClose={() => setModalVisible(false)}
        onVerify={async code => {
          const rawPhone = phone.replace(/\D/g, '');
          await verifyPhoneCode({ phone: rawPhone, code, purpose: 'REGISTER' }, '');
        }}
        onVerified={() => {
          setIsPhoneVerified(true);
          setModalVisible(false);
        }}
        onResend={async () => {
          const rawPhone = phone.replace(/\D/g, '');
          const res = await sendPhoneCode({ phone: rawPhone, purpose: 'REGISTER' });
          return res.expiresInSeconds;
        }}
      />
    </SafeAreaView>
  );
}
