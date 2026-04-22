import { instance } from "../axios";

export interface SubmitOnboardingRequest {
  region: string;
  age: string;
  activity: string[];
  gender: string;
}

export async function submitOnboarding(body: SubmitOnboardingRequest): Promise<void> {
  await instance.post("onboarding/submit", body);
}
