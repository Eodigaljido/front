import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  NavigationProp,
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import { ChevronLeft, Lock, Search, Users } from "lucide-react-native";

import { RootStackParamList } from "@/App";
import { safeGoBack } from "@/navigation/rootNavigation";
import { getMyGroups } from "@/api/meet/groups";
import { useAuthStore } from "@/store/authStore";
import type { Group } from "@/api/meet/types";

const AVATAR_COLORS = [
  "#4F80FF",
  "#7C3AED",
  "#EC4899",
  "#F97316",
  "#16A34A",
  "#0EA5E9",
];
function getAvatarColor(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

export default function MeetMyGroupsScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const accessToken = useAuthStore((s) => s.accessToken) ?? "";

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await getMyGroups(accessToken, 0, 100);
      setGroups(list);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity activeOpacity={0.7}
          style={s.backBtn}
          onPress={() => safeGoBack(navigation)}
        >
          <ChevronLeft color="#0F172A" size={22} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>내 모임</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={s.searchWrap}>
        <Search color="#94A3B8" size={16} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="모임 이름으로 검색"
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color="#3B82F6" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.uuid}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={s.countRow}>
              <Users color="#3B82F6" size={15} />
              <Text style={s.countText}>가입한 모임 {groups.length}개</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <View style={s.emptyIconWrap}>
                <Users color="#CBD5E1" size={26} />
              </View>
              <Text style={s.emptyTitle}>
                {query ? "검색 결과가 없어요" : "가입한 모임이 없어요"}
              </Text>
              <Text style={s.emptyDesc}>
                {query
                  ? "다른 키워드로 검색해보세요"
                  : "새 모임을 만들거나 탐색해보세요"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <GroupRow
              group={item}
              onPress={() =>
                navigation.navigate("MeetDetail", {
                  groupUuid: item.uuid,
                  groupName: item.name,
                })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function GroupRow({ group, onPress }: { group: Group; onPress: () => void }) {
  const color = getAvatarColor(group.name);
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.75}>
      <View
        style={[
          s.avatar,
          { backgroundColor: group.profileImageUrl ? "#F1F5F9" : color },
        ]}
      >
        {group.profileImageUrl ? (
          <Image source={{ uri: group.profileImageUrl }} style={s.avatarImg} />
        ) : (
          <Text style={s.avatarText}>
            {group.name[0]?.toUpperCase() ?? "?"}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={s.name} numberOfLines={1}>
            {group.name}
          </Text>
          {group.type === "PRIVATE" && (
            <View style={s.privateBadge}>
              <Lock color="#64748B" size={10} />
            </View>
          )}
        </View>
        {group.description ? (
          <Text style={s.desc} numberOfLines={1}>
            {group.description}
          </Text>
        ) : null}
        <View style={s.metaRow}>
          <Users color="#94A3B8" size={11} />
          <Text style={s.meta}>{group.memberCount}명</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#1E3A8A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7FF" },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A", padding: 0 },

  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  countText: { fontSize: 14, fontWeight: "700", color: "#334155" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    paddingRight: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 52, height: 52 },
  avatarText: { fontSize: 20, fontWeight: "800", color: "#fff" },
  name: { fontSize: 15, fontWeight: "700", color: "#0F172A", flexShrink: 1 },
  desc: { fontSize: 13, color: "#64748B" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  meta: { fontSize: 12, color: "#94A3B8" },
  privateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },

  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 40,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    ...cardShadow,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F8FAFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#475569" },
  emptyDesc: { fontSize: 13, color: "#94A3B8" },
});
