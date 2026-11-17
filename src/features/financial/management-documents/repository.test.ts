import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

const unit = "11111111-1111-4111-8111-111111111111";
const otherUnit = "22222222-2222-4222-8222-222222222222";
const decimal = (value: string) => ({ toFixed: () => value });

function receiptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "receipt-1", businessUnitId: unit, payrollStatementId: "statement-1",
    receiptNumber: "PAG-01", version: 2, status: "ISSUED",
    issuedAt: new Date("2026-09-10T12:00:00Z"), issuedBy: { fullName: "Emissor persistido" },
    businessUnit: { name: "Unidade A" },
    payrollStatement: {
      id: "statement-1", businessUnitId: unit, employmentId: "employment-1", status: "CLOSED",
      grossAmount: decimal("100.00"), benefitAmount: decimal("0.00"), deductionAmount: decimal("10.00"),
      adjustmentAmount: decimal("0.00"), netAmount: decimal("90.00"), lineItems: [], appliedAdjustments: [],
      payrollPeriod: { businessUnitId: unit, competence: new Date("2026-09-01T00:00:00Z") },
      employment: { id: "employment-1", businessUnitId: unit, employeeId: "employee-1", code: "MAT-1", type: "EMPLOYEE", employee: { id: "employee-1", fullName: "Funcionária A" }, jobRole: { name: "Cargo" } },
    },
    ...overrides,
  };
}

function statementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "statement-2", businessUnitId: unit, status: "CLOSED", closedAt: new Date("2026-09-11T12:00:00Z"),
    closedBy: { fullName: "Fechador" }, grossAmount: decimal("200.00"), benefitAmount: decimal("0.00"),
    deductionAmount: decimal("20.00"), adjustmentAmount: decimal("0.00"), netAmount: decimal("180.00"), calculationVersion: 4,
    businessUnit: { name: "Unidade A" }, payrollPeriod: { businessUnitId: unit, competence: new Date("2026-09-01T00:00:00Z") },
    employment: { id: "employment-2", businessUnitId: unit, employeeId: "employee-2", code: "MAT-2", type: "EMPLOYEE", employee: { id: "employee-2", fullName: "Funcionária B" }, jobRole: { name: "Cargo B" } },
    lineItems: [], appliedAdjustments: [], receipts: [], ...overrides,
  };
}

async function harness(receipts = [receiptRow()], statements: ReturnType<typeof statementRow>[] = []) {
  const source = await readFile(new URL("./repository.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const queries: { kind: string; args: Record<string, unknown> }[] = [];
  let writes = 0;
  const metadata = receipts.map((row) => ({ receiptId: row.id, kind: "LEGACY_DEMONSTRATIVE", paymentConfirmed: false,
    snapshotPresent: false, method: null, bankProofId: null, signedCopyId: null, payloadCiphertext: null, payloadSha256: null }));
  const prisma = {
    payrollReceipt: {
      findMany: async (args: Record<string, unknown>) => { queries.push({ kind: "receiptMany", args }); return receipts; },
      findFirst: async (args: Record<string, unknown>) => { queries.push({ kind: "receiptFirst", args }); return receipts[0] ?? null; },
      create: () => { writes++; }, update: () => { writes++; }, delete: () => { writes++; },
    },
    payrollStatement: {
      findMany: async (args: Record<string, unknown>) => { queries.push({ kind: "statementMany", args }); return statements; },
      findFirst: async (args: Record<string, unknown>) => { queries.push({ kind: "statementFirst", args }); return statements[0] ?? null; },
    },
    businessUnit: { findMany: async () => [{ id: unit, name: "Unidade A" }] },
    $queryRaw: async () => metadata,
  };
  const Prisma = {
    join: (values: unknown[]) => values,
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  };
  const testModule = { exports: {} as { managementDocumentsRepository: {
    list: (filters: Record<string, unknown>) => Promise<{ items: { id: string; documentKind: string; documentState: string; documentNumber: string }[]; total: number }>;
    findExact: (identity: Record<string, string>) => Promise<{ id: string; version: number; issuerName?: string } | null>;
    findDemonstrative: (id: string) => Promise<{ id: string; documentKind: string } | null>;
  } } };
  runInNewContext(compiled, { module: testModule, exports: testModule.exports, Date, Promise, encodeURIComponent, require(id: string) {
    if (id === "server-only") return {};
    if (id === "@/generated/prisma/client") return { Prisma };
    if (id === "@/lib/database/prisma") return { prisma };
    if (id === "../payroll/salary-payment-backend") return { readSalaryReceiptSnapshot: () => { throw new Error("not used"); }, SalaryPaymentError: class extends Error {} };
    if (id === "../payroll/salary-receipt-contracts") return { classifyPayrollDocument: ({ kind }: { kind: string }) => kind === "LEGACY_DEMONSTRATIVE" ? "LEGACY_UNCONFIRMED" : "BANK_PROVEN" };
    throw new Error(id);
  } });
  return { repo: testModule.exports.managementDocumentsRepository, queries, writes: () => writes };
}

const identity = { receiptId: "receipt-1", businessUnitId: unit, payrollStatementId: "statement-1", employmentId: "employment-1", employeeId: "employee-1" };

test("índice combina legado e demonstrativo sem carregar bytes e sem escrita", async () => {
  const { repo, queries, writes } = await harness([receiptRow()], [statementRow()]);
  const result = await repo.list({ employee: "Funcionária", competence: new Date("2026-09-01T00:00:00Z"), page: 1 });
  assert.equal(result.total, 2);
  assert.equal(JSON.stringify(result.items.map((item) => item.documentKind).sort()), JSON.stringify(["DEMONSTRATIVE", "LEGACY_DEMONSTRATIVE"]));
  assert.equal(result.items.find((item) => item.id === "receipt-1")?.documentState, "LEGACY_UNCONFIRMED");
  assert.equal(result.items.find((item) => item.id === "statement-2")?.documentNumber, "DEM-202609-MAT-2");
  assert.equal(
    JSON.stringify((queries.find((item) => item.kind === "receiptMany")?.args.where as { status: { in: string[] } }).status.in),
    JSON.stringify(["ISSUED", "VOIDED"]),
  );
  assert.equal(writes(), 0);
});

test("registros não emitidos ou com relações inconsistentes são excluídos", async () => {
  const bad = receiptRow({ businessUnitId: otherUnit });
  const badStatement = statementRow({ closedAt: null });
  const { repo } = await harness([receiptRow({ status: "DRAFT" }), receiptRow({ issuedAt: null }), bad], [badStatement]);
  assert.equal((await repo.list({ page: 1 })).items.length, 0);
});

test("busca exata preserva documento legado e rejeita unidade, vínculo ou funcionário divergente", async () => {
  const { repo, writes } = await harness();
  const found = await repo.findExact(identity);
  assert.equal(found?.id, "receipt-1");
  assert.equal(found?.version, 2);
  assert.equal(found?.issuerName, "Emissor persistido");
  assert.equal(await repo.findExact({ ...identity, businessUnitId: otherUnit }), null);
  assert.equal(await repo.findExact({ ...identity, employmentId: "employment-other" }), null);
  assert.equal(await repo.findExact({ ...identity, employeeId: "employee-other" }), null);
  assert.equal(writes(), 0);
});

test("demonstrativo fechado sem recibo é aberto sem criar ou converter registro", async () => {
  const { repo, queries, writes } = await harness([], [statementRow()]);
  const found = await repo.findDemonstrative("statement-2");
  assert.equal(found?.id, "statement-2");
  assert.equal(found?.documentKind, "DEMONSTRATIVE");
  const where = queries.find((item) => item.kind === "statementFirst")?.args.where as { receipts: { none: { status: string } } };
  assert.equal(where.receipts.none.status, "ISSUED");
  assert.equal(writes(), 0);
});
