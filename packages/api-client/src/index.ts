// Factory rather than a singleton: the consuming app (apps/web) provides its own axios
// instance (with the right baseURL/interceptors — see apps/web/src/lib/api-client.ts),
// this package just wraps it in typed, reusable request functions and query hooks.
import type { AxiosInstance } from 'axios';
import type { HealthResponse, ParallelMapResponse, OnboardingAnswerDto } from '@parallel/shared-types';

export function createParallelApi(http: AxiosInstance) {
  return {
    health: {
      check: async (): Promise<HealthResponse> => {
        const { data } = await http.get<HealthResponse>('/v1/health');
        return data;
      },
    },
    parallels: {
      // Fill in as the /parallels endpoints land (blueprint Phase 5/6).
      getMap: async (): Promise<ParallelMapResponse> => {
        const { data } = await http.get<ParallelMapResponse>('/v1/parallels/map');
        return data;
      },
    },
    onboarding: {
      submitAnswer: async (answer: OnboardingAnswerDto): Promise<void> => {
        await http.post('/v1/onboarding/answers', answer);
      },
    },
  };
}

export type ParallelApi = ReturnType<typeof createParallelApi>;

export * from '@parallel/shared-types';
