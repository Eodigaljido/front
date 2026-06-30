import { create } from "zustand";
import {
  bootstrapHomeWeather,
  type HomeWeatherBootstrap,
} from "../utils/bootstrapHomeWeather";
import type { IntegratedWeatherResponse } from "../data/integratedWeatherApi";

type HomeBootstrapState = {
  integrated: IntegratedWeatherResponse | null;
  heroLocationLabel: string;
  weatherLocation: string;
  weatherError: string | null;
  isBootstrapped: boolean;
  applyBootstrap: (result: HomeWeatherBootstrap) => void;
  bootstrap: (options?: { force?: boolean }) => Promise<void>;
  reset: () => void;
};

const initialState = {
  integrated: null,
  heroLocationLabel: "",
  weatherLocation: "",
  weatherError: null,
  isBootstrapped: false,
} satisfies Omit<HomeBootstrapState, "applyBootstrap" | "bootstrap" | "reset">;

export const useHomeBootstrapStore = create<HomeBootstrapState>((set, get) => ({
  ...initialState,
  applyBootstrap: (result) =>
    set({
      integrated: result.integrated,
      heroLocationLabel: result.heroLocationLabel,
      weatherLocation: result.weatherLocation,
      weatherError: result.weatherError,
      isBootstrapped: true,
    }),
  bootstrap: async (options) => {
    if (get().isBootstrapped && !options?.force) return;
    const result = await bootstrapHomeWeather();
    get().applyBootstrap(result);
  },
  reset: () => set({ ...initialState }),
}));
