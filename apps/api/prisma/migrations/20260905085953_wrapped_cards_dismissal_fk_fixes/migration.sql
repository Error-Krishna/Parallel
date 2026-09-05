-- CreateEnum
CREATE TYPE "WrappedPeriod" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterEnum
ALTER TYPE "IdentityCardType" ADD VALUE 'COLLAB';

-- AlterEnum
ALTER TYPE "SignalType" ADD VALUE 'COMMUNITY_JOIN';

-- AlterTable
ALTER TABLE "identity_cards" ADD COLUMN     "source_id" TEXT,
ADD COLUMN     "source_type" TEXT;

-- AlterTable
ALTER TABLE "roulette_matches" ADD COLUMN     "parallel_type_id" TEXT;

-- AlterTable
ALTER TABLE "user_parallels" ADD COLUMN     "dismissed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "parallel_wrapped" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period" "WrappedPeriod" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "highlights" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parallel_wrapped_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parallel_wrapped_user_id_period_start_idx" ON "parallel_wrapped"("user_id", "period_start");

-- CreateIndex
CREATE INDEX "identity_cards_source_type_source_id_idx" ON "identity_cards"("source_type", "source_id");

-- AddForeignKey
ALTER TABLE "collab_sessions" ADD CONSTRAINT "collab_sessions_parallel_type_a_id_fkey" FOREIGN KEY ("parallel_type_a_id") REFERENCES "parallel_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collab_sessions" ADD CONSTRAINT "collab_sessions_parallel_type_b_id_fkey" FOREIGN KEY ("parallel_type_b_id") REFERENCES "parallel_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roulette_matches" ADD CONSTRAINT "roulette_matches_parallel_type_id_fkey" FOREIGN KEY ("parallel_type_id") REFERENCES "parallel_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parallel_wrapped" ADD CONSTRAINT "parallel_wrapped_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
