-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('VIEW', 'LIKE', 'SAVE', 'SEARCH', 'FOLLOW', 'CHALLENGE_COMPLETE', 'SHARE', 'QUEST_STEP');

-- CreateEnum
CREATE TYPE "QuestRewardType" AS ENUM ('BADGE', 'COSMETIC_FRAME', 'HIDDEN_PARALLEL_HINT');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('POST', 'ARTICLE', 'EVENT', 'CHALLENGE_PROMPT');

-- CreateEnum
CREATE TYPE "CollabStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RouletteStatus" AS ENUM ('QUEUED', 'MATCHED', 'ENDED');

-- CreateEnum
CREATE TYPE "IdentityCardType" AS ENUM ('PARALLEL', 'QUEST', 'WRAPPED', 'TWIN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "bio" TEXT,
    "visibility_settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_responses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_key" TEXT NOT NULL,
    "answer_value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interest_signals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "signal_type" "SignalType" NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interest_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parallel_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "is_system_generated" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parallel_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_parallels" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "parallel_type_id" TEXT NOT NULL,
    "strength_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "momentum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "streak_count" INTEGER NOT NULL DEFAULT 0,
    "streak_last_touched_at" TIMESTAMP(3),
    "is_ghost" BOOLEAN NOT NULL DEFAULT true,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "suggestion_reason" TEXT,
    "discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(1536),

    CONSTRAINT "user_parallels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parallel_evolution_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "parallel_type_id" TEXT NOT NULL,
    "strength_pct" DOUBLE PRECISION NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parallel_evolution_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "parallel_type_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "reward_type" "QuestRewardType" NOT NULL,
    "reward_value" TEXT NOT NULL,
    "season" TEXT,
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_quest_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "quest_id" TEXT NOT NULL,
    "status" "QuestStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "user_quest_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "parallel_type_id" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "payload" JSONB NOT NULL,
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "follower_id" TEXT NOT NULL,
    "followee_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","followee_id")
);

-- CreateTable
CREATE TABLE "parallel_twins" (
    "id" TEXT NOT NULL,
    "user_a_id" TEXT NOT NULL,
    "user_b_id" TEXT NOT NULL,
    "shared_parallel_type_ids" JSONB NOT NULL,
    "similarity_score" DOUBLE PRECISION NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parallel_twins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "originating_parallel_type_ids" JSONB NOT NULL,
    "auto_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_members" (
    "community_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_members_pkey" PRIMARY KEY ("community_id","user_id")
);

-- CreateTable
CREATE TABLE "real_world_events" (
    "id" TEXT NOT NULL,
    "parallel_type_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "source_url" TEXT,

    CONSTRAINT "real_world_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collab_sessions" (
    "id" TEXT NOT NULL,
    "user_a_id" TEXT NOT NULL,
    "user_b_id" TEXT NOT NULL,
    "parallel_type_a_id" TEXT NOT NULL,
    "parallel_type_b_id" TEXT NOT NULL,
    "status" "CollabStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collab_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roulette_matches" (
    "id" TEXT NOT NULL,
    "user_a_id" TEXT NOT NULL,
    "user_b_id" TEXT,
    "matched_parallel_context" TEXT,
    "status" "RouletteStatus" NOT NULL DEFAULT 'QUEUED',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "roulette_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_cards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "card_type" "IdentityCardType" NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "onboarding_responses_user_id_idx" ON "onboarding_responses"("user_id");

-- CreateIndex
CREATE INDEX "interest_signals_user_id_created_at_idx" ON "interest_signals"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "parallel_types_name_key" ON "parallel_types"("name");

-- CreateIndex
CREATE INDEX "user_parallels_user_id_idx" ON "user_parallels"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_parallels_user_id_parallel_type_id_key" ON "user_parallels"("user_id", "parallel_type_id");

-- CreateIndex
CREATE INDEX "parallel_evolution_snapshots_user_id_captured_at_idx" ON "parallel_evolution_snapshots"("user_id", "captured_at");

-- CreateIndex
CREATE INDEX "quests_parallel_type_id_idx" ON "quests"("parallel_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_quest_progress_user_id_quest_id_key" ON "user_quest_progress"("user_id", "quest_id");

-- CreateIndex
CREATE INDEX "content_items_parallel_type_id_idx" ON "content_items"("parallel_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "parallel_twins_user_a_id_user_b_id_key" ON "parallel_twins"("user_a_id", "user_b_id");

-- CreateIndex
CREATE INDEX "real_world_events_parallel_type_id_idx" ON "real_world_events"("parallel_type_id");

-- CreateIndex
CREATE INDEX "identity_cards_user_id_idx" ON "identity_cards"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "onboarding_responses" ADD CONSTRAINT "onboarding_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_signals" ADD CONSTRAINT "interest_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_parallels" ADD CONSTRAINT "user_parallels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_parallels" ADD CONSTRAINT "user_parallels_parallel_type_id_fkey" FOREIGN KEY ("parallel_type_id") REFERENCES "parallel_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parallel_evolution_snapshots" ADD CONSTRAINT "parallel_evolution_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parallel_evolution_snapshots" ADD CONSTRAINT "parallel_evolution_snapshots_parallel_type_id_fkey" FOREIGN KEY ("parallel_type_id") REFERENCES "parallel_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_parallel_type_id_fkey" FOREIGN KEY ("parallel_type_id") REFERENCES "parallel_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_parallel_type_id_fkey" FOREIGN KEY ("parallel_type_id") REFERENCES "parallel_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_fkey" FOREIGN KEY ("followee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parallel_twins" ADD CONSTRAINT "parallel_twins_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parallel_twins" ADD CONSTRAINT "parallel_twins_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_world_events" ADD CONSTRAINT "real_world_events_parallel_type_id_fkey" FOREIGN KEY ("parallel_type_id") REFERENCES "parallel_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collab_sessions" ADD CONSTRAINT "collab_sessions_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collab_sessions" ADD CONSTRAINT "collab_sessions_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roulette_matches" ADD CONSTRAINT "roulette_matches_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roulette_matches" ADD CONSTRAINT "roulette_matches_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_cards" ADD CONSTRAINT "identity_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
