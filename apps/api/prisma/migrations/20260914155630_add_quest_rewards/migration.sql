-- CreateTable
CREATE TABLE "user_quest_rewards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "quest_id" TEXT NOT NULL,
    "reward_type" "QuestRewardType" NOT NULL,
    "reward_value" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_quest_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_quest_rewards_user_id_idx" ON "user_quest_rewards"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_quest_rewards_user_id_quest_id_key" ON "user_quest_rewards"("user_id", "quest_id");

-- AddForeignKey
ALTER TABLE "user_quest_rewards" ADD CONSTRAINT "user_quest_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quest_rewards" ADD CONSTRAINT "user_quest_rewards_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
