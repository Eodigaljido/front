import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'route_chat_sync_banner_dismissed_v1';

type DismissMap = Record<string, true>;

function dismissKey(userUuid: string, roomUuid: string): string {
  return `${String(userUuid).trim()}:${String(roomUuid).trim()}`;
}

async function readMap(): Promise<DismissMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as DismissMap;
  } catch {
    return {};
  }
}

export async function isRouteChatSyncBannerDismissed(
  userUuid: string,
  roomUuid: string,
): Promise<boolean> {
  const user = String(userUuid ?? '').trim();
  const room = String(roomUuid ?? '').trim();
  if (!user || !room) return false;
  const map = await readMap();
  return map[dismissKey(user, room)] === true;
}

export async function dismissRouteChatSyncBanner(
  userUuid: string,
  roomUuid: string,
): Promise<void> {
  const user = String(userUuid ?? '').trim();
  const room = String(roomUuid ?? '').trim();
  if (!user || !room) return;
  const map = await readMap();
  map[dismissKey(user, room)] = true;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
