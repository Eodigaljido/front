import { instance } from '../axios';

export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SKIPPED' | 'COMPLETED';

export interface OnboardingStatusResponse {
  status: OnboardingStatus;
  completed: boolean;
  currentStep: number;
}

export async function getOnboardingStatus(accessToken: string): Promise<OnboardingStatusResponse> {
  const res = await instance.get<OnboardingStatusResponse>('/onboarding/status', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}
