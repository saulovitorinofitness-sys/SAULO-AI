ALTER TYPE "ProfileType" ADD VALUE 'STUDENT';

CREATE TYPE "StudentPortalLinkStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "StudentPortalContentType" AS ENUM ('DIET', 'WORKOUT', 'ASSESSMENTS', 'POSTURAL_MEDIA', 'PAYMENTS');

CREATE TABLE "StudentPortalLink" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "masterRecordId" UUID NOT NULL,
    "status" "StudentPortalLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudentPortalLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentPortalInvitation" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "masterRecordId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "invitedByUserId" UUID NOT NULL,
    "consumedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentPortalInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentPortalRelease" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "masterRecordId" UUID NOT NULL,
    "contentType" "StudentPortalContentType" NOT NULL,
    "releasedByUserId" UUID NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudentPortalRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentPortalLink_userId_key" ON "StudentPortalLink"("userId");
CREATE UNIQUE INDEX "StudentPortalLink_patientId_key" ON "StudentPortalLink"("patientId");
CREATE UNIQUE INDEX "StudentPortalLink_masterRecordId_key" ON "StudentPortalLink"("masterRecordId");
CREATE INDEX "StudentPortalLink_status_idx" ON "StudentPortalLink"("status");

CREATE UNIQUE INDEX "StudentPortalInvitation_tokenHash_key" ON "StudentPortalInvitation"("tokenHash");
CREATE INDEX "StudentPortalInvitation_patientId_createdAt_idx" ON "StudentPortalInvitation"("patientId", "createdAt");
CREATE INDEX "StudentPortalInvitation_masterRecordId_createdAt_idx" ON "StudentPortalInvitation"("masterRecordId", "createdAt");
CREATE INDEX "StudentPortalInvitation_expiresAt_idx" ON "StudentPortalInvitation"("expiresAt");

CREATE UNIQUE INDEX "StudentPortalRelease_masterRecordId_contentType_key" ON "StudentPortalRelease"("masterRecordId", "contentType");
CREATE INDEX "StudentPortalRelease_patientId_contentType_revokedAt_idx" ON "StudentPortalRelease"("patientId", "contentType", "revokedAt");

ALTER TABLE "StudentPortalLink" ADD CONSTRAINT "StudentPortalLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentPortalLink" ADD CONSTRAINT "StudentPortalLink_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentPortalLink" ADD CONSTRAINT "StudentPortalLink_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentPortalInvitation" ADD CONSTRAINT "StudentPortalInvitation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentPortalInvitation" ADD CONSTRAINT "StudentPortalInvitation_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentPortalInvitation" ADD CONSTRAINT "StudentPortalInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentPortalInvitation" ADD CONSTRAINT "StudentPortalInvitation_consumedByUserId_fkey" FOREIGN KEY ("consumedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentPortalRelease" ADD CONSTRAINT "StudentPortalRelease_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentPortalRelease" ADD CONSTRAINT "StudentPortalRelease_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentPortalRelease" ADD CONSTRAINT "StudentPortalRelease_releasedByUserId_fkey" FOREIGN KEY ("releasedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentPortalRelease" ADD CONSTRAINT "StudentPortalRelease_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
