import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";

import { readSalaryReceiptSnapshot, SalaryPaymentError } from "../payroll/salary-payment-backend";
import { classifyPayrollDocument, type PayrollDocumentState, type SalaryPaymentMethod } from "../payroll/salary-receipt-contracts";

const PAGE_SIZE = 20;
export type ManagementDocumentKind = "DEMONSTRATIVE" | "LEGACY_DEMONSTRATIVE" | "SALARY_RECEIPT";

export interface ManagementReceiptFilters {
  readonly businessUnitId?: string;
  readonly employee?: string;
  readonly competence?: Date;
  readonly receiptNumber?: string;
  readonly state?: PayrollDocumentState;
  readonly page: number;
}

export interface ManagementReceiptItem {
  readonly id: string;
  readonly documentKind: ManagementDocumentKind;
  readonly documentState: PayrollDocumentState;
  readonly businessUnitId: string;
  readonly businessUnitName: string;
  readonly payrollStatementId: string;
  readonly employmentId: string;
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employmentCode: string;
  readonly documentNumber: string;
  readonly version: number;
  readonly competence: Date;
  readonly issuedAt: Date;
  readonly issuerName?: string;
}

export interface ManagementReceiptPage {
  readonly items: readonly ManagementReceiptItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface ManagementDocumentLineItem {
  readonly code: string;
  readonly description: string;
  readonly type: "EARNING" | "BENEFIT" | "DEDUCTION" | "ADJUSTMENT_CREDIT" | "ADJUSTMENT_DEBIT";
  readonly amount: string;
}

interface ManagementDocumentBase extends ManagementReceiptItem {
  readonly jobRole: string;
  readonly employmentType: string;
  readonly lineItems: readonly ManagementDocumentLineItem[];
  readonly totals: { readonly gross: string; readonly benefits: string; readonly deductions: string; readonly adjustments: string; readonly net: string };
}

export interface ManagementDemonstrativeDocument extends ManagementDocumentBase {
  readonly documentKind: "DEMONSTRATIVE" | "LEGACY_DEMONSTRATIVE";
}

export interface ManagementSalaryReceiptDocument extends ManagementDocumentBase {
  readonly documentKind: "SALARY_RECEIPT";
  readonly employer: {
    readonly unitName: string; readonly legalName: string; readonly tradeName: string | null;
    readonly legalTaxIdType: "CPF" | "CNPJ"; readonly maskedLegalTaxId: string; readonly address: string;
  };
  readonly employee: {
    readonly fullName: string; readonly maskedCpf: string | null; readonly maskedIdentityDocument: string | null;
    readonly maskedSocialSecurityNumber: string | null; readonly employmentCode: string;
    readonly employmentType: string; readonly jobRole: string;
  };
  readonly payment: {
    readonly paidAt: string; readonly method: SalaryPaymentMethod; readonly amount: string;
    readonly bankReference: string | null; readonly proofUrl: string | null;
  };
  readonly voiding?: { readonly reason: string; readonly at: Date; readonly by: string } | null;
}

export type ManagementReceiptDocument = ManagementDemonstrativeDocument | ManagementSalaryReceiptDocument;
export interface ManagementReceiptIdentity {
  readonly receiptId: string; readonly businessUnitId: string; readonly payrollStatementId: string;
  readonly employmentId: string; readonly employeeId: string;
}

const receiptSelect = {
  id: true, businessUnitId: true, payrollStatementId: true, receiptNumber: true, version: true,
  status: true, issuedAt: true, voidedAt: true, voidReason: true, voidedBy: { select: { fullName: true } }, issuedBy: { select: { fullName: true } },
  businessUnit: { select: { name: true } },
  payrollStatement: { select: {
    id: true, businessUnitId: true, employmentId: true, status: true,
    grossAmount: true, benefitAmount: true, deductionAmount: true, adjustmentAmount: true, netAmount: true,
    lineItems: { orderBy: [{ type: "asc" as const }, { code: "asc" as const }], select: { code: true, description: true, type: true, amount: true } },
    appliedAdjustments: { where: { status: "APPLIED" as const }, orderBy: { createdAt: "asc" as const }, select: { id: true, type: true, amount: true, reason: true } },
    payrollPeriod: { select: { businessUnitId: true, competence: true } },
    employment: { select: {
      id: true, businessUnitId: true, employeeId: true, code: true, type: true,
      employee: { select: { id: true, fullName: true } }, jobRole: { select: { name: true } },
    } },
  } },
} satisfies Prisma.PayrollReceiptSelect;

const statementSelect = {
  id: true, businessUnitId: true, status: true, closedAt: true, closedBy: { select: { fullName: true } },
  grossAmount: true, benefitAmount: true, deductionAmount: true, adjustmentAmount: true, netAmount: true,
  calculationVersion: true, businessUnit: { select: { name: true } },
  payrollPeriod: { select: { businessUnitId: true, competence: true } },
  employment: { select: {
    id: true, businessUnitId: true, employeeId: true, code: true, type: true,
    employee: { select: { id: true, fullName: true } }, jobRole: { select: { name: true } },
  } },
  lineItems: { orderBy: [{ type: "asc" as const }, { code: "asc" as const }], select: { code: true, description: true, type: true, amount: true } },
  appliedAdjustments: { where: { status: "APPLIED" as const }, orderBy: { createdAt: "asc" as const }, select: { id: true, type: true, amount: true, reason: true } },
  receipts: { where: { status: "ISSUED" as const }, select: { id: true } },
} satisfies Prisma.PayrollStatementSelect;

type ReceiptRow = Prisma.PayrollReceiptGetPayload<{ select: typeof receiptSelect }>;
type StatementRow = Prisma.PayrollStatementGetPayload<{ select: typeof statementSelect }>;
type ReceiptMetadata = {
  receiptId: string; kind: "LEGACY_DEMONSTRATIVE" | "SALARY_RECEIPT"; paymentConfirmed: boolean;
  snapshotPresent: boolean; method: SalaryPaymentMethod | null; bankProofId: string | null;
  signedCopyId: string | null; payloadCiphertext: Uint8Array | null; payloadSha256: string | null;
};

function validReceiptRelations(row: ReceiptRow) {
  const statement = row.payrollStatement;
  const employment = statement.employment;
  return (row.status === "ISSUED" || row.status === "VOIDED") && row.issuedAt !== null && statement.status === "CLOSED"
    && statement.businessUnitId === row.businessUnitId && statement.payrollPeriod.businessUnitId === row.businessUnitId
    && employment.businessUnitId === row.businessUnitId && employment.employeeId === employment.employee.id;
}

function validStatementRelations(row: StatementRow) {
  return row.status === "CLOSED" && row.closedAt !== null && row.payrollPeriod.businessUnitId === row.businessUnitId
    && row.employment.businessUnitId === row.businessUnitId && row.employment.employeeId === row.employment.employee.id;
}

function stateOf(metadata: ReceiptMetadata, voided = false): PayrollDocumentState {
  return classifyPayrollDocument({ kind: metadata.kind, paymentConfirmed: metadata.paymentConfirmed,
    snapshotPresent: metadata.snapshotPresent, method: metadata.method,
    bankProofPresent: metadata.bankProofId !== null, signedCopyPresent: metadata.signedCopyId !== null, voided });
}

function receiptItem(row: ReceiptRow, metadata: ReceiptMetadata): ManagementReceiptItem {
  return { id: row.id, documentKind: metadata.kind, documentState: stateOf(metadata, row.status === "VOIDED"),
    businessUnitId: row.businessUnitId, businessUnitName: row.businessUnit.name,
    payrollStatementId: row.payrollStatementId, employmentId: row.payrollStatement.employmentId,
    employeeId: row.payrollStatement.employment.employeeId, employeeName: row.payrollStatement.employment.employee.fullName,
    employmentCode: row.payrollStatement.employment.code, documentNumber: row.receiptNumber, version: row.version,
    competence: row.payrollStatement.payrollPeriod.competence, issuedAt: row.issuedAt!,
    issuerName: row.issuedBy?.fullName ?? undefined };
}

function demonstrativeNumber(row: StatementRow) {
  return `DEM-${row.payrollPeriod.competence.toISOString().slice(0, 7).replace("-", "")}-${row.employment.code}`;
}

function statementItem(row: StatementRow): ManagementReceiptItem {
  return { id: row.id, documentKind: "DEMONSTRATIVE", documentState: "DEMONSTRATIVE_AVAILABLE",
    businessUnitId: row.businessUnitId, businessUnitName: row.businessUnit.name, payrollStatementId: row.id,
    employmentId: row.employment.id, employeeId: row.employment.employeeId, employeeName: row.employment.employee.fullName,
    employmentCode: row.employment.code, documentNumber: demonstrativeNumber(row), version: row.calculationVersion,
    competence: row.payrollPeriod.competence, issuedAt: row.closedAt!, issuerName: row.closedBy?.fullName ?? undefined };
}

type LiveValues = Pick<ReceiptRow["payrollStatement"], "lineItems" | "appliedAdjustments" | "grossAmount" | "benefitAmount" | "deductionAmount" | "adjustmentAmount" | "netAmount">;
function liveLineItems(row: Pick<LiveValues, "lineItems" | "appliedAdjustments">): readonly ManagementDocumentLineItem[] {
  return [...row.lineItems.map((item) => ({ code: item.code, description: item.description, type: item.type, amount: item.amount.toFixed(2) })),
    ...row.appliedAdjustments.map((item) => ({ code: `AJUSTE-${item.id.slice(0, 8)}`, description: item.reason,
      type: item.type === "CREDIT" ? "ADJUSTMENT_CREDIT" as const : "ADJUSTMENT_DEBIT" as const, amount: item.amount.toFixed(2) }))];
}
function liveTotals(row: LiveValues) {
  return { gross: row.grossAmount.toFixed(2), benefits: row.benefitAmount.toFixed(2), deductions: row.deductionAmount.toFixed(2),
    adjustments: row.adjustmentAmount.toFixed(2), net: row.netAmount.toFixed(2) };
}
function maskCpf(value: string): string;
function maskCpf(value: null): null;
function maskCpf(value: string | null): string | null;
function maskCpf(value: string | null) { return value ? `***.***.***-${value.slice(-2)}` : null; }
function maskDocument(value: string | null | undefined) { return value ? `••••${value.slice(-4)}` : null; }
function maskTaxId(value: string, type: "CPF" | "CNPJ") { return type === "CPF" ? maskCpf(value) : `**.***.***/****-${value.slice(-2)}`; }
function snapshotAddress(employer: { addressStreet: string; addressNumber: string; addressComplement: string | null; addressNeighborhood: string; addressPostalCode: string; addressCity: string; addressState: string }) {
  return [`${employer.addressStreet}, ${employer.addressNumber}`, employer.addressComplement, employer.addressNeighborhood,
    `${employer.addressCity}/${employer.addressState}`, employer.addressPostalCode.replace(/^(\d{5})(\d{3})$/u, "$1-$2")].filter(Boolean).join(" · ");
}

async function receiptMetadata(ids: readonly string[]): Promise<Map<string, ReceiptMetadata>> {
  if (!ids.length) return new Map();
  const uuidList = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
  const rows = await prisma.$queryRaw<ReceiptMetadata[]>(Prisma.sql`
    SELECT r."id" AS "receiptId", r."kind", (r."paymentConfirmationId" IS NOT NULL) AS "paymentConfirmed",
      (s."receiptId" IS NOT NULL) AS "snapshotPresent", c."method", bank."id" AS "bankProofId",
      signed."id" AS "signedCopyId", s."payloadCiphertext", s."payloadSha256"
    FROM "PayrollReceipt" r
    LEFT JOIN "PayrollSalaryPaymentConfirmation" c ON c."id" = r."paymentConfirmationId"
    LEFT JOIN "PayrollReceiptSnapshot" s ON s."receiptId" = r."id"
    LEFT JOIN LATERAL (SELECT e."id" FROM "PayrollReceiptEvidence" e WHERE e."receiptId" = r."id" AND e."kind" = 'BANK_PROOF'::"PayrollReceiptEvidenceKind" ORDER BY e."recordedAt" DESC LIMIT 1) bank ON TRUE
    LEFT JOIN LATERAL (SELECT e."id" FROM "PayrollReceiptEvidence" e WHERE e."receiptId" = r."id" AND e."kind" = 'SIGNED_COPY'::"PayrollReceiptEvidenceKind" ORDER BY e."recordedAt" DESC LIMIT 1) signed ON TRUE
    WHERE r."id" IN (${uuidList})`);
  return new Map(rows.map((row) => [row.receiptId, row]));
}

function commonWhere(filters: ManagementReceiptFilters) {
  const employee = filters.employee?.trim().slice(0, 180);
  const next = filters.competence ? new Date(Date.UTC(filters.competence.getUTCFullYear(), filters.competence.getUTCMonth() + 1, 1)) : undefined;
  return { businessUnitId: filters.businessUnitId,
    payrollPeriod: { is: { businessUnitId: filters.businessUnitId,
      competence: filters.competence && next ? { gte: filters.competence, lt: next } : undefined } },
    employment: { is: { businessUnitId: filters.businessUnitId, ...(employee ? { OR: [
      { code: { contains: employee, mode: "insensitive" as const } },
      { employee: { is: { fullName: { contains: employee, mode: "insensitive" as const } } } },
    ] } : {}) } } };
}

export const managementDocumentsRepository = {
  async listUnits() {
    return prisma.businessUnit.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  },

  async list(filters: ManagementReceiptFilters): Promise<ManagementReceiptPage> {
    const page = Number.isSafeInteger(filters.page) && filters.page > 0 ? filters.page : 1;
    const shared = commonWhere(filters);
    const [receipts, statements] = await Promise.all([
      prisma.payrollReceipt.findMany({ where: { status: { in: ["ISSUED", "VOIDED"] }, issuedAt: { not: null }, businessUnitId: filters.businessUnitId,
        payrollStatement: { is: { status: "CLOSED", ...shared } } }, select: receiptSelect }),
      prisma.payrollStatement.findMany({ where: { status: "CLOSED", closedAt: { not: null }, ...shared,
        receipts: { none: { status: "ISSUED" } } }, select: statementSelect }),
    ]);
    const metadata = await receiptMetadata(receipts.map((row) => row.id));
    const receiptItems = receipts.flatMap((row) => {
      const meta = metadata.get(row.id);
      return meta && validReceiptRelations(row) ? [receiptItem(row, meta)] : [];
    });
    const number = filters.receiptNumber?.trim().toLocaleLowerCase("pt-BR");
    const combined = [...receiptItems, ...statements.filter(validStatementRelations).map(statementItem)]
      .filter((item) => !filters.state || item.documentState === filters.state)
      .filter((item) => !number || item.documentNumber.toLocaleLowerCase("pt-BR").includes(number))
      .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime() || a.id.localeCompare(b.id));
    return { items: combined.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: combined.length, page,
      pageSize: PAGE_SIZE, totalPages: Math.ceil(combined.length / PAGE_SIZE) };
  },

  async findByReceiptId(receiptId: string): Promise<ManagementReceiptDocument | null> {
    const row = await prisma.payrollReceipt.findFirst({ where: { id: receiptId, status: { in: ["ISSUED", "VOIDED"] }, issuedAt: { not: null },
      payrollStatement: { is: { status: "CLOSED" } } }, select: receiptSelect });
    if (!row || !validReceiptRelations(row)) return null;
    const metadata = (await receiptMetadata([row.id])).get(row.id);
    if (!metadata) return null;
    const item = receiptItem(row, metadata);
    if (metadata.kind === "LEGACY_DEMONSTRATIVE") return { ...item, documentKind: "LEGACY_DEMONSTRATIVE",
      jobRole: row.payrollStatement.employment.jobRole.name, employmentType: row.payrollStatement.employment.type,
      lineItems: liveLineItems(row.payrollStatement), totals: liveTotals(row.payrollStatement) };
    if (!metadata.payloadCiphertext || !metadata.payloadSha256) return null;
    let snapshot;
    try { snapshot = readSalaryReceiptSnapshot(metadata.payloadCiphertext, metadata.payloadSha256); }
    catch (error) { if (error instanceof SalaryPaymentError) return null; throw error; }
    if (snapshot.receipt.id !== row.id || snapshot.receipt.number !== row.receiptNumber || snapshot.receipt.version !== row.version
      || snapshot.statement.id !== row.payrollStatementId || snapshot.statement.unitId !== row.businessUnitId
      || snapshot.employee.employmentId !== row.payrollStatement.employmentId
      || snapshot.employee.employeeId !== row.payrollStatement.employment.employeeId) return null;
    return { ...item, documentKind: "SALARY_RECEIPT", employeeName: snapshot.employee.fullName,
      employmentCode: snapshot.employee.employmentCode, businessUnitName: snapshot.employer.unitName,
      competence: new Date(`${snapshot.statement.competence}T00:00:00.000Z`), issuedAt: new Date(snapshot.receipt.issuedAt),
      issuerName: snapshot.issuer.fullName, jobRole: snapshot.employee.jobRole, employmentType: snapshot.employee.employmentType,
      lineItems: snapshot.lineItems.map((line) => ({ code: line.code, description: line.description, type: line.type, amount: line.amount })),
      totals: snapshot.totals,
      employer: { unitName: snapshot.employer.unitName, legalName: snapshot.employer.legalName,
        tradeName: snapshot.employer.tradeName, legalTaxIdType: snapshot.employer.legalTaxIdType,
        maskedLegalTaxId: maskTaxId(snapshot.employer.legalTaxId, snapshot.employer.legalTaxIdType), address: snapshotAddress(snapshot.employer) },
      employee: { fullName: snapshot.employee.fullName, maskedCpf: maskCpf(snapshot.employee.cpf),
        maskedIdentityDocument: maskDocument(snapshot.employee.identityDocument),
        maskedSocialSecurityNumber: maskDocument(snapshot.employee.socialSecurityNumber),
        employmentCode: snapshot.employee.employmentCode, employmentType: snapshot.employee.employmentType, jobRole: snapshot.employee.jobRole },
      payment: { paidAt: snapshot.payment.paidAt, method: snapshot.payment.method, amount: snapshot.payment.paidAmount,
        bankReference: snapshot.payment.bankReference,
        proofUrl: snapshot.payment.evidenceId && metadata.bankProofId === snapshot.payment.evidenceId
          ? `/api/gestao/folha-pagamento/recibos-salariais/${encodeURIComponent(row.id)}/comprovantes/${encodeURIComponent(snapshot.payment.evidenceId)}` : null },
      voiding: row.status === "VOIDED" && row.voidedAt && row.voidReason
        ? { reason: row.voidReason, at: row.voidedAt, by: row.voidedBy?.fullName ?? "Usuário não identificado" } : null };
  },

  async findExact(identity: ManagementReceiptIdentity): Promise<ManagementReceiptDocument | null> {
    const doc = await this.findByReceiptId(identity.receiptId);
    return doc && doc.businessUnitId === identity.businessUnitId && doc.payrollStatementId === identity.payrollStatementId
      && doc.employmentId === identity.employmentId && doc.employeeId === identity.employeeId ? doc : null;
  },

  async findDemonstrative(statementId: string): Promise<ManagementDemonstrativeDocument | null> {
    const row = await prisma.payrollStatement.findFirst({ where: { id: statementId, status: "CLOSED", closedAt: { not: null },
      receipts: { none: { status: "ISSUED" } } }, select: statementSelect });
    if (!row || !validStatementRelations(row)) return null;
    return { ...statementItem(row), documentKind: "DEMONSTRATIVE", jobRole: row.employment.jobRole.name,
      employmentType: row.employment.type, lineItems: liveLineItems(row), totals: liveTotals(row) };
  },
};
