import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import pg, { type PoolClient } from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for database integration tests");
}

const parsedTestUrl = new URL(testDatabaseUrl);
assert.match(
  parsedTestUrl.pathname,
  /(?:^|[_-])test(?:[_-]|$)/iu,
  "TEST_DATABASE_URL must identify an isolated test database",
);

const pool = new pg.Pool({ connectionString: testDatabaseUrl, max: 12 });

const SAULO_ID = "00000000-0000-4000-8000-000000000001";
const MARIA_ID = "00000000-0000-4000-8000-000000000002";
const FIXTURE = {
  moduleId: randomUUID(),
  patientId: randomUUID(),
  masterRecordId: randomUUID(),
  businessUnitId: randomUUID(),
  providerId: randomUUID(),
  mariaProviderId: randomUUID(),
  mariaRegistrationId: randomUUID(),
  commercialUnitId: randomUUID(),
  revenueCategoryId: randomUUID(),
  expenseCategoryId: randomUUID(),
  accountId: randomUUID(),
  pixMethodId: randomUUID(),
  seriesId: randomUUID(),
};

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createFinancialEntry(
  client: PoolClient,
  type: "REVENUE" | "EXPENSE",
  amount: string,
): Promise<string> {
  const id = randomUUID();
  await client.query(`
    INSERT INTO "FinancialEntry" (
      "id", "type", "competence", "dueDate", "amount", "description",
      "businessUnitId", "financialCategoryId", "financialAccountId",
      "paymentMethodId", "updatedAt"
    ) VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
  `, [
    id,
    type,
    amount,
    `INTEGRATION_TEST_${id}`,
    FIXTURE.businessUnitId,
    type === "REVENUE" ? FIXTURE.revenueCategoryId : FIXTURE.expenseCategoryId,
    FIXTURE.accountId,
    FIXTURE.pixMethodId,
  ]);
  return id;
}

async function createCharge(amount = "100.00", financialEntryId?: string) {
  return transaction(async (client) => {
    const entryId = financialEntryId
      ?? await createFinancialEntry(client, "REVENUE", amount);
    const chargeId = randomUUID();
    const itemId = randomUUID();
    await client.query(`
      INSERT INTO "ProfessionalServiceCharge" (
        "id", "legalProviderId", "masterRecordId", "financialEntryId",
        "subtotal", "discount", "surcharge", "amountDue",
        "createdByUserId", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, 0, 0, $5, $6, CURRENT_TIMESTAMP)
    `, [chargeId, FIXTURE.providerId, FIXTURE.masterRecordId, entryId, amount, SAULO_ID]);
    await client.query(`
      INSERT INTO "ProfessionalServiceChargeItem" (
        "id", "chargeId", "legalProviderId", "commercialUnitId", "kind",
        "description", "serviceDate", "grossAmount"
      ) VALUES ($1, $2, $3, $4, 'ACADEMY_MEMBERSHIP', $5, CURRENT_DATE, $6)
    `, [itemId, chargeId, FIXTURE.providerId, FIXTURE.commercialUnitId, "INTEGRATION_TEST_SERVICE", amount]);
    return { chargeId, itemId, entryId };
  });
}

async function createSettlement(
  client: PoolClient,
  financialEntryId: string,
  amount: string,
): Promise<string> {
  const id = randomUUID();
  await client.query(`
    INSERT INTO "FinancialSettlement" (
      "id", "financialEntryId", "amount", "settlementDate",
      "financialAccountId", "paymentMethodId", "idempotencyKey"
    ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6)
  `, [id, financialEntryId, amount, FIXTURE.accountId, FIXTURE.pixMethodId, `integration-settlement-${id}`]);
  return id;
}

async function recordPayment(input: {
  chargeId: string;
  itemId: string;
  entryId: string;
  amount: string;
  idempotencyKey?: string;
  settlementId?: string;
}) {
  return transaction(async (client) => {
    const paymentId = randomUUID();
    const settlementId = input.settlementId
      ?? await createSettlement(client, input.entryId, input.amount);
    const key = input.idempotencyKey ?? `integration-payment-${paymentId}`;
    await client.query(`
      INSERT INTO "ProfessionalServicePayment" (
        "id", "chargeId", "legalProviderId", "financialSettlementId",
        "receivedAmount", "idempotencyKey", "requestSha256", "recordedByUserId"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [paymentId, input.chargeId, FIXTURE.providerId, settlementId, input.amount, key, sha(key), SAULO_ID]);
    await client.query(`
      INSERT INTO "ProfessionalServicePaymentAllocation" (
        "id", "paymentId", "chargeItemId", "legalProviderId", "amount"
      ) VALUES ($1, $2, $3, $4, $5)
    `, [randomUUID(), paymentId, input.itemId, FIXTURE.providerId, input.amount]);
    return { paymentId, settlementId };
  });
}

async function issueReceipt(input: {
  paymentId: string;
  remainingBalance: string;
  idempotencyKey?: string;
  snapshotHash?: string;
}) {
  return transaction(async (client) => {
    const receiptId = randomUUID();
    const key = input.idempotencyKey ?? `integration-receipt-${receiptId}`;
    const snapshotHash = input.snapshotHash ?? sha(`snapshot-${receiptId}`);
    const payment = await client.query<{ receivedAmount: string }>(`
      SELECT "receivedAmount"::text AS "receivedAmount"
      FROM "ProfessionalServicePayment" WHERE "id" = $1
    `, [input.paymentId]);
    await client.query(`
      INSERT INTO "ProfessionalServiceReceipt" (
        "id", "legalProviderId", "paymentId", "seriesId", "status",
        "customerCpfHash", "customerCpfEncrypted", "receivedAmount",
        "remainingBalance", "partialPayment", "signatureMode",
        "electronicSignatureReference", "manualSignatureSpace",
        "customerCpfVisibility", "idempotencyKey", "requestSha256",
        "snapshotPayloadSha256", "issuedAt", "issuedByUserId",
        "createdByUserId", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, 'ISSUED', $5, $6, $7, $8, ($8::numeric > 0),
        'ELECTRONIC', $9, true, 'MASKED', $10, $11, $12,
        CURRENT_TIMESTAMP, $13, $13, CURRENT_TIMESTAMP
      )
    `, [
      receiptId,
      FIXTURE.providerId,
      input.paymentId,
      FIXTURE.seriesId,
      sha("integration-customer-cpf"),
      "INTEGRATION_TEST_ENCRYPTED_CPF",
      payment.rows[0].receivedAmount,
      input.remainingBalance,
      `integration-signature-${receiptId}`,
      key,
      sha(key),
      snapshotHash,
      SAULO_ID,
    ]);
    await client.query(`
      INSERT INTO "ProfessionalServiceReceiptSnapshot" (
        "receiptId", "schemaVersion", "payloadCiphertext", "encryptionVersion", "payloadSha256"
      ) VALUES ($1, 1, $2, 1, $3)
    `, [receiptId, Buffer.from(`INTEGRATION_TEST_SNAPSHOT_${receiptId}`), snapshotHash]);
    const result = await client.query<{ sequence: number }>(`
      SELECT "sequence" FROM "ProfessionalServiceReceipt" WHERE "id" = $1
    `, [receiptId]);
    return { receiptId, sequence: result.rows[0].sequence, snapshotHash };
  });
}

before(async () => {
  await transaction(async (client) => {
    await client.query(`
      INSERT INTO "User" ("id", "fullName", "status", "updatedAt")
      VALUES ($1, 'Saulo Xavier Vitorino - INTEGRATION TEST', 'ACTIVE', CURRENT_TIMESTAMP),
             ($2, 'Maria de Lourdes Gomes - INTEGRATION TEST', 'ACTIVE', CURRENT_TIMESTAMP)
    `, [SAULO_ID, MARIA_ID]);
    await client.query(`
      INSERT INTO "UserProfile" ("id", "userId", "type", "updatedAt")
      VALUES ($1, $2, 'SYSTEM_OWNER', CURRENT_TIMESTAMP)
    `, [randomUUID(), SAULO_ID]);
    await client.query(`
      INSERT INTO "SystemModule" ("id", "key", "name", "updatedAt")
      VALUES ($1, $2, 'INTEGRATION TEST', CURRENT_TIMESTAMP)
    `, [FIXTURE.moduleId, `integration-test-${FIXTURE.moduleId}`]);
    await client.query(`
      INSERT INTO "Patient" (
        "id", "clinicalCode", "fullName", "cpf", "sex", "birthDate", "moduleId",
        "registeredByUserId", "updatedByUserId", "updatedAt"
      ) VALUES ($1, $2, 'Paciente INTEGRATION TEST', '52998224725', 'MALE', DATE '1990-01-01', $3, $4, $4, CURRENT_TIMESTAMP)
    `, [FIXTURE.patientId, "SV999999", FIXTURE.moduleId, SAULO_ID]);
    await client.query(`
      INSERT INTO "MasterRecord" (
        "id", "patientId", "moduleId", "responsibleUserId", "createdByUserId",
        "updatedByUserId", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $4, $4, CURRENT_TIMESTAMP)
    `, [FIXTURE.masterRecordId, FIXTURE.patientId, FIXTURE.moduleId, SAULO_ID]);
    await client.query(`
      INSERT INTO "BusinessUnit" (
        "id", "code", "name", "legalName", "tradeName", "legalTaxIdType",
        "legalTaxIdEncrypted", "addressStreet", "addressNumber", "addressNeighborhood",
        "addressPostalCode", "addressCity", "addressState", "updatedAt"
      ) VALUES ($1, 'ACADEMIA', 'INTEGRATION TEST', 'INTEGRATION TEST LTDA',
        'INTEGRATION TEST', 'CNPJ', 'INTEGRATION_TEST_CNPJ', 'Rua Teste', '1',
        'Bairro Teste', '01001000', 'Sao Paulo', 'SP', CURRENT_TIMESTAMP)
    `, [FIXTURE.businessUnitId]);
    await client.query(`
      INSERT INTO "ProfessionalServiceLegalProvider" (
        "id", "type", "businessUnitId", "status", "updatedAt"
      ) VALUES ($1, 'LEGAL_ENTITY', $2, 'ACTIVE', CURRENT_TIMESTAMP)
    `, [FIXTURE.providerId, FIXTURE.businessUnitId]);
    await client.query(`
      INSERT INTO "ProfessionalServiceLegalProvider" (
        "id", "type", "userId", "taxIdType", "taxIdHash", "taxIdEncrypted", "status", "updatedAt"
      ) VALUES ($1, 'INDIVIDUAL', $2, 'CPF', $3, 'INTEGRATION_TEST_PROTECTED', 'ACTIVE', CURRENT_TIMESTAMP)
    `, [FIXTURE.mariaProviderId, MARIA_ID, sha("integration-maria-provider")]);
    await client.query(`
      INSERT INTO "ServiceProfessionalRegistration" (
        "id", "userId", "council", "registrationHash", "registrationEncrypted", "regionCode", "status", "updatedAt"
      ) VALUES ($1, $2, 'CREF', $3, 'INTEGRATION_TEST_PROTECTED', 'SP', 'ACTIVE', CURRENT_TIMESTAMP)
    `, [FIXTURE.mariaRegistrationId, MARIA_ID, sha("integration-maria-cref")]);
    await client.query(`
      INSERT INTO "ProfessionalServiceCommercialUnit" (
        "id", "legalProviderId", "code", "commercialName", "updatedAt"
      ) VALUES ($1, $2, 'ACADEMIA_SAULO_FITNESS', 'INTEGRATION TEST', CURRENT_TIMESTAMP)
    `, [FIXTURE.commercialUnitId, FIXTURE.providerId]);
    await client.query(`
      INSERT INTO "FinancialCategory" ("id", "code", "name", "type", "businessUnitId", "updatedAt")
      VALUES ($1, $2, 'INTEGRATION TEST REVENUE', 'REVENUE', $3, CURRENT_TIMESTAMP),
             ($4, $5, 'INTEGRATION TEST EXPENSE', 'EXPENSE', $3, CURRENT_TIMESTAMP)
    `, [
      FIXTURE.revenueCategoryId,
      `integration-revenue-${FIXTURE.revenueCategoryId}`,
      FIXTURE.businessUnitId,
      FIXTURE.expenseCategoryId,
      `integration-expense-${FIXTURE.expenseCategoryId}`,
    ]);
    await client.query(`
      INSERT INTO "FinancialAccount" ("id", "code", "name", "type", "businessUnitId", "updatedAt")
      VALUES ($1, $2, 'INTEGRATION TEST', 'BANK', $3, CURRENT_TIMESTAMP)
    `, [FIXTURE.accountId, `integration-account-${FIXTURE.accountId}`, FIXTURE.businessUnitId]);
    await client.query(`
      INSERT INTO "PaymentMethod" ("id", "code", "name", "type", "updatedAt")
      VALUES ($1, $2, 'INTEGRATION TEST PIX', 'PIX', CURRENT_TIMESTAMP)
    `, [FIXTURE.pixMethodId, `integration-pix-${FIXTURE.pixMethodId}`]);
    await client.query(`
      INSERT INTO "ProfessionalServiceReceiptSeries" (
        "id", "legalProviderId", "code", "nextSequence", "updatedAt"
      ) VALUES ($1, $2, 'INTEGRATION_TEST', 1, CURRENT_TIMESTAMP)
    `, [FIXTURE.seriesId, FIXTURE.providerId]);
  });
});

after(async () => {
  await pool.end();
});

test("emissao com pagamento parcial persiste saldo, snapshot e evento", async () => {
  const charge = await createCharge("100.00");
  const payment = await recordPayment({ ...charge, amount: "40.00" });
  const receipt = await issueReceipt({ paymentId: payment.paymentId, remainingBalance: "60.00" });

  const result = await pool.query(`
    SELECT c."status"::text AS "chargeStatus", r."status"::text AS "receiptStatus",
      r."remainingBalance"::text AS "remainingBalance", r."partialPayment",
      s."payloadSha256", e."type"::text AS "eventType"
    FROM "ProfessionalServiceReceipt" r
    JOIN "ProfessionalServicePayment" p ON p."id" = r."paymentId"
    JOIN "ProfessionalServiceCharge" c ON c."id" = p."chargeId"
    JOIN "ProfessionalServiceReceiptSnapshot" s ON s."receiptId" = r."id"
    JOIN "ProfessionalServiceReceiptEvent" e ON e."receiptId" = r."id"
    WHERE r."id" = $1
  `, [receipt.receiptId]);

  assert.deepEqual(result.rows[0], {
    chargeStatus: "PARTIALLY_PAID",
    receiptStatus: "ISSUED",
    remainingBalance: "60.00",
    partialPayment: true,
    payloadSha256: receipt.snapshotHash,
    eventType: "ISSUED",
  });
});

test("repository cria cobranca de Personal training para Maria com CREF ativo", async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { createProfessionalServiceReceiptService } = await import("./service");
  const { professionalServiceReceiptRepository } = await import("./repository");
  const service = createProfessionalServiceReceiptService(professionalServiceReceiptRepository);
  const result = await service.registerCharge({
    providerKey: "MARIA_DE_LOURDES_GOMES",
    masterRecordId: FIXTURE.masterRecordId,
    totals: { subtotal: "100.00", discount: "0.00", surcharge: "0.00", amountDue: "100.00" },
    items: [{
      serviceReferenceId: `repository-integration-${randomUUID()}`,
      kind: "PERSONAL_TRAINING",
      soldByProviderKey: "MARIA_DE_LOURDES_GOMES",
      legalProviderKey: "MARIA_DE_LOURDES_GOMES",
      executors: [{
        userId: MARIA_ID,
        professionalRegistration: "CREF",
        professionalRegistrationStatus: "ACTIVE",
        performedActivity: "INTEGRATION TEST PERSONAL TRAINING",
      }],
      grossAmount: "100.00",
      description: "INTEGRATION TEST REPOSITORY",
      serviceDate: "2026-09-22",
    }],
    actorUserId: SAULO_ID,
  });
  assert.equal(result.status, "OPEN");
  assert.equal(result.items.length, 1);
});

test("concorrencia impede que pagamentos ultrapassem a cobranca", async () => {
  const charge = await createCharge("100.00");
  const settlements = await transaction(async (client) => Promise.all([
    createSettlement(client, charge.entryId, "70.00"),
    createSettlement(client, charge.entryId, "70.00"),
  ]));
  const attempts = await Promise.allSettled(settlements.map((settlementId) =>
    recordPayment({ ...charge, amount: "70.00", settlementId }),
  ));
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
  const persisted = await pool.query(`
    SELECT COUNT(*)::int AS count, COALESCE(SUM("receivedAmount"), 0)::text AS total
    FROM "ProfessionalServicePayment" WHERE "chargeId" = $1
  `, [charge.chargeId]);
  assert.deepEqual(persisted.rows[0], { count: 1, total: "70.00" });
});

test("idempotencia rejeita a mesma chave para pagamentos distintos", async () => {
  const first = await createCharge("20.00");
  const second = await createCharge("20.00");
  const key = `integration-shared-key-${randomUUID()}`;
  await recordPayment({ ...first, amount: "20.00", idempotencyKey: key });
  await assert.rejects(
    recordPayment({ ...second, amount: "20.00", idempotencyKey: key }),
    /ProfessionalServicePayment_idempotencyKey_key|duplicate key/iu,
  );
});

test("numeracao concorrente reserva sequencias unicas e crescentes", async () => {
  const charges = await Promise.all([createCharge("30.00"), createCharge("30.00")]);
  const payments = await Promise.all(charges.map((charge) =>
    recordPayment({ ...charge, amount: "30.00" }),
  ));
  const receipts = await Promise.all(payments.map((payment) =>
    issueReceipt({ paymentId: payment.paymentId, remainingBalance: "0.00" }),
  ));
  const sequences = receipts.map((receipt) => receipt.sequence).sort((a, b) => a - b);
  assert.equal(new Set(sequences).size, 2);
  assert.equal(sequences[1], sequences[0] + 1);
});

test("cancelamento por Saulo gera evento e preserva conteudo imutavel", async () => {
  const charge = await createCharge("35.00");
  const payment = await recordPayment({ ...charge, amount: "35.00" });
  const receipt = await issueReceipt({ paymentId: payment.paymentId, remainingBalance: "0.00" });
  await pool.query(`
    UPDATE "ProfessionalServiceReceipt"
    SET "status" = 'CANCELLED', "cancelledAt" = CURRENT_TIMESTAMP,
      "cancelledByUserId" = $2, "cancellationReason" = 'INTEGRATION TEST',
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = $1
  `, [receipt.receiptId, SAULO_ID]);
  const events = await pool.query(`
    SELECT "type"::text AS type FROM "ProfessionalServiceReceiptEvent"
    WHERE "receiptId" = $1 ORDER BY "occurredAt", "type"
  `, [receipt.receiptId]);
  assert.deepEqual(events.rows.map((row) => row.type), ["ISSUED", "CANCELLED"]);
  await assert.rejects(
    pool.query(`UPDATE "ProfessionalServiceReceipt" SET "receivedAmount" = 1 WHERE "id" = $1`, [receipt.receiptId]),
    /imutavel/iu,
  );
});

test("estorno integral atualiza recibo e cobranca atomicamente e gera evento", async () => {
  const charge = await createCharge("45.00");
  const payment = await recordPayment({ ...charge, amount: "45.00" });
  const receipt = await issueReceipt({ paymentId: payment.paymentId, remainingBalance: "0.00" });
  await transaction(async (client) => {
    const expenseEntryId = await createFinancialEntry(client, "EXPENSE", "45.00");
    const refundSettlementId = await createSettlement(client, expenseEntryId, "45.00");
    const key = `integration-refund-${randomUUID()}`;
    await client.query(`
      INSERT INTO "ProfessionalServiceRefund" (
        "id", "receiptId", "type", "originalPaymentId", "legalProviderId",
        "financialSettlementId", "amount", "reason", "idempotencyKey",
        "requestSha256", "recordedByUserId"
      ) VALUES ($1, $2, 'REFUNDED', $3, $4, $5, 45, 'INTEGRATION TEST', $6, $7, $8)
    `, [randomUUID(), receipt.receiptId, payment.paymentId, FIXTURE.providerId, refundSettlementId, key, sha(key), SAULO_ID]);
  });
  const result = await pool.query(`
    SELECT r."status"::text AS "receiptStatus", c."status"::text AS "chargeStatus",
      array_agg(e."type"::text ORDER BY e."occurredAt", e."type") AS events
    FROM "ProfessionalServiceReceipt" r
    JOIN "ProfessionalServicePayment" p ON p."id" = r."paymentId"
    JOIN "ProfessionalServiceCharge" c ON c."id" = p."chargeId"
    JOIN "ProfessionalServiceReceiptEvent" e ON e."receiptId" = r."id"
    WHERE r."id" = $1 GROUP BY r."status", c."status"
  `, [receipt.receiptId]);
  assert.deepEqual(result.rows[0], {
    receiptStatus: "REFUNDED",
    chargeStatus: "OPEN",
    events: ["ISSUED", "REFUNDED"],
  });
});

test("snapshot e eventos nao aceitam alteracao ou insercao direta", async () => {
  const charge = await createCharge("25.00");
  const payment = await recordPayment({ ...charge, amount: "25.00" });
  const receipt = await issueReceipt({ paymentId: payment.paymentId, remainingBalance: "0.00" });
  await assert.rejects(
    pool.query(`UPDATE "ProfessionalServiceReceiptSnapshot" SET "schemaVersion" = 2 WHERE "receiptId" = $1`, [receipt.receiptId]),
    /imutavel/iu,
  );
  await assert.rejects(
    pool.query(`
      INSERT INTO "ProfessionalServiceReceiptEvent" (
        "id", "receiptId", "type", "fromStatus", "toStatus", "actorUserId"
      ) VALUES ($1, $2, 'ISSUED', 'DRAFT', 'ISSUED', $3)
    `, [randomUUID(), receipt.receiptId, SAULO_ID]),
    /somente podem ser criados/iu,
  );
});

test("fluxos legado e novo nao podem reivindicar o mesmo FinancialEntry", async () => {
  const legacyEntry = await transaction((client) => createFinancialEntry(client, "REVENUE", "50.00"));
  await pool.query(`
    INSERT INTO "ServiceReceipt" (
      "id", "businessUnitId", "financialEntryId", "providerType", "receiptNumber",
      "competence", "serviceDate", "serviceDescription", "recipientName", "amount",
      "createdByUserId", "updatedAt"
    ) VALUES ($1, $2, $3, 'COMPANY', $4, CURRENT_DATE, CURRENT_DATE,
      'INTEGRATION TEST', 'INTEGRATION TEST', 50, $5, CURRENT_TIMESTAMP)
  `, [randomUUID(), FIXTURE.businessUnitId, legacyEntry, `integration-legacy-${randomUUID()}`, SAULO_ID]);
  await assert.rejects(
    createCharge("50.00", legacyEntry),
    /ProfessionalServiceFinancialEntryClaim_pkey|duplicate key/iu,
  );

  const newCharge = await createCharge("55.00");
  await assert.rejects(
    pool.query(`
      INSERT INTO "ServiceReceipt" (
        "id", "businessUnitId", "financialEntryId", "providerType", "receiptNumber",
        "competence", "serviceDate", "serviceDescription", "recipientName", "amount",
        "createdByUserId", "updatedAt"
      ) VALUES ($1, $2, $3, 'COMPANY', $4, CURRENT_DATE, CURRENT_DATE,
        'INTEGRATION TEST', 'INTEGRATION TEST', 55, $5, CURRENT_TIMESTAMP)
    `, [randomUUID(), FIXTURE.businessUnitId, newCharge.entryId, `integration-legacy-${randomUUID()}`, SAULO_ID]),
    /ProfessionalServiceFinancialEntryClaim_pkey|duplicate key/iu,
  );
});
