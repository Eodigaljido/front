import { createContext, useContext } from 'react';

export type RouteSection = 'shared' | 'my';

type RouteScreenContextValue = {
  section: RouteSection;
  setSection: (section: RouteSection) => void;
};

export const RouteScreenContext = createContext<RouteScreenContextValue | null>(
  null,
);

export function useRouteSection(): RouteScreenContextValue | null {
  return useContext(RouteScreenContext);
}
