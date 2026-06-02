import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, Alert, TextInput } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

// 백엔드 친구 코드 형식: 영문 대문자 + 숫자 조합 6자리 (예: A3K9B2)
const FRIEND_CODE_REGEX = /^[A-Z0-9]{6}$/;
// const FRIEND_CODE_REGEX = /^[A-Z0-9]{6}$/;

interface Props {
  visible: boolean;
  loading: boolean;
  friendCode: string | null;
  onClose: () => void;
  onAddFriendByCode: (code: string) => Promise<void>;
  onShareLink?: () => void;
}

export default function FriendCodeModal({
  visible,
  loading,
  friendCode,
  onClose,
  onAddFriendByCode,
  onShareLink,
}: Props) {
  const [inputCode, setInputCode] = useState('');
  const [inputError, setInputError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const handleClose = () => {
    setInputCode('');
    setInputError('');
    onClose();
  };

  const handleChangeCode = (text: string) => {
    const upper = text.toUpperCase();
    setInputCode(upper);
    if (inputError) setInputError('');
  };

  const validate = (code: string): string => {
    if (!code.trim()) return '친구 코드를 입력해주세요.';
    if (!FRIEND_CODE_REGEX.test(code)) return '올바른 형식이 아닙니다. (예: A3K9B2)';
    return '';
  };

  const handleAddFriend = async () => {
    const error = validate(inputCode);
    if (error) {
      setInputError(error);
      return;
    }
    setAddLoading(true);
    try {
      await onAddFriendByCode(inputCode);
      setInputCode('');
      setInputError('');
      Alert.alert('친구 추가 완료', `${inputCode} 코드로 친구를 추가했습니다.`);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? '친구 추가에 실패했습니다.';
      setInputError(msg);
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable
        className="items-center justify-center flex-1"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={handleClose}
      >
        <Pressable
          onPress={e => e.stopPropagation()}
          className="px-6 py-6 mx-8 bg-white rounded-2xl"
          style={{ width: 300 }}
        >
          <Pressable
            onPress={handleClose}
            className="absolute items-center justify-center w-11 h-11"
            style={{ top: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color="#9ca3af" />
          </Pressable>

          {/* 내 친구 코드 */}
          <Text className="mb-2 text-lg font-bold text-center text-gray-900">내 친구 코드</Text>
          <Text className="mb-6 text-xs text-center text-gray-500">
            이 코드를 친구에게 알려주세요.
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color="#2563eb" />
          ) : (
            <>
              <View
                className="items-center py-5 mb-5 rounded-xl"
                style={{ backgroundColor: '#EFF6FF' }}
              >
                <Text
                  style={{ fontSize: 32, fontWeight: '800', letterSpacing: 8, color: '#2563eb' }}
                >
                  {friendCode}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={async () => {
                    await Clipboard.setStringAsync(friendCode ?? '');
                    Alert.alert('복사 완료', '친구 코드가 클립보드에 복사되었습니다.');
                  }}
                  className="flex-row items-center justify-center flex-1 gap-1 py-3 border border-blue-200 rounded-xl active:opacity-80"
                  style={{ backgroundColor: '#fff' }}
                >
                  <Ionicons name="copy-outline" size={15} color="#2563eb" />
                  <Text className="text-sm font-semibold text-blue-600">코드 복사</Text>
                </Pressable>
                {onShareLink && (
                  <Pressable
                    onPress={onShareLink}
                    className="flex-row items-center justify-center flex-1 gap-1 py-3 rounded-xl active:opacity-80"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    <Ionicons name="share-outline" size={15} color="#fff" />
                    <Text className="text-sm font-semibold text-white">링크 공유</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}

          {/* 구분선 */}
          <View className="flex-row items-center gap-2 py-3 my-6">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="text-xs text-gray-400">친구 추가</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          {/* 친구 코드 입력 */}
          <Text className="mb-3 text-sm font-semibold text-gray-700">친구 코드 입력</Text>
          <View
            className="flex-row items-center px-3 border rounded-xl"
            style={{
              borderColor: inputError ? '#ef4444' : '#d1d5db',
              backgroundColor: '#f9fafb',
              height: 46,
            }}
          >
            <Ionicons
              name="person-add-outline"
              size={16}
              color="#9ca3af"
              style={{ marginRight: 6 }}
            />
            <TextInput
              value={inputCode}
              onChangeText={handleChangeCode}
              placeholder="예) A3K9B2"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              maxLength={6}
              style={{ flex: 1, fontSize: 15, color: '#111827', letterSpacing: 2 }}
            />
          </View>

          {inputError ? (
            <Text className="mt-2 text-xs text-red-500">{inputError}</Text>
          ) : (
            <Text className="mt-2 text-xs text-gray-400">영문자 + 숫자 6자리 형식</Text>
          )}

          <Pressable
            onPress={handleAddFriend}
            disabled={addLoading}
            className="flex-row items-center justify-center gap-1 py-3 mt-4 rounded-xl active:opacity-80"
            style={{ backgroundColor: addLoading ? '#93c5fd' : '#2563eb' }}
          >
            {addLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={15} color="#fff" />
                <Text className="text-sm font-semibold text-white">친구 추가</Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
