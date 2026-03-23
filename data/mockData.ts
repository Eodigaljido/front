/**
 * 앱 전역 목(mock) 데이터 - 임시 동작용
 */

export type CourseRouteStep = {
  id: string;
  name: string;
  /** 이 장소에서 머무른 평균 시간(분) */
  stayMinutes: number;
};

export type CourseReview = {
  id: string;
  userName: string;
  rating: number;
  text: string;
  date: string; // YYYY-MM-DD
};

export type CourseItem = {
  id: string;
  title: string;
  meta: string;
  departure: string;
  arrival: string;
  thumbnail: string | null;
  category: string;
  region: string;
  createdAt: string; // YYYY-MM-DD
  views: number;
  /** 코스를 처음부터 끝까지 걸었을 때 평균 소요 시간(분) */
  overallDurationMinutes: number;
  /** 이용자 평균 별점 (1.0 ~ 5.0) */
  rating: number;
  reviewCount: number;
  routeSteps: CourseRouteStep[];
  reviews: CourseReview[];
};

export const MOCK_COURSES: CourseItem[] = [
  {
    id: '1',
    title: '솔로들은 보지마라 왜냐하면 이게...',
    meta: '데이트코스 1위 업체 / 03-13',
    departure: '스페이클럽 폴링장',
    arrival: '오티티프라이빗 동성로점',
    thumbnail: null,
    category: '데이트',
    region: '대구',
    createdAt: '2025-03-13',
    views: 320,
    overallDurationMinutes: 180,
    rating: 4.8,
    reviewCount: 32,
    routeSteps: [
      { id: '1-1', name: '스페이클럽 폴링장', stayMinutes: 60 },
      { id: '1-2', name: '카페 이동', stayMinutes: 20 },
      { id: '1-3', name: '오티티프라이빗 동성로점', stayMinutes: 100 },
    ],
    reviews: [
      {
        id: 'r-1-1',
        userName: '산책좋아하는사람',
        rating: 5,
        text: '데이트 코스로 완전 추천이에요. 이동 동선도 짧고 시간 보내기 좋았습니다.',
        date: '2025-03-14',
      },
      {
        id: 'r-1-2',
        userName: '대구사는고양이',
        rating: 4.5,
        text: '주말 오후에 다녀왔는데 사람은 조금 많았지만 전체적으로 만족!',
        date: '2025-03-15',
      },
    ],
  },
  {
    id: '2',
    title: '집에서도 게임하면서 게임장 왜 가...',
    meta: '데이트코스 1위 업체 / 03-13',
    departure: '경소고-키즈카페-밥집',
    arrival: '경소고-키즈카페-밥집',
    thumbnail: null,
    category: '데이트',
    region: '경기',
    createdAt: '2025-03-12',
    views: 180,
    overallDurationMinutes: 150,
    rating: 4.5,
    reviewCount: 18,
    routeSteps: [
      { id: '2-1', name: '경소고', stayMinutes: 30 },
      { id: '2-2', name: '키즈카페', stayMinutes: 70 },
      { id: '2-3', name: '밥집', stayMinutes: 50 },
    ],
    reviews: [
      {
        id: 'r-2-1',
        userName: '게임좋아',
        rating: 4.5,
        text: '실내에서 오래 놀 수 있어서 날씨 상관없이 즐기기 좋았어요.',
        date: '2025-03-13',
      },
    ],
  },
  {
    id: '3',
    title: '동성로 피규어 공략',
    meta: '데이트코스 1위 업체 / 03-13',
    departure: '경소고-키즈카페-밥집',
    arrival: '경소고-키즈카페-밥집',
    thumbnail: null,
    category: '데이트',
    region: '대구',
    createdAt: '2025-03-11',
    views: 210,
    overallDurationMinutes: 160,
    rating: 4.6,
    reviewCount: 21,
    routeSteps: [
      { id: '3-1', name: '피규어 샵 1', stayMinutes: 40 },
      { id: '3-2', name: '피규어 샵 2', stayMinutes: 40 },
      { id: '3-3', name: '근처 카페', stayMinutes: 80 },
    ],
    reviews: [
      {
        id: 'r-3-1',
        userName: '피규어덕후',
        rating: 5,
        text: '피규어 구경만 해도 시간 가는 줄 몰라요. 피규어 좋아하는 사람에게 강추.',
        date: '2025-03-11',
      },
    ],
  },
  {
    id: '4',
    title: '홍대 카페·맛집 한 바퀴',
    meta: '친구모임 인기 / 03-10',
    departure: '홍대입구역',
    arrival: '연남동 골목',
    thumbnail: null,
    category: '친구모임',
    region: '서울',
    createdAt: '2025-03-10',
    views: 450,
    overallDurationMinutes: 140,
    rating: 4.7,
    reviewCount: 27,
    routeSteps: [
      { id: '4-1', name: '홍대입구역 앞 집결', stayMinutes: 20 },
      { id: '4-2', name: '홍대 카페', stayMinutes: 60 },
      { id: '4-3', name: '연남동 맛집', stayMinutes: 60 },
    ],
    reviews: [],
  },
  {
    id: '5',
    title: '강남 맛집 투어',
    meta: '맛집 코스 / 03-09',
    departure: '강남역',
    arrival: '청담동',
    thumbnail: null,
    category: '맛집',
    region: '서울',
    createdAt: '2025-03-09',
    views: 290,
    overallDurationMinutes: 200,
    rating: 4.4,
    reviewCount: 14,
    routeSteps: [
      { id: '5-1', name: '강남역 번화가', stayMinutes: 40 },
      { id: '5-2', name: '맛집 1', stayMinutes: 60 },
      { id: '5-3', name: '카페', stayMinutes: 50 },
      { id: '5-4', name: '청담동 산책', stayMinutes: 50 },
    ],
    reviews: [],
  },
  {
    id: '6',
    title: '부산 해운대 드라이브',
    meta: '자연·바다 / 03-08',
    departure: '해운대역',
    arrival: '광안리',
    thumbnail: null,
    category: '자연',
    region: '부산',
    createdAt: '2025-03-08',
    views: 380,
    overallDurationMinutes: 210,
    rating: 4.9,
    reviewCount: 45,
    routeSteps: [
      { id: '6-1', name: '해운대역', stayMinutes: 30 },
      { id: '6-2', name: '해운대 해변 산책', stayMinutes: 80 },
      { id: '6-3', name: '카페 또는 포장마차', stayMinutes: 50 },
      { id: '6-4', name: '광안리 야경', stayMinutes: 50 },
    ],
    reviews: [],
  },
  {
    id: '7',
    title: '인천 차이나타운 맛집',
    meta: '맛집·카페 / 03-07',
    departure: '인천역',
    arrival: '차이나타운',
    thumbnail: null,
    category: '맛집',
    region: '인천',
    createdAt: '2025-03-07',
    views: 150,
    overallDurationMinutes: 130,
    rating: 4.3,
    reviewCount: 9,
    routeSteps: [
      { id: '7-1', name: '인천역', stayMinutes: 20 },
      { id: '7-2', name: '차이나타운 골목', stayMinutes: 60 },
      { id: '7-3', name: '맛집 식사', stayMinutes: 50 },
    ],
    reviews: [],
  },
  {
    id: '8',
    title: '대전 카페 거리',
    meta: '카페 코스 / 03-06',
    departure: '대전역',
    arrival: '둔산동',
    thumbnail: null,
    category: '카페',
    region: '대전',
    createdAt: '2025-03-06',
    views: 95,
    overallDurationMinutes: 120,
    rating: 4.2,
    reviewCount: 6,
    routeSteps: [
      { id: '8-1', name: '대전역', stayMinutes: 20 },
      { id: '8-2', name: '카페 거리 1', stayMinutes: 50 },
      { id: '8-3', name: '카페 거리 2', stayMinutes: 50 },
    ],
    reviews: [],
  },
];

/** 코스별 지도 중심 좌표 (목 데이터 · 추후 API로 대체) */
const DEFAULT_MAP_CENTER = { lat: 37.5665, lng: 126.978 };
const COURSE_MAP_CENTER: Record<string, { lat: number; lng: number }> = {
  '1': { lat: 35.8714, lng: 128.6014 },
  '2': { lat: 37.2636, lng: 127.0286 },
  '3': { lat: 35.8714, lng: 128.6014 },
  '4': { lat: 37.5563, lng: 126.9236 },
  '5': { lat: 37.498, lng: 127.0276 },
  '6': { lat: 35.1587, lng: 129.1604 },
  '7': { lat: 37.4484, lng: 126.6264 },
  '8': { lat: 36.3504, lng: 127.3845 },
};

export function getCourseMapCenter(courseId: string): { lat: number; lng: number } {
  return COURSE_MAP_CENTER[courseId] ?? DEFAULT_MAP_CENTER;
}

/** 경로 단계 클릭 시 이동할 임시 좌표 (코스 중심 기준 오프셋) */
const STEP_DELTAS = [
  { lat: 0, lng: 0 },
  { lat: 0.0012, lng: -0.0011 },
  { lat: -0.0014, lng: 0.0013 },
  { lat: 0.0018, lng: 0.0016 },
  { lat: -0.0019, lng: -0.0015 },
];

export function getCourseStepMapPoint(courseId: string, stepIndex: number): { lat: number; lng: number } {
  const base = getCourseMapCenter(courseId);
  const delta = STEP_DELTAS[stepIndex % STEP_DELTAS.length];
  return {
    lat: base.lat + delta.lat,
    lng: base.lng + delta.lng,
  };
}

/** 주변 인기 코스용 (조회수 상위) - 홈에서 사용 */
export function getPopularNearbyCourses(limit = 5): CourseItem[] {
  return [...MOCK_COURSES].sort((a, b) => b.views - a.views).slice(0, limit);
}

export type ChatRoomItem = {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unread: number;
};

export const MOCK_CHAT_ROOMS: ChatRoomItem[] = [
  { id: 'c1', name: '산책 모임', lastMessage: '내일 몇 시에 만날까요?', time: '오전 10:32', unread: 2 },
  { id: 'c2', name: '홍대 코스 공유', lastMessage: '저도 그 코스 다녀왔어요!', time: '어제', unread: 0 },
];
