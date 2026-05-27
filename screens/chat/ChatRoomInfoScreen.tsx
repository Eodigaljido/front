import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Image,
  Dimensions,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { RootStackParamList } from "@/App";
import { safeGoBack } from "@/navigation/rootNavigation";
import {
  ChevronLeft,
  Edit2,
  UserPlus,
  LogOut,
  Trash2,
  Image as ImageIcon,
  X,
  Check,
  Users,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

import {
  deleteChatRoom,
  getChatRoom,
  inviteChatMember,
  leaveChatRoom,
  renameChatRoom,
} from "@/api/chat/chat";
import { getFriends } from "@/api/friend/friends";
import { getUserProfileByUuid } from "@/api/users";
import { useAuthStore } from "@/store/authStore";

type ChatRoomInfoRouteProp = RouteProp<
  RootStackParamList,
  "ChatRoomInfoScreen"
>;

type Member = {
  uuid: string;
  nickname: string;
  color: string;
  isOwner?: boolean;
};

type InvitableFriend = {
  id: string;
  uuid: string;
  name: string;
  userId?: string;
};

const PRESET_IMAGES = [
  { id: "p1", color: "#4FC3F7", emoji: "🐧" },
  { id: "p2", color: "#F48FB1", emoji: "🤖" },
  { id: "p3", color: "#FF8A65", emoji: "🔥" },
  { id: "p4", color: "#81C784", emoji: "🗺️" },
  { id: "p5", color: "#CE93D8", emoji: "⭐" },
  { id: "p6", color: "#80DEEA", emoji: "🌊" },
  { id: "p7", color: "#A5D6A7", emoji: "🌿" },
  { id: "p8", color: "#FFCC02", emoji: "🌟" },
  { id: "p9", color: "#FF7043", emoji: "🎮" },
  { id: "p10", color: "#42A5F5", emoji: "🎯" },
  { id: "p11", color: "#AB47BC", emoji: "🎨" },
  { id: "p12", color: "#26C6DA", emoji: "🎵" },
];

const FRIEND_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CELL_SIZE = (SCREEN_WIDTH - 32 - 8 * 3) / 4;

export default function ChatRoomInfoScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<ChatRoomInfoRouteProp>();
  const { roomUuid, roomName: initialRoomName } = route.params;

  const accessToken = useAuthStore((s) => s.accessToken);
  const myUuid = useAuthStore((s) => s.user?.uuid);

  const [isOwner, setIsOwner] = useState(false);
  const [roomName, setRoomName] = useState(initialRoomName);
  const [members, setMembers] = useState<Member[]>([]);
  const [friends, setFriends] = useState<InvitableFriend[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("p1");
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  const [editingName, setEditingName] = useState("");
  const [tempPresetId, setTempPresetId] = useState("p1");
  const [tempLocalImageUri, setTempLocalImageUri] = useState<string | null>(
    null,
  );
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(
    new Set(),
  );

  const currentPreset = PRESET_IMAGES.find((p) => p.id === selectedPresetId);
  const tempPreset = PRESET_IMAGES.find((p) => p.id === tempPresetId);

  const loadRoom = useCallback(async () => {
    if (!accessToken) return;
    const room = await getChatRoom(accessToken, roomUuid);
    if (!room) return;
    setIsOwner(String(room.ownerUuid) === String(myUuid ?? ""));
    const mapped: Member[] = (room.members ?? []).map((m, i) => ({
      uuid: m.uuid,
      nickname: m.userId ?? m.uuid.slice(0, 8),
      color: FRIEND_COLORS[i % FRIEND_COLORS.length],
      isOwner: m.uuid === room.ownerUuid,
    }));
    setMembers(mapped);
  }, [accessToken, roomUuid, myUuid]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!inviteModalVisible || !accessToken) return;
    getFriends(accessToken)
      .then((list) =>
        setFriends(
          list.map((f) => ({
            id: String(f.friendId),
            uuid: f.uuid,
            name: f.nickname,
          })),
        ),
      )
      .catch(() => setFriends([]));
  }, [inviteModalVisible, accessToken]);

  const invitableFriends = friends.filter(
    (f) => !members.some((m) => m.uuid === f.uuid),
  );

  const handleSaveName = async () => {
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === roomName) {
      setNameModalVisible(false);
      return;
    }
    if (!accessToken) {
      Alert.alert("오류", "인증 정보가 없습니다.");
      return;
    }
    try {
      await renameChatRoom(accessToken, roomUuid, trimmed);
      setRoomName(trimmed);
      setNameModalVisible(false);
      navigation.navigate("ChatRoomScreen", { roomUuid, roomName: trimmed });
    } catch (err) {
      console.error("채팅방 이름 변경 실패:", err);
      Alert.alert("오류", "채팅방 이름 변경에 실패했습니다.");
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setTempLocalImageUri(result.assets[0].uri);
      setTempPresetId("");
    }
  };

  const handleSaveImage = () => {
    setSelectedPresetId(tempPresetId);
    setLocalImageUri(tempLocalImageUri);
    setImageModalVisible(false);
  };

  const handleKickMember = (member: Member) => {
    Alert.alert(
      "멤버 강퇴",
      `${member.nickname}님을 채팅방에서 강퇴하시겠습니까?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "강퇴",
          style: "destructive",
          onPress: () =>
            setMembers((prev) => prev.filter((m) => m.uuid !== member.uuid)),
        },
      ],
    );
  };

  const handleConfirmInvite = async () => {
    if (!accessToken || selectedFriends.size === 0) {
      setInviteModalVisible(false);
      return;
    }
    for (const id of selectedFriends) {
      const friend = friends.find((f) => f.id === id);
      if (!friend) continue;
      try {
        const profile = await getUserProfileByUuid(friend.uuid);
        const userId = profile.userId;
        if (!userId) continue;
        await inviteChatMember(accessToken, roomUuid, userId);
      } catch {
        /* skip failed invite */
      }
    }
    setSelectedFriends(new Set());
    setInviteModalVisible(false);
    void loadRoom();
  };

  const handleLeaveRoom = async () => {
    Alert.alert("채팅방 나가기", "채팅방에서 나가시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "나가기",
        style: "destructive",
        onPress: async () => {
          try {
            if (!accessToken) {
              Alert.alert("오류", "인증 정보가 없습니다.");
              return;
            }
            await leaveChatRoom(accessToken, roomUuid);
            navigation.navigate("Tabs");
          } catch (err) {
            console.error("채팅방 나가기 실패:", err);
            Alert.alert("오류", "채팅방 나가기에 실패했습니다.");
          }
        },
      },
    ]);
  };

  const handleDeleteRoom = async () => {
    Alert.alert("채팅방 삭제", "채팅방을 삭제하면 복구할 수 없습니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            if (!accessToken) {
              Alert.alert("오류", "인증 정보가 없습니다.");
              return;
            }
            await deleteChatRoom(accessToken, roomUuid);
            navigation.navigate("Tabs");
          } catch (err) {
            console.error("채팅방 삭제 실패:", err);
            Alert.alert("오류", "채팅방 삭제에 실패했습니다.");
          }
        },
      },
    ]);
  };

  const toggleFriendSelect = (id: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => safeGoBack(navigation)}
          style={s.headerBackBtn}
        >
          <ChevronLeft color="#111827" size={22} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>채팅방 정보</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 프로필 카드 */}
        <View style={s.profileCard}>
          <TouchableOpacity
            onPress={() => {
              setTempPresetId(selectedPresetId);
              setTempLocalImageUri(localImageUri);
              setImageModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <View style={s.avatarShadow}>
              <View
                style={[
                  s.profileCircle,
                  { backgroundColor: currentPreset?.color ?? "#E5E7EB" },
                ]}
              >
                {localImageUri ? (
                  <Image
                    source={{ uri: localImageUri }}
                    style={{ width: 112, height: 112 }}
                  />
                ) : currentPreset ? (
                  <Text style={{ fontSize: 52 }}>{currentPreset.emoji}</Text>
                ) : (
                  <ImageIcon color="#9CA3AF" size={44} />
                )}
              </View>
            </View>
            <View style={s.editBadge}>
              <Edit2 color="white" size={11} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.roomNameRow}
            onPress={() => {
              setEditingName(roomName);
              setNameModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={s.roomNameText}>{roomName}</Text>
            <View style={s.nameEditPill}>
              <Edit2 color="#3B82F6" size={12} />
              <Text style={s.nameEditPillText}>수정</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 멤버 카드 */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>멤버</Text>
            <TouchableOpacity
              style={s.inviteBtn}
              onPress={() => {
                setSelectedFriends(new Set());
                setInviteModalVisible(true);
              }}
            >
              <UserPlus color="#3B82F6" size={14} />
              <Text style={s.inviteBtnText}>초대</Text>
            </TouchableOpacity>
          </View>

          {members.map((member, index) => (
            <View key={member.uuid}>
              {index > 0 && <View style={s.memberDivider} />}
              <View style={s.memberRow}>
                <View
                  style={[s.memberAvatar, { backgroundColor: member.color }]}
                >
                  <Text style={s.memberAvatarText}>{member.nickname[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.memberName}>{member.nickname}</Text>
                </View>
                {member.isOwner && (
                  <View style={s.ownerBadge}>
                    <Text style={s.ownerBadgeText}>방장</Text>
                  </View>
                )}
                {isOwner && !member.isOwner && (
                  <TouchableOpacity
                    onPress={() => handleKickMember(member)}
                    style={s.kickBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X color="#9CA3AF" size={16} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* 위험 액션 카드 */}
        <View style={[s.card, s.dangerCard]}>
          <TouchableOpacity
            style={s.dangerRow}
            onPress={handleLeaveRoom}
            activeOpacity={0.7}
          >
            <View style={s.dangerIconWrap}>
              <LogOut color="#EF4444" size={18} />
            </View>
            <Text style={s.dangerText}>채팅방 나가기</Text>
            <ChevronLeft
              color="#D1D5DB"
              size={18}
              style={{ transform: [{ rotate: "180deg" }] }}
            />
          </TouchableOpacity>
          {isOwner && (
            <>
              <View style={s.dangerDivider} />
              <TouchableOpacity
                style={s.dangerRow}
                onPress={handleDeleteRoom}
                activeOpacity={0.7}
              >
                <View
                  style={[s.dangerIconWrap, { backgroundColor: "#FEE2E2" }]}
                >
                  <Trash2 color="#EF4444" size={18} />
                </View>
                <Text style={s.dangerText}>채팅방 삭제</Text>
                <ChevronLeft
                  color="#D1D5DB"
                  size={18}
                  style={{ transform: [{ rotate: "180deg" }] }}
                />
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* 이름 수정 모달 */}
      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={() => setNameModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.modalCard}>
            <View style={s.modalTitleRow}>
              <Text style={s.modalTitle}>채팅방 이름 수정</Text>
            </View>
            <TextInput
              style={s.textInput}
              value={editingName}
              onChangeText={setEditingName}
              maxLength={100}
              placeholder="채팅방 이름을 입력하세요"
              placeholderTextColor="#C4C9D4"
              autoFocus
              selectionColor="#3B82F6"
            />
            <View style={s.modalButtons}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnCancel]}
                onPress={() => setNameModalVisible(false)}
              >
                <Text style={s.modalBtnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnConfirm]}
                onPress={handleSaveName}
              >
                <Text style={s.modalBtnConfirmText}>저장</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 프로필 이미지 변경 바텀시트 */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={s.bottomSheetWrap}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setImageModalVisible(false)}
          />
          <View style={s.bottomSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>프로필 이미지 변경</Text>

            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <View
                style={[
                  s.previewCircle,
                  { backgroundColor: tempPreset?.color ?? "#E5E7EB" },
                ]}
              >
                {tempLocalImageUri ? (
                  <Image
                    source={{ uri: tempLocalImageUri }}
                    style={{ width: 72, height: 72, borderRadius: 36 }}
                  />
                ) : tempPreset ? (
                  <Text style={{ fontSize: 36 }}>{tempPreset.emoji}</Text>
                ) : (
                  <ImageIcon color="#9CA3AF" size={30} />
                )}
              </View>
            </View>

            <View style={s.presetGrid}>
              <TouchableOpacity
                onPress={handlePickImage}
                style={[
                  s.presetCell,
                  { backgroundColor: "#F3F4F6" },
                  tempLocalImageUri ? s.presetSelected : undefined,
                ]}
              >
                {tempLocalImageUri ? (
                  <Image
                    source={{ uri: tempLocalImageUri }}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      borderRadius: CELL_SIZE / 2,
                    }}
                  />
                ) : (
                  <ImageIcon
                    color="#9CA3AF"
                    size={Math.round(CELL_SIZE * 0.35)}
                  />
                )}
              </TouchableOpacity>
              {PRESET_IMAGES.map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  onPress={() => {
                    setTempPresetId(preset.id);
                    setTempLocalImageUri(null);
                  }}
                  style={[
                    s.presetCell,
                    { backgroundColor: preset.color },
                    tempPresetId === preset.id && !tempLocalImageUri
                      ? s.presetSelected
                      : undefined,
                  ]}
                >
                  <Text style={{ fontSize: Math.round(CELL_SIZE * 0.4) }}>
                    {preset.emoji}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ paddingHorizontal: 16 }}>
              <View style={s.modalButtons}>
                <TouchableOpacity
                  style={[s.modalBtn, s.modalBtnCancel]}
                  onPress={() => setImageModalVisible(false)}
                >
                  <Text style={s.modalBtnCancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalBtn, s.modalBtnConfirm]}
                  onPress={handleSaveImage}
                >
                  <Text style={s.modalBtnConfirmText}>저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* 멤버 초대 바텀시트 */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={s.bottomSheetWrap}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setInviteModalVisible(false)}
          />
          <View style={[s.bottomSheet, { maxHeight: "65%" }]}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeaderRow}>
              <Text style={s.sheetTitle}>멤버 초대</Text>
              <TouchableOpacity
                onPress={handleConfirmInvite}
                disabled={selectedFriends.size === 0}
                style={[
                  s.sheetConfirmBtn,
                  { opacity: selectedFriends.size > 0 ? 1 : 0.35 },
                ]}
              >
                <Text style={s.sheetConfirmText}>완료</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {invitableFriends.length === 0 ? (
                <Text style={s.emptyText}>초대할 수 있는 친구가 없습니다.</Text>
              ) : (
                invitableFriends.map((friend) => {
                  const isSelected = selectedFriends.has(friend.id);
                  const color =
                    FRIEND_COLORS[
                      parseInt(friend.id.replace("f", ""), 10) %
                        FRIEND_COLORS.length
                    ];
                  return (
                    <TouchableOpacity
                      key={friend.id}
                      style={s.friendRow}
                      onPress={() => toggleFriendSelect(friend.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[s.memberAvatar, { backgroundColor: color }]}
                      >
                        <Text style={s.memberAvatarText}>{friend.name[0]}</Text>
                      </View>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 15,
                          color: "#111827",
                          fontWeight: "500",
                        }}
                      >
                        {friend.name}
                      </Text>
                      <View
                        style={[
                          s.checkCircle,
                          {
                            borderColor: isSelected ? "#3B82F6" : "#D1D5DB",
                            backgroundColor: isSelected
                              ? "#3B82F6"
                              : "transparent",
                          },
                        ]}
                      >
                        {isSelected && (
                          <Check color="white" size={12} strokeWidth={3} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
              <View style={{ height: 16 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const shadow = Platform.select({
  ios: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
});

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F0F5FF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: "#F0F5FF",
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.3,
  },

  /* 프로필 카드 */
  profileCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 28,
    ...shadow,
  },
  avatarShadow: {
    borderRadius: 60,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  profileCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  editBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#fff",
  },
  roomNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    gap: 8,
  },
  roomNameText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.4,
  },
  nameEditPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
  },
  nameEditPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3B82F6",
  },
  memberCountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  memberCountText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },

  /* 공통 카드 */
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 20,
    overflow: "hidden",
    ...shadow,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
  },
  inviteBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3B82F6",
  },

  /* 멤버 행 */
  memberDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#F3F4F6",
    marginHorizontal: 20,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  memberAvatarText: {
    color: "white",
    fontSize: 17,
    fontWeight: "700",
  },
  memberName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111827",
  },
  ownerBadge: {
    marginRight: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
  kickBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },

  /* 위험 액션 카드 */
  dangerCard: {
    marginTop: 14,
  },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  dangerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#EF4444",
  },
  dangerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#FEE2E2",
    marginHorizontal: 20,
  },

  /* 모달 */
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: SCREEN_WIDTH - 64,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: { elevation: 10 },
    }),
  },
  modalTitleRow: {
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.3,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    marginBottom: 18,
    backgroundColor: "#FAFAFA",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnCancel: {
    backgroundColor: "#F3F4F6",
  },
  modalBtnConfirm: {
    backgroundColor: "#3B82F6",
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  modalBtnConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },

  /* 바텀시트 */
  bottomSheetWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    paddingHorizontal: 20,
    paddingVertical: 12,
    letterSpacing: -0.3,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  sheetConfirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
  },
  sheetConfirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3B82F6",
  },
  previewCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  presetCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  presetSelected: {
    borderWidth: 3,
    borderColor: "#3B82F6",
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 14,
    paddingVertical: 40,
  },
});
