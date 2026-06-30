import { isAxiosError } from "axios";
import type { CourseItem } from "../../data/mockData";
import { fetchSharedCourses, normalizeCourseList } from "../courses";
import {
  getOnboardingAnswers,
  type OnboardingAnswersResponse,
} from "./answer";
import {
  isOnboardingAnswersComplete,
  recommendCoursesFromOnboarding,
} from "../../utils/recommendRoutesFromOnboarding";

export type OnboardingRecommendErrorCode =
  | "INCOMPLETE"
  | "NOT_STARTED"
  | "NETWORK";

export class OnboardingRecommendError extends Error {
  code: OnboardingRecommendErrorCode;

  constructor(message: string, code: OnboardingRecommendErrorCode) {
    super(message);
    this.name = "OnboardingRecommendError";
    this.code = code;
  }
}

export type PersonalizedRouteRecommendations = {
  answers: OnboardingAnswersResponse;
  recommended: CourseItem[];
};

export async function fetchPersonalizedRouteRecommendations(options?: {
  limit?: number;
  courses?: CourseItem[];
}): Promise<PersonalizedRouteRecommendations> {
  let answers: OnboardingAnswersResponse;
  try {
    answers = await getOnboardingAnswers();
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      throw new OnboardingRecommendError(
        "설문을 먼저 완료해 주세요.",
        "NOT_STARTED",
      );
    }
    throw new OnboardingRecommendError(
      "설문 정보를 불러오지 못했어요.",
      "NETWORK",
    );
  }

  if (!isOnboardingAnswersComplete(answers)) {
    throw new OnboardingRecommendError(
      "설문을 모두 완료한 뒤 추천을 받을 수 있어요.",
      "INCOMPLETE",
    );
  }

  const courses =
    options?.courses && options.courses.length > 0
      ? options.courses
      : normalizeCourseList(await fetchSharedCourses());

  const recommended = recommendCoursesFromOnboarding(
    courses,
    answers,
    options?.limit ?? 12,
  );

  return { answers, recommended };
}
