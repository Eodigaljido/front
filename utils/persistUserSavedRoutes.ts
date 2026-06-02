import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UserSavedRoute } from "../data/userSavedRoute";

const KEY_PREFIX = "@capstone/userSavedRoutes/v1";

function storageKey(userUuid: string): string {
  return `${KEY_PREFIX}:${String(userUuid ?? "").trim()}`;
}

export async function loadUserSavedRoutes(
  userUuid: string,
): Promise<UserSavedRoute[]> {
  const uuid = String(userUuid ?? "").trim();
  if (!uuid) return [];
  try {
    const raw = await AsyncStorage.getItem(storageKey(uuid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UserSavedRoute[]) : [];
  } catch {
    return [];
  }
}

export async function saveUserSavedRoutes(
  userUuid: string,
  routes: UserSavedRoute[],
): Promise<void> {
  const uuid = String(userUuid ?? "").trim();
  if (!uuid) return;
  await AsyncStorage.setItem(storageKey(uuid), JSON.stringify(routes));
}

export async function clearUserSavedRoutes(userUuid: string): Promise<void> {
  const uuid = String(userUuid ?? "").trim();
  if (!uuid) return;
  await AsyncStorage.removeItem(storageKey(uuid));
}
