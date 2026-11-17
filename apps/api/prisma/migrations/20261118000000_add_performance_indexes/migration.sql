-- CreateIndex
CREATE INDEX "community_members_user_id_idx" ON "community_members"("user_id");

-- CreateIndex
CREATE INDEX "follows_followee_id_idx" ON "follows"("followee_id");

-- CreateIndex
CREATE INDEX "parallel_twins_user_b_id_idx" ON "parallel_twins"("user_b_id");

-- CreateIndex
CREATE INDEX "user_parallels_parallel_type_id_idx" ON "user_parallels"("parallel_type_id");

