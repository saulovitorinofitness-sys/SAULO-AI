import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  financialAccessDenied,
  financialAuthenticationResponse,
  financialErrorResponse,
  resolveFinancialAccess,
} from "@/features/financial/http";
import { FinancialError } from "@/features/financial/contracts";
import { financialService } from "@/features/financial/service";
import {
  isLegacyServiceReceiptPostEnabled,
  legacyServiceReceiptCutoverFromEnvironment,
} from "@/features/financial/service-receipts/legacy-cutover";
import {
  PayrollDomainError,
  payrollService,
  type PayrollDomainErrorCode,
} from "@/features/financial/payroll/service";
import { BUILT_IN_IDS } from "@/modules/permissions";

export const runtime = "nodejs";

const statementsQuerySchema = z.object({
  resource: z.literal("statements"),
  businessUnitId: z.uuid(),
  payrollPeriodId: z.uuid().optional(),
}).strict();

const statementDetailsQuerySchema = z.object({
  resource: z.literal("statement-details"),
  businessUnitId: z.uuid(),
  payrollStatementId: z.uuid(),
}).strict();

const payrollReceiptsQuerySchema = z.object({
  resource: z.literal("payroll-receipts"),
  businessUnitId: z.uuid(),
  payrollStatementId: z.uuid().optional(),
}).strict();

const businessUnitsQuerySchema = z.object({
  resource: z.literal("business-units"),
}).strict();

const jobRolesQuerySchema = z.object({
  resource: z.literal("job-roles"),
  businessUnitId: z.uuid(),
}).strict();

const employeesQuerySchema = z.object({
  resource: z.literal("employees"),
  businessUnitId: z.uuid(),
}).strict();

const payrollPeriodsQuerySchema = z.object({
  resource: z.literal("payroll-periods"),
  businessUnitId: z.uuid(),
}).strict();

const serviceReceiptsQuerySchema = z.object({
  resource: z.literal("service-receipts"),
  businessUnitId: z.uuid(),
}).strict();

const querySchema = z.discriminatedUnion("resource", [
  businessUnitsQuerySchema,
  jobRolesQuerySchema,
  employeesQuerySchema,
  payrollPeriodsQuerySchema,
  serviceReceiptsQuerySchema,
  statementsQuerySchema,
  statementDetailsQuerySchema,
  payrollReceiptsQuerySchema,
]);

const uuid = z.uuid();
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();
const dateOnly = z.iso.date().transform((value) => new Date(`${value}T00:00:00.000Z`));
const dateTime = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const money = z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/);
const quantity = z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/);

const compensationSchema = z.object({
  amount: money,
  unit: z.enum(["MONTHLY", "HOURLY", "PER_SERVICE"]),
  effectiveFrom: dateOnly,
  effectiveTo: dateOnly.nullable().optional(),
  changeReason: requiredText(500),
}).strict();

const employmentFieldsSchema = z.object({
  businessUnitId: uuid,
  jobRoleId: uuid,
  code: requiredText(60),
  type: z.enum(["EMPLOYEE", "AUTONOMOUS"]),
  status: z.enum(["ACTIVE", "SUSPENDED", "TERMINATED"]).optional(),
  workSchedule: z.enum(["FULL_TIME", "PART_TIME", "HOURLY", "CUSTOM"]).optional(),
  weeklyWorkingHours: money.nullable().optional(),
  startedAt: dateOnly,
  endedAt: dateOnly.nullable().optional(),
  compensation: compensationSchema.optional(),
}).strict();

const lineItemSchema = z.object({
  type: z.enum(["EARNING", "BENEFIT", "DEDUCTION"]),
  origin: z.enum(["CALCULATED", "MANUAL", "ADJUSTMENT"]).optional(),
  code: requiredText(60),
  description: requiredText(240),
  quantity: quantity.nullable().optional(),
  unitAmount: quantity.nullable().optional(),
  amount: money,
  affectsNet: z.boolean().optional(),
}).strict();

const createJobRoleSchema = z.object({
  action: z.literal("create-job-role"),
  businessUnitId: uuid,
  code: requiredText(60),
  name: requiredText(120),
  description: optionalText(500),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
}).strict();

const registerEmployeeSchema = employmentFieldsSchema.extend({
  action: z.literal("register-employee"),
  fullName: requiredText(180),
  userId: uuid.nullable().optional(),
  taxIdentifierHash: z.string().trim().length(64).nullable().optional(),
  taxIdentifierEncrypted: optionalText(2_000),
  employeeStatus: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
}).strict();

const deleteEmployeeSchema = z.object({
  action: z.literal("delete-employee"),
  businessUnitId: uuid,
  employeeId: uuid,
}).strict();

const updateEmployeePersonalDataSchema = z.object({
  action: z.literal("update-employee-personal-data"),
  businessUnitId: uuid,
  employeeId: uuid,
  fullName: requiredText(180),
  cpf: requiredText(14),
  birthDate: dateOnly,
  identityDocument: optionalText(40),
  identityIssuer: optionalText(40),
  identityState: optionalText(2),
  socialSecurityNumber: optionalText(14),
  phone: optionalText(30),
  email: optionalText(180),
  postalCode: optionalText(9),
  addressStreet: optionalText(180),
  addressNumber: optionalText(30),
  addressComplement: optionalText(120),
  addressNeighborhood: optionalText(120),
  addressCity: optionalText(120),
  addressState: optionalText(2),
  paymentMethod: optionalText(30),
  paymentDetails: optionalText(2_000),
}).strict();

const createEmploymentSchema = employmentFieldsSchema.extend({
  action: z.literal("create-employment"),
  employeeId: uuid,
}).strict();

const updateEmploymentSchema = z.object({
  action: z.literal("update-employment"),
  businessUnitId: uuid,
  employmentId: uuid,
  expectedUpdatedAt: dateTime,
  jobRoleId: uuid.optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "TERMINATED"]).optional(),
  workSchedule: z.enum(["FULL_TIME", "PART_TIME", "HOURLY", "CUSTOM"]).optional(),
  weeklyWorkingHours: money.nullable().optional(),
  startedAt: dateOnly.optional(),
  endedAt: dateOnly.nullable().optional(),
}).strict();

const addCompensationSchema = compensationSchema.extend({
  action: z.literal("add-compensation"),
  businessUnitId: uuid,
  employmentId: uuid,
}).strict();

const openPeriodSchema = z.object({
  action: z.literal("open-period"),
  businessUnitId: uuid,
  competence: dateOnly,
}).strict();

const createStatementSchema = z.object({
  action: z.literal("create-statement"),
  businessUnitId: uuid,
  payrollPeriodId: uuid,
  employmentId: uuid,
  compensationId: uuid.nullable().optional(),
  lineItems: z.array(lineItemSchema).max(200).optional(),
}).strict();

const addLineItemSchema = z.object({
  action: z.literal("add-line-item"),
  businessUnitId: uuid,
  payrollStatementId: uuid,
  type: z.enum(["EARNING", "BENEFIT", "DEDUCTION"]),
  code: requiredText(60),
  description: requiredText(240),
  quantity: quantity.nullable().optional(),
  unitAmount: quantity.nullable().optional(),
  amount: money,
  affectsNet: z.boolean().optional(),
}).strict();

const createAdjustmentSchema = z.object({
  action: z.literal("create-adjustment"),
  businessUnitId: uuid,
  sourcePayrollStatementId: uuid,
  type: z.enum(["CREDIT", "DEBIT"]),
  amount: money,
  reason: requiredText(500),
}).strict();

const applyAdjustmentSchema = z.object({
  action: z.literal("apply-adjustment"),
  businessUnitId: uuid,
  adjustmentId: uuid,
  appliedPayrollStatementId: uuid,
}).strict();

const statementActionSchema = z.object({
  action: z.literal("calculate-statement"),
  businessUnitId: uuid,
  payrollStatementId: uuid,
}).strict();

const calculatePeriodSchema = z.object({
  action: z.literal("calculate-period"),
  businessUnitId: uuid,
  payrollPeriodId: uuid,
}).strict();

const closePeriodSchema = z.object({
  action: z.literal("close-period"),
  businessUnitId: uuid,
  payrollPeriodId: uuid,
}).strict();

const issuePaymentReceiptSchema = z.object({
  action: z.literal("issue-payment-receipt"),
  businessUnitId: uuid,
  payrollStatementId: uuid,
  receiptNumber: requiredText(80),
  version: z.number().int().positive().optional(),
  documentHash: z.string().trim().length(64).nullable().optional(),
  storageKey: optionalText(500),
  issuedAt: dateTime,
}).strict();

const issueServiceReceiptSchema = z.object({
  action: z.literal("issue-service-receipt"),
  businessUnitId: uuid,
  providerEmploymentId: uuid.nullable().optional(),
  financialEntryId: uuid.nullable().optional(),
  providerType: z.enum(["AUTONOMOUS", "COMPANY"]),
  receiptNumber: requiredText(80),
  competence: dateOnly,
  serviceDate: dateOnly,
  serviceDescription: requiredText(500),
  recipientName: requiredText(180),
  recipientTaxIdentifierHash: z.string().trim().length(64).nullable().optional(),
  recipientTaxIdentifierEncrypted: optionalText(2_000),
  amount: money,
  documentHash: z.string().trim().length(64).nullable().optional(),
  storageKey: optionalText(500),
  issuedAt: dateTime,
}).strict();

const actionSchema = z.discriminatedUnion("action", [
  createJobRoleSchema,
  registerEmployeeSchema,
  deleteEmployeeSchema,
  updateEmployeePersonalDataSchema,
  createEmploymentSchema,
  updateEmploymentSchema,
  addCompensationSchema,
  openPeriodSchema,
  createStatementSchema,
  addLineItemSchema,
  createAdjustmentSchema,
  applyAdjustmentSchema,
  statementActionSchema,
  calculatePeriodSchema,
  closePeriodSchema,
  issuePaymentReceiptSchema,
  issueServiceReceiptSchema,
]);

const conflictCodes = new Set<PayrollDomainErrorCode>([
  "DUPLICATE_EMPLOYEE_OR_EMPLOYMENT",
  "DUPLICATE_JOB_ROLE",
  "DUPLICATE_PERIOD",
  "DUPLICATE_STATEMENT",
  "DUPLICATE_LINE_ITEM",
  "DUPLICATE_RECEIPT",
  "EMPLOYEE_HAS_HISTORY",
  "INVALID_PERIOD_STATE",
  "PERIOD_CLOSED",
  "INVALID_STATEMENT_STATE",
  "INCOMPLETE_PAYROLL",
  "INVALID_ADJUSTMENT_STATE",
  "TERMINATED_EMPLOYMENT",
  "UPDATE_CONFLICT",
]);

function payrollErrorResponse(error: PayrollDomainError) {
  const status = error.code === "NOT_FOUND"
    ? 404
    : conflictCodes.has(error.code)
      ? 409
      : 400;
  return NextResponse.json(
    { code: error.code, message: error.message },
    { status },
  );
}

type JobRoleResult = Awaited<ReturnType<typeof payrollService.createJobRole>>;
type EmployeeResult = Awaited<ReturnType<typeof payrollService.registerEmployee>>;
type EmploymentResult = Awaited<ReturnType<typeof payrollService.addEmployment>>;
type CompensationResult = Awaited<ReturnType<typeof payrollService.changeCompensation>>;
type PeriodResult = Awaited<ReturnType<typeof payrollService.openPeriod>>;
type AdjustmentResult = Awaited<ReturnType<typeof payrollService.createAdjustment>>;
type PayrollReceiptResult = Awaited<ReturnType<typeof payrollService.createPaymentReceipt>>["receipt"];
type ServiceReceiptResult = Awaited<ReturnType<typeof payrollService.createServiceReceipt>>;

function jobRoleDto(role: JobRoleResult) {
  return {
    id: role.id,
    businessUnitId: role.businessUnitId,
    code: role.code,
    name: role.name,
    description: role.description,
    status: role.status,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

function employmentDto(employment: EmploymentResult) {
  return {
    id: employment.id,
    employeeId: employment.employeeId,
    businessUnitId: employment.businessUnitId,
    jobRole: {
      id: employment.jobRole.id,
      code: employment.jobRole.code,
      name: employment.jobRole.name,
    },
    code: employment.code,
    type: employment.type,
    status: employment.status,
    workSchedule: employment.workSchedule,
    weeklyWorkingHours: employment.weeklyWorkingHours?.toString() ?? null,
    startedAt: employment.startedAt.toISOString().slice(0, 10),
    endedAt: employment.endedAt?.toISOString().slice(0, 10) ?? null,
    createdAt: employment.createdAt.toISOString(),
    updatedAt: employment.updatedAt.toISOString(),
  };
}

function employeeDto(employee: EmployeeResult) {
  return {
    id: employee.id,
    fullName: employee.fullName,
    status: employee.status,
    personalData: {
      hasCpf: Boolean(employee.taxIdentifierHash),
      birthDate: employee.birthDate?.toISOString().slice(0, 10) ?? null,
      hasIdentityDocument: Boolean(employee.identityDocumentEncrypted),
      identityIssuer: employee.identityIssuer,
      identityState: employee.identityState,
      hasSocialSecurityNumber: Boolean(employee.socialSecurityHash),
      phone: employee.phone,
      email: employee.email,
      postalCode: employee.postalCode,
      addressStreet: employee.addressStreet,
      addressNumber: employee.addressNumber,
      addressComplement: employee.addressComplement,
      addressNeighborhood: employee.addressNeighborhood,
      addressCity: employee.addressCity,
      addressState: employee.addressState,
      paymentMethod: employee.paymentMethod,
      hasPaymentDetails: Boolean(employee.paymentDetailsEncrypted),
    },
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
    employments: employee.employments.map((employment) => ({
      id: employment.id,
      businessUnitId: employment.businessUnitId,
      jobRole: {
        id: employment.jobRole.id,
        code: employment.jobRole.code,
        name: employment.jobRole.name,
      },
      code: employment.code,
      type: employment.type,
      status: employment.status,
      workSchedule: employment.workSchedule,
      weeklyWorkingHours: employment.weeklyWorkingHours?.toString() ?? null,
      compensations: employment.compensations.map((compensation) => ({
        id: compensation.id,
        amount: compensation.amount.toString(),
        unit: compensation.unit,
        effectiveFrom: compensation.effectiveFrom.toISOString().slice(0, 10),
        effectiveTo: compensation.effectiveTo?.toISOString().slice(0, 10) ?? null,
      })),
      startedAt: employment.startedAt.toISOString().slice(0, 10),
      endedAt: employment.endedAt?.toISOString().slice(0, 10) ?? null,
      updatedAt: employment.updatedAt.toISOString(),
    })),
  };
}

function compensationDto(compensation: CompensationResult) {
  return {
    id: compensation.id,
    employmentId: compensation.employmentId,
    businessUnitId: compensation.businessUnitId,
    unit: compensation.unit,
    effectiveFrom: compensation.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: compensation.effectiveTo?.toISOString().slice(0, 10) ?? null,
    createdAt: compensation.createdAt.toISOString(),
    updatedAt: compensation.updatedAt.toISOString(),
  };
}

function periodDto(period: PeriodResult) {
  return {
    id: period.id,
    businessUnitId: period.businessUnitId,
    competence: period.competence.toISOString().slice(0, 10),
    status: period.status,
    calculatedAt: period.calculatedAt?.toISOString() ?? null,
    closedAt: period.closedAt?.toISOString() ?? null,
    createdAt: period.createdAt.toISOString(),
    updatedAt: period.updatedAt.toISOString(),
  };
}

function adjustmentDto(adjustment: AdjustmentResult) {
  return {
    id: adjustment.id,
    businessUnitId: adjustment.businessUnitId,
    sourcePayrollStatementId: adjustment.sourcePayrollStatementId,
    appliedPayrollStatementId: adjustment.appliedPayrollStatementId,
    type: adjustment.type,
    status: adjustment.status,
    amount: adjustment.amount.toFixed(2),
    reason: adjustment.reason,
    createdAt: adjustment.createdAt.toISOString(),
    appliedAt: adjustment.appliedAt?.toISOString() ?? null,
  };
}

function payrollReceiptDto(receipt: PayrollReceiptResult) {
  return {
    id: receipt.id,
    businessUnitId: receipt.businessUnitId,
    payrollStatementId: receipt.payrollStatementId,
    receiptNumber: receipt.receiptNumber,
    version: receipt.version,
    status: receipt.status,
    issuedAt: receipt.issuedAt?.toISOString() ?? null,
    createdAt: receipt.createdAt.toISOString(),
    updatedAt: receipt.updatedAt.toISOString(),
  };
}

function serviceReceiptDto(receipt: ServiceReceiptResult) {
  return {
    id: receipt.id,
    businessUnitId: receipt.businessUnitId,
    providerEmploymentId: receipt.providerEmploymentId,
    providerType: receipt.providerType,
    receiptNumber: receipt.receiptNumber,
    competence: receipt.competence.toISOString().slice(0, 10),
    serviceDate: receipt.serviceDate.toISOString().slice(0, 10),
    serviceDescription: receipt.serviceDescription,
    recipientName: receipt.recipientName,
    amount: receipt.amount.toFixed(2),
    status: receipt.status,
    issuedAt: receipt.issuedAt?.toISOString() ?? null,
    createdAt: receipt.createdAt.toISOString(),
    updatedAt: receipt.updatedAt.toISOString(),
  };
}

function withoutAction<T extends { action: string }>(value: T): Omit<T, "action"> {
  const { action, ...input } = value;
  void action;
  return input;
}

const protectedPayrollFields = new Set([
  "taxIdentifierHash",
  "taxIdentifierEncrypted",
  "identityDocumentEncrypted",
  "socialSecurityHash",
  "socialSecurityEncrypted",
  "paymentDetailsEncrypted",
  "recipientTaxIdentifierHash",
  "recipientTaxIdentifierEncrypted",
]);

function safePayrollPayload<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (key, nestedValue) => (
    protectedPayrollFields.has(key) ? undefined : nestedValue
  ))) as T;
}

export async function GET(request: Request) {
  try {
    const access = await resolveFinancialAccess(request);
    if (access.user.id !== BUILT_IN_IDS.users.sauloXavierVitorino) return financialAccessDenied();
  } catch (error) {
    return financialAuthenticationResponse(error) ?? NextResponse.json(
      { code: "SESSION_UNAVAILABLE", message: "Não foi possível validar a sessão agora." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "INVALID_QUERY",
        message: "Informe uma consulta válida e a unidade empresarial.",
      },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.resource === "business-units") {
      const catalog = await financialService.catalog();
      const businessUnits = catalog.businessUnits
        .filter((unit) => unit.status === "ACTIVE")
        .map((unit) => ({
          id: unit.id,
          name: unit.name,
          code: unit.code,
          status: unit.status,
        }));
      return NextResponse.json({ businessUnits });
    }

    if (parsed.data.resource === "job-roles") {
      const jobRoles = await payrollService.listJobRoles(
        parsed.data.businessUnitId,
      );
      return NextResponse.json({
        jobRoles: jobRoles.map(jobRoleDto),
      });
    }

    if (parsed.data.resource === "employees") {
      const employees = await payrollService.listEmployees(
        parsed.data.businessUnitId,
      );
      const largestEmploymentNumber = employees
        .flatMap((employee) => employee.employments)
        .reduce((largest, employment) => {
          const match = /^MAT[-._](\d+)$/i.exec(employment.code.trim());
          if (!match) return largest;
          const value = Number(match[1]);
          return Number.isFinite(value) ? Math.max(largest, value) : largest;
        }, 0);
      return NextResponse.json({
        employees: employees.map(employeeDto),
        nextEmploymentCode: `MAT-${String(largestEmploymentNumber + 1).padStart(3, "0")}`,
      });
    }

    if (parsed.data.resource === "payroll-periods") {
      const periods = await payrollService.listPeriods(
        parsed.data.businessUnitId,
      );
      return NextResponse.json({
        periods: periods.map(periodDto),
      });
    }

    if (parsed.data.resource === "service-receipts") {
      const receipts = await payrollService.listServiceReceipts(
        parsed.data.businessUnitId,
      );
      return NextResponse.json({
        receipts: receipts.map(serviceReceiptDto),
      });
    }

    if (parsed.data.resource === "statements") {
      const statements = await payrollService.listStatements(
        parsed.data.businessUnitId,
        parsed.data.payrollPeriodId,
      );
      return NextResponse.json({
        statements: safePayrollPayload(statements),
        ...(statements.length === 0
          ? { message: "Nenhuma folha de pagamento cadastrada para a unidade selecionada." }
          : {}),
      });
    }

    if (parsed.data.resource === "statement-details") {
      const statement = await payrollService.getStatementDetails(
        parsed.data.businessUnitId,
        parsed.data.payrollStatementId,
      );
      return NextResponse.json({ statement: safePayrollPayload(statement) });
    }

    const receipts = await payrollService.listPayrollReceipts(
      parsed.data.businessUnitId,
      parsed.data.payrollStatementId,
    );
    return NextResponse.json({ receipts });
  } catch (error) {
    if (error instanceof FinancialError) return financialErrorResponse(error);
    if (error instanceof PayrollDomainError) return payrollErrorResponse(error);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "Não foi possível consultar a folha de pagamento.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let access;
  try {
    access = await resolveFinancialAccess(request);
  } catch (error) {
    return financialAuthenticationResponse(error) ?? NextResponse.json(
      { code: "SESSION_UNAVAILABLE", message: "Não foi possível validar a sessão agora." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (access.user.id !== BUILT_IN_IDS.users.sauloXavierVitorino) return financialAccessDenied();

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "INVALID_PAYLOAD",
        message: "Revise a ação e os dados obrigatórios da folha de pagamento.",
      },
      { status: 400 },
    );
  }

  const actorUserId = access.user.id;

  try {
    if (parsed.data.action === "create-job-role") {
      const input = withoutAction(parsed.data);
      const jobRole = await payrollService.createJobRole({
        ...input,
        actorUserId,
      });
      return NextResponse.json({ jobRole: jobRoleDto(jobRole) }, { status: 201 });
    }

    if (parsed.data.action === "register-employee") {
      const input = withoutAction(parsed.data);
      const employee = await payrollService.registerEmployee({
        ...input,
        actorUserId,
      });
      return NextResponse.json({ employee: employeeDto(employee) }, { status: 201 });
    }

    if (parsed.data.action === "delete-employee") {
      const deleted = await payrollService.deleteEmployeeWithoutHistory(
        parsed.data.businessUnitId,
        parsed.data.employeeId,
        actorUserId,
      );
      return NextResponse.json({ deleted });
    }

    if (parsed.data.action === "update-employee-personal-data") {
      const input = withoutAction(parsed.data);
      const employee = await payrollService.updateEmployeePersonalData({
        ...input,
        actorUserId,
      });
      return NextResponse.json({ employee: employeeDto(employee) });
    }

    if (parsed.data.action === "create-employment") {
      const { employeeId, ...input } = withoutAction(parsed.data);
      const employment = await payrollService.addEmployment(employeeId, {
        ...input,
        actorUserId,
      });
      return NextResponse.json(
        { employment: employmentDto(employment) },
        { status: 201 },
      );
    }

    if (parsed.data.action === "update-employment") {
      const input = withoutAction(parsed.data);
      const employment = await payrollService.updateEmployment({
        ...input,
        actorUserId,
      });
      return NextResponse.json({ employment: employmentDto(employment) });
    }

    if (parsed.data.action === "add-compensation") {
      const { businessUnitId, employmentId, ...compensationInput } = withoutAction(
        parsed.data,
      );
      const compensation = await payrollService.changeCompensation(
        businessUnitId,
        employmentId,
        compensationInput,
        actorUserId,
      );
      return NextResponse.json(
        { compensation: compensationDto(compensation) },
        { status: 201 },
      );
    }

    if (parsed.data.action === "open-period") {
      const period = await payrollService.openPeriod({
        businessUnitId: parsed.data.businessUnitId,
        competence: parsed.data.competence,
        actorUserId,
      });
      return NextResponse.json({ period: periodDto(period) }, { status: 201 });
    }

    if (parsed.data.action === "create-statement") {
      const input = withoutAction(parsed.data);
      const created = await payrollService.createStatement({
        ...input,
        actorUserId,
      });
      const statement = await payrollService.getStatementDetails(
        input.businessUnitId,
        created.id,
      );
      return NextResponse.json(
        { statement: safePayrollPayload(statement) },
        { status: 201 },
      );
    }

    if (parsed.data.action === "add-line-item") {
      const { type, ...input } = withoutAction(parsed.data);
      const statementRecord = type === "EARNING"
        ? await payrollService.addEarning({ ...input, actorUserId })
        : type === "BENEFIT"
          ? await payrollService.addBenefit({ ...input, actorUserId })
          : await payrollService.addDeduction({ ...input, actorUserId });
      const statement = await payrollService.getStatementDetails(
        input.businessUnitId,
        statementRecord.id,
      );
      return NextResponse.json({ statement: safePayrollPayload(statement) });
    }

    if (parsed.data.action === "create-adjustment") {
      const input = withoutAction(parsed.data);
      const adjustment = await payrollService.createAdjustment({
        ...input,
        actorUserId,
      });
      return NextResponse.json(
        { adjustment: adjustmentDto(adjustment) },
        { status: 201 },
      );
    }

    if (parsed.data.action === "apply-adjustment") {
      const input = withoutAction(parsed.data);
      const statementRecord = await payrollService.applyAdjustment({
        ...input,
        actorUserId,
      });
      const statement = await payrollService.getStatementDetails(
        input.businessUnitId,
        statementRecord.id,
      );
      return NextResponse.json({ statement: safePayrollPayload(statement) });
    }

    if (parsed.data.action === "calculate-statement") {
      const statementRecord = await payrollService.calculateStatement(
        parsed.data.businessUnitId,
        parsed.data.payrollStatementId,
        actorUserId,
      );
      const statement = await payrollService.getStatementDetails(
        parsed.data.businessUnitId,
        statementRecord.id,
      );
      return NextResponse.json({ statement: safePayrollPayload(statement) });
    }

    if (parsed.data.action === "calculate-period") {
      const calculation = await payrollService.calculatePeriod(
        parsed.data.businessUnitId,
        parsed.data.payrollPeriodId,
        actorUserId,
      );
      return NextResponse.json({
        period: periodDto(calculation.period),
        calculation: {
          calculated: calculation.calculatedStatementIds.length,
          alreadyCalculated: calculation.alreadyCalculatedStatementIds.length,
          untouched: calculation.untouchedStatementIds.length,
          pending: calculation.pendingStatementIds.length,
        },
      });
    }

    if (parsed.data.action === "close-period") {
      const closure = await payrollService.closePeriod(
        parsed.data.businessUnitId,
        parsed.data.payrollPeriodId,
        actorUserId,
      );
      return NextResponse.json({
        period: periodDto(closure.period),
        closure: {
          closed: closure.closedStatementIds.length,
          alreadyClosed: closure.alreadyClosedStatementIds.length,
          pending: closure.pendingStatementIds.length,
        },
      });
    }

    if (parsed.data.action === "issue-payment-receipt") {
      const result = await payrollService.createPaymentReceipt({
        businessUnitId: parsed.data.businessUnitId,
        payrollStatementId: parsed.data.payrollStatementId,
        receiptNumber: parsed.data.receiptNumber,
        version: parsed.data.version,
        documentHash: parsed.data.documentHash,
        storageKey: parsed.data.storageKey,
        issuance: { at: parsed.data.issuedAt, actorUserId },
        actorUserId,
      });
      return NextResponse.json(
        {
          receipt: payrollReceiptDto(result.receipt),
          statement: safePayrollPayload(result.statement),
        },
        { status: 201 },
      );
    }

    if (!isLegacyServiceReceiptPostEnabled(
      legacyServiceReceiptCutoverFromEnvironment(process.env),
    )) {
      return NextResponse.json(
        {
          code: "LEGACY_SERVICE_RECEIPT_ISSUANCE_DISABLED",
          message: "Novas emissões devem usar o fluxo de recibos de prestação de serviços.",
        },
        { status: 409 },
      );
    }

    const receipt = await payrollService.createServiceReceipt({
      businessUnitId: parsed.data.businessUnitId,
      providerEmploymentId: parsed.data.providerEmploymentId,
      financialEntryId: parsed.data.financialEntryId,
      providerType: parsed.data.providerType,
      receiptNumber: parsed.data.receiptNumber,
      competence: parsed.data.competence,
      serviceDate: parsed.data.serviceDate,
      serviceDescription: parsed.data.serviceDescription,
      recipientName: parsed.data.recipientName,
      recipientTaxIdentifierHash: parsed.data.recipientTaxIdentifierHash,
      recipientTaxIdentifierEncrypted: parsed.data.recipientTaxIdentifierEncrypted,
      amount: parsed.data.amount,
      documentHash: parsed.data.documentHash,
      storageKey: parsed.data.storageKey,
      issuance: { at: parsed.data.issuedAt, actorUserId },
      actorUserId,
    });
    return NextResponse.json(
      { receipt: serviceReceiptDto(receipt) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PayrollDomainError) return payrollErrorResponse(error);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "Não foi possível processar a operação da folha de pagamento.",
      },
      { status: 500 },
    );
  }
}
