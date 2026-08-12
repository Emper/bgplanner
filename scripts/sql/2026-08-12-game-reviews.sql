-- Opiniones de partida + galería (v1.12)
-- Generado con `prisma migrate diff` para casar 1:1 con `prisma db push`.
-- Es aditivo (no migra ni borra datos). Ejecutar contra la BD de producción.
--   psql "$DIRECT_URL" -f scripts/sql/2026-08-12-game-reviews.sql
-- Después, sincronizar el cliente: `npx prisma generate`.

BEGIN;

-- AlterTable: soft-delete de las notas de ranking
ALTER TABLE "GameComment" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable: opinión post-partida
CREATE TABLE "GameReview" (
    "id" TEXT NOT NULL,
    "groupGameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "rating" INTEGER,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable: fotos de una opinión
CREATE TABLE "GameReviewPhoto" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameReviewPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameReview_groupGameId_idx" ON "GameReview"("groupGameId");
CREATE INDEX "GameReview_userId_idx" ON "GameReview"("userId");
CREATE INDEX "GameReview_sessionId_idx" ON "GameReview"("sessionId");
CREATE INDEX "GameReviewPhoto_reviewId_idx" ON "GameReviewPhoto"("reviewId");

-- AddForeignKey
ALTER TABLE "GameReview" ADD CONSTRAINT "GameReview_groupGameId_fkey" FOREIGN KEY ("groupGameId") REFERENCES "GroupGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameReview" ADD CONSTRAINT "GameReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameReview" ADD CONSTRAINT "GameReview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameReviewPhoto" ADD CONSTRAINT "GameReviewPhoto_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "GameReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
