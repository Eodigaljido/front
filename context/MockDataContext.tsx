// @ts-nocheck
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { UserSavedRoute } from '../data/userSavedRoute';
import type { CourseReview } from '../data/mockData';

type MockDataContextValue = {
  savedCourseIds: string[];
  addSavedCourse: (id: string) => void;
  removeSavedCourse: (id: string) => void;
  /** 공개한 코스 목 mock id (7개 등) */
  publicCourseIds: string[];
  /** 루트 제작에서 저장한 목 루트 */
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

const MOCK_PUBLIC_IDS = ["1", "2", "4", "5", "6"];

export function MockDataProvider({ children }: { children: React.ReactNode }) {
  const [savedCourseIds, setSavedCourseIds] = useState<string[]>(["1", "3"]);
  const [userSavedRoutes, setUserSavedRoutes] = useState<UserSavedRoute[]>([]);
  const [extraSharedCourseReviews, setExtraSharedCourseReviews] = useState<
    Record<string, CourseReview[]>
  >({});

  const addSavedCourse = useCallback((id: string) => {
    setSavedCourseIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeSavedCourse = useCallback((id: string) => {
    setSavedCourseIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const upsertUserRoute = useCallback((route: UserSavedRoute) => {
    setUserSavedRoutes((prev) => {
      const i = prev.findIndex((x) => x.id === route.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = route;
        return next;
      }
      return [...prev, route];
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
      addSavedCourse,
      removeSavedCourse,
      publicCourseIds: MOCK_PUBLIC_IDS,
      userSavedRoutes,
      upsertUserRoute,
      deleteUserRoute,
      getUserRoute,
      extraSharedCourseReviews,
      addSharedCourseReview,
    }),
    [savedCourseIds, userSavedRoutes, extraSharedCourseReviews, getUserRoute],
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
