-- Baseline generated from commit 9a985cf (2026-07-19), immediately before
-- the first historical migration. On databases that already have later
-- migrations recorded, this migration intentionally becomes a no-op.
DO $initial_baseline$
BEGIN
IF EXISTS (
  SELECT 1
  FROM "_prisma_migrations"
  WHERE "finished_at" IS NOT NULL
    AND "rolled_back_at" IS NULL
    AND "migration_name" <> '20260719000000_initial_baseline'
) THEN
  RAISE NOTICE 'Existing Prisma migration history detected; initial baseline skipped.';
ELSE

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('SYSTEM_OWNER', 'PROFESSIONAL', 'ADMINISTRATIVE');

-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('CREDENTIALS', 'OIDC');

-- CreateEnum
CREATE TYPE "AccessAction" AS ENUM ('READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'MANAGE');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PatientDataStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PatientSex" AS ENUM ('FEMALE', 'MALE', 'INTERSEX', 'NOT_INFORMED');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED', 'DOMESTIC_PARTNERSHIP', 'NOT_INFORMED');

-- CreateEnum
CREATE TYPE "PhoneType" AS ENUM ('MOBILE', 'HOME', 'WORK', 'OTHER');

-- CreateEnum
CREATE TYPE "MasterRecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RecordEntryStatus" AS ENUM ('DRAFT', 'FINALIZED', 'SUPERSEDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsultationType" AS ENUM ('INITIAL', 'FOLLOW_UP', 'PHYSICAL_ASSESSMENT', 'POSTURAL_ASSESSMENT', 'TRAINING', 'NUTRITION');

-- CreateEnum
CREATE TYPE "AttendanceStage" AS ENUM ('RECEPTION', 'MASTER_RECORD_LOADING', 'PENDING_CHECK', 'CLINICAL_SUMMARY', 'CONSULTATION_TYPE', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceTimelineEventType" AS ENUM ('PATIENT_RECEIVED', 'MASTER_RECORD_LOADED', 'PENDENCIES_VERIFIED', 'CLINICAL_SUMMARY_PREPARED', 'CONSULTATION_TYPE_RECORDED', 'ATTENDANCE_STARTED', 'ACTIVITY_RECORDED', 'ATTENDANCE_COMPLETED', 'ATTENDANCE_CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceTimelineStatus" AS ENUM ('RECORDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "AttendancePreparationStatus" AS ENUM ('READY', 'STALE', 'VOIDED');

-- CreateEnum
CREATE TYPE "ClinicalReasoningStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClinicalFindingCategory" AS ENUM ('CONDITION', 'NUTRITION', 'BEHAVIOR', 'LIFESTYLE', 'LABORATORY', 'FUNCTIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ClinicalFindingStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ClinicalPriorityLevel" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "PriorityClassificationSource" AS ENUM ('AUTOMATED_SERVICE', 'PROFESSIONAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "ClinicalPriorityStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ClinicalObjectiveType" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "ClinicalObjectiveStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ACHIEVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClinicalDecisionStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REVISED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TherapeuticStrategyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'REVISED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EvidenceLevel" AS ENUM ('HIGH', 'MODERATE', 'LOW', 'VERY_LOW', 'NOT_GRADED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('GUIDELINE', 'SYSTEMATIC_REVIEW', 'CLINICAL_TRIAL', 'OBSERVATIONAL_STUDY', 'CONSENSUS', 'OTHER');

-- CreateEnum
CREATE TYPE "ClinicalEvidenceStatus" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ClinicalAlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ClinicalEvolutionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EvolutionClassification" AS ENUM ('PROGRESS', 'PARTIAL_PROGRESS', 'STABLE', 'REGRESSION', 'PLATEAU', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "EvolutionDimension" AS ENUM ('WEIGHT', 'BODY_COMPOSITION', 'PERIMETRY', 'BIOIMPEDANCE', 'PHYSICAL_ASSESSMENT', 'POSTURAL_ASSESSMENT', 'SYMPTOMS', 'LABORATORY_EXAMS', 'TRAINING_PERFORMANCE', 'DIETARY_ADHERENCE', 'TRAINING_ADHERENCE', 'HYDRATION', 'SLEEP', 'SUPPLEMENTATION');

-- CreateEnum
CREATE TYPE "AdherenceCategory" AS ENUM ('DIETARY', 'TRAINING', 'CARDIO', 'HYDRATION', 'SLEEP', 'SUPPLEMENTATION', 'OVERALL');

-- CreateEnum
CREATE TYPE "AdherenceClassification" AS ENUM ('EXCELLENT', 'GOOD', 'PARTIAL', 'LOW', 'NONE', 'NOT_EVALUATED');

-- CreateEnum
CREATE TYPE "ProtocolType" AS ENUM ('NUTRITION', 'TRAINING', 'CARDIO', 'RECOVERY', 'MULTIDISCIPLINARY', 'OTHER');

-- CreateEnum
CREATE TYPE "ProtocolStatus" AS ENUM ('PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'REPLACED');

-- CreateEnum
CREATE TYPE "ProtocolDecisionType" AS ENUM ('MAINTAIN', 'MINOR_ADJUSTMENT', 'PARTIAL_CHANGE', 'COMPLETE_CHANGE', 'PAUSE', 'REQUEST_MORE_DATA', 'REFER_TO_ANOTHER_PROFESSIONAL');

-- CreateEnum
CREATE TYPE "EvolutionFactorType" AS ENUM ('INSUFFICIENT_ADHERENCE', 'INADEQUATE_ENERGY_INTAKE', 'INADEQUATE_ENERGY_EXPENDITURE', 'ROUTINE_CHANGE', 'INADEQUATE_SLEEP', 'STRESS', 'MEDICATION_USE', 'FLUID_RETENTION', 'MUSCLE_MASS_CHANGE', 'CLINICAL_CONDITION', 'ALTERED_EXAMS', 'PHYSICAL_LIMITATION', 'OTHER');

-- CreateEnum
CREATE TYPE "EvolutionFactorStatus" AS ENUM ('REPORTED', 'OBSERVED', 'UNDER_REVIEW', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AthleteProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AthleteProgressReferenceType" AS ENUM ('PREPARATION_PHASE', 'COMPETITIVE_PERIOD', 'PERFORMANCE', 'TRAINING_VOLUME_INTENSITY', 'RECOVERY', 'BODY_COMPOSITION', 'PROTOCOL_RESPONSE', 'PROGRESSION', 'REGRESSION');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'STATUS_CHANGE', 'ARCHIVE', 'RESTORE');

-- CreateEnum
CREATE TYPE "CanonicalDataCategory" AS ENUM ('ANTHROPOMETRIC', 'CLINICAL', 'FUNCTIONAL');

-- CreateEnum
CREATE TYPE "ContinuityStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ContinuityStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ContinuitySuggestionSource" AS ENUM ('MANUAL', 'WORKFLOW');

-- CreateTable
CREATE TABLE "BioimpedanceRecord" (
    "entryId" UUID NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "measurements" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BioimpedanceRecord_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "PerimetryRecord" (
    "entryId" UUID NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "measurements" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerimetryRecord_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "PhysicalAssessmentRecord" (
    "entryId" UUID NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL,
    "observations" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalAssessmentRecord_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "PosturalAssessmentRecord" (
    "entryId" UUID NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL,
    "observations" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosturalAssessmentRecord_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "changedByUserId" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditChange" (
    "id" UUID NOT NULL,
    "auditEventId" UUID NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,

    CONSTRAINT "AuditChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordVersion" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "responsibleUserId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalEvolutionSession" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "masterRecordId" UUID NOT NULL,
    "attendanceId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "previousSessionId" UUID,
    "classification" "EvolutionClassification",
    "status" "ClinicalEvolutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalEvolutionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvolutionComparison" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "currentEntryId" UUID,
    "previousEntryId" UUID,
    "dimension" "EvolutionDimension" NOT NULL,
    "comparisonKey" TEXT NOT NULL,
    "classification" "EvolutionClassification" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ClinicalEvolutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvolutionComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentAdherence" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "status" "ClinicalEvolutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentAdherence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentAdherenceItem" (
    "id" UUID NOT NULL,
    "adherenceId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "sourceEntryId" UUID,
    "category" "AdherenceCategory" NOT NULL,
    "percentage" DECIMAL(5,2),
    "classification" "AdherenceClassification" NOT NULL DEFAULT 'NOT_EVALUATED',
    "observations" TEXT,
    "status" "ClinicalEvolutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentAdherenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolHistory" (
    "id" UUID NOT NULL,
    "masterRecordId" UUID NOT NULL,
    "evolutionSessionId" UUID NOT NULL,
    "responseEvolutionSessionId" UUID,
    "strategyId" UUID,
    "responseEntryId" UUID,
    "moduleId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "protocolKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProtocolType" NOT NULL,
    "startedAt" DATE NOT NULL,
    "endedAt" DATE,
    "choiceReason" TEXT NOT NULL,
    "responseNotes" TEXT,
    "status" "ProtocolStatus" NOT NULL DEFAULT 'PLANNED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolChange" (
    "id" UUID NOT NULL,
    "protocolHistoryId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "responseEntryId" UUID,
    "description" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PatientDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolDecision" (
    "id" UUID NOT NULL,
    "evolutionSessionId" UUID NOT NULL,
    "protocolHistoryId" UUID,
    "moduleId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "type" "ProtocolDecisionType" NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "justification" TEXT NOT NULL,
    "nutritionExclusive" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ClinicalEvolutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProtocolDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProtocolDecisionEvidence" (
    "id" UUID NOT NULL,
    "protocolDecisionId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtocolDecisionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvolutionAssociatedFactor" (
    "id" UUID NOT NULL,
    "evolutionSessionId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "sourceEntryId" UUID,
    "type" "EvolutionFactorType" NOT NULL,
    "status" "EvolutionFactorStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "notes" TEXT,
    "deduplicationKey" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvolutionAssociatedFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteProgressProfile" (
    "id" UUID NOT NULL,
    "masterRecordId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "status" "AthleteProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteProgressProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteProgressReference" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "sourceEntryId" UUID NOT NULL,
    "type" "AthleteProgressReferenceType" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PatientDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteProgressReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalReasoningSession" (
    "id" UUID NOT NULL,
    "attendanceId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "responsibleProfessionalUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "status" "ClinicalReasoningStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalReasoningSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalFinding" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "category" "ClinicalFindingCategory" NOT NULL,
    "status" "ClinicalFindingStatus" NOT NULL DEFAULT 'ACTIVE',
    "deduplicationKey" TEXT NOT NULL,
    "sourceReference" JSONB,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalPriority" (
    "id" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "classifiedForUserId" UUID NOT NULL,
    "level" "ClinicalPriorityLevel" NOT NULL,
    "source" "PriorityClassificationSource" NOT NULL DEFAULT 'AUTOMATED_SERVICE',
    "status" "ClinicalPriorityStatus" NOT NULL DEFAULT 'ACTIVE',
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalPriority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalObjective" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "type" "ClinicalObjectiveType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "status" "ClinicalObjectiveStatus" NOT NULL DEFAULT 'PLANNED',
    "deduplicationKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalDecision" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "statement" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "madeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ClinicalDecisionStatus" NOT NULL DEFAULT 'ACCEPTED',
    "idempotencyKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TherapeuticStrategy" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "definedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TherapeuticStrategyStatus" NOT NULL DEFAULT 'DRAFT',
    "idempotencyKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TherapeuticStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalEvidence" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "registeredByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "level" "EvidenceLevel" NOT NULL,
    "status" "ClinicalEvidenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalDecisionEvidence" (
    "id" UUID NOT NULL,
    "decisionId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "relevance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalDecisionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalAlert" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "findingId" UUID,
    "moduleId" UUID NOT NULL,
    "raisedByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "level" "ClinicalPriorityLevel" NOT NULL,
    "status" "ClinicalAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "deduplicationKey" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterRecordDataReference" (
    "id" UUID NOT NULL,
    "masterRecordId" UUID NOT NULL,
    "currentEntryId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "responsibleUserId" UUID NOT NULL,
    "category" "CanonicalDataCategory" NOT NULL,
    "key" TEXT NOT NULL,
    "status" "RecordEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterRecordDataReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterRecordContinuity" (
    "id" UUID NOT NULL,
    "masterRecordId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "status" "ContinuityStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastCompletedStepKey" TEXT,
    "responsibleUserId" UUID,
    "lastActivityAt" TIMESTAMP(3),
    "nextSuggestedStepKey" TEXT,
    "suggestionSource" "ContinuitySuggestionSource",
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterRecordContinuity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuityStep" (
    "id" UUID NOT NULL,
    "continuityId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ContinuityStepStatus" NOT NULL DEFAULT 'PENDING',
    "responsibleUserId" UUID,
    "completedByUserId" UUID,
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContinuityStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "credentialHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ProfileType" NOT NULL,
    "professionalRegistration" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterRecord" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "responsibleUserId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "status" "MasterRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MasterRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterRecordEntry" (
    "id" UUID NOT NULL,
    "masterRecordId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "attendanceId" UUID,
    "aggregateId" UUID NOT NULL,
    "previousEntryId" UUID,
    "type" TEXT NOT NULL,
    "status" "RecordEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MasterRecordEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "masterRecordId" UUID NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "parameters" JSONB,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" UUID NOT NULL,
    "masterRecordId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "DeliverableStatus" NOT NULL DEFAULT 'DRAFT',
    "storageKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "preferredName" TEXT,
    "cpf" VARCHAR(11) NOT NULL,
    "sex" "PatientSex" NOT NULL,
    "birthDate" DATE NOT NULL,
    "email" TEXT NOT NULL,
    "maritalStatus" "MaritalStatus" NOT NULL,
    "profession" TEXT NOT NULL,
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "moduleId" UUID NOT NULL,
    "registeredByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientAddress" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "postalCode" VARCHAR(8) NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL DEFAULT 'BR',
    "status" "PatientDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientPhone" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "type" "PhoneType" NOT NULL,
    "countryCode" VARCHAR(3) NOT NULL DEFAULT '55',
    "areaCode" VARCHAR(3) NOT NULL,
    "number" VARCHAR(11) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "PatientDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientPhone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientInsurance" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "providerName" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "memberNumber" TEXT NOT NULL,
    "validUntil" DATE,
    "status" "PatientDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientEmergencyContact" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "PatientDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientEmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemModule" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nutritionRestricted" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "grantsAllModules" BOOLEAN NOT NULL DEFAULT false,
    "allowsNutritionModules" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "action" "AccessAction" NOT NULL,
    "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "action" "AccessAction" NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanRecord" (
    "entryId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "validFrom" DATE,
    "validUntil" DATE,
    "content" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanRecord_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "WorkoutPlanRecord" (
    "entryId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "validFrom" DATE,
    "validUntil" DATE,
    "content" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutPlanRecord_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" UUID NOT NULL,
    "masterRecordId" UUID NOT NULL,
    "professionalUserId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "masterRecordId" UUID NOT NULL,
    "appointmentId" UUID,
    "professionalUserId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "consultationType" "ConsultationType" NOT NULL,
    "currentStage" "AttendanceStage" NOT NULL DEFAULT 'RECEPTION',
    "idempotencyKey" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceTimelineEvent" (
    "id" UUID NOT NULL,
    "attendanceId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "type" "AttendanceTimelineEventType" NOT NULL,
    "status" "AttendanceTimelineStatus" NOT NULL DEFAULT 'RECORDED',
    "sequence" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePendingCheck" (
    "id" UUID NOT NULL,
    "attendanceId" UUID NOT NULL,
    "continuityId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "performedByUserId" UUID NOT NULL,
    "continuityVersion" INTEGER NOT NULL,
    "status" "AttendancePreparationStatus" NOT NULL DEFAULT 'READY',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendancePendingCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePendingCheckItem" (
    "id" UUID NOT NULL,
    "pendingCheckId" UUID NOT NULL,
    "continuityStepId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendancePendingCheckItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceClinicalSummary" (
    "id" UUID NOT NULL,
    "attendanceId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "generatedByUserId" UUID NOT NULL,
    "masterRecordVersion" INTEGER NOT NULL,
    "status" "AttendancePreparationStatus" NOT NULL DEFAULT 'READY',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceClinicalSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceClinicalSummaryItem" (
    "id" UUID NOT NULL,
    "summaryId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceClinicalSummaryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_occurredAt_idx" ON "AuditEvent"("entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_moduleId_occurredAt_idx" ON "AuditEvent"("moduleId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_changedByUserId_occurredAt_idx" ON "AuditEvent"("changedByUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditChange_auditEventId_idx" ON "AuditChange"("auditEventId");

-- CreateIndex
CREATE INDEX "RecordVersion_moduleId_createdAt_idx" ON "RecordVersion"("moduleId", "createdAt");

-- CreateIndex
CREATE INDEX "RecordVersion_responsibleUserId_createdAt_idx" ON "RecordVersion"("responsibleUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecordVersion_entityType_entityId_version_key" ON "RecordVersion"("entityType", "entityId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalEvolutionSession_attendanceId_key" ON "ClinicalEvolutionSession"("attendanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalEvolutionSession_previousSessionId_key" ON "ClinicalEvolutionSession"("previousSessionId");

-- CreateIndex
CREATE INDEX "ClinicalEvolutionSession_patientId_evaluatedAt_idx" ON "ClinicalEvolutionSession"("patientId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "ClinicalEvolutionSession_masterRecordId_evaluatedAt_idx" ON "ClinicalEvolutionSession"("masterRecordId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "ClinicalEvolutionSession_professionalUserId_evaluatedAt_idx" ON "ClinicalEvolutionSession"("professionalUserId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "ClinicalEvolutionSession_moduleId_idx" ON "ClinicalEvolutionSession"("moduleId");

-- CreateIndex
CREATE INDEX "ClinicalEvolutionSession_status_idx" ON "ClinicalEvolutionSession"("status");

-- CreateIndex
CREATE INDEX "EvolutionComparison_moduleId_idx" ON "EvolutionComparison"("moduleId");

-- CreateIndex
CREATE INDEX "EvolutionComparison_professionalUserId_idx" ON "EvolutionComparison"("professionalUserId");

-- CreateIndex
CREATE INDEX "EvolutionComparison_currentEntryId_idx" ON "EvolutionComparison"("currentEntryId");

-- CreateIndex
CREATE INDEX "EvolutionComparison_previousEntryId_idx" ON "EvolutionComparison"("previousEntryId");

-- CreateIndex
CREATE INDEX "EvolutionComparison_dimension_classification_idx" ON "EvolutionComparison"("dimension", "classification");

-- CreateIndex
CREATE UNIQUE INDEX "EvolutionComparison_sessionId_comparisonKey_key" ON "EvolutionComparison"("sessionId", "comparisonKey");

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentAdherence_sessionId_key" ON "TreatmentAdherence"("sessionId");

-- CreateIndex
CREATE INDEX "TreatmentAdherence_moduleId_idx" ON "TreatmentAdherence"("moduleId");

-- CreateIndex
CREATE INDEX "TreatmentAdherence_professionalUserId_recordedAt_idx" ON "TreatmentAdherence"("professionalUserId", "recordedAt");

-- CreateIndex
CREATE INDEX "TreatmentAdherenceItem_moduleId_idx" ON "TreatmentAdherenceItem"("moduleId");

-- CreateIndex
CREATE INDEX "TreatmentAdherenceItem_sourceEntryId_idx" ON "TreatmentAdherenceItem"("sourceEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentAdherenceItem_adherenceId_category_key" ON "TreatmentAdherenceItem"("adherenceId", "category");

-- CreateIndex
CREATE INDEX "ProtocolHistory_evolutionSessionId_idx" ON "ProtocolHistory"("evolutionSessionId");

-- CreateIndex
CREATE INDEX "ProtocolHistory_responseEvolutionSessionId_idx" ON "ProtocolHistory"("responseEvolutionSessionId");

-- CreateIndex
CREATE INDEX "ProtocolHistory_strategyId_idx" ON "ProtocolHistory"("strategyId");

-- CreateIndex
CREATE INDEX "ProtocolHistory_responseEntryId_idx" ON "ProtocolHistory"("responseEntryId");

-- CreateIndex
CREATE INDEX "ProtocolHistory_moduleId_idx" ON "ProtocolHistory"("moduleId");

-- CreateIndex
CREATE INDEX "ProtocolHistory_professionalUserId_startedAt_idx" ON "ProtocolHistory"("professionalUserId", "startedAt");

-- CreateIndex
CREATE INDEX "ProtocolHistory_type_status_idx" ON "ProtocolHistory"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolHistory_masterRecordId_protocolKey_key" ON "ProtocolHistory"("masterRecordId", "protocolKey");

-- CreateIndex
CREATE INDEX "ProtocolChange_protocolHistoryId_changedAt_idx" ON "ProtocolChange"("protocolHistoryId", "changedAt");

-- CreateIndex
CREATE INDEX "ProtocolChange_moduleId_idx" ON "ProtocolChange"("moduleId");

-- CreateIndex
CREATE INDEX "ProtocolChange_professionalUserId_idx" ON "ProtocolChange"("professionalUserId");

-- CreateIndex
CREATE INDEX "ProtocolChange_responseEntryId_idx" ON "ProtocolChange"("responseEntryId");

-- CreateIndex
CREATE INDEX "ProtocolDecision_protocolHistoryId_idx" ON "ProtocolDecision"("protocolHistoryId");

-- CreateIndex
CREATE INDEX "ProtocolDecision_moduleId_idx" ON "ProtocolDecision"("moduleId");

-- CreateIndex
CREATE INDEX "ProtocolDecision_professionalUserId_decidedAt_idx" ON "ProtocolDecision"("professionalUserId", "decidedAt");

-- CreateIndex
CREATE INDEX "ProtocolDecision_type_status_idx" ON "ProtocolDecision"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolDecision_evolutionSessionId_idempotencyKey_key" ON "ProtocolDecision"("evolutionSessionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ProtocolDecisionEvidence_evidenceId_idx" ON "ProtocolDecisionEvidence"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProtocolDecisionEvidence_protocolDecisionId_evidenceId_key" ON "ProtocolDecisionEvidence"("protocolDecisionId", "evidenceId");

-- CreateIndex
CREATE INDEX "EvolutionAssociatedFactor_moduleId_idx" ON "EvolutionAssociatedFactor"("moduleId");

-- CreateIndex
CREATE INDEX "EvolutionAssociatedFactor_professionalUserId_recordedAt_idx" ON "EvolutionAssociatedFactor"("professionalUserId", "recordedAt");

-- CreateIndex
CREATE INDEX "EvolutionAssociatedFactor_sourceEntryId_idx" ON "EvolutionAssociatedFactor"("sourceEntryId");

-- CreateIndex
CREATE INDEX "EvolutionAssociatedFactor_type_status_idx" ON "EvolutionAssociatedFactor"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EvolutionAssociatedFactor_evolutionSessionId_deduplicationK_key" ON "EvolutionAssociatedFactor"("evolutionSessionId", "deduplicationKey");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteProgressProfile_masterRecordId_key" ON "AthleteProgressProfile"("masterRecordId");

-- CreateIndex
CREATE INDEX "AthleteProgressProfile_moduleId_idx" ON "AthleteProgressProfile"("moduleId");

-- CreateIndex
CREATE INDEX "AthleteProgressProfile_professionalUserId_idx" ON "AthleteProgressProfile"("professionalUserId");

-- CreateIndex
CREATE INDEX "AthleteProgressProfile_status_idx" ON "AthleteProgressProfile"("status");

-- CreateIndex
CREATE INDEX "AthleteProgressReference_moduleId_idx" ON "AthleteProgressReference"("moduleId");

-- CreateIndex
CREATE INDEX "AthleteProgressReference_professionalUserId_recordedAt_idx" ON "AthleteProgressReference"("professionalUserId", "recordedAt");

-- CreateIndex
CREATE INDEX "AthleteProgressReference_sourceEntryId_idx" ON "AthleteProgressReference"("sourceEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteProgressReference_profileId_type_sourceEntryId_key" ON "AthleteProgressReference"("profileId", "type", "sourceEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalReasoningSession_attendanceId_key" ON "ClinicalReasoningSession"("attendanceId");

-- CreateIndex
CREATE INDEX "ClinicalReasoningSession_moduleId_idx" ON "ClinicalReasoningSession"("moduleId");

-- CreateIndex
CREATE INDEX "ClinicalReasoningSession_responsibleProfessionalUserId_idx" ON "ClinicalReasoningSession"("responsibleProfessionalUserId");

-- CreateIndex
CREATE INDEX "ClinicalReasoningSession_status_idx" ON "ClinicalReasoningSession"("status");

-- CreateIndex
CREATE INDEX "ClinicalFinding_moduleId_idx" ON "ClinicalFinding"("moduleId");

-- CreateIndex
CREATE INDEX "ClinicalFinding_professionalUserId_idx" ON "ClinicalFinding"("professionalUserId");

-- CreateIndex
CREATE INDEX "ClinicalFinding_category_status_idx" ON "ClinicalFinding"("category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalFinding_sessionId_deduplicationKey_key" ON "ClinicalFinding"("sessionId", "deduplicationKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalPriority_findingId_key" ON "ClinicalPriority"("findingId");

-- CreateIndex
CREATE INDEX "ClinicalPriority_moduleId_idx" ON "ClinicalPriority"("moduleId");

-- CreateIndex
CREATE INDEX "ClinicalPriority_classifiedForUserId_idx" ON "ClinicalPriority"("classifiedForUserId");

-- CreateIndex
CREATE INDEX "ClinicalPriority_level_status_idx" ON "ClinicalPriority"("level", "status");

-- CreateIndex
CREATE INDEX "ClinicalObjective_moduleId_idx" ON "ClinicalObjective"("moduleId");

-- CreateIndex
CREATE INDEX "ClinicalObjective_professionalUserId_idx" ON "ClinicalObjective"("professionalUserId");

-- CreateIndex
CREATE INDEX "ClinicalObjective_status_idx" ON "ClinicalObjective"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalObjective_sessionId_deduplicationKey_key" ON "ClinicalObjective"("sessionId", "deduplicationKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalObjective_sessionId_type_sequence_key" ON "ClinicalObjective"("sessionId", "type", "sequence");

-- CreateIndex
CREATE INDEX "ClinicalDecision_moduleId_idx" ON "ClinicalDecision"("moduleId");

-- CreateIndex
CREATE INDEX "ClinicalDecision_professionalUserId_madeAt_idx" ON "ClinicalDecision"("professionalUserId", "madeAt");

-- CreateIndex
CREATE INDEX "ClinicalDecision_status_idx" ON "ClinicalDecision"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalDecision_sessionId_idempotencyKey_key" ON "ClinicalDecision"("sessionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "TherapeuticStrategy_moduleId_idx" ON "TherapeuticStrategy"("moduleId");

-- CreateIndex
CREATE INDEX "TherapeuticStrategy_professionalUserId_definedAt_idx" ON "TherapeuticStrategy"("professionalUserId", "definedAt");

-- CreateIndex
CREATE INDEX "TherapeuticStrategy_status_idx" ON "TherapeuticStrategy"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TherapeuticStrategy_sessionId_idempotencyKey_key" ON "TherapeuticStrategy"("sessionId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalEvidence_key_key" ON "ClinicalEvidence"("key");

-- CreateIndex
CREATE INDEX "ClinicalEvidence_moduleId_idx" ON "ClinicalEvidence"("moduleId");

-- CreateIndex
CREATE INDEX "ClinicalEvidence_registeredByUserId_idx" ON "ClinicalEvidence"("registeredByUserId");

-- CreateIndex
CREATE INDEX "ClinicalEvidence_level_status_idx" ON "ClinicalEvidence"("level", "status");

-- CreateIndex
CREATE INDEX "ClinicalDecisionEvidence_evidenceId_idx" ON "ClinicalDecisionEvidence"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalDecisionEvidence_decisionId_evidenceId_key" ON "ClinicalDecisionEvidence"("decisionId", "evidenceId");

-- CreateIndex
CREATE INDEX "ClinicalAlert_findingId_idx" ON "ClinicalAlert"("findingId");

-- CreateIndex
CREATE INDEX "ClinicalAlert_moduleId_idx" ON "ClinicalAlert"("moduleId");

-- CreateIndex
CREATE INDEX "ClinicalAlert_raisedByUserId_raisedAt_idx" ON "ClinicalAlert"("raisedByUserId", "raisedAt");

-- CreateIndex
CREATE INDEX "ClinicalAlert_level_status_idx" ON "ClinicalAlert"("level", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalAlert_sessionId_deduplicationKey_key" ON "ClinicalAlert"("sessionId", "deduplicationKey");

-- CreateIndex
CREATE UNIQUE INDEX "MasterRecordDataReference_currentEntryId_key" ON "MasterRecordDataReference"("currentEntryId");

-- CreateIndex
CREATE INDEX "MasterRecordDataReference_moduleId_idx" ON "MasterRecordDataReference"("moduleId");

-- CreateIndex
CREATE INDEX "MasterRecordDataReference_responsibleUserId_idx" ON "MasterRecordDataReference"("responsibleUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterRecordDataReference_masterRecordId_category_key_key" ON "MasterRecordDataReference"("masterRecordId", "category", "key");

-- CreateIndex
CREATE UNIQUE INDEX "MasterRecordContinuity_masterRecordId_key" ON "MasterRecordContinuity"("masterRecordId");

-- CreateIndex
CREATE INDEX "MasterRecordContinuity_moduleId_idx" ON "MasterRecordContinuity"("moduleId");

-- CreateIndex
CREATE INDEX "MasterRecordContinuity_responsibleUserId_idx" ON "MasterRecordContinuity"("responsibleUserId");

-- CreateIndex
CREATE INDEX "MasterRecordContinuity_lastActivityAt_idx" ON "MasterRecordContinuity"("lastActivityAt");

-- CreateIndex
CREATE INDEX "ContinuityStep_moduleId_idx" ON "ContinuityStep"("moduleId");

-- CreateIndex
CREATE INDEX "ContinuityStep_status_sortOrder_idx" ON "ContinuityStep"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "ContinuityStep_responsibleUserId_idx" ON "ContinuityStep"("responsibleUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ContinuityStep_continuityId_key_key" ON "ContinuityStep"("continuityId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerSubject_key" ON "AuthIdentity"("provider", "providerSubject");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterRecord_patientId_key" ON "MasterRecord"("patientId");

-- CreateIndex
CREATE INDEX "MasterRecord_moduleId_idx" ON "MasterRecord"("moduleId");

-- CreateIndex
CREATE INDEX "MasterRecord_responsibleUserId_idx" ON "MasterRecord"("responsibleUserId");

-- CreateIndex
CREATE INDEX "MasterRecordEntry_masterRecordId_occurredAt_idx" ON "MasterRecordEntry"("masterRecordId", "occurredAt");

-- CreateIndex
CREATE INDEX "MasterRecordEntry_moduleId_idx" ON "MasterRecordEntry"("moduleId");

-- CreateIndex
CREATE INDEX "MasterRecordEntry_authorUserId_idx" ON "MasterRecordEntry"("authorUserId");

-- CreateIndex
CREATE INDEX "MasterRecordEntry_updatedByUserId_idx" ON "MasterRecordEntry"("updatedByUserId");

-- CreateIndex
CREATE INDEX "MasterRecordEntry_attendanceId_idx" ON "MasterRecordEntry"("attendanceId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterRecordEntry_aggregateId_revision_key" ON "MasterRecordEntry"("aggregateId", "revision");

-- CreateIndex
CREATE INDEX "Report_masterRecordId_createdAt_idx" ON "Report"("masterRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_requestedByUserId_idx" ON "Report"("requestedByUserId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_updatedByUserId_idx" ON "Report"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Report_moduleId_idx" ON "Report"("moduleId");

-- CreateIndex
CREATE INDEX "Deliverable_createdByUserId_idx" ON "Deliverable"("createdByUserId");

-- CreateIndex
CREATE INDEX "Deliverable_status_idx" ON "Deliverable"("status");

-- CreateIndex
CREATE INDEX "Deliverable_updatedByUserId_idx" ON "Deliverable"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Deliverable_moduleId_idx" ON "Deliverable"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "Deliverable_masterRecordId_kind_version_key" ON "Deliverable"("masterRecordId", "kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_cpf_key" ON "Patient"("cpf");

-- CreateIndex
CREATE INDEX "Patient_fullName_idx" ON "Patient"("fullName");

-- CreateIndex
CREATE INDEX "Patient_status_idx" ON "Patient"("status");

-- CreateIndex
CREATE INDEX "Patient_registeredByUserId_idx" ON "Patient"("registeredByUserId");

-- CreateIndex
CREATE INDEX "Patient_updatedByUserId_idx" ON "Patient"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Patient_moduleId_idx" ON "Patient"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientAddress_patientId_key" ON "PatientAddress"("patientId");

-- CreateIndex
CREATE INDEX "PatientAddress_moduleId_idx" ON "PatientAddress"("moduleId");

-- CreateIndex
CREATE INDEX "PatientAddress_createdByUserId_idx" ON "PatientAddress"("createdByUserId");

-- CreateIndex
CREATE INDEX "PatientAddress_updatedByUserId_idx" ON "PatientAddress"("updatedByUserId");

-- CreateIndex
CREATE INDEX "PatientPhone_moduleId_idx" ON "PatientPhone"("moduleId");

-- CreateIndex
CREATE INDEX "PatientPhone_createdByUserId_idx" ON "PatientPhone"("createdByUserId");

-- CreateIndex
CREATE INDEX "PatientPhone_updatedByUserId_idx" ON "PatientPhone"("updatedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientPhone_patientId_countryCode_areaCode_number_key" ON "PatientPhone"("patientId", "countryCode", "areaCode", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PatientInsurance_patientId_key" ON "PatientInsurance"("patientId");

-- CreateIndex
CREATE INDEX "PatientInsurance_moduleId_idx" ON "PatientInsurance"("moduleId");

-- CreateIndex
CREATE INDEX "PatientInsurance_createdByUserId_idx" ON "PatientInsurance"("createdByUserId");

-- CreateIndex
CREATE INDEX "PatientInsurance_updatedByUserId_idx" ON "PatientInsurance"("updatedByUserId");

-- CreateIndex
CREATE INDEX "PatientEmergencyContact_patientId_isPrimary_idx" ON "PatientEmergencyContact"("patientId", "isPrimary");

-- CreateIndex
CREATE INDEX "PatientEmergencyContact_moduleId_idx" ON "PatientEmergencyContact"("moduleId");

-- CreateIndex
CREATE INDEX "PatientEmergencyContact_createdByUserId_idx" ON "PatientEmergencyContact"("createdByUserId");

-- CreateIndex
CREATE INDEX "PatientEmergencyContact_updatedByUserId_idx" ON "PatientEmergencyContact"("updatedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemModule_key_key" ON "SystemModule"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE INDEX "RolePermission_moduleId_idx" ON "RolePermission"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_moduleId_action_key" ON "RolePermission"("roleId", "moduleId", "action");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "UserPermission_moduleId_idx" ON "UserPermission"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_moduleId_action_key" ON "UserPermission"("userId", "moduleId", "action");

-- CreateIndex
CREATE INDEX "Appointment_masterRecordId_startsAt_idx" ON "Appointment"("masterRecordId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_professionalUserId_startsAt_idx" ON "Appointment"("professionalUserId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_updatedByUserId_idx" ON "Appointment"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Appointment_moduleId_idx" ON "Appointment"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_appointmentId_key" ON "Attendance"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_idempotencyKey_key" ON "Attendance"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Attendance_masterRecordId_createdAt_idx" ON "Attendance"("masterRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "Attendance_professionalUserId_createdAt_idx" ON "Attendance"("professionalUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Attendance_status_idx" ON "Attendance"("status");

-- CreateIndex
CREATE INDEX "Attendance_createdByUserId_idx" ON "Attendance"("createdByUserId");

-- CreateIndex
CREATE INDEX "Attendance_updatedByUserId_idx" ON "Attendance"("updatedByUserId");

-- CreateIndex
CREATE INDEX "Attendance_moduleId_idx" ON "Attendance"("moduleId");

-- CreateIndex
CREATE INDEX "AttendanceTimelineEvent_moduleId_idx" ON "AttendanceTimelineEvent"("moduleId");

-- CreateIndex
CREATE INDEX "AttendanceTimelineEvent_actorUserId_occurredAt_idx" ON "AttendanceTimelineEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceTimelineEvent_attendanceId_sequence_key" ON "AttendanceTimelineEvent"("attendanceId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePendingCheck_attendanceId_key" ON "AttendancePendingCheck"("attendanceId");

-- CreateIndex
CREATE INDEX "AttendancePendingCheck_continuityId_idx" ON "AttendancePendingCheck"("continuityId");

-- CreateIndex
CREATE INDEX "AttendancePendingCheck_moduleId_idx" ON "AttendancePendingCheck"("moduleId");

-- CreateIndex
CREATE INDEX "AttendancePendingCheck_performedByUserId_idx" ON "AttendancePendingCheck"("performedByUserId");

-- CreateIndex
CREATE INDEX "AttendancePendingCheckItem_continuityStepId_idx" ON "AttendancePendingCheckItem"("continuityStepId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePendingCheckItem_pendingCheckId_continuityStepId_key" ON "AttendancePendingCheckItem"("pendingCheckId", "continuityStepId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceClinicalSummary_attendanceId_key" ON "AttendanceClinicalSummary"("attendanceId");

-- CreateIndex
CREATE INDEX "AttendanceClinicalSummary_moduleId_idx" ON "AttendanceClinicalSummary"("moduleId");

-- CreateIndex
CREATE INDEX "AttendanceClinicalSummary_generatedByUserId_idx" ON "AttendanceClinicalSummary"("generatedByUserId");

-- CreateIndex
CREATE INDEX "AttendanceClinicalSummaryItem_entryId_idx" ON "AttendanceClinicalSummaryItem"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceClinicalSummaryItem_summaryId_entryId_key" ON "AttendanceClinicalSummaryItem"("summaryId", "entryId");

-- AddForeignKey
ALTER TABLE "BioimpedanceRecord" ADD CONSTRAINT "BioimpedanceRecord_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerimetryRecord" ADD CONSTRAINT "PerimetryRecord_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalAssessmentRecord" ADD CONSTRAINT "PhysicalAssessmentRecord_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosturalAssessmentRecord" ADD CONSTRAINT "PosturalAssessmentRecord_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditChange" ADD CONSTRAINT "AuditChange_auditEventId_fkey" FOREIGN KEY ("auditEventId") REFERENCES "AuditEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordVersion" ADD CONSTRAINT "RecordVersion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordVersion" ADD CONSTRAINT "RecordVersion_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolutionSession" ADD CONSTRAINT "ClinicalEvolutionSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolutionSession" ADD CONSTRAINT "ClinicalEvolutionSession_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolutionSession" ADD CONSTRAINT "ClinicalEvolutionSession_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolutionSession" ADD CONSTRAINT "ClinicalEvolutionSession_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolutionSession" ADD CONSTRAINT "ClinicalEvolutionSession_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolutionSession" ADD CONSTRAINT "ClinicalEvolutionSession_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvolutionSession" ADD CONSTRAINT "ClinicalEvolutionSession_previousSessionId_fkey" FOREIGN KEY ("previousSessionId") REFERENCES "ClinicalEvolutionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionComparison" ADD CONSTRAINT "EvolutionComparison_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicalEvolutionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionComparison" ADD CONSTRAINT "EvolutionComparison_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionComparison" ADD CONSTRAINT "EvolutionComparison_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionComparison" ADD CONSTRAINT "EvolutionComparison_currentEntryId_fkey" FOREIGN KEY ("currentEntryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionComparison" ADD CONSTRAINT "EvolutionComparison_previousEntryId_fkey" FOREIGN KEY ("previousEntryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentAdherence" ADD CONSTRAINT "TreatmentAdherence_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicalEvolutionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentAdherence" ADD CONSTRAINT "TreatmentAdherence_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentAdherence" ADD CONSTRAINT "TreatmentAdherence_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentAdherence" ADD CONSTRAINT "TreatmentAdherence_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentAdherenceItem" ADD CONSTRAINT "TreatmentAdherenceItem_adherenceId_fkey" FOREIGN KEY ("adherenceId") REFERENCES "TreatmentAdherence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentAdherenceItem" ADD CONSTRAINT "TreatmentAdherenceItem_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentAdherenceItem" ADD CONSTRAINT "TreatmentAdherenceItem_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolHistory" ADD CONSTRAINT "ProtocolHistory_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolHistory" ADD CONSTRAINT "ProtocolHistory_evolutionSessionId_fkey" FOREIGN KEY ("evolutionSessionId") REFERENCES "ClinicalEvolutionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolHistory" ADD CONSTRAINT "ProtocolHistory_responseEvolutionSessionId_fkey" FOREIGN KEY ("responseEvolutionSessionId") REFERENCES "ClinicalEvolutionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolHistory" ADD CONSTRAINT "ProtocolHistory_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "TherapeuticStrategy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolHistory" ADD CONSTRAINT "ProtocolHistory_responseEntryId_fkey" FOREIGN KEY ("responseEntryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolHistory" ADD CONSTRAINT "ProtocolHistory_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolHistory" ADD CONSTRAINT "ProtocolHistory_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolHistory" ADD CONSTRAINT "ProtocolHistory_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolChange" ADD CONSTRAINT "ProtocolChange_protocolHistoryId_fkey" FOREIGN KEY ("protocolHistoryId") REFERENCES "ProtocolHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolChange" ADD CONSTRAINT "ProtocolChange_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolChange" ADD CONSTRAINT "ProtocolChange_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolChange" ADD CONSTRAINT "ProtocolChange_responseEntryId_fkey" FOREIGN KEY ("responseEntryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolDecision" ADD CONSTRAINT "ProtocolDecision_evolutionSessionId_fkey" FOREIGN KEY ("evolutionSessionId") REFERENCES "ClinicalEvolutionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolDecision" ADD CONSTRAINT "ProtocolDecision_protocolHistoryId_fkey" FOREIGN KEY ("protocolHistoryId") REFERENCES "ProtocolHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolDecision" ADD CONSTRAINT "ProtocolDecision_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolDecision" ADD CONSTRAINT "ProtocolDecision_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolDecision" ADD CONSTRAINT "ProtocolDecision_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolDecisionEvidence" ADD CONSTRAINT "ProtocolDecisionEvidence_protocolDecisionId_fkey" FOREIGN KEY ("protocolDecisionId") REFERENCES "ProtocolDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtocolDecisionEvidence" ADD CONSTRAINT "ProtocolDecisionEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "ClinicalEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionAssociatedFactor" ADD CONSTRAINT "EvolutionAssociatedFactor_evolutionSessionId_fkey" FOREIGN KEY ("evolutionSessionId") REFERENCES "ClinicalEvolutionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionAssociatedFactor" ADD CONSTRAINT "EvolutionAssociatedFactor_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionAssociatedFactor" ADD CONSTRAINT "EvolutionAssociatedFactor_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionAssociatedFactor" ADD CONSTRAINT "EvolutionAssociatedFactor_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionAssociatedFactor" ADD CONSTRAINT "EvolutionAssociatedFactor_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProgressProfile" ADD CONSTRAINT "AthleteProgressProfile_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProgressProfile" ADD CONSTRAINT "AthleteProgressProfile_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProgressProfile" ADD CONSTRAINT "AthleteProgressProfile_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProgressProfile" ADD CONSTRAINT "AthleteProgressProfile_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProgressReference" ADD CONSTRAINT "AthleteProgressReference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AthleteProgressProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProgressReference" ADD CONSTRAINT "AthleteProgressReference_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProgressReference" ADD CONSTRAINT "AthleteProgressReference_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProgressReference" ADD CONSTRAINT "AthleteProgressReference_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalReasoningSession" ADD CONSTRAINT "ClinicalReasoningSession_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalReasoningSession" ADD CONSTRAINT "ClinicalReasoningSession_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalReasoningSession" ADD CONSTRAINT "ClinicalReasoningSession_responsibleProfessionalUserId_fkey" FOREIGN KEY ("responsibleProfessionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalReasoningSession" ADD CONSTRAINT "ClinicalReasoningSession_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalFinding" ADD CONSTRAINT "ClinicalFinding_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicalReasoningSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalFinding" ADD CONSTRAINT "ClinicalFinding_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalFinding" ADD CONSTRAINT "ClinicalFinding_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalFinding" ADD CONSTRAINT "ClinicalFinding_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPriority" ADD CONSTRAINT "ClinicalPriority_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "ClinicalFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPriority" ADD CONSTRAINT "ClinicalPriority_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPriority" ADD CONSTRAINT "ClinicalPriority_classifiedForUserId_fkey" FOREIGN KEY ("classifiedForUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalObjective" ADD CONSTRAINT "ClinicalObjective_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicalReasoningSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalObjective" ADD CONSTRAINT "ClinicalObjective_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalObjective" ADD CONSTRAINT "ClinicalObjective_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalObjective" ADD CONSTRAINT "ClinicalObjective_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDecision" ADD CONSTRAINT "ClinicalDecision_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicalReasoningSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDecision" ADD CONSTRAINT "ClinicalDecision_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDecision" ADD CONSTRAINT "ClinicalDecision_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDecision" ADD CONSTRAINT "ClinicalDecision_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapeuticStrategy" ADD CONSTRAINT "TherapeuticStrategy_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicalReasoningSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapeuticStrategy" ADD CONSTRAINT "TherapeuticStrategy_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapeuticStrategy" ADD CONSTRAINT "TherapeuticStrategy_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapeuticStrategy" ADD CONSTRAINT "TherapeuticStrategy_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvidence" ADD CONSTRAINT "ClinicalEvidence_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvidence" ADD CONSTRAINT "ClinicalEvidence_registeredByUserId_fkey" FOREIGN KEY ("registeredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEvidence" ADD CONSTRAINT "ClinicalEvidence_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDecisionEvidence" ADD CONSTRAINT "ClinicalDecisionEvidence_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "ClinicalDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalDecisionEvidence" ADD CONSTRAINT "ClinicalDecisionEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "ClinicalEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalAlert" ADD CONSTRAINT "ClinicalAlert_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClinicalReasoningSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalAlert" ADD CONSTRAINT "ClinicalAlert_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "ClinicalFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalAlert" ADD CONSTRAINT "ClinicalAlert_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalAlert" ADD CONSTRAINT "ClinicalAlert_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalAlert" ADD CONSTRAINT "ClinicalAlert_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordDataReference" ADD CONSTRAINT "MasterRecordDataReference_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordDataReference" ADD CONSTRAINT "MasterRecordDataReference_currentEntryId_fkey" FOREIGN KEY ("currentEntryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordDataReference" ADD CONSTRAINT "MasterRecordDataReference_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordDataReference" ADD CONSTRAINT "MasterRecordDataReference_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordContinuity" ADD CONSTRAINT "MasterRecordContinuity_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordContinuity" ADD CONSTRAINT "MasterRecordContinuity_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordContinuity" ADD CONSTRAINT "MasterRecordContinuity_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordContinuity" ADD CONSTRAINT "MasterRecordContinuity_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordContinuity" ADD CONSTRAINT "MasterRecordContinuity_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityStep" ADD CONSTRAINT "ContinuityStep_continuityId_fkey" FOREIGN KEY ("continuityId") REFERENCES "MasterRecordContinuity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityStep" ADD CONSTRAINT "ContinuityStep_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityStep" ADD CONSTRAINT "ContinuityStep_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityStep" ADD CONSTRAINT "ContinuityStep_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityStep" ADD CONSTRAINT "ContinuityStep_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityStep" ADD CONSTRAINT "ContinuityStep_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecord" ADD CONSTRAINT "MasterRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecord" ADD CONSTRAINT "MasterRecord_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecord" ADD CONSTRAINT "MasterRecord_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecord" ADD CONSTRAINT "MasterRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecord" ADD CONSTRAINT "MasterRecord_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordEntry" ADD CONSTRAINT "MasterRecordEntry_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordEntry" ADD CONSTRAINT "MasterRecordEntry_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordEntry" ADD CONSTRAINT "MasterRecordEntry_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordEntry" ADD CONSTRAINT "MasterRecordEntry_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordEntry" ADD CONSTRAINT "MasterRecordEntry_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterRecordEntry" ADD CONSTRAINT "MasterRecordEntry_previousEntryId_fkey" FOREIGN KEY ("previousEntryId") REFERENCES "MasterRecordEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_registeredByUserId_fkey" FOREIGN KEY ("registeredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAddress" ADD CONSTRAINT "PatientAddress_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAddress" ADD CONSTRAINT "PatientAddress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAddress" ADD CONSTRAINT "PatientAddress_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAddress" ADD CONSTRAINT "PatientAddress_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPhone" ADD CONSTRAINT "PatientPhone_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPhone" ADD CONSTRAINT "PatientPhone_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPhone" ADD CONSTRAINT "PatientPhone_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPhone" ADD CONSTRAINT "PatientPhone_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurance" ADD CONSTRAINT "PatientInsurance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurance" ADD CONSTRAINT "PatientInsurance_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurance" ADD CONSTRAINT "PatientInsurance_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurance" ADD CONSTRAINT "PatientInsurance_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientEmergencyContact" ADD CONSTRAINT "PatientEmergencyContact_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientEmergencyContact" ADD CONSTRAINT "PatientEmergencyContact_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientEmergencyContact" ADD CONSTRAINT "PatientEmergencyContact_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientEmergencyContact" ADD CONSTRAINT "PatientEmergencyContact_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanRecord" ADD CONSTRAINT "MealPlanRecord_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlanRecord" ADD CONSTRAINT "WorkoutPlanRecord_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceTimelineEvent" ADD CONSTRAINT "AttendanceTimelineEvent_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceTimelineEvent" ADD CONSTRAINT "AttendanceTimelineEvent_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceTimelineEvent" ADD CONSTRAINT "AttendanceTimelineEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePendingCheck" ADD CONSTRAINT "AttendancePendingCheck_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePendingCheck" ADD CONSTRAINT "AttendancePendingCheck_continuityId_fkey" FOREIGN KEY ("continuityId") REFERENCES "MasterRecordContinuity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePendingCheck" ADD CONSTRAINT "AttendancePendingCheck_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePendingCheck" ADD CONSTRAINT "AttendancePendingCheck_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePendingCheckItem" ADD CONSTRAINT "AttendancePendingCheckItem_pendingCheckId_fkey" FOREIGN KEY ("pendingCheckId") REFERENCES "AttendancePendingCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePendingCheckItem" ADD CONSTRAINT "AttendancePendingCheckItem_continuityStepId_fkey" FOREIGN KEY ("continuityStepId") REFERENCES "ContinuityStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceClinicalSummary" ADD CONSTRAINT "AttendanceClinicalSummary_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceClinicalSummary" ADD CONSTRAINT "AttendanceClinicalSummary_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "SystemModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceClinicalSummary" ADD CONSTRAINT "AttendanceClinicalSummary_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceClinicalSummaryItem" ADD CONSTRAINT "AttendanceClinicalSummaryItem_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "AttendanceClinicalSummary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceClinicalSummaryItem" ADD CONSTRAINT "AttendanceClinicalSummaryItem_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

END IF;
END
$initial_baseline$;
