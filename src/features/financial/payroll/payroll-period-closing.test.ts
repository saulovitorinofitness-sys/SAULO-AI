import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

type StatementStatus = "DRAFT" | "CALCULATED" | "CLOSED" | "VOIDED";
type Statement = {
  id: string;
  status: StatementStatus;
  netAmount: string;
  financialEntryId: null;
  lineItemIds: readonly string[];
  closedAt: Date | null;
  closedByUserId: string | null;
};

async function harness(initialStatuses: readonly StatementStatus[], failPeriodUpdate = false) {
  const source = await readFile(new URL("./repository.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let statements: Statement[] = initialStatuses.map((status, index) => ({
    id: `statement-${index + 1}`,
    status,
    netAmount: index === 0 ? "810.00" : "1500.00",
    financialEntryId: null,
    lineItemIds: [`line-${index + 1}`],
    closedAt: status === "CLOSED" ? new Date("2026-09-20T12:00:00.000Z") : null,
    closedByUserId: status === "CLOSED" ? "original-actor" : null,
  }));
  let period = {
    id: "period-1",
    businessUnitId: "unit-1",
    status: "CALCULATED",
    closedAt: null as Date | null,
    closedByUserId: null as string | null,
  };
  let shouldFail = failPeriodUpdate;
  let statementUpdates = 0;
  let periodUpdates = 0;
  let financialWrites = 0;
  const transaction = {
    $queryRaw: async () => [{ id: period.id }],
    payrollPeriod: {
      findUnique: async () => ({ ...period }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        periodUpdates++;
        if (shouldFail) throw new Error("TEST_ONLY close failure");
        period = { ...period, ...data } as typeof period;
        return { ...period };
      },
    },
    payrollStatement: {
      findMany: async () => statements.map((statement) => ({ id: statement.id, status: statement.status })),
      updateMany: async ({ where, data }: { where: { id: { in: string[] }; status: StatementStatus }; data: Record<string, unknown> }) => {
        const eligible = statements.filter((statement) => where.id.in.includes(statement.id) && statement.status === where.status);
        statementUpdates++;
        statements = statements.map((statement) => eligible.some((candidate) => candidate.id === statement.id)
          ? { ...statement, ...data } as Statement
          : statement);
        return { count: eligible.length };
      },
    },
    financialEntry: { create: () => { financialWrites++; } },
    payrollReceipt: { create: () => { financialWrites++; } },
    financialSettlement: { create: () => { financialWrites++; } },
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
    closePeriodAtomically: (unitId: string, periodId: string, actorId: string) => Promise<{
      kind: string;
      closedStatementIds?: readonly string[];
      alreadyClosedStatementIds?: readonly string[];
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
    close: () => testModule.exports.payrollRepository.closePeriodAtomically("unit-1", "period-1", "actor-1"),
    disableFailure: () => { shouldFail = false; },
    statements: () => statements.map((statement) => ({ ...statement })),
    period: () => ({ ...period }),
    statementUpdates: () => statementUpdates,
    periodUpdates: () => periodUpdates,
    financialWrites: () => financialWrites,
  };
}

test("fecha Aniethy e Maria juntas preservando valores e rubricas separados", async () => {
  const state = await harness(["CALCULATED", "CALCULATED"]);
  const before = state.statements();
  const result = await state.close();
  const after = state.statements();
  assert.deepEqual(result.closedStatementIds, ["statement-1", "statement-2"]);
  assert.deepEqual(after.map((statement) => statement.status), ["CLOSED", "CLOSED"]);
  assert.deepEqual(after.map((statement) => statement.netAmount), before.map((statement) => statement.netAmount));
  assert.deepEqual(after.map((statement) => statement.lineItemIds), before.map((statement) => statement.lineItemIds));
  assert.ok(after.every((statement) => statement.closedAt instanceof Date && statement.closedByUserId === "actor-1"));
  assert.equal(state.period().status, "CLOSED");
  assert.equal(state.financialWrites(), 0);
});

test("fechamento repetido e sucesso idempotente sem novas atualizacoes", async () => {
  const state = await harness(["CALCULATED", "CALCULATED"]);
  await state.close();
  const statementsAfterFirstClose = state.statements();
  const statementUpdates = state.statementUpdates();
  const periodUpdates = state.periodUpdates();
  const result = await state.close();
  assert.deepEqual(result.alreadyClosedStatementIds, ["statement-1", "statement-2"]);
  assert.deepEqual(state.statements(), statementsAfterFirstClose);
  assert.equal(state.statementUpdates(), statementUpdates);
  assert.equal(state.periodUpdates(), periodUpdates);
});

test("retoma estado parcial antigo fechando somente o demonstrativo calculado", async () => {
  const state = await harness(["CLOSED", "CALCULATED"]);
  const firstBefore = state.statements()[0];
  const result = await state.close();
  assert.deepEqual(result.alreadyClosedStatementIds, ["statement-1"]);
  assert.deepEqual(result.closedStatementIds, ["statement-2"]);
  assert.deepEqual(state.statements()[0], firstBefore);
  assert.deepEqual(state.statements().map((statement) => statement.status), ["CLOSED", "CLOSED"]);
});

test("demonstrativo em elaboracao ou cancelado impede fechamento sem alteracoes", async () => {
  for (const status of ["DRAFT", "VOIDED"] as const) {
    const state = await harness(["CALCULATED", status]);
    const before = state.statements();
    const result = await state.close();
    assert.equal(result.kind, "INCOMPLETE");
    assert.deepEqual(state.statements(), before);
    assert.equal(state.period().status, "CALCULATED");
    assert.equal(state.financialWrites(), 0);
  }
});

test("falha no lote reverte todos os fechamentos e a retomada nao duplica", async () => {
  const state = await harness(["CALCULATED", "CALCULATED"], true);
  await assert.rejects(state.close(), /TEST_ONLY close failure/);
  assert.deepEqual(state.statements().map((statement) => statement.status), ["CALCULATED", "CALCULATED"]);
  assert.equal(state.period().status, "CALCULATED");
  assert.equal(state.financialWrites(), 0);
  state.disableFailure();
  const result = await state.close();
  assert.deepEqual(result.closedStatementIds, ["statement-1", "statement-2"]);
  assert.deepEqual(state.statements().map((statement) => statement.status), ["CLOSED", "CLOSED"]);
});
