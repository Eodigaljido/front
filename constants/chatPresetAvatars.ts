// @ts-nocheck
/** 채팅방 프리셋 아바타 — Metro는 상대 경로 require가 안정적 */
export type ChatPresetImage = {
  id: string;
  source: ReturnType<typeof require>;
};

export const CHAT_PRESET_IMAGES: ChatPresetImage[] = [
  { id: "p1", source: require("../assets/chat/pfp/apple.png") },
  { id: "p2", source: require("../assets/chat/pfp/banana.png") },
  { id: "p3", source: require("../assets/chat/pfp/coconut.png") },
  { id: "p4", source: require("../assets/chat/pfp/earth.png") },
  { id: "p5", source: require("../assets/chat/pfp/eodigaljido.png") },
  { id: "p6", source: require("../assets/chat/pfp/foot.png") },
  { id: "p7", source: require("../assets/chat/pfp/lemon.png") },
  { id: "p8", source: require("../assets/chat/pfp/map.png") },
  { id: "p9", source: require("../assets/chat/pfp/money.png") },
  { id: "p10", source: require("../assets/chat/pfp/octopus.png") },
  { id: "p11", source: require("../assets/chat/pfp/rusn.png") },
  { id: "p12", source: require("../assets/chat/pfp/rusun_map.png") },
  { id: "p13", source: require("../assets/chat/pfp/ruty.png") },
  { id: "p14", source: require("../assets/chat/pfp/ruty_child.png") },
  { id: "p15", source: require("../assets/chat/pfp/ruty_map.png") },
  { id: "p16", source: require("../assets/chat/pfp/ruty_run.png") },
  { id: "p17", source: require("../assets/chat/pfp/sunset.png") },
  { id: "p18", source: require("../assets/chat/pfp/tree.png") },
  { id: "p19", source: require("../assets/chat/pfp/unicorn.png") },
];
