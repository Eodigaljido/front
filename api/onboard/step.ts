import { instance } from "../axios";

export async function completeOnboardingStep(
  accessToken: string,
  step: number,
  answer: string,
): Promise<void> {
  await instance.post(
    `onboarding/answers/${step}`,
    { answer },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}
