-- Refresh token rotation: tokens of one login chain share a family_id, so reuse of a
-- rotated token can revoke the whole chain. token_hash is looked up on every refresh.
ALTER TABLE "refresh_token" ADD COLUMN "family_id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "refresh_token" ALTER COLUMN "family_id" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_token_user_id_idx" ON "refresh_token"("user_id");

-- CreateIndex
CREATE INDEX "refresh_token_family_id_idx" ON "refresh_token"("family_id");
