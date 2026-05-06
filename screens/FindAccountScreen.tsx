import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../App';
import {
  sendFindIdCode,
  verifyFindIdCode,
  sendResetPasswordCode,
  resetPassword,
  FindIdResult,
} from '../api/auth/find';
import { OtpModal } from '../components/OtpModal';

type FindAccountNavProp = NativeStackNavigationProp<RootStackParamList, 'FindAccount'>;

// ── 아이디 찾기 ─────────────────────────────────────────────────

function FindIdSection({ onLoginPress }: { onLoginPress: () => void }) {
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpVisible, setOtpVisible] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [pendingResult, setPendingResult] = useState<FindIdResult | null>(null);
  const [result, setResult] = useState<FindIdResult | null>(null);

  const handleSendCode = async () => {
    const rawPhone = phone.replace(/\D/g, '');
    if (rawPhone.length < 11) {
      setPhoneError('올바른 휴대전화 번호를 입력해주세요.');
      return;
    }
    setPhoneError('');
    setIsLoading(true);
    try {
      await sendFindIdCode({ phone: rawPhone });
      setOtpVisible(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '인증번호 발송에 실패했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    const rawPhone = phone.replace(/\D/g, '');
    await sendFindIdCode({ phone: rawPhone });
    return 300;
  };

  if (result) {
    return (
      <View className="px-6 pt-4">
        <View className="items-center w-full p-6 mb-8 bg-blue-50 rounded-2xl">
          <Text className="mb-4 text-base font-semibold text-gray-700">
            아이디 / 이메일 찾기 완료
          </Text>
          <View className="w-full gap-3">
            <View className="flex-row justify-between px-2">
              <Text className="text-sm text-gray-500">아이디</Text>
              <Text className="text-sm font-bold text-gray-800">{result.userId}</Text>
            </View>
            <View className="w-full h-px bg-blue-100" />
            <View className="flex-row justify-between px-2">
              <Text className="text-sm text-gray-500">이메일</Text>
              <Text className="text-sm font-bold text-gray-800">{result.email}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onLoginPress}
          className="items-center justify-center w-full h-12 bg-blue-500 rounded-full"
        >
          <Text className="font-bold text-white">로그인 하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-6 text-base text-gray-500">
          가입 시 등록한 휴대전화 번호로{'\n'}인증하면 아이디와 이메일을 확인할 수 있어요.
        </Text>

        <View className="gap-1">
          <View
            className={`flex-row items-center rounded-full ${phoneError ? 'bg-red-50' : 'bg-gray-100'}`}
            style={phoneError ? { borderWidth: 1, borderColor: '#fca5a5' } : {}}
          >
            <TextInput
              value={phone}
              onChangeText={text => {
                setPhone(text);
                setPhoneError('');
                setOtpVerified(false);
                setPendingResult(null);
              }}
              placeholder="휴대전화 번호(-제외)"
              keyboardType="phone-pad"
              returnKeyType="done"
              editable={!otpVerified}
              onSubmitEditing={!otpVerified ? handleSendCode : undefined}
              className="flex-1 py-4 pl-5 text-base"
            />
            {otpVerified ? (
              <View className="self-stretch justify-center px-5 bg-green-500 rounded-full">
                <Text className="text-sm font-semibold text-white">완료</Text>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleSendCode}
                disabled={isLoading}
                className="self-stretch justify-center bg-blue-500 rounded-full px-7"
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-semibold text-white">인증</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          <Text className="mt-1 ml-2 text-sm text-red-400" style={{ minHeight: 20 }}>
            {phoneError}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={!otpVerified}
            onPress={() => setResult(pendingResult)}
            className={`items-center justify-center w-full h-12 rounded-full ${otpVerified ? 'bg-blue-500' : 'bg-gray-200'}`}
          >
            <Text className={`font-semibold ${otpVerified ? 'text-white' : 'text-gray-400'}`}>
              아이디 찾기
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <OtpModal
        visible={otpVisible}
        initialSeconds={300}
        onClose={() => setOtpVisible(false)}
        onVerify={async code => {
          const rawPhone = phone.replace(/\D/g, '');
          const data = await verifyFindIdCode({ phone: rawPhone, code });
          setPendingResult(data);
        }}
        onVerified={() => {
          setOtpVerified(true);
          setOtpVisible(false);
        }}
        onResend={handleResend}
      />
    </KeyboardAvoidingView>
  );
}

// ── 비밀번호 재설정하기 ───────────────────────────────────────────────

function FindPasswordSection({ onLoginPress }: { onLoginPress: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [identifierError, setIdentifierError] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpVisible, setOtpVisible] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [verifiedCode, setVerifiedCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [done, setDone] = useState(false);
  const confirmPasswordRef = useRef<TextInput>(null);

  const handleSendCode = async () => {
    let valid = true;
    if (!identifier.trim()) {
      setIdentifierError('아이디 또는 이메일을 입력해주세요.');
      valid = false;
    }
    const rawPhone = phone.replace(/\D/g, '');
    if (rawPhone.length < 11) {
      setPhoneError('올바른 휴대전화 번호를 입력해주세요.');
      valid = false;
    }
    if (!valid) return;

    setIdentifierError('');
    setPhoneError('');
    setIsLoading(true);
    try {
      await sendResetPasswordCode({ identifier: identifier.trim(), phone: rawPhone });
      setOtpVisible(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '인증번호 발송에 실패했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    const rawPhone = phone.replace(/\D/g, '');
    await sendResetPasswordCode({ identifier: identifier.trim(), phone: rawPhone });
    return 300;
  };

  const handleResetPassword = async () => {
    if (!newPassword) {
      setPasswordError('새 비밀번호를 입력해주세요.');
      return;
    }
    if (!/[~!@#$%^&*]/.test(newPassword)) {
      setPasswordError('특수문자(~,!,@,#,$,%,^,&,*) 중 하나를 포함해야해요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setPasswordError('');
    setIsLoading(true);
    try {
      const rawPhone = phone.replace(/\D/g, '');
      await resetPassword({ phone: rawPhone, code: verifiedCode, newPassword });
      setDone(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? '비밀번호 재설정에 실패했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (done) {
    return (
      <View className="justify-center flex-1 px-6">
        <View className="items-center w-full p-6 mb-8 bg-green-50 rounded-2xl">
          <Text className="mb-2 text-base font-bold text-green-700">비밀번호 재설정 완료</Text>
          <Text className="text-sm text-center text-gray-500">새 비밀번호로 로그인해주세요.</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onLoginPress}
          className="items-center justify-center w-full h-12 bg-blue-500 rounded-full"
        >
          <Text className="font-bold text-white">로그인 하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-6 text-base text-gray-500">
          가입한 아이디/이메일과 등록된 전화번호로{'\n'}인증하면 비밀번호를 재설정할 수 있어요.
        </Text>

        {/* 아이디/이메일 입력 */}
        <View className="gap-1">
          <View
            className={`flex-row items-center rounded-full ${identifierError ? 'bg-red-50' : 'bg-gray-100'}`}
            style={identifierError ? { borderWidth: 1, borderColor: '#fca5a5' } : {}}
          >
            <TextInput
              value={identifier}
              onChangeText={text => {
                setIdentifier(text);
                setIdentifierError('');
              }}
              placeholder="아이디 또는 이메일"
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              editable={!otpVerified}
              className="flex-1 py-4 pl-5 text-base"
            />
          </View>
          <Text className="mt-1 ml-2 text-sm text-red-400" style={{ minHeight: 20 }}>
            {identifierError}
          </Text>
        </View>

        {/* 전화번호 입력 */}
        <View className="gap-1 mb-4">
          <View
            className={`flex-row items-center rounded-full ${phoneError ? 'bg-red-50' : 'bg-gray-100'}`}
            style={phoneError ? { borderWidth: 1, borderColor: '#fca5a5' } : {}}
          >
            <TextInput
              value={phone}
              onChangeText={text => {
                setPhone(text);
                setPhoneError('');
              }}
              placeholder="휴대전화 번호(-제외)"
              keyboardType="phone-pad"
              returnKeyType="done"
              editable={!otpVerified}
              onSubmitEditing={!otpVerified ? handleSendCode : undefined}
              className="flex-1 py-4 pl-5 text-base"
            />
            {otpVerified ? (
              <View className="self-stretch justify-center px-5 bg-green-500 rounded-full">
                <Text className="text-sm font-semibold text-white">완료</Text>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleSendCode}
                disabled={isLoading}
                className="self-stretch justify-center bg-blue-500 rounded-full px-7"
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-semibold text-white">인증</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          <Text className="mt-1 ml-2 text-sm text-red-400" style={{ minHeight: 20 }}>
            {phoneError}
          </Text>
        </View>

        {/* 인증 완료 후: 새 비밀번호 입력 */}
        {otpVerified && (
          <View className="gap-3">
            <TextInput
              value={newPassword}
              onChangeText={text => {
                setNewPassword(text);
                setPasswordError('');
              }}
              placeholder="새 비밀번호"
              secureTextEntry
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              blurOnSubmit={false}
              className="w-full px-5 py-4 text-base bg-gray-100 rounded-full"
            />
            <TextInput
              ref={confirmPasswordRef}
              value={confirmPassword}
              onChangeText={text => {
                setConfirmPassword(text);
                setPasswordError('');
              }}
              placeholder="새 비밀번호 확인"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleResetPassword}
              className="w-full px-5 py-4 text-base bg-gray-100 rounded-full"
            />
            <Text className="ml-2 text-sm text-red-400" style={{ minHeight: 20 }}>
              {passwordError}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isLoading}
              onPress={handleResetPassword}
              className="items-center justify-center w-full h-12 bg-blue-500 rounded-full"
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-bold text-white">비밀번호 재설정</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <OtpModal
        visible={otpVisible}
        initialSeconds={300}
        onClose={() => setOtpVisible(false)}
        onVerify={async code => {
          setVerifiedCode(code);
        }}
        onVerified={() => {
          setOtpVerified(true);
          setOtpVisible(false);
        }}
        onResend={handleResend}
      />
    </KeyboardAvoidingView>
  );
}

// ── 메인 스크린 ─────────────────────────────────────────────────

export default function FindAccountScreen() {
  const navigation = useNavigation<FindAccountNavProp>();
  const [activeTab, setActiveTab] = useState<'id' | 'password'>('id');

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* 헤더 */}
      <View className="flex-row items-center px-4 py-5 mt-4">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text className="ml-3 text-lg font-bold">계정 찾기</Text>
      </View>

      {/* 탭 */}
      <View className="flex-row p-1 mx-5 mb-6 bg-gray-100 rounded-full">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setActiveTab('id')}
          className={`flex-1 items-center py-2.5 rounded-full ${activeTab === 'id' ? 'bg-white' : ''}`}
          style={
            activeTab === 'id'
              ? {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  elevation: 2,
                }
              : {}
          }
        >
          <Text
            className={`text-sm font-semibold ${activeTab === 'id' ? 'text-blue-500' : 'text-gray-400'}`}
          >
            아이디 찾기
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setActiveTab('password')}
          className={`flex-1 items-center py-2.5 rounded-full ${activeTab === 'password' ? 'bg-white' : ''}`}
          style={
            activeTab === 'password'
              ? {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  elevation: 2,
                }
              : {}
          }
        >
          <Text
            className={`text-sm font-semibold ${activeTab === 'password' ? 'text-blue-500' : 'text-gray-400'}`}
          >
            비밀번호 재설정
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'id' ? (
        <FindIdSection onLoginPress={() => navigation.navigate('Login')} />
      ) : (
        <FindPasswordSection onLoginPress={() => navigation.navigate('Login')} />
      )}
    </SafeAreaView>
  );
}
