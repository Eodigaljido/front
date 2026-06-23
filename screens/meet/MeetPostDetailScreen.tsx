import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { ChevronLeft, Pencil, Trash2, X } from "lucide-react-native";

import { RootStackParamList } from "@/App";
import { safeGoBack } from "@/navigation/rootNavigation";
import { useAuthStore } from "@/store/authStore";

import { getGroup } from "@/api/meet/groups";
import {
  getGroupPostDetail,
  updateGroupPost,
  deleteGroupPost,
} from "@/api/meet/posts";
import type { GroupPost } from "@/api/meet/types";

type DetailRouteProp = RouteProp<RootStackParamList, "MeetPostDetail">;

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const IMG_W = SCREEN_W - 32;

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

export default function MeetPostDetailScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<DetailRouteProp>();
  const { groupUuid, postUuid } = route.params;

  const accessToken = useAuthStore((s) => s.accessToken) ?? "";
  const myUuid = useAuthStore((s) => s.user?.uuid);

  const [post, setPost] = useState<GroupPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const p = await getGroupPostDetail(accessToken, groupUuid, postUuid);
      setPost(p);
      setNotFound(false);
    } catch (err: any) {
      if (err?.response?.status === 404) setNotFound(true);
      else Alert.alert("오류", "게시물을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, groupUuid, postUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  // 방장 여부 확인 (삭제 권한 판단용)
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const g = await getGroup(groupUuid);
        if (alive) setIsAdmin(g.adminUuid === myUuid);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [groupUuid, myUuid]);

  const isAuthor = post?.authorUuid === myUuid;
  const canEdit = isAuthor;
  const canDelete = isAuthor || isAdmin;

  const handleEdit = async () => {
    if (!post) return;
    const title = editTitle.trim();
    const content = editContent.trim();
    if (!title || !content) return;
    setSubmittingEdit(true);
    try {
      const updated = await updateGroupPost(accessToken, post.uuid, {
        title,
        content,
      });
      setPost(updated);
      setEditing(false);
    } catch {
      Alert.alert("오류", "게시물 수정에 실패했습니다.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!post || deleting) return;
    setDeleting(true);
    try {
      await deleteGroupPost(accessToken, groupUuid, post.uuid);
      setDeleteVisible(false);
      navigation.goBack();
    } catch {
      setDeleteVisible(false);
      Alert.alert("오류", "게시물 삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const time = post
    ? new Date(post.createdAt).toLocaleString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const edited =
    post && post.updatedAt && post.updatedAt !== post.createdAt;

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={s.backBtn}
          onPress={() => safeGoBack(navigation)}
        >
          <ChevronLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Text style={s.headerTitle} pointerEvents="none">
          게시물
        </Text>
        <View style={s.headerActions}>
          {canEdit && (
            <TouchableOpacity
              activeOpacity={0.7}
              style={s.headerIconBtn}
              onPress={() => {
                if (!post) return;
                setEditTitle(post.title);
                setEditContent(post.content);
                setEditing(true);
              }}
            >
              <Pencil color="#475569" size={18} />
            </TouchableOpacity>
          )}
          {canDelete && (
            <TouchableOpacity
              activeOpacity={0.7}
              style={s.headerIconBtn}
              onPress={() => setDeleteVisible(true)}
            >
              <Trash2 color="#EF4444" size={18} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : notFound || !post ? (
        <View style={s.loadingWrap}>
          <Text style={s.emptyTitle}>게시물을 찾을 수 없어요</Text>
          <Text style={s.emptyDesc}>삭제되었거나 접근할 수 없는 게시물이에요.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.authorRow}>
            <View
              style={[
                s.avatar,
                {
                  backgroundColor: post.authorProfileImageUrl
                    ? "#F1F5F9"
                    : getAvatarColor(post.authorNickname),
                },
              ]}
            >
              {post.authorProfileImageUrl ? (
                <Image
                  source={{ uri: post.authorProfileImageUrl }}
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                />
              ) : (
                <Text style={s.avatarText}>
                  {post.authorNickname[0]?.toUpperCase() ?? "?"}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.author}>{post.authorNickname}</Text>
              <Text style={s.time}>
                {time}
                {edited ? " · 수정됨" : ""}
              </Text>
            </View>
          </View>

          {post.title ? <Text style={s.title}>{post.title}</Text> : null}
          <Text style={s.content}>{post.content}</Text>

          {post.imageUrls.length > 0 && (
            <ImageCarousel urls={post.imageUrls} onOpen={setViewerIndex} />
          )}
        </ScrollView>
      )}

      {/* 게시물 수정 모달 */}
      <CenteredModal visible={editing} onClose={() => setEditing(false)}>
        <Text style={s.modalTitle}>게시물 수정</Text>
        <TextInput
          style={s.modalInput}
          value={editTitle}
          onChangeText={setEditTitle}
          placeholder="제목"
          placeholderTextColor="#94A3B8"
          maxLength={100}
          selectionColor="#3B82F6"
        />
        <TextInput
          style={s.modalTextArea}
          value={editContent}
          onChangeText={setEditContent}
          placeholder="내용을 입력하세요."
          placeholderTextColor="#94A3B8"
          multiline
          maxLength={1000}
          selectionColor="#3B82F6"
          textAlignVertical="top"
        />
        <View style={s.modalBtns}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[s.modalBtn, s.modalBtnCancel]}
            onPress={() => setEditing(false)}
          >
            <Text style={s.modalBtnCancelText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              s.modalBtn,
              s.modalBtnConfirm,
              { opacity: submittingEdit ? 0.65 : 1 },
            ]}
            onPress={handleEdit}
            disabled={submittingEdit}
          >
            <Text style={s.modalBtnConfirmText}>
              {submittingEdit ? "수정 중…" : "수정"}
            </Text>
          </TouchableOpacity>
        </View>
      </CenteredModal>

      {/* 게시물 삭제 확인 모달 */}
      <CenteredModal
        visible={deleteVisible}
        onClose={() => !deleting && setDeleteVisible(false)}
      >
        <View style={s.confirmIconWrap}>
          <Trash2 color="#EF4444" size={22} />
        </View>
        <Text style={s.confirmTitle}>게시물 삭제</Text>
        <Text style={s.confirmMessage}>
          이 게시물을 삭제할까요?{"\n"}삭제하면 되돌릴 수 없어요.
        </Text>
        <View style={s.modalBtns}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[s.modalBtn, s.modalBtnCancel]}
            onPress={() => setDeleteVisible(false)}
            disabled={deleting}
          >
            <Text style={s.modalBtnCancelText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              s.modalBtn,
              s.modalBtnDanger,
              { opacity: deleting ? 0.65 : 1 },
            ]}
            onPress={confirmDelete}
            disabled={deleting}
          >
            <Text style={s.modalBtnDangerText}>
              {deleting ? "삭제 중…" : "삭제"}
            </Text>
          </TouchableOpacity>
        </View>
      </CenteredModal>

      {/* 이미지 확대 뷰어 */}
      <ImageZoomViewer
        urls={post?.imageUrls ?? []}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </SafeAreaView>
  );
}

/**
 * 단일 이미지 — 핀치 줌 + 더블탭 토글 + 확대 시 드래그 이동.
 * 확대 상태에서는 탭으로 닫히지 않고, 부모에 zoom 상태를 알려 페이지 스와이프를 막는다.
 */
function ZoomableImage({
  uri,
  active,
  onClose,
  onZoomChange,
  onPaginate,
}: {
  uri: string;
  active: boolean;
  onClose: () => void;
  onZoomChange: (zoomed: boolean) => void;
  onPaginate: (dir: 1 | -1) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  // 좌우 엣지에서 더 끈 오버스크롤 양 (페이지 전환 판정용)
  const overX = useSharedValue(0);
  // 제스처 시작 시 이미 좌/우 엣지에 있었는지 (엣지에서 한 번 멈춘 뒤 전환되게)
  const beganRight = useSharedValue(false);
  const beganLeft = useSharedValue(false);
  const zoomedRef = useRef(false);
  // pan 활성화/스와이프 제어용 (리렌더 트리거)
  const [isZoomed, setIsZoomed] = useState(false);
  const markZoom = (v: boolean) => {
    zoomedRef.current = v;
    setIsZoomed(v);
    onZoomChange(v);
  };

  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
    runOnJS(markZoom)(false);
  };

  // 다른 페이지로 넘어가면 줌·이동 초기화
  useEffect(() => {
    if (!active) {
      scale.value = 1;
      savedScale.value = 1;
      tx.value = 0;
      ty.value = 0;
      savedTx.value = 0;
      savedTy.value = 0;
      zoomedRef.current = false;
      setIsZoomed(false);
    }
  }, [active, scale, savedScale, tx, ty, savedTx, savedTy]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 4);
    })
    .onEnd(() => {
      if (scale.value <= 1) reset();
      else {
        savedScale.value = scale.value;
        const maxX = (SCREEN_W * (scale.value - 1)) / 2;
        const maxY = (SCREEN_H * (scale.value - 1)) / 2;
        const clampedX = Math.min(Math.max(tx.value, -maxX), maxX);
        const clampedY = Math.min(Math.max(ty.value, -maxY), maxY);
        tx.value = withTiming(clampedX);
        ty.value = withTiming(clampedY);
        savedTx.value = clampedX;
        savedTy.value = clampedY;
        runOnJS(markZoom)(true);
      }
    });

  // 확대 상태에서만 이동 허용 — 경계 내로 제한, 엣지 초과분은 overX 로 누적
  const PAGE_THRESHOLD = 70;
  const EDGE_EPS = 1;
  const pan = Gesture.Pan()
    .enabled(isZoomed)
    .onStart(() => {
      // 제스처 시작 시점에 이미 엣지에 닿아 있었는지 기록
      const maxX = (SCREEN_W * (scale.value - 1)) / 2;
      beganRight.value = savedTx.value <= -maxX + EDGE_EPS;
      beganLeft.value = savedTx.value >= maxX - EDGE_EPS;
    })
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      const maxX = (SCREEN_W * (scale.value - 1)) / 2;
      const maxY = (SCREEN_H * (scale.value - 1)) / 2;
      const desiredX = savedTx.value + e.translationX;
      const clampedX = Math.min(Math.max(desiredX, -maxX), maxX);
      tx.value = clampedX;
      overX.value = desiredX - clampedX; // 오른쪽 끝 초과면 음수, 왼쪽 끝 초과면 양수
      ty.value = Math.min(
        Math.max(savedTy.value + e.translationY, -maxY),
        maxY,
      );
    })
    .onEnd(() => {
      // 이미 엣지에서 시작한 스와이프가 그 방향으로 더 끌렸을 때만 전환
      // (중앙에서 한 번에 세게 끌면 엣지에서 멈추고, 다시 끌어야 넘어감)
      if (beganRight.value && overX.value <= -PAGE_THRESHOLD) {
        runOnJS(onPaginate)(1);
      } else if (beganLeft.value && overX.value >= PAGE_THRESHOLD) {
        runOnJS(onPaginate)(-1);
      }
      overX.value = 0;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) reset();
      else {
        scale.value = withTiming(2);
        savedScale.value = 2;
        runOnJS(markZoom)(true);
      }
    });

  // 확대 상태가 아닐 때만 탭으로 닫기
  const handleSingleTap = () => {
    if (!zoomedRef.current) onClose();
  };
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(handleSingleTap)();
    });

  // pan/pinch 가 활성화되면 tap 은 취소(Race) → 스와이프 중 탭(닫기) 오발동 방지
  const composed = Gesture.Race(
    Gesture.Simultaneous(pinch, pan),
    Gesture.Exclusive(doubleTap, singleTap),
  );

  const imgStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Reanimated.View style={s.viewerPage}>
        <Reanimated.Image
          source={{ uri }}
          style={[s.viewerImg, imgStyle]}
          resizeMode="contain"
        />
      </Reanimated.View>
    </GestureDetector>
  );
}

function ImageZoomViewer({
  urls,
  index,
  onClose,
}: {
  urls: string[];
  index: number | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  // 확대 상태면 페이지 스와이프를 막아 드래그 이동과 충돌 방지
  const [zoomed, setZoomed] = useState(false);

  // 열릴 때 탭한 사진 위치로 점프
  useEffect(() => {
    if (index !== null) {
      setActive(index);
      setZoomed(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ x: index * SCREEN_W, animated: false }),
      );
    }
  }, [index]);

  // 확대 상태에서 엣지 오버스크롤 시 페이지 전환
  const goTo = (dir: 1 | -1) => {
    setActive((prev) => {
      const next = Math.min(Math.max(prev + dir, 0), urls.length - 1);
      if (next !== prev) {
        setZoomed(false);
        requestAnimationFrame(() =>
          scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true }),
        );
      }
      return next;
    });
  };

  return (
    <Modal
      visible={index !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={s.viewerRoot}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            setActive(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
            setZoomed(false);
          }}
        >
          {urls.map((u, i) => (
            <ZoomableImage
              key={u}
              uri={u}
              active={i === active}
              onClose={onClose}
              onZoomChange={setZoomed}
              onPaginate={goTo}
            />
          ))}
        </ScrollView>
        {urls.length > 1 && (
          <View style={[s.viewerDots, { bottom: insets.bottom + 16 }]}>
            {urls.map((u, i) => (
              <View
                key={u}
                style={[
                  s.dot,
                  i === active ? s.dotActive : s.dotInactive,
                ]}
              />
            ))}
          </View>
        )}
        <TouchableOpacity
          style={[s.viewerClose, { top: insets.top + 8 }]}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X color="#fff" size={24} />
        </TouchableOpacity>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ImageCarousel({
  urls,
  onOpen,
}: {
  urls: string[];
  onOpen: (index: number) => void;
}) {
  const [index, setIndex] = useState(0);

  if (urls.length === 1) {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => onOpen(0)}>
        <Image
          source={{ uri: urls[0] }}
          style={[s.carouselImg, { width: IMG_W }]}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.carousel}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / IMG_W);
          if (i !== index) setIndex(i);
        }}
        scrollEventThrottle={16}
      >
        {urls.map((url, i) => (
          <TouchableOpacity
            key={url}
            activeOpacity={0.9}
            onPress={() => onOpen(i)}
          >
            <Image
              source={{ uri: url }}
              style={[s.carouselImg, { width: IMG_W }]}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={s.dots}>
        {urls.map((url, i) => (
          <View
            key={url}
            style={[s.dot, i === index ? s.dotActive : s.dotInactive]}
          />
        ))}
      </View>
    </View>
  );
}

function CenteredModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [translateY] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    const screenH = Dimensions.get("window").height;
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      const kbHeight = e.endCoordinates?.height ?? 0;
      Animated.timing(translateY, {
        toValue: -Math.max(0, kbHeight / 2 - 40),
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
      translateY.setValue(0);
    };
  }, [visible, translateY]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <Animated.View style={{ transform: [{ translateY }] }}>
          <TouchableOpacity activeOpacity={1} style={s.modalCard}>
            {children}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
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
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    padding: 24,
  },

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
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerIconBtn: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarText: { fontSize: 17, fontWeight: "800", color: "#fff" },
  author: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  time: { fontSize: 12, color: "#94A3B8", marginTop: 2 },

  title: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  content: {
    fontSize: 15,
    lineHeight: 24,
    color: "#334155",
    marginBottom: 16,
  },
  carousel: { marginBottom: 4 },
  carouselImg: {
    height: IMG_W,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  viewerRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)" },
  viewerPage: {
    width: SCREEN_W,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImg: { width: SCREEN_W, height: "100%" },
  viewerDots: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  viewerClose: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },

  dot: { borderRadius: 4 },
  dotActive: { width: 8, height: 8, backgroundColor: "#3B82F6" },
  dotInactive: { width: 6, height: 6, backgroundColor: "#CBD5E1" },

  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#475569" },
  emptyDesc: { fontSize: 13, color: "#94A3B8", textAlign: "center" },

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
    marginBottom: 12,
    backgroundColor: "#F8FAFF",
  },
  modalTextArea: {
    minHeight: 100,
    maxHeight: 180,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#0F172A",
    marginBottom: 16,
    backgroundColor: "#F8FAFF",
    textAlignVertical: "top",
  },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  modalBtnCancel: { backgroundColor: "#F1F5F9" },
  modalBtnConfirm: { backgroundColor: "#3B82F6" },
  modalBtnDanger: { backgroundColor: "#EF4444" },
  modalBtnCancelText: { fontSize: 15, fontWeight: "600", color: "#64748B" },
  modalBtnConfirmText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  modalBtnDangerText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  confirmIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },
});
