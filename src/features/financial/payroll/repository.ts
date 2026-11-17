import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

type EmployeeStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
type JobRoleStatus = "ACTIVE" | "INACTIVE";
type EmploymentType = "EMPLOYEE" | "AUTONOMOUS";
type EmploymentStatus = "ACTIVE" | "SUSPENDED" | "TERMINATED";
type EmploymentWorkSchedule = "FULL_TIME" | "PART_TIME" | "HOURLY" | "CUSTOM";
type CompensationUnit = "MONTHLY" | "HOURLY" | "PER_SERVICE";
type PayrollPeriodStatus = "OPEN" | "CALCULATED" | "CLOSED";
type PayrollStatementStatus = "DRAFT" | "CALCULATED" | "CLOSED" | "VOIDED";
type PayrollLineItemType = "EARNING" | "BENEFIT" | "DEDUCTION";
type PayrollLineItemOrigin = "CALCULATED" | "MANUAL" | "ADJUSTMENT";
type PayrollAdjustmentType = "CREDIT" | "DEBIT";
type ServiceProviderType = "AUTONOMOUS" | "COMPANY";

export type PayrollRepositoryErrorCode =
  | "DUPLICATE_EMPLOYMENT"
  | "DUPLICATE_JOB_ROLE"
  | "DUPLICATE_PERIOD"
  | "DUPLICATE_STATEMENT"
  | "DUPLICATE_LINE_ITEM"
  | "DUPLICATE_RECEIPT"
  | "EMPLOYEE_HAS_HISTORY"
  | "NOT_FOUND"
  | "INVALID_ADJUSTMENT_STATE";

export class PayrollRepositoryError extends Error {
  constructor(
    readonly code: PayrollRepositoryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PayrollRepositoryError";
  }
}

export type EmploymentUpdateErrorCode =
  | "NOT_FOUND"
  | "TERMINATED_EMPLOYMENT"
  | "UPDATE_CONFLICT";

export class EmploymentUpdateError extends Error {
  constructor(
    readonly code: EmploymentUpdateErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EmploymentUpdateError";
  }
}

function employeeIncludeForUnit(businessUnitId: string) {
  return {
    employments: {
      where: { businessUnitId },
      include: {
        jobRole: true,
        compensations: { orderBy: { effectiveFrom: "desc" as const } },
      },
      orderBy: { startedAt: "desc" as const },
    },
  } satisfies Prisma.EmployeeInclude;
}

const statementInclude = {
  payrollPeriod: true,
  employment: { include: { employee: true, jobRole: true } },
  compensation: true,
  lineItems: { orderBy: [{ type: "asc" as const }, { code: "asc" as const }] },
  sourceAdjustments: { orderBy: { createdAt: "asc" as const } },
  appliedAdjustments: { orderBy: { createdAt: "asc" as const } },
  receipts: { orderBy: { version: "desc" as const } },
} satisfies Prisma.PayrollStatementInclude;

export type EmployeeRecord = Prisma.EmployeeGetPayload<{
  include: ReturnType<typeof employeeIncludeForUnit>;
}>;
export type JobRoleRecord = Prisma.JobRoleGetPayload<Record<string, never>>;
export type EmploymentRecord = Prisma.EmploymentGetPayload<{
  include: { employee: true; jobRole: true; compensations: true };
}>;
export type PayrollPeriodRecord = Prisma.PayrollPeriodGetPayload<Record<string, never>>;
export type PayrollStatementRecord = Prisma.PayrollStatementGetPayload<{
  include: typeof statementInclude;
}>;
export type PayrollLineItemRecord = Prisma.PayrollLineItemGetPayload<Record<string, never>>;
export type PayrollAdjustmentRecord = Prisma.PayrollAdjustmentGetPayload<Record<string, never>>;
export type PayrollReceiptRecord = Prisma.PayrollReceiptGetPayload<Record<string, never>>;
export type ServiceReceiptRecord = Prisma.ServiceReceiptGetPayload<Record<string, never>>;

export interface DeletedEmployeeResult {
  readonly employeeId: string;
  readonly archived: boolean;
}

export type CalculatePayrollPeriodOutcome =
  | { readonly kind: "NOT_FOUND" }
  | { readonly kind: "CLOSED" }
  | { readonly kind: "EMPTY" }
  | {
      readonly kind: "SUCCESS";
      readonly period: PayrollPeriodRecord;
      readonly calculatedStatementIds: readonly string[];
      readonly alreadyCalculatedStatementIds: readonly string[];
      readonly untouchedStatementIds: readonly string[];
      readonly pendingStatementIds: readonly string[];
    };

export type ClosePayrollPeriodOutcome =
  | { readonly kind: "NOT_FOUND" }
  | { readonly kind: "NOT_CALCULATED" }
  | { readonly kind: "EMPTY" }
  | { readonly kind: "INCOMPLETE"; readonly pendingStatementIds: readonly string[] }
  | {
      readonly kind: "SUCCESS";
      readonly period: PayrollPeriodRecord;
      readonly closedStatementIds: readonly string[];
      readonly alreadyClosedStatementIds: readonly string[];
      readonly pendingStatementIds: readonly string[];
    };

export interface CompensationInput {
  readonly amount: string;
  readonly unit: CompensationUnit;
  readonly effectiveFrom: Date;
  readonly effectiveTo?: Date | null;
  readonly changeReason: string;
}

export interface EmploymentInput {
  readonly businessUnitId: string;
  readonly jobRoleId: string;
  readonly code: string;
  readonly type: EmploymentType;
  readonly status?: EmploymentStatus;
  readonly workSchedule?: EmploymentWorkSchedule;
  readonly weeklyWorkingHours?: string | null;
  readonly startedAt: Date;
  readonly endedAt?: Date | null;
  readonly compensation?: CompensationInput;
  readonly actorUserId: string;
}

export interface UpdateEmploymentInput {
  readonly employmentId: string;
  readonly businessUnitId: string;
  readonly expectedUpdatedAt: Date;
  readonly jobRoleId?: string;
  readonly status?: EmploymentStatus;
  readonly workSchedule?: EmploymentWorkSchedule;
  readonly weeklyWorkingHours?: string | null;
  readonly startedAt?: Date;
  readonly endedAt?: Date | null;
  readonly actorUserId: string;
}

export interface CreateEmployeeWithEmploymentInput extends EmploymentInput {
  readonly fullName: string;
  readonly userId?: string | null;
  readonly taxIdentifierHash?: string | null;
  readonly taxIdentifierEncrypted?: string | null;
  readonly birthDate?: Date | null;
  readonly identityDocumentEncrypted?: string | null;
  readonly identityIssuer?: string | null;
  readonly identityState?: string | null;
  readonly socialSecurityHash?: string | null;
  readonly socialSecurityEncrypted?: string | null;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly postalCode?: string | null;
  readonly addressStreet?: string | null;
  readonly addressNumber?: string | null;
  readonly addressComplement?: string | null;
  readonly addressNeighborhood?: string | null;
  readonly addressCity?: string | null;
  readonly addressState?: string | null;
  readonly paymentMethod?: string | null;
  readonly paymentDetailsEncrypted?: string | null;
  readonly employeeStatus?: EmployeeStatus;
}

export interface UpdateEmployeePersonalDataInput {
  readonly businessUnitId: string;
  readonly employeeId: string;
  readonly fullName: string;
  readonly taxIdentifierHash: string;
  readonly taxIdentifierEncrypted: string;
  readonly birthDate: Date;
  readonly identityDocumentEncrypted?: string | null;
  readonly identityIssuer?: string | null;
  readonly identityState?: string | null;
  readonly socialSecurityHash?: string | null;
  readonly socialSecurityEncrypted?: string | null;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly postalCode?: string | null;
  readonly addressStreet?: string | null;
  readonly addressNumber?: string | null;
  readonly addressComplement?: string | null;
  readonly addressNeighborhood?: string | null;
  readonly addressCity?: string | null;
  readonly addressState?: string | null;
  readonly paymentMethod?: string | null;
  readonly paymentDetailsEncrypted?: string | null;
  readonly actorUserId: string;
}

export interface CreateJobRoleInput {
  readonly businessUnitId: string;
  readonly code: string;
  readonly name: string;
  readonly description?: string | null;
  readonly status?: JobRoleStatus;
  readonly actorUserId: string;
}

export interface CreatePayrollPeriodInput {
  readonly businessUnitId: string;
  readonly competence: Date;
  readonly actorUserId: string;
}

export interface PayrollLineItemInput {
  readonly type: PayrollLineItemType;
  readonly origin?: PayrollLineItemOrigin;
  readonly code: string;
  readonly description: string;
  readonly quantity?: string | null;
  readonly unitAmount?: string | null;
  readonly amount: string;
  readonly affectsNet?: boolean;
}

export interface CreatePayrollStatementInput {
  readonly businessUnitId: string;
  readonly payrollPeriodId: string;
  readonly employmentId: string;
  readonly compensationId?: string | null;
  readonly lineItems?: readonly PayrollLineItemInput[];
  readonly actorUserId: string;
}

export interface CreatePayrollAdjustmentInput {
  readonly businessUnitId: string;
  readonly sourcePayrollStatementId: string;
  readonly type: PayrollAdjustmentType;
  readonly amount: string;
  readonly reason: string;
  readonly actorUserId: string;
}

export interface CreatePayrollReceiptInput {
  readonly businessUnitId: string;
  readonly payrollStatementId: string;
  readonly receiptNumber: string;
  readonly version?: number;
  readonly documentHash?: string | null;
  readonly storageKey?: string | null;
  readonly issuance?: { readonly at: Date; readonly actorUserId: string };
  readonly actorUserId: string;
}

export interface CreateServiceReceiptInput {
  readonly businessUnitId: string;
  readonly providerEmploymentId?: string | null;
  readonly financialEntryId?: string | null;
  readonly providerType: ServiceProviderType;
  readonly receiptNumber: string;
  readonly competence: Date;
  readonly serviceDate: Date;
  readonly serviceDescription: string;
  readonly recipientName: string;
  readonly recipientTaxIdentifierHash?: string | null;
  readonly recipientTaxIdentifierEncrypted?: string | null;
  readonly amount: string;
  readonly documentHash?: string | null;
  readonly storageKey?: string | null;
  readonly issuance?: { readonly at: Date; readonly actorUserId: string };
  readonly actorUserId: string;
}

type TransactionClient = Prisma.TransactionClient;

function isKnownPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

async function translateUniqueConflict<T>(
  operation: () => Promise<T>,
  code: PayrollRepositoryErrorCode,
  message: string,
) {
  try {
    return await operation();
  } catch (error) {
    if (isKnownPrismaError(error, "P2002")) {
      throw new PayrollRepositoryError(code, message, { cause: error });
    }
    throw error;
  }
}

async function requireJobRole(
  transaction: TransactionClient,
  businessUnitId: string,
  jobRoleId: string,
) {
  const jobRole = await transaction.jobRole.findUnique({
    where: { id_businessUnitId: { id: jobRoleId, businessUnitId } },
  });
  if (!jobRole) {
    throw new PayrollRepositoryError("NOT_FOUND", "Cargo não encontrado nesta unidade.");
  }
}

async function requireEmployment(
  transaction: TransactionClient,
  businessUnitId: string,
  employmentId: string,
) {
  const employment = await transaction.employment.findUnique({
    where: { id_businessUnitId: { id: employmentId, businessUnitId } },
  });
  if (!employment) {
    throw new PayrollRepositoryError("NOT_FOUND", "Vínculo não encontrado nesta unidade.");
  }
  return employment;
}

async function requireStatement(
  transaction: TransactionClient,
  businessUnitId: string,
  payrollStatementId: string,
) {
  const statement = await transaction.payrollStatement.findUnique({
    where: {
      id_businessUnitId: { id: payrollStatementId, businessUnitId },
    },
  });
  if (!statement) {
    throw new PayrollRepositoryError(
      "NOT_FOUND",
      "Demonstrativo não encontrado nesta unidade.",
    );
  }
  return statement;
}

async function createCompensation(
  transaction: TransactionClient,
  employmentId: string,
  businessUnitId: string,
  input: CompensationInput,
  actorUserId: string,
) {
  return transaction.employmentCompensation.create({
    data: {
      employmentId,
      businessUnitId,
      amount: new Prisma.Decimal(input.amount),
      unit: input.unit,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      changeReason: input.changeReason,
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
    },
  });
}

function addLineItemToTotals(
  totals: {
    gross: Prisma.Decimal;
    benefit: Prisma.Decimal;
    deduction: Prisma.Decimal;
    net: Prisma.Decimal;
  },
  item: { type: PayrollLineItemType; amount: Prisma.Decimal; affectsNet: boolean },
) {
  if (item.type === "EARNING") totals.gross = totals.gross.plus(item.amount);
  if (item.type === "BENEFIT") totals.benefit = totals.benefit.plus(item.amount);
  if (item.type === "DEDUCTION") totals.deduction = totals.deduction.plus(item.amount);
  if (!item.affectsNet) return;
  totals.net = item.type === "DEDUCTION"
    ? totals.net.minus(item.amount)
    : totals.net.plus(item.amount);
}

async function recalculateStatement(
  transaction: TransactionClient,
  businessUnitId: string,
  payrollStatementId: string,
  actorUserId: string,
) {
  await requireStatement(transaction, businessUnitId, payrollStatementId);
  const [lineItems, adjustments] = await Promise.all([
    transaction.payrollLineItem.findMany({
      where: { businessUnitId, payrollStatementId },
      select: { type: true, amount: true, affectsNet: true },
    }),
    transaction.payrollAdjustment.findMany({
      where: {
        businessUnitId,
        appliedPayrollStatementId: payrollStatementId,
        status: "APPLIED",
      },
      select: { type: true, amount: true },
    }),
  ]);
  const totals = {
    gross: new Prisma.Decimal(0),
    benefit: new Prisma.Decimal(0),
    deduction: new Prisma.Decimal(0),
    net: new Prisma.Decimal(0),
  };
  for (const item of lineItems) addLineItemToTotals(totals, item);
  const adjustmentTotal = adjustments.reduce(
    (total, adjustment) => adjustment.type === "DEBIT"
      ? total.minus(adjustment.amount)
      : total.plus(adjustment.amount),
    new Prisma.Decimal(0),
  );
  return transaction.payrollStatement.update({
    where: {
      id_businessUnitId: { id: payrollStatementId, businessUnitId },
    },
    data: {
      grossAmount: totals.gross,
      benefitAmount: totals.benefit,
      deductionAmount: totals.deduction,
      adjustmentAmount: adjustmentTotal,
      netAmount: totals.net.plus(adjustmentTotal),
      updatedByUserId: actorUserId,
    },
    include: statementInclude,
  });
}

export interface PayrollRepository {
  createJobRole(input: CreateJobRoleInput): Promise<JobRoleRecord>;
  listJobRoles(businessUnitId: string): Promise<readonly JobRoleRecord[]>;
  createEmployeeWithEmployment(
    input: CreateEmployeeWithEmploymentInput,
  ): Promise<EmployeeRecord>;
  addEmployment(employeeId: string, input: EmploymentInput): Promise<EmploymentRecord>;
  updateEmployeePersonalData(input: UpdateEmployeePersonalDataInput): Promise<EmployeeRecord>;
  updateEmployment(input: UpdateEmploymentInput): Promise<EmploymentRecord>;
  addCompensation(
    businessUnitId: string,
    employmentId: string,
    input: CompensationInput,
    actorUserId: string,
  ): Promise<Prisma.EmploymentCompensationGetPayload<Record<string, never>>>;
  findEmployee(businessUnitId: string, employeeId: string): Promise<EmployeeRecord | null>;
  listEmployees(businessUnitId: string): Promise<readonly EmployeeRecord[]>;
  deleteEmployeeWithoutHistory(
    businessUnitId: string,
    employeeId: string,
    actorUserId: string,
  ): Promise<DeletedEmployeeResult>;
  createPeriod(input: CreatePayrollPeriodInput): Promise<PayrollPeriodRecord>;
  findPeriod(businessUnitId: string, payrollPeriodId: string): Promise<PayrollPeriodRecord | null>;
  listPeriods(businessUnitId: string): Promise<readonly PayrollPeriodRecord[]>;
  updatePeriodStatus(
    businessUnitId: string,
    payrollPeriodId: string,
    status: PayrollPeriodStatus,
    actorUserId: string,
  ): Promise<PayrollPeriodRecord>;
  calculatePeriodAtomically(
    businessUnitId: string,
    payrollPeriodId: string,
    actorUserId: string,
  ): Promise<CalculatePayrollPeriodOutcome>;
  closePeriodAtomically(
    businessUnitId: string,
    payrollPeriodId: string,
    actorUserId: string,
  ): Promise<ClosePayrollPeriodOutcome>;
  createStatement(input: CreatePayrollStatementInput): Promise<PayrollStatementRecord>;
  findStatement(
    businessUnitId: string,
    payrollStatementId: string,
  ): Promise<PayrollStatementRecord | null>;
  listStatements(
    businessUnitId: string,
    payrollPeriodId?: string,
  ): Promise<readonly PayrollStatementRecord[]>;
  updateStatementStatus(
    businessUnitId: string,
    payrollStatementId: string,
    status: PayrollStatementStatus,
    actorUserId: string,
  ): Promise<PayrollStatementRecord>;
  addLineItem(
    businessUnitId: string,
    payrollStatementId: string,
    input: PayrollLineItemInput,
    actorUserId: string,
  ): Promise<PayrollStatementRecord>;
  createAdjustment(input: CreatePayrollAdjustmentInput): Promise<PayrollAdjustmentRecord>;
  applyAdjustment(
    businessUnitId: string,
    adjustmentId: string,
    appliedPayrollStatementId: string,
    actorUserId: string,
  ): Promise<PayrollStatementRecord>;
  createPayrollReceipt(input: CreatePayrollReceiptInput): Promise<PayrollReceiptRecord>;
  listPayrollReceipts(
    businessUnitId: string,
    payrollStatementId?: string,
  ): Promise<readonly PayrollReceiptRecord[]>;
  createServiceReceipt(input: CreateServiceReceiptInput): Promise<ServiceReceiptRecord>;
  listServiceReceipts(businessUnitId: string): Promise<readonly ServiceReceiptRecord[]>;
}

export const payrollRepository: PayrollRepository = {
  async createJobRole(input) {
    return translateUniqueConflict(
      () => prisma.jobRole.create({
        data: {
          businessUnitId: input.businessUnitId,
          code: input.code,
          name: input.name,
          description: input.description,
          status: input.status,
          createdByUserId: input.actorUserId,
          updatedByUserId: input.actorUserId,
        },
      }),
      "DUPLICATE_JOB_ROLE",
      "Já existe um cargo com este código nesta unidade.",
    );
  },

  listJobRoles(businessUnitId) {
    return prisma.jobRole.findMany({
      where: { businessUnitId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
  },

  async createEmployeeWithEmployment(input) {
    return translateUniqueConflict(
      () => prisma.$transaction(async (transaction) => {
        await requireJobRole(transaction, input.businessUnitId, input.jobRoleId);
        const employee = await transaction.employee.create({
          data: {
            userId: input.userId,
            fullName: input.fullName,
            taxIdentifierHash: input.taxIdentifierHash,
            taxIdentifierEncrypted: input.taxIdentifierEncrypted,
            birthDate: input.birthDate,
            identityDocumentEncrypted: input.identityDocumentEncrypted,
            identityIssuer: input.identityIssuer,
            identityState: input.identityState,
            socialSecurityHash: input.socialSecurityHash,
            socialSecurityEncrypted: input.socialSecurityEncrypted,
            phone: input.phone,
            email: input.email,
            postalCode: input.postalCode,
            addressStreet: input.addressStreet,
            addressNumber: input.addressNumber,
            addressComplement: input.addressComplement,
            addressNeighborhood: input.addressNeighborhood,
            addressCity: input.addressCity,
            addressState: input.addressState,
            paymentMethod: input.paymentMethod,
            paymentDetailsEncrypted: input.paymentDetailsEncrypted,
            status: input.employeeStatus,
            createdByUserId: input.actorUserId,
            updatedByUserId: input.actorUserId,
          },
        });
        const employment = await transaction.employment.create({
          data: {
            employeeId: employee.id,
            businessUnitId: input.businessUnitId,
            jobRoleId: input.jobRoleId,
            code: input.code,
            type: input.type,
            status: input.status,
            workSchedule: input.workSchedule,
            weeklyWorkingHours: input.weeklyWorkingHours,
            startedAt: input.startedAt,
            endedAt: input.endedAt,
            createdByUserId: input.actorUserId,
            updatedByUserId: input.actorUserId,
          },
        });
        if (input.compensation) {
          await createCompensation(
            transaction,
            employment.id,
            input.businessUnitId,
            input.compensation,
            input.actorUserId,
          );
        }
        return transaction.employee.findFirstOrThrow({
          where: {
            id: employee.id,
            employments: { some: { businessUnitId: input.businessUnitId } },
          },
          include: employeeIncludeForUnit(input.businessUnitId),
        });
      }),
      "DUPLICATE_EMPLOYMENT",
      "Funcionário ou vínculo já cadastrado com os mesmos identificadores.",
    );
  },

  async addEmployment(employeeId, input) {
    return translateUniqueConflict(
      () => prisma.$transaction(async (transaction) => {
        await requireJobRole(transaction, input.businessUnitId, input.jobRoleId);
        const employee = await transaction.employee.findFirst({
          where: { id: employeeId, deletedAt: null },
          select: { id: true },
        });
        if (!employee) {
          throw new PayrollRepositoryError("NOT_FOUND", "Funcionário não encontrado.");
        }
        const employment = await transaction.employment.create({
          data: {
            employeeId,
            businessUnitId: input.businessUnitId,
            jobRoleId: input.jobRoleId,
            code: input.code,
            type: input.type,
            status: input.status,
            workSchedule: input.workSchedule,
            weeklyWorkingHours: input.weeklyWorkingHours,
            startedAt: input.startedAt,
            endedAt: input.endedAt,
            createdByUserId: input.actorUserId,
            updatedByUserId: input.actorUserId,
          },
        });
        if (input.compensation) {
          await createCompensation(
            transaction,
            employment.id,
            input.businessUnitId,
            input.compensation,
            input.actorUserId,
          );
        }
        return transaction.employment.findUniqueOrThrow({
          where: {
            id_businessUnitId: { id: employment.id, businessUnitId: input.businessUnitId },
          },
          include: { employee: true, jobRole: true, compensations: true },
        });
      }),
      "DUPLICATE_EMPLOYMENT",
      "Já existe um vínculo com este código nesta unidade.",
    );
  },

  async updateEmployment(input) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const employment = await transaction.employment.findUnique({
          where: {
            id_businessUnitId: {
              id: input.employmentId,
              businessUnitId: input.businessUnitId,
            },
          },
        });
        if (!employment) {
          throw new EmploymentUpdateError(
            "NOT_FOUND",
            "Vínculo não encontrado nesta unidade.",
          );
        }

        const now = new Date();
        if (
          employment.status === "TERMINATED"
          || (employment.endedAt !== null && employment.endedAt <= now)
        ) {
          throw new EmploymentUpdateError(
            "TERMINATED_EMPLOYMENT",
            "Vínculos encerrados não podem ser alterados.",
          );
        }
        if (
          !Number.isFinite(input.expectedUpdatedAt.getTime())
          || employment.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
        ) {
          throw new EmploymentUpdateError(
            "UPDATE_CONFLICT",
            "O vínculo foi alterado por outra operação. Recarregue os dados.",
          );
        }

        const hasAuthorizedChange =
          input.jobRoleId !== undefined
          || input.status !== undefined
          || input.workSchedule !== undefined
          || input.weeklyWorkingHours !== undefined
          || input.startedAt !== undefined
          || input.endedAt !== undefined;
        if (!hasAuthorizedChange) {
          throw new EmploymentUpdateError(
            "UPDATE_CONFLICT",
            "Nenhuma alteração profissional foi informada.",
          );
        }

        const effectiveStartedAt = input.startedAt ?? employment.startedAt;
        const effectiveEndedAt = input.endedAt === undefined
          ? employment.endedAt
          : input.endedAt;
        if (
          !Number.isFinite(effectiveStartedAt.getTime())
          || (effectiveEndedAt !== null && !Number.isFinite(effectiveEndedAt.getTime()))
          || (effectiveEndedAt !== null && effectiveEndedAt < effectiveStartedAt)
        ) {
          throw new EmploymentUpdateError(
            "UPDATE_CONFLICT",
            "As datas informadas para o vínculo são inválidas.",
          );
        }
        if (input.status === "TERMINATED" && effectiveEndedAt === null) {
          throw new EmploymentUpdateError(
            "UPDATE_CONFLICT",
            "A data de encerramento é obrigatória ao encerrar o vínculo.",
          );
        }

        const historicalStatement = await transaction.payrollStatement.findFirst({
          where: {
            employmentId: input.employmentId,
            businessUnitId: input.businessUnitId,
            OR: [
              { status: { in: ["CALCULATED", "CLOSED"] } },
              {
                payrollPeriod: {
                  status: { in: ["CALCULATED", "CLOSED"] },
                },
              },
            ],
          },
          select: { id: true },
        });
        if (historicalStatement) {
          throw new EmploymentUpdateError(
            "UPDATE_CONFLICT",
            "O vínculo possui folha calculada ou fechada e não pode ser sobrescrito.",
          );
        }

        if (input.jobRoleId !== undefined) {
          await requireJobRole(transaction, input.businessUnitId, input.jobRoleId);
        }

        const result = await transaction.employment.updateMany({
          where: {
            id: input.employmentId,
            businessUnitId: input.businessUnitId,
            updatedAt: input.expectedUpdatedAt,
            status: { not: "TERMINATED" },
          },
          data: {
            jobRoleId: input.jobRoleId,
            status: input.status,
            workSchedule: input.workSchedule,
            weeklyWorkingHours: input.weeklyWorkingHours,
            startedAt: input.startedAt,
            endedAt: input.endedAt,
            updatedByUserId: input.actorUserId,
          },
        });
        if (result.count !== 1) {
          const concurrentEmployment = await transaction.employment.findUnique({
            where: {
              id_businessUnitId: {
                id: input.employmentId,
                businessUnitId: input.businessUnitId,
              },
            },
            select: { status: true },
          });
          if (!concurrentEmployment) {
            throw new EmploymentUpdateError(
              "NOT_FOUND",
              "Vínculo não encontrado nesta unidade.",
            );
          }
          if (concurrentEmployment.status === "TERMINATED") {
            throw new EmploymentUpdateError(
              "TERMINATED_EMPLOYMENT",
              "Vínculos encerrados não podem ser alterados.",
            );
          }
          throw new EmploymentUpdateError(
            "UPDATE_CONFLICT",
            "O vínculo foi alterado por outra operação. Recarregue os dados.",
          );
        }

        return transaction.employment.findUniqueOrThrow({
          where: {
            id_businessUnitId: {
              id: input.employmentId,
              businessUnitId: input.businessUnitId,
            },
          },
          include: { employee: true, jobRole: true, compensations: true },
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (isKnownPrismaError(error, "P2034")) {
        throw new EmploymentUpdateError(
          "UPDATE_CONFLICT",
          "O vínculo foi alterado por outra operação. Recarregue os dados.",
          { cause: error },
        );
      }
      throw error;
    }
  },

  addCompensation(businessUnitId, employmentId, input, actorUserId) {
    return translateUniqueConflict(
      () => prisma.$transaction(async (transaction) => {
        await requireEmployment(transaction, businessUnitId, employmentId);
        return createCompensation(
          transaction,
          employmentId,
          businessUnitId,
          input,
          actorUserId,
        );
      }),
      "DUPLICATE_EMPLOYMENT",
      "Já existe uma remuneração com esta vigência para o vínculo.",
    );
  },

  findEmployee(businessUnitId, employeeId) {
    return prisma.employee.findFirst({
      where: {
        id: employeeId,
        deletedAt: null,
        employments: { some: { businessUnitId } },
      },
      include: employeeIncludeForUnit(businessUnitId),
    });
  },

  listEmployees(businessUnitId) {
    return prisma.employee.findMany({
      where: { deletedAt: null, employments: { some: { businessUnitId } } },
      include: {
        employments: {
          where: { businessUnitId },
          include: {
            jobRole: true,
            compensations: { orderBy: { effectiveFrom: "desc" } },
          },
          orderBy: { startedAt: "desc" },
        },
      },
      orderBy: { fullName: "asc" },
    });
  },

  async updateEmployeePersonalData(input) {
    const employee = await prisma.employee.findFirst({
      where: {
        id: input.employeeId,
        deletedAt: null,
        employments: { some: { businessUnitId: input.businessUnitId } },
      },
      select: { id: true },
    });

    if (!employee) {
      throw new PayrollRepositoryError("NOT_FOUND", "Funcionário não encontrado nesta unidade.");
    }

    return translateUniqueConflict(
      () => prisma.employee.update({
        where: { id: input.employeeId },
        data: {
          fullName: input.fullName,
          taxIdentifierHash: input.taxIdentifierHash,
          taxIdentifierEncrypted: input.taxIdentifierEncrypted,
          birthDate: input.birthDate,
          identityDocumentEncrypted: input.identityDocumentEncrypted,
          identityIssuer: input.identityIssuer,
          identityState: input.identityState,
          socialSecurityHash: input.socialSecurityHash,
          socialSecurityEncrypted: input.socialSecurityEncrypted,
          phone: input.phone,
          email: input.email,
          postalCode: input.postalCode,
          addressStreet: input.addressStreet,
          addressNumber: input.addressNumber,
          addressComplement: input.addressComplement,
          addressNeighborhood: input.addressNeighborhood,
          addressCity: input.addressCity,
          addressState: input.addressState,
          paymentMethod: input.paymentMethod,
          paymentDetailsEncrypted: input.paymentDetailsEncrypted,
          updatedByUserId: input.actorUserId,
        },
        include: employeeIncludeForUnit(input.businessUnitId),
      }),
      "DUPLICATE_EMPLOYMENT",
      "CPF ou PIS/NIS já cadastrado para outro funcionário.",
    );
  },

  deleteEmployeeWithoutHistory(businessUnitId, employeeId, actorUserId) {
    return prisma.$transaction(async (transaction) => {
      const employee = await transaction.employee.findFirst({
        where: {
          id: employeeId,
          deletedAt: null,
          employments: { some: { businessUnitId } },
        },
        include: {
          employments: {
            where: { businessUnitId },
            select: { id: true },
          },
        },
      });
      if (!employee) {
        throw new PayrollRepositoryError(
          "NOT_FOUND",
          "Funcionário não encontrado nesta unidade.",
        );
      }

      const employmentIds = employee.employments.map((employment) => employment.id);
      const [statement, serviceReceipt] = await Promise.all([
        transaction.payrollStatement.findFirst({
          where: { employmentId: { in: employmentIds } },
          select: { id: true },
        }),
        transaction.serviceReceipt.findFirst({
          where: { providerEmploymentId: { in: employmentIds } },
          select: { id: true },
        }),
      ]);
      if (statement || serviceReceipt) {
        throw new PayrollRepositoryError(
          "EMPLOYEE_HAS_HISTORY",
          "O funcionário possui folha ou recibo e não pode ser excluído. Encerre o vínculo.",
        );
      }

      await transaction.employmentCompensation.deleteMany({
        where: { employmentId: { in: employmentIds } },
      });
      await transaction.employment.deleteMany({
        where: { id: { in: employmentIds }, businessUnitId },
      });

      const remainingEmployments = await transaction.employment.count({
        where: { employeeId },
      });
      const archived = remainingEmployments === 0;
      if (archived) {
        await transaction.employee.update({
          where: { id: employeeId },
          data: {
            status: "ARCHIVED",
            deletedAt: new Date(),
            updatedByUserId: actorUserId,
          },
        });
      }

      return { employeeId, archived };
    });
  },

  createPeriod(input) {
    return translateUniqueConflict(
      () => prisma.payrollPeriod.create({
        data: {
          businessUnitId: input.businessUnitId,
          competence: input.competence,
          createdByUserId: input.actorUserId,
          updatedByUserId: input.actorUserId,
        },
      }),
      "DUPLICATE_PERIOD",
      "Já existe uma folha para esta competência nesta unidade.",
    );
  },

  findPeriod(businessUnitId, payrollPeriodId) {
    return prisma.payrollPeriod.findUnique({
      where: { id_businessUnitId: { id: payrollPeriodId, businessUnitId } },
    });
  },

  listPeriods(businessUnitId) {
    return prisma.payrollPeriod.findMany({
      where: { businessUnitId },
      orderBy: { competence: "desc" },
    });
  },

  async updatePeriodStatus(businessUnitId, payrollPeriodId, status, actorUserId) {
    try {
      return await prisma.payrollPeriod.update({
        where: { id_businessUnitId: { id: payrollPeriodId, businessUnitId } },
        data: { status, updatedByUserId: actorUserId },
      });
    } catch (error) {
      if (isKnownPrismaError(error, "P2025")) {
        throw new PayrollRepositoryError("NOT_FOUND", "Período não encontrado.", {
          cause: error,
        });
      }
      throw error;
    }
  },

  calculatePeriodAtomically(businessUnitId, payrollPeriodId, actorUserId) {
    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id"
        FROM "PayrollPeriod"
        WHERE "id" = ${payrollPeriodId}::uuid
          AND "businessUnitId" = ${businessUnitId}::uuid
        FOR UPDATE`;

      const period = await transaction.payrollPeriod.findUnique({
        where: { id_businessUnitId: { id: payrollPeriodId, businessUnitId } },
      });
      if (!period) return { kind: "NOT_FOUND" } as const;
      if (period.status === "CLOSED") return { kind: "CLOSED" } as const;

      await transaction.$queryRaw`
        SELECT "id"
        FROM "PayrollStatement"
        WHERE "payrollPeriodId" = ${payrollPeriodId}::uuid
          AND "businessUnitId" = ${businessUnitId}::uuid
        FOR UPDATE`;

      const statements = await transaction.payrollStatement.findMany({
        where: { businessUnitId, payrollPeriodId },
        select: { id: true, status: true },
        orderBy: { createdAt: "asc" },
      });
      if (!statements.length) return { kind: "EMPTY" } as const;

      const calculatedStatementIds = statements
        .filter((statement) => statement.status === "DRAFT")
        .map((statement) => statement.id);
      const alreadyCalculatedStatementIds = statements
        .filter((statement) => statement.status === "CALCULATED")
        .map((statement) => statement.id);
      const untouchedStatementIds = statements
        .filter((statement) => statement.status === "CLOSED" || statement.status === "VOIDED")
        .map((statement) => statement.id);
      const calculatedAt = new Date();

      if (calculatedStatementIds.length) {
        await transaction.payrollStatement.updateMany({
          where: {
            businessUnitId,
            payrollPeriodId,
            id: { in: calculatedStatementIds },
            status: "DRAFT",
          },
          data: {
            status: "CALCULATED",
            calculatedAt,
            calculatedByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        });
      }

      const remaining = await transaction.payrollStatement.findMany({
        where: { businessUnitId, payrollPeriodId, status: "DRAFT" },
        select: { id: true },
      });
      const pendingStatementIds = remaining.map((statement) => statement.id);
      if (pendingStatementIds.length) {
        throw new Error("PAYROLL_CALCULATION_INCOMPLETE");
      }
      const updatedPeriod = period.status === "CALCULATED"
        ? period
        : await transaction.payrollPeriod.update({
            where: { id_businessUnitId: { id: payrollPeriodId, businessUnitId } },
            data: {
              status: "CALCULATED",
              calculatedAt,
              calculatedByUserId: actorUserId,
              updatedByUserId: actorUserId,
            },
          });

      return {
        kind: "SUCCESS",
        period: updatedPeriod,
        calculatedStatementIds,
        alreadyCalculatedStatementIds,
        untouchedStatementIds,
        pendingStatementIds,
      } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  closePeriodAtomically(businessUnitId, payrollPeriodId, actorUserId) {
    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id"
        FROM "PayrollPeriod"
        WHERE "id" = ${payrollPeriodId}::uuid
          AND "businessUnitId" = ${businessUnitId}::uuid
        FOR UPDATE`;

      const period = await transaction.payrollPeriod.findUnique({
        where: { id_businessUnitId: { id: payrollPeriodId, businessUnitId } },
      });
      if (!period) return { kind: "NOT_FOUND" } as const;

      await transaction.$queryRaw`
        SELECT "id"
        FROM "PayrollStatement"
        WHERE "payrollPeriodId" = ${payrollPeriodId}::uuid
          AND "businessUnitId" = ${businessUnitId}::uuid
        FOR UPDATE`;
      const statements = await transaction.payrollStatement.findMany({
        where: { businessUnitId, payrollPeriodId },
        select: { id: true, status: true },
        orderBy: { createdAt: "asc" },
      });
      if (!statements.length) return { kind: "EMPTY" } as const;

      const alreadyClosedStatementIds = statements
        .filter((statement) => statement.status === "CLOSED")
        .map((statement) => statement.id);
      if (period.status === "CLOSED") {
        const pendingStatementIds = statements
          .filter((statement) => statement.status !== "CLOSED")
          .map((statement) => statement.id);
        return {
          kind: "SUCCESS",
          period,
          closedStatementIds: [],
          alreadyClosedStatementIds,
          pendingStatementIds,
        } as const;
      }
      if (period.status !== "CALCULATED") return { kind: "NOT_CALCULATED" } as const;

      const pendingStatementIds = statements
        .filter((statement) => statement.status !== "CALCULATED" && statement.status !== "CLOSED")
        .map((statement) => statement.id);
      if (pendingStatementIds.length) {
        return { kind: "INCOMPLETE", pendingStatementIds } as const;
      }
      const closedStatementIds = statements
        .filter((statement) => statement.status === "CALCULATED")
        .map((statement) => statement.id);
      const closedAt = new Date();
      if (closedStatementIds.length) {
        const updated = await transaction.payrollStatement.updateMany({
          where: {
            businessUnitId,
            payrollPeriodId,
            id: { in: closedStatementIds },
            status: "CALCULATED",
          },
          data: {
            status: "CLOSED",
            closedAt,
            closedByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        });
        if (updated.count !== closedStatementIds.length) {
          throw new Error("PAYROLL_CLOSE_INCOMPLETE");
        }
      }
      const updatedPeriod = await transaction.payrollPeriod.update({
        where: { id_businessUnitId: { id: payrollPeriodId, businessUnitId } },
        data: {
          status: "CLOSED",
          closedAt,
          closedByUserId: actorUserId,
          updatedByUserId: actorUserId,
        },
      });
      return {
        kind: "SUCCESS",
        period: updatedPeriod,
        closedStatementIds,
        alreadyClosedStatementIds,
        pendingStatementIds: [],
      } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  createStatement(input) {
    return translateUniqueConflict(
      () => prisma.$transaction(async (transaction) => {
        const [period, employment] = await Promise.all([
          transaction.payrollPeriod.findUnique({
            where: {
              id_businessUnitId: {
                id: input.payrollPeriodId,
                businessUnitId: input.businessUnitId,
              },
            },
          }),
          requireEmployment(transaction, input.businessUnitId, input.employmentId),
        ]);
        if (!period) {
          throw new PayrollRepositoryError("NOT_FOUND", "Período não encontrado.");
        }
        if (input.compensationId) {
          const compensation = await transaction.employmentCompensation.findFirst({
            where: {
              id: input.compensationId,
              employmentId: employment.id,
              businessUnitId: input.businessUnitId,
            },
            select: { id: true },
          });
          if (!compensation) {
            throw new PayrollRepositoryError(
              "NOT_FOUND",
              "Remuneração não pertence ao vínculo informado.",
            );
          }
        }
        const statement = await transaction.payrollStatement.create({
          data: {
            businessUnitId: input.businessUnitId,
            payrollPeriodId: input.payrollPeriodId,
            employmentId: input.employmentId,
            compensationId: input.compensationId,
            createdByUserId: input.actorUserId,
            updatedByUserId: input.actorUserId,
          },
        });
        if (input.lineItems?.length) {
          await transaction.payrollLineItem.createMany({
            data: input.lineItems.map((item) => ({
              payrollStatementId: statement.id,
              businessUnitId: input.businessUnitId,
              type: item.type,
              origin: item.origin,
              code: item.code,
              description: item.description,
              quantity: item.quantity ? new Prisma.Decimal(item.quantity) : null,
              unitAmount: item.unitAmount ? new Prisma.Decimal(item.unitAmount) : null,
              amount: new Prisma.Decimal(item.amount),
              affectsNet: item.affectsNet,
              createdByUserId: input.actorUserId,
              updatedByUserId: input.actorUserId,
            })),
          });
        }
        return recalculateStatement(
          transaction,
          input.businessUnitId,
          statement.id,
          input.actorUserId,
        );
      }),
      "DUPLICATE_STATEMENT",
      "Já existe um demonstrativo para este vínculo e período.",
    );
  },

  findStatement(businessUnitId, payrollStatementId) {
    return prisma.payrollStatement.findUnique({
      where: { id_businessUnitId: { id: payrollStatementId, businessUnitId } },
      include: statementInclude,
    });
  },

  listStatements(businessUnitId, payrollPeriodId) {
    return prisma.payrollStatement.findMany({
      where: { businessUnitId, payrollPeriodId },
      include: statementInclude,
      orderBy: [{ payrollPeriod: { competence: "desc" } }, { createdAt: "asc" }],
    });
  },

  async updateStatementStatus(
    businessUnitId,
    payrollStatementId,
    status,
    actorUserId,
  ) {
    try {
      return await prisma.payrollStatement.update({
        where: { id_businessUnitId: { id: payrollStatementId, businessUnitId } },
        data: { status, updatedByUserId: actorUserId },
        include: statementInclude,
      });
    } catch (error) {
      if (isKnownPrismaError(error, "P2025")) {
        throw new PayrollRepositoryError("NOT_FOUND", "Demonstrativo não encontrado.", {
          cause: error,
        });
      }
      throw error;
    }
  },

  addLineItem(businessUnitId, payrollStatementId, input, actorUserId) {
    return translateUniqueConflict(
      () => prisma.$transaction(async (transaction) => {
        await requireStatement(transaction, businessUnitId, payrollStatementId);
        await transaction.payrollLineItem.create({
          data: {
            payrollStatementId,
            businessUnitId,
            type: input.type,
            origin: input.origin,
            code: input.code,
            description: input.description,
            quantity: input.quantity ? new Prisma.Decimal(input.quantity) : null,
            unitAmount: input.unitAmount ? new Prisma.Decimal(input.unitAmount) : null,
            amount: new Prisma.Decimal(input.amount),
            affectsNet: input.affectsNet,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          },
        });
        return recalculateStatement(
          transaction,
          businessUnitId,
          payrollStatementId,
          actorUserId,
        );
      }),
      "DUPLICATE_LINE_ITEM",
      "Já existe um item com este código no demonstrativo.",
    );
  },

  createAdjustment(input) {
    return prisma.$transaction(async (transaction) => {
      await requireStatement(
        transaction,
        input.businessUnitId,
        input.sourcePayrollStatementId,
      );
      return transaction.payrollAdjustment.create({
        data: {
          businessUnitId: input.businessUnitId,
          sourcePayrollStatementId: input.sourcePayrollStatementId,
          type: input.type,
          amount: new Prisma.Decimal(input.amount),
          reason: input.reason,
          createdByUserId: input.actorUserId,
        },
      });
    });
  },

  applyAdjustment(businessUnitId, adjustmentId, appliedPayrollStatementId, actorUserId) {
    return prisma.$transaction(async (transaction) => {
      await requireStatement(transaction, businessUnitId, appliedPayrollStatementId);
      const adjustment = await transaction.payrollAdjustment.findFirst({
        where: { id: adjustmentId, businessUnitId },
      });
      if (!adjustment) {
        throw new PayrollRepositoryError("NOT_FOUND", "Ajuste não encontrado.");
      }
      if (adjustment.status !== "PENDING") {
        throw new PayrollRepositoryError(
          "INVALID_ADJUSTMENT_STATE",
          "Somente ajustes pendentes podem ser aplicados.",
        );
      }
      await transaction.payrollAdjustment.update({
        where: { id: adjustment.id },
        data: {
          status: "APPLIED",
          appliedPayrollStatementId,
          appliedAt: new Date(),
          appliedByUserId: actorUserId,
        },
      });
      return recalculateStatement(
        transaction,
        businessUnitId,
        appliedPayrollStatementId,
        actorUserId,
      );
    });
  },

  createPayrollReceipt(input) {
    return translateUniqueConflict(
      () => prisma.$transaction(async (transaction) => {
        await requireStatement(transaction, input.businessUnitId, input.payrollStatementId);
        return transaction.payrollReceipt.create({
          data: {
            businessUnitId: input.businessUnitId,
            payrollStatementId: input.payrollStatementId,
            receiptNumber: input.receiptNumber,
            version: input.version,
            status: input.issuance ? "ISSUED" : "DRAFT",
            documentHash: input.documentHash,
            storageKey: input.storageKey,
            issuedAt: input.issuance?.at,
            issuedByUserId: input.issuance?.actorUserId,
            createdByUserId: input.actorUserId,
          },
        });
      }),
      "DUPLICATE_RECEIPT",
      "Já existe um recibo com este número ou versão.",
    );
  },

  listPayrollReceipts(businessUnitId, payrollStatementId) {
    return prisma.payrollReceipt.findMany({
      where: { businessUnitId, payrollStatementId },
      orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
    });
  },

  createServiceReceipt(input) {
    return translateUniqueConflict(
      () => prisma.$transaction(async (transaction) => {
        if (input.providerEmploymentId) {
          await requireEmployment(
            transaction,
            input.businessUnitId,
            input.providerEmploymentId,
          );
        }
        return transaction.serviceReceipt.create({
          data: {
            businessUnitId: input.businessUnitId,
            providerEmploymentId: input.providerEmploymentId,
            financialEntryId: input.financialEntryId,
            providerType: input.providerType,
            receiptNumber: input.receiptNumber,
            competence: input.competence,
            serviceDate: input.serviceDate,
            serviceDescription: input.serviceDescription,
            recipientName: input.recipientName,
            recipientTaxIdentifierHash: input.recipientTaxIdentifierHash,
            recipientTaxIdentifierEncrypted: input.recipientTaxIdentifierEncrypted,
            amount: new Prisma.Decimal(input.amount),
            status: input.issuance ? "ISSUED" : "DRAFT",
            documentHash: input.documentHash,
            storageKey: input.storageKey,
            issuedAt: input.issuance?.at,
            issuedByUserId: input.issuance?.actorUserId,
            createdByUserId: input.actorUserId,
          },
        });
      }),
      "DUPLICATE_RECEIPT",
      "Já existe um recibo de serviço com este número nesta unidade.",
    );
  },

  listServiceReceipts(businessUnitId) {
    return prisma.serviceReceipt.findMany({
      where: { businessUnitId },
      orderBy: [{ competence: "desc" }, { createdAt: "desc" }],
    });
  },
};
