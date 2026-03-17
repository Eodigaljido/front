// @ts-nocheck
import React, { createContext, useContext, useState, useCallback } from 'react';

type MockDataContextValue = {
  savedCourseIds: string[];
  addSavedCourse: (id: string) => void;
  removeSavedCourse: (id: string) => void;
  /** 공개한 코스 목 mock id (7개 등) */
  publicCourseIds: string[];
};

const MockDataContext = createContext<MockDataContextValue | null>(null);

const MOCK_PUBLIC_IDS = ['1', '2', '4', '5', '6'];

export function MockDataProvider({ children }: { children: React.ReactNode }) {
  const [savedCourseIds, setSavedCourseIds] = useState<string[]>(['1', '3']);

  const addSavedCourse = useCallback((id: string) => {
    setSavedCourseIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeSavedCourse = useCallback((id: string) => {
    setSavedCourseIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const value: MockDataContextValue = {
    savedCourseIds,
    addSavedCourse,
    removeSavedCourse,
    publicCourseIds: MOCK_PUBLIC_IDS,
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
