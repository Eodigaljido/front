import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

const OTP_LENGTH = 6;

export interface OtpModalProps {
  visible: boolean;
  initialSeconds: number;
  onClose: () => void;
  onVerify: (code: string) => Promise<void>;
  onVerified: () => void;
  onResend: () => Promise<number>;
}

export function OtpModal({
  visible,
  initialSeconds,
  onClose,
  onVerify,
  onVerified,
  onResend,
}: OtpModalProps) {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const secondsRef = useRef(initialSeconds);
  const isFirstOpen = useRef(true);

  useEffect(() => {
    if (!visible) return;

    // 첫 오픈이거나 타이머가 만료된 경우에만 초기화
    if (isFirstOpen.current || secondsRef.current === 0) {
      setOtp(Array(OTP_LENGTH).fill(''));
      secondsRef.current = initialSeconds;
      setSeconds(initialSeconds);
      isFirstOpen.current = false;
    }

    const interval = setInterval(() => {
      secondsRef.current -= 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleChange = (text: string, index: number) => {
    const digits = text.replace(/[^0-9]/g, '');
    if (digits.length > 1) {
      const next = Array(OTP_LENGTH).fill('');
      digits
        .slice(0, OTP_LENGTH)
        .split('')
        .forEach((d, i) => { next[i] = d; });
      setOtp(next);
      inputRefs.current[Math.min(digits.length, OTP_LENGTH) - 1]?.focus();
      return;
    }
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
      const newSeconds = await onResend();
      setOtp(Array(OTP_LENGTH).fill(''));
      secondsRef.current = newSeconds;
      setSeconds(newSeconds);
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
      await onVerify(code);
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
      <View style={styles.sheet}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.6}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>

        <Text className="mb-1 text-lg font-bold text-center text-black">인증번호 입력</Text>
        <Text className="mb-8 text-base font-semibold text-center text-blue-500">
          {formatTime(seconds)}
        </Text>

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <View key={i} style={styles.cell}>
              <TextInput
                ref={ref => { inputRefs.current[i] = ref; }}
                value={digit}
                onChangeText={text => handleChange(text, i)}
                onKeyPress={e => handleKeyPress(e, i)}
                keyboardType="number-pad"
                style={styles.cellInput}
              />
              <View style={styles.cellUnderline} />
            </View>
          ))}
        </View>

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

        <TouchableOpacity onPress={handleResend} className="items-center">
          <Text className="text-sm text-gray-500" style={{ textDecorationLine: 'underline' }}>
            인증번호 재발급
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 28,
    paddingBottom: 56,
    paddingHorizontal: 28,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  closeIcon: {
    fontSize: 15,
    color: '#9ca3af',
    fontWeight: '600',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 40,
  },
  cell: {
    alignItems: 'center',
  },
  cellInput: {
    width: 42,
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#111',
    paddingBottom: 4,
  },
  cellUnderline: {
    width: 42,
    height: 2,
    backgroundColor: '#d1d5db',
    marginTop: 2,
  },
});
