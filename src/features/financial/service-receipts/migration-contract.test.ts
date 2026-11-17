import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration = readFileSync(resolve(
  process.cwd(),
  "prisma/migrations/20260921190000_professional_service_receipts_stage2/migration.sql",
), "utf8");

test("migration permanece exclusivamente aditiva", () => {
  assert.doesNotMatch(migration, /\bDROP\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bRENAME\b/iu);
  assert.doesNotMatch(migration, /ALTER\s+TABLE\s+"(?!ProfessionalService|ServiceProfessionalRegistration)/iu);
});

test("pessoa fisica usa usuario canonico e Employee permanece opcional", () => {
  assert.match(migration, /"userId" UUID/iu);
  assert.match(migration, /"type" = 'INDIVIDUAL' AND "userId" IS NOT NULL/iu);
  assert.doesNotMatch(migration, /"type" = 'INDIVIDUAL' AND "employeeId" IS NOT NULL/iu);
});

test("registros profissionais combinam profissional conselho numero e UF", () => {
  assert.match(migration, /"userId", "council", "registrationHash", "regionCode"/u);
  assert.doesNotMatch(migration, /registrationHash_key/u);
});

test("alocacoes revalidam toda mutacao com bloqueio transacional", () => {
  assert.match(migration, /BEFORE INSERT OR UPDATE OR DELETE ON "ProfessionalServicePaymentAllocation"/u);
  assert.match(migration, /AFTER INSERT OR UPDATE OR DELETE ON "ProfessionalServicePaymentAllocation"/u);
  assert.match(migration, /ORDER BY p\."id" FOR UPDATE/u);
});

test("estado da cobranca e estorno sao derivados atomicamente", () => {
  assert.match(migration, /professional_service_sync_charge_status/u);
  assert.match(migration, /ProfessionalServiceCharge_status_consistent/u);
  assert.match(migration, /ProfessionalServiceRefund_apply/u);
  assert.match(migration, /SET "status" = 'REFUNDED'/u);
});

test("modelo legado e novo nao compartilham FinancialEntry", () => {
  assert.match(migration, /ProfessionalServiceCharge_no_legacy_collision/u);
  assert.match(migration, /ServiceReceipt_no_professional_collision/u);
});

test("snapshot comprovante e eventos possuem guardas persistentes", () => {
  assert.match(migration, /Snapshot_complete/u);
  assert.match(migration, /snapshotPayloadSha256/u);
  assert.match(migration, /OCTET_LENGTH\(b\."content"\)/u);
  assert.match(
    migration,
    /CREATE TABLE "ProfessionalServiceReceiptEvent"[\s\S]*"type" "ProfessionalServiceReceiptEventType" NOT NULL/u,
  );
  assert.match(migration, /ReceiptEvent_guard_insert/u);
  assert.match(migration, /CORRECTION_ISSUED/u);
});

test("regras legais e de unidade permanecem explicitas", () => {
  assert.match(migration, /bu\."legalTaxIdType" = 'CNPJ'/u);
  assert.match(migration, /lp\."taxIdType" = 'CPF'/u);
  assert.match(migration, /cu\."code" = 'CLINICA_SV'/u);
  assert.match(migration, /cu\."code" = 'ACADEMIA_SAULO_FITNESS'/u);
});
