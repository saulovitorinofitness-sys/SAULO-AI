import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

type StatementStatus = "DRAFT" | "CALCULATED" | "CLOSED" | "VOIDED";
type Statement = { id: string; status: StatementStatus; updatedByUserId?: string };

async function harness(initialStatuses: readonly StatementStatus[], failAfterStatements = false) {
  const source = await readFile(new URL("./repository.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let statements: Statement[] = initialStatuses.map((status, index) => ({ id: `statement-${index + 1}`, status }));
  let period = { id: "period-1", businessUnitId: "unit-1", status: "OPEN", updatedByUserId: "creator" };
  let shouldFail = failAfterStatements;
  let updateManyCalls = 0;

  const transaction = {
    $queryRaw: async () => [{ id: period.id }],
    payrollPeriod: {
      findUnique: async () => ({ ...period }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (shouldFail) throw new Error("TEST_ONLY period update failure");
        period = { ...period, ...data } as typeof period;
        return { ...period };
      },
    },
    payrollStatement: {
      findMany: async ({ where }: { where: { status?: StatementStatus } }) => statements
        .filter((statement) => !where.status || statement.status === where.status)
        .map((statement) => ({ ...statement })),
      updateMany: async ({ where, data }: { where: { id: { in: string[] }; status: StatementStatus }; data: Record<string, unknown> }) => {
        updateManyCalls++;
        statements = statements.map((statement) => where.id.in.includes(statement.id) && statement.status === where.status
          ? { ...statement, ...data } as Statement
          : statement);
        return { count: where.id.in.length };
      },
    },
  };
  const prisma = {
    $transaction: async <T>(operation: (client: typeof transaction) => Promise<T>) => {
      const statementsBefore = statements.map((statement) => ({ ...statement }));
      const periodBefore = { ...period };
      try {
        return await operation(transaction);
      } catch (error) {
        statements = statementsBefore;
        period = periodBefore;
        throw error;
      }
    },
  };
  class KnownRequestError extends Error { code = "TEST_ONLY"; }
  const testModule = { exports: {} as { payrollRepository: {
    calculatePeriodAtomically: (unitId: string, periodId: string, actorId: string) => Promise<{
      kind: string;
      calculatedStatementIds?: readonly string[];
      alreadyCalculatedStatementIds?: readonly string[];
      untouchedStatementIds?: readonly string[];
      pendingStatementIds?: readonly string[];
    }>;
  } } };
  runInNewContext(compiled, {
    module: testModule,
    exports: testModule.exports,
    Date,
    Promise,
    require(id: string) {
      if (id === "server-only") return {};
      if (id === "@/generated/prisma/client") return { Prisma: {
        Decimal: class {},
        PrismaClientKnownRequestError: KnownRequestError,
        TransactionIsolationLevel: { Serializable: "Serializable" },
      } };
      if (id === "@/lib/database/prisma") return { prisma };
      throw new Error(id);
    },
  });
  return {
    calculate: () => testModule.exports.payrollRepository.calculatePeriodAtomically("unit-1", "period-1", "actor-1"),
    disableFailure: () => { shouldFail = false; },
    statuses: () => statements.map((statement) => statement.status),
    statementSnapshots: () => statements.map((statement) => ({ ...statement })),
    periodSnapshot: () => ({ ...period }),
    updateManyCalls: () => updateManyCalls,
  };
}

test("calcula atomicamente dois demonstrativos em elaboracao", async () => {
  const state = await harness(["DRAFT", "DRAFT"]);
  const result = await state.calculate();
  assert.deepEqual(state.statuses(), ["CALCULATED", "CALCULATED"]);
  assert.deepEqual(result.calculatedStatementIds, ["statement-1", "statement-2"]);
  assert.equal(state.periodSnapshot().status, "CALCULATED");
});

test("preserva o calculado e processa somente o demonstrativo em elaboracao", async () => {
  const state = await harness(["CALCULATED", "DRAFT"]);
  const before = state.statementSnapshots()[0];
  const result = await state.calculate();
  assert.deepEqual(state.statementSnapshots()[0], before);
  assert.deepEqual(result.alreadyCalculatedStatementIds, ["statement-1"]);
  assert.deepEqual(result.calculatedStatementIds, ["statement-2"]);
});

test("repeticao do calculo e sucesso idempotente e nao atualiza demonstrativos", async () => {
  const state = await harness(["CALCULATED", "CALCULATED"]);
  const before = state.statementSnapshots();
  const result = await state.calculate();
  assert.deepEqual(state.statementSnapshots(), before);
  assert.deepEqual(result.alreadyCalculatedStatementIds, ["statement-1", "statement-2"]);
  assert.equal(state.updateManyCalls(), 0);
});

test("competencia totalmente calculada e normalizada sem reprocessamento", async () => {
  const state = await harness(["CALCULATED"]);
  const result = await state.calculate();
  assert.equal(result.kind, "SUCCESS");
  assert.deepEqual(result.pendingStatementIds, []);
  assert.equal(state.periodSnapshot().status, "CALCULATED");
});

test("demonstrativo fechado ou cancelado permanece intacto", async () => {
  const state = await harness(["DRAFT", "CLOSED", "VOIDED"]);
  const before = state.statementSnapshots();
  const result = await state.calculate();
  assert.equal(state.statementSnapshots()[1].status, before[1].status);
  assert.equal(state.statementSnapshots()[2].status, before[2].status);
  assert.deepEqual(result.untouchedStatementIds, ["statement-2", "statement-3"]);
  assert.deepEqual(state.statuses(), ["CALCULATED", "CLOSED", "VOIDED"]);
});

test("falha reverte o lote e nova tentativa nao duplica processamento", async () => {
  const state = await harness(["DRAFT", "DRAFT"], true);
  await assert.rejects(state.calculate(), /TEST_ONLY period update failure/);
  assert.deepEqual(state.statuses(), ["DRAFT", "DRAFT"]);
  assert.equal(state.periodSnapshot().status, "OPEN");
  state.disableFailure();
  const result = await state.calculate();
  assert.deepEqual(result.calculatedStatementIds, ["statement-1", "statement-2"]);
  assert.deepEqual(state.statuses(), ["CALCULATED", "CALCULATED"]);
});
