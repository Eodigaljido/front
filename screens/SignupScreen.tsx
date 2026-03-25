// @ts-nocheck
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const OTP_LENGTH = 5;
const TIMER_SECONDS = 5 * 60;
const DEBOUNCE_MS = 500;
const MASK_DELAY_MS = 800;
const MASK_CHAR = '•';

function validateField(field: string, value: string): string {
  switch (field) {
    case 'email':
      return value.length < 4 ? '4글자 이상이어야해요.' : '';
    case 'name':
      return !value.trim() ? '아이디를 입력해주세요.' : '';
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

function OtpModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [seconds, setSeconds] = useState(TIMER_SECONDS);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (!visible) return;
    setOtp(Array(OTP_LENGTH).fill(''));
    setSeconds(TIMER_SECONDS);
    const interval = setInterval(() => {
      setSeconds(prev => (prev <= 1 ? (clearInterval(interval), 0) : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = () => {
    setOtp(Array(OTP_LENGTH).fill(''));
    setSeconds(TIMER_SECONDS);
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} className="bg-black/40" onPress={onClose} />
      <View className="absolute bottom-0 left-0 right-0 px-8 bg-white rounded-t-3xl pt-7 pb-14">
        {/* 닫기 */}
        <TouchableOpacity
          onPress={onClose}
          className="absolute top-5 right-6"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
                ref={ref => (inputRefs.current[i] = ref)}
                value={digit}
                onChangeText={text => handleChange(text, i)}
                onKeyPress={e => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={1}
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
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [modalVisible, setModalVisible] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // 비밀번호 마스킹 관련
  const realPasswordRef = useRef('');
  const [displayPassword, setDisplayPassword] = useState('');
  const maskTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigation = useNavigation();

  // 언마운트 시 모든 타이머 정리
  useEffect(() => {
    return () => {
      Object.values(debounceRefs.current).forEach(clearTimeout);
      if (maskTimerRef.current) clearTimeout(maskTimerRef.current);
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

  // 비밀번호 입력: 마지막 타이핑 문자를 MASK_DELAY_MS 후 •로 교체
  const handlePasswordInput = useCallback(
    (inputText: string) => {
      const prevReal = realPasswordRef.current;
      const newReal =
        inputText.length >= prevReal.length
          ? prevReal + inputText.slice(prevReal.length) // 추가
          : prevReal.slice(0, inputText.length); // 삭제

      realPasswordRef.current = newReal;
      setPassword(newReal);

      if (touched['password']) {
        clearTimeout(debounceRefs.current['password']);
        debounceRefs.current['password'] = setTimeout(
          () => setFieldError('password', newReal),
          DEBOUNCE_MS,
        );
      }

      if (inputText.length > prevReal.length) {
        const addedLen = inputText.length - prevReal.length;
        setDisplayPassword(MASK_CHAR.repeat(newReal.length - addedLen) + newReal.slice(-addedLen));
        if (maskTimerRef.current) clearTimeout(maskTimerRef.current);
        maskTimerRef.current = setTimeout(
          () => setDisplayPassword(MASK_CHAR.repeat(newReal.length)),
          MASK_DELAY_MS,
        );
      } else {
        if (maskTimerRef.current) clearTimeout(maskTimerRef.current);
        setDisplayPassword(MASK_CHAR.repeat(newReal.length));
      }
    },
    [touched, setFieldError],
  );

  const validateAll = () => {
    const values = { email, name, password: realPasswordRef.current, phone };
    const newErrors = Object.fromEntries(
      Object.entries(values).map(([field, value]) => [field, validateField(field, value)]),
    );
    setErrors(newErrors);
    setTouched({ email: true, name: true, password: true, phone: true });
    return newErrors;
  };

  const focusFirstError = (errs: Record<string, string>) => {
    if (errs.email) emailRef.current?.focus();
    else if (errs.name) nameRef.current?.focus();
    else if (errs.password) passwordRef.current?.focus();
    else if (errs.phone) phoneRef.current?.focus();
  };

  const handleSignup = () => {
    const errs = validateAll();
    if (Object.values(errs).some(Boolean)) {
      focusFirstError(errs);
      return;
    }
    setModalVisible(true);
  };

  const handleVerifyPress = () => {
    const err = validateField('phone', phone);
    if (err) {
      setErrors(prev => ({ ...prev, phone: err }));
      setTouched(prev => ({ ...prev, phone: true }));
      phoneRef.current?.focus();
      return;
    }
    setModalVisible(true);
  };

  const inputClass = (field: string) =>
    `w-full px-5 py-4 text-base rounded-full ${errors[field] ? 'bg-red-50' : 'bg-gray-100'}`;

  const inputStyle = (field: string) =>
    errors[field] ? { borderWidth: 1, borderColor: '#fca5a5' } : {};

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View
        className="justify-center flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 40 }}
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
        <View className="gap-4">
          {/* 이메일 혹은 아이디 */}
          <View>
            <TextInput
              ref={emailRef}
              value={email}
              onChangeText={text => handleChange('email', text, setEmail)}
              onBlur={() => handleBlur('email', email)}
              placeholder="이메일 혹은 아이디"
              keyboardType="email-address"
              className={inputClass('email')}
              style={inputStyle('email')}
            />
            <Text className="mt-1 ml-2 text-sm text-red-400" style={{ minHeight: 20 }}>
              {errors.email ?? ''}
            </Text>
          </View>

          {/* 이름 */}
          <View>
            <TextInput
              ref={nameRef}
              value={name}
              onChangeText={text => handleChange('name', text, setName)}
              onBlur={() => handleBlur('name', name)}
              placeholder="아이디"
              className={inputClass('name')}
              style={inputStyle('name')}
            />
            <Text className="mt-1 ml-2 text-sm text-red-400" style={{ minHeight: 20 }}>
              {errors.name ?? ''}
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
                if (maskTimerRef.current) clearTimeout(maskTimerRef.current);
                setDisplayPassword(MASK_CHAR.repeat(realPasswordRef.current.length));
                setTouched(prev => ({ ...prev, password: true }));
                setFieldError('password', realPasswordRef.current);
              }}
              placeholder="비밀번호"
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
              className={`flex-row items-center px-5 rounded-full overflow-hidden ${errors.phone ? 'bg-red-50' : 'bg-gray-100'}`}
              style={errors.phone ? { borderWidth: 1, borderColor: '#fca5a5' } : {}}
            >
              <TextInput
                ref={phoneRef}
                value={phone}
                onChangeText={text => handleChange('phone', text, setPhone)}
                onBlur={() => handleBlur('phone', phone)}
                placeholder="휴대전화(-제외)"
                keyboardType="number-pad"
                className="flex-1 py-4"
              />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleVerifyPress}
                className="absolute right-0 justify-center h-full bg-blue-500 rounded-full px-7 align-center"
              >
                <Text className="font-semibold text-white text-md">인증</Text>
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
          onPress={handleSignup}
          className="items-center justify-center w-full mt-6 bg-blue-500 rounded-full h-14"
        >
          <Text className="text-base font-bold text-white">회원가입</Text>
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
      </View>

      <OtpModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </SafeAreaView>
  );
}
