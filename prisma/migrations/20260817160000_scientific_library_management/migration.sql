CREATE TABLE "ScientificLibraryRecord" (
    "id" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "reviewedByUserId" UUID,
    "area" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "tags" JSONB,
    "source" TEXT,
    "professionalNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "originKind" TEXT NOT NULL DEFAULT 'MANUAL',
    "externalCode" TEXT,
    "classificationSystem" TEXT,
    "sourceVersion" TEXT,
    "metadata" JSONB,
    "importFileName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScientificLibraryRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScientificLibraryRecord_createdByUserId_area_domain_normalizedName_key"
ON "ScientificLibraryRecord"("createdByUserId", "area", "domain", "normalizedName");

CREATE INDEX "ScientificLibraryRecord_createdByUserId_area_domain_status_idx"
ON "ScientificLibraryRecord"("createdByUserId", "area", "domain", "status");

CREATE INDEX "ScientificLibraryRecord_name_idx"
ON "ScientificLibraryRecord"("name");

CREATE INDEX "ScientificLibraryRecord_originKind_createdAt_idx"
ON "ScientificLibraryRecord"("originKind", "createdAt");

ALTER TABLE "ScientificLibraryRecord"
ADD CONSTRAINT "ScientificLibraryRecord_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScientificLibraryRecord"
ADD CONSTRAINT "ScientificLibraryRecord_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScientificLibraryRecord"
ADD CONSTRAINT "ScientificLibraryRecord_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
