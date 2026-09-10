/*
  Warnings:

  - A unique constraint covering the columns `[user_id,question_key]` on the table `onboarding_responses` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "onboarding_responses_user_id_question_key_key" ON "onboarding_responses"("user_id", "question_key");
