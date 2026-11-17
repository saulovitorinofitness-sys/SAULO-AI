import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { BUILT_IN_IDS } from "@/modules/permissions";

import {
  createImmutableSalarySnapshot,
  validateSalaryReceiptFoundation,
  validateSalaryReceiptCandidate,
  type SalaryPaymentMethod,
  type SalaryReceiptSnapshot,
} from "./salary-receipt-contracts";
import { canonicalSalaryJson, canonicalSnapshotSha256 } from "./salary-payment-canonical";
import { decideSalaryPaymentReplay, type ExistingSalaryReceipt } from "./salary-payment-replay";
import { validatePayrollProof, type ValidatedPayrollProof } from "./salary-payment-file";
import {
  accountSupportsSalaryPayment,
  salaryPaymentDescription,
  salarySettlementIdempotencyKey,
} from "./salary-payment-preparation";

export class SalaryPaymentError extends Error {
  constructor(readonly code: "FORBIDDEN" | "NOT_FOUND" | "INVALID_PAYMENT" | "DUPLICATE" | "IDEMPOTENCY_CONFLICT" | "INVALID_IDENTITY" | "ALREADY_REVERSED") {
    super(code);
  }
}

export interface ConfirmSalaryPaymentInput {
  readonly businessUnitId: string;
  readonly payrollStatementId: string;
  readonly financialAccountId: string;
  readonly paymentMethodId: string;
  readonly idempotencyKey: string;
  readonly paidAt: string;
  readonly method: SalaryPaymentMethod;
  readonly paidAmount: string;
  readonly bankReference: string | null;
  readonly actorUserId: string;
  readonly proof: { readonly name: string; readonly mimeType: string; readonly bytes: Uint8Array } | null;
}

export interface ConfirmSalaryPaymentResult {
  readonly receiptId: string;
  readonly evidenceId: string | null;
  readonly state: "PAYMENT_CONFIRMED" | "CASH_AWAITING_SIGNATURE" | "BANK_PROVEN";
  readonly repeated: boolean;
}

export interface ReverseSalaryPaymentInput {
  readonly businessUnitId: string;
  readonly receiptId: string;
  readonly idempotencyKey: string;
  readonly reason: string;
  readonly actorUserId: string;
}

export interface ReverseSalaryPaymentResult {
  readonly reversalId: string;
  readonly receiptId: string;
  readonly financialEntryId: string;
  readonly financialSettlementId: string;
  readonly reversedAt: string;
  readonly repeated: boolean;
}

type LegalUnitRow = {
  id: string; name: string; legalName: string | null; tradeName: string | null;
  legalTaxIdType: "CPF" | "CNPJ" | null; legalTaxIdEncrypted: string | null;
  addressStreet: string | null; addressNumber: string | null; addressComplement: string | null;
  addressNeighborhood: string | null; addressPostalCode: string | null;
  addressCity: string | null; addressState: string | null;
};
type ExistingRow = ExistingSalaryReceipt;

export type SalaryPaymentReadinessCode =
  | "ALREADY_CONFIRMED"
  | "EMPLOYER_LEGAL_IDENTITY_MISSING"
  | "EMPLOYER_TAX_ID_INVALID"
  | "EMPLOYEE_IDENTIFICATION_MISSING"
  | "EMPLOYEE_CPF_INVALID"
  | "RELATION_MISMATCH"
  | "STATEMENT_NOT_CLOSED"
  | "PAYMENT_NOT_FULLY_SETTLED"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_METHOD_UNSUPPORTED";

export interface SalaryPaymentCandidateView {
  readonly employer: {
    readonly unitName: string;
    readonly legalName: string | null;
    readonly tradeName: string | null;
    readonly legalTaxIdType: "CPF" | "CNPJ" | null;
    readonly maskedLegalTaxId: string | null;
    readonly address: string | null;
  };
  readonly employee: {
    readonly fullName: string;
    readonly maskedCpf: string | null;
    readonly employmentCode: string;
    readonly employmentType: string;
    readonly jobRole: string;
  };
  readonly statement: {
    readonly id: string;
    readonly competence: string;
    readonly calculationVersion: number;
    readonly status: string;
    readonly lineItems: readonly {
      readonly code: string;
      readonly description: string;
      readonly type: string;
      readonly origin: string;
      readonly amount: string;
    }[];
    readonly adjustments: readonly {
      readonly id: string;
      readonly description: string;
      readonly type: "ADJUSTMENT_CREDIT" | "ADJUSTMENT_DEBIT";
      readonly amount: string;
    }[];
    readonly totals: {
      readonly gross: string;
      readonly benefits: string;
      readonly deductions: string;
      readonly adjustments: string;
      readonly net: string;
    };
  };
  readonly settlement: {
    readonly id: string;
    readonly financialAccountId: string;
    readonly paymentMethodId: string;
    readonly paidAt: string;
    readonly method: SalaryPaymentMethod;
    readonly amount: string;
    readonly accountName: string;
  } | null;
  readonly accounts: readonly {
    readonly id: string;
    readonly name: string;
    readonly type: "CASH" | "BANK" | "DIGITAL_WALLET" | "OTHER";
  }[];
  readonly paymentMethods: readonly {
    readonly id: string;
    readonly name: string;
    readonly type: SalaryPaymentMethod;
  }[];
  readonly existingReceipt: {
    readonly id: string;
    readonly number: string;
    readonly version: number;
  } | null;
  readonly pendingRequirements: readonly SalaryPaymentReadinessCode[];
}

function encryptionKey(): Buffer {
  const secret = process.env.PAYROLL_DATA_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) throw new SalaryPaymentError("INVALID_IDENTITY");
  return createHash("sha256").update(secret, "utf8").digest();
}

function decryptPersonal(value: string | null): string | null {
  if (!value) return null;
  const [version, iv, tag, ciphertext, extra] = value.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra !== undefined) throw new SalaryPaymentError("INVALID_IDENTITY");
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new SalaryPaymentError("INVALID_IDENTITY");
  }
}

function maskCpf(value: string | null) {
  return value && /^\d{11}$/.test(value) ? `***.***.***-${value.slice(-2)}` : null;
}

function maskLegalTaxId(value: string | null, type: "CPF" | "CNPJ" | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  if (type === "CPF" && value.length === 11) return maskCpf(value);
  if (type === "CNPJ" && value.length === 14) return `**.***.***/****-${value.slice(-2)}`;
  return null;
}

function unitAddress(unit: LegalUnitRow) {
  const street = [unit.addressStreet, unit.addressNumber].filter(Boolean).join(", ");
  const district = unit.addressNeighborhood;
  const city = [unit.addressCity, unit.addressState].filter(Boolean).join("/");
  const postalCode = unit.addressPostalCode
    ? unit.addressPostalCode.replace(/^(\d{5})(\d{3})$/u, "$1-$2")
    : null;
  const parts = [street, unit.addressComplement, district, city, postalCode].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function encryptSnapshot(plaintext: string): Uint8Array {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  return Buffer.concat([iv, cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
}

export function readSalaryReceiptSnapshot(
  payloadCiphertext: Uint8Array,
  expectedSha256: string,
): Readonly<SalaryReceiptSnapshot> {
  if (payloadCiphertext.byteLength < 29 || !/^[0-9a-f]{64}$/u.test(expectedSha256)) {
    throw new SalaryPaymentError("INVALID_IDENTITY");
  }
  try {
    const bytes = Buffer.from(payloadCiphertext);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(bytes.length - 16));
    const plaintext = Buffer.concat([
      decipher.update(bytes.subarray(12, bytes.length - 16)),
      decipher.final(),
    ]).toString("utf8");
    const snapshot = createImmutableSalarySnapshot(JSON.parse(plaintext));
    if (canonicalSnapshotSha256(snapshot) !== expectedSha256) {
      throw new Error("Snapshot hash mismatch");
    }
    return snapshot;
  } catch (error) {
    if (error instanceof SalaryPaymentError) throw error;
    throw new SalaryPaymentError("INVALID_IDENTITY");
  }
}

function utcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function requestHash(input: ConfirmSalaryPaymentInput, proof: ValidatedPayrollProof | null): string {
  return canonicalSnapshotSha256({
    businessUnitId: input.businessUnitId, payrollStatementId: input.payrollStatementId,
    financialAccountId: input.financialAccountId, paymentMethodId: input.paymentMethodId, paidAt: input.paidAt,
    method: input.method, paidAmount: input.paidAmount,
    bankReference: input.bankReference, actorUserId: input.actorUserId,
    proofSha256: proof?.sha256 ?? null,
    proofFileName: proof?.originalFileName ?? null,
    proofMimeType: proof?.mimeType ?? null,
  });
}

export async function getSalaryPaymentCandidate(input: {
  readonly businessUnitId: string;
  readonly payrollStatementId: string;
  readonly actorUserId: string;
}): Promise<SalaryPaymentCandidateView> {
  if (input.actorUserId !== BUILT_IN_IDS.users.sauloXavierVitorino) {
    throw new SalaryPaymentError("FORBIDDEN");
  }
  const statement = await prisma.payrollStatement.findUnique({
    where: {
      id_businessUnitId: {
        id: input.payrollStatementId,
        businessUnitId: input.businessUnitId,
      },
    },
    include: {
      payrollPeriod: true,
      employment: { include: { employee: true, jobRole: true } },
      lineItems: { orderBy: [{ type: "asc" }, { code: "asc" }] },
      appliedAdjustments: { orderBy: { createdAt: "asc" } },
      financialEntry: true,
    },
  });
  if (!statement) throw new SalaryPaymentError("NOT_FOUND");

  const [unitRows, existingRows, accounts, paymentMethods] = await Promise.all([
    prisma.$queryRaw<LegalUnitRow[]>`
      SELECT "id", "name", "legalName", "tradeName", "legalTaxIdType", "legalTaxIdEncrypted",
        "addressStreet", "addressNumber", "addressComplement", "addressNeighborhood",
        "addressPostalCode", "addressCity", "addressState"
      FROM "BusinessUnit" WHERE "id" = ${input.businessUnitId}::uuid`,
    prisma.$queryRaw<{ id: string; receiptNumber: string; version: number }[]>`
      SELECT "id", "receiptNumber", "version"
      FROM "PayrollReceipt"
      WHERE "businessUnitId" = ${input.businessUnitId}::uuid
        AND "payrollStatementId" = ${input.payrollStatementId}::uuid
        AND "kind" = 'SALARY_RECEIPT'::"PayrollDocumentKind"
        AND "status" = 'ISSUED'::"ReceiptStatus"
      ORDER BY "version" DESC LIMIT 1`,
    prisma.financialAccount.findMany({
      where: { businessUnitId: input.businessUnitId, status: "ACTIVE", type: { in: ["CASH", "BANK", "DIGITAL_WALLET"] } },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
    prisma.paymentMethod.findMany({
      where: { status: "ACTIVE", type: { in: ["CASH", "PIX", "BANK_TRANSFER", "BANK_DEPOSIT"] } },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const unit = unitRows[0];
  if (!unit) throw new SalaryPaymentError("NOT_FOUND");

  const entry = statement.financialEntry;
  const settlements = entry
    ? await prisma.financialSettlement.findMany({
      where: { financialEntryId: entry.id },
      include: { financialAccount: true, paymentMethod: true },
      orderBy: { settlementDate: "asc" },
    })
    : [];
  const settlement = settlements.length === 1 ? settlements[0] : null;
  const supportedMethods = new Set<SalaryPaymentMethod>([
    "CASH",
    "PIX",
    "BANK_TRANSFER",
    "BANK_DEPOSIT",
  ]);
  const method = settlement && supportedMethods.has(String(settlement.paymentMethod.type) as SalaryPaymentMethod)
    ? String(settlement.paymentMethod.type) as SalaryPaymentMethod
    : null;
  const legalTaxId = decryptPersonal(unit.legalTaxIdEncrypted);
  const cpf = decryptPersonal(statement.employment.employee.taxIdentifierEncrypted);
  const employer = {
    unitId: unit.id,
    unitName: unit.name,
    legalName: unit.legalName ?? undefined,
    tradeName: unit.tradeName,
    legalTaxIdType: unit.legalTaxIdType ?? undefined,
    legalTaxId: legalTaxId ?? undefined,
    addressStreet: unit.addressStreet ?? undefined,
    addressNumber: unit.addressNumber ?? undefined,
    addressComplement: unit.addressComplement,
    addressNeighborhood: unit.addressNeighborhood ?? undefined,
    addressPostalCode: unit.addressPostalCode ?? undefined,
    addressCity: unit.addressCity ?? undefined,
    addressState: unit.addressState ?? undefined,
  };
  const employee = statement.employment.employee;
  const employeeIdentity = {
    employeeId: employee.id,
    fullName: employee.fullName,
    cpf,
    identityDocument: decryptPersonal(employee.identityDocumentEncrypted),
    socialSecurityNumber: decryptPersonal(employee.socialSecurityEncrypted),
    employmentId: statement.employment.id,
    employmentCode: statement.employment.code,
    employmentType: statement.employment.type === "EMPLOYEE" ? "EMPLOYEE" as const : undefined,
    jobRole: statement.employment.jobRole.name,
  };
  const validationErrors = validateSalaryReceiptFoundation({
    employer,
    employee: employeeIdentity,
    statement: {
      id: statement.id,
      unitId: statement.businessUnitId,
      employmentId: statement.employmentId,
      status: statement.status,
      periodStatus: statement.payrollPeriod.status,
      netAmount: statement.netAmount.toFixed(2),
      financialEntryId: statement.financialEntryId,
    },
    employment: {
      id: statement.employment.id,
      unitId: statement.employment.businessUnitId,
      employeeId: employee.id,
      type: statement.employment.type,
    },
    receipt: { unitId: input.businessUnitId, statementId: input.payrollStatementId },
  });
  const pending = new Set<SalaryPaymentReadinessCode>();
  for (const code of validationErrors) pending.add(code);
  if (existingRows.length) pending.add("ALREADY_CONFIRMED");
  if (!accounts.length || !paymentMethods.length) {
    pending.add("PAYMENT_METHOD_UNSUPPORTED");
  }

  return {
    employer: {
      unitName: unit.name,
      legalName: unit.legalName,
      tradeName: unit.tradeName,
      legalTaxIdType: unit.legalTaxIdType,
      maskedLegalTaxId: maskLegalTaxId(legalTaxId, unit.legalTaxIdType),
      address: unitAddress(unit),
    },
    employee: {
      fullName: employee.fullName,
      maskedCpf: maskCpf(cpf),
      employmentCode: statement.employment.code,
      employmentType: statement.employment.type,
      jobRole: statement.employment.jobRole.name,
    },
    statement: {
      id: statement.id,
      competence: utcDate(statement.payrollPeriod.competence),
      calculationVersion: statement.calculationVersion,
      status: statement.status,
      lineItems: statement.lineItems.map((item) => ({
        code: item.code,
        description: item.description,
        type: item.type,
        origin: item.origin,
        amount: item.amount.toFixed(2),
      })),
      adjustments: statement.appliedAdjustments
        .filter((item) => item.status === "APPLIED")
        .map((item) => ({
          id: item.id,
          description: item.reason,
          type: item.type === "CREDIT" ? "ADJUSTMENT_CREDIT" as const : "ADJUSTMENT_DEBIT" as const,
          amount: item.amount.toFixed(2),
        })),
      totals: {
        gross: statement.grossAmount.toFixed(2),
        benefits: statement.benefitAmount.toFixed(2),
        deductions: statement.deductionAmount.toFixed(2),
        adjustments: statement.adjustmentAmount.toFixed(2),
        net: statement.netAmount.toFixed(2),
      },
    },
    settlement: settlement && method ? {
      id: settlement.id,
      financialAccountId: settlement.financialAccountId,
      paymentMethodId: settlement.paymentMethodId,
      paidAt: utcDate(settlement.settlementDate),
      method,
      amount: settlement.amount.toFixed(2),
      accountName: settlement.financialAccount.name,
    } : null,
    accounts,
    paymentMethods: paymentMethods.map((item) => ({ ...item, type: item.type as SalaryPaymentMethod })),
    existingReceipt: existingRows[0] ? {
      id: existingRows[0].id,
      number: existingRows[0].receiptNumber,
      version: existingRows[0].version,
    } : null,
    pendingRequirements: [...pending],
  };
}

export async function confirmSalaryPayment(input: ConfirmSalaryPaymentInput): Promise<ConfirmSalaryPaymentResult> {
  if (input.actorUserId !== BUILT_IN_IDS.users.sauloXavierVitorino) throw new SalaryPaymentError("FORBIDDEN");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(input.paidAt) ||
    (input.bankReference !== null && (!input.bankReference.trim() || /[\u0000-\u001f\u007f]/u.test(input.bankReference)))) {
    throw new SalaryPaymentError("INVALID_PAYMENT");
  }
  const proof = input.proof ? validatePayrollProof(input.proof) : null;
  const fingerprint = requestHash(input, proof);

  const operation = () => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.payrollStatementId}, 0))::text AS "lock"`;
    const prior = await tx.$queryRaw<ExistingRow[]>`
      SELECT r."id" AS "receiptId", c."requestSha256", c."method", c."idempotencyKey", r."status", e."id" AS "evidenceId"
      FROM "PayrollSalaryPaymentConfirmation" c
      JOIN "PayrollReceipt" r ON r."paymentConfirmationId" = c."id" AND r."kind" = 'SALARY_RECEIPT'
      LEFT JOIN "PayrollReceiptEvidence" e ON e."receiptId" = r."id" AND e."kind" = 'BANK_PROOF'
      WHERE c."payrollStatementId" = ${input.payrollStatementId}::uuid
        AND c."businessUnitId" = ${input.businessUnitId}::uuid
        AND r."status" = 'ISSUED'::"ReceiptStatus"`;
    const replay = decideSalaryPaymentReplay(prior[0] ?? null, input.idempotencyKey, fingerprint);
    if (replay.kind === "REJECT") throw new SalaryPaymentError(replay.code);
    if (replay.kind === "REPLAY") return { receiptId: replay.receiptId, evidenceId: replay.evidenceId,
      state: replay.state, repeated: true } as ConfirmSalaryPaymentResult;
    const usedKey = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "PayrollSalaryPaymentConfirmation" WHERE "idempotencyKey" = ${input.idempotencyKey}`;
    if (usedKey.length) throw new SalaryPaymentError("IDEMPOTENCY_CONFLICT");
    if (proof) {
      const usedProof = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "PayrollReceiptEvidence" WHERE "sha256" = ${proof.sha256}`;
      if (usedProof.length) throw new SalaryPaymentError("DUPLICATE");
    }

    const statement = await tx.payrollStatement.findUnique({
      where: { id_businessUnitId: { id: input.payrollStatementId, businessUnitId: input.businessUnitId } },
      include: {
        payrollPeriod: true,
        employment: { include: { employee: true, jobRole: true } },
        lineItems: true,
        appliedAdjustments: true,
        financialEntry: true,
        receipts: true,
      },
    });
    if (!statement) throw new SalaryPaymentError("NOT_FOUND");
    const unitRows = await tx.$queryRaw<LegalUnitRow[]>`
      SELECT "id", "name", "legalName", "tradeName", "legalTaxIdType", "legalTaxIdEncrypted",
        "addressStreet", "addressNumber", "addressComplement", "addressNeighborhood",
        "addressPostalCode", "addressCity", "addressState"
      FROM "BusinessUnit" WHERE "id" = ${input.businessUnitId}::uuid`;
    const unit = unitRows[0];
    if (!unit) throw new SalaryPaymentError("NOT_FOUND");
    const [account, paymentMethod] = await Promise.all([
      tx.financialAccount.findFirst({
        where: { id: input.financialAccountId, businessUnitId: input.businessUnitId, status: "ACTIVE" },
      }),
      tx.paymentMethod.findFirst({ where: { id: input.paymentMethodId, status: "ACTIVE" } }),
    ]);
    if (!account || !paymentMethod || String(paymentMethod.type) !== input.method ||
      !accountSupportsSalaryPayment(input.method, account.type)) {
      throw new SalaryPaymentError("INVALID_PAYMENT");
    }

    let entry = statement.financialEntry;
    let settlements = entry ? await tx.financialSettlement.findMany({
      where: { financialEntryId: entry.id }, include: { financialAccount: true, paymentMethod: true },
    }) : [];
    const employee = statement.employment.employee;
    const employer = {
      unitId: unit.id, unitName: unit.name, legalName: unit.legalName ?? undefined,
      tradeName: unit.tradeName, legalTaxIdType: unit.legalTaxIdType ?? undefined,
      legalTaxId: decryptPersonal(unit.legalTaxIdEncrypted) ?? undefined,
      addressStreet: unit.addressStreet ?? undefined, addressNumber: unit.addressNumber ?? undefined,
      addressComplement: unit.addressComplement, addressNeighborhood: unit.addressNeighborhood ?? undefined,
      addressPostalCode: unit.addressPostalCode ?? undefined, addressCity: unit.addressCity ?? undefined, addressState: unit.addressState ?? undefined,
    };
    const employeeIdentity = {
      employeeId: employee.id, fullName: employee.fullName,
      cpf: decryptPersonal(employee.taxIdentifierEncrypted),
      identityDocument: decryptPersonal(employee.identityDocumentEncrypted),
      socialSecurityNumber: decryptPersonal(employee.socialSecurityEncrypted),
      employmentId: statement.employment.id, employmentCode: statement.employment.code,
      employmentType: statement.employment.type === "EMPLOYEE" ? "EMPLOYEE" as const : undefined,
      jobRole: statement.employment.jobRole.name,
    };
    const foundationErrors = validateSalaryReceiptFoundation({
      employer, employee: employeeIdentity,
      statement: { id: statement.id, unitId: statement.businessUnitId, employmentId: statement.employmentId,
        status: statement.status, periodStatus: statement.payrollPeriod.status,
        netAmount: statement.netAmount.toFixed(2), financialEntryId: statement.financialEntryId },
      employment: { id: statement.employment.id, unitId: statement.employment.businessUnitId,
        employeeId: employee.id, type: statement.employment.type },
      receipt: { unitId: input.businessUnitId, statementId: input.payrollStatementId },
    });
    if (foundationErrors.length || input.paidAmount !== statement.netAmount.toFixed(2)) {
      throw new SalaryPaymentError("INVALID_PAYMENT");
    }

    const paidDate = new Date(`${input.paidAt}T00:00:00.000Z`);
    if (!entry) {
      const preferredCategory = await tx.financialCategory.findFirst({
        where: {
          type: "EXPENSE", status: "ACTIVE",
          OR: [{ businessUnitId: input.businessUnitId }, { businessUnitId: null }],
          AND: [{ OR: [{ code: { endsWith: "_PESSOAL" } }, { name: { contains: "Pessoal", mode: "insensitive" } }] }],
        },
        orderBy: [{ businessUnitId: "desc" }, { name: "asc" }],
      });
      const category = preferredCategory ?? await tx.financialCategory.findFirst({
        where: {
          type: "EXPENSE", status: "ACTIVE",
          OR: [{ businessUnitId: input.businessUnitId }, { businessUnitId: null }],
        },
        orderBy: [{ businessUnitId: "desc" }, { name: "asc" }],
      });
      if (!category) throw new SalaryPaymentError("INVALID_PAYMENT");
      entry = await tx.financialEntry.create({ data: {
        type: "EXPENSE", competence: statement.payrollPeriod.competence, dueDate: paidDate,
        amount: statement.netAmount,
        description: salaryPaymentDescription(employee.fullName, utcDate(statement.payrollPeriod.competence)),
        observation: `Folha ${statement.id}`,
        status: "SETTLED", origin: "INTERNAL_INTEGRATION", sourceSystem: "GESTAO_SV",
        managementNature: "REALIZED", sourceType: "PAYROLL_SALARY_PAYMENT", sourceId: input.idempotencyKey,
        businessUnitId: input.businessUnitId, financialCategoryId: category.id,
        financialAccountId: account.id, paymentMethodId: paymentMethod.id,
      } });
      await tx.payrollStatement.update({
        where: { id_businessUnitId: { id: statement.id, businessUnitId: input.businessUnitId } },
        data: { financialEntryId: entry.id },
      });
    } else if (entry.businessUnitId !== input.businessUnitId || entry.type !== "EXPENSE" ||
      entry.amount.toFixed(2) !== statement.netAmount.toFixed(2) || entry.status === "CANCELLED") {
      throw new SalaryPaymentError("INVALID_PAYMENT");
    }

    if (settlements.length === 0) {
      const createdSettlement = await tx.financialSettlement.create({ data: {
        financialEntryId: entry.id, amount: statement.netAmount, settlementDate: paidDate,
        financialAccountId: account.id, paymentMethodId: paymentMethod.id,
        observation: input.bankReference, idempotencyKey: salarySettlementIdempotencyKey(statement.id, input.idempotencyKey),
      }, include: { financialAccount: true, paymentMethod: true } });
      settlements = [createdSettlement];
      await tx.financialEntry.update({ where: { id: entry.id }, data: {
        status: "SETTLED", managementNature: "REALIZED", dueDate: paidDate,
        financialAccountId: account.id, paymentMethodId: paymentMethod.id,
      } });
    }
    const settlement = settlements.length === 1 ? settlements[0] : null;
    const errors = validateSalaryReceiptCandidate({
      employer, employee: employeeIdentity,
      statement: { id: statement.id, unitId: statement.businessUnitId, employmentId: statement.employmentId,
        status: statement.status, periodStatus: statement.payrollPeriod.status,
        netAmount: statement.netAmount.toFixed(2), financialEntryId: entry.id },
      employment: { id: statement.employment.id, unitId: statement.employment.businessUnitId,
        employeeId: employee.id, type: statement.employment.type },
      receipt: { unitId: input.businessUnitId, statementId: input.payrollStatementId },
      payment: { financialEntryId: entry?.id ?? "", financialEntryUnitId: entry?.businessUnitId ?? "",
        financialEntryType: entry?.type ?? "", financialEntryStatus: entry?.status ?? "",
        financialEntryAmount: entry.amount.toFixed(2), financialSettlementId: settlement?.id ?? "",
        settlementEntryId: settlement?.financialEntryId ?? "", settlementCount: settlements.length,
        settlementAmount: settlement?.amount.toFixed(2) ?? "", settlementDate: settlement ? utcDate(settlement.settlementDate) : "",
        paidAt: input.paidAt, method: input.method, paidAmount: input.paidAmount,
        bankReference: input.bankReference, bankProofStorageKey: proof ? "postgresql-private" : null,
        bankProofSha256: proof?.sha256 ?? null },
    });
    if (errors.length) throw new SalaryPaymentError("INVALID_PAYMENT");
    if (!settlement || settlement.financialAccount.businessUnitId !== input.businessUnitId ||
      settlement.financialAccountId !== account.id || settlement.paymentMethodId !== paymentMethod.id ||
      String(settlement.paymentMethod.type) !== input.method ||
      (input.method === "CASH" && settlement.financialAccount.type !== "CASH") ||
      (input.method !== "CASH" && settlement.financialAccount.type !== "BANK" && settlement.financialAccount.type !== "DIGITAL_WALLET") ||
      (input.method === "BANK_DEPOSIT" && settlement.financialAccount.type !== "BANK")) {
      throw new SalaryPaymentError("INVALID_PAYMENT");
    }

    const issuer = await tx.user.findUnique({ where: { id: input.actorUserId }, select: { id: true, fullName: true, status: true } });
    if (!issuer || issuer.status !== "ACTIVE") throw new SalaryPaymentError("FORBIDDEN");
    const receiptId = randomUUID();
    const confirmationId = randomUUID();
    const evidenceId = proof ? randomUUID() : null;
    const issuedAt = new Date();
    const version = Math.max(0, ...statement.receipts.map((item) => item.version)) + 1;
    const receiptNumber = `SAL-${utcDate(statement.payrollPeriod.competence).replace(/-/gu, "")}-${receiptId.slice(0, 8)}`;
    const lineItems = [
      ...statement.lineItems.map((item) => ({ code: item.code, description: item.description,
        type: item.type, origin: item.origin, quantity: item.quantity?.toFixed(4) ?? null,
        unitAmount: item.unitAmount?.toFixed(4) ?? null, amount: item.amount.toFixed(2), affectsNet: item.affectsNet })),
      ...statement.appliedAdjustments.filter((item) => item.status === "APPLIED").map((item) => ({
        code: `AJUSTE_${item.id}`, description: item.reason,
        type: item.type === "CREDIT" ? "ADJUSTMENT_CREDIT" as const : "ADJUSTMENT_DEBIT" as const,
        origin: "ADJUSTMENT" as const, quantity: null, unitAmount: null,
        amount: item.amount.toFixed(2), affectsNet: true,
      })),
    ];
    const base = lineItems.find((item) => item.code === "SALARIO_BASE" && item.type === "EARNING");
    const snapshot = createImmutableSalarySnapshot({
      schemaVersion: 1,
      receipt: { id: receiptId, number: receiptNumber, version, issuedAt: issuedAt.toISOString() },
      employer, employee: employeeIdentity,
      statement: { id: statement.id, unitId: statement.businessUnitId,
        employmentId: statement.employmentId, competence: utcDate(statement.payrollPeriod.competence),
        calculationVersion: statement.calculationVersion },
      lineItems,
      totals: { salaryBase: base?.amount ?? "", gross: statement.grossAmount.toFixed(2),
        benefits: statement.benefitAmount.toFixed(2), deductions: statement.deductionAmount.toFixed(2),
        adjustments: statement.adjustmentAmount.toFixed(2), net: statement.netAmount.toFixed(2) },
      payment: { confirmationId, financialEntryId: entry.id, financialSettlementId: settlement.id,
        paidAt: input.paidAt, method: input.method, paidAmount: input.paidAmount,
        bankReference: input.bankReference, evidenceId, bankProofSha256: proof?.sha256 ?? null },
      issuer: { userId: issuer.id, fullName: issuer.fullName },
    });
    const canonical = canonicalSalaryJson(snapshot);
    const snapshotHash = canonicalSnapshotSha256(snapshot);
    const ciphertext = encryptSnapshot(canonical);

    await tx.$executeRaw`
      INSERT INTO "PayrollSalaryPaymentConfirmation"
        ("id", "idempotencyKey", "requestSha256", "businessUnitId", "payrollStatementId", "financialEntryId",
         "financialSettlementId", "paidAt", "method", "paidAmount", "bankReference", "confirmedByUserId")
      VALUES (${confirmationId}::uuid, ${input.idempotencyKey}, ${fingerprint}, ${input.businessUnitId}::uuid,
        ${statement.id}::uuid, ${entry.id}::uuid, ${settlement.id}::uuid, ${input.paidAt}::date,
        ${input.method}::"PayrollSalaryPaymentMethod", ${input.paidAmount}::decimal, ${input.bankReference}, ${issuer.id}::uuid)`;
    await tx.$executeRaw`
      INSERT INTO "PayrollReceipt" ("id", "businessUnitId", "payrollStatementId", "receiptNumber", "version",
        "status", "kind", "paymentConfirmationId", "documentHash", "issuedAt", "issuedByUserId", "createdByUserId", "updatedAt")
      VALUES (${receiptId}::uuid, ${input.businessUnitId}::uuid, ${statement.id}::uuid, ${receiptNumber}, ${version},
        'ISSUED'::"ReceiptStatus", 'SALARY_RECEIPT'::"PayrollDocumentKind", ${confirmationId}::uuid,
        ${snapshotHash}, ${issuedAt}, ${issuer.id}::uuid, ${issuer.id}::uuid, ${issuedAt})`;
    await tx.$executeRaw`
      INSERT INTO "PayrollReceiptSnapshot" ("receiptId", "schemaVersion", "payloadCiphertext", "encryptionVersion", "payloadSha256")
      VALUES (${receiptId}::uuid, 1, ${ciphertext}, 1, ${snapshotHash})`;
    if (proof && evidenceId) {
      await tx.$executeRaw`
        INSERT INTO "PayrollReceiptEvidence" ("id", "receiptId", "businessUnitId", "payrollStatementId", "employeeId",
          "kind", "storageKey", "originalFileName", "mimeType", "byteLength", "sha256", "recordedByUserId")
        VALUES (${evidenceId}::uuid, ${receiptId}::uuid, ${input.businessUnitId}::uuid,
          ${statement.id}::uuid, ${employee.id}::uuid, 'BANK_PROOF'::"PayrollReceiptEvidenceKind",
          ${randomUUID()}, ${proof.originalFileName}, ${proof.mimeType}, ${proof.byteLength}, ${proof.sha256}, ${issuer.id}::uuid)`;
      await tx.$executeRaw`INSERT INTO "PayrollPaymentEvidenceBlob" ("evidenceId", "content") VALUES (${evidenceId}::uuid, ${proof.bytes})`;
    }
    return { receiptId, evidenceId, state: input.method === "CASH" ? "CASH_AWAITING_SIGNATURE"
      : proof ? "BANK_PROVEN" : "PAYMENT_CONFIRMED", repeated: false } as ConfirmSalaryPaymentResult;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || (error.code === "P2010" && error.meta?.code === "23505"))) {
        throw new SalaryPaymentError("DUPLICATE");
      }
      throw error;
    }
  }
  throw new SalaryPaymentError("DUPLICATE");
}

type SalaryReversalRow = {
  reversalId: string; requestSha256: string; idempotencyKey: string; receiptId: string;
  financialEntryId: string; financialSettlementId: string; reversedAt: Date;
};

type ReversibleSalaryPaymentRow = {
  receiptId: string; receiptStatus: string; receiptKind: string; businessUnitId: string;
  payrollStatementId: string; statementStatus: string; statementFinancialEntryId: string | null;
  confirmationId: string; financialEntryId: string; financialEntryStatus: string;
  financialSettlementId: string; settlementEntryId: string; paidAmount: Prisma.Decimal;
  entryAmount: Prisma.Decimal; settlementAmount: Prisma.Decimal;
};

export async function reverseSalaryPayment(input: ReverseSalaryPaymentInput): Promise<ReverseSalaryPaymentResult> {
  if (input.actorUserId !== BUILT_IN_IDS.users.sauloXavierVitorino) throw new SalaryPaymentError("FORBIDDEN");
  const reason = input.reason.trim();
  if (reason.length < 10 || reason.length > 500 || /[\u0000-\u001f\u007f]/u.test(reason)) {
    throw new SalaryPaymentError("INVALID_PAYMENT");
  }
  const requestSha256 = canonicalSnapshotSha256({
    businessUnitId: input.businessUnitId, receiptId: input.receiptId,
    idempotencyKey: input.idempotencyKey, reason, actorUserId: input.actorUserId,
  });
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.receiptId}, 0))::text AS "lock"`;
    const previous = await tx.$queryRaw<SalaryReversalRow[]>`
      SELECT r."id" AS "reversalId", r."requestSha256", r."idempotencyKey", r."receiptId",
        r."originalFinancialEntryId" AS "financialEntryId", r."originalSettlementId" AS "financialSettlementId",
        r."reversedAt"
      FROM "PayrollSalaryPaymentReversal" r
      WHERE r."receiptId" = ${input.receiptId}::uuid`;
    if (previous[0]) {
      if (previous[0].idempotencyKey !== input.idempotencyKey || previous[0].requestSha256 !== requestSha256) {
        throw new SalaryPaymentError("ALREADY_REVERSED");
      }
      return { reversalId: previous[0].reversalId, receiptId: previous[0].receiptId,
        financialEntryId: previous[0].financialEntryId, financialSettlementId: previous[0].financialSettlementId,
        reversedAt: previous[0].reversedAt.toISOString(), repeated: true };
    }
    const rows = await tx.$queryRaw<ReversibleSalaryPaymentRow[]>`
      SELECT r."id" AS "receiptId", r."status"::text AS "receiptStatus", r."kind"::text AS "receiptKind",
        r."businessUnitId", r."payrollStatementId", s."status"::text AS "statementStatus",
        s."financialEntryId" AS "statementFinancialEntryId", c."id" AS "confirmationId",
        c."financialEntryId", e."status"::text AS "financialEntryStatus",
        c."financialSettlementId", fs."financialEntryId" AS "settlementEntryId",
        c."paidAmount", e."amount" AS "entryAmount", fs."amount" AS "settlementAmount"
      FROM "PayrollReceipt" r
      JOIN "PayrollSalaryPaymentConfirmation" c ON c."id" = r."paymentConfirmationId"
      JOIN "PayrollStatement" s ON s."id" = r."payrollStatementId" AND s."businessUnitId" = r."businessUnitId"
      JOIN "FinancialEntry" e ON e."id" = c."financialEntryId" AND e."businessUnitId" = r."businessUnitId"
      JOIN "FinancialSettlement" fs ON fs."id" = c."financialSettlementId" AND fs."financialEntryId" = e."id"
      WHERE r."id" = ${input.receiptId}::uuid AND r."businessUnitId" = ${input.businessUnitId}::uuid
      FOR UPDATE OF r, s, e`;
    const row = rows[0];
    if (!row) throw new SalaryPaymentError("NOT_FOUND");
    if (row.receiptStatus !== "ISSUED" || row.receiptKind !== "SALARY_RECEIPT" ||
      row.statementStatus !== "CLOSED" || row.financialEntryStatus !== "SETTLED" ||
      row.financialEntryId !== row.settlementEntryId || row.statementFinancialEntryId !== row.financialEntryId ||
      row.paidAmount.toFixed(2) !== row.entryAmount.toFixed(2) || row.paidAmount.toFixed(2) !== row.settlementAmount.toFixed(2)) {
      throw new SalaryPaymentError("INVALID_PAYMENT");
    }
    const actor = await tx.user.findUnique({ where: { id: input.actorUserId }, select: { status: true } });
    if (!actor || actor.status !== "ACTIVE") throw new SalaryPaymentError("FORBIDDEN");
    const reversalId = randomUUID();
    const reversedAt = new Date();
    await tx.$executeRaw`
      INSERT INTO "PayrollSalaryPaymentReversal"
        ("id", "idempotencyKey", "requestSha256", "businessUnitId", "payrollStatementId",
         "paymentConfirmationId", "receiptId", "originalFinancialEntryId", "originalSettlementId",
         "reason", "reversedAt", "reversedByUserId")
      VALUES (${reversalId}::uuid, ${input.idempotencyKey}, ${requestSha256}, ${input.businessUnitId}::uuid,
        ${row.payrollStatementId}::uuid, ${row.confirmationId}::uuid, ${row.receiptId}::uuid,
        ${row.financialEntryId}::uuid, ${row.financialSettlementId}::uuid, ${reason}, ${reversedAt},
        ${input.actorUserId}::uuid)`;
    await tx.payrollReceipt.update({ where: { id: row.receiptId }, data: {
      status: "VOIDED", voidedAt: reversedAt, voidedByUserId: input.actorUserId, voidReason: reason,
    } });
    await tx.financialEntry.update({ where: { id: row.financialEntryId }, data: { status: "CANCELLED" } });
    await tx.payrollStatement.update({
      where: { id_businessUnitId: { id: row.payrollStatementId, businessUnitId: input.businessUnitId } },
      data: { financialEntryId: null, updatedByUserId: input.actorUserId },
    });
    return { reversalId, receiptId: row.receiptId, financialEntryId: row.financialEntryId,
      financialSettlementId: row.financialSettlementId, reversedAt: reversedAt.toISOString(), repeated: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
