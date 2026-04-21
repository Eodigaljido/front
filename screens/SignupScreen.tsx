import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
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

type SignupNavProp = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

const OTP_LENGTH = 6;
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

interface OtpModalProps {
  visible: boolean;
  phone: string;
  accessToken: string;
  initialSeconds: number;
  onClose: () => void;
  onVerified: () => void;
}

function OtpModal({
  visible,
  phone,
  accessToken,
  initialSeconds,
  onClose,
  onVerified,
}: OtpModalProps) {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (!visible) return;
    setOtp(Array(OTP_LENGTH).fill(''));
    setSeconds(initialSeconds);
    const interval = setInterval(() => {
      setSeconds(prev => (prev <= 1 ? (clearInterval(interval), 0) : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, initialSeconds]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleChange = (text: string, index: number) => {
    const digits = text.replace(/[^0-9]/g, '');

    // 붙여넣기: 2자리 이상이면 첫 칸부터 순서대로 채움
    if (digits.length > 1) {
      const next = Array(OTP_LENGTH).fill('');
      digits.slice(0, OTP_LENGTH).split('').forEach((d, i) => { next[i] = d; });
      setOtp(next);
      inputRefs.current[Math.min(digits.length, OTP_LENGTH) - 1]?.focus();
      return;
    }

    // 이미 값 있는 칸은 입력 무시
    if (otp[index]) return;

    const next = [...otp];
    next[index] = digits;
    setOtp(next);
    if (digits && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      const next = [...otp];
      if (!otp[index] && index > 0) {
        next[index - 1] = '';
        setOtp(next);
        inputRefs.current[index - 1]?.focus();
      } else {
        next[index] = '';
        setOtp(next);
        if (index > 0) inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleResend = async () => {
    try {
      const res = await sendPhoneCode({ phone, purpose: 'REGISTER' }, accessToken);
      setOtp(Array(OTP_LENGTH).fill(''));
      setSeconds(res.expiresInSeconds);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      Alert.alert('오류', '인증번호 재발송에 실패했습니다.');
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      Alert.alert('입력 오류', `${OTP_LENGTH}자리 인증번호를 모두 입력해주세요.`);
      return;
    }
    setIsLoading(true);
    try {
      await verifyPhoneCode({ phone, code, purpose: 'REGISTER' }, accessToken);
      onVerified();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '인증번호가 올바르지 않습니다.';
      Alert.alert('인증 실패', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} className="bg-black/40" onPress={onClose} />
      <View className="absolute bottom-0 left-0 right-0 px-8 bg-white rounded-t-3xl pt-7 pb-14">
        {/* 닫기 */}
        <TouchableOpacity
          onPress={onClose}
          className="absolute top-5 right-6"
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Text className="text-xl font-bold text-gray-800">✕</Text>
        </TouchableOpacity>

        {/* 타이틀 & 타이머 */}
        <Text className="mb-1 text-lg font-bold text-center text-black">인증번호 입력</Text>
        <Text className="mb-8 text-base font-semibold text-center text-blue-500">
          {formatTime(seconds)}
        </Text>

        {/* OTP 입력 박스 */}
        <View className="flex-row justify-center gap-5 mb-10">
          {otp.map((digit, i) => (
            <View key={i} className="items-center">
              <TextInput
                ref={ref => {
                  inputRefs.current[i] = ref;
                }}
                value={digit}
                onChangeText={text => handleChange(text, i)}
                onKeyPress={e => handleKeyPress(e, i)}
                keyboardType="number-pad"
                style={{
                  width: 40,
                  fontSize: 26,
                  fontWeight: 'bold',
                  textAlign: 'center',
                  color: '#111',
                  paddingBottom: 4,
                }}
              />
              <View style={{ width: 40, height: 2, backgroundColor: '#333', marginTop: 2 }} />
            </View>
          ))}
        </View>

        {/* 확인 버튼 */}
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={isLoading}
          onPress={handleVerify}
          className="items-center justify-center w-full h-12 mb-4 bg-blue-500 rounded-full"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-bold text-white">확인</Text>
          )}
        </TouchableOpacity>

        {/* 재발급 */}
        <TouchableOpacity onPress={handleResend} className="items-center">
          <Text className="text-sm text-gray-500" style={{ textDecorationLine: 'underline' }}>
            인증번호 재발급
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
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
        phone={phone.replace(/\D/g, '')}
        accessToken=""
        initialSeconds={otpExpiry}
        onClose={() => setModalVisible(false)}
        onVerified={() => {
          setIsPhoneVerified(true);
          setModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}
