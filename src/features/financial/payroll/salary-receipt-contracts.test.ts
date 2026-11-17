import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canAssertEmployeeReceived,
  classifyPayrollDocument,
  createImmutableSalarySnapshot,
  validateSalaryReceiptCandidate,
  type SalaryReceiptCandidate,
} from "./salary-receipt-contracts";

// Todos os identificadores e valores abaixo existem apenas na memoria do teste.
function cpfFromBase(base: string): string {
  const digit = (value: string, length: number) => {
    const sum = Array.from(value).reduce((total, char, index) => total + Number(char) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return String(remainder === 10 ? 0 : remainder);
  };
  const first = base + digit(base, 9);
  return first + digit(first, 10);
}

function candidate(): SalaryReceiptCandidate {
  const unitId = randomUUID();
  const employeeId = randomUUID();
  const employmentId = randomUUID();
  const statementId = randomUUID();
  const financialEntryId = randomUUID();
  return {
    employer: {
      unitId, unitName: "TEST_ONLY", legalName: "TEST_ONLY", tradeName: null,
      legalTaxIdType: "CPF", legalTaxId: cpfFromBase("123456789"),
      addressStreet: "TEST_ONLY", addressNumber: "1", addressComplement: null,
      addressNeighborhood: "TEST_ONLY", addressPostalCode: "12345678",
      addressCity: "TEST_ONLY", addressState: "SP",
    },
    employee: {
      employeeId, fullName: "TEST_ONLY", cpf: cpfFromBase("987654321"),
      identityDocument: null, employmentId, employmentCode: "TEST_ONLY",
      employmentType: "EMPLOYEE", jobRole: "TEST_ONLY",
    },
    statement: {
      id: statementId, unitId, employmentId, status: "CLOSED", periodStatus: "CLOSED",
      netAmount: "90.00", financialEntryId,
    },
    employment: { id: employmentId, unitId, employeeId, type: "EMPLOYEE" },
    receipt: { unitId, statementId },
    payment: {
      financialEntryId, financialEntryUnitId: unitId, financialEntryType: "EXPENSE",
      financialEntryStatus: "SETTLED", financialEntryAmount: "90.00",
      financialSettlementId: randomUUID(), settlementEntryId: financialEntryId,
      settlementCount: 1, settlementAmount: "90.00", settlementDate: "2026-09-14",
      paidAt: "2026-09-14", method: "CASH", paidAmount: "90.00",
    },
  };
}

test("empregador sem identificacao legal bloqueia recibo novo", () => {
  const input = candidate();
  assert.ok(validateSalaryReceiptCandidate({ ...input, employer: { ...input.employer, legalName: "" } }).includes("EMPLOYER_LEGAL_IDENTITY_MISSING"));
});

test("identificador legal invalido bloqueia recibo novo", () => {
  const input = candidate();
  assert.ok(validateSalaryReceiptCandidate({ ...input, employer: { ...input.employer, legalTaxId: "00000000000" } }).includes("EMPLOYER_TAX_ID_INVALID"));
});

test("demonstrativo ou periodo aberto bloqueia recibo novo", () => {
  const input = candidate();
  assert.ok(validateSalaryReceiptCandidate({ ...input, statement: { ...input.statement, status: "DRAFT" } }).includes("STATEMENT_NOT_CLOSED"));
  assert.ok(validateSalaryReceiptCandidate({ ...input, statement: { ...input.statement, periodStatus: "OPEN" } }).includes("STATEMENT_NOT_CLOSED"));
});

test("funcionario ativo sem CPF, RG, PIS/NIS ou dados bancarios permanece elegivel ao pagamento e recibo", () => {
  const input = candidate();
  const employee = { ...input.employee, cpf: null, identityDocument: null, socialSecurityNumber: null };
  assert.deepEqual(validateSalaryReceiptCandidate({ ...input, employee }), []);
  const snapshot = createImmutableSalarySnapshot({
    schemaVersion: 1,
    receipt: { id: randomUUID(), number: "TEST_ONLY", version: 1, issuedAt: "2026-09-14T12:00:00.000Z" },
    employer: input.employer,
    employee,
    statement: { id: input.statement.id, unitId: input.statement.unitId, employmentId: input.statement.employmentId, competence: "2026-09-01", calculationVersion: 1 },
    lineItems: [{ code: "SALARIO_BASE", description: "TEST_ONLY", type: "EARNING", origin: "CALCULATED", quantity: null, unitAmount: null, amount: "90.00", affectsNet: true }],
    totals: { salaryBase: "90.00", gross: "90.00", benefits: "0.00", deductions: "0.00", adjustments: "0.00", net: "90.00" },
    payment: { confirmationId: randomUUID(), financialEntryId: input.payment.financialEntryId, financialSettlementId: input.payment.financialSettlementId, paidAt: "2026-09-14", method: "CASH", paidAmount: "90.00", bankReference: null, evidenceId: null, bankProofSha256: null },
    issuer: { userId: randomUUID(), fullName: "TEST_ONLY" },
  });
  assert.equal(snapshot.employee.cpf, null);
  assert.equal(snapshot.employee.identityDocument, null);
  assert.equal(snapshot.employee.socialSecurityNumber, null);
});

test("CPF informado continua precisando ser valido", () => {
  const input = candidate();
  assert.ok(validateSalaryReceiptCandidate({ ...input, employee: { ...input.employee, cpf: "00000000000" } }).includes("EMPLOYEE_CPF_INVALID"));
});

test("valor pago divergente do liquido persistido e rejeitado", () => {
  const input = candidate();
  assert.ok(validateSalaryReceiptCandidate({ ...input, payment: { ...input.payment, paidAmount: "89.99" } }).includes("PAYMENT_AMOUNT_MISMATCH"));
});

test("pagamento parcial e multiplas liquidacoes sao rejeitados", () => {
  const input = candidate();
  assert.ok(validateSalaryReceiptCandidate({ ...input, payment: { ...input.payment, settlementAmount: "40.00", settlementCount: 2 } }).includes("PAYMENT_NOT_FULLY_SETTLED"));
});

test("data efetiva de pagamento invalida e rejeitada", () => {
  const input = candidate();
  assert.ok(validateSalaryReceiptCandidate({ ...input, payment: { ...input.payment, paidAt: "2026-02-30", settlementDate: "2026-02-30" } }).includes("PAYMENT_NOT_FULLY_SETTLED"));
});

test("dinheiro confirmado inicia aguardando assinatura manual", () => {
  const input = candidate();
  assert.deepEqual(validateSalaryReceiptCandidate(input), []);
  const state = classifyPayrollDocument({ kind: "SALARY_RECEIPT", paymentConfirmed: true, snapshotPresent: true, method: "CASH", bankProofPresent: false, signedCopyPresent: false });
  assert.equal(state, "CASH_AWAITING_SIGNATURE");
  assert.equal(canAssertEmployeeReceived(state), false);
});

test("PIX sem referencia ou comprovante permanece valido", () => {
  const input = candidate();
  const errors = validateSalaryReceiptCandidate({ ...input, payment: { ...input.payment, method: "PIX" } });
  assert.deepEqual(errors, []);
  assert.equal(classifyPayrollDocument({ kind: "SALARY_RECEIPT", paymentConfirmed: true, snapshotPresent: true, method: "PIX", bankProofPresent: false, signedCopyPresent: false }), "PAYMENT_CONFIRMED");
});

test("comprovante bancario nao cria declaracao de ciencia assinada", () => {
  const state = classifyPayrollDocument({ kind: "SALARY_RECEIPT", paymentConfirmed: true, snapshotPresent: true, method: "PIX", bankProofPresent: true, signedCopyPresent: false });
  assert.equal(state, "BANK_PROVEN");
  assert.equal(canAssertEmployeeReceived(state), false);
});

test("abrir ou imprimir nao altera o estado derivado", () => {
  const record = Object.freeze({ kind: "SALARY_RECEIPT" as const, paymentConfirmed: true, snapshotPresent: true, method: "CASH" as const, bankProofPresent: false, signedCopyPresent: false });
  const before = classifyPayrollDocument(record);
  const afterPrint = classifyPayrollDocument(record);
  assert.equal(afterPrint, before);
});

test("registro legado ISSUED nunca apresenta declaracao de recebimento", () => {
  const state = classifyPayrollDocument({ kind: "LEGACY_DEMONSTRATIVE", paymentConfirmed: false, snapshotPresent: false, bankProofPresent: false, signedCopyPresent: false });
  assert.equal(state, "LEGACY_UNCONFIRMED");
  assert.equal(canAssertEmployeeReceived(state), false);
  assert.equal(classifyPayrollDocument({ kind: null, paymentConfirmed: false, snapshotPresent: false, bankProofPresent: false, signedCopyPresent: false }), "LEGACY_UNCONFIRMED");
});

test("unidade, demonstrativo, vinculo, funcionario e lancamento devem corresponder", () => {
  const input = candidate();
  assert.ok(validateSalaryReceiptCandidate({ ...input, employment: { ...input.employment, employeeId: randomUUID() } }).includes("RELATION_MISMATCH"));
  assert.ok(validateSalaryReceiptCandidate({ ...input, statement: { ...input.statement, financialEntryId: randomUUID() } }).includes("RELATION_MISMATCH"));
});

test("snapshot validado e copiado nao muda com alteracoes posteriores", () => {
  const input = candidate();
  const snapshotInput = {
    schemaVersion: 1,
    receipt: { id: randomUUID(), number: "TEST_ONLY", version: 1, issuedAt: "2026-09-14T12:00:00.000Z" },
    employer: input.employer,
    employee: input.employee,
    statement: { id: input.statement.id, unitId: input.statement.unitId, employmentId: input.statement.employmentId, competence: "2026-09-01", calculationVersion: 1 },
    lineItems: [
      { code: "SALARIO_BASE", description: "TEST_ONLY", type: "EARNING", origin: "MANUAL", quantity: null, unitAmount: null, amount: "100.00", affectsNet: true },
      { code: "DEDUCTION_TEST_ONLY", description: "TEST_ONLY", type: "DEDUCTION", origin: "MANUAL", quantity: null, unitAmount: null, amount: "10.00", affectsNet: true },
    ],
    totals: { salaryBase: "100.00", gross: "100.00", benefits: "0.00", deductions: "10.00", adjustments: "0.00", net: "90.00" },
    payment: { confirmationId: randomUUID(), financialEntryId: input.payment.financialEntryId, financialSettlementId: input.payment.financialSettlementId, paidAt: "2026-09-14", method: "CASH", paidAmount: "90.00", bankReference: null, evidenceId: null, bankProofSha256: null },
    issuer: { userId: randomUUID(), fullName: "TEST_ONLY" },
  };
  const snapshot = createImmutableSalarySnapshot(snapshotInput);
  snapshotInput.lineItems[0].description = "CHANGED_AFTER_ISSUE";
  assert.equal(snapshot.lineItems[0].description, "TEST_ONLY");
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.lineItems[0]), true);
  assert.throws(() => createImmutableSalarySnapshot({ ...snapshotInput, totals: { gross: "100.00", benefits: "0.00", deductions: "10.00", adjustments: "0.00", net: "90.00" } }));
  assert.throws(() => createImmutableSalarySnapshot({ ...snapshotInput, totals: { ...snapshotInput.totals, salaryBase: "99.00" } }));
});

test("migration preserva legado e impede confirmacao ou recibo ativo duplicado", async () => {
  const sql = await readFile(new URL("../../../../prisma/migrations/20260914190000_salary_receipt_stage1/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /"kind" "PayrollDocumentKind" NOT NULL DEFAULT 'LEGACY_DEMONSTRATIVE'/);
  assert.match(sql, /CREATE UNIQUE INDEX "SalaryPayment_statement_key"/);
  assert.match(sql, /CREATE UNIQUE INDEX "SalaryPayment_settlement_key"/);
  assert.match(sql, /CREATE UNIQUE INDEX "SalaryPayment_idempotency_key"/);
  assert.match(sql, /CREATE UNIQUE INDEX "PayrollReceipt_one_active_salary_receipt"/);
  assert.match(sql, /CREATE UNIQUE INDEX "SalaryEvidence_hash_key"/);
  assert.match(sql, /CREATE TABLE "PayrollPaymentEvidenceBlob"/);
  assert.match(sql, /"content" BYTEA NOT NULL/);
  assert.match(sql, /CREATE TRIGGER "SalaryEvidenceBlob_immutable"/);
  assert.match(sql, /CREATE TRIGGER "SalarySnapshot_immutable"/);
  assert.match(sql, /OLD\."documentHash" IS DISTINCT FROM NEW\."documentHash"/);
  assert.match(sql, /OLD\."storageKey" IS DISTINCT FROM NEW\."storageKey"/);
  assert.match(sql, /OLD\."status" = 'VOIDED' AND NEW\."status" <> 'VOIDED'/);
  assert.match(sql, /"bankReference" IS NOT NULL AND BTRIM\("bankReference"\) <> ''/);
  assert.doesNotMatch(sql, /UPDATE "PayrollReceipt" SET/);
});

test("migration posterior torna referência e comprovante bancário opcionais sem relaxar snapshot", async () => {
  const sql = await readFile(new URL("../../../../prisma/migrations/20260925210000_optional_salary_payment_evidence/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /"bankReference" IS NULL OR BTRIM\("bankReference"\) <> ''/);
  assert.doesNotMatch(sql, /Recibo bancario exige comprovante armazenado/);
  assert.match(sql, /Recibo salarial exige pagamento confirmado e snapshot/);
});
