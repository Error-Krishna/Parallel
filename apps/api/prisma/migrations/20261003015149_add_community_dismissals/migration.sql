CREATE TABLE "community_dismissals" (
    "user_id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "dismissed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_dismissals_pkey" PRIMARY KEY ("user_id", "community_id")
);

CREATE INDEX "community_dismissals_community_id_idx"
ON "community_dismissals"("community_id");

ALTER TABLE "community_dismissals"
ADD CONSTRAINT "community_dismissals_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_dismissals"
ADD CONSTRAINT "community_dismissals_community_id_fkey"
FOREIGN KEY ("community_id") REFERENCES "communities"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
