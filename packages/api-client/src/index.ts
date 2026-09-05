// Factory rather than a singleton: the consuming app (apps/web) provides its own axios
// instance (with the right baseURL/interceptors — see apps/web/src/lib/api-client.ts),
// this package just wraps it in typed, reusable request functions and query hooks.
import type { AxiosInstance } from 'axios';
import type {
  HealthResponse,
  ParallelMapResponse,
  OnboardingAnswerDto,
  IdentityCardDto,
  CreateIdentityCardDto,
  WrappedRecapDto,
} from '@parallel/shared-types';

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
    cards: {
      create: async (dto: CreateIdentityCardDto): Promise<{ jobId: string }> => {
        const { data } = await http.post<{ jobId: string }>('/v1/cards', dto);
        return data;
      },
      get: async (id: string): Promise<IdentityCardDto> => {
        const { data } = await http.get<IdentityCardDto>(`/v1/cards/${id}`);
        return data;
      },
    },
    wrapped: {
      get: async (id: string): Promise<WrappedRecapDto> => {
        const { data } = await http.get<WrappedRecapDto>(`/v1/wrapped/${id}`);
        return data;
      },
      latest: async (): Promise<WrappedRecapDto | null> => {
        const { data } = await http.get<WrappedRecapDto | null>('/v1/wrapped/latest');
        return data;
      },
    },
  };
}

export type ParallelApi = ReturnType<typeof createParallelApi>;

export * from '@parallel/shared-types';
