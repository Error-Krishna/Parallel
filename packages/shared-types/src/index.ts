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

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface SignupDto {
  email: string;
  username: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
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
  dismissedAt: string | null; // set = permanently rejected/removed (see DATABASE.md §2.3); null = active/suggested
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

export interface OnboardingStatusDto {
  completed: boolean;
  answeredCount: number;
  totalQuestions: number;
  answers: OnboardingAnswerDto[];
}

export interface OnboardingQuestionOption {
  value: string;
  label: string;
}

export interface OnboardingQuestion {
  key: string;
  question: string;
  options: OnboardingQuestionOption[];
}

// Matches IdentityCardType in schema.prisma — keep in sync.
export type IdentityCardType = 'PARALLEL' | 'QUEST' | 'WRAPPED' | 'TWIN' | 'COLLAB';

export interface IdentityCardDto {
  id: string;
  cardType: IdentityCardType;
  sourceType: string | null;
  sourceId: string | null;
  imageUrl: string;
  createdAt: string;
}

export interface CreateIdentityCardDto {
  cardType: IdentityCardType;
  sourceId: string;
}

// Matches WrappedPeriod in schema.prisma.
export type WrappedPeriod = 'MONTHLY' | 'ANNUAL';

// Mirrors the shape of ParallelWrapped.highlights (see DATABASE.md §2.7 / schema.prisma comment) —
// kept as a distinct interface here (rather than `unknown`/`Json`) so the frontend gets real
// autocomplete on Wrapped fields. Update both places together if the highlight set changes.
export interface WrappedHighlights {
  biggestEvolution: { parallelTypeId: string; deltaPct: number } | null;
  mostExplored: { parallelTypeId: string; interactionCount: number } | null;
  weirdestIntersection: { parallelTypeIds: string[]; note: string } | null;
  streakHighlight: { parallelTypeId: string; streakCount: number } | null;
  twinId: string | null;
  narrativeCopy: string;
}

export interface WrappedRecapDto {
  id: string;
  period: WrappedPeriod;
  periodStart: string;
  periodEnd: string;
  highlights: WrappedHighlights;
  createdAt: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  dependencies: {
    database: 'ok' | 'unreachable';
    redis: 'ok' | 'unreachable';
  };
}

