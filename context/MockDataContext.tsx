// @ts-nocheck
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { UserSavedRoute } from '../data/userSavedRoute';

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
};

const MockDataContext = createContext<MockDataContextValue | null>(null);

const MOCK_PUBLIC_IDS = ['1', '2', '4', '5', '6'];

export function MockDataProvider({ children }: { children: React.ReactNode }) {
  const [savedCourseIds, setSavedCourseIds] = useState<string[]>(['1', '3']);
  const [userSavedRoutes, setUserSavedRoutes] = useState<UserSavedRoute[]>([]);

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

  const value: MockDataContextValue = {
    savedCourseIds,
    addSavedCourse,
    removeSavedCourse,
    publicCourseIds: MOCK_PUBLIC_IDS,
    userSavedRoutes,
    upsertUserRoute,
    deleteUserRoute,
    getUserRoute,
  };

  return (
    <MockDataContext.Provider value={value}>
      {children}
    </MockDataContext.Provider>
  );
}

export function useMockData() {
  const ctx = useContext(MockDataContext);
  if (!ctx) throw new Error('useMockData must be used within MockDataProvider');
  return ctx;
}
