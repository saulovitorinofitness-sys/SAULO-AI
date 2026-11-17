import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import ts from "typescript";

test("preparacao, calculo e fechamento nao consultam documentos opcionais do funcionario", async () => {
  const source = await readFile(new URL("./service.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  class RepositoryError extends Error {}
  const testModule = { exports: {} as { createPayrollService: (repository: Record<string, unknown>) => {
    createStatement: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    calculatePeriod: (unitId: string, periodId: string, actorId: string) => Promise<Record<string, unknown>>;
    closePeriod: (unitId: string, periodId: string, actorId: string) => Promise<Record<string, unknown>>;
  } } };
  runInNewContext(compiled, {
    module: testModule,
    exports: testModule.exports,
    Buffer,
    Date,
    Promise,
    process,
    require(id: string) {
      if (id === "server-only") return {};
      if (id === "node:crypto") return crypto;
      if (id === "./repository") return {
        EmploymentUpdateError: RepositoryError,
        PayrollRepositoryError: RepositoryError,
        payrollRepository: {},
      };
      throw new Error(id);
    },
  });

  const unitId = "11111111-1111-4111-8111-111111111111";
  const periodId = "22222222-2222-4222-8222-222222222222";
  const employmentId = "33333333-3333-4333-8333-333333333333";
  const actorId = "44444444-4444-4444-8444-444444444444";
  const statementId = "55555555-5555-4555-8555-555555555555";
  let periodStatus = "OPEN";
  let statementStatus = "DRAFT";
  let writes = 0;
  const period = () => ({ id: periodId, businessUnitId: unitId, competence: new Date("2026-09-01T00:00:00.000Z"), status: periodStatus });
  const statement = () => ({ id: statementId, businessUnitId: unitId, payrollPeriodId: periodId, employmentId, status: statementStatus });
  const employeeWithoutOptionalData = {
    id: "66666666-6666-4666-8666-666666666666",
    fullName: "FUNCIONARIO TEST_ONLY",
    status: "ACTIVE",
    taxIdentifierHash: null,
    taxIdentifierEncrypted: null,
    identityDocumentEncrypted: null,
    socialSecurityHash: null,
    socialSecurityEncrypted: null,
    paymentMethod: null,
    paymentDetailsEncrypted: null,
    employments: [{
      id: employmentId,
      businessUnitId: unitId,
      status: "ACTIVE",
      jobRole: { id: "77777777-7777-4777-8777-777777777777", name: "Cargo TEST_ONLY" },
      compensations: [{
        id: "88888888-8888-4888-8888-888888888888",
        unit: "MONTHLY",
        amount: { toFixed: () => "1500.00" },
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: null,
      }],
    }],
  };
  const repository = {
    findPeriod: async () => period(),
    listEmployees: async () => [employeeWithoutOptionalData],
    createStatement: async (input: Record<string, unknown>) => { writes++; return { ...statement(), ...input }; },
    listStatements: async () => [statement()],
    updateStatementStatus: async (_unitId: string, _statementId: string, status: string) => {
      writes++;
      statementStatus = status;
      return statement();
    },
    updatePeriodStatus: async (_unitId: string, _periodId: string, status: string) => {
      writes++;
      periodStatus = status;
      return period();
    },
    calculatePeriodAtomically: async () => {
      const alreadyCalculatedStatementIds = statementStatus === "CALCULATED" ? [statementId] : [];
      const calculatedStatementIds = statementStatus === "DRAFT" ? [statementId] : [];
      if (statementStatus === "DRAFT") {
        writes++;
        statementStatus = "CALCULATED";
      }
      if (periodStatus !== "CALCULATED") {
        writes++;
        periodStatus = "CALCULATED";
      }
      return { kind: "SUCCESS", period: period(), calculatedStatementIds, alreadyCalculatedStatementIds, untouchedStatementIds: [], pendingStatementIds: [] };
    },
    closePeriodAtomically: async () => {
      const alreadyClosedStatementIds = statementStatus === "CLOSED" ? [statementId] : [];
      const closedStatementIds = statementStatus === "CALCULATED" ? [statementId] : [];
      if (statementStatus === "CALCULATED") {
        writes++;
        statementStatus = "CLOSED";
      }
      if (periodStatus !== "CLOSED") {
        writes++;
        periodStatus = "CLOSED";
      }
      return { kind: "SUCCESS", period: period(), closedStatementIds, alreadyClosedStatementIds, pendingStatementIds: [] };
    },
  };
  const service = testModule.exports.createPayrollService(repository);

  const prepared = await service.createStatement({ businessUnitId: unitId, payrollPeriodId: periodId, employmentId, actorUserId: actorId });
  assert.equal((prepared.lineItems as { code: string }[])[0]?.code, "SALARIO_BASE");
  assert.equal(writes, 1);

  await service.calculatePeriod(unitId, periodId, actorId);
  assert.equal(periodStatus, "CALCULATED");
  assert.equal(statementStatus, "CALCULATED");

  await service.closePeriod(unitId, periodId, actorId);
  assert.equal(periodStatus, "CLOSED");
  assert.equal(statementStatus, "CLOSED");
  assert.equal(employeeWithoutOptionalData.taxIdentifierEncrypted, null);
  assert.equal(employeeWithoutOptionalData.identityDocumentEncrypted, null);
  assert.equal(employeeWithoutOptionalData.socialSecurityEncrypted, null);
  assert.equal(employeeWithoutOptionalData.paymentDetailsEncrypted, null);
});
