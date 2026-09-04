// Shared API contract types — the single place DTOs live so apps/web and apps/api
// (and later apps/mobile) never drift out of sync. Expand this as real endpoints are
// built (Phase 5+, blueprint §16); these are deliberately minimal starter shapes.
//
// Keep this package free of NestJS/Prisma-specific types — it should be importable
// from the browser bundle with zero server-only dependencies.

export interface PublicUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
}

export interface ParallelTypeDto {
  id: string;
  name: string;
  description: string;
  icon: string | null;
}

export interface UserParallelDto {
  id: string;
  parallelType: ParallelTypeDto;
  strengthPct: number;
  momentum: number;
  streakCount: number;
  isGhost: boolean;
  isHidden: boolean;
  suggestionReason: string | null;
  discoveredAt: string; // ISO date string over the wire
}

export interface ParallelMapResponse {
  user: PublicUser;
  parallels: UserParallelDto[];
}

export interface OnboardingAnswerDto {
  questionKey: string;
  answerValue: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  dependencies: {
    database: 'ok' | 'unreachable';
    redis: 'ok' | 'unreachable';
  };
}
