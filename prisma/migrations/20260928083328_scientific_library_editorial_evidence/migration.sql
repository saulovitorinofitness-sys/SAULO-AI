CREATE TYPE "ScientificLibraryDataNature" AS ENUM (
    'SCIENTIFIC',
    'OFFICIAL_DATABASE',
    'PROFESSIONAL_PROTOCOL',
    'OPERATIONAL',
    'DEMONSTRATIVE',
    'LEGACY'
);

CREATE TYPE "ScientificLibraryEditorialStatus" AS ENUM (
    'DRAFT',
    'UNDER_REVIEW',
    'APPROVED',
    'SUPERSEDED',
    'ARCHIVED',
    'REJECTED'
);

CREATE TYPE "ScientificLibraryPublicationType" AS ENUM (
    'GUIDELINE_OR_CONSENSUS',
    'SYSTEMATIC_REVIEW_META_ANALYSIS',
    'CLINICAL_TRIAL',
    'OBSERVATIONAL_STUDY',
    'DIAGNOSTIC_STUDY',
    'BIOMECHANICAL_STUDY',
    'TECHNICAL_BOOK_OR_MANUAL',
    'OFFICIAL_DATABASE',
    'PROFESSIONAL_PROTOCOL',
    'OTHER',
    'UNCLASSIFIED'
);

CREATE TYPE "ScientificLibraryEvidenceCategory" AS ENUM (
    'GUIDELINE_OR_CONSENSUS',
    'SYSTEMATIC_REVIEW_META_ANALYSIS',
    'CLINICAL_TRIAL',
    'OBSERVATIONAL_STUDY',
    'DIAGNOSTIC_STUDY',
    'BIOMECHANICAL_STUDY',
    'TECHNICAL_REFERENCE',
    'OFFICIAL_DATABASE',
    'PROFESSIONAL_EXPERIENCE',
    'UNCLASSIFIED'
);

ALTER TABLE "ScientificLibraryRecord"
    ADD COLUMN "dataNature" "ScientificLibraryDataNature" NOT NULL DEFAULT 'DEMONSTRATIVE',
    ADD COLUMN "editorialStatus" "ScientificLibraryEditorialStatus" NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN "technicalContent" TEXT,
    ADD COLUMN "professionalApplication" TEXT,
    ADD COLUMN "targetPopulation" TEXT,
    ADD COLUMN "indications" TEXT,
    ADD COLUMN "contraindications" TEXT,
    ADD COLUMN "precautions" TEXT,
    ADD COLUMN "limitations" TEXT,
    ADD COLUMN "submittedForReviewAt" TIMESTAMP(3),
    ADD COLUMN "approvedAt" TIMESTAMP(3),
    ADD COLUMN "approvedByUserId" UUID,
    ADD COLUMN "editorialVersion" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "changeReason" TEXT,
    ADD COLUMN "reviewNotes" TEXT;

CREATE TABLE "ScientificLibraryReference" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "sourceTitle" TEXT,
    "fullCitation" TEXT,
    "authorsOrInstitution" TEXT,
    "publicationYear" INTEGER,
    "doi" TEXT,
    "pmid" TEXT,
    "isbn" TEXT,
    "officialUrl" TEXT,
    "sourceVersion" TEXT,
    "evidenceDate" TIMESTAMP(3),
    "accessedAt" TIMESTAMP(3),
    "publicationType" "ScientificLibraryPublicationType" NOT NULL DEFAULT 'UNCLASSIFIED',
    "evidenceCategory" "ScientificLibraryEvidenceCategory" NOT NULL DEFAULT 'UNCLASSIFIED',
    "recommendationStrength" TEXT,
    "evidenceLimitations" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScientificLibraryReference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScientificLibraryRevision" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "editorialStatus" "ScientificLibraryEditorialStatus" NOT NULL DEFAULT 'DRAFT',
    "changedByUserId" UUID,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScientificLibraryRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScientificLibraryRecord_area_domain_nature_editorial_idx"
    ON "ScientificLibraryRecord"("area", "domain", "dataNature", "editorialStatus");

CREATE INDEX "ScientificLibraryRecord_editorial_reviewedAt_idx"
    ON "ScientificLibraryRecord"("editorialStatus", "reviewedAt");

CREATE INDEX "ScientificLibraryReference_recordId_sortOrder_idx"
    ON "ScientificLibraryReference"("recordId", "sortOrder");

CREATE INDEX "ScientificLibraryReference_doi_idx"
    ON "ScientificLibraryReference"("doi");

CREATE INDEX "ScientificLibraryReference_pmid_idx"
    ON "ScientificLibraryReference"("pmid");

CREATE INDEX "ScientificLibraryReference_isbn_idx"
    ON "ScientificLibraryReference"("isbn");

CREATE UNIQUE INDEX "ScientificLibraryRevision_recordId_version_key"
    ON "ScientificLibraryRevision"("recordId", "version");

CREATE INDEX "ScientificLibraryRevision_record_status_createdAt_idx"
    ON "ScientificLibraryRevision"("recordId", "editorialStatus", "createdAt");

ALTER TABLE "ScientificLibraryReference"
    ADD CONSTRAINT "ScientificLibraryReference_recordId_fkey"
    FOREIGN KEY ("recordId") REFERENCES "ScientificLibraryRecord"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScientificLibraryRevision"
    ADD CONSTRAINT "ScientificLibraryRevision_recordId_fkey"
    FOREIGN KEY ("recordId") REFERENCES "ScientificLibraryRecord"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
