import React, { useState, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import {
  ChevronLeft,
  Edit2,
  MapPin,
  MessageCircle,
  MoreVertical,
  Navigation,
  Search,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { safeGoBack } from "@/navigation/rootNavigation";
import { RootStackParamList } from "@/App";
import { BubbleChat } from "@/stories/chat/BubbleChat";

// ── Types ──────────────────────────────────────────────────────────────────────

type RouteThread = {
  id: string;
  routeName: string;
  routeDescription: string;
  distance: string;
  lastMessage: string;
  lastMessageTime: string;
  participantCount: number;
  messageCount: number;
  accentColor: string;
};

type ThreadMessage = {
  id: string;
  content: string;
  senderName: string;
  isMine: boolean;
  sentAt: Date;
};

// ── Mock Data ──────────────────────────────────────────────────────────────────

const BASE_THREADS: RouteThread[] = [
  {
    id: "1",
    routeName: "한강 자전거 코스",
    routeDescription: "여의도 → 난지한강공원",
    distance: "20.3km",
    lastMessage: "다음 주말에 한번 더 달려봐요!",
    lastMessageTime: "오후 3:24",
    participantCount: 5,
    messageCount: 23,
    accentColor: "#0088FF",
  },
  {
    id: "2",
    routeName: "북한산 등산로",
    routeDescription: "우이동 → 백운대",
    distance: "8.1km",
    lastMessage: "경치가 진짜 최고였어요 ㅎㅎ",
    lastMessageTime: "오전 11:05",
    participantCount: 3,
    messageCount: 15,
    accentColor: "#34C759",
  },
  {
    id: "3",
    routeName: "남산 순환 산책로",
    routeDescription: "남산 N타워 → 백범광장",
    distance: "5.4km",
    lastMessage: "저녁에 야경 보면서 걸으니까 너무 좋다",
    lastMessageTime: "어제",
    participantCount: 4,
    messageCount: 31,
    accentColor: "#FF9500",
  },
  {
    id: "4",
    routeName: "청계천 걷기 코스",
    routeDescription: "광화문 → 성수동",
    distance: "11.2km",
    lastMessage: "중간에 카페 들렀는데 분위기 좋았어요",
    lastMessageTime: "어제",
    participantCount: 6,
    messageCount: 42,
    accentColor: "#5AC8FA",
  },
  {
    id: "5",
    routeName: "올림픽공원 5코스",
    routeDescription: "몽촌토성역 → 공원 순환",
    distance: "7.8km",
    lastMessage: "날씨 좋을 때 또 와야겠다",
    lastMessageTime: "2일 전",
    participantCount: 2,
    messageCount: 9,
    accentColor: "#FF3B30",
  },
  {
    id: "6",
    routeName: "인왕산 성곽길",
    routeDescription: "사직공원 → 창의문",
    distance: "6.0km",
    lastMessage: "서울 성곽 뷰가 역시 최고네요",
    lastMessageTime: "3일 전",
    participantCount: 3,
    messageCount: 17,
    accentColor: "#AF52DE",
  },
  {
    id: "7",
    routeName: "서울숲 달리기",
    routeDescription: "서울숲 공원 내부 순환",
    distance: "4.5km",
    lastMessage: "아침 러닝 인원 모집합니다~",
    lastMessageTime: "4일 전",
    participantCount: 8,
    messageCount: 56,
    accentColor: "#30D158",
  },
  {
    id: "8",
    routeName: "도봉산 다락능선",
    routeDescription: "도봉산역 → Y계곡",
    distance: "9.3km",
    lastMessage: "Y계곡 바위 타는 구간이 짜릿해요!",
    lastMessageTime: "5일 전",
    participantCount: 4,
    messageCount: 28,
    accentColor: "#FF6B35",
  },
  {
    id: "9",
    routeName: "수원 화성 둘레길",
    routeDescription: "장안문 → 팔달문 순환",
    distance: "5.7km",
    lastMessage: "역사 공부도 되고 운동도 되고 일석이조!",
    lastMessageTime: "6일 전",
    participantCount: 5,
    messageCount: 20,
    accentColor: "#E91E63",
  },
  {
    id: "10",
    routeName: "경복궁 주변 야간 산책",
    routeDescription: "경복궁 → 북촌 → 삼청동",
    distance: "3.2km",
    lastMessage: "밤에 경복궁 조명이 진짜 예뻐요",
    lastMessageTime: "1주 전",
    participantCount: 7,
    messageCount: 38,
    accentColor: "#9C27B0",
  },
];

const EXTRA_POOL: Array<{
  name: string;
  desc: string;
  dist: string;
  color: string;
}> = [
  {
    name: "망원 한강공원 피크닉",
    desc: "망원역 → 망원한강공원",
    dist: "2.1km",
    color: "#FF9500",
  },
  {
    name: "아차산 고구려 유적길",
    desc: "광나루역 → 아차산 정상",
    dist: "5.9km",
    color: "#34C759",
  },
  {
    name: "안산 자락길",
    desc: "독립문역 → 안산 순환",
    dist: "7.1km",
    color: "#0088FF",
  },
  {
    name: "불암산 둘레길",
    desc: "상계역 → 불암산 정상",
    dist: "6.8km",
    color: "#5AC8FA",
  },
  {
    name: "봉은사 → 선정릉 코스",
    desc: "강남 문화 역사 코스",
    dist: "3.5km",
    color: "#FF3B30",
  },
  {
    name: "관악산 연주대 코스",
    desc: "서울대입구역 → 연주대",
    dist: "8.7km",
    color: "#AF52DE",
  },
  {
    name: "광교호수공원 둘레길",
    desc: "광교역 → 호수 순환",
    dist: "10.2km",
    color: "#30D158",
  },
];

function generateExtraThreads(startIdx: number, count: number): RouteThread[] {
  return Array.from({ length: count }, (_, i) => {
    const base = EXTRA_POOL[(startIdx + i) % EXTRA_POOL.length];
    const weeksAgo = Math.floor((startIdx + i) / EXTRA_POOL.length) + 2;
    return {
      id: `extra-${startIdx + i}`,
      routeName: base.name,
      routeDescription: base.desc,
      distance: base.dist,
      lastMessage: "마지막 대화 내용이 여기 표시됩니다",
      lastMessageTime: `${weeksAgo}주 전`,
      participantCount: ((startIdx + i) % 5) + 2,
      messageCount: ((startIdx + i) % 20) + 5,
      accentColor: base.color,
    };
  });
}

const MOCK_MESSAGES: Record<string, ThreadMessage[]> = {
  "1": [
    {
      id: "m1",
      content: "오늘 한강 코스 어땠어요?",
      senderName: "김민준",
      isMine: false,
      sentAt: new Date("2026-05-25T10:00:00"),
    },
    {
      id: "m2",
      content: "너무 좋았어요! 날씨도 완벽하고",
      senderName: "나",
      isMine: true,
      sentAt: new Date("2026-05-25T10:01:00"),
    },
    {
      id: "m3",
      content: "여의도에서 난지까지 쉬지 않고 달렸네요 ㅎㅎ",
      senderName: "박서연",
      isMine: false,
      sentAt: new Date("2026-05-25T10:02:00"),
    },
    {
      id: "m4",
      content: "중간에 잠깐 쉬었는데요? ㅋㅋ",
      senderName: "나",
      isMine: true,
      sentAt: new Date("2026-05-25T10:03:00"),
    },
    {
      id: "m5",
      content: "아 맞다 편의점 들렀죠 ㅋㅋㅋ",
      senderName: "김민준",
      isMine: false,
      sentAt: new Date("2026-05-25T10:04:00"),
    },
    {
      id: "m6",
      content: "다음 주말에 한번 더 달려봐요!",
      senderName: "나",
      isMine: true,
      sentAt: new Date("2026-05-25T15:24:00"),
    },
  ],
  "2": [
    {
      id: "m1",
      content: "북한산 오늘 어땠나요?",
      senderName: "이지영",
      isMine: false,
      sentAt: new Date("2026-05-24T09:00:00"),
    },
    {
      id: "m2",
      content: "백운대까지 올라갔는데 경치 대박이에요",
      senderName: "나",
      isMine: true,
      sentAt: new Date("2026-05-24T09:05:00"),
    },
    {
      id: "m3",
      content: "사진 찍어놓은 거 나중에 공유해 줘요!",
      senderName: "이지영",
      isMine: false,
      sentAt: new Date("2026-05-24T09:08:00"),
    },
    {
      id: "m4",
      content: "경치가 진짜 최고였어요 ㅎㅎ",
      senderName: "이지영",
      isMine: false,
      sentAt: new Date("2026-05-24T11:05:00"),
    },
  ],
  "3": [
    {
      id: "m1",
      content: "남산 야경 보러 갔어요?",
      senderName: "최준혁",
      isMine: false,
      sentAt: new Date("2026-05-23T19:00:00"),
    },
    {
      id: "m2",
      content: "네! 저녁에 야경 보면서 걸으니까 너무 좋다",
      senderName: "나",
      isMine: true,
      sentAt: new Date("2026-05-23T19:30:00"),
    },
    {
      id: "m3",
      content: "N타워 불빛이 예쁘죠?",
      senderName: "정하은",
      isMine: false,
      sentAt: new Date("2026-05-23T19:35:00"),
    },
    {
      id: "m4",
      content: "완전요! 사진도 많이 찍었어요",
      senderName: "나",
      isMine: true,
      sentAt: new Date("2026-05-23T19:40:00"),
    },
  ],
  "4": [
    {
      id: "m1",
      content: "청계천 걷기 코스 오늘 다녀왔어요!",
      senderName: "강민서",
      isMine: false,
      sentAt: new Date("2026-05-22T14:00:00"),
    },
    {
      id: "m2",
      content: "어디까지 갔어요?",
      senderName: "나",
      isMine: true,
      sentAt: new Date("2026-05-22T14:05:00"),
    },
    {
      id: "m3",
      content: "광화문에서 시작해서 성수동까지요",
      senderName: "강민서",
      isMine: false,
      sentAt: new Date("2026-05-22T14:10:00"),
    },
    {
      id: "m4",
      content: "중간에 카페 들렀는데 분위기 좋았어요",
      senderName: "나",
      isMine: true,
      sentAt: new Date("2026-05-22T14:15:00"),
    },
    {
      id: "m5",
      content: "어디 카페요? 다음에 저도 가보고 싶어요",
      senderName: "강민서",
      isMine: false,
      sentAt: new Date("2026-05-22T14:20:00"),
    },
  ],
};

function getDefaultMessages(routeName: string): ThreadMessage[] {
  return [
    {
      id: "d1",
      content: `${routeName} 코스 다들 어떠셨나요?`,
      senderName: "멤버",
      isMine: false,
      sentAt: new Date("2026-05-20T09:00:00"),
    },
    {
      id: "d2",
      content: "너무 좋았어요! 다음에 또 가요",
      senderName: "나",
      isMine: true,
      sentAt: new Date("2026-05-20T09:10:00"),
    },
    {
      id: "d3",
      content: "저도 좋았습니다 ㅎㅎ",
      senderName: "멤버",
      isMine: false,
      sentAt: new Date("2026-05-20T09:15:00"),
    },
    {
      id: "d4",
      content: "다음엔 더 긴 코스 도전해볼까요?",
      senderName: "나",
      isMine: true,
      sentAt: new Date("2026-05-20T09:20:00"),
    },
  ];
}

// ── Component ──────────────────────────────────────────────────────────────────

export const ChatRouteHistory = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [threads, setThreads] = useState<RouteThread[]>(BASE_THREADS);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedThread, setSelectedThread] = useState<RouteThread | null>(
    null,
  );
  const loadCountRef = useRef(0);
  const MAX_LOADS = 4;
  const [menuThread, setMenuThread] = useState<RouteThread | null>(null);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    const nextBatch = generateExtraThreads(
      BASE_THREADS.length + loadCountRef.current * 5,
      5,
    );
    loadCountRef.current += 1;
    setThreads((prev) => [...prev, ...nextBatch]);
    if (loadCountRef.current >= MAX_LOADS) setHasMore(false);
    setLoadingMore(false);
  }, [loadingMore, hasMore]);

  // ── Thread detail view ───────────────────────────────────────────────────────

  if (selectedThread) {
    const messages =
      MOCK_MESSAGES[selectedThread.id] ??
      getDefaultMessages(selectedThread.routeName);

    return (
      <>
        <StatusBar style="dark" />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setSelectedThread(null)}
              style={styles.headerBtn}
            >
              <ChevronLeft size={28} color="#000" />
            </TouchableOpacity>
            <View style={styles.threadHeaderCenter}>
              <Text style={[styles.headerTitle, { flex: 0 }]} numberOfLines={1}>
                {selectedThread.routeName}
              </Text>
              <Text style={styles.threadHeaderSub}>
                {selectedThread.participantCount}명 · {selectedThread.distance}
              </Text>
            </View>
            <View style={styles.headerBtn} />
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 10,
              paddingVertical: 16,
            }}
          >
            {messages.map((msg) => (
              <BubbleChat
                key={msg.id}
                text={msg.content}
                isMine={msg.isMine}
                sentAt={msg.sentAt}
                userName={msg.senderName}
                showSender={!msg.isMine}
              />
            ))}
          </ScrollView>
        </View>
      </>
    );
  }

  // ── Thread list view ─────────────────────────────────────────────────────────

  return (
    <>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => safeGoBack(navigation)}
            style={styles.headerBtn}
          >
            <ChevronLeft size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>루트 목록</Text>
          <TouchableOpacity style={styles.headerBtn}>
            <Search size={22} color="#000" />
            {/* <Plus size={22} color="#000" style={{ marginLeft: 12 }} /> */}
          </TouchableOpacity>
        </View>

        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.threadItem}
              onPress={() => setSelectedThread(item)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.threadIcon,
                  { backgroundColor: item.accentColor },
                ]}
              >
                <MapPin size={18} color="#fff" />
              </View>

              <View style={styles.threadContent}>
                <View style={styles.threadTopRow}>
                  <Text style={styles.threadName} numberOfLines={1}>
                    {item.routeName}
                  </Text>
                  <Text style={styles.threadTime}>{item.lastMessageTime}</Text>
                </View>
                <Text style={styles.threadDesc} numberOfLines={1}>
                  {item.routeDescription} · {item.distance}
                </Text>
                <Text style={styles.threadLastMsg} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => setMenuThread(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MoreVertical size={20} color="#8E8E93" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" style={{ marginVertical: 16 }} />
            ) : null
          }
        />

        <Modal
          visible={menuThread !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setMenuThread(null)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMenuThread(null)}
          >
            <View
              style={styles.modalSheet}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.modalHandle} />
              {menuThread && (
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {menuThread.routeName}
                </Text>
              )}

              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  const t = menuThread;
                  setMenuThread(null);
                  if (t)
                    navigation.navigate("RouteCreate", { editRouteId: t.id });
                }}
              >
                <Edit2 size={20} color="#000" />
                <Text style={styles.modalItemText}>수정</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  const t = menuThread;
                  setMenuThread(null);
                  if (t)
                    navigation.navigate("CourseGuide", {
                      courseId: t.id,
                      courseTitle: t.routeName,
                    });
                }}
              >
                <Navigation size={20} color="#000" />
                <Text style={styles.modalItemText}>안내</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  const t = menuThread;
                  setMenuThread(null);
                  if (t) setSelectedThread(t);
                }}
              >
                <MessageCircle size={20} color="#000" />
                <Text style={styles.modalItemText}>채팅</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    height: 80,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  headerBtn: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
  threadHeaderCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  threadHeaderSub: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  threadItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  threadIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  threadContent: {
    flex: 1,
    gap: 3,
  },
  threadTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  threadName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  threadTime: {
    fontSize: 12,
    color: "#8E8E93",
    flexShrink: 0,
  },
  threadDesc: {
    fontSize: 12,
    color: "#8E8E93",
  },
  threadLastMsg: {
    fontSize: 13,
    color: "#3C3C43",
  },
  threadBadge: {
    backgroundColor: "#E5E5EA",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  threadBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3C3C43",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E5EA",
    marginLeft: 80,
  },
  moreBtn: {
    width: 36,
    height: 36,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexShrink: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end" as const,
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 34,
    paddingHorizontal: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E5EA",
    borderRadius: 2,
    alignSelf: "center" as const,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#000",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  modalItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 16,
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  modalItemText: {
    fontSize: 16,
    color: "#000",
  },
});
