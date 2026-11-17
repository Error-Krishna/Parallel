-- AlterTable
ALTER TABLE "collab_sessions" ADD COLUMN     "challenge_context" JSONB,
ADD COLUMN     "challenge_description" TEXT,
ADD COLUMN     "challenge_title" TEXT,
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "user_a_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "user_b_completed" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "parallel_type_b_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "collab_sessions_user_a_id_idx" ON "collab_sessions"("user_a_id");

-- CreateIndex
CREATE INDEX "collab_sessions_user_b_id_idx" ON "collab_sessions"("user_b_id");

-- CreateIndex
CREATE INDEX "collab_sessions_status_idx" ON "collab_sessions"("status");
