import type { CourseItem } from "../data/mockData";
import type { OnboardingAnswersResponse } from "../api/onboard/answer";
import { courseMatchesTagOrCategory } from "./courseTagFilter";
import { pickCourseSaveCount } from "../api/courses";

const ACTIVITY_LABELS: Record<string, string[]> = {
  "운동/건강": ["액티비티", "자연"],
  "예술/문화": ["카페", "데이트"],
  "음악/공연": ["데이트", "친구모임"],
  "여행/레저": ["자연", "액티비티"],
  기타: ["맛집", "카페"],
};

const AGE_LABELS: Record<string, string[]> = {
  "10대": ["액티비티", "카페"],
  "20대": ["데이트", "카페", "맛집"],
  "30대": ["맛집", "데이트", "자연"],
  "40대 이상": ["맛집", "자연"],
};

export function isOnboardingAnswersComplete(
  answers: OnboardingAnswersResponse,
): boolean {
  return Boolean(
    String(answers.region ?? "").trim() &&
      String(answers.age ?? "").trim() &&
      String(answers.gender ?? "").trim() &&
      Array.isArray(answers.activity) &&
      answers.activity.length > 0,
  );
}

export function normalizeOnboardingRegion(region: string): string {
  const raw = String(region ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("서울")) return "서울";
  if (raw.startsWith("부산")) return "부산";
  if (raw.startsWith("대구")) return "대구";
  if (raw.startsWith("인천")) return "인천";
  if (raw.startsWith("광주")) return "광주";
  if (raw.startsWith("대전")) return "대전";
  if (raw.startsWith("울산")) return "울산";
  if (raw.startsWith("세종")) return "세종";
  if (raw.startsWith("제주")) return "제주";
  if (raw.startsWith("경기")) return "경기";
  if (raw.startsWith("강원")) return "강원";
  if (raw.startsWith("충청북") || raw.startsWith("충북")) return "충북";
  if (raw.startsWith("충청남") || raw.startsWith("충남")) return "충남";
  if (raw.startsWith("전라북") || raw.startsWith("전북")) return "전북";
  if (raw.startsWith("전라남") || raw.startsWith("전남")) return "전남";
  if (raw.startsWith("경상북") || raw.startsWith("경북")) return "경북";
  if (raw.startsWith("경상남") || raw.startsWith("경남")) return "경남";
  return raw.replace(/도$/u, "").slice(0, 2);
}

function regionMatchesCourse(region: string, course: CourseItem): boolean {
  const needle = normalizeOnboardingRegion(region);
  if (!needle) return false;
  const hay = String(course.region ?? "").trim();
  if (!hay) {
    const dep = String(course.departure ?? "");
    const arr = String(course.arrival ?? "");
    return dep.includes(needle) || arr.includes(needle);
  }
  return (
    hay === needle ||
    hay.startsWith(`${needle} `) ||
    hay.startsWith(needle) ||
    hay.includes(needle)
  );
}

function collectPreferredLabels(answers: OnboardingAnswersResponse): string[] {
  const labels = new Set<string>();
  for (const activity of answers.activity ?? []) {
    for (const label of ACTIVITY_LABELS[String(activity).trim()] ?? []) {
      labels.add(label);
    }
  }
  const ageKey = String(answers.age ?? "").trim();
  for (const label of AGE_LABELS[ageKey] ?? []) {
    labels.add(label);
  }
  return [...labels];
}

export function buildOnboardingRecommendSummary(
  answers: OnboardingAnswersResponse,
): string {
  const region = String(answers.region ?? "").trim();
  const age = String(answers.age ?? "").trim();
  const activities = (answers.activity ?? []).join(", ");
  return [region, age, activities].filter(Boolean).join(" · ");
}

export function scoreCourseForOnboarding(
  course: CourseItem,
  answers: OnboardingAnswersResponse,
): number {
  let score = 0;
  if (regionMatchesCourse(String(answers.region ?? ""), course)) {
    score += 12;
  }
  const preferred = collectPreferredLabels(answers);
  for (const label of preferred) {
    if (courseMatchesTagOrCategory(course, label)) {
      score += 5;
    }
  }
  score += Math.min(6, Math.floor((course.views ?? 0) / 20));
  score += Math.min(8, pickCourseSaveCount(course));
  return score;
}

export function recommendCoursesFromOnboarding(
  courses: CourseItem[],
  answers: OnboardingAnswersResponse,
  limit = 12,
): CourseItem[] {
  const ranked = courses
    .map((course) => ({
      course,
      score: scoreCourseForOnboarding(course, answers),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return pickCourseSaveCount(b.course) - pickCourseSaveCount(a.course);
    });

  if (ranked.length > 0) {
    return ranked.slice(0, limit).map((row) => row.course);
  }

  const regionOnly = courses.filter((course) =>
    regionMatchesCourse(String(answers.region ?? ""), course),
  );
  if (regionOnly.length > 0) {
    return regionOnly
      .sort((a, b) => pickCourseSaveCount(b) - pickCourseSaveCount(a))
      .slice(0, limit);
  }

  return [...courses]
    .sort((a, b) => pickCourseSaveCount(b) - pickCourseSaveCount(a))
    .slice(0, limit);
}
