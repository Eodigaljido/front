import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getRoomMessages,
  sendMessage,
  type ChatMessage,
} from '../api/chat/chat';

const SHEET_SLIDE = 420;

type Props = {
  visible: boolean;
  onClose: () => void;
  accessToken: string | null;
  myUuid: string | undefined;
  chatRoomUuid: string | null | undefined;
  routeTitle: string;
  /** 서버 채팅방 없을 때 로컬 임시 메시지 */
  fallbackMessages: { id: string; from: 'me' | 'other'; name: string; text: string }[];
  onFallbackSend: (text: string) => void;
};

export function RouteCollaborativeChatSheet({
  visible,
  onClose,
  accessToken,
  myUuid,
  chatRoomUuid,
  routeTitle,
  fallbackMessages,
  onFallbackSend,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const backdrop = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SHEET_SLIDE)).current;
  const [rendered, setRendered] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [apiMessages, setApiMessages] = useState<ChatMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);

  const roomId = String(chatRoomUuid ?? '').trim();
  const useApi = Boolean(accessToken && roomId);

  const runOpen = useCallback(() => {
    backdrop.setValue(0);
    sheetY.setValue(SHEET_SLIDE);
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(sheetY, {
        toValue: 0,
        damping: 22,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdrop, sheetY]);

  const runClose = useCallback(
    (done?: () => void) => {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetY, {
          toValue: SHEET_SLIDE,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => done?.());
    },
    [backdrop, sheetY],
  );

  useEffect(() => {
    if (visible) {
      setRendered(true);
      runOpen();
    } else if (rendered) {
      runClose(() => setRendered(false));
    }
  }, [visible, rendered, runOpen, runClose]);

  const handleClose = () => {
    runClose(onClose);
  };

  useEffect(() => {
    if (!visible || !useApi) return;
    setLoadingMsgs(true);
    getRoomMessages(accessToken!, roomId, { limit: 80 })
      .then((msgs) => setApiMessages(Array.isArray(msgs) ? msgs : []))
      .catch(() => setApiMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [visible, useApi, accessToken, roomId]);

  const sendChat = async () => {
    const t = chatInput.trim();
    if (!t) return;
    if (useApi && accessToken) {
      setSending(true);
      try {
        const sent = await sendMessage(accessToken, roomId, t);
        setApiMessages((m) => [...m, sent]);
        setChatInput('');
      } catch {
        /* ignore */
      } finally {
        setSending(false);
      }
      return;
    }
    onFallbackSend(t);
    setChatInput('');
  };

  if (!rendered && !visible) return <></>;

  const backdropOpacity = backdrop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.48],
  });

  return (
    <Modal visible={rendered || visible} transparent animationType="none" statusBarTranslucent>
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            ...StyleSheetAbsolute,
            backgroundColor: '#000',
            opacity: backdropOpacity,
          }}
        />
        <Pressable style={StyleSheetAbsolute} onPress={handleClose} />
        <Animated.View
          style={{
            transform: [{ translateY: sheetY }],
            maxHeight: '72%',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: '#fff',
            paddingBottom: Math.max(insets.bottom, 12),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 24,
          }}
        >
          <View className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
            <View className="flex-1 pr-2">
              <Text className="text-lg font-bold text-gray-900">루트 협업 채팅</Text>
              <Text className="mt-0.5 text-[11px] text-gray-500" numberOfLines={1}>
                {routeTitle.trim() || '루트'}
                {useApi ? ' · 채팅 탭과 연동' : ' · 저장 후 채팅 탭에 표시'}
              </Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={26} color="#64748b" />
            </Pressable>
          </View>
          <Text className="border-b border-gray-50 bg-sky-50 px-4 py-2 text-center text-[11px] text-sky-900">
            같은 루트를 편집 중인 멤버와 실시간으로 조율할 수 있어요.
          </Text>
          <ScrollView className="max-h-80 px-3 py-2">
            {loadingMsgs ? (
              <ActivityIndicator className="py-6" color="#ea580c" />
            ) : useApi ? (
              apiMessages.map((msg) => {
                const isMe = msg.senderUuid === myUuid;
                return (
                  <View
                    key={msg.uuid}
                    className={`mb-2 rounded-xl px-3 py-2 ${
                      isMe ? 'self-end bg-sky-100' : 'self-start bg-gray-100'
                    }`}
                    style={{
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '88%',
                    }}
                  >
                    <Text className="text-[10px] font-semibold text-gray-500">
                      {msg.senderNickname}
                    </Text>
                    <Text className="text-sm text-gray-900">{msg.content}</Text>
                  </View>
                );
              })
            ) : (
              fallbackMessages.map((msg) => (
                <View
                  key={msg.id}
                  className={`mb-2 rounded-xl px-3 py-2 ${
                    msg.from === 'me' ? 'self-end bg-sky-100' : 'self-start bg-gray-100'
                  }`}
                  style={{
                    alignSelf: msg.from === 'me' ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                  }}
                >
                  <Text className="text-[10px] font-semibold text-gray-500">{msg.name}</Text>
                  <Text className="text-sm text-gray-900">{msg.text}</Text>
                </View>
              ))
            )}
            {!loadingMsgs && useApi && apiMessages.length === 0 ? (
              <Text className="py-6 text-center text-xs text-gray-400">
                아직 메시지가 없어요. 첫 메시지를 남겨 보세요.
              </Text>
            ) : null}
          </ScrollView>
          <View className="flex-row items-center gap-2 border-t border-gray-100 px-3 py-2">
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="메시지 입력..."
              className="flex-1 rounded-xl bg-gray-50 px-3 py-2.5 text-base"
              placeholderTextColor="#9ca3af"
              onSubmitEditing={() => void sendChat()}
              editable={!sending}
            />
            <Pressable
              onPress={() => void sendChat()}
              disabled={sending}
              className="rounded-xl bg-orange-500 px-4 py-2.5 active:opacity-90"
            >
              <Text className="font-bold text-white">{sending ? '…' : '전송'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const StyleSheetAbsolute = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};
