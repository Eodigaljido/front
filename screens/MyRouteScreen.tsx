// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Image,
  FlatList,
  ImageBackground,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  COURSE_DETAIL_MAP_OVERVIEW_LEVEL,
  COURSE_DETAIL_MAP_STEP_FOCUS_ZOOM,
  computeMapRouteFit,
  focusMapOnCourseStep,
  getCourseMapCenter,
  getCourseMapCenterFromSteps,
  getCourseStepMapPoint,
  type CourseDetailMapFocus,
  type CourseItem,
} from "../data/mockData";
import { useRoute, useFocusEffect } from "@react-navigation/native";
import { useMockData } from "../context/MockDataContext";
import {
  deleteMyCourse,
  fetchMyCourses,
  unsaveSharedCourse,
  fetchMyRouteCollaborativeFlag,
  normalizeCourseList,
  resolveCourseDetailForRoute,
} from "../api/courses";
import { getChatRooms } from "../api/chat/chat";
import {
  UserSavedRoute,
  userRouteToCourseItem,
  userRouteMapCenter,
  userRouteMapPath,
} from "../data/userSavedRoute";
import AppMapView from "../components/AppMapView";
import { buildMapMarkersFromPathPoints } from "../utils/spreadMapMarkers";
import { simplifyRoutePath } from "../utils/simplifyRoutePath";
import FilterBottomSheet from "../components/FilterBottomSheet";
import { formatOverallDurationLabel } from "../utils/formatOverallDurationLabel";
import { resolveCourseRegionLabel } from "../utils/inferCourseRegionLabel";
import { shareCollaborativeRoute } from "../utils/shareCollaborativeRoute";
import { dedupeCoursesById, sameCourseId } from "../utils/sameCourseId";
import {
  getCourseAuthorLabel,
  getCourseModifierLabel,
  isOwnServerCourse,
} from "../utils/formatCourseAuthor";
import {
  CourseAuthorCardRow,
  CourseAuthorDetailChip,
} from "../components/CourseAuthorDisplay";
import {
  enrichCourseWithForkOriginAuthor,
  enrichCoursesWithForkOriginAuthors,
} from "../utils/enrichForkOriginAuthor";
import {
  applyCachedAuthorCredits,
  mergeCourseAuthorCredits,
} from "../utils/courseAuthorCredits";
import { useAuthStore } from "../store/authStore";
import {
  applyMineAuthorToPersonalRoutes,
  dedupeMyCourseList,
  mergeApiAndLocalCourseLists,
  mergeLocalCourseIntoApiCourse,
  resolveDetailCourseItem,
  collapseDuplicateEmptyDrafts,
} from "../utils/mergeCourseThumbnails";
import { rootNavigate } from "../navigation/rootNavigation";
import { CollaborativeMemberSummaryText } from "../components/CollaborativeMemberSummaryText";
import { presentCollaborativeShareOptions } from "../utils/shareCollaborativeRoute";
import { CollaborativeFriendInviteModal } from "../components/CollaborativeFriendInviteModal";
import { inviteFriendsToRouteChat } from "../data/routeCollaborativeChat";

type RouteKindFilter = "all" | "personal" | "collaborative";
const ROUTE_KIND_CHIPS: { key: RouteKindFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "personal", label: "개인" },
  { key: "collaborative", label: "공동" },
];
import {
  fetchMergedDirectionsPolyline,
  looksLikeStraightStopConnectorPath,
  resolveCoursePreviewDirectionsMode,
} from "../data/googleDirectionsApi";
import { useCourseStepWalkingSegments } from "../hooks/useCourseStepWalkingSegments";

const CARD_STYLE = {
  borderWidth: 0.5,
  borderColor: "rgba(37,99,235,0.12)",
  borderRadius: 16,
  backgroundColor: "#fff",
};

function CourseCard({
  item,
  onPressCard,
  onGuide,
  onRemove,
  onEdit,
  isFavorite,
  isCollaborative,
  chatRoomUuid,
  authorCtx,
}: {
  item: CourseItem;
  onPressCard: () => void;
  onGuide: () => void;
  onRemove: () => void;
  onEdit: () => void;
  isFavorite?: boolean;
  isCollaborative?: boolean;
  chatRoomUuid?: string | null;
  authorCtx: {
    myUuid?: string | null;
    myUserId?: string | null;
    myNickname?: string | null;
    isLocalOwnRoute?: boolean;
  };
}) {
  return (
    <View
      className="mx-4 mb-3 overflow-hidden bg-white rounded-2xl"
      style={CARD_STYLE}
    >
      <View className="flex-row border-b border-gray-100 p-3.5">
        <Pressable
          onPress={onPressCard}
          className="flex-row flex-1 min-w-0 active:opacity-95"
          accessibilityRole="button"
          accessibilityLabel={`${item.title} 코스 상세`}
        >
          <View className="h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl bg-blue-50">
            {item.thumbnail ? (
              <Image
                source={{ uri: item.thumbnail }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="items-center justify-center w-full h-full bg-blue-50">
                <Ionicons name="image-outline" size={24} color="#60a5fa" />
              </View>
            )}
          </View>
          <View className="justify-center flex-1 min-w-0 ml-3">
            <View className="flex-row flex-wrap items-start gap-1">
              {isCollaborative ? (
                <View className="mr-1 rounded-md bg-orange-100 px-1.5 py-0.5">
                  <Text className="text-[10px] font-bold text-orange-700">공동</Text>
                </View>
              ) : null}
              {isFavorite ? (
                <Ionicons
                  name="bookmark"
                  size={15}
                  color="#2563EB"
                  style={{ marginTop: 2 }}
                />
              ) : null}
              <Text
                className="flex-1 text-[15px] font-semibold leading-snug text-gray-900"
                numberOfLines={2}
              >
                {item.title}
              </Text>
            </View>
            {!isCollaborative ? (
              <CourseAuthorCardRow course={item} authorCtx={authorCtx} />
            ) : null}
            <Text className="mt-1 text-xs text-gray-500" numberOfLines={1}>
              {item.meta}
            </Text>
            {isCollaborative ? (
              <View className="mt-1.5 self-start rounded-md bg-orange-50 px-2 py-0.5">
                <CollaborativeMemberSummaryText
                  course={item}
                  routeId={String(item.id)}
                  chatRoomUuid={chatRoomUuid}
                  authorCtx={authorCtx}
                />
              </View>
            ) : null}
          </View>
        </Pressable>
        <View className="items-center justify-center pl-1 ml-1 shrink-0">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={onEdit} hitSlop={8} accessibilityLabel="수정">
              <Ionicons name="create-outline" size={20} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onRemove}
              className="ml-2"
              hitSlop={8}
              accessibilityLabel="삭제"
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
          <Pressable
            onPress={onPressCard}
            className="mt-2 active:opacity-70"
            hitSlop={8}
            accessibilityLabel="상세 보기"
          >
            <Ionicons name="chevron-forward" size={22} color="#9ca3af" />
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={onPressCard}
        className="flex-row items-center px-3.5 py-2.5 active:opacity-95"
        accessibilityRole="button"
        accessibilityLabel="출발·도착 보기"
      >
        <View className="px-2 py-1 bg-blue-600 rounded-md">
          <Text className="text-[11px] font-semibold text-white">출발</Text>
        </View>
        <Text className="ml-2 min-w-0 flex-1 text-[13px] text-gray-900" numberOfLines={1}>
          {item.departure}
        </Text>
        <View className="w-px h-3 mx-2 bg-gray-300" />
        <View className="px-2 py-1 rounded-md bg-slate-500">
          <Text className="text-[11px] font-semibold text-white">도착</Text>
        </View>
        <Text className="ml-2 min-w-0 flex-1 text-[13px] text-gray-900" numberOfLines={1}>
          {item.arrival}
        </Text>
      </Pressable>

      <View className="flex-row justify-end border-t border-gray-100 px-3.5 py-2">
        <Pressable
          onPress={onGuide}
          className="flex-row items-center rounded-lg bg-blue-50 px-3 py-1.5 active:opacity-85"
          accessibilityRole="button"
          accessibilityLabel="지도 안내"
        >
          <Ionicons name="map-outline" size={16} color="#2563eb" />
          <Text className="ml-1.5 text-xs font-semibold text-blue-600">안내</Text>
        </Pressable>
      </View>
    </View>
  );
}

function getUserRouteStepPoint(
  route: UserSavedRoute,
  stepIndex: number,
): { lat: number; lng: number } {
  const s = route.stops[stepIndex];
  if (s?.lat != null && s?.lng != null) return { lat: s.lat, lng: s.lng };
  return userRouteMapCenter(route);
}

const MY_ROUTE_DETAIL_SHEET_HEIGHT_KEY = "MY_ROUTE_DETAIL_SHEET_MAX_HEIGHT_PX";
const MY_ROUTE_WINDOW_H = Dimensions.get("window").height;
/** 시트를 화면 밖으로 밀어 닫을 때 이동 거리 */
const MY_ROUTE_SHEET_HIDE_Y = Math.ceil(MY_ROUTE_WINDOW_H + 120);

function pickViewingCourse(
  viewingCourseId: string,
  opts: {
    ur?: UserSavedRoute;
    myDetailCourseApi: CourseItem | null;
    courseFromDisplay?: CourseItem;
    viewingCourseSnapshot: CourseItem | null;
    courseFromApi?: CourseItem;
  },
): CourseItem | null {
  const {
    ur,
    myDetailCourseApi,
    courseFromDisplay,
    viewingCourseSnapshot,
    courseFromApi,
  } = opts;
  const raw =
    (myDetailCourseApi &&
    sameCourseId(myDetailCourseApi.id, viewingCourseId)
      ? myDetailCourseApi
      : null) ??
    courseFromDisplay ??
    (viewingCourseSnapshot &&
    sameCourseId(viewingCourseSnapshot.id, viewingCourseId)
      ? viewingCourseSnapshot
      : null) ??
    courseFromApi ??
    null;
  let course = resolveDetailCourseItem(raw, ur);
  if (
    course &&
    viewingCourseSnapshot &&
    sameCourseId(viewingCourseSnapshot.id, viewingCourseId)
  ) {
    course = mergeLocalCourseIntoApiCourse(course, viewingCourseSnapshot);
  }
  return course;
}

function clampMyRouteDetailSheetHeight(px: number): number {
  const minH = Math.round(MY_ROUTE_WINDOW_H * 0.45);
  const maxH = Math.round(MY_ROUTE_WINDOW_H * 0.94);
  return Math.min(Math.max(Math.round(px), minH), maxH);
}

type MyRouteParams = { viewCourseId?: string; section?: string };

type MyRouteScreenProps = {
  /** RouteScreen 탭 내부 — 상단 배너·SafeArea는 부모가 담당 */
  embedded?: boolean;
};

export default function MyRouteScreen({
  embedded = false,
}: MyRouteScreenProps = {}): React.JSX.Element {
  const route = useRoute();
  const myRouteParams = (route.params || {}) as MyRouteParams;
  const authUser = useAuthStore((s) => s.user);
  const authorCtx = useMemo(
    () => ({
      myUuid: authUser?.uuid,
      myUserId: authUser?.userId,
      myNickname: authUser?.nickname,
    }),
    [authUser?.uuid, authUser?.userId, authUser?.nickname],
  );
  const {
    favoriteCourseIds,
    removeSavedCourse,
    userSavedRoutes,
    deleteUserRoute,
    upsertUserRoute,
  } = useMockData();

  const [searchQuery, setSearchQuery] = useState("");
  const [apiMyCourses, setApiMyCourses] = useState<CourseItem[]>([]);
  const [enrichedMyCourses, setEnrichedMyCourses] = useState<CourseItem[]>([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<string | null>("즐겨찾기순");
  const [selectedRouteKind, setSelectedRouteKind] = useState<RouteKindFilter>("all");
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [collaborativeInviteModalOpen, setCollaborativeInviteModalOpen] = useState(false);
  const [inviteTargetRoute, setInviteTargetRoute] = useState<{ id: string; title: string } | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  /** 카드에서 연 상세 — 목록 재조회·id 타입 불일치 시에도 동일 코스 표시 */
  const [viewingCourseSnapshot, setViewingCourseSnapshot] =
    useState<CourseItem | null>(null);
  const [detailModalMounted, setDetailModalMounted] = useState(false);
  const detailBackdropOpacity = useRef(new Animated.Value(0)).current;
  const [detailSheetMaxHeightPx, setDetailSheetMaxHeightPx] = useState(() =>
    clampMyRouteDetailSheetHeight(MY_ROUTE_WINDOW_H * 0.82),
  );
  const sheetHeightRef = useRef(
    clampMyRouteDetailSheetHeight(MY_ROUTE_WINDOW_H * 0.82),
  );
  sheetHeightRef.current = detailSheetMaxHeightPx;
  const sheetPanStartHeight = useRef(0);
  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 0.55,
      onPanResponderGrant: () => {
        sheetPanStartHeight.current = sheetHeightRef.current;
      },
      onPanResponderMove: (_, g) => {
        setDetailSheetMaxHeightPx(
          clampMyRouteDetailSheetHeight(sheetPanStartHeight.current - g.dy),
        );
      },
      onPanResponderRelease: async (_, g) => {
        const next = clampMyRouteDetailSheetHeight(
          sheetPanStartHeight.current - g.dy,
        );
        setDetailSheetMaxHeightPx(next);
        try {
          await AsyncStorage.setItem(
            MY_ROUTE_DETAIL_SHEET_HEIGHT_KEY,
            String(next),
          );
        } catch {
          /* ignore */
        }
      },
    }),
  ).current;

  const detailSheetTranslateY = useRef(
    new Animated.Value(MY_ROUTE_SHEET_HIDE_Y),
  ).current;
  const viewingCourseIdRef = useRef<string | null>(null);
  viewingCourseIdRef.current = viewingCourseId;
  const [mapFocus, setMapFocus] = useState<CourseDetailMapFocus | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [detailMergedPath, setDetailMergedPath] = useState<
    { latitude: number; longitude: number }[] | null
  >(null);
  const [detailPathLoading, setDetailPathLoading] = useState(false);
  const [myDetailCourseApi, setMyDetailCourseApi] = useState<CourseItem | null>(null);
  const [myCourseDetailLoading, setMyCourseDetailLoading] = useState(false);

  const isCollaborativeRouteId = useCallback(
    (id: string) => {
      if (
        userSavedRoutes.some(
          (r) => sameCourseId(r.id, id) && r.collaborative === true,
        )
      ) {
        return true;
      }
      if (
        apiMyCourses.some(
          (c) => sameCourseId(c.id, id) && c.collaborative === true,
        )
      ) {
        return true;
      }
      return enrichedMyCourses.some(
        (c) => sameCourseId(c.id, id) && c.collaborative === true,
      );
    },
    [userSavedRoutes, apiMyCourses, enrichedMyCourses],
  );

  const mergedCourses = useMemo(() => {
    const fromUser = userSavedRoutes.map(userRouteToCourseItem);
    const apiTitles = new Set(
      apiMyCourses
        .map((c) => String(c.title ?? "").trim())
        .filter(Boolean),
    );
    const merged = mergeApiAndLocalCourseLists(apiMyCourses, fromUser);
    const filtered = merged.filter((c) => {
      const k = String(c.id ?? "");
      if (
        k.startsWith("ur-") &&
        apiTitles.has(String(c.title ?? "").trim())
      ) {
        return false;
      }
      return Boolean(k);
    });
    const deduped = dedupeMyCourseList(filtered, userSavedRoutes);
    return applyMineAuthorToPersonalRoutes(
      collapseDuplicateEmptyDrafts(deduped),
      userSavedRoutes,
      authorCtx,
    );
  }, [userSavedRoutes, apiMyCourses, authorCtx]);

  useEffect(() => {
    let cancelled = false;
    void enrichCoursesWithForkOriginAuthors(
      mergedCourses,
      userSavedRoutes,
    ).then((list) => {
      if (!cancelled) {
        setEnrichedMyCourses((prev) => mergeCourseAuthorCredits(list, prev));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mergedCourses, userSavedRoutes]);

  const displayCourses = useMemo(() => {
    const base =
      enrichedMyCourses.length > 0 ? enrichedMyCourses : mergedCourses;
    return applyCachedAuthorCredits(base);
  }, [enrichedMyCourses, mergedCourses]);

  const detailMapCourse = useMemo(() => {
    if (!viewingCourseId) return null;
    const ur = userSavedRoutes.find((r) =>
      sameCourseId(r.id, viewingCourseId),
    );
    const fromDisplay = displayCourses.find((c) =>
      sameCourseId(c.id, viewingCourseId),
    );
    const courseFromApi = apiMyCourses.find((c) =>
      sameCourseId(c.id, viewingCourseId),
    );
    return pickViewingCourse(viewingCourseId, {
      ur,
      myDetailCourseApi,
      courseFromDisplay: fromDisplay,
      viewingCourseSnapshot,
      courseFromApi,
    });
  }, [
    viewingCourseId,
    userSavedRoutes,
    apiMyCourses,
    myDetailCourseApi,
    viewingCourseSnapshot,
    displayCourses,
  ]);
  const detailMapStepPoints = useMemo(() => {
    if (!viewingCourseId || !detailMapCourse) return null;
    const ur = userSavedRoutes.find((r) =>
      sameCourseId(r.id, viewingCourseId),
    );
    if (ur && userRouteMapPath(ur).length >= 2) {
      return userRouteMapPath(ur);
    }
    const detailSteps = Array.isArray(detailMapCourse.routeSteps)
      ? detailMapCourse.routeSteps
      : [];
    if (detailSteps.length >= 2) {
      return detailSteps.map((step, i) => {
        if (step.lat != null && step.lng != null) {
          return { latitude: step.lat, longitude: step.lng };
        }
        const p = getCourseStepMapPoint(
          detailMapCourse.id,
          i,
          detailSteps.length,
        );
        return { latitude: p.lat, longitude: p.lng };
      });
    }
    return null;
  }, [viewingCourseId, detailMapCourse, userSavedRoutes]);
  const detailMapStepIds = useMemo(
    () => detailMapCourse?.routeSteps?.map((s) => s.id) ?? [],
    [detailMapCourse],
  );
  const { walkSegments: stepWalkSegments, walkLoading: stepWalkLoading } =
    useCourseStepWalkingSegments(
      detailMapStepPoints,
      selectedStepId,
      detailMapStepIds,
    );

  const reloadMyRoutesAndSharing = useCallback(async () => {
    try {
      const courses = await fetchMyCourses();
      setApiMyCourses(normalizeCourseList(courses));
    } catch {
      /* 네트워크 오류 시 목록을 비우면 서버 연동 판별이 깨짐 → 이전 상태 유지 */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadMyRoutesAndSharing();
    }, [reloadMyRoutesAndSharing]),
  );

  useEffect(() => {
    if (myRouteParams?.section === "shared") return;
    const vid = String(myRouteParams?.viewCourseId ?? "").trim();
    if (!vid) return;
    const fromUser = userSavedRoutes.find((r) => sameCourseId(r.id, vid));
    const fromApi = apiMyCourses.find((c) => sameCourseId(c.id, vid));
    const snap = fromUser
      ? userRouteToCourseItem(fromUser)
      : fromApi ?? null;
    if (snap) setViewingCourseSnapshot(snap);
    setViewingCourseId(vid);
  }, [myRouteParams?.section, myRouteParams?.viewCourseId, userSavedRoutes, apiMyCourses]);

  useEffect(() => {
    if (viewingCourseId) setDetailModalMounted(true);
  }, [viewingCourseId]);

  useEffect(() => {
    if (!(detailModalMounted && viewingCourseId)) return;
    detailSheetTranslateY.setValue(MY_ROUTE_SHEET_HIDE_Y);
    detailBackdropOpacity.setValue(0);
    const id = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(detailBackdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(detailSheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 9,
          tension: 68,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(id);
  }, [viewingCourseId, detailModalMounted]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(MY_ROUTE_DETAIL_SHEET_HEIGHT_KEY);
        if (cancelled || raw == null) return;
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        setDetailSheetMaxHeightPx(clampMyRouteDetailSheetHeight(n));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissCourseDetailImmediate = useCallback(() => {
    setViewingCourseId(null);
    setViewingCourseSnapshot(null);
    setDetailModalMounted(false);
    detailBackdropOpacity.setValue(0);
    detailSheetTranslateY.setValue(MY_ROUTE_SHEET_HIDE_Y);
  }, [detailBackdropOpacity, detailSheetTranslateY]);

  const closeCourseDetail = useCallback(
    (afterClose?: () => void) => {
      if (!viewingCourseIdRef.current) return;
      Animated.parallel([
        Animated.timing(detailBackdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(detailSheetTranslateY, {
          toValue: MY_ROUTE_SHEET_HIDE_Y,
          duration: 230,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setViewingCourseId(null);
          setViewingCourseSnapshot(null);
          setDetailModalMounted(false);
          afterClose?.();
        }
      });
    },
    [detailBackdropOpacity, detailSheetTranslateY],
  );

  useEffect(() => {
    if (!viewingCourseId) {
      setViewingCourseSnapshot(null);
      setMapFocus(null);
      setSelectedStepId(null);
      return;
    }
    const ur = userSavedRoutes.find((r) => sameCourseId(r.id, viewingCourseId));
    const courseFromApi = apiMyCourses.find((c) =>
      sameCourseId(c.id, viewingCourseId),
    );
    const courseForCenter = ur
      ? userRouteToCourseItem(ur)
      : courseFromApi ?? viewingCourseSnapshot;
    setMapFocus(
      courseForCenter
        ? {
            ...getCourseMapCenterFromSteps(courseForCenter),
            level: COURSE_DETAIL_MAP_OVERVIEW_LEVEL,
          }
        : {
            ...getCourseMapCenter(viewingCourseId),
            level: COURSE_DETAIL_MAP_OVERVIEW_LEVEL,
          },
    );
    setSelectedStepId(null);
  }, [viewingCourseId, userSavedRoutes, apiMyCourses, viewingCourseSnapshot]);

  useEffect(() => {
    if (!viewingCourseId) {
      setMyDetailCourseApi(null);
      setMyCourseDetailLoading(false);
      return;
    }
    // 로컬에만 있는 직접 제작 루트(UUID)는 서버에 없으므로 GET 하지 않음(404 방지)
    if (userSavedRoutes.some((r) => sameCourseId(r.id, viewingCourseId))) {
      setMyDetailCourseApi(null);
      setMyCourseDetailLoading(false);
      return;
    }
    let mounted = true;
    setMyCourseDetailLoading(true);
    resolveCourseDetailForRoute(viewingCourseId)
      .then(async ({ course }) => {
        if (!mounted) return;
        const enriched = await enrichCourseWithForkOriginAuthor(
          course,
          userSavedRoutes,
        );
        setMyDetailCourseApi(enriched ?? course ?? null);
        setMyCourseDetailLoading(false);
      })
      .catch(() => {
        if (mounted) setMyCourseDetailLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [viewingCourseId, userSavedRoutes]);

  useEffect(() => {
    if (!viewingCourseId) {
      setDetailMergedPath(null);
      setDetailPathLoading(false);
      return;
    }
    const ur = userSavedRoutes.find((r) => sameCourseId(r.id, viewingCourseId));
    const courseFromDisplay = displayCourses.find((c) =>
      sameCourseId(c.id, viewingCourseId),
    );
    const courseFromApi = apiMyCourses.find((c) =>
      sameCourseId(c.id, viewingCourseId),
    );
    const course = pickViewingCourse(viewingCourseId, {
      ur,
      myDetailCourseApi,
      courseFromDisplay,
      viewingCourseSnapshot,
      courseFromApi,
    });
    if (!course) {
      setDetailMergedPath(null);
      setDetailPathLoading(false);
      return;
    }

    let stepPoints: { latitude: number; longitude: number }[] = [];
    if (ur && userRouteMapPath(ur).length >= 2) {
      stepPoints = userRouteMapPath(ur);
    } else if (Array.isArray(course.routeSteps) && course.routeSteps.length >= 2) {
      stepPoints = course.routeSteps.map((step, i) => {
        if (step.lat != null && step.lng != null) {
          return { latitude: step.lat, longitude: step.lng };
        }
        const p = getCourseStepMapPoint(course.id, i, course.routeSteps.length);
        return { latitude: p.lat, longitude: p.lng };
      });
    } else {
      setDetailMergedPath(null);
      setDetailPathLoading(false);
      return;
    }

    const ac = new AbortController();
    setDetailPathLoading(true);
    setDetailMergedPath(null);
    const directionsMode = resolveCoursePreviewDirectionsMode(course.routeLegs);
    const loadMergedPath = (mode: typeof directionsMode) =>
      fetchMergedDirectionsPolyline({
        points: stepPoints,
        mode,
        signal: ac.signal,
      });

    loadMergedPath(directionsMode)
      .then(async (path) => {
        if (ac.signal.aborted) return;
        let final = path;
        if (
          looksLikeStraightStopConnectorPath(path, stepPoints.length) &&
          directionsMode === "transit"
        ) {
          final = await loadMergedPath("driving");
        }
        if (!ac.signal.aborted && final.length >= 2) setDetailMergedPath(final);
      })
      .catch(() => {})
      .finally(() => {
        if (!ac.signal.aborted) setDetailPathLoading(false);
      });

    return () => ac.abort();
  }, [
    viewingCourseId,
    userSavedRoutes,
    apiMyCourses,
    myDetailCourseApi,
    viewingCourseSnapshot,
    displayCourses,
  ]);

  const filteredCourses = useMemo(() => {
    let list = displayCourses;

    if (selectedCategory)
      list = list.filter((c) => c.category === selectedCategory);
    if (selectedRegion) list = list.filter((c) => c.region === selectedRegion);

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          String(c.title ?? "").toLowerCase().includes(q) ||
          String(c.meta ?? "").toLowerCase().includes(q) ||
          String(c.departure ?? "").toLowerCase().includes(q) ||
          String(c.arrival ?? "").toLowerCase().includes(q),
      );
    }

    if (selectedRouteKind === "personal") {
      list = list.filter((c) => !isCollaborativeRouteId(c.id));
    } else if (selectedRouteKind === "collaborative") {
      list = list.filter((c) => isCollaborativeRouteId(c.id));
    }

    if (selectedSort === "즐겨찾기순" || selectedSort === null) {
      const favRank = new Map(favoriteCourseIds.map((id, i) => [id, i]));
      list = [...list].sort((a, b) => {
        const ra = favRank.has(a.id) ? favRank.get(a.id) : 10_000;
        const rb = favRank.has(b.id) ? favRank.get(b.id) : 10_000;
        return ra - rb;
      });
    } else if (selectedSort === "인기순" || selectedSort === "조회순") {
      list = [...list].sort((a, b) => b.views - a.views);
    } else if (selectedSort === "최신순") {
      list = [...list].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    }

    return dedupeCoursesById(list);
  }, [
    displayCourses,
    searchQuery,
    selectedCategory,
    selectedRegion,
    selectedSort,
    favoriteCourseIds,
    selectedRouteKind,
    isCollaborativeRouteId,
  ]);

  const isUserSavedRouteId = (id: string) =>
    userSavedRoutes.some((r) => sameCourseId(r.id, id));

  const isServerBackedMyCourse = (id: string) =>
    apiMyCourses.some((c) => sameCourseId(c.id, id));

  const canEditAsOwnMyCourse = useCallback(
    (course: CourseItem) => {
      if (userSavedRoutes.some((r) => sameCourseId(r.id, course.id))) {
        return true;
      }
      const fromApi = apiMyCourses.find((c) => sameCourseId(c.id, course.id));
      if (!fromApi) return false;
      return isOwnServerCourse(course, authorCtx);
    },
    [apiMyCourses, authorCtx, userSavedRoutes],
  );

  const removeCourseFromUi = useCallback((courseId: string) => {
    setApiMyCourses((prev) => prev.filter((c) => !sameCourseId(c.id, courseId)));
    setEnrichedMyCourses((prev) =>
      prev.filter((c) => !sameCourseId(c.id, courseId)),
    );
    setViewingCourseSnapshot((prev) =>
      prev && sameCourseId(prev.id, courseId) ? null : prev,
    );
    setMyDetailCourseApi((prev) =>
      prev && sameCourseId(prev.id, courseId) ? null : prev,
    );
    if (sameCourseId(viewingCourseId, courseId)) {
      dismissCourseDetailImmediate();
    }
  }, [viewingCourseId]);

  const handleRemove = (item: CourseItem) => {
    Alert.alert(
      "저장 삭제",
      `"${item.title}" 코스를 저장 목록에서 삭제할까요?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            const prevApi = apiMyCourses;
            const prevEnriched = enrichedMyCourses;
            const prevSnapshot = viewingCourseSnapshot;
            const prevDetail = myDetailCourseApi;
            const prevViewingId = viewingCourseId;
            try {
              // 삭제 버튼 즉시 반영 (낙관적 UI)
              removeCourseFromUi(item.id);
              if (isUserSavedRouteId(item.id)) {
                // 기기에만 저장된 루트 — 서버 DELETE 호출 시 404
                deleteUserRoute(item.id);
              } else if (isOwnServerCourse(item, authorCtx)) {
                await deleteMyCourse(item.id);
              } else {
                // 공유 코스 북마크(내 루트 추가) — save 해제
                await unsaveSharedCourse(item.id);
              }
              removeSavedCourse(item.id);
            } catch {
              // 실패 시 UI 롤백
              setApiMyCourses(prevApi);
              setEnrichedMyCourses(prevEnriched);
              setViewingCourseSnapshot(prevSnapshot);
              setMyDetailCourseApi(prevDetail);
              if (prevViewingId) setViewingCourseId(prevViewingId);
              Alert.alert("오류", "코스 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.");
            }
          },
        },
      ],
    );
  };

  const openRouteCreateEdit = (routeId: string, collaborative: boolean) => {
    rootNavigate("RouteCreate", {
      editRouteId: routeId,
      collaborative,
    });
  };

  const openRouteCreateFromSharedCourse = (sharedCourseId: string) => {
    rootNavigate("RouteCreate", { seedSharedCourseId: sharedCourseId });
  };

  const handleCollaborativeInvite = async (friendUuids: string[]) => {
    if (!inviteTargetRoute || friendUuids.length === 0) return;
    const accessToken = useAuthStore.getState().accessToken;
    const myUuid = useAuthStore.getState().user?.uuid;
    if (!accessToken || !myUuid) {
      Alert.alert("오류", "인증 정보가 없습니다.");
      return;
    }

    setInviteSubmitting(true);
    try {
      console.log("[MyRouteScreen] 초대 대상 루트:", {
        id: inviteTargetRoute.id,
        title: inviteTargetRoute.title,
        friendUuids,
      });
      const ur = userSavedRoutes.find((r) =>
        sameCourseId(r.id, inviteTargetRoute.id)
      );

      // 기존 채팅방 UUID 찾기
      let existingChatRoomUuid = ur?.chatRoomUuid;

      // 1대1 채팅방이 없으면 채팅방 목록에서 1대1 채팅방 찾기
      if (!existingChatRoomUuid && friendUuids.length === 1) {
        try {
          console.log("[MyRouteScreen] 채팅방 목록 조회 시작");
          const chatRooms = await getChatRooms(accessToken);
          console.log("[MyRouteScreen] 전체 채팅방 수:", chatRooms.length);

          const friendUuid = friendUuids[0];
          console.log("[MyRouteScreen] 현재 사용자:", myUuid);
          console.log("[MyRouteScreen] 초대 대상 친구:", friendUuid);

          // 1대1 채팅방 찾기 (멤버수 2, 자신과 친구)
          const oneToOneRoom = chatRooms.find((room) => {
            console.log("[MyRouteScreen] 채팅방 확인:", {
              uuid: room.uuid,
              name: room.name,
              memberCount: room.memberCount,
              members: room.members?.map((m) => ({ uuid: m.uuid, nickname: m.nickname })),
            });

            if (room.memberCount !== 2) {
              console.log("[MyRouteScreen] → 멤버수 다름 (필요: 2, 실제: " + room.memberCount + ")");
              return false;
            }

            const members = room.members ?? [];
            const hasCurrentUser = members.some((m) => m.uuid === myUuid);
            const hasFriend = members.some((m) => m.uuid === friendUuid);

            console.log("[MyRouteScreen] → 멤버 확인:", {
              hasCurrentUser,
              hasFriend,
            });

            return hasCurrentUser && hasFriend;
          });

          if (oneToOneRoom) {
            existingChatRoomUuid = oneToOneRoom.uuid;
            console.log("[MyRouteScreen] ✓ 기존 1대1 채팅방 찾음:", oneToOneRoom.uuid);
          } else {
            console.log("[MyRouteScreen] ✗ 1대1 채팅방을 찾지 못함 → 새로운 채팅방 생성");
          }
        } catch (err) {
          console.error("[MyRouteScreen] 채팅방 목록 조회 실패:", err);
          // 실패해도 계속 진행 (새로운 채팅방 생성)
        }
      } else {
        console.log("[MyRouteScreen] 기존 chatRoomUuid가 있거나 친구 수가 1명이 아님:", {
          existingChatRoomUuid,
          friendCount: friendUuids.length,
        });
      }

      const result = await inviteFriendsToRouteChat({
        accessToken,
        myUuid,
        routeId: inviteTargetRoute.id,
        routeTitle: inviteTargetRoute.title,
        friendUuids,
        existingChatRoomUuid,
      });

      // 생성된 채팅방 uuid 로컬에 저장 (다음 초대 시 기존 방 재사용)
      if (result.chatRoomUuid && ur) {
        upsertUserRoute({
          ...ur,
          chatRoomUuid: result.chatRoomUuid,
        });
      }

      Alert.alert("완료", `${friendUuids.length}명에게 공동 루트 초대를 보냈습니다.`);
      setCollaborativeInviteModalOpen(false);
      setInviteTargetRoute(null);
      void reloadMyRoutesAndSharing();
    } catch (err) {
      console.error("공동 루트 초대 실패:", err);
      Alert.alert("오류", "초대를 보내는데 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const ScreenRoot = embedded ? View : SafeAreaView;
  const screenRootProps = embedded
    ? { className: "flex-1 bg-[#F0F5FF]" }
    : { className: "flex-1 bg-[#F0F5FF]", edges: ["top"] as const };

  return (
    <ScreenRoot {...screenRootProps}>
      {/* 검색 + 필터 — 배경과 분리된 카드형 검색바 */}
      <View
        className={`flex-row items-center gap-2.5 px-4 ${embedded ? 'pb-2 pt-1' : 'py-3'}`}
      >
        <View
          className="flex-1 flex-row items-center rounded-2xl bg-white px-3.5"
          style={{
            minHeight: 46,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: "rgba(37,99,235,0.22)",
            shadowColor: "#0f172a",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <View
            className="items-center justify-center mr-2 h-9 w-9 rounded-xl"
            style={{ backgroundColor: "rgba(37,99,235,0.08)" }}
          >
            <Ionicons name="search" size={20} color="#2563EB" />
          </View>
          <TextInput
            placeholder="코스명 · 출발/도착 · 지역 검색"
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-[15px] text-gray-900"
            style={{ paddingVertical: 2 }}
            clearButtonMode="while-editing"
          />
        </View>
        <TouchableOpacity
          onPress={() => setFilterVisible(true)}
          activeOpacity={0.85}
          accessibilityLabel="필터"
          className="items-center justify-center bg-white rounded-2xl"
          style={{
            width: 46,
            height: 46,
            borderWidth: 1,
            borderColor: "rgba(37,99,235,0.22)",
            shadowColor: "#0f172a",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <Ionicons name="options-outline" size={23} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <View className="flex-row gap-2 px-4 pb-1">
        {ROUTE_KIND_CHIPS.map((chip) => {
          const on = selectedRouteKind === chip.key;
          return (
            <Pressable
              key={chip.key}
              onPress={() => setSelectedRouteKind(chip.key)}
              className={`rounded-full px-3.5 py-1.5 border ${
                on ? "bg-blue-600 border-blue-600" : "bg-white border-blue-200"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${on ? "text-white" : "text-blue-700"}`}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 저장 코스 수 */}
      <View className="px-4 py-1.5">
        <Text className="text-sm text-gray-500">
          {filteredCourses.length}개의 코스를 저장했어요
        </Text>
      </View>

      {/* 코스 리스트 */}
      {filteredCourses.length === 0 ? (
        <View className="items-center justify-center flex-1 px-8">
          <View className="p-6 bg-gray-100 rounded-full">
            <Ionicons name="bookmark-outline" size={48} color="#9ca3af" />
          </View>
          <Text className="mt-4 text-lg font-semibold text-center text-gray-700">
            저장한 코스가 없습니다
          </Text>
          <Text className="mt-2 text-sm text-center text-gray-500">
            루트 제작에서 직접 저장하거나, 공유 루트에서 코스를 저장해 보세요.
          </Text>
        </View>
      ) : (
        <FlatList<CourseItem>
          data={filteredCourses ?? []}
          keyExtractor={(item, index) => `my-${item.id}-${index}`}
          renderItem={({ item }) => {
            const ur = userSavedRoutes.find((r) => sameCourseId(r.id, item.id));
            const cardAuthorCtx = {
              ...authorCtx,
              isLocalOwnRoute:
                Boolean(ur) && !String(ur?.forkedFromSharedId ?? "").trim(),
            };
            return (
              <CourseCard
                item={item}
                authorCtx={cardAuthorCtx}
                isFavorite={favoriteCourseIds.some((fid) =>
                  sameCourseId(fid, item.id),
                )}
                isCollaborative={
                  ur?.collaborative === true || item.collaborative === true
                }
                chatRoomUuid={ur?.chatRoomUuid}
                onPressCard={() => {
                  setViewingCourseSnapshot(item);
                  setViewingCourseId(String(item.id));
                }}
                onGuide={() => {
                  rootNavigate("CourseGuide", {
                    courseId: String(item.id),
                    courseTitle: item.title,
                  });
                }}
                onRemove={() => handleRemove(item)}
                onEdit={() => {
                  if (isUserSavedRouteId(item.id)) {
                    openRouteCreateEdit(item.id, ur?.collaborative === true);
                  } else if (
                    isServerBackedMyCourse(item.id) &&
                    canEditAsOwnMyCourse(item)
                  ) {
                    void fetchMyRouteCollaborativeFlag(item.id).then((collab) =>
                      openRouteCreateEdit(item.id, collab),
                    );
                  } else {
                    openRouteCreateFromSharedCourse(item.id);
                  }
                }}
              />
            );
          }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <FilterBottomSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        selectedCategory={selectedCategory}
        selectedRegion={selectedRegion}
        selectedSort={selectedSort}
        onCategoryToggle={(cat) =>
          setSelectedCategory((prev) => (prev === cat ? null : cat))
        }
        onRegionToggle={(region) =>
          setSelectedRegion((prev) => (prev === region ? null : region))
        }
        onSortToggle={(opt) =>
          setSelectedSort((prev) => (prev === opt ? null : opt))
        }
        onReset={() => {
          setSelectedCategory(null);
          setSelectedRegion(null);
          setSelectedSort("즐겨찾기순");
        }}
        onApply={() => {}}
      />

      {inviteTargetRoute && (
        <CollaborativeFriendInviteModal
          visible={collaborativeInviteModalOpen}
          onClose={() => {
            setCollaborativeInviteModalOpen(false);
            setInviteTargetRoute(null);
          }}
          accessToken={useAuthStore((s) => s.accessToken)}
          onConfirm={handleCollaborativeInvite}
          submitting={inviteSubmitting}
          routeName={inviteTargetRoute.title}
        />
      )}

      {/* 코스 상세 보기 모달 — 배경은 페이드, 시트만 슬라이드 (Modal slide는 백드롭까지 같이 움직임) */}
      <Modal
        visible={detailModalMounted}
        transparent
        animationType="none"
        onRequestClose={() => closeCourseDetail()}
      >
        <View style={{ flex: 1 }}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              { opacity: detailBackdropOpacity },
            ]}
          >
            <Pressable
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: "rgba(107,114,128,0.45)" },
              ]}
              onPress={() => closeCourseDetail()}
            />
          </Animated.View>

          <View
            style={{ flex: 1, justifyContent: "flex-end" }}
            pointerEvents="box-none"
          >
            <Animated.View
              style={{
                width: "100%",
                height: detailSheetMaxHeightPx,
                maxHeight: clampMyRouteDetailSheetHeight(MY_ROUTE_WINDOW_H * 0.94),
                transform: [{ translateY: detailSheetTranslateY }],
              }}
            >
              <View
                className="flex-1 overflow-hidden rounded-t-3xl"
                style={{
                  height: "100%",
                  backgroundColor: "#F8FBFF",
                }}
              >
              {viewingCourseId &&
                (() => {
                  const ur = userSavedRoutes.find((r) =>
                    sameCourseId(r.id, viewingCourseId),
                  );
                  const courseFromDisplay = displayCourses.find((c) =>
                    sameCourseId(c.id, viewingCourseId),
                  );
                  const courseFromApi = apiMyCourses.find((c) =>
                    sameCourseId(c.id, viewingCourseId),
                  );
                  const course = pickViewingCourse(viewingCourseId, {
                    ur,
                    myDetailCourseApi,
                    courseFromDisplay,
                    viewingCourseSnapshot,
                    courseFromApi,
                  });
                  if (!course) {
                    return (
                      <View
                        style={{
                          paddingVertical: 40,
                          paddingHorizontal: 24,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {myCourseDetailLoading ? (
                          <>
                            <ActivityIndicator size="large" color="#2563EB" />
                            <Text className="mt-4 text-sm text-gray-600">
                              코스 정보를 불러오는 중…
                            </Text>
                          </>
                        ) : (
                          <Text className="text-sm text-center text-gray-600">
                            코스 정보를 불러올 수 없습니다.
                          </Text>
                        )}
                        <TouchableOpacity
                          onPress={() => closeCourseDetail()}
                          className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5"
                        >
                          <Text className="text-sm font-semibold text-white">
                            닫기
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  const detailIsCollaborative =
                    ur?.collaborative === true || course.collaborative === true;
                  const detailAuthorCtx = {
                    ...authorCtx,
                    isLocalOwnRoute:
                      Boolean(ur) &&
                      !String(ur?.forkedFromSharedId ?? "").trim(),
                  };

                  const mapBlockHeight = Math.min(
                    240,
                    Math.max(110, Math.floor(detailSheetMaxHeightPx * 0.3)),
                  );
                  const routeSteps = Array.isArray(course.routeSteps)
                    ? course.routeSteps
                    : [];
                  const midStepNames = routeSteps
                    .slice(1, -1)
                    .map((s) => String(s?.name ?? "").trim())
                    .filter(Boolean);
                  const regionChip =
                    resolveCourseRegionLabel(
                      course.region,
                      course.departure,
                      course.arrival,
                      midStepNames,
                    ) || null;
                  let pathPts:
                    | { latitude: number; longitude: number }[]
                    | undefined;
                  if (ur && userRouteMapPath(ur).length >= 1) {
                    pathPts = userRouteMapPath(ur).map((p) => ({
                      latitude: p.latitude,
                      longitude: p.longitude,
                    }));
                  } else if (routeSteps.length >= 1) {
                    pathPts = routeSteps.map((step, i) => {
                      if (step.lat != null && step.lng != null) {
                        return { latitude: step.lat, longitude: step.lng };
                      }
                      const p = getCourseStepMapPoint(
                        course.id,
                        i,
                        routeSteps.length,
                      );
                      return { latitude: p.lat, longitude: p.lng };
                    });
                  } else {
                    pathPts = undefined;
                  }
                  const mapMarkers =
                    pathPts && pathPts.length >= 1
                      ? buildMapMarkersFromPathPoints(pathPts)
                      : undefined;
                  // 실경로만 표시 (실패 시 정류장 직선 연결·부채꼴 방지)
                  const polylinePath = simplifyRoutePath(
                    detailMergedPath && detailMergedPath.length >= 2
                      ? detailMergedPath
                      : undefined,
                  );
                  const fallbackCenter = ur
                    ? userRouteMapCenter(ur)
                    : getCourseMapCenter(course.id);
                  const stepMapFocused = Boolean(selectedStepId);
                  const showWalkOnMap =
                    stepMapFocused &&
                    Boolean(stepWalkSegments && stepWalkSegments.length > 0);
                  const fitPathForCamera =
                    showWalkOnMap && stepWalkSegments?.length
                      ? stepWalkSegments.flatMap((s) => s.points)
                      : detailMergedPath && detailMergedPath.length >= 2
                        ? detailMergedPath
                        : pathPts;
                  const mapRouteFit = computeMapRouteFit(
                    fitPathForCamera ?? [],
                    stepMapFocused
                      ? {
                          maxZoom: COURSE_DETAIL_MAP_STEP_FOCUS_ZOOM,
                          paddingZoomOut: 0.5,
                        }
                      : { minZoom: 10, maxZoom: 16, paddingZoomOut: 0.9 },
                  );
                  const mapCenter =
                    stepMapFocused && mapFocus
                      ? mapFocus
                      : mapRouteFit
                        ? { lat: mapRouteFit.lat, lng: mapRouteFit.lng }
                        : mapFocus ?? fallbackCenter;
                  const mapZoom = mapRouteFit?.zoom;
                  const mapFitToRoute = !mapRouteFit;

                  return (
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          backgroundColor: "#EEF5FF",
                          paddingTop: 14,
                          paddingBottom: 14,
                          borderTopLeftRadius: 24,
                          borderTopRightRadius: 24,
                          overflow: "hidden",
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: "rgba(37,99,235,0.15)",
                        }}
                      >
                        <View className="flex-row items-center justify-between px-4 mb-2">
                          <Text className="text-sm font-semibold text-[#1A1A2E]">
                            코스 위치
                          </Text>
                          <TouchableOpacity
                            onPress={() => closeCourseDetail()}
                            hitSlop={12}
                          >
                            <Ionicons name="close" size={26} color="#64748b" />
                          </TouchableOpacity>
                        </View>
                        <View
                          style={{
                            height: mapBlockHeight,
                            marginHorizontal: 10,
                            borderRadius: 14,
                            overflow: "hidden",
                            backgroundColor: "#dbeafe",
                            borderWidth: 1,
                            borderColor: "#bfdbfe",
                            position: "relative",
                          }}
                        >
                          <AppMapView
                            key={
                              ur
                                ? `ur-${ur.id}-${mapZoom ?? "f"}-${polylinePath?.length ?? 0}-${detailMergedPath?.length ?? 0}-${stepMapFocused ? "step" : "route"}-${selectedStepId ?? "all"}`
                                : `mc-${course.id}-${mapZoom ?? "f"}-${polylinePath?.length ?? 0}-${detailMergedPath?.length ?? 0}-${stepMapFocused ? "step" : "route"}-${selectedStepId ?? "all"}`
                            }
                            latitude={mapCenter.lat}
                            longitude={mapCenter.lng}
                            level={8}
                            zoom={mapZoom}
                            fitToRoute={mapFitToRoute}
                            path={
                              !showWalkOnMap &&
                              polylinePath &&
                              polylinePath.length >= 1
                                ? polylinePath
                                : undefined
                            }
                            segments={
                              showWalkOnMap ? stepWalkSegments : undefined
                            }
                            stops={
                              !showWalkOnMap &&
                              polylinePath &&
                              polylinePath.length >= 1
                                ? polylinePath
                                : undefined
                            }
                            markers={mapMarkers}
                            style={{ width: "100%", height: mapBlockHeight }}
                          />
                          {(detailPathLoading ||
                            (stepMapFocused && stepWalkLoading)) ? (
                            <View
                              style={{
                                position: "absolute",
                                right: 10,
                                top: 10,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 10,
                                backgroundColor: "rgba(255,255,255,0.92)",
                              }}
                            >
                              <ActivityIndicator size="small" color="#2563eb" />
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: "#2563eb",
                                  fontWeight: "600",
                                }}
                              >
                                {stepMapFocused && stepWalkLoading
                                  ? "도보 경로 불러오는 중"
                                  : "경로 반영 중"}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>


                      <ScrollView
                        showsVerticalScrollIndicator={false}
                        className="flex-1 bg-white"
                        style={{ flexGrow: 1 }}
                        contentContainerStyle={{
                          paddingHorizontal: 20,
                          paddingTop: 16,
                          paddingBottom: 28,
                        }}
                      >
                        <View className="flex-row items-center justify-between mb-4">
                          <Text className="text-xl font-bold text-gray-900">
                            코스 상세
                          </Text>
                          <View className="flex-row flex-wrap items-center justify-end gap-2">
                            {ur?.collaborative === true ? (
                              <TouchableOpacity
                                onPress={() => {
                                  presentCollaborativeShareOptions({
                                    routeId: String(course.id),
                                    title: course.title,
                                    onInviteFriends: () => {
                                      setInviteTargetRoute({
                                        id: String(course.id),
                                        title: course.title,
                                      });
                                      setCollaborativeInviteModalOpen(true);
                                    },
                                  });
                                }}
                                className="flex-row items-center gap-1 px-3 py-2 rounded-xl bg-orange-50"
                              >
                                <Ionicons
                                  name="share-social-outline"
                                  size={16}
                                  color="#ea580c"
                                />
                                <Text className="text-sm font-semibold text-orange-600">
                                  초대
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                              onPress={() => {
                                closeCourseDetail(() => {
                                  if (ur) {
                                    openRouteCreateEdit(
                                      ur.id,
                                      ur.collaborative === true,
                                    );
                                  } else if (
                                    isServerBackedMyCourse(course.id) &&
                                    canEditAsOwnMyCourse(course)
                                  ) {
                                    openRouteCreateEdit(course.id, false);
                                  } else {
                                    openRouteCreateFromSharedCourse(course.id);
                                  }
                                });
                              }}
                              className="flex-row items-center gap-1 px-3 py-2 rounded-xl bg-blue-50"
                            >
                              <Ionicons
                                name="create-outline"
                                size={16}
                                color="#2563eb"
                              />
                              <Text className="text-sm font-semibold text-blue-600">
                                수정
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                closeCourseDetail(() => handleRemove(course));
                              }}
                              className="flex-row items-center gap-1 px-3 py-2 rounded-xl bg-red-50"
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color="#ef4444"
                              />
                              <Text className="text-sm font-semibold text-red-500">
                                저장 삭제
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <Text className="mb-1 text-base font-semibold text-gray-900">
                          {course.title}
                        </Text>
                        {!detailIsCollaborative ? (
                          <CourseAuthorDetailChip
                            course={course}
                            authorCtx={detailAuthorCtx}
                            onPressCreator={() => {
                              const authorLabel = getCourseAuthorLabel(
                                course,
                                detailAuthorCtx,
                              );
                              const authorUuid = String(
                                course.authorUuid ?? "",
                              ).trim();
                              const authorUserId = String(
                                course.authorUserId ?? "",
                              ).trim();
                              rootNavigate("UserProfile", {
                                userUuid: authorUuid || undefined,
                                userId: authorUserId || undefined,
                                nickname:
                                  authorLabel.startsWith("@") ||
                                  authorLabel === "제작자 미표시"
                                    ? undefined
                                    : authorLabel,
                              });
                            }}
                            onPressModifier={() => {
                              const modLabel = getCourseModifierLabel(
                                course,
                                authorCtx,
                              );
                              const modUuid = String(
                                course.modifierUuid ?? "",
                              ).trim();
                              const modUserId = String(
                                course.modifierUserId ?? "",
                              ).trim();
                              rootNavigate("UserProfile", {
                                userUuid: modUuid || undefined,
                                userId: modUserId || undefined,
                                nickname:
                                  modLabel.startsWith("@") ||
                                  modLabel === "수정자 미표시"
                                    ? undefined
                                    : modLabel,
                              });
                            }}
                          />
                        ) : null}
                        {Array.isArray(course.tags) && course.tags.length > 0 ? (
                          <View className="mb-2 flex-row flex-wrap gap-1.5">
                            {course.tags.slice(0, 2).map((tag) => (
                              <View
                                key={String(tag)}
                                className="rounded-full bg-indigo-50 px-2.5 py-0.5"
                              >
                                <Text className="text-xs font-medium text-indigo-800">{tag}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text className="mb-2 text-xs text-gray-500">
                            선택된 태그가 없어요
                          </Text>
                        )}

                        <View className="flex-row flex-wrap items-center gap-2 mb-3">
                          {regionChip ? (
                            <View className="px-3 py-1 rounded-full bg-slate-100">
                              <Text className="text-xs font-medium text-slate-700">{regionChip}</Text>
                            </View>
                          ) : null}
                          <View className="px-3 py-1 rounded-full bg-blue-50">
                            <Text className="text-xs text-blue-700">
                              예상 소요{" "}
                              {formatOverallDurationLabel(
                                course.overallDurationMinutes,
                              )}
                            </Text>
                          </View>
                          <View className="px-3 py-1 rounded-full bg-yellow-50">
                            <Text className="text-xs text-yellow-700">
                              ★ {course.rating.toFixed(1)} ({course.reviewCount}
                              명)
                            </Text>
                          </View>
                        </View>

                        {detailIsCollaborative ? (
                          <View className="mb-3 self-start rounded-md bg-orange-50 px-2.5 py-1">
                            <CollaborativeMemberSummaryText
                              course={course}
                              routeId={String(course.id)}
                              chatRoomUuid={ur?.chatRoomUuid}
                              authorCtx={detailAuthorCtx}
                              className="text-[11px] font-semibold text-orange-700"
                              numberOfLines={3}
                            />
                          </View>
                        ) : null}

                        <View className="p-3 mb-6 rounded-xl bg-gray-50">
                          <View className="flex-row items-center">
                            <View className="px-2 py-1 bg-green-100 rounded">
                              <Text className="text-xs font-medium text-green-700">
                                출발
                              </Text>
                            </View>
                            <Text className="flex-1 ml-2 text-sm text-gray-900">
                              {course.departure}
                            </Text>
                          </View>
                          <View className="flex-row items-center mt-2">
                            <View className="px-2 py-1 bg-red-100 rounded">
                              <Text className="text-xs font-medium text-red-700">
                                도착
                              </Text>
                            </View>
                            <Text className="flex-1 ml-2 text-sm text-gray-900">
                              {course.arrival}
                            </Text>
                          </View>
                        </View>

                        <Text className="mb-2 text-sm font-semibold text-gray-900">
                          코스 경로
                        </Text>
                        <View className="p-3 mb-6 rounded-xl bg-gray-50">
                          {routeSteps.map((step, index) => (
                            <TouchableOpacity
                              key={step.id}
                              onPress={() => {
                                if (selectedStepId === step.id) {
                                  setSelectedStepId(null);
                                  setMapFocus({
                                    ...getCourseMapCenterFromSteps(course),
                                    level: COURSE_DETAIL_MAP_OVERVIEW_LEVEL,
                                  });
                                  return;
                                }
                                if (ur) {
                                  const p = getUserRouteStepPoint(ur, index);
                                  setMapFocus({ lat: p.lat, lng: p.lng });
                                } else {
                                  setMapFocus(
                                    focusMapOnCourseStep(
                                      step,
                                      course.id,
                                      index,
                                      routeSteps.length,
                                    ),
                                  );
                                }
                                setSelectedStepId(step.id);
                              }}
                              className="flex-row items-start py-1.5"
                              style={[
                                index > 0
                                  ? {
                                      borderTopWidth: 1,
                                      borderTopColor: "#e5e7eb",
                                    }
                                  : null,
                                selectedStepId === step.id
                                  ? {
                                      backgroundColor: "rgba(59,130,246,0.08)",
                                      borderRadius: 8,
                                    }
                                  : null,
                              ]}
                            >
                              <Text className="mt-0.5 w-5 text-xs font-semibold text-gray-500">
                                {index + 1}.
                              </Text>
                              <View className="flex-1">
                                <Text className="text-sm font-medium text-gray-900">
                                  {step.name}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  );
                })()}
              </View>
            </Animated.View>
          </View>
        </View>
      </Modal>
    </ScreenRoot>
  );
}
