import { instance } from "../axios";

export interface OnboardingAnswersResponse {
  status: string;
  currentStep: number;
  region: string | null;
  age: string | null;
  activity: string[] | null;
  gender: string | null;
}

export async function getOnboardingAnswers(): Promise<OnboardingAnswersResponse> {
  const res = await instance.get<OnboardingAnswersResponse>("onboarding/answers");
  return res.data;
}
