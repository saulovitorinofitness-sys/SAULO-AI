import { z } from "zod";

export type SalaryPaymentMethod = "CASH" | "PIX" | "BANK_TRANSFER" | "BANK_DEPOSIT";
export type PayrollDocumentKind = "LEGACY_DEMONSTRATIVE" | "SALARY_RECEIPT";

const uuid = z.string().uuid();
const money = z.string().regex(/^(0|[1-9]\d*)\.\d{2}$/);
const date = z.iso.date();
const timestamp = z.string().datetime({ offset: true });
const nonempty = z.string().trim().min(1);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);

export const employerLegalSchema = z.object({
  unitId: uuid,
  unitName: nonempty,
  legalName: nonempty,
  tradeName: z.string().trim().nullable(),
  legalTaxIdType: z.enum(["CPF", "CNPJ"]),
  legalTaxId: nonempty,
  addressStreet: nonempty,
  addressNumber: nonempty,
  addressComplement: z.string().trim().nullable(),
  addressNeighborhood: nonempty,
  addressPostalCode: z.string().regex(/^\d{8}$/),
  addressCity: nonempty,
  addressState: z.string().regex(/^[A-Z]{2}$/),
}).strict();

export const employeeReceiptSchema = z.object({
  employeeId: uuid,
  fullName: nonempty,
  cpf: z.string().trim().nullable(),
  identityDocument: z.string().trim().nullable(),
  socialSecurityNumber: z.string().trim().nullable().optional(),
  employmentId: uuid,
  employmentCode: nonempty,
  employmentType: z.literal("EMPLOYEE"),
  jobRole: nonempty,
}).strict();

export const salaryLineItemSchema = z.object({
  code: nonempty,
  description: nonempty,
  type: z.enum(["EARNING", "BENEFIT", "DEDUCTION", "ADJUSTMENT_CREDIT", "ADJUSTMENT_DEBIT"]),
  origin: z.enum(["CALCULATED", "MANUAL", "ADJUSTMENT"]),
  quantity: z.string().regex(/^\d+\.\d{4}$/).nullable(),
  unitAmount: z.string().regex(/^\d+\.\d{4}$/).nullable(),
  amount: money,
  affectsNet: z.boolean(),
}).strict();

export const salaryReceiptSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  receipt: z.object({ id: uuid, number: nonempty, version: z.number().int().positive(), issuedAt: timestamp }).strict(),
  employer: employerLegalSchema,
  employee: employeeReceiptSchema,
  statement: z.object({ id: uuid, unitId: uuid, employmentId: uuid, competence: date, calculationVersion: z.number().int().positive() }).strict(),
  lineItems: z.array(salaryLineItemSchema),
  totals: z.object({ salaryBase: money, gross: money, benefits: money, deductions: money, adjustments: z.string().regex(/^-?(0|[1-9]\d*)\.\d{2}$/), net: money }).strict(),
  payment: z.object({
    confirmationId: uuid,
    financialEntryId: uuid,
    financialSettlementId: uuid,
    paidAt: date,
    method: z.enum(["CASH", "PIX", "BANK_TRANSFER", "BANK_DEPOSIT"]),
    paidAmount: money,
    bankReference: z.string().trim().nullable(),
    evidenceId: uuid.nullable(),
    bankProofSha256: sha256.nullable(),
  }).strict(),
  issuer: z.object({ userId: uuid, fullName: nonempty }).strict(),
}).strict();

export type SalaryReceiptSnapshot = z.infer<typeof salaryReceiptSnapshotSchema>;

function toCents(value: string): bigint {
  const negative = value.startsWith("-");
  const [whole, fraction] = (negative ? value.slice(1) : value).split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction);
  return negative ? -cents : cents;
}

function validCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const digit = (length: number) => {
    const sum = Array.from(value.slice(0, length)).reduce((total, char, index) => total + Number(char) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}

function validCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const check = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return check(12) === Number(value[12]) && check(13) === Number(value[13]);
}

export type SalaryReceiptValidationCode =
  | "EMPLOYER_LEGAL_IDENTITY_MISSING"
  | "EMPLOYER_TAX_ID_INVALID"
  | "EMPLOYEE_IDENTIFICATION_MISSING"
  | "EMPLOYEE_CPF_INVALID"
  | "RELATION_MISMATCH"
  | "STATEMENT_NOT_CLOSED"
  | "PAYMENT_NOT_FULLY_SETTLED"
  | "PAYMENT_AMOUNT_MISMATCH";

export interface SalaryReceiptCandidate {
  readonly employer: Partial<z.input<typeof employerLegalSchema>>;
  readonly employee: Partial<z.input<typeof employeeReceiptSchema>>;
  readonly statement: {
    readonly id: string;
    readonly unitId: string;
    readonly employmentId: string;
    readonly status: string;
    readonly periodStatus: string;
    readonly netAmount: string;
    readonly financialEntryId: string | null;
  };
  readonly employment: { readonly id: string; readonly unitId: string; readonly employeeId: string; readonly type: string };
  readonly receipt: { readonly unitId: string; readonly statementId: string };
  readonly payment: {
    readonly financialEntryId: string;
    readonly financialEntryUnitId: string;
    readonly financialEntryType: string;
    readonly financialEntryStatus: string;
    readonly financialEntryAmount: string;
    readonly financialSettlementId: string;
    readonly settlementEntryId: string;
    readonly settlementCount: number;
    readonly settlementAmount: string;
    readonly settlementDate: string;
    readonly paidAt: string;
    readonly method: SalaryPaymentMethod;
    readonly paidAmount: string;
    readonly bankReference?: string | null;
    readonly bankProofStorageKey?: string | null;
    readonly bankProofSha256?: string | null;
  };
}

export function validateSalaryReceiptCandidate(input: SalaryReceiptCandidate): readonly SalaryReceiptValidationCode[] {
  const errors: SalaryReceiptValidationCode[] = [...validateSalaryReceiptFoundation(input)];
  if (
    input.payment.financialEntryUnitId !== input.statement.unitId ||
    input.statement.financialEntryId !== input.payment.financialEntryId ||
    input.payment.settlementEntryId !== input.payment.financialEntryId
  ) errors.push("RELATION_MISMATCH");
  const amounts = [input.statement.netAmount, input.payment.financialEntryAmount, input.payment.settlementAmount, input.payment.paidAmount];
  if (!amounts.every((amount) => money.safeParse(amount).success)) {
    errors.push("PAYMENT_AMOUNT_MISMATCH");
  } else {
    const [net, entry, settled, paid] = amounts.map(toCents);
    if (net <= BigInt(0) || paid !== net || entry !== net) errors.push("PAYMENT_AMOUNT_MISMATCH");
    if (settled !== net) errors.push("PAYMENT_NOT_FULLY_SETTLED");
  }
  if (
    input.payment.financialEntryType !== "EXPENSE" ||
    input.payment.financialEntryStatus !== "SETTLED" ||
    input.payment.settlementCount !== 1 ||
    !uuid.safeParse(input.payment.financialEntryId).success ||
    !uuid.safeParse(input.payment.financialSettlementId).success ||
    !date.safeParse(input.payment.paidAt).success ||
    !date.safeParse(input.payment.settlementDate).success ||
    input.payment.settlementDate !== input.payment.paidAt
  ) errors.push("PAYMENT_NOT_FULLY_SETTLED");
  return Object.freeze([...new Set(errors)]);
}

export function validateSalaryReceiptFoundation(
  input: Omit<SalaryReceiptCandidate, "payment">,
): readonly SalaryReceiptValidationCode[] {
  const errors: SalaryReceiptValidationCode[] = [];
  const employer = employerLegalSchema.safeParse(input.employer);
  if (!employer.success) errors.push("EMPLOYER_LEGAL_IDENTITY_MISSING");
  else if (!(employer.data.legalTaxIdType === "CPF" ? validCpf(employer.data.legalTaxId) : validCnpj(employer.data.legalTaxId))) errors.push("EMPLOYER_TAX_ID_INVALID");

  const employee = employeeReceiptSchema.safeParse(input.employee);
  if (!employee.success) errors.push("EMPLOYEE_IDENTIFICATION_MISSING");
  else if (employee.data.cpf && !validCpf(employee.data.cpf)) errors.push("EMPLOYEE_CPF_INVALID");
  if (input.statement.status !== "CLOSED" || input.statement.periodStatus !== "CLOSED") errors.push("STATEMENT_NOT_CLOSED");
  if (
    input.receipt.unitId !== input.statement.unitId ||
    input.receipt.statementId !== input.statement.id ||
    input.employment.id !== input.statement.employmentId ||
    input.employment.unitId !== input.statement.unitId ||
    input.employment.employeeId !== input.employee.employeeId ||
    input.employee.employmentId !== input.employment.id ||
    input.employment.type !== "EMPLOYEE" ||
    input.employer.unitId !== input.statement.unitId
  ) errors.push("RELATION_MISMATCH");
  return Object.freeze([...new Set(errors)]);
}

export type PayrollDocumentState = "LEGACY_UNCONFIRMED" | "DEMONSTRATIVE_AVAILABLE" | "PAYMENT_CONFIRMED" | "CASH_AWAITING_SIGNATURE" | "BANK_PROVEN" | "SIGNED" | "VOIDED";

export function classifyPayrollDocument(input: {
  readonly kind?: PayrollDocumentKind | null;
  readonly paymentConfirmed: boolean;
  readonly snapshotPresent: boolean;
  readonly method?: SalaryPaymentMethod | null;
  readonly bankProofPresent: boolean;
  readonly signedCopyPresent: boolean;
  readonly voided?: boolean;
}): PayrollDocumentState {
  if (input.voided) return "VOIDED";
  if (!input.kind || input.kind === "LEGACY_DEMONSTRATIVE") return "LEGACY_UNCONFIRMED";
  if (!input.paymentConfirmed || !input.snapshotPresent) return "DEMONSTRATIVE_AVAILABLE";
  if (input.signedCopyPresent) return "SIGNED";
  return input.method === "CASH" ? "CASH_AWAITING_SIGNATURE" : input.bankProofPresent ? "BANK_PROVEN" : "PAYMENT_CONFIRMED";
}

export function canAssertEmployeeReceived(state: PayrollDocumentState): boolean {
  return state === "SIGNED";
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function createImmutableSalarySnapshot(input: unknown): Readonly<SalaryReceiptSnapshot> {
  const snapshot = salaryReceiptSnapshotSchema.parse(input);
  if (snapshot.employer.unitId !== snapshot.statement.unitId ||
    snapshot.employee.employmentId !== snapshot.statement.employmentId ||
    (snapshot.employee.cpf !== null && snapshot.employee.cpf !== "" && !validCpf(snapshot.employee.cpf)) ||
    !(snapshot.employer.legalTaxIdType === "CPF" ? validCpf(snapshot.employer.legalTaxId) : validCnpj(snapshot.employer.legalTaxId)) ||
    snapshot.payment.paidAmount !== snapshot.totals.net) throw new Error("Snapshot salarial inconsistente.");
  const salaryBaseItems = snapshot.lineItems.filter((item) => item.code === "SALARIO_BASE" && item.type === "EARNING" && item.affectsNet);
  if (salaryBaseItems.length !== 1 || toCents(salaryBaseItems[0].amount) !== toCents(snapshot.totals.salaryBase)) {
    throw new Error("Salario-base do snapshot nao corresponde a rubrica persistida.");
  }
  const gross = snapshot.lineItems.filter((item) => item.type === "EARNING")
    .reduce((total, item) => total + toCents(item.amount), BigInt(0));
  const benefits = snapshot.lineItems.filter((item) => item.type === "BENEFIT")
    .reduce((total, item) => total + toCents(item.amount), BigInt(0));
  const deductions = snapshot.lineItems.filter((item) => item.type === "DEDUCTION")
    .reduce((total, item) => total + toCents(item.amount), BigInt(0));
  const adjustments = snapshot.lineItems.filter((item) => item.type === "ADJUSTMENT_CREDIT" || item.type === "ADJUSTMENT_DEBIT")
    .reduce((total, item) => total + (item.type === "ADJUSTMENT_DEBIT" ? -toCents(item.amount) : toCents(item.amount)), BigInt(0));
  if (gross !== toCents(snapshot.totals.gross) || benefits !== toCents(snapshot.totals.benefits) ||
    deductions !== toCents(snapshot.totals.deductions) || adjustments !== toCents(snapshot.totals.adjustments)) {
    throw new Error("Totais do snapshot nao conciliam com as rubricas.");
  }
  const sum = snapshot.lineItems.reduce((total, item) => item.affectsNet
    ? total + (item.type === "DEDUCTION" || item.type === "ADJUSTMENT_DEBIT" ? -toCents(item.amount) : toCents(item.amount))
    : total, BigInt(0));
  if (sum !== toCents(snapshot.totals.net)) throw new Error("Rubricas nao conciliam com o liquido.");
  return deepFreeze(snapshot);
}
