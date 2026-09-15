import { IsIn } from 'class-validator';
import { SignalType } from '@prisma/client';

// Content interactions may only log signal types that genuinely originate from a
// content interaction. FOLLOW, PARALLEL_ENTER, CHALLENGE_COMPLETE, QUEST_STEP, and
// COMMUNITY_JOIN each already have their own dedicated write path elsewhere
// (UsersService.followUser, ParallelsService.enterParallel, QuestsService.completeStep,
// a future CommunitiesModule) — allowing them through this generic endpoint would let
// a client fabricate signals disconnected from the action that's supposed to produce
// them, polluting the Identity Engine's future scoring input. Widen this list
// deliberately if a new, genuinely content-driven signal type is added — never widen
// it back to the full SignalType enum.
const CONTENT_SIGNAL_TYPES = [
  SignalType.VIEW,
  SignalType.LIKE,
  SignalType.SAVE,
  SignalType.SHARE,
  SignalType.SEARCH,
] as const;

export class ContentInteractionDto {
  @IsIn(CONTENT_SIGNAL_TYPES)
  signalType!: SignalType;
}
