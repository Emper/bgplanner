-- Fotos sueltas en la galería de grupo (v1.15)
-- Generado con `prisma migrate diff` para casar 1:1 con `prisma db push`.
-- Aditivo (no migra ni borra datos). Ejecutar contra la BD de producción.
--   psql "$DIRECT_URL" -f scripts/sql/2026-08-12-group-photos.sql
-- Después: `npx prisma generate`.

BEGIN;

CREATE TABLE "GroupPhoto" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GroupPhoto_groupId_idx" ON "GroupPhoto"("groupId");
CREATE INDEX "GroupPhoto_userId_idx" ON "GroupPhoto"("userId");

ALTER TABLE "GroupPhoto" ADD CONSTRAINT "GroupPhoto_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupPhoto" ADD CONSTRAINT "GroupPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
