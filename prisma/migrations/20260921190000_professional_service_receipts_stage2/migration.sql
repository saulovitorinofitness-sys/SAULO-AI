-- ETAPA 2: modelagem persistente dos recibos de prestacao de servicos.
-- Migration somente aditiva. Nao cria prestadores, unidades, profissionais,
-- cobrancas, pagamentos ou recibos e nao altera o dominio salarial existente.
-- A aplicacao exige backup testado e revisao dos triggers em banco de homologacao.

CREATE TYPE "ProfessionalServiceProviderType" AS ENUM ('LEGAL_ENTITY', 'INDIVIDUAL');
CREATE TYPE "ProfessionalServiceProviderStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ProfessionalCouncil" AS ENUM ('CRN', 'CREF');
CREATE TYPE "ProfessionalRegistrationStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ProfessionalServiceKind" AS ENUM (
  'ACADEMY_MEMBERSHIP', 'ACADEMY_SERVICE',
  'NUTRITION_CONSULTATION', 'NUTRITION_FOLLOW_UP', 'NUTRITION_STRATEGY', 'NUTRITION_PLAN',
  'POSTURAL_ASSESSMENT', 'PERSONAL_TRAINING', 'STRENGTH_TRAINING_PLAN',
  'RUNNING_PLAN', 'CYCLING_PLAN', 'PHYSICAL_FOLLOW_UP'
);
CREATE TYPE "ProfessionalServiceChargeStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');
CREATE TYPE "ProfessionalServiceReceiptStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "ProfessionalServiceSignatureMode" AS ENUM ('ELECTRONIC', 'MANUAL');
CREATE TYPE "ProfessionalServiceCpfVisibility" AS ENUM ('MASKED', 'FULL');
CREATE TYPE "ProfessionalServiceReceiptEventType" AS ENUM ('DRAFT_CREATED', 'ISSUED', 'CORRECTION_ISSUED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "ProfessionalServiceFinancialEntryClaimSource" AS ENUM ('LEGACY_SERVICE_RECEIPT', 'PROFESSIONAL_SERVICE_CHARGE');

CREATE TABLE "ProfessionalServiceLegalProvider" (
  "id" UUID NOT NULL,
  "type" "ProfessionalServiceProviderType" NOT NULL,
  "businessUnitId" UUID,
  "userId" UUID,
  "employeeId" UUID,
  "taxIdType" "EmployerTaxIdType",
  "taxIdHash" VARCHAR(64),
  "taxIdEncrypted" TEXT,
  "addressStreet" VARCHAR(180),
  "addressNumber" VARCHAR(30),
  "addressComplement" VARCHAR(120),
  "addressNeighborhood" VARCHAR(120),
  "addressPostalCode" VARCHAR(8),
  "addressCity" VARCHAR(120),
  "addressState" CHAR(2),
  "status" "ProfessionalServiceProviderStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalServiceLegalProvider_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalServiceProvider_identity" CHECK (
    ("type" = 'LEGAL_ENTITY' AND "businessUnitId" IS NOT NULL AND "userId" IS NULL
      AND "employeeId" IS NULL AND "taxIdType" IS NULL AND "taxIdHash" IS NULL AND "taxIdEncrypted" IS NULL) OR
    ("type" = 'INDIVIDUAL' AND "userId" IS NOT NULL AND "businessUnitId" IS NULL AND "taxIdType" = 'CPF')
  ),
  CONSTRAINT "ProfessionalServiceProvider_tax_hash" CHECK (
    "taxIdHash" IS NULL OR "taxIdHash" ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE "ProfessionalServiceCommercialUnit" (
  "id" UUID NOT NULL,
  "legalProviderId" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "commercialName" VARCHAR(180) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalServiceCommercialUnit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalServiceCommercialUnit_text" CHECK (
    BTRIM("code") <> '' AND BTRIM("commercialName") <> ''
  )
);

CREATE TABLE "ServiceProfessionalRegistration" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "council" "ProfessionalCouncil" NOT NULL,
  "registrationHash" VARCHAR(64) NOT NULL,
  "registrationEncrypted" TEXT NOT NULL,
  "regionCode" CHAR(2) NOT NULL,
  "status" "ProfessionalRegistrationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceProfessionalRegistration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceProfessionalRegistration_hash" CHECK ("registrationHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ServiceProfessionalRegistration_cipher" CHECK (BTRIM("registrationEncrypted") <> ''),
  CONSTRAINT "ServiceProfessionalRegistration_region" CHECK ("regionCode" ~ '^[A-Z]{2}$')
);

CREATE TABLE "ProfessionalServiceCharge" (
  "id" UUID NOT NULL,
  "legalProviderId" UUID NOT NULL,
  "masterRecordId" UUID NOT NULL,
  "financialEntryId" UUID,
  "status" "ProfessionalServiceChargeStatus" NOT NULL DEFAULT 'OPEN',
  "subtotal" DECIMAL(14,2) NOT NULL,
  "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "surcharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "amountDue" DECIMAL(14,2) NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalServiceCharge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalServiceCharge_amounts" CHECK (
    "subtotal" > 0 AND "discount" >= 0 AND "discount" <= "subtotal" AND
    "surcharge" >= 0 AND "amountDue" = "subtotal" - "discount" + "surcharge" AND "amountDue" > 0
  )
);

CREATE TABLE "ProfessionalServiceFinancialEntryClaim" (
  "financialEntryId" UUID NOT NULL,
  "source" "ProfessionalServiceFinancialEntryClaimSource" NOT NULL,
  "legacyServiceReceiptId" UUID,
  "professionalServiceChargeId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfessionalServiceFinancialEntryClaim_pkey" PRIMARY KEY ("financialEntryId"),
  CONSTRAINT "ProfessionalServiceFinancialEntryClaim_owner" CHECK (
    ("source" = 'LEGACY_SERVICE_RECEIPT' AND "legacyServiceReceiptId" IS NOT NULL AND "professionalServiceChargeId" IS NULL) OR
    ("source" = 'PROFESSIONAL_SERVICE_CHARGE' AND "professionalServiceChargeId" IS NOT NULL AND "legacyServiceReceiptId" IS NULL)
  )
);

CREATE TABLE "ProfessionalServiceChargeItem" (
  "id" UUID NOT NULL,
  "chargeId" UUID NOT NULL,
  "legalProviderId" UUID NOT NULL,
  "commercialUnitId" UUID,
  "masterRecordEntryId" UUID,
  "kind" "ProfessionalServiceKind" NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "serviceDate" DATE NOT NULL,
  "grossAmount" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfessionalServiceChargeItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalServiceChargeItem_content" CHECK (
    BTRIM("description") <> '' AND "grossAmount" > 0
  )
);

CREATE TABLE "ProfessionalServiceChargeExecutor" (
  "id" UUID NOT NULL,
  "chargeItemId" UUID NOT NULL,
  "professionalUserId" UUID NOT NULL,
  "professionalRegistrationId" UUID NOT NULL,
  "performedActivity" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfessionalServiceChargeExecutor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalServiceExecutor_activity" CHECK (BTRIM("performedActivity") <> '')
);

CREATE TABLE "ProfessionalServiceReceiptSeries" (
  "id" UUID NOT NULL,
  "legalProviderId" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "nextSequence" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalServiceReceiptSeries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalServiceSeries_values" CHECK (BTRIM("code") <> '' AND "nextSequence" > 0)
);

CREATE TABLE "ProfessionalServicePayment" (
  "id" UUID NOT NULL,
  "chargeId" UUID NOT NULL,
  "legalProviderId" UUID NOT NULL,
  "financialSettlementId" UUID NOT NULL,
  "receivedAmount" DECIMAL(14,2) NOT NULL,
  "transactionReference" VARCHAR(120),
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "requestSha256" VARCHAR(64) NOT NULL,
  "recordedByUserId" UUID NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfessionalServicePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalServicePayment_values" CHECK (
    "receivedAmount" > 0 AND BTRIM("idempotencyKey") <> '' AND "requestSha256" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "ProfessionalServicePayment_reference" CHECK (
    "transactionReference" IS NULL OR BTRIM("transactionReference") <> ''
  )
);

CREATE TABLE "ProfessionalServicePaymentAllocation" (
  "id" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "chargeItemId" UUID NOT NULL,
  "legalProviderId" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "ProfessionalServicePaymentAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalServiceAllocation_positive" CHECK ("amount" > 0)
);

CREATE TABLE "ProfessionalServicePaymentProof" (
  "id" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "storageKey" VARCHAR(500) NOT NULL,
  "originalFileName" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(80) NOT NULL,
  "byteLength" INTEGER NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "recordedByUserId" UUID NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfessionalServicePaymentProof_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalServiceProof_metadata" CHECK (
    BTRIM("storageKey") <> '' AND BTRIM("originalFileName") <> '' AND
    "mimeType" IN ('application/pdf', 'image/jpeg', 'image/png') AND
    "byteLength" BETWEEN 1 AND 10485760 AND "sha256" ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE "ProfessionalServicePaymentProofBlob" (
  "proofId" UUID NOT NULL,
  "content" BYTEA NOT NULL,
  CONSTRAINT "ProfessionalServicePaymentProofBlob_pkey" PRIMARY KEY ("proofId"),
  CONSTRAINT "ProfessionalServiceProofBlob_size" CHECK (OCTET_LENGTH("content") BETWEEN 1 AND 10485760)
);

CREATE TABLE "ProfessionalServiceReceipt" (
  "id" UUID NOT NULL,
  "legalProviderId" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "seriesId" UUID NOT NULL,
  "sequence" INTEGER,
  "status" "ProfessionalServiceReceiptStatus" NOT NULL DEFAULT 'DRAFT',
  "customerCpfHash" VARCHAR(64),
  "customerCpfEncrypted" TEXT,
  "receivedAmount" DECIMAL(14,2) NOT NULL,
  "remainingBalance" DECIMAL(14,2) NOT NULL,
  "partialPayment" BOOLEAN NOT NULL,
  "signatureMode" "ProfessionalServiceSignatureMode",
  "electronicSignatureReference" VARCHAR(500),
  "manualSignatureSpace" BOOLEAN NOT NULL DEFAULT true,
  "customerCpfVisibility" "ProfessionalServiceCpfVisibility" NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "requestSha256" VARCHAR(64) NOT NULL,
  "snapshotPayloadSha256" VARCHAR(64),
  "replacesReceiptId" UUID,
  "issuedAt" TIMESTAMP(3),
  "issuedByUserId" UUID,
  "cancelledAt" TIMESTAMP(3),
  "cancelledByUserId" UUID,
  "cancellationReason" VARCHAR(500),
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalServiceReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalServiceReceipt_values" CHECK (
    "receivedAmount" > 0 AND "remainingBalance" >= 0 AND
    BTRIM("idempotencyKey") <> '' AND "requestSha256" ~ '^[0-9a-f]{64}$' AND
    ("customerCpfHash" IS NULL OR "customerCpfHash" ~ '^[0-9a-f]{64}$') AND
    ("snapshotPayloadSha256" IS NULL OR "snapshotPayloadSha256" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "ProfessionalServiceReceipt_signature" CHECK (
    "signatureMode" <> 'ELECTRONIC' OR
    ("electronicSignatureReference" IS NOT NULL AND BTRIM("electronicSignatureReference") <> '')
  ),
  CONSTRAINT "ProfessionalServiceReceipt_cancellation" CHECK (
    ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "cancelledByUserId" IS NOT NULL
      AND "cancellationReason" IS NOT NULL AND BTRIM("cancellationReason") <> '') OR
    ("status" <> 'CANCELLED' AND "cancelledAt" IS NULL AND "cancelledByUserId" IS NULL
      AND "cancellationReason" IS NULL)
  )
);

CREATE TABLE "ProfessionalServiceReceiptSnapshot" (
  "receiptId" UUID NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "payloadCiphertext" BYTEA NOT NULL,
  "encryptionVersion" INTEGER NOT NULL,
  "payloadSha256" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfessionalServiceReceiptSnapshot_pkey" PRIMARY KEY ("receiptId"),
  CONSTRAINT "ProfessionalServiceSnapshot_values" CHECK (
    "schemaVersion" > 0 AND "encryptionVersion" > 0 AND
    OCTET_LENGTH("payloadCiphertext") > 0 AND "payloadSha256" ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE "ProfessionalServiceRefund" (
  "id" UUID NOT NULL,
  "receiptId" UUID NOT NULL,
  "type" "ProfessionalServiceReceiptEventType" NOT NULL,
  "originalPaymentId" UUID NOT NULL,
  "legalProviderId" UUID NOT NULL,
  "financialSettlementId" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "requestSha256" VARCHAR(64) NOT NULL,
  "recordedByUserId" UUID NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfessionalServiceRefund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalServiceRefund_values" CHECK (
    "amount" > 0 AND BTRIM("reason") <> '' AND BTRIM("idempotencyKey") <> ''
    AND "requestSha256" ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE "ProfessionalServiceReceiptEvent" (
  "id" UUID NOT NULL,
  "receiptId" UUID NOT NULL,
  "type" "ProfessionalServiceReceiptEventType" NOT NULL,
  "fromStatus" "ProfessionalServiceReceiptStatus",
  "toStatus" "ProfessionalServiceReceiptStatus" NOT NULL,
  "actorUserId" UUID NOT NULL,
  "reason" VARCHAR(500),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfessionalServiceReceiptEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionalServiceLegalProvider_businessUnitId_key" ON "ProfessionalServiceLegalProvider"("businessUnitId");
CREATE UNIQUE INDEX "ProfessionalServiceLegalProvider_userId_key" ON "ProfessionalServiceLegalProvider"("userId");
CREATE INDEX "ProfessionalServiceLegalProvider_type_status_idx" ON "ProfessionalServiceLegalProvider"("type", "status");
CREATE INDEX "ProfessionalServiceLegalProvider_employeeId_idx" ON "ProfessionalServiceLegalProvider"("employeeId");
CREATE INDEX "ProfessionalServiceCommercialUnit_legalProviderId_active_idx" ON "ProfessionalServiceCommercialUnit"("legalProviderId", "active");
CREATE UNIQUE INDEX "ProfessionalServiceCommercialUnit_legalProviderId_code_key" ON "ProfessionalServiceCommercialUnit"("legalProviderId", "code");
CREATE UNIQUE INDEX "ProfessionalServiceCommercialUnit_id_legalProviderId_key" ON "ProfessionalServiceCommercialUnit"("id", "legalProviderId");
CREATE INDEX "ServiceProfessionalRegistration_council_status_idx" ON "ServiceProfessionalRegistration"("council", "status");
CREATE UNIQUE INDEX "ServiceProfessionalRegistration_identity_key" ON "ServiceProfessionalRegistration"("userId", "council", "registrationHash", "regionCode");
CREATE UNIQUE INDEX "ServiceProfessionalRegistration_id_userId_key" ON "ServiceProfessionalRegistration"("id", "userId");
CREATE UNIQUE INDEX "ProfessionalServiceCharge_financialEntryId_key" ON "ProfessionalServiceCharge"("financialEntryId");
CREATE UNIQUE INDEX "ProfessionalServiceFinancialEntryClaim_legacy_key" ON "ProfessionalServiceFinancialEntryClaim"("legacyServiceReceiptId");
CREATE UNIQUE INDEX "ProfessionalServiceFinancialEntryClaim_professional_key" ON "ProfessionalServiceFinancialEntryClaim"("professionalServiceChargeId");
CREATE INDEX "ProfessionalServiceCharge_legalProviderId_status_createdAt_idx" ON "ProfessionalServiceCharge"("legalProviderId", "status", "createdAt");
CREATE INDEX "ProfessionalServiceCharge_masterRecordId_createdAt_idx" ON "ProfessionalServiceCharge"("masterRecordId", "createdAt");
CREATE INDEX "ProfessionalServiceCharge_createdByUserId_createdAt_idx" ON "ProfessionalServiceCharge"("createdByUserId", "createdAt");
CREATE UNIQUE INDEX "ProfessionalServiceCharge_id_legalProviderId_key" ON "ProfessionalServiceCharge"("id", "legalProviderId");
CREATE INDEX "ProfessionalServiceChargeItem_chargeId_kind_idx" ON "ProfessionalServiceChargeItem"("chargeId", "kind");
CREATE INDEX "ProfessionalServiceChargeItem_legalProviderId_serviceDate_idx" ON "ProfessionalServiceChargeItem"("legalProviderId", "serviceDate");
CREATE INDEX "ProfessionalServiceChargeItem_commercialUnitId_idx" ON "ProfessionalServiceChargeItem"("commercialUnitId");
CREATE INDEX "ProfessionalServiceChargeItem_masterRecordEntryId_idx" ON "ProfessionalServiceChargeItem"("masterRecordEntryId");
CREATE UNIQUE INDEX "ProfessionalServiceChargeItem_id_legalProviderId_key" ON "ProfessionalServiceChargeItem"("id", "legalProviderId");
CREATE INDEX "ProfessionalServiceChargeExecutor_professionalUserId_create_idx" ON "ProfessionalServiceChargeExecutor"("professionalUserId", "createdAt");
CREATE INDEX "ProfessionalServiceChargeExecutor_professionalRegistrationI_idx" ON "ProfessionalServiceChargeExecutor"("professionalRegistrationId");
CREATE UNIQUE INDEX "ProfessionalServiceChargeExecutor_chargeItemId_professional_key" ON "ProfessionalServiceChargeExecutor"("chargeItemId", "professionalUserId");
CREATE INDEX "ProfessionalServiceReceiptSeries_legalProviderId_idx" ON "ProfessionalServiceReceiptSeries"("legalProviderId");
CREATE UNIQUE INDEX "ProfessionalServiceReceiptSeries_legalProviderId_code_key" ON "ProfessionalServiceReceiptSeries"("legalProviderId", "code");
CREATE UNIQUE INDEX "ProfessionalServiceReceiptSeries_id_legalProviderId_key" ON "ProfessionalServiceReceiptSeries"("id", "legalProviderId");
CREATE UNIQUE INDEX "ProfessionalServicePayment_financialSettlementId_key" ON "ProfessionalServicePayment"("financialSettlementId");
CREATE UNIQUE INDEX "ProfessionalServicePayment_idempotencyKey_key" ON "ProfessionalServicePayment"("idempotencyKey");
CREATE INDEX "ProfessionalServicePayment_chargeId_recordedAt_idx" ON "ProfessionalServicePayment"("chargeId", "recordedAt");
CREATE INDEX "ProfessionalServicePayment_legalProviderId_recordedAt_idx" ON "ProfessionalServicePayment"("legalProviderId", "recordedAt");
CREATE INDEX "ProfessionalServicePayment_recordedByUserId_recordedAt_idx" ON "ProfessionalServicePayment"("recordedByUserId", "recordedAt");
CREATE UNIQUE INDEX "ProfessionalServicePayment_id_legalProviderId_key" ON "ProfessionalServicePayment"("id", "legalProviderId");
CREATE INDEX "ProfessionalServicePaymentAllocation_chargeItemId_idx" ON "ProfessionalServicePaymentAllocation"("chargeItemId");
CREATE INDEX "ProfessionalServicePaymentAllocation_legalProviderId_idx" ON "ProfessionalServicePaymentAllocation"("legalProviderId");
CREATE UNIQUE INDEX "ProfessionalServicePaymentAllocation_paymentId_chargeItemId_key" ON "ProfessionalServicePaymentAllocation"("paymentId", "chargeItemId");
CREATE UNIQUE INDEX "ProfessionalServicePaymentProof_paymentId_key" ON "ProfessionalServicePaymentProof"("paymentId");
CREATE UNIQUE INDEX "ProfessionalServicePaymentProof_storageKey_key" ON "ProfessionalServicePaymentProof"("storageKey");
CREATE UNIQUE INDEX "ProfessionalServicePaymentProof_sha256_key" ON "ProfessionalServicePaymentProof"("sha256");
CREATE INDEX "ProfessionalServicePaymentProof_recordedByUserId_recordedAt_idx" ON "ProfessionalServicePaymentProof"("recordedByUserId", "recordedAt");
CREATE UNIQUE INDEX "ProfessionalServiceReceipt_idempotencyKey_key" ON "ProfessionalServiceReceipt"("idempotencyKey");
CREATE UNIQUE INDEX "ProfessionalServiceReceipt_replacesReceiptId_key" ON "ProfessionalServiceReceipt"("replacesReceiptId");
CREATE INDEX "ProfessionalServiceReceipt_legalProviderId_status_issuedAt_idx" ON "ProfessionalServiceReceipt"("legalProviderId", "status", "issuedAt");
CREATE INDEX "ProfessionalServiceReceipt_paymentId_status_idx" ON "ProfessionalServiceReceipt"("paymentId", "status");
CREATE INDEX "ProfessionalServiceReceipt_createdByUserId_createdAt_idx" ON "ProfessionalServiceReceipt"("createdByUserId", "createdAt");
CREATE INDEX "ProfessionalServiceReceipt_issuedByUserId_issuedAt_idx" ON "ProfessionalServiceReceipt"("issuedByUserId", "issuedAt");
CREATE INDEX "ProfessionalServiceReceipt_cancelledByUserId_cancelledAt_idx" ON "ProfessionalServiceReceipt"("cancelledByUserId", "cancelledAt");
CREATE UNIQUE INDEX "ProfessionalServiceReceipt_seriesId_sequence_key" ON "ProfessionalServiceReceipt"("seriesId", "sequence");
CREATE UNIQUE INDEX "ProfessionalServiceReceipt_id_legalProviderId_key" ON "ProfessionalServiceReceipt"("id", "legalProviderId");
CREATE UNIQUE INDEX "ProfessionalServiceReceipt_one_active_payment" ON "ProfessionalServiceReceipt"("paymentId") WHERE "status" IN ('ISSUED', 'REFUNDED');
CREATE UNIQUE INDEX "ProfessionalServiceReceiptSnapshot_payloadSha256_key" ON "ProfessionalServiceReceiptSnapshot"("payloadSha256");
CREATE UNIQUE INDEX "ProfessionalServiceRefund_receiptId_key" ON "ProfessionalServiceRefund"("receiptId");
CREATE UNIQUE INDEX "ProfessionalServiceRefund_financialSettlementId_key" ON "ProfessionalServiceRefund"("financialSettlementId");
CREATE UNIQUE INDEX "ProfessionalServiceRefund_idempotencyKey_key" ON "ProfessionalServiceRefund"("idempotencyKey");
CREATE UNIQUE INDEX "ProfessionalServiceRefund_receiptId_legalProviderId_key" ON "ProfessionalServiceRefund"("receiptId", "legalProviderId");
CREATE INDEX "ProfessionalServiceReceiptEvent_receiptId_occurredAt_idx" ON "ProfessionalServiceReceiptEvent"("receiptId", "occurredAt");
CREATE INDEX "ProfessionalServiceReceiptEvent_actorUserId_occurredAt_idx" ON "ProfessionalServiceReceiptEvent"("actorUserId", "occurredAt");

ALTER TABLE "ProfessionalServiceLegalProvider" ADD CONSTRAINT "ProfessionalServiceLegalProvider_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceLegalProvider" ADD CONSTRAINT "ProfessionalServiceLegalProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceLegalProvider" ADD CONSTRAINT "ProfessionalServiceLegalProvider_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceCommercialUnit" ADD CONSTRAINT "ProfessionalServiceCommercialUnit_legalProviderId_fkey" FOREIGN KEY ("legalProviderId") REFERENCES "ProfessionalServiceLegalProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceProfessionalRegistration" ADD CONSTRAINT "ServiceProfessionalRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceCharge" ADD CONSTRAINT "ProfessionalServiceCharge_legalProviderId_fkey" FOREIGN KEY ("legalProviderId") REFERENCES "ProfessionalServiceLegalProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceCharge" ADD CONSTRAINT "ProfessionalServiceCharge_masterRecordId_fkey" FOREIGN KEY ("masterRecordId") REFERENCES "MasterRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceCharge" ADD CONSTRAINT "ProfessionalServiceCharge_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceCharge" ADD CONSTRAINT "ProfessionalServiceCharge_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceFinancialEntryClaim" ADD CONSTRAINT "ProfessionalServiceFinancialEntryClaim_entry_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceFinancialEntryClaim" ADD CONSTRAINT "ProfessionalServiceFinancialEntryClaim_legacy_fkey" FOREIGN KEY ("legacyServiceReceiptId") REFERENCES "ServiceReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceFinancialEntryClaim" ADD CONSTRAINT "ProfessionalServiceFinancialEntryClaim_professional_fkey" FOREIGN KEY ("professionalServiceChargeId") REFERENCES "ProfessionalServiceCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceChargeItem" ADD CONSTRAINT "ProfessionalServiceChargeItem_chargeId_legalProviderId_fkey" FOREIGN KEY ("chargeId", "legalProviderId") REFERENCES "ProfessionalServiceCharge"("id", "legalProviderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceChargeItem" ADD CONSTRAINT "ProfessionalServiceChargeItem_legalProviderId_fkey" FOREIGN KEY ("legalProviderId") REFERENCES "ProfessionalServiceLegalProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceChargeItem" ADD CONSTRAINT "ProfessionalServiceChargeItem_commercialUnitId_legalProvid_fkey" FOREIGN KEY ("commercialUnitId", "legalProviderId") REFERENCES "ProfessionalServiceCommercialUnit"("id", "legalProviderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceChargeItem" ADD CONSTRAINT "ProfessionalServiceChargeItem_masterRecordEntryId_fkey" FOREIGN KEY ("masterRecordEntryId") REFERENCES "MasterRecordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceChargeExecutor" ADD CONSTRAINT "ProfessionalServiceChargeExecutor_chargeItemId_fkey" FOREIGN KEY ("chargeItemId") REFERENCES "ProfessionalServiceChargeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceChargeExecutor" ADD CONSTRAINT "ProfessionalServiceChargeExecutor_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceChargeExecutor" ADD CONSTRAINT "ProfessionalServiceChargeExecutor_professionalRegistration_fkey" FOREIGN KEY ("professionalRegistrationId", "professionalUserId") REFERENCES "ServiceProfessionalRegistration"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceReceiptSeries" ADD CONSTRAINT "ProfessionalServiceReceiptSeries_legalProviderId_fkey" FOREIGN KEY ("legalProviderId") REFERENCES "ProfessionalServiceLegalProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServicePayment" ADD CONSTRAINT "ProfessionalServicePayment_chargeId_legalProviderId_fkey" FOREIGN KEY ("chargeId", "legalProviderId") REFERENCES "ProfessionalServiceCharge"("id", "legalProviderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServicePayment" ADD CONSTRAINT "ProfessionalServicePayment_legalProviderId_fkey" FOREIGN KEY ("legalProviderId") REFERENCES "ProfessionalServiceLegalProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServicePayment" ADD CONSTRAINT "ProfessionalServicePayment_financialSettlementId_fkey" FOREIGN KEY ("financialSettlementId") REFERENCES "FinancialSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServicePayment" ADD CONSTRAINT "ProfessionalServicePayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServicePaymentAllocation" ADD CONSTRAINT "ProfessionalServicePaymentAllocation_paymentId_legalProvid_fkey" FOREIGN KEY ("paymentId", "legalProviderId") REFERENCES "ProfessionalServicePayment"("id", "legalProviderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServicePaymentAllocation" ADD CONSTRAINT "ProfessionalServicePaymentAllocation_chargeItemId_legalPro_fkey" FOREIGN KEY ("chargeItemId", "legalProviderId") REFERENCES "ProfessionalServiceChargeItem"("id", "legalProviderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServicePaymentAllocation" ADD CONSTRAINT "ProfessionalServicePaymentAllocation_legalProviderId_fkey" FOREIGN KEY ("legalProviderId") REFERENCES "ProfessionalServiceLegalProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServicePaymentProof" ADD CONSTRAINT "ProfessionalServicePaymentProof_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "ProfessionalServicePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServicePaymentProof" ADD CONSTRAINT "ProfessionalServicePaymentProof_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServicePaymentProofBlob" ADD CONSTRAINT "ProfessionalServicePaymentProofBlob_proofId_fkey" FOREIGN KEY ("proofId") REFERENCES "ProfessionalServicePaymentProof"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceReceipt" ADD CONSTRAINT "ProfessionalServiceReceipt_legalProviderId_fkey" FOREIGN KEY ("legalProviderId") REFERENCES "ProfessionalServiceLegalProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceReceipt" ADD CONSTRAINT "ProfessionalServiceReceipt_paymentId_legalProviderId_fkey" FOREIGN KEY ("paymentId", "legalProviderId") REFERENCES "ProfessionalServicePayment"("id", "legalProviderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceReceipt" ADD CONSTRAINT "ProfessionalServiceReceipt_seriesId_legalProviderId_fkey" FOREIGN KEY ("seriesId", "legalProviderId") REFERENCES "ProfessionalServiceReceiptSeries"("id", "legalProviderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceReceipt" ADD CONSTRAINT "ProfessionalServiceReceipt_replacesReceiptId_fkey" FOREIGN KEY ("replacesReceiptId") REFERENCES "ProfessionalServiceReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceReceipt" ADD CONSTRAINT "ProfessionalServiceReceipt_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceReceipt" ADD CONSTRAINT "ProfessionalServiceReceipt_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceReceipt" ADD CONSTRAINT "ProfessionalServiceReceipt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceReceiptSnapshot" ADD CONSTRAINT "ProfessionalServiceReceiptSnapshot_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "ProfessionalServiceReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceRefund" ADD CONSTRAINT "ProfessionalServiceRefund_receiptId_legalProviderId_fkey" FOREIGN KEY ("receiptId", "legalProviderId") REFERENCES "ProfessionalServiceReceipt"("id", "legalProviderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceRefund" ADD CONSTRAINT "ProfessionalServiceRefund_originalPaymentId_legalProviderI_fkey" FOREIGN KEY ("originalPaymentId", "legalProviderId") REFERENCES "ProfessionalServicePayment"("id", "legalProviderId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceRefund" ADD CONSTRAINT "ProfessionalServiceRefund_legalProviderId_fkey" FOREIGN KEY ("legalProviderId") REFERENCES "ProfessionalServiceLegalProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceRefund" ADD CONSTRAINT "ProfessionalServiceRefund_financialSettlementId_fkey" FOREIGN KEY ("financialSettlementId") REFERENCES "FinancialSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceRefund" ADD CONSTRAINT "ProfessionalServiceRefund_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceReceiptEvent" ADD CONSTRAINT "ProfessionalServiceReceiptEvent_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "ProfessionalServiceReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalServiceReceiptEvent" ADD CONSTRAINT "ProfessionalServiceReceiptEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "professional_service_financial_entry_immutable"() RETURNS trigger AS $$
BEGIN
  IF OLD."financialEntryId" IS NOT NULL AND OLD."financialEntryId" IS DISTINCT FROM NEW."financialEntryId" THEN
    RAISE EXCEPTION 'Associacao financeira de recibo nao pode ser substituida';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProfessionalServiceCharge_financial_entry_immutable"
BEFORE UPDATE OF "financialEntryId" ON "ProfessionalServiceCharge"
FOR EACH ROW EXECUTE FUNCTION "professional_service_financial_entry_immutable"();

CREATE TRIGGER "ServiceReceipt_financial_entry_immutable"
BEFORE UPDATE OF "financialEntryId" ON "ServiceReceipt"
FOR EACH ROW EXECUTE FUNCTION "professional_service_financial_entry_immutable"();

CREATE FUNCTION "professional_service_claim_financial_entry"() RETURNS trigger AS $$
BEGIN
  IF NEW."financialEntryId" IS NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'ProfessionalServiceCharge' THEN
    IF EXISTS (SELECT 1 FROM "ProfessionalServiceFinancialEntryClaim" c
      WHERE c."financialEntryId" = NEW."financialEntryId" AND c."professionalServiceChargeId" = NEW."id") THEN
      RETURN NEW;
    END IF;
    INSERT INTO "ProfessionalServiceFinancialEntryClaim" (
      "financialEntryId", "source", "professionalServiceChargeId"
    ) VALUES (NEW."financialEntryId", 'PROFESSIONAL_SERVICE_CHARGE', NEW."id");
  ELSE
    IF EXISTS (SELECT 1 FROM "ProfessionalServiceFinancialEntryClaim" c
      WHERE c."financialEntryId" = NEW."financialEntryId" AND c."legacyServiceReceiptId" = NEW."id") THEN
      RETURN NEW;
    END IF;
    INSERT INTO "ProfessionalServiceFinancialEntryClaim" (
      "financialEntryId", "source", "legacyServiceReceiptId"
    ) VALUES (NEW."financialEntryId", 'LEGACY_SERVICE_RECEIPT', NEW."id");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProfessionalServiceCharge_no_legacy_collision"
AFTER INSERT OR UPDATE OF "financialEntryId" ON "ProfessionalServiceCharge"
FOR EACH ROW EXECUTE FUNCTION "professional_service_claim_financial_entry"();

CREATE TRIGGER "ServiceReceipt_no_professional_collision"
AFTER INSERT OR UPDATE OF "financialEntryId" ON "ServiceReceipt"
FOR EACH ROW EXECUTE FUNCTION "professional_service_claim_financial_entry"();

-- Reserva somente a chave financeira de eventual historico legado existente.
-- Nao converte nem modifica o documento legado.
INSERT INTO "ProfessionalServiceFinancialEntryClaim" (
  "financialEntryId", "source", "legacyServiceReceiptId"
)
SELECT "financialEntryId", 'LEGACY_SERVICE_RECEIPT', "id"
FROM "ServiceReceipt"
WHERE "financialEntryId" IS NOT NULL;

CREATE FUNCTION "professional_service_immutable_row"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Historico de recibo de servico e imutavel';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProfessionalServicePayment_immutable" BEFORE UPDATE OR DELETE ON "ProfessionalServicePayment" FOR EACH ROW EXECUTE FUNCTION "professional_service_immutable_row"();
CREATE TRIGGER "ProfessionalServiceProof_immutable" BEFORE UPDATE OR DELETE ON "ProfessionalServicePaymentProof" FOR EACH ROW EXECUTE FUNCTION "professional_service_immutable_row"();
CREATE TRIGGER "ProfessionalServiceProofBlob_immutable" BEFORE UPDATE OR DELETE ON "ProfessionalServicePaymentProofBlob" FOR EACH ROW EXECUTE FUNCTION "professional_service_immutable_row"();
CREATE TRIGGER "ProfessionalServiceSnapshot_immutable" BEFORE UPDATE OR DELETE ON "ProfessionalServiceReceiptSnapshot" FOR EACH ROW EXECUTE FUNCTION "professional_service_immutable_row"();
CREATE TRIGGER "ProfessionalServiceRefund_immutable" BEFORE UPDATE OR DELETE ON "ProfessionalServiceRefund" FOR EACH ROW EXECUTE FUNCTION "professional_service_immutable_row"();
CREATE TRIGGER "ProfessionalServiceReceiptEvent_immutable" BEFORE UPDATE OR DELETE ON "ProfessionalServiceReceiptEvent" FOR EACH ROW EXECUTE FUNCTION "professional_service_immutable_row"();

CREATE FUNCTION "professional_service_validate_proof_id"(target_proof_id UUID) RETURNS void AS $$
DECLARE declared_length INTEGER; actual_length INTEGER;
BEGIN
  SELECT p."byteLength", OCTET_LENGTH(b."content") INTO declared_length, actual_length
  FROM "ProfessionalServicePaymentProof" p
  LEFT JOIN "ProfessionalServicePaymentProofBlob" b ON b."proofId" = p."id"
  WHERE p."id" = target_proof_id;
  IF declared_length IS NULL OR actual_length IS NULL OR declared_length <> actual_length THEN
    RAISE EXCEPTION 'Tamanho real do comprovante difere dos metadados';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "professional_service_validate_proof_metadata"() RETURNS trigger AS $$
BEGIN
  PERFORM "professional_service_validate_proof_id"(NEW."id");
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "professional_service_validate_proof_blob"() RETURNS trigger AS $$
BEGIN
  PERFORM "professional_service_validate_proof_id"(NEW."proofId");
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ProfessionalServiceProof_content"
AFTER INSERT ON "ProfessionalServicePaymentProof"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "professional_service_validate_proof_metadata"();

CREATE CONSTRAINT TRIGGER "ProfessionalServiceProofBlob_content"
AFTER INSERT ON "ProfessionalServicePaymentProofBlob"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "professional_service_validate_proof_blob"();

CREATE FUNCTION "professional_service_validate_charge"() RETURNS trigger AS $$
DECLARE expected_subtotal DECIMAL(14,2);
BEGIN
  SELECT COALESCE(SUM("grossAmount"), 0) INTO expected_subtotal
  FROM "ProfessionalServiceChargeItem" WHERE "chargeId" = NEW."id";
  IF expected_subtotal <> NEW."subtotal" THEN
    RAISE EXCEPTION 'Subtotal da cobranca difere da soma dos itens';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ProfessionalServiceCharge_items_total"
AFTER INSERT OR UPDATE ON "ProfessionalServiceCharge"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "professional_service_validate_charge"();

CREATE FUNCTION "professional_service_validate_charge_item"() RETURNS trigger AS $$
DECLARE target_charge "ProfessionalServiceCharge"%ROWTYPE; expected_subtotal DECIMAL(14,2);
BEGIN
  SELECT * INTO target_charge FROM "ProfessionalServiceCharge"
    WHERE "id" = COALESCE(NEW."chargeId", OLD."chargeId");
  SELECT COALESCE(SUM("grossAmount"), 0) INTO expected_subtotal
    FROM "ProfessionalServiceChargeItem" WHERE "chargeId" = target_charge."id";
  IF expected_subtotal <> target_charge."subtotal" THEN
    RAISE EXCEPTION 'Subtotal da cobranca difere da soma dos itens';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ProfessionalServiceChargeItem_total"
AFTER INSERT OR UPDATE OR DELETE ON "ProfessionalServiceChargeItem"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "professional_service_validate_charge_item"();

CREATE FUNCTION "professional_service_sync_charge_status"(target_charge_id UUID) RETURNS void AS $$
DECLARE due_amount DECIMAL(14,2); paid_amount DECIMAL(14,2); refunded_amount DECIMAL(14,2);
DECLARE net_paid DECIMAL(14,2); expected_status "ProfessionalServiceChargeStatus";
BEGIN
  SELECT "amountDue" INTO due_amount FROM "ProfessionalServiceCharge"
    WHERE "id" = target_charge_id FOR UPDATE;
  SELECT COALESCE(SUM("receivedAmount"), 0) INTO paid_amount
    FROM "ProfessionalServicePayment" WHERE "chargeId" = target_charge_id;
  SELECT COALESCE(SUM(r."amount"), 0) INTO refunded_amount
    FROM "ProfessionalServiceRefund" r
    JOIN "ProfessionalServicePayment" p ON p."id" = r."originalPaymentId"
    WHERE p."chargeId" = target_charge_id;
  net_paid := paid_amount - refunded_amount;
  IF net_paid < 0 OR net_paid > due_amount THEN
    RAISE EXCEPTION 'Saldo pago da cobranca e invalido';
  END IF;
  expected_status := CASE
    WHEN net_paid = 0 THEN 'OPEN'::"ProfessionalServiceChargeStatus"
    WHEN net_paid = due_amount THEN 'PAID'::"ProfessionalServiceChargeStatus"
    ELSE 'PARTIALLY_PAID'::"ProfessionalServiceChargeStatus"
  END;
  UPDATE "ProfessionalServiceCharge"
    SET "status" = expected_status, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = target_charge_id AND "status" <> 'CANCELLED' AND "status" IS DISTINCT FROM expected_status;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "professional_service_lock_payment_charge"() RETURNS trigger AS $$
DECLARE charge_total DECIMAL(14,2); paid_total DECIMAL(14,2); refunded_total DECIMAL(14,2);
BEGIN
  SELECT "amountDue" INTO charge_total FROM "ProfessionalServiceCharge"
    WHERE "id" = NEW."chargeId" FOR UPDATE;
  SELECT COALESCE(SUM("receivedAmount"), 0) INTO paid_total
    FROM "ProfessionalServicePayment" WHERE "chargeId" = NEW."chargeId";
  SELECT COALESCE(SUM(r."amount"), 0) INTO refunded_total
    FROM "ProfessionalServiceRefund" r
    JOIN "ProfessionalServicePayment" p ON p."id" = r."originalPaymentId"
    WHERE p."chargeId" = NEW."chargeId";
  IF paid_total - refunded_total + NEW."receivedAmount" > charge_total THEN
    RAISE EXCEPTION 'Pagamentos ultrapassam o valor da cobranca';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProfessionalServicePayment_lock_charge"
BEFORE INSERT ON "ProfessionalServicePayment"
FOR EACH ROW EXECUTE FUNCTION "professional_service_lock_payment_charge"();

CREATE FUNCTION "professional_service_payment_sync_charge"() RETURNS trigger AS $$
BEGIN
  PERFORM "professional_service_sync_charge_status"(NEW."chargeId");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProfessionalServicePayment_sync_charge"
AFTER INSERT ON "ProfessionalServicePayment"
FOR EACH ROW EXECUTE FUNCTION "professional_service_payment_sync_charge"();

CREATE FUNCTION "professional_service_validate_payment"() RETURNS trigger AS $$
DECLARE allocated DECIMAL(14,2); charge_total DECIMAL(14,2); paid_total DECIMAL(14,2); refunded_total DECIMAL(14,2);
DECLARE settlement_amount DECIMAL(14,2); settlement_entry UUID; charge_entry UUID; method_type "PaymentMethodType"; entry_type "FinancialEntryType";
BEGIN
  SELECT COALESCE(SUM("amount"), 0) INTO allocated
  FROM "ProfessionalServicePaymentAllocation" WHERE "paymentId" = NEW."id";
  IF allocated <> NEW."receivedAmount" THEN
    RAISE EXCEPTION 'Distribuicao do pagamento difere do valor recebido';
  END IF;
  SELECT c."amountDue", c."financialEntryId" INTO charge_total, charge_entry
  FROM "ProfessionalServiceCharge" c WHERE c."id" = NEW."chargeId";
  SELECT COALESCE(SUM("receivedAmount"), 0) INTO paid_total
  FROM "ProfessionalServicePayment" WHERE "chargeId" = NEW."chargeId";
  SELECT COALESCE(SUM(r."amount"), 0) INTO refunded_total
    FROM "ProfessionalServiceRefund" r
    JOIN "ProfessionalServicePayment" p ON p."id" = r."originalPaymentId"
    WHERE p."chargeId" = NEW."chargeId";
  IF paid_total - refunded_total > charge_total THEN RAISE EXCEPTION 'Pagamentos ultrapassam o valor da cobranca'; END IF;
  SELECT fs."amount", fs."financialEntryId", pm."type", fe."type"
    INTO settlement_amount, settlement_entry, method_type, entry_type
  FROM "FinancialSettlement" fs
  JOIN "PaymentMethod" pm ON pm."id" = fs."paymentMethodId"
  JOIN "FinancialEntry" fe ON fe."id" = fs."financialEntryId"
  WHERE fs."id" = NEW."financialSettlementId";
  IF settlement_amount <> NEW."receivedAmount" OR charge_entry IS NULL OR settlement_entry <> charge_entry OR entry_type <> 'REVENUE' THEN
    RAISE EXCEPTION 'Pagamento nao corresponde a liquidacao financeira canonica';
  END IF;
  IF method_type NOT IN ('CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER') THEN
    RAISE EXCEPTION 'Forma de pagamento nao permitida para recibo de servico';
  END IF;
  PERFORM "professional_service_sync_charge_status"(NEW."chargeId");
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ProfessionalServicePayment_complete"
AFTER INSERT ON "ProfessionalServicePayment"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "professional_service_validate_payment"();

CREATE FUNCTION "professional_service_lock_allocation_payment"() RETURNS trigger AS $$
DECLARE payment_ids UUID[];
BEGIN
  payment_ids := CASE
    WHEN TG_OP = 'INSERT' THEN ARRAY[NEW."paymentId"]
    WHEN TG_OP = 'DELETE' THEN ARRAY[OLD."paymentId"]
    ELSE ARRAY[OLD."paymentId", NEW."paymentId"]
  END;
  IF EXISTS (
    SELECT 1 FROM "ProfessionalServiceReceipt" r
    WHERE r."paymentId" = ANY(payment_ids) AND r."status" <> 'DRAFT'
  ) THEN RAISE EXCEPTION 'Alocacoes de pagamento documentado sao imutaveis'; END IF;
  PERFORM 1 FROM "ProfessionalServicePayment" p
    WHERE p."id" = ANY(payment_ids) ORDER BY p."id" FOR UPDATE;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProfessionalServiceAllocation_lock"
BEFORE INSERT OR UPDATE OR DELETE ON "ProfessionalServicePaymentAllocation"
FOR EACH ROW EXECUTE FUNCTION "professional_service_lock_allocation_payment"();

CREATE FUNCTION "professional_service_validate_allocation_change"() RETURNS trigger AS $$
DECLARE payment_id UUID; received DECIMAL(14,2); allocated DECIMAL(14,2);
BEGIN
  FOR payment_id IN
    SELECT DISTINCT value FROM unnest(CASE
      WHEN TG_OP = 'INSERT' THEN ARRAY[NEW."paymentId"]
      WHEN TG_OP = 'DELETE' THEN ARRAY[OLD."paymentId"]
      ELSE ARRAY[OLD."paymentId", NEW."paymentId"]
    END) AS value
  LOOP
    SELECT "receivedAmount" INTO received FROM "ProfessionalServicePayment" WHERE "id" = payment_id;
    SELECT COALESCE(SUM("amount"), 0) INTO allocated
      FROM "ProfessionalServicePaymentAllocation" WHERE "paymentId" = payment_id;
    IF received IS NOT NULL AND allocated <> received THEN
      RAISE EXCEPTION 'Distribuicao do pagamento difere do valor recebido';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ProfessionalServiceAllocation_complete"
AFTER INSERT OR UPDATE OR DELETE ON "ProfessionalServicePaymentAllocation"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "professional_service_validate_allocation_change"();

CREATE FUNCTION "professional_service_reserve_number"() RETURNS trigger AS $$
DECLARE expected_sequence INTEGER;
BEGIN
  IF NEW."status" = 'ISSUED' AND (TG_OP = 'INSERT' OR OLD."status" = 'DRAFT') THEN
    SELECT "nextSequence" INTO expected_sequence
    FROM "ProfessionalServiceReceiptSeries"
    WHERE "id" = NEW."seriesId" AND "legalProviderId" = NEW."legalProviderId"
    FOR UPDATE;
    IF expected_sequence IS NULL THEN RAISE EXCEPTION 'Serie invalida para o prestador'; END IF;
    IF NEW."sequence" IS NOT NULL AND NEW."sequence" <> expected_sequence THEN
      RAISE EXCEPTION 'Sequencia nao corresponde ao proximo numero da serie';
    END IF;
    NEW."sequence" := expected_sequence;
    UPDATE "ProfessionalServiceReceiptSeries"
      SET "nextSequence" = expected_sequence + 1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = NEW."seriesId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProfessionalServiceReceipt_reserve_number"
BEFORE INSERT OR UPDATE ON "ProfessionalServiceReceipt"
FOR EACH ROW EXECUTE FUNCTION "professional_service_reserve_number"();

CREATE FUNCTION "professional_service_receipt_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Recibo de servico nao pode ser excluido'; END IF;
  IF OLD."status" = 'DRAFT' THEN
    IF NEW."status" NOT IN ('DRAFT', 'ISSUED') THEN RAISE EXCEPTION 'Transicao de recibo invalida'; END IF;
    RETURN NEW;
  END IF;
  IF OLD."status" = 'ISSUED' AND NEW."status" IN ('CANCELLED', 'REFUNDED') THEN
    IF OLD."id" IS DISTINCT FROM NEW."id" OR OLD."legalProviderId" IS DISTINCT FROM NEW."legalProviderId"
      OR OLD."paymentId" IS DISTINCT FROM NEW."paymentId" OR OLD."seriesId" IS DISTINCT FROM NEW."seriesId"
      OR OLD."sequence" IS DISTINCT FROM NEW."sequence" OR OLD."customerCpfHash" IS DISTINCT FROM NEW."customerCpfHash"
      OR OLD."customerCpfEncrypted" IS DISTINCT FROM NEW."customerCpfEncrypted"
      OR OLD."receivedAmount" IS DISTINCT FROM NEW."receivedAmount" OR OLD."remainingBalance" IS DISTINCT FROM NEW."remainingBalance"
      OR OLD."partialPayment" IS DISTINCT FROM NEW."partialPayment" OR OLD."signatureMode" IS DISTINCT FROM NEW."signatureMode"
      OR OLD."electronicSignatureReference" IS DISTINCT FROM NEW."electronicSignatureReference"
      OR OLD."manualSignatureSpace" IS DISTINCT FROM NEW."manualSignatureSpace"
      OR OLD."customerCpfVisibility" IS DISTINCT FROM NEW."customerCpfVisibility"
      OR OLD."idempotencyKey" IS DISTINCT FROM NEW."idempotencyKey" OR OLD."requestSha256" IS DISTINCT FROM NEW."requestSha256"
      OR OLD."snapshotPayloadSha256" IS DISTINCT FROM NEW."snapshotPayloadSha256"
      OR OLD."replacesReceiptId" IS DISTINCT FROM NEW."replacesReceiptId"
      OR OLD."issuedAt" IS DISTINCT FROM NEW."issuedAt" OR OLD."issuedByUserId" IS DISTINCT FROM NEW."issuedByUserId"
      OR OLD."createdByUserId" IS DISTINCT FROM NEW."createdByUserId" OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt" THEN
      RAISE EXCEPTION 'Conteudo de recibo emitido e imutavel';
    END IF;
    IF NEW."status" = 'CANCELLED' AND NEW."cancelledByUserId" <> '00000000-0000-4000-8000-000000000001'::uuid THEN
      RAISE EXCEPTION 'Cancelamento reservado a Saulo Xavier Vitorino';
    END IF;
    IF NEW."status" = 'REFUNDED' AND NOT EXISTS (
      SELECT 1 FROM "ProfessionalServiceRefund" r WHERE r."receiptId" = NEW."id"
    ) THEN RAISE EXCEPTION 'Estado estornado exige registro financeiro na mesma transacao'; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Recibo cancelado ou estornado e imutavel';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProfessionalServiceReceipt_guard"
BEFORE UPDATE OR DELETE ON "ProfessionalServiceReceipt"
FOR EACH ROW EXECUTE FUNCTION "professional_service_receipt_guard"();

CREATE FUNCTION "professional_service_require_complete_receipt"() RETURNS trigger AS $$
DECLARE charge_id UUID; charge_total DECIMAL(14,2); payment_amount DECIMAL(14,2); paid_total DECIMAL(14,2); refunded_total DECIMAL(14,2);
DECLARE customer_has_cpf BOOLEAN; provider_type "ProfessionalServiceProviderType"; provider_user UUID;
DECLARE invalid_items INTEGER; correction_valid BOOLEAN;
BEGIN
  IF NEW."status" = 'DRAFT' THEN RETURN NEW; END IF;
  IF NEW."status" = 'CANCELLED' THEN RETURN NEW; END IF;
  IF NEW."status" = 'REFUNDED' THEN
    IF NOT EXISTS (SELECT 1 FROM "ProfessionalServiceRefund" r WHERE r."receiptId" = NEW."id") THEN
      RAISE EXCEPTION 'Estado estornado exige registro financeiro separado';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."sequence" IS NULL OR NEW."issuedAt" IS NULL OR NEW."issuedByUserId" IS NULL
    OR NEW."customerCpfHash" IS NULL OR NEW."customerCpfEncrypted" IS NULL
    OR NEW."signatureMode" IS NULL OR NOT NEW."manualSignatureSpace"
    OR NEW."snapshotPayloadSha256" IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM "ProfessionalServiceReceiptSnapshot" s
      WHERE s."receiptId" = NEW."id" AND s."payloadSha256" = NEW."snapshotPayloadSha256"
    ) THEN
    RAISE EXCEPTION 'Emissao formal exige numero, CPF, assinatura, emissor e snapshot';
  END IF;

  SELECT p."chargeId", p."receivedAmount", c."amountDue",
    EXISTS (
      SELECT 1 FROM "ProfessionalServiceCharge" cx
      JOIN "MasterRecord" mr ON mr."id" = cx."masterRecordId"
      JOIN "Patient" pt ON pt."id" = mr."patientId"
      WHERE cx."id" = p."chargeId" AND pt."cpf" IS NOT NULL AND BTRIM(pt."cpf") <> ''
    )
    INTO charge_id, payment_amount, charge_total, customer_has_cpf
  FROM "ProfessionalServicePayment" p
  JOIN "ProfessionalServiceCharge" c ON c."id" = p."chargeId"
  WHERE p."id" = NEW."paymentId" AND p."legalProviderId" = NEW."legalProviderId";
  IF payment_amount IS NULL OR NEW."receivedAmount" <> payment_amount OR NOT customer_has_cpf THEN
    RAISE EXCEPTION 'Recibo nao corresponde ao pagamento ou cliente sem CPF';
  END IF;
  SELECT COALESCE(SUM("receivedAmount"), 0) INTO paid_total
  FROM "ProfessionalServicePayment" WHERE "chargeId" = charge_id;
  SELECT COALESCE(SUM(r."amount"), 0) INTO refunded_total
    FROM "ProfessionalServiceRefund" r
    JOIN "ProfessionalServicePayment" p ON p."id" = r."originalPaymentId"
    WHERE p."chargeId" = charge_id;
  IF NEW."remainingBalance" <> charge_total - (paid_total - refunded_total)
    OR NEW."partialPayment" <> (charge_total - (paid_total - refunded_total) > 0) THEN
    RAISE EXCEPTION 'Saldo ou indicacao de pagamento parcial incorretos';
  END IF;

  SELECT lp."type", lp."userId" INTO provider_type, provider_user
  FROM "ProfessionalServiceLegalProvider" lp
  WHERE lp."id" = NEW."legalProviderId" AND lp."status" = 'ACTIVE';
  IF provider_type IS NULL THEN RAISE EXCEPTION 'Prestador legal inativo ou ausente'; END IF;
  IF provider_type = 'LEGAL_ENTITY' AND NOT EXISTS (
    SELECT 1 FROM "ProfessionalServiceLegalProvider" lp
    JOIN "BusinessUnit" bu ON bu."id" = lp."businessUnitId"
    WHERE lp."id" = NEW."legalProviderId" AND bu."code" = 'ACADEMIA' AND bu."status" = 'ACTIVE'
      AND bu."legalTaxIdType" = 'CNPJ' AND bu."legalName" IS NOT NULL AND BTRIM(bu."legalName") <> ''
      AND bu."tradeName" IS NOT NULL AND BTRIM(bu."tradeName") <> '' AND bu."legalTaxIdEncrypted" IS NOT NULL
      AND bu."addressStreet" IS NOT NULL AND bu."addressNumber" IS NOT NULL
      AND bu."addressNeighborhood" IS NOT NULL AND bu."addressPostalCode" IS NOT NULL
      AND bu."addressCity" IS NOT NULL AND bu."addressState" IS NOT NULL
  ) THEN RAISE EXCEPTION 'Dados legais da pessoa juridica incompletos'; END IF;
  IF provider_type = 'INDIVIDUAL' AND NOT EXISTS (
    SELECT 1 FROM "ProfessionalServiceLegalProvider" lp
    JOIN "User" u ON u."id" = lp."userId" AND u."status" = 'ACTIVE'
    JOIN "UserProfile" up ON up."userId" = u."id"
    WHERE lp."id" = NEW."legalProviderId" AND lp."taxIdType" = 'CPF'
      AND lp."taxIdHash" IS NOT NULL AND lp."taxIdEncrypted" IS NOT NULL
      AND lp."addressStreet" IS NOT NULL AND lp."addressNumber" IS NOT NULL
      AND lp."addressNeighborhood" IS NOT NULL AND lp."addressPostalCode" IS NOT NULL
      AND lp."addressCity" IS NOT NULL AND lp."addressState" IS NOT NULL
  ) THEN RAISE EXCEPTION 'Dados legais da pessoa fisica incompletos'; END IF;

  SELECT COUNT(*) INTO invalid_items
  FROM "ProfessionalServiceChargeItem" i
  WHERE i."chargeId" = charge_id AND (
    (i."masterRecordEntryId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "MasterRecordEntry" mre
      JOIN "ProfessionalServiceCharge" c ON c."masterRecordId" = mre."masterRecordId"
      WHERE mre."id" = i."masterRecordEntryId" AND c."id" = i."chargeId"
    )) OR
    (i."kind" IN ('NUTRITION_CONSULTATION', 'NUTRITION_FOLLOW_UP', 'NUTRITION_STRATEGY', 'NUTRITION_PLAN') AND (
      provider_type <> 'LEGAL_ENTITY' OR NOT EXISTS (
        SELECT 1 FROM "ProfessionalServiceCommercialUnit" cu
        WHERE cu."id" = i."commercialUnitId" AND cu."legalProviderId" = NEW."legalProviderId"
          AND cu."code" = 'CLINICA_SV' AND cu."active"
      ) OR (SELECT COUNT(*) FROM "ProfessionalServiceChargeExecutor" x
        JOIN "ServiceProfessionalRegistration" r ON r."id" = x."professionalRegistrationId"
        WHERE x."chargeItemId" = i."id" AND x."professionalUserId" = '00000000-0000-4000-8000-000000000001'::uuid
          AND r."council" = 'CRN' AND r."status" = 'ACTIVE') <> 1
      OR (SELECT COUNT(*) FROM "ProfessionalServiceChargeExecutor" x WHERE x."chargeItemId" = i."id") <> 1
    )) OR
    (i."kind" NOT IN ('NUTRITION_CONSULTATION', 'NUTRITION_FOLLOW_UP', 'NUTRITION_STRATEGY', 'NUTRITION_PLAN')
      AND provider_type = 'LEGAL_ENTITY' AND NOT EXISTS (
        SELECT 1 FROM "ProfessionalServiceCommercialUnit" cu
        WHERE cu."id" = i."commercialUnitId" AND cu."legalProviderId" = NEW."legalProviderId"
          AND cu."code" = 'ACADEMIA_SAULO_FITNESS' AND cu."active"
      )) OR
    (provider_type = 'INDIVIDUAL' AND i."commercialUnitId" IS NOT NULL) OR
    (i."kind" IN ('POSTURAL_ASSESSMENT', 'PERSONAL_TRAINING', 'STRENGTH_TRAINING_PLAN', 'RUNNING_PLAN', 'CYCLING_PLAN', 'PHYSICAL_FOLLOW_UP') AND (
      (SELECT COUNT(*) FROM "ProfessionalServiceChargeExecutor" x
        JOIN "ServiceProfessionalRegistration" r ON r."id" = x."professionalRegistrationId"
        WHERE x."chargeItemId" = i."id" AND x."professionalUserId" IN (
          '00000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000002'::uuid)
          AND r."council" = 'CREF' AND r."status" = 'ACTIVE') NOT BETWEEN 1 AND 2
      OR (SELECT COUNT(*) FROM "ProfessionalServiceChargeExecutor" x WHERE x."chargeItemId" = i."id") NOT BETWEEN 1 AND 2
    )) OR
    (i."kind" = 'ACADEMY_MEMBERSHIP' AND EXISTS (
      SELECT 1 FROM "ProfessionalServiceChargeExecutor" x WHERE x."chargeItemId" = i."id"
    )) OR
    (i."kind" = 'ACADEMY_SERVICE' AND EXISTS (
      SELECT 1 FROM "ProfessionalServiceChargeExecutor" x
      JOIN "ServiceProfessionalRegistration" r ON r."id" = x."professionalRegistrationId"
      WHERE x."chargeItemId" = i."id" AND (
        x."professionalUserId" NOT IN (
          '00000000-0000-4000-8000-000000000001'::uuid,
          '00000000-0000-4000-8000-000000000002'::uuid
        ) OR r."council" <> 'CREF' OR r."status" <> 'ACTIVE'
      )
    )) OR
    (i."kind" = 'ACADEMY_SERVICE' AND (
      SELECT COUNT(*) FROM "ProfessionalServiceChargeExecutor" x WHERE x."chargeItemId" = i."id"
    ) > 2)
  );
  IF invalid_items > 0 THEN RAISE EXCEPTION 'Responsabilidade profissional invalida para um ou mais servicos'; END IF;
  IF provider_type = 'INDIVIDUAL' AND (
    provider_user NOT IN ('00000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000002'::uuid)
    OR EXISTS (SELECT 1 FROM "ProfessionalServiceChargeItem" i WHERE i."chargeId" = charge_id
      AND i."kind" IN ('ACADEMY_MEMBERSHIP', 'ACADEMY_SERVICE', 'NUTRITION_CONSULTATION', 'NUTRITION_FOLLOW_UP', 'NUTRITION_STRATEGY', 'NUTRITION_PLAN'))
  ) THEN RAISE EXCEPTION 'Prestador pessoa fisica nao autorizado para o servico'; END IF;
  IF provider_type = 'INDIVIDUAL' AND NOT EXISTS (
    SELECT 1 FROM "ServiceProfessionalRegistration" r
    WHERE r."userId" = provider_user AND r."council" = 'CREF' AND r."status" = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'Prestador pessoa fisica exige CREF ativo'; END IF;

  IF NEW."issuedByUserId" NOT IN (
    '00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000002'::uuid
  ) THEN RAISE EXCEPTION 'Usuario sem permissao para emitir recibo'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "User" u JOIN "UserProfile" up ON up."userId" = u."id"
    WHERE u."id" = NEW."issuedByUserId" AND u."status" = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'Emissor sem usuario e perfil ativos'; END IF;
  IF NEW."issuedByUserId" = '00000000-0000-4000-8000-000000000001'::uuid
    AND EXISTS (SELECT 1 FROM "ProfessionalServiceChargeItem" i WHERE i."chargeId" = charge_id
      AND i."kind" IN ('NUTRITION_CONSULTATION', 'NUTRITION_FOLLOW_UP', 'NUTRITION_STRATEGY', 'NUTRITION_PLAN'))
    AND NOT EXISTS (SELECT 1 FROM "ServiceProfessionalRegistration" r
      WHERE r."userId" = NEW."issuedByUserId" AND r."council" = 'CRN' AND r."status" = 'ACTIVE')
  THEN RAISE EXCEPTION 'Emissao de Nutricao exige CRN ativo de Saulo'; END IF;
  IF NEW."issuedByUserId" = '00000000-0000-4000-8000-000000000001'::uuid
    AND EXISTS (SELECT 1 FROM "ProfessionalServiceChargeItem" i WHERE i."chargeId" = charge_id
      AND i."kind" IN ('POSTURAL_ASSESSMENT', 'PERSONAL_TRAINING', 'STRENGTH_TRAINING_PLAN', 'RUNNING_PLAN', 'CYCLING_PLAN', 'PHYSICAL_FOLLOW_UP'))
    AND NOT EXISTS (SELECT 1 FROM "ServiceProfessionalRegistration" r
      WHERE r."userId" = NEW."issuedByUserId" AND r."council" = 'CREF' AND r."status" = 'ACTIVE')
  THEN RAISE EXCEPTION 'Emissao de Educacao Fisica exige CREF ativo de Saulo'; END IF;
  IF NEW."issuedByUserId" = '00000000-0000-4000-8000-000000000002'::uuid AND (
    EXISTS (SELECT 1 FROM "ProfessionalServiceChargeItem" i WHERE i."chargeId" = charge_id
      AND i."kind" NOT IN ('POSTURAL_ASSESSMENT', 'PERSONAL_TRAINING', 'STRENGTH_TRAINING_PLAN', 'RUNNING_PLAN', 'CYCLING_PLAN', 'PHYSICAL_FOLLOW_UP'))
    OR NOT (provider_user = NEW."issuedByUserId" OR EXISTS (
      SELECT 1 FROM "ProfessionalServiceChargeExecutor" x
      JOIN "ProfessionalServiceChargeItem" i ON i."id" = x."chargeItemId"
      WHERE i."chargeId" = charge_id AND x."professionalUserId" = NEW."issuedByUserId"
    )) OR NOT EXISTS (
      SELECT 1 FROM "ServiceProfessionalRegistration" r
      WHERE r."userId" = NEW."issuedByUserId" AND r."council" = 'CREF' AND r."status" = 'ACTIVE'
    )
  ) THEN RAISE EXCEPTION 'Maria nao pode emitir este recibo'; END IF;

  IF NEW."replacesReceiptId" IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM "ProfessionalServiceReceipt" old
      WHERE old."id" = NEW."replacesReceiptId" AND old."status" = 'CANCELLED'
        AND old."legalProviderId" = NEW."legalProviderId" AND old."id" <> NEW."id"
    ) INTO correction_valid;
    IF NOT correction_valid THEN RAISE EXCEPTION 'Correcao exige recibo anterior cancelado do mesmo prestador'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ProfessionalServiceReceipt_complete"
AFTER INSERT OR UPDATE ON "ProfessionalServiceReceipt"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "professional_service_require_complete_receipt"();

CREATE FUNCTION "professional_service_validate_snapshot"() RETURNS trigger AS $$
DECLARE receipt_status "ProfessionalServiceReceiptStatus"; receipt_hash VARCHAR(64);
BEGIN
  SELECT r."status", r."snapshotPayloadSha256" INTO receipt_status, receipt_hash
  FROM "ProfessionalServiceReceipt" r WHERE r."id" = NEW."receiptId";
  IF receipt_status = 'DRAFT' THEN
    RAISE EXCEPTION 'Snapshot definitivo nao pode pertencer a rascunho';
  END IF;
  IF receipt_hash IS NULL OR receipt_hash <> NEW."payloadSha256" THEN
    RAISE EXCEPTION 'Snapshot nao corresponde ao conteudo emitido';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ProfessionalServiceSnapshot_complete"
AFTER INSERT ON "ProfessionalServiceReceiptSnapshot"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "professional_service_validate_snapshot"();

CREATE FUNCTION "professional_service_validate_charge_status"() RETURNS trigger AS $$
DECLARE paid DECIMAL(14,2); refunded DECIMAL(14,2); due_amount DECIMAL(14,2);
DECLARE current_status "ProfessionalServiceChargeStatus"; expected "ProfessionalServiceChargeStatus";
BEGIN
  SELECT "amountDue", "status" INTO due_amount, current_status
    FROM "ProfessionalServiceCharge" WHERE "id" = NEW."id";
  IF current_status = 'CANCELLED' THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM("receivedAmount"), 0) INTO paid
    FROM "ProfessionalServicePayment" WHERE "chargeId" = NEW."id";
  SELECT COALESCE(SUM(r."amount"), 0) INTO refunded
    FROM "ProfessionalServiceRefund" r
    JOIN "ProfessionalServicePayment" p ON p."id" = r."originalPaymentId"
    WHERE p."chargeId" = NEW."id";
  expected := CASE
    WHEN paid - refunded = 0 THEN 'OPEN'::"ProfessionalServiceChargeStatus"
    WHEN paid - refunded = due_amount THEN 'PAID'::"ProfessionalServiceChargeStatus"
    ELSE 'PARTIALLY_PAID'::"ProfessionalServiceChargeStatus"
  END;
  IF paid - refunded < 0 OR paid - refunded > due_amount OR current_status <> expected THEN
    RAISE EXCEPTION 'Estado da cobranca diverge dos pagamentos validos';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ProfessionalServiceCharge_status_consistent"
AFTER INSERT OR UPDATE ON "ProfessionalServiceCharge"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION "professional_service_validate_charge_status"();

CREATE FUNCTION "professional_service_validate_refund"() RETURNS trigger AS $$
DECLARE receipt_amount DECIMAL(14,2); settlement_amount DECIMAL(14,2); receipt_payment UUID; entry_type "FinancialEntryType";
BEGIN
  IF NEW."recordedByUserId" <> '00000000-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'Estorno reservado a Saulo Xavier Vitorino';
  END IF;
  SELECT "receivedAmount", "paymentId" INTO receipt_amount, receipt_payment
  FROM "ProfessionalServiceReceipt" WHERE "id" = NEW."receiptId" AND "status" = 'ISSUED' FOR UPDATE;
  SELECT fs."amount", fe."type" INTO settlement_amount, entry_type
  FROM "FinancialSettlement" fs
  JOIN "FinancialEntry" fe ON fe."id" = fs."financialEntryId"
  WHERE fs."id" = NEW."financialSettlementId";
  IF receipt_amount IS NULL OR receipt_payment <> NEW."originalPaymentId"
    OR NEW."amount" <> receipt_amount OR settlement_amount <> NEW."amount" OR entry_type <> 'EXPENSE' THEN
    RAISE EXCEPTION 'Estorno deve corresponder integralmente ao recibo e a liquidacao';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProfessionalServiceRefund_validate"
BEFORE INSERT ON "ProfessionalServiceRefund"
FOR EACH ROW EXECUTE FUNCTION "professional_service_validate_refund"();

CREATE FUNCTION "professional_service_apply_refund"() RETURNS trigger AS $$
DECLARE target_charge_id UUID;
BEGIN
  UPDATE "ProfessionalServiceReceipt"
    SET "status" = 'REFUNDED', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = NEW."receiptId" AND "status" = 'ISSUED';
  IF NOT FOUND THEN RAISE EXCEPTION 'Estorno exige recibo emitido'; END IF;
  SELECT "chargeId" INTO target_charge_id FROM "ProfessionalServicePayment"
    WHERE "id" = NEW."originalPaymentId";
  PERFORM "professional_service_sync_charge_status"(target_charge_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProfessionalServiceRefund_apply"
AFTER INSERT ON "ProfessionalServiceRefund"
FOR EACH ROW EXECUTE FUNCTION "professional_service_apply_refund"();

CREATE FUNCTION "professional_service_guard_event_insert"() RETURNS trigger AS $$
BEGIN
  IF pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Eventos de recibo somente podem ser criados por operacoes documentais';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProfessionalServiceReceiptEvent_guard_insert"
BEFORE INSERT ON "ProfessionalServiceReceiptEvent"
FOR EACH ROW EXECUTE FUNCTION "professional_service_guard_event_insert"();

CREATE FUNCTION "professional_service_receipt_event"() RETURNS trigger AS $$
DECLARE actor UUID; event_reason TEXT; event_type "ProfessionalServiceReceiptEventType";
BEGIN
  IF TG_OP = 'INSERT' THEN
    actor := CASE WHEN NEW."status" = 'ISSUED' THEN NEW."issuedByUserId" ELSE NEW."createdByUserId" END;
    event_type := CASE
      WHEN NEW."status" = 'DRAFT' THEN 'DRAFT_CREATED'::"ProfessionalServiceReceiptEventType"
      WHEN NEW."replacesReceiptId" IS NOT NULL THEN 'CORRECTION_ISSUED'::"ProfessionalServiceReceiptEventType"
      ELSE 'ISSUED'::"ProfessionalServiceReceiptEventType"
    END;
    INSERT INTO "ProfessionalServiceReceiptEvent" ("id", "receiptId", "type", "fromStatus", "toStatus", "actorUserId", "reason")
      VALUES (gen_random_uuid(), NEW."id", event_type, NULL, NEW."status", actor, NULL);
  ELSIF OLD."status" IS DISTINCT FROM NEW."status" THEN
    IF NEW."status" = 'CANCELLED' THEN
      actor := NEW."cancelledByUserId";
      event_type := 'CANCELLED';
    ELSIF NEW."status" = 'REFUNDED' THEN
      SELECT "recordedByUserId", "reason" INTO actor, event_reason
        FROM "ProfessionalServiceRefund" WHERE "receiptId" = NEW."id";
      event_type := 'REFUNDED';
    ELSE
      actor := NEW."issuedByUserId";
      event_type := CASE WHEN NEW."replacesReceiptId" IS NOT NULL
        THEN 'CORRECTION_ISSUED'::"ProfessionalServiceReceiptEventType"
        ELSE 'ISSUED'::"ProfessionalServiceReceiptEventType" END;
    END IF;
    IF NEW."status" = 'CANCELLED' THEN event_reason := NEW."cancellationReason"; END IF;
    INSERT INTO "ProfessionalServiceReceiptEvent" ("id", "receiptId", "type", "fromStatus", "toStatus", "actorUserId", "reason")
      VALUES (gen_random_uuid(), NEW."id", event_type, OLD."status", NEW."status", actor, event_reason);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProfessionalServiceReceipt_history"
AFTER INSERT OR UPDATE ON "ProfessionalServiceReceipt"
FOR EACH ROW EXECUTE FUNCTION "professional_service_receipt_event"();
