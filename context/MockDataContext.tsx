// @ts-nocheck
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import type { UserSavedRoute } from '../data/userSavedRoute';
import type { CourseReview } from '../data/mockData';
import { fetchMySavedCourseIds } from '../api/courses';
import { useAuthStore } from '../store/authStore';
import {
  loadUserSavedRoutes,
  saveUserSavedRoutes,
} from '../utils/persistUserSavedRoutes';

type MockDataContextValue = {
  savedCourseIds: string[];
  /** 메인 인기 코스에서 즐겨찾기한 공유 코스 id 순서(앞일수록 상단) */
  favoriteCourseIds: string[];
  addSavedCourse: (id: string) => void;
  removeSavedCourse: (id: string) => void;
  /** 인기 코스 북마크 토글 → 내 루트 저장 목록·즐겨찾기 순서에 반영 */
  togglePopularFavorite: (courseId: string) => void;
  /** 서버 저장 목록과 동기화 (홈·공유 탭 진입 시) */
  refreshSavedCourseIds: () => Promise<void>;
  /** 서버 공개 코스 id (로컬 목록 없음) */
  publicCourseIds: string[];
  /** 루트 제작에서 저장한 로컬 루트 (기기·세션) */
  userSavedRoutes: UserSavedRoute[];
  upsertUserRoute: (route: UserSavedRoute) => void;
  deleteUserRoute: (id: string) => void;
  getUserRoute: (id: string) => UserSavedRoute | undefined;
  /** 공유 코스에 이용자가 추가한 후기 (세션·목 저장) */
  extraSharedCourseReviews: Record<string, CourseReview[]>;
  addSharedCourseReview: (
    courseId: string,
    payload: { userName: string; rating: number; text: string },
  ) => void;
};

const MockDataContext = createContext<MockDataContextValue | null>(null);

const EMPTY_PUBLIC_IDS: string[] = [];

export function MockDataProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [savedCourseIds, setSavedCourseIds] = useState<string[]>([]);
  const [favoriteCourseIds, setFavoriteCourseIds] = useState<string[]>([]);
  const savedCourseIdsRef = useRef(savedCourseIds);
  useEffect(() => {
    savedCourseIdsRef.current = savedCourseIds;
  }, [savedCourseIds]);

  const [userSavedRoutes, setUserSavedRoutes] = useState<UserSavedRoute[]>([]);
  const [userRoutesHydrated, setUserRoutesHydrated] = useState(false);
  const userUuid = useAuthStore((s) => s.user?.uuid);
  const [extraSharedCourseReviews, setExtraSharedCourseReviews] = useState<
    Record<string, CourseReview[]>
  >({});

  const addSavedCourse = useCallback((id: string) => {
    setSavedCourseIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeSavedCourse = useCallback((id: string) => {
    setSavedCourseIds((prev) => prev.filter((x) => x !== id));
    setFavoriteCourseIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const togglePopularFavorite = useCallback((courseId: string) => {
    const wasSaved = savedCourseIdsRef.current.includes(courseId);
    if (wasSaved) {
      setSavedCourseIds((s) => s.filter((x) => x !== courseId));
      setFavoriteCourseIds((f) => f.filter((x) => x !== courseId));
    } else {
      setSavedCourseIds((s) => (s.includes(courseId) ? s : [...s, courseId]));
      setFavoriteCourseIds((f) => [courseId, ...f.filter((x) => x !== courseId)]);
    }
  }, []);

  const refreshSavedCourseIds = useCallback(async () => {
    if (!useAuthStore.getState().isAuthenticated) return;
    const ids = await fetchMySavedCourseIds();
    setSavedCourseIds((prev) => Array.from(new Set([...ids, ...prev])));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setSavedCourseIds([]);
      setFavoriteCourseIds([]);
      setUserSavedRoutes([]);
      setUserRoutesHydrated(false);
      return;
    }
    void refreshSavedCourseIds();
  }, [isAuthenticated, refreshSavedCourseIds]);

  useEffect(() => {
    if (!isAuthenticated || !userUuid) {
      setUserSavedRoutes([]);
      setUserRoutesHydrated(false);
      return;
    }
    let cancelled = false;
    setUserRoutesHydrated(false);
    void loadUserSavedRoutes(userUuid).then((routes) => {
      if (cancelled) return;
      setUserSavedRoutes(routes);
      setUserRoutesHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userUuid]);

  useEffect(() => {
    if (!isAuthenticated || !userUuid || !userRoutesHydrated) return;
    void saveUserSavedRoutes(userUuid, userSavedRoutes);
  }, [userSavedRoutes, isAuthenticated, userUuid, userRoutesHydrated]);

  const upsertUserRoute = useCallback((route: UserSavedRoute) => {
    setUserSavedRoutes((prev) => {
      const rid = String(route.id ?? "").trim();
      const i = prev.findIndex((x) => String(x.id) === rid);
      let next: UserSavedRoute[];
      if (i >= 0) {
        next = [...prev];
        next[i] = route;
      } else {
        next = [...prev, route];
      }
      if (rid && !rid.startsWith("ur-")) {
        const title = String(route.title ?? "").trim();
        next = next.filter(
          (r) =>
            String(r.id) === rid ||
            !(
              String(r.id).startsWith("ur-") &&
              String(r.title ?? "").trim() === title
            ),
        );
      }
      return next;
    });
  }, []);

  const deleteUserRoute = useCallback((id: string) => {
    setUserSavedRoutes((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const getUserRoute = useCallback(
    (id: string) => userSavedRoutes.find((r) => r.id === id),
    [userSavedRoutes],
  );

  const addSharedCourseReview = useCallback(
    (
      courseId: string,
      payload: { userName: string; rating: number; text: string },
    ) => {
      const name = payload.userName.trim() || "익명";
      const text = payload.text.trim();
      if (!text) return;
      const rating = Math.min(5, Math.max(1, Number(payload.rating) || 5));
      const id = `sr-${courseId}-${Date.now()}`;
      const date = new Date().toISOString().slice(0, 10);
      const review: CourseReview = { id, userName: name, rating, text, date };
      setExtraSharedCourseReviews((prev) => ({
        ...prev,
        [courseId]: [...(prev[courseId] ?? []), review],
      }));
    },
    [],
  );

  // value 객체를 useMemo로 안정화 — 실제로 변한 state만 소비자 리렌더를 유발
  const value = useMemo<MockDataContextValue>(
    () => ({
      savedCourseIds,
      favoriteCourseIds,
      addSavedCourse,
      removeSavedCourse,
      togglePopularFavorite,
      refreshSavedCourseIds,
      publicCourseIds: EMPTY_PUBLIC_IDS,
      userSavedRoutes,
      upsertUserRoute,
      deleteUserRoute,
      getUserRoute,
      extraSharedCourseReviews,
      addSharedCourseReview,
    }),
    [
      savedCourseIds,
      favoriteCourseIds,
      userSavedRoutes,
      extraSharedCourseReviews,
      getUserRoute,
    ],
  );

  return (
    <MockDataContext.Provider value={value}>
      {children}
    </MockDataContext.Provider>
  );
}

export function useMockData() {
  const ctx = useContext(MockDataContext);
  if (!ctx) throw new Error("useMockData must be used within MockDataProvider");
  return ctx;
}
