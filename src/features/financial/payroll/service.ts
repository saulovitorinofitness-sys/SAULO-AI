import "server-only";

import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";

import {
  EmploymentUpdateError,
  PayrollRepositoryError,
  payrollRepository,
  type CompensationInput,
  type CalculatePayrollPeriodOutcome,
  type ClosePayrollPeriodOutcome,
  type CreateEmployeeWithEmploymentInput,
  type CreateJobRoleInput,
  type CreatePayrollAdjustmentInput,
  type CreatePayrollReceiptInput,
  type CreateServiceReceiptInput,
  type EmployeeRecord,
  type EmploymentInput,
  type EmploymentRecord,
  type JobRoleRecord,
  type PayrollAdjustmentRecord,
  type PayrollLineItemInput,
  type PayrollPeriodRecord,
  type PayrollReceiptRecord,
  type PayrollRepository,
  type PayrollStatementRecord,
  type ServiceReceiptRecord,
  type UpdateEmployeePersonalDataInput,
  type UpdateEmploymentInput,
} from "./repository";

type PayrollLineItemType = "EARNING" | "BENEFIT" | "DEDUCTION";

export type PayrollDomainErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "DUPLICATE_EMPLOYEE_OR_EMPLOYMENT"
  | "DUPLICATE_JOB_ROLE"
  | "DUPLICATE_PERIOD"
  | "DUPLICATE_STATEMENT"
  | "DUPLICATE_LINE_ITEM"
  | "DUPLICATE_RECEIPT"
  | "EMPLOYEE_HAS_HISTORY"
  | "INVALID_PERIOD_STATE"
  | "PERIOD_CLOSED"
  | "INVALID_STATEMENT_STATE"
  | "EMPTY_PAYROLL"
  | "INCOMPLETE_PAYROLL"
  | "INVALID_ADJUSTMENT_STATE"
  | "TERMINATED_EMPLOYMENT"
  | "UPDATE_CONFLICT";

export class PayrollDomainError extends Error {
  constructor(
    readonly code: PayrollDomainErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PayrollDomainError";
  }
}

export interface EmployeePersonalDataInput {
  readonly businessUnitId: string;
  readonly employeeId: string;
  readonly fullName: string;
  readonly cpf: string;
  readonly birthDate: Date;
  readonly identityDocument?: string | null;
  readonly identityIssuer?: string | null;
  readonly identityState?: string | null;
  readonly socialSecurityNumber?: string | null;
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
  readonly paymentDetails?: string | null;
  readonly actorUserId: string;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function validCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (length: number) => {
    let total = 0;
    for (let index = 0; index < length; index += 1) {
      total += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function personalDataKey() {
  const secret = process.env.PAYROLL_DATA_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new PayrollDomainError(
      "INVALID_INPUT",
      "Configure PAYROLL_DATA_ENCRYPTION_KEY com pelo menos 32 caracteres.",
    );
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

function protectPersonalValue(value: string) {
  const key = personalDataKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    authenticationTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

function personalIdentifierHash(value: string) {
  return createHmac("sha256", personalDataKey()).update(value, "utf8").digest("hex");
}

function optionalProtectedValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? protectPersonalValue(normalized) : null;
}

function normalizeEmployeePersonalData(
  input: EmployeePersonalDataInput,
): UpdateEmployeePersonalDataInput {
  const cpf = onlyDigits(input.cpf);
  if (!validCpf(cpf)) {
    throw new PayrollDomainError("INVALID_INPUT", "Informe um CPF válido.");
  }

  const birthDate = new Date(input.birthDate);
  if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
    throw new PayrollDomainError("INVALID_INPUT", "Informe uma data de nascimento válida.");
  }

  const socialSecurityNumber = input.socialSecurityNumber
    ? onlyDigits(input.socialSecurityNumber)
    : "";
  if (socialSecurityNumber && socialSecurityNumber.length !== 11) {
    throw new PayrollDomainError("INVALID_INPUT", "O PIS/NIS deve possuir 11 dígitos.");
  }

  return {
    businessUnitId: requiredId(input.businessUnitId, "Unidade empresarial"),
    employeeId: requiredId(input.employeeId, "Funcionário"),
    fullName: requiredText(input.fullName, "Nome do funcionário", 180),
    taxIdentifierHash: personalIdentifierHash(cpf),
    taxIdentifierEncrypted: protectPersonalValue(cpf),
    birthDate,
    identityDocumentEncrypted: optionalProtectedValue(input.identityDocument),
    identityIssuer: optionalText(input.identityIssuer, 40),
    identityState: optionalText(input.identityState, 2)?.toUpperCase() ?? null,
    socialSecurityHash: socialSecurityNumber
      ? personalIdentifierHash(socialSecurityNumber)
      : null,
    socialSecurityEncrypted: socialSecurityNumber
      ? protectPersonalValue(socialSecurityNumber)
      : null,
    phone: optionalText(input.phone, 30),
    email: optionalText(input.email, 180)?.toLowerCase() ?? null,
    postalCode: input.postalCode ? onlyDigits(input.postalCode).slice(0, 8) : null,
    addressStreet: optionalText(input.addressStreet, 180),
    addressNumber: optionalText(input.addressNumber, 30),
    addressComplement: optionalText(input.addressComplement, 120),
    addressNeighborhood: optionalText(input.addressNeighborhood, 120),
    addressCity: optionalText(input.addressCity, 120),
    addressState: optionalText(input.addressState, 2)?.toUpperCase() ?? null,
    paymentMethod: optionalText(input.paymentMethod, 30),
    paymentDetailsEncrypted: optionalProtectedValue(input.paymentDetails),
    actorUserId: requiredId(input.actorUserId, "Autor"),
  };
}

export interface OpenPayrollPeriodInput {
  readonly businessUnitId: string;
  readonly competence: Date;
  readonly actorUserId: string;
}

export interface AddStatementItemInput {
  readonly businessUnitId: string;
  readonly payrollStatementId: string;
  readonly code: string;
  readonly description: string;
  readonly quantity?: string | null;
  readonly unitAmount?: string | null;
  readonly amount: string;
  readonly affectsNet?: boolean;
  readonly actorUserId: string;
}

export interface ApplyAdjustmentInput {
  readonly businessUnitId: string;
  readonly adjustmentId: string;
  readonly appliedPayrollStatementId: string;
  readonly actorUserId: string;
}

export interface StatementDocumentData {
  readonly id: string;
  readonly businessUnitId: string;
  readonly competence: string;
  readonly status: string;
  readonly calculationVersion: number;
  readonly employee: { readonly id: string; readonly fullName: string };
  readonly employment: {
    readonly id: string;
    readonly code: string;
    readonly jobRole: string;
  };
  readonly items: readonly {
    readonly code: string;
    readonly description: string;
    readonly type: string;
    readonly origin: string;
    readonly quantity: string | null;
    readonly unitAmount: string | null;
    readonly amount: string;
    readonly affectsNet: boolean;
  }[];
  readonly totals: {
    readonly gross: string;
    readonly benefits: string;
    readonly deductions: string;
    readonly adjustments: string;
    readonly net: string;
  };
}

export interface PayrollStatementSummary {
  readonly id: string;
  readonly businessUnitId: string;
  readonly payrollPeriodId: string;
  readonly competence: string;
  readonly status: string;
  readonly calculationVersion: number;
  readonly employee: { readonly id: string; readonly fullName: string };
  readonly employment: {
    readonly id: string;
    readonly code: string;
    readonly jobRole: string;
  };
  readonly totals: StatementDocumentData["totals"];
  readonly updatedAt: string;
}

export interface PayrollReceiptSummary {
  readonly id: string;
  readonly businessUnitId: string;
  readonly payrollStatementId: string;
  readonly receiptNumber: string;
  readonly version: number;
  readonly status: string;
  readonly issuedAt: string | null;
  readonly voidedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StatementDetailsData extends StatementDocumentData {
  readonly adjustments: {
    readonly source: readonly StatementAdjustmentData[];
    readonly applied: readonly StatementAdjustmentData[];
  };
  readonly receipts: readonly PayrollReceiptSummary[];
}

export interface StatementAdjustmentData {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly amount: string;
  readonly reason: string;
  readonly sourcePayrollStatementId: string;
  readonly appliedPayrollStatementId: string | null;
  readonly createdAt: string;
  readonly appliedAt: string | null;
  readonly cancelledAt: string | null;
}

export interface PaymentReceiptData {
  readonly receipt: PayrollReceiptRecord;
  readonly statement: StatementDocumentData;
}

export interface PayrollService {
  createJobRole(input: CreateJobRoleInput): Promise<JobRoleRecord>;
  listJobRoles(businessUnitId: string): Promise<readonly JobRoleRecord[]>;
  registerEmployee(input: CreateEmployeeWithEmploymentInput): Promise<EmployeeRecord>;
  addEmployment(employeeId: string, input: EmploymentInput): Promise<EmploymentRecord>;
  updateEmployeePersonalData(input: EmployeePersonalDataInput): Promise<EmployeeRecord>;
  updateEmployment(input: UpdateEmploymentInput): Promise<EmploymentRecord>;
  changeCompensation(
    businessUnitId: string,
    employmentId: string,
    input: CompensationInput,
    actorUserId: string,
  ): ReturnType<PayrollRepository["addCompensation"]>;
  findEmployee(businessUnitId: string, employeeId: string): Promise<EmployeeRecord>;
  listEmployees(businessUnitId: string): Promise<readonly EmployeeRecord[]>;
  deleteEmployeeWithoutHistory(
    businessUnitId: string,
    employeeId: string,
    actorUserId: string,
  ): ReturnType<PayrollRepository["deleteEmployeeWithoutHistory"]>;
  openPeriod(input: OpenPayrollPeriodInput): Promise<PayrollPeriodRecord>;
  listPeriods(businessUnitId: string): Promise<readonly PayrollPeriodRecord[]>;
  listStatements(
    businessUnitId: string,
    payrollPeriodId?: string,
  ): Promise<readonly PayrollStatementSummary[]>;
  listPayrollReceipts(
    businessUnitId: string,
    payrollStatementId?: string,
  ): Promise<readonly PayrollReceiptSummary[]>;
  getStatementDetails(
    businessUnitId: string,
    payrollStatementId: string,
  ): Promise<StatementDetailsData>;
  createStatement(input: {
    readonly businessUnitId: string;
    readonly payrollPeriodId: string;
    readonly employmentId: string;
    readonly compensationId?: string | null;
    readonly lineItems?: readonly PayrollLineItemInput[];
    readonly actorUserId: string;
  }): Promise<PayrollStatementRecord>;
  addEarning(input: AddStatementItemInput): Promise<PayrollStatementRecord>;
  addBenefit(input: AddStatementItemInput): Promise<PayrollStatementRecord>;
  addDeduction(input: AddStatementItemInput): Promise<PayrollStatementRecord>;
  createAdjustment(input: CreatePayrollAdjustmentInput): Promise<PayrollAdjustmentRecord>;
  applyAdjustment(input: ApplyAdjustmentInput): Promise<PayrollStatementRecord>;
  calculateStatement(
    businessUnitId: string,
    payrollStatementId: string,
    actorUserId: string,
  ): Promise<PayrollStatementRecord>;
  calculatePeriod(
    businessUnitId: string,
    payrollPeriodId: string,
    actorUserId: string,
  ): Promise<Extract<CalculatePayrollPeriodOutcome, { kind: "SUCCESS" }>>;
  closePeriod(
    businessUnitId: string,
    payrollPeriodId: string,
    actorUserId: string,
  ): Promise<Extract<ClosePayrollPeriodOutcome, { kind: "SUCCESS" }>>;
  getStatementDocument(
    businessUnitId: string,
    payrollStatementId: string,
  ): Promise<StatementDocumentData>;
  createPaymentReceipt(input: CreatePayrollReceiptInput): Promise<PaymentReceiptData>;
  createServiceReceipt(input: CreateServiceReceiptInput): Promise<ServiceReceiptRecord>;
  listServiceReceipts(businessUnitId: string): Promise<readonly ServiceReceiptRecord[]>;
}

function requiredText(value: string, fieldName: string, maximumLength = 160) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw new PayrollDomainError("INVALID_INPUT", `${fieldName} é obrigatório.`);
  }
  if (normalized.length > maximumLength) {
    throw new PayrollDomainError(
      "INVALID_INPUT",
      `${fieldName} deve possuir no máximo ${maximumLength} caracteres.`,
    );
  }
  return normalized;
}

function requiredId(value: string, fieldName: string) {
  return requiredText(value, fieldName, 80);
}

function optionalText(value: string | null | undefined, maximumLength = 500) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (normalized.length > maximumLength) {
    throw new PayrollDomainError(
      "INVALID_INPUT",
      `O texto deve possuir no máximo ${maximumLength} caracteres.`,
    );
  }
  return normalized;
}

function validDate(value: Date, fieldName: string) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new PayrollDomainError("INVALID_INPUT", `${fieldName} é inválida.`);
  }
  return new Date(value.getTime());
}

function normalizedCompetence(value: Date) {
  const date = validDate(value, "Competência");
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function normalizedDecimal(value: string, fieldName: string, decimalPlaces: 2 | 4 = 2) {
  const normalized = value.trim();
  const pattern = decimalPlaces === 2
    ? /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/
    : /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/;
  if (!pattern.test(normalized)) {
    throw new PayrollDomainError(
      "INVALID_INPUT",
      `${fieldName} deve ser positivo e possuir até ${decimalPlaces} casas decimais.`,
    );
  }
  const [integer, fraction = ""] = normalized.split(".");
  if (!/[1-9]/.test(`${integer}${fraction}`)) {
    throw new PayrollDomainError("INVALID_INPUT", `${fieldName} deve ser maior que zero.`);
  }
  return `${integer}.${fraction.padEnd(decimalPlaces, "0")}`;
}

function normalizedCode(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  if (normalized.length < 2) {
    throw new PayrollDomainError(
      "INVALID_INPUT",
      "O código deve possuir pelo menos dois caracteres válidos.",
    );
  }
  return normalized;
}

function normalizeCompensation(input: CompensationInput): CompensationInput {
  const effectiveFrom = validDate(input.effectiveFrom, "Início da vigência");
  const effectiveTo = input.effectiveTo
    ? validDate(input.effectiveTo, "Fim da vigência")
    : input.effectiveTo;
  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new PayrollDomainError(
      "INVALID_INPUT",
      "O fim da vigência não pode anteceder seu início.",
    );
  }
  return {
    amount: normalizedDecimal(input.amount, "Remuneração"),
    unit: input.unit,
    effectiveFrom,
    effectiveTo,
    changeReason: requiredText(input.changeReason, "Motivo da alteração", 500),
  };
}

function normalizeWeeklyWorkingHours(value: string | null | undefined) {
  if (value === undefined || value === null) return value;
  const normalized = normalizedDecimal(value, "Carga horária semanal");
  if (Number(normalized) > 168) {
    throw new PayrollDomainError(
      "INVALID_INPUT",
      "A carga horária semanal não pode ultrapassar 168 horas.",
    );
  }
  return normalized;
}

function normalizeEmployment(input: EmploymentInput): EmploymentInput {
  const startedAt = validDate(input.startedAt, "Início do vínculo");
  const endedAt = input.endedAt ? validDate(input.endedAt, "Fim do vínculo") : input.endedAt;
  if (endedAt && endedAt < startedAt) {
    throw new PayrollDomainError(
      "INVALID_INPUT",
      "O fim do vínculo não pode anteceder seu início.",
    );
  }
  return {
    businessUnitId: requiredId(input.businessUnitId, "Unidade empresarial"),
    jobRoleId: requiredId(input.jobRoleId, "Cargo"),
    code: normalizedCode(input.code),
    type: input.type,
    status: input.status,
    workSchedule: input.workSchedule,
    weeklyWorkingHours: normalizeWeeklyWorkingHours(input.weeklyWorkingHours),
    startedAt,
    endedAt,
    compensation: input.compensation
      ? normalizeCompensation(input.compensation)
      : undefined,
    actorUserId: requiredId(input.actorUserId, "Autor"),
  };
}

function normalizeEmploymentUpdate(input: UpdateEmploymentInput): UpdateEmploymentInput {
  const startedAt = input.startedAt
    ? validDate(input.startedAt, "Início do vínculo")
    : undefined;
  const endedAt = input.endedAt
    ? validDate(input.endedAt, "Fim do vínculo")
    : input.endedAt;
  if (startedAt && endedAt && endedAt < startedAt) {
    throw new PayrollDomainError(
      "INVALID_INPUT",
      "O fim do vínculo não pode anteceder seu início.",
    );
  }
  return {
    employmentId: requiredId(input.employmentId, "Vínculo"),
    businessUnitId: requiredId(input.businessUnitId, "Unidade empresarial"),
    expectedUpdatedAt: validDate(input.expectedUpdatedAt, "Versão do vínculo"),
    jobRoleId: input.jobRoleId
      ? requiredId(input.jobRoleId, "Cargo")
      : input.jobRoleId,
    status: input.status,
    workSchedule: input.workSchedule,
    weeklyWorkingHours: normalizeWeeklyWorkingHours(input.weeklyWorkingHours),
    startedAt,
    endedAt,
    actorUserId: requiredId(input.actorUserId, "Autor"),
  };
}

function normalizeLineItem(input: PayrollLineItemInput): PayrollLineItemInput {
  return {
    type: input.type,
    origin: input.origin,
    code: normalizedCode(input.code),
    description: requiredText(input.description, "Descrição", 240),
    quantity: input.quantity
      ? normalizedDecimal(input.quantity, "Quantidade", 4)
      : input.quantity,
    unitAmount: input.unitAmount
      ? normalizedDecimal(input.unitAmount, "Valor unitário", 4)
      : input.unitAmount,
    amount: normalizedDecimal(input.amount, "Valor"),
    affectsNet: input.affectsNet,
  };
}

function repositoryErrorCode(code: PayrollRepositoryError["code"]): PayrollDomainErrorCode {
  const codes: Record<PayrollRepositoryError["code"], PayrollDomainErrorCode> = {
    DUPLICATE_EMPLOYMENT: "DUPLICATE_EMPLOYEE_OR_EMPLOYMENT",
    DUPLICATE_JOB_ROLE: "DUPLICATE_JOB_ROLE",
    DUPLICATE_PERIOD: "DUPLICATE_PERIOD",
    DUPLICATE_STATEMENT: "DUPLICATE_STATEMENT",
    DUPLICATE_LINE_ITEM: "DUPLICATE_LINE_ITEM",
    DUPLICATE_RECEIPT: "DUPLICATE_RECEIPT",
    EMPLOYEE_HAS_HISTORY: "EMPLOYEE_HAS_HISTORY",
    NOT_FOUND: "NOT_FOUND",
    INVALID_ADJUSTMENT_STATE: "INVALID_ADJUSTMENT_STATE",
  };
  return codes[code];
}

async function withDomainErrors<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PayrollRepositoryError) {
      throw new PayrollDomainError(repositoryErrorCode(error.code), error.message, {
        cause: error,
      });
    }
    if (error instanceof EmploymentUpdateError) {
      throw new PayrollDomainError(error.code, error.message, { cause: error });
    }
    throw error;
  }
}

function money(value: { toFixed(decimalPlaces?: number): string }) {
  return value.toFixed(2);
}

function statementDocument(statement: PayrollStatementRecord): StatementDocumentData {
  return {
    id: statement.id,
    businessUnitId: statement.businessUnitId,
    competence: statement.payrollPeriod.competence.toISOString().slice(0, 10),
    status: statement.status,
    calculationVersion: statement.calculationVersion,
    employee: {
      id: statement.employment.employee.id,
      fullName: statement.employment.employee.fullName,
    },
    employment: {
      id: statement.employment.id,
      code: statement.employment.code,
      jobRole: statement.employment.jobRole.name,
    },
    items: statement.lineItems.map((item) => ({
      code: item.code,
      description: item.description,
      type: item.type,
      origin: item.origin,
      quantity: item.quantity?.toFixed(4) ?? null,
      unitAmount: item.unitAmount?.toFixed(4) ?? null,
      amount: money(item.amount),
      affectsNet: item.affectsNet,
    })),
    totals: {
      gross: money(statement.grossAmount),
      benefits: money(statement.benefitAmount),
      deductions: money(statement.deductionAmount),
      adjustments: money(statement.adjustmentAmount),
      net: money(statement.netAmount),
    },
  };
}

function statementSummary(statement: PayrollStatementRecord): PayrollStatementSummary {
  const document = statementDocument(statement);
  return {
    id: document.id,
    businessUnitId: document.businessUnitId,
    payrollPeriodId: statement.payrollPeriodId,
    competence: document.competence,
    status: document.status,
    calculationVersion: document.calculationVersion,
    employee: document.employee,
    employment: document.employment,
    totals: document.totals,
    updatedAt: statement.updatedAt.toISOString(),
  };
}

function payrollReceiptSummary(receipt: PayrollReceiptRecord): PayrollReceiptSummary {
  return {
    id: receipt.id,
    businessUnitId: receipt.businessUnitId,
    payrollStatementId: receipt.payrollStatementId,
    receiptNumber: receipt.receiptNumber,
    version: receipt.version,
    status: receipt.status,
    issuedAt: receipt.issuedAt?.toISOString() ?? null,
    voidedAt: receipt.voidedAt?.toISOString() ?? null,
    createdAt: receipt.createdAt.toISOString(),
    updatedAt: receipt.updatedAt.toISOString(),
  };
}

function statementAdjustment(
  adjustment: PayrollStatementRecord["sourceAdjustments"][number],
): StatementAdjustmentData {
  return {
    id: adjustment.id,
    type: adjustment.type,
    status: adjustment.status,
    amount: money(adjustment.amount),
    reason: adjustment.reason,
    sourcePayrollStatementId: adjustment.sourcePayrollStatementId,
    appliedPayrollStatementId: adjustment.appliedPayrollStatementId,
    createdAt: adjustment.createdAt.toISOString(),
    appliedAt: adjustment.appliedAt?.toISOString() ?? null,
    cancelledAt: adjustment.cancelledAt?.toISOString() ?? null,
  };
}

function statementDetails(statement: PayrollStatementRecord): StatementDetailsData {
  return {
    ...statementDocument(statement),
    adjustments: {
      source: statement.sourceAdjustments.map(statementAdjustment),
      applied: statement.appliedAdjustments.map(statementAdjustment),
    },
    receipts: statement.receipts.map(payrollReceiptSummary),
  };
}

async function requirePeriod(
  repository: PayrollRepository,
  businessUnitId: string,
  payrollPeriodId: string,
) {
  const period = await repository.findPeriod(businessUnitId, payrollPeriodId);
  if (!period) {
    throw new PayrollDomainError("NOT_FOUND", "Competência não encontrada nesta unidade.");
  }
  return period;
}

async function requireOpenStatement(
  repository: PayrollRepository,
  businessUnitId: string,
  payrollStatementId: string,
) {
  const statement = await repository.findStatement(businessUnitId, payrollStatementId);
  if (!statement) {
    throw new PayrollDomainError("NOT_FOUND", "Demonstrativo não encontrado.");
  }
  if (statement.payrollPeriod.status === "CLOSED") {
    throw new PayrollDomainError("PERIOD_CLOSED", "A competência está fechada.");
  }
  if (statement.payrollPeriod.status !== "OPEN" || statement.status !== "DRAFT") {
    throw new PayrollDomainError(
      "INVALID_STATEMENT_STATE",
      "Somente demonstrativos em rascunho de competência aberta podem ser alterados.",
    );
  }
  return statement;
}

function normalizeStatementItem(
  input: AddStatementItemInput,
  type: PayrollLineItemType,
): PayrollLineItemInput {
  return normalizeLineItem({
    type,
    origin: "MANUAL",
    code: input.code,
    description: input.description,
    quantity: input.quantity,
    unitAmount: input.unitAmount,
    amount: input.amount,
    affectsNet: input.affectsNet,
  });
}

export function createPayrollService(
  repository: PayrollRepository = payrollRepository,
): PayrollService {
  async function addItem(input: AddStatementItemInput, type: PayrollLineItemType) {
    const businessUnitId = requiredId(input.businessUnitId, "Unidade empresarial");
    const payrollStatementId = requiredId(input.payrollStatementId, "Demonstrativo");
    const actorUserId = requiredId(input.actorUserId, "Autor");
    return withDomainErrors(async () => {
      await requireOpenStatement(repository, businessUnitId, payrollStatementId);
      return repository.addLineItem(
        businessUnitId,
        payrollStatementId,
        normalizeStatementItem(input, type),
        actorUserId,
      );
    });
  }

  return {
    createJobRole(input) {
      return withDomainErrors(() => repository.createJobRole({
        businessUnitId: requiredId(input.businessUnitId, "Unidade empresarial"),
        code: normalizedCode(input.code),
        name: requiredText(input.name, "Nome do cargo", 120),
        description: optionalText(input.description),
        status: input.status,
        actorUserId: requiredId(input.actorUserId, "Autor"),
      }));
    },

    listJobRoles(businessUnitId) {
      return withDomainErrors(() => repository.listJobRoles(
        requiredId(businessUnitId, "Unidade empresarial"),
      ));
    },

    registerEmployee(input) {
      const employment = normalizeEmployment(input);
      return withDomainErrors(() => repository.createEmployeeWithEmployment({
        ...employment,
        fullName: requiredText(input.fullName, "Nome do funcionário", 180),
        userId: input.userId,
        taxIdentifierHash: optionalText(input.taxIdentifierHash, 64),
        taxIdentifierEncrypted: optionalText(input.taxIdentifierEncrypted, 2_000),
        employeeStatus: input.employeeStatus,
      }));
    },

    addEmployment(employeeId, input) {
      return withDomainErrors(() => repository.addEmployment(
        requiredId(employeeId, "Funcionário"),
        normalizeEmployment(input),
      ));
    },

    updateEmployeePersonalData(input) {
      return withDomainErrors(() => repository.updateEmployeePersonalData(
        normalizeEmployeePersonalData(input),
      ));
    },

    updateEmployment(input) {
      return withDomainErrors(() => repository.updateEmployment(
        normalizeEmploymentUpdate(input),
      ));
    },

    changeCompensation(businessUnitId, employmentId, input, actorUserId) {
      return withDomainErrors(() => repository.addCompensation(
        requiredId(businessUnitId, "Unidade empresarial"),
        requiredId(employmentId, "Vínculo"),
        normalizeCompensation(input),
        requiredId(actorUserId, "Autor"),
      ));
    },

    async findEmployee(businessUnitId, employeeId) {
      const employee = await withDomainErrors(() => repository.findEmployee(
        requiredId(businessUnitId, "Unidade empresarial"),
        requiredId(employeeId, "Funcionário"),
      ));
      if (!employee) {
        throw new PayrollDomainError("NOT_FOUND", "Funcionário não encontrado.");
      }
      return employee;
    },

    listEmployees(businessUnitId) {
      return withDomainErrors(() => repository.listEmployees(
        requiredId(businessUnitId, "Unidade empresarial"),
      ));
    },

    deleteEmployeeWithoutHistory(businessUnitId, employeeId, actorUserId) {
      return withDomainErrors(() => repository.deleteEmployeeWithoutHistory(
        requiredId(businessUnitId, "Unidade empresarial"),
        requiredId(employeeId, "Funcionário"),
        requiredId(actorUserId, "Autor"),
      ));
    },

    openPeriod(input) {
      return withDomainErrors(() => repository.createPeriod({
        businessUnitId: requiredId(input.businessUnitId, "Unidade empresarial"),
        competence: normalizedCompetence(input.competence),
        actorUserId: requiredId(input.actorUserId, "Autor"),
      }));
    },

    listPeriods(businessUnitId) {
      return withDomainErrors(() => repository.listPeriods(
        requiredId(businessUnitId, "Unidade empresarial"),
      ));
    },

    listStatements(businessUnitId, payrollPeriodId) {
      businessUnitId = requiredId(businessUnitId, "Unidade empresarial");
      const periodId = payrollPeriodId === undefined
        ? undefined
        : requiredId(payrollPeriodId, "Competência");
      return withDomainErrors(async () => {
        const statements = await repository.listStatements(businessUnitId, periodId);
        return statements.map(statementSummary);
      });
    },

    listPayrollReceipts(businessUnitId, payrollStatementId) {
      businessUnitId = requiredId(businessUnitId, "Unidade empresarial");
      const statementId = payrollStatementId === undefined
        ? undefined
        : requiredId(payrollStatementId, "Demonstrativo");
      return withDomainErrors(async () => {
        const receipts = await repository.listPayrollReceipts(
          businessUnitId,
          statementId,
        );
        return receipts.map(payrollReceiptSummary);
      });
    },

    async getStatementDetails(businessUnitId, payrollStatementId) {
      const statement = await withDomainErrors(() => repository.findStatement(
        requiredId(businessUnitId, "Unidade empresarial"),
        requiredId(payrollStatementId, "Demonstrativo"),
      ));
      if (!statement) {
        throw new PayrollDomainError(
          "NOT_FOUND",
          "Demonstrativo não encontrado nesta unidade.",
        );
      }
      return statementDetails(statement);
    },

    createStatement(input) {
      const businessUnitId = requiredId(input.businessUnitId, "Unidade empresarial");
      const payrollPeriodId = requiredId(input.payrollPeriodId, "Competência");
      const employmentId = requiredId(input.employmentId, "Vínculo");
      const actorUserId = requiredId(input.actorUserId, "Autor");
      return withDomainErrors(async () => {
        const period = await requirePeriod(repository, businessUnitId, payrollPeriodId);
        if (period.status === "CLOSED") {
          throw new PayrollDomainError("PERIOD_CLOSED", "A competência está fechada.");
        }
        if (period.status !== "OPEN") {
          throw new PayrollDomainError(
            "INVALID_PERIOD_STATE",
            "Novos demonstrativos só podem ser criados em competência aberta.",
          );
        }

        const employees = await repository.listEmployees(businessUnitId);
        const employment = employees
          .flatMap((employee) => employee.employments)
          .find((candidate) => candidate.id === employmentId);
        if (!employment) {
          throw new PayrollDomainError(
            "NOT_FOUND",
            "Vínculo não encontrado nesta unidade empresarial.",
          );
        }

        const competenceStart = new Date(period.competence);
        const competenceEnd = new Date(Date.UTC(
          competenceStart.getUTCFullYear(),
          competenceStart.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ));
        const compensation = employment.compensations.find((candidate) => (
          candidate.unit === "MONTHLY"
          && candidate.effectiveFrom <= competenceEnd
          && (!candidate.effectiveTo || candidate.effectiveTo >= competenceStart)
          && (!input.compensationId || candidate.id === input.compensationId)
        ));

        const lineItems = input.lineItems?.map(normalizeLineItem) ?? [];
        const hasBaseSalary = lineItems.some((item) => item.code === "SALARIO_BASE");
        if (compensation && !hasBaseSalary) {
          lineItems.unshift(normalizeLineItem({
            type: "EARNING",
            origin: "CALCULATED",
            code: "SALARIO_BASE",
            description: "Salário base",
            amount: compensation.amount.toFixed(2),
            affectsNet: true,
          }));
        }

        return repository.createStatement({
          businessUnitId,
          payrollPeriodId,
          employmentId,
          compensationId: compensation?.id ?? (
            input.compensationId
              ? requiredId(input.compensationId, "Remuneração")
              : input.compensationId
          ),
          lineItems,
          actorUserId,
        });
      });
    },

    addEarning(input) {
      return addItem(input, "EARNING");
    },

    addBenefit(input) {
      return addItem(input, "BENEFIT");
    },

    addDeduction(input) {
      return addItem(input, "DEDUCTION");
    },

    createAdjustment(input) {
      const businessUnitId = requiredId(input.businessUnitId, "Unidade empresarial");
      const sourcePayrollStatementId = requiredId(
        input.sourcePayrollStatementId,
        "Demonstrativo de origem",
      );
      return withDomainErrors(async () => {
        const source = await repository.findStatement(
          businessUnitId,
          sourcePayrollStatementId,
        );
        if (!source) {
          throw new PayrollDomainError("NOT_FOUND", "Demonstrativo de origem não encontrado.");
        }
        return repository.createAdjustment({
          businessUnitId,
          sourcePayrollStatementId,
          type: input.type,
          amount: normalizedDecimal(input.amount, "Valor do ajuste"),
          reason: requiredText(input.reason, "Motivo do ajuste", 500),
          actorUserId: requiredId(input.actorUserId, "Autor"),
        });
      });
    },

    applyAdjustment(input) {
      const businessUnitId = requiredId(input.businessUnitId, "Unidade empresarial");
      const appliedPayrollStatementId = requiredId(
        input.appliedPayrollStatementId,
        "Demonstrativo de destino",
      );
      return withDomainErrors(async () => {
        await requireOpenStatement(repository, businessUnitId, appliedPayrollStatementId);
        return repository.applyAdjustment(
          businessUnitId,
          requiredId(input.adjustmentId, "Ajuste"),
          appliedPayrollStatementId,
          requiredId(input.actorUserId, "Autor"),
        );
      });
    },

    calculateStatement(businessUnitId, payrollStatementId, actorUserId) {
      businessUnitId = requiredId(businessUnitId, "Unidade empresarial");
      payrollStatementId = requiredId(payrollStatementId, "Demonstrativo");
      actorUserId = requiredId(actorUserId, "Autor");
      return withDomainErrors(async () => {
        await requireOpenStatement(repository, businessUnitId, payrollStatementId);
        return repository.updateStatementStatus(
          businessUnitId,
          payrollStatementId,
          "CALCULATED",
          actorUserId,
        );
      });
    },

    calculatePeriod(businessUnitId, payrollPeriodId, actorUserId) {
      businessUnitId = requiredId(businessUnitId, "Unidade empresarial");
      payrollPeriodId = requiredId(payrollPeriodId, "Competência");
      actorUserId = requiredId(actorUserId, "Autor");
      return withDomainErrors(async () => {
        let outcome: CalculatePayrollPeriodOutcome;
        try {
          outcome = await repository.calculatePeriodAtomically(
            businessUnitId,
            payrollPeriodId,
            actorUserId,
          );
        } catch (error) {
          const statements = await repository.listStatements(businessUnitId, payrollPeriodId);
          const pending = statements
            .filter((statement) => statement.status === "DRAFT")
            .map((statement) => statement.employment.employee.fullName);
          const suffix = pending.length
            ? ` Permaneceram pendentes: ${pending.join(", ")}.`
            : " Nenhum demonstrativo elegível permaneceu pendente.";
          throw new PayrollDomainError(
            "INVALID_STATEMENT_STATE",
            `O cálculo foi revertido integralmente.${suffix}`,
            { cause: error },
          );
        }
        if (outcome.kind === "NOT_FOUND") {
          throw new PayrollDomainError("NOT_FOUND", "Competência não encontrada nesta unidade.");
        }
        if (outcome.kind === "CLOSED") {
          throw new PayrollDomainError("PERIOD_CLOSED", "A competência está fechada e não foi modificada.");
        }
        if (outcome.kind === "EMPTY") {
          throw new PayrollDomainError("EMPTY_PAYROLL", "A competência não possui demonstrativos para cálculo.");
        }
        if (outcome.pendingStatementIds.length) {
          throw new PayrollDomainError(
            "INCOMPLETE_PAYROLL",
            `O cálculo não foi concluído; ${outcome.pendingStatementIds.length} demonstrativo(s) permanecem pendentes.`,
          );
        }
        return outcome;
      });
    },

    closePeriod(businessUnitId, payrollPeriodId, actorUserId) {
      businessUnitId = requiredId(businessUnitId, "Unidade empresarial");
      payrollPeriodId = requiredId(payrollPeriodId, "Competência");
      actorUserId = requiredId(actorUserId, "Autor");
      return withDomainErrors(async () => {
        let outcome: ClosePayrollPeriodOutcome;
        try {
          outcome = await repository.closePeriodAtomically(
            businessUnitId,
            payrollPeriodId,
            actorUserId,
          );
        } catch (error) {
          const statements = await repository.listStatements(businessUnitId, payrollPeriodId);
          const pending = statements
            .filter((statement) => statement.status === "CALCULATED")
            .map((statement) => statement.employment.employee.fullName);
          const suffix = pending.length
            ? ` Permaneceram sem fechamento: ${pending.join(", ")}.`
            : " Nenhum demonstrativo calculado permaneceu pendente.";
          throw new PayrollDomainError(
            "INCOMPLETE_PAYROLL",
            `O fechamento foi revertido integralmente.${suffix}`,
            { cause: error },
          );
        }
        if (outcome.kind === "NOT_FOUND") {
          throw new PayrollDomainError("NOT_FOUND", "Competência não encontrada nesta unidade.");
        }
        if (outcome.kind === "NOT_CALCULATED") {
          throw new PayrollDomainError("INVALID_PERIOD_STATE", "A competência deve ser calculada antes do fechamento.");
        }
        if (outcome.kind === "EMPTY") {
          throw new PayrollDomainError("EMPTY_PAYROLL", "A competência não possui demonstrativos.");
        }
        if (outcome.kind === "INCOMPLETE" || outcome.pendingStatementIds.length) {
          throw new PayrollDomainError(
            "INCOMPLETE_PAYROLL",
            `A competência possui ${outcome.pendingStatementIds.length} demonstrativo(s) não elegível(is) ao fechamento.`,
          );
        }
        return outcome;
      });
    },

    async getStatementDocument(businessUnitId, payrollStatementId) {
      const statement = await withDomainErrors(() => repository.findStatement(
        requiredId(businessUnitId, "Unidade empresarial"),
        requiredId(payrollStatementId, "Demonstrativo"),
      ));
      if (!statement) {
        throw new PayrollDomainError("NOT_FOUND", "Demonstrativo não encontrado.");
      }
      return statementDocument(statement);
    },

    createPaymentReceipt(input) {
      const businessUnitId = requiredId(input.businessUnitId, "Unidade empresarial");
      const payrollStatementId = requiredId(input.payrollStatementId, "Demonstrativo");
      return withDomainErrors(async () => {
        const statement = await repository.findStatement(
          businessUnitId,
          payrollStatementId,
        );
        if (!statement) {
          throw new PayrollDomainError("NOT_FOUND", "Demonstrativo não encontrado.");
        }
        if (
          statement.payrollPeriod.status !== "CLOSED"
          || statement.status !== "CLOSED"
        ) {
          throw new PayrollDomainError(
            "INVALID_STATEMENT_STATE",
            "O recibo de pagamento só pode ser emitido após o fechamento.",
          );
        }
        const receipt = await repository.createPayrollReceipt({
          businessUnitId,
          payrollStatementId,
          receiptNumber: requiredText(input.receiptNumber, "Número do recibo", 80),
          version: input.version,
          documentHash: optionalText(input.documentHash, 64),
          storageKey: optionalText(input.storageKey, 500),
          issuance: input.issuance
            ? {
                at: validDate(input.issuance.at, "Data de emissão"),
                actorUserId: requiredId(input.issuance.actorUserId, "Emissor"),
              }
            : undefined,
          actorUserId: requiredId(input.actorUserId, "Autor"),
        });
        return { receipt, statement: statementDocument(statement) };
      });
    },

    createServiceReceipt(input) {
      if (input.providerType === "AUTONOMOUS" && !input.providerEmploymentId) {
        throw new PayrollDomainError(
          "INVALID_INPUT",
          "O vínculo do prestador é obrigatório para recibos de autônomo.",
        );
      }
      return withDomainErrors(() => repository.createServiceReceipt({
        businessUnitId: requiredId(input.businessUnitId, "Unidade empresarial"),
        providerEmploymentId: input.providerEmploymentId
          ? requiredId(input.providerEmploymentId, "Vínculo do prestador")
          : input.providerEmploymentId,
        financialEntryId: input.financialEntryId
          ? requiredId(input.financialEntryId, "Lançamento financeiro")
          : input.financialEntryId,
        providerType: input.providerType,
        receiptNumber: requiredText(input.receiptNumber, "Número do recibo", 80),
        competence: normalizedCompetence(input.competence),
        serviceDate: validDate(input.serviceDate, "Data do serviço"),
        serviceDescription: requiredText(
          input.serviceDescription,
          "Descrição do serviço",
          500,
        ),
        recipientName: requiredText(input.recipientName, "Tomador do serviço", 180),
        recipientTaxIdentifierHash: optionalText(input.recipientTaxIdentifierHash, 64),
        recipientTaxIdentifierEncrypted: optionalText(
          input.recipientTaxIdentifierEncrypted,
          2_000,
        ),
        amount: normalizedDecimal(input.amount, "Valor do serviço"),
        documentHash: optionalText(input.documentHash, 64),
        storageKey: optionalText(input.storageKey, 500),
        issuance: input.issuance
          ? {
              at: validDate(input.issuance.at, "Data de emissão"),
              actorUserId: requiredId(input.issuance.actorUserId, "Emissor"),
            }
          : undefined,
        actorUserId: requiredId(input.actorUserId, "Autor"),
      }));
    },

    listServiceReceipts(businessUnitId) {
      return withDomainErrors(() => repository.listServiceReceipts(
        requiredId(businessUnitId, "Unidade empresarial"),
      ));
    },
  };
}

export const payrollService = createPayrollService();
