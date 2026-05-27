import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "@/App";
import { safeGoBack } from "@/navigation/rootNavigation";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Search,
  Image as ImageIcon,
  UserPlus,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "@/store/authStore";
import { getFriends, getFriendsRecent } from "@/api/friend/friends";
import { createChatRoom } from "@/api/chat/chat";

// ─── Types ────────────────────────────────────────────────────────────────────

type Friend = { id: string; name: string; uuid: string };

const AVATAR_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
];

type PresetImage = { id: string; color: string; emoji: string };

// 19개 프리셋 + 1개 로컬 피커 = 4×5 그리드
const PRESET_IMAGES: PresetImage[] = [
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
  { id: "p13", color: "#9CCC65", emoji: "🏔️" },
  { id: "p14", color: "#FFA726", emoji: "🌈" },
  { id: "p15", color: "#EC407A", emoji: "💎" },
  { id: "p16", color: "#7E57C2", emoji: "🚀" },
  { id: "p17", color: "#29B6F6", emoji: "⚡" },
  { id: "p18", color: "#66BB6A", emoji: "🎪" },
  { id: "p19", color: "#FFCA28", emoji: "🏆" },
];

// ─── Grid 계산 ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_H_PADDING = 16;
const GRID_COLS = 4;
const GRID_GAP = 8;
const CELL_SIZE =
  (SCREEN_WIDTH - GRID_H_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function ChatCreatingScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const myUuid = useAuthStore((s) => s.user?.uuid);

  const [step, setStep] = useState<"invite" | "setup">("invite");

  // Step 1
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(
    new Set(),
  );
  const [recentFriends, setRecentFriends] = useState<Friend[]>([]);
  const [allFriends, setAllFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Step 2
  const [roomName, setRoomName] = useState("");
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // ── 친구 목록 조회 ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!accessToken) return;
    setLoadingFriends(true);
    Promise.all([getFriendsRecent(accessToken), getFriends(accessToken)])
      .then(([recent, all]) => {
        setRecentFriends(
          recent.map((f) => ({
            id: String(f.friendId),
            name: f.nickname,
            uuid: f.uuid,
          })),
        );
        setAllFriends(
          all.map((f) => ({
            id: String(f.friendId),
            name: f.nickname,
            uuid: f.uuid,
          })),
        );
      })
      .finally(() => setLoadingFriends(false));
  }, [accessToken]);

  // ── 친구 초대 ────────────────────────────────────────────────────────────────

  const filteredRecent = recentFriends.filter((f) =>
    f.name.includes(searchQuery),
  );
  const filteredAll = allFriends.filter((f) => f.name.includes(searchQuery));

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── 채팅방 설정 ──────────────────────────────────────────────────────────────

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setLocalImageUri(result.assets[0].uri);
      setSelectedPresetId(null);
    }
  };

  const handleSelectPreset = (id: string) => {
    setSelectedPresetId(id);
    setLocalImageUri(null);
  };

  const handleCreate = async () => {
    if (!accessToken) return;
    const trimedName = roomName.trim();
    if (trimedName.length === 0) {
      Alert.alert("알림", "채팅방 이름을 입력해주세요.");
      return;
    }
    const allKnownFriends = [...recentFriends, ...allFriends];
    const selectedUuids = [...selectedFriends]
      .map((id) => allKnownFriends.find((f) => f.id === id)?.uuid)
      .filter((uuid): uuid is string => uuid != null);
    const memberUuids = myUuid
      ? [...new Set([myUuid, ...selectedUuids])]
      : selectedUuids;
    setIsCreating(true);
    try {
      await createChatRoom(accessToken, memberUuids, trimedName, localImageUri);
      safeGoBack(navigation);
    } catch {
      Alert.alert("오류", "채팅방 생성에 실패했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  const currentPreset = PRESET_IMAGES.find((p) => p.id === selectedPresetId);

  // ── 공통 서브컴포넌트 ─────────────────────────────────────────────────────────

  const FriendRow = ({ friend }: { friend: Friend }) => {
    const isSelected = selectedFriends.has(friend.id);
    const avatarColor =
      AVATAR_COLORS[parseInt(friend.id, 10) % AVATAR_COLORS.length];
    return (
      <TouchableOpacity
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
        activeOpacity={0.7}
        onPress={() => toggleFriend(friend.id)}
      >
        {/* 아바타 */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: avatarColor,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>
            {friend.name[0]}
          </Text>
        </View>

        {/* 이름 */}
        <Text style={{ flex: 1, fontSize: 15, color: "#111827" }}>
          {friend.name}
        </Text>

        {/* 선택 표시 */}
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: isSelected ? "#3B82F6" : "#D1D5DB",
            backgroundColor: isSelected ? "#3B82F6" : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isSelected && <Check color="white" size={13} strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // Step 1: 친구 초대 화면
  // ══════════════════════════════════════════════════════════════════════════════

  if (step === "invite") {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "white" }}
        edges={["top"]}
      >
        {/* 헤더 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 8,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: "#F3F4F6",
          }}
        >
          <TouchableOpacity
            onPress={() => safeGoBack(navigation)}
            style={{ padding: 8 }}
          >
            <X color="#111827" size={22} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setStep("setup")}
            disabled={selectedFriends.size === 0}
            style={{ paddingHorizontal: 8, paddingVertical: 8 }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: selectedFriends.size > 0 ? "#3B82F6" : "#D1D5DB",
              }}
            >
              다음
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 }}
          >
            {/* 제목 */}
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: "#111827",
                marginBottom: 16,
              }}
            >
              친구 초대
            </Text>

            {/* 검색바 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#F3F4F6",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 24,
              }}
            >
              <Search color="#9CA3AF" size={17} />
              <TextInput
                style={{
                  flex: 1,
                  marginLeft: 8,
                  fontSize: 14,
                  color: "#111827",
                }}
                placeholder="이름으로 검색"
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* 친구 목록 */}
            {loadingFriends ? (
              <ActivityIndicator
                size="small"
                color="#3B82F6"
                style={{ marginTop: 16 }}
              />
            ) : (
              <>
                {/* 자주 연락한 친구 */}
                {filteredRecent.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: "#9CA3AF",
                        marginBottom: 4,
                        paddingHorizontal: 16,
                      }}
                    >
                      자주 연락한 친구
                    </Text>
                    {filteredRecent.map((f) => (
                      <FriendRow key={f.id} friend={f} />
                    ))}
                  </View>
                )}

                {/* 전체 친구 */}
                {filteredAll.length > 0 && (
                  <View>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: "#9CA3AF",
                        marginBottom: 4,
                        paddingHorizontal: 16,
                      }}
                    >
                      전체 친구
                    </Text>
                    {filteredAll.map((f) => (
                      <FriendRow key={f.id} friend={f} />
                    ))}

                    {/* 더 많은 친구 초대하기 */}
                    <TouchableOpacity
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 8,
                        paddingHorizontal: 16,
                        paddingVertical: 16,
                        backgroundColor: "#F9FAFB",
                        borderRadius: 16,
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: "#E5E7EB",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        <UserPlus color="#6B7280" size={18} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: "#111827",
                          }}
                        >
                          더 많은 친구 초대하기
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: "#9CA3AF",
                            marginTop: 2,
                          }}
                          numberOfLines={2}
                        >
                          사용자를 검색하거나 링크를 초대하여 친구를
                          만들어보세요!
                        </Text>
                      </View>
                      <ChevronRight color="#9CA3AF" size={18} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Step 2: 채팅방 설정 화면
  // ══════════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }} edges={["top"]}>
      {/* 헤더 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 8,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: "#F3F4F6",
        }}
      >
        <TouchableOpacity
          onPress={() => setStep("invite")}
          style={{ padding: 8 }}
        >
          <ChevronLeft color="#111827" size={22} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={isCreating}
          style={{ paddingHorizontal: 8, paddingVertical: 8 }}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#3B82F6" }}>
              생성
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 32, paddingBottom: 40 }}>
          {/* 채팅방 프로필 이미지 */}
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: currentPreset?.color ?? "#E5E7EB",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {localImageUri ? (
                <Image
                  source={{ uri: localImageUri }}
                  style={{ width: 96, height: 96 }}
                />
              ) : currentPreset ? (
                <Text style={{ fontSize: 44 }}>{currentPreset.emoji}</Text>
              ) : (
                <ImageIcon color="#9CA3AF" size={36} />
              )}
            </View>
          </View>

          {/* 채팅방 이름 입력 */}
          <View style={{ paddingHorizontal: 16, marginBottom: 32 }}>
            <View
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 10,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
                  채팅방 이름
                </Text>
                <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
                  {roomName.length}/100
                </Text>
              </View>
              <TextInput
                style={{ fontSize: 15, color: "#111827", paddingVertical: 0 }}
                value={roomName}
                onChangeText={(t) => setRoomName(t.slice(0, 100))}
                maxLength={100}
                placeholder="채팅방 이름을 입력하세요"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* 이미지 선택 그리드 (4열 × 5행) */}
          <View
            style={{
              paddingHorizontal: GRID_H_PADDING,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: GRID_GAP,
            }}
          >
            {/* 첫 번째 셀: 로컬 이미지 선택 */}
            <TouchableOpacity
              onPress={handlePickImage}
              activeOpacity={0.7}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                borderRadius: CELL_SIZE / 2,
                backgroundColor: "#F3F4F6",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                borderWidth: localImageUri ? 3 : 0,
                borderColor: "#3B82F6",
              }}
            >
              {localImageUri ? (
                <Image
                  source={{ uri: localImageUri }}
                  style={{ width: CELL_SIZE, height: CELL_SIZE }}
                />
              ) : (
                <ImageIcon
                  color="#9CA3AF"
                  size={Math.round(CELL_SIZE * 0.35)}
                />
              )}
            </TouchableOpacity>

            {/* 프리셋 이미지 19개 */}
            {PRESET_IMAGES.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  onPress={() => handleSelectPreset(preset.id)}
                  activeOpacity={0.8}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    borderRadius: CELL_SIZE / 2,
                    backgroundColor: preset.color,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: isSelected ? 3 : 0,
                    borderColor: "#3B82F6",
                  }}
                >
                  <Text style={{ fontSize: Math.round(CELL_SIZE * 0.42) }}>
                    {preset.emoji}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
