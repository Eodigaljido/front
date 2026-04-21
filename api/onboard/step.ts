import { instance } from "../axios";

export async function completeOnboardingStep(
  accessToken: string,
  step: number,
  answer: string | string[],
): Promise<void> {
  await instance.post(
    `onboarding/answers/${step}`,
    { answers: Array.isArray(answer) ? answer : [answer] },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}
