import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  MapPin,
  MessageCircle,
  Plus,
  Settings,
  Share2,
  Unlock,
  Users,
} from "lucide-react-native";

import { RootStackParamList } from "@/App";
import { safeGoBack } from "@/navigation/rootNavigation";
import { useAuthStore } from "@/store/authStore";

import { getGroup, joinGroup } from "@/api/meet/groups";
import { getGroupChatRooms, createGroupChatRoom } from "@/api/meet/chatRooms";
import {
  getGroupPosts,
  createGroupPost,
  updateGroupPost,
  deleteGroupPost,
} from "@/api/meet/posts";
import { getGroupRoutes } from "@/api/meet/routes";
import { getJoinRequests, leaveGroup } from "@/api/meet/members";
import type {
  Group,
  GroupChatRoom,
  GroupPost,
  GroupRoute,
} from "@/api/meet/types";

type DetailRouteProp = RouteProp<RootStackParamList, "MeetDetail">;
type Tab = "chat" | "feed" | "info";
type FeedFilter = "all" | "post" | "route";

const AVATAR_COLORS = [
  "#4F80FF",
  "#7C3AED",
  "#EC4899",
  "#F97316",
  "#16A34A",
  "#0EA5E9",
];
function getAvatarColor(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

export default function MeetDetailScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<DetailRouteProp>();
  const { groupUuid, groupName: initialName } = route.params;

  const accessToken = useAuthStore((s) => s.accessToken) ?? "";
  const myUuid = useAuthStore((s) => s.user?.uuid);

  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [group, setGroup] = useState<Group | null>(null);
  const [chatRooms, setChatRooms] = useState<GroupChatRoom[]>([]);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [routes, setRoutes] = useState<GroupRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");

  const [createRoomModalVisible, setCreateRoomModalVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);

  const [writePostModalVisible, setWritePostModalVisible] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [submittingPost, setSubmittingPost] = useState(false);

  const [editingPost, setEditingPost] = useState<GroupPost | null>(null);
  const [editPostContent, setEditPostContent] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const isAdmin = group?.adminUuid === myUuid;
  const isMember = group?.joinedByMe ?? false;
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  const loadGroup = useCallback(async () => {
    try {
      const g = await getGroup(groupUuid);
      setGroup(g);
    } catch {
      /* ignore */
    }
  }, [groupUuid]);

  const loadChatRooms = useCallback(async () => {
    if (!accessToken) return;
    try {
      const rooms = await getGroupChatRooms(accessToken, groupUuid);
      setChatRooms(rooms);
    } catch {
      setChatRooms([]);
    }
  }, [accessToken, groupUuid]);

  const loadFeed = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [p, r] = await Promise.all([
        getGroupPosts(accessToken, groupUuid),
        getGroupRoutes(accessToken, groupUuid),
      ]);
      setPosts(p);
      setRoutes(r);
    } catch {
      /* ignore */
    }
  }, [accessToken, groupUuid]);

  const loadPendingRequests = useCallback(async () => {
    if (!accessToken || !isAdmin) return;
    try {
      const reqs = await getJoinRequests(accessToken, groupUuid);
      setPendingRequestCount(reqs.length);
    } catch {
      /* ignore */
    }
  }, [accessToken, groupUuid, isAdmin]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadGroup(), loadChatRooms(), loadFeed()]);
    setLoading(false);
  }, [loadGroup, loadChatRooms, loadFeed]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void loadPendingRequests();
  }, [loadPendingRequests]);

  const handleJoin = async () => {
    if (!accessToken) return;
    try {
      const res = await joinGroup(accessToken, groupUuid);
      if (res.status === "JOINED") {
        Alert.alert("완료", "모임에 가입되었습니다.");
      } else {
        Alert.alert("신청 완료", "방장 승인 후 가입됩니다.");
      }
      void loadGroup();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "가입에 실패했습니다.";
      Alert.alert("오류", msg);
    }
  };

  const handleLeave = () => {
    Alert.alert("모임 탈퇴", "모임에서 탈퇴하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "탈퇴",
        style: "destructive",
        onPress: async () => {
          try {
            await leaveGroup(accessToken, groupUuid);
            navigation.goBack();
          } catch (err: any) {
            Alert.alert(
              "오류",
              err?.response?.data?.message ?? "탈퇴에 실패했습니다.",
            );
          }
        },
      },
    ]);
  };

  const handleCreateRoom = async () => {
    const name = newRoomName.trim();
    if (!name) return;
    setCreatingRoom(true);
    try {
      await createGroupChatRoom(accessToken, groupUuid, name);
      setNewRoomName("");
      setCreateRoomModalVisible(false);
      void loadChatRooms();
    } catch (err: unknown) {
      Alert.alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "채팅방 생성에 실패했습니다.",
      );
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleSubmitPost = async () => {
    const content = newPostContent.trim();
    if (!content) return;
    setSubmittingPost(true);
    try {
      await createGroupPost(accessToken, groupUuid, { content });
      setNewPostContent("");
      setWritePostModalVisible(false);
      void loadFeed();
    } catch {
      Alert.alert("오류", "게시물 작성에 실패했습니다.");
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleEditPost = async () => {
    if (!editingPost) return;
    const content = editPostContent.trim();
    if (!content) return;
    setSubmittingEdit(true);
    try {
      await updateGroupPost(accessToken, editingPost.uuid, { content });
      setEditingPost(null);
      void loadFeed();
    } catch {
      Alert.alert("오류", "게시물 수정에 실패했습니다.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeletePost = (post: GroupPost) => {
    Alert.alert("게시물 삭제", "게시물을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteGroupPost(accessToken, groupUuid, post.uuid);
            void loadFeed();
          } catch {
            Alert.alert("오류", "게시물 삭제에 실패했습니다.");
          }
        },
      },
    ]);
  };

  const feedItems = (() => {
    if (feedFilter === "post")
      return posts.map((p) => ({ type: "post" as const, data: p }));
    if (feedFilter === "route")
      return routes.map((r) => ({ type: "route" as const, data: r }));
    const combined: Array<
      { type: "post"; data: GroupPost } | { type: "route"; data: GroupRoute }
    > = [
      ...posts.map((p) => ({ type: "post" as const, data: p })),
      ...routes.map((r) => ({ type: "route" as const, data: r })),
    ];
    combined.sort((a, b) => {
      const aDate = a.type === "post" ? a.data.createdAt : "";
      const bDate = b.type === "post" ? b.data.createdAt : "";
      return bDate.localeCompare(aDate);
    });
    return combined;
  })();

  const groupColor = group ? getAvatarColor(group.name) : "#3B82F6";

  const TAB_LABELS: Record<Tab, string> = {
    chat: "채팅",
    feed: "게시물 & 루트",
    info: "소개",
  };

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => safeGoBack(navigation)}
        >
          <ChevronLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          {group && (
            <View style={[s.headerAvatar, { backgroundColor: groupColor }]}>
              {group.profileImageUrl ? (
                <Image
                  source={{ uri: group.profileImageUrl }}
                  style={s.headerAvatarImg}
                />
              ) : (
                <Text style={s.headerAvatarText}>
                  {group.name[0]?.toUpperCase() ?? "?"}
                </Text>
              )}
            </View>
          )}
          <Text style={s.headerTitle} numberOfLines={1}>
            {group?.name ?? initialName}
          </Text>
        </View>
        {isAdmin ? (
          <TouchableOpacity
            style={s.settingsBtn}
            onPress={() =>
              navigation.navigate("MeetManage", {
                groupUuid,
                groupName: group?.name ?? initialName,
              })
            }
          >
            <Settings color="#3B82F6" size={19} />
            {pendingRequestCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>
                  {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {/* 탭 바 */}
      <View style={s.tabBar}>
        {(["chat", "feed", "info"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabLabel, activeTab === tab && s.tabLabelActive]}>
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : (
        <>
          {/* 탭 1: 채팅방 목록 */}
          {activeTab === "chat" && (
            <FlatList
              data={chatRooms}
              keyExtractor={(item) => item.uuid}
              contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
              ListHeaderComponent={
                isAdmin ? (
                  <TouchableOpacity
                    style={s.actionPill}
                    onPress={() => setCreateRoomModalVisible(true)}
                  >
                    <View style={s.actionPillIcon}>
                      <Plus color="#3B82F6" size={15} strokeWidth={2.5} />
                    </View>
                    <Text style={s.actionPillText}>새 채팅방 만들기</Text>
                  </TouchableOpacity>
                ) : null
              }
              ListEmptyComponent={
                <View style={s.emptyBox}>
                  <View style={s.emptyIconWrap}>
                    <MessageCircle color="#CBD5E1" size={26} />
                  </View>
                  <Text style={s.emptyTitle}>채팅방이 없어요</Text>
                  <Text style={s.emptyDesc}>첫 번째 채팅방을 만들어보세요</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.roomCard}
                  onPress={() =>
                    navigation.navigate("ChatRoomScreen", {
                      roomUuid: item.uuid,
                      roomName: item.name,
                    })
                  }
                  activeOpacity={0.75}
                >
                  <View style={s.roomIconWrap}>
                    <MessageCircle color="#3B82F6" size={20} />
                  </View>
                  <Text style={s.roomName}>{item.name}</Text>
                  <ChevronRight color="#CBD5E1" size={18} />
                </TouchableOpacity>
              )}
            />
          )}

          {/* 탭 2: 게시물 & 루트 */}
          {activeTab === "feed" && (
            <View style={{ flex: 1 }}>
              <View style={s.filterRow}>
                {(["all", "post", "route"] as FeedFilter[]).map((f) => {
                  const FILTER_LABELS: Record<FeedFilter, string> = {
                    all: "전체",
                    post: "게시물",
                    route: "루트",
                  };
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[
                        s.filterChip,
                        feedFilter === f && s.filterChipActive,
                      ]}
                      onPress={() => setFeedFilter(f)}
                    >
                      <Text
                        style={[
                          s.filterLabel,
                          feedFilter === f && s.filterLabelActive,
                        ]}
                      >
                        {FILTER_LABELS[f]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <FlatList
                data={feedItems}
                keyExtractor={(item, i) =>
                  item.type === "post"
                    ? item.data.uuid
                    : `route-${item.data.id}-${i}`
                }
                contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
                ListHeaderComponent={
                  isMember ? (
                    <TouchableOpacity
                      style={s.actionPill}
                      onPress={() => setWritePostModalVisible(true)}
                    >
                      <View style={s.actionPillIcon}>
                        <Plus color="#3B82F6" size={15} strokeWidth={2.5} />
                      </View>
                      <Text style={s.actionPillText}>게시물 작성</Text>
                    </TouchableOpacity>
                  ) : null
                }
                ListEmptyComponent={
                  <View style={s.emptyBox}>
                    <View style={s.emptyIconWrap}>
                      <MapPin color="#CBD5E1" size={26} />
                    </View>
                    <Text style={s.emptyTitle}>게시물이 없어요</Text>
                    <Text style={s.emptyDesc}>
                      첫 번째 게시물을 작성해보세요
                    </Text>
                  </View>
                }
                renderItem={({ item }) =>
                  item.type === "post" ? (
                    <PostCard
                      post={item.data}
                      myUuid={myUuid}
                      isAdmin={isAdmin}
                      onEdit={(p) => {
                        setEditPostContent(p.content);
                        setEditingPost(p);
                      }}
                      onDelete={handleDeletePost}
                    />
                  ) : (
                    <RouteCard route={item.data} />
                  )
                }
              />
            </View>
          )}

          {/* 탭 3: 소개 */}
          {activeTab === "info" && group && (
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
            >
              {/* 모임 프로필 카드 */}
              <View style={s.infoCard}>
                <View
                  style={[s.infoAvatarWrap, { backgroundColor: groupColor }]}
                >
                  {group.profileImageUrl ? (
                    <Image
                      source={{ uri: group.profileImageUrl }}
                      style={{ width: 88, height: 88, borderRadius: 44 }}
                    />
                  ) : (
                    <Text style={s.infoAvatarText}>
                      {group.name[0]?.toUpperCase() ?? "?"}
                    </Text>
                  )}
                </View>
                <Text style={s.infoName}>{group.name}</Text>
                {group.description ? (
                  <Text style={s.infoDesc}>{group.description}</Text>
                ) : null}
                <View style={s.infoStats}>
                  <View style={s.infoStatItem}>
                    <Text style={s.infoStatValue}>{group.memberCount}</Text>
                    <Text style={s.infoStatLabel}>멤버</Text>
                  </View>
                  <View style={s.infoStatSep} />
                  <View style={s.infoStatItem}>
                    {group.type === "PUBLIC" ? (
                      <Unlock color={groupColor} size={16} />
                    ) : (
                      <Lock color={groupColor} size={16} />
                    )}
                    <Text style={s.infoStatLabel}>
                      {group.type === "PUBLIC" ? "공개" : "비공개"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 액션 카드 */}
              <View style={s.actionCard}>
                {!isMember ? (
                  <TouchableOpacity
                    style={s.actionRow}
                    onPress={handleJoin}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[s.actionIcon, { backgroundColor: "#EFF6FF" }]}
                    >
                      <Users color="#3B82F6" size={17} />
                    </View>
                    <Text style={[s.actionText, { color: "#3B82F6" }]}>
                      {group.type === "PRIVATE" || group.requiresApproval
                        ? "가입 신청하기"
                        : "모임 가입하기"}
                    </Text>
                    <ChevronRight color="#CBD5E1" size={17} />
                  </TouchableOpacity>
                ) : !isAdmin ? (
                  <TouchableOpacity
                    style={s.actionRow}
                    onPress={handleLeave}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[s.actionIcon, { backgroundColor: "#FEE2E2" }]}
                    >
                      <ChevronLeft color="#EF4444" size={17} />
                    </View>
                    <Text style={[s.actionText, { color: "#EF4444" }]}>
                      모임 탈퇴
                    </Text>
                    <ChevronRight color="#CBD5E1" size={17} />
                  </TouchableOpacity>
                ) : null}

                {isMember && (
                  <>
                    {(!isMember || !isAdmin) && (
                      <View style={s.actionDivider} />
                    )}
                    <TouchableOpacity
                      style={s.actionRow}
                      onPress={() =>
                        Alert.alert(
                          "링크 공유",
                          `https://eodigaljido.uk/groups/${groupUuid}`,
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <View
                        style={[s.actionIcon, { backgroundColor: "#F0FDF4" }]}
                      >
                        <Share2 color="#22C55E" size={17} />
                      </View>
                      <Text style={s.actionText}>모임 링크 공유</Text>
                      <ChevronRight color="#CBD5E1" size={17} />
                    </TouchableOpacity>
                  </>
                )}

                {isAdmin && (
                  <>
                    <View style={s.actionDivider} />
                    <TouchableOpacity
                      style={s.actionRow}
                      onPress={() =>
                        navigation.navigate("MeetManage", {
                          groupUuid,
                          groupName: group.name,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <View
                        style={[s.actionIcon, { backgroundColor: "#F5F3FF" }]}
                      >
                        <Settings color="#7C3AED" size={17} />
                      </View>
                      <Text style={s.actionText}>모임 관리</Text>
                      <ChevronRight color="#CBD5E1" size={17} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>
          )}
        </>
      )}

      {/* 채팅방 생성 모달 */}
      <Modal
        visible={createRoomModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateRoomModalVisible(false)}
      >
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={() => setCreateRoomModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.modalCard}>
            <Text style={s.modalTitle}>채팅방 만들기</Text>
            <TextInput
              style={s.modalInput}
              value={newRoomName}
              onChangeText={setNewRoomName}
              placeholder="채팅방 이름"
              placeholderTextColor="#CBD5E1"
              autoFocus
              maxLength={50}
              selectionColor="#3B82F6"
            />
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnCancel]}
                onPress={() => setCreateRoomModalVisible(false)}
              >
                <Text style={s.modalBtnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.modalBtn,
                  s.modalBtnConfirm,
                  { opacity: creatingRoom ? 0.65 : 1 },
                ]}
                onPress={handleCreateRoom}
                disabled={creatingRoom}
              >
                <Text style={s.modalBtnConfirmText}>
                  {creatingRoom ? "생성 중…" : "만들기"}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 게시물 작성 모달 */}
      <Modal
        visible={writePostModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWritePostModalVisible(false)}
      >
        <View style={s.bottomSheetWrap}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setWritePostModalVisible(false)}
          />
          <View style={s.bottomSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>게시물 작성</Text>
            <TextInput
              style={s.postInput}
              value={newPostContent}
              onChangeText={setNewPostContent}
              placeholder="모임 멤버들에게 전할 내용을 작성하세요."
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={1000}
              selectionColor="#3B82F6"
            />
            <View style={{ paddingHorizontal: 16 }}>
              <TouchableOpacity
                style={[s.submitBtn, { opacity: submittingPost ? 0.65 : 1 }]}
                onPress={handleSubmitPost}
                disabled={submittingPost}
              >
                <Text style={s.submitBtnText}>
                  {submittingPost ? "등록 중…" : "게시물 등록"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 게시물 수정 모달 */}
      <Modal
        visible={editingPost !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingPost(null)}
      >
        <View style={s.bottomSheetWrap}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setEditingPost(null)}
          />
          <View style={s.bottomSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>게시물 수정</Text>
            <TextInput
              style={s.postInput}
              value={editPostContent}
              onChangeText={setEditPostContent}
              placeholder="내용을 입력하세요."
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={1000}
              selectionColor="#3B82F6"
              autoFocus
            />
            <View style={{ paddingHorizontal: 16 }}>
              <TouchableOpacity
                style={[s.submitBtn, { opacity: submittingEdit ? 0.65 : 1 }]}
                onPress={handleEditPost}
                disabled={submittingEdit}
              >
                <Text style={s.submitBtnText}>
                  {submittingEdit ? "수정 중…" : "수정 완료"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PostCard({
  post,
  myUuid,
  isAdmin,
  onEdit,
  onDelete,
}: {
  post: GroupPost;
  myUuid?: string;
  isAdmin: boolean;
  onEdit?: (post: GroupPost) => void;
  onDelete?: (post: GroupPost) => void;
}) {
  const isAuthor = post.authorUuid === myUuid;
  const canEdit = isAuthor;
  const canDelete = isAuthor || isAdmin;

  const time = new Date(post.createdAt).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });

  const showActions = () => {
    Alert.alert("게시물", undefined, [
      ...(canEdit ? [{ text: "수정", onPress: () => onEdit?.(post) }] : []),
      ...(canDelete
        ? [
            {
              text: "삭제",
              style: "destructive" as const,
              onPress: () => onDelete?.(post),
            },
          ]
        : []),
      { text: "취소", style: "cancel" as const },
    ]);
  };

  const avatarColor =
    AVATAR_COLORS[
      (post.authorNickname.charCodeAt(0) ?? 0) % AVATAR_COLORS.length
    ];

  return (
    <View style={s.feedCard}>
      <View style={s.feedCardHeader}>
        <View
          style={[
            s.feedAvatar,
            {
              backgroundColor: post.authorProfileImageUrl
                ? "#F1F5F9"
                : avatarColor,
            },
          ]}
        >
          {post.authorProfileImageUrl ? (
            <Image
              source={{ uri: post.authorProfileImageUrl }}
              style={{ width: 38, height: 38, borderRadius: 19 }}
            />
          ) : (
            <Text style={s.feedAvatarText}>
              {post.authorNickname[0]?.toUpperCase() ?? "?"}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.feedAuthor}>{post.authorNickname}</Text>
          <Text style={s.feedTime}>{time}</Text>
        </View>
        {(canEdit || canDelete) && (
          <TouchableOpacity
            onPress={showActions}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.moreBtn}
          >
            <Text style={s.moreBtnText}>•••</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.feedContent}>{post.content}</Text>
      {post.imageUrls.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 12 }}
        >
          {post.imageUrls.map((url, i) => (
            <Image
              key={i}
              source={{ uri: url }}
              style={{
                width: 120,
                height: 90,
                borderRadius: 12,
                marginRight: 8,
              }}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function RouteCard({ route }: { route: GroupRoute }) {
  return (
    <View style={[s.feedCard, { flexDirection: "row", gap: 14 }]}>
      <View style={s.routeThumb}>
        {route.thumbnail ? (
          <Image
            source={{ uri: route.thumbnail }}
            style={{ width: 68, height: 68 }}
          />
        ) : (
          <MapPin color="#94A3B8" size={24} />
        )}
      </View>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            marginBottom: 5,
          }}
        >
          <View style={s.routeRegionDot} />
          <Text style={s.routeRegion}>{route.region}</Text>
        </View>
        <Text style={s.routeTitle} numberOfLines={1}>
          {route.title}
        </Text>
        <Text style={s.routeMeta} numberOfLines={1}>
          {route.departure} → {route.arrival}
        </Text>
      </View>
    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#1E3A8A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7FF" },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 8,
  },
  headerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  headerAvatarImg: { width: 28, height: 28 },
  headerAvatarText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    ...cardShadow,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: "700", color: "#fff" },

  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "#3B82F6" },
  tabLabel: { fontSize: 13, fontWeight: "600", color: "#94A3B8" },
  tabLabelActive: { color: "#fff" },

  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  actionPillIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  actionPillText: { fontSize: 14, fontWeight: "600", color: "#3B82F6" },

  roomCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  roomIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  roomName: { flex: 1, fontSize: 15, fontWeight: "600", color: "#0F172A" },

  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  filterChipActive: { backgroundColor: "#3B82F6", borderColor: "#3B82F6" },
  filterLabel: { fontSize: 13, fontWeight: "600", color: "#94A3B8" },
  filterLabelActive: { color: "#fff" },

  feedCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  feedCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  feedAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  feedAvatarText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  feedAuthor: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  feedTime: { fontSize: 12, color: "#94A3B8", marginTop: 1 },
  feedContent: { fontSize: 14, color: "#334155", lineHeight: 22 },
  moreBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  moreBtnText: { fontSize: 14, color: "#94A3B8", letterSpacing: 1 },

  routeThumb: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  routeRegionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  routeRegion: { fontSize: 12, color: "#22C55E", fontWeight: "700" },
  routeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  routeMeta: { fontSize: 12, color: "#94A3B8" },

  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  infoAvatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 16,
  },
  infoAvatarText: { fontSize: 36, fontWeight: "800", color: "#fff" },
  infoName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  infoDesc: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 16,
  },
  infoStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#F8FAFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  infoStatItem: { alignItems: "center", gap: 3 },
  infoStatValue: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  infoStatLabel: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  infoStatSep: { width: 1, height: 28, backgroundColor: "#E2E8F0" },

  actionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#F1F5F9",
    marginHorizontal: 20,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 17,
    gap: 14,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#0F172A" },

  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 40,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F8FAFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#475569" },
  emptyDesc: { fontSize: 13, color: "#94A3B8" },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: 310,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
      },
      android: { elevation: 12 },
    }),
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: "#0F172A",
    marginBottom: 16,
    backgroundColor: "#F8FAFF",
  },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnCancel: { backgroundColor: "#F1F5F9" },
  modalBtnConfirm: { backgroundColor: "#3B82F6" },
  modalBtnCancelText: { fontSize: 15, fontWeight: "600", color: "#64748B" },
  modalBtnConfirmText: { fontSize: 15, fontWeight: "600", color: "#fff" },

  bottomSheetWrap: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 34,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  postInput: {
    minHeight: 130,
    marginHorizontal: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFF",
    marginBottom: 16,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  submitBtn: {
    backgroundColor: "#3B82F6",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  submitBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
