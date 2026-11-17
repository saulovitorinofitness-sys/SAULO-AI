import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { BUILT_IN_IDS } from "@/modules/permissions";

import type {
  ServiceReceiptAuthorizationContext,
  ServiceReceiptChargeStatus,
  ServiceReceiptCommercialUnit,
  ServiceReceiptKind,
  ServiceReceiptPaymentMethod,
  ServiceReceiptProviderKey,
} from "./contracts";
import { buildProfessionalServiceFinancialEntryDescription } from "./financial-entry-description";

const providerUserId = {
  SAULO_XAVIER_VITORINO: BUILT_IN_IDS.users.sauloXavierVitorino,
  MARIA_DE_LOURDES_GOMES: BUILT_IN_IDS.users.mariaDeLourdesGomes,
} as const;

export type ProfessionalServiceReceiptRepositoryErrorCode =
  | "NOT_FOUND"
  | "INACTIVE_REFERENCE"
  | "IDEMPOTENCY_CONFLICT"
  | "PERSISTENCE_CONFLICT";

export class ProfessionalServiceReceiptRepositoryError extends Error {
  constructor(
    readonly code: ProfessionalServiceReceiptRepositoryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProfessionalServiceReceiptRepositoryError";
  }
}

export interface LegalProviderReference {
  readonly id: string;
  readonly key: ServiceReceiptProviderKey;
}

export interface PersistedChargeItem {
  readonly id: string;
  readonly serviceReferenceId: string;
  readonly kind: ServiceReceiptKind;
  readonly grossAmount: string;
}

export interface PersistedCharge {
  readonly id: string;
  readonly provider: LegalProviderReference;
  readonly masterRecordId: string;
  readonly status: ServiceReceiptChargeStatus;
  readonly subtotal: string;
  readonly discount: string;
  readonly surcharge: string;
  readonly amountDue: string;
  readonly previouslyReceivedAmount: string;
  readonly items: readonly PersistedChargeItem[];
  readonly authorization: ServiceReceiptAuthorizationContext;
}

export interface PersistedPayment {
  readonly id: string;
  readonly chargeId: string;
  readonly provider: LegalProviderReference;
  readonly receivedAmount: string;
  readonly idempotencyKey: string;
  readonly requestSha256: string;
  readonly replayed: boolean;
}

export interface PersistedReceipt {
  readonly id: string;
  readonly paymentId: string;
  readonly provider: LegalProviderReference;
  readonly status: "ISSUED" | "CANCELLED" | "REFUNDED";
  readonly series: string;
  readonly sequence: number;
  readonly idempotencyKey: string;
  readonly requestSha256: string;
  readonly replayed: boolean;
}

export interface PersistedReceiptDetails {
  readonly receipt: PersistedReceipt;
  readonly charge: PersistedCharge;
  readonly receivedAmount: string;
  readonly remainingBalance: string;
  readonly partialPayment: boolean;
  readonly snapshot: {
    readonly schemaVersion: number;
    readonly encryptionVersion: number;
    readonly payloadSha256: string;
    readonly createdAt: Date;
  };
  readonly events: readonly {
    readonly type: "DRAFT_CREATED" | "ISSUED" | "CORRECTION_ISSUED" | "CANCELLED" | "REFUNDED";
    readonly fromStatus: "DRAFT" | "ISSUED" | "CANCELLED" | "REFUNDED" | null;
    readonly toStatus: "DRAFT" | "ISSUED" | "CANCELLED" | "REFUNDED";
    readonly reason: string | null;
    readonly occurredAt: Date;
  }[];
}

export interface PrivatePaymentProof {
  readonly receiptId: string;
  readonly charge: PersistedCharge;
  readonly mimeType: "application/pdf" | "image/jpeg" | "image/png";
  readonly byteLength: number;
  readonly sha256: string;
  readonly bytes: Uint8Array;
}

export type ProfessionalReceiptListStatus =
  | "DRAFT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "ISSUED"
  | "CANCELLED"
  | "REFUNDED";

export interface ProfessionalReceiptListFilters {
  readonly query?: string;
  readonly periodStart?: Date;
  readonly periodEndExclusive?: Date;
  readonly providerKey?: ServiceReceiptProviderKey;
  readonly status?: ProfessionalReceiptListStatus;
  readonly page: number;
  readonly pageSize: number;
  readonly visibility: "ALL" | "MARIA_PHYSICAL_EDUCATION";
}

export interface ProfessionalReceiptListItem {
  readonly id: string;
  readonly receiptId: string | null;
  readonly customerName: string;
  readonly customerCode: string;
  readonly providerKey: ServiceReceiptProviderKey;
  readonly status: ProfessionalReceiptListStatus;
  readonly amount: string;
  readonly receivedAmount: string;
  readonly createdAt: Date;
  readonly series: string | null;
  readonly sequence: number | null;
  readonly paymentCount: number;
}

export interface ChargeManagementResult {
  readonly id: string;
  readonly status: "DELETED" | "CANCELLED";
  readonly replayed: boolean;
}

export interface CancelPaidChargePersistenceInput {
  readonly chargeId: string;
  readonly actorUserId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly requestSha256: string;
}

export interface ProfessionalReceiptListPage {
  readonly items: readonly ProfessionalReceiptListItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly indicators: {
    readonly receivedAmount: string;
    readonly pending: number;
    readonly partial: number;
    readonly cancelled: number;
    readonly refunded: number;
  };
}

export interface RegisterChargePersistenceInput {
  readonly provider: LegalProviderReference;
  readonly masterRecordId: string;
  readonly financialEntryId?: string | null;
  readonly subtotal: string;
  readonly discount: string;
  readonly surcharge: string;
  readonly amountDue: string;
  readonly actorUserId: string;
  readonly items: readonly {
    readonly id: string;
    readonly serviceReferenceId: string;
    readonly kind: ServiceReceiptKind;
    readonly description: string;
    readonly serviceDate: Date;
    readonly grossAmount: string;
    readonly commercialUnit?: ServiceReceiptCommercialUnit;
    readonly masterRecordEntryId?: string | null;
    readonly executors: readonly {
      readonly userId: string;
      readonly council: "CRN" | "CREF";
      readonly performedActivity: string;
    }[];
  }[];
}

export interface RecordPaymentPersistenceInput {
  readonly id: string;
  readonly charge: PersistedCharge;
  readonly financialSettlementId?: string;
  readonly method: ServiceReceiptPaymentMethod;
  readonly receivedAmount: string;
  readonly transactionReference?: string | null;
  readonly idempotencyKey: string;
  readonly requestSha256: string;
  readonly actorUserId: string;
  readonly allocations: readonly {
    readonly chargeItemId: string;
    readonly amount: string;
  }[];
  readonly proof?: {
    readonly id: string;
    readonly storageKey: string;
    readonly originalFileName: string;
    readonly mimeType: "application/pdf" | "image/jpeg" | "image/png";
    readonly byteLength: number;
    readonly sha256: string;
    readonly bytes: Uint8Array;
  };
}

export interface IssueReceiptPersistenceInput {
  readonly id: string;
  readonly provider: LegalProviderReference;
  readonly paymentId: string;
  readonly seriesCode: string;
  readonly expectedSequence: number;
  readonly receivedAmount: string;
  readonly remainingBalance: string;
  readonly partialPayment: boolean;
  readonly customerCpfHash: string;
  readonly customerCpfEncrypted: string;
  readonly customerCpfVisibility: "MASKED" | "FULL";
  readonly signatureMode: "ELECTRONIC" | "MANUAL";
  readonly electronicSignatureReference?: string | null;
  readonly manualSignatureSpace: boolean;
  readonly idempotencyKey: string;
  readonly requestSha256: string;
  readonly snapshotPayloadSha256: string;
  readonly snapshotPayloadCiphertext: Uint8Array;
  readonly snapshotSchemaVersion: number;
  readonly snapshotEncryptionVersion: number;
  readonly replacesReceiptId?: string | null;
  readonly actorUserId: string;
  readonly issuedAt: Date;
}

export interface RefundReceiptPersistenceInput {
  readonly id: string;
  readonly receipt: PersistedReceipt;
  readonly originalPaymentId: string;
  readonly financialSettlementId: string;
  readonly amount: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly requestSha256: string;
  readonly actorUserId: string;
}

export interface ProfessionalServiceReceiptRepository {
  resolveProvider(key: ServiceReceiptProviderKey): Promise<LegalProviderReference>;
  registerCharge(input: RegisterChargePersistenceInput): Promise<PersistedCharge>;
  findCharge(chargeId: string): Promise<PersistedCharge | null>;
  findPaymentByIdempotencyKey(idempotencyKey: string): Promise<PersistedPayment | null>;
  recordPayment(input: RecordPaymentPersistenceInput): Promise<PersistedPayment>;
  issueReceipt(input: IssueReceiptPersistenceInput): Promise<PersistedReceipt>;
  findReceipt(receiptId: string): Promise<PersistedReceipt | null>;
  findReceiptDetails(receiptId: string): Promise<PersistedReceiptDetails | null>;
  findReceiptByIdempotencyKey(idempotencyKey: string): Promise<PersistedReceipt | null>;
  findPrivateProof(receiptId: string): Promise<PrivatePaymentProof | null>;
  listReceipts(filters: ProfessionalReceiptListFilters): Promise<ProfessionalReceiptListPage>;
  cancelReceipt(receiptId: string, actorUserId: string, reason: string): Promise<PersistedReceipt>;
  refundReceipt(input: RefundReceiptPersistenceInput): Promise<PersistedReceipt>;
  deleteDraftCharge(chargeId: string): Promise<ChargeManagementResult>;
  cancelPaidCharge(input: CancelPaidChargePersistenceInput): Promise<ChargeManagementResult>;
}

function providerWhere(key: ServiceReceiptProviderKey): Prisma.ProfessionalServiceLegalProviderWhereInput {
  return key === "ACADEMIA_SAULO_FITNESS"
    ? { type: "LEGAL_ENTITY", businessUnit: { code: "ACADEMIA" } }
    : { type: "INDIVIDUAL", userId: providerUserId[key] };
}

function providerKey(record: { type: string; userId: string | null }): ServiceReceiptProviderKey {
  if (record.type === "LEGAL_ENTITY") return "ACADEMIA_SAULO_FITNESS";
  return record.userId === BUILT_IN_IDS.users.sauloXavierVitorino
    ? "SAULO_XAVIER_VITORINO"
    : "MARIA_DE_LOURDES_GOMES";
}

function money(value: Prisma.Decimal | string): string {
  return new Prisma.Decimal(value).toFixed(2);
}

const chargeInclude = {
  legalProvider: { select: { id: true, type: true, userId: true } },
  items: {
    include: {
      executors: {
        include: { professionalRegistration: { select: { council: true, status: true } } },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  payments: {
    select: {
      receivedAmount: true,
      refunds: { select: { amount: true } },
    },
  },
} satisfies Prisma.ProfessionalServiceChargeInclude;

type ChargeWithContext = Prisma.ProfessionalServiceChargeGetPayload<{ include: typeof chargeInclude }>;

function chargeView(
  charge: ChargeWithContext,
  serviceReferences: ReadonlyMap<string, string> = new Map(),
): PersistedCharge {
  const key = providerKey(charge.legalProvider);
  const executors = charge.items.flatMap((item) => item.executors);
  return {
    id: charge.id,
    provider: { id: charge.legalProvider.id, key },
    masterRecordId: charge.masterRecordId,
    status: charge.status,
    subtotal: money(charge.subtotal),
    discount: money(charge.discount),
    surcharge: money(charge.surcharge),
    amountDue: money(charge.amountDue),
    previouslyReceivedAmount: money(charge.payments.reduce(
      (total, payment) => total.plus(payment.receivedAmount).minus(
        payment.refunds.reduce(
          (refunded, refund) => refunded.plus(refund.amount),
          new Prisma.Decimal(0),
        ),
      ),
      new Prisma.Decimal(0),
    )),
    items: charge.items.map((item) => ({
      id: item.id,
      serviceReferenceId: serviceReferences.get(item.id) ?? item.id,
      kind: item.kind,
      grossAmount: money(item.grossAmount),
    })),
    authorization: {
      legalProviderKey: key,
      serviceKinds: charge.items.map((item) => item.kind),
      executorUserIds: executors.map((executor) => executor.professionalUserId),
      activeProfessionalCouncils: executors.flatMap((executor) =>
        executor.professionalRegistration.status === "ACTIVE"
          ? [executor.professionalRegistration.council]
          : [],
      ),
    },
  };
}

async function resolveProviderWith(
  client: Prisma.TransactionClient | typeof prisma,
  key: ServiceReceiptProviderKey,
): Promise<LegalProviderReference> {
  const record = await client.professionalServiceLegalProvider.findFirst({
    where: { ...providerWhere(key), status: "ACTIVE" },
    select: { id: true },
  });
  if (!record) {
    throw new ProfessionalServiceReceiptRepositoryError(
      "INACTIVE_REFERENCE",
      "Prestador legal ativo nao encontrado.",
    );
  }
  return { id: record.id, key };
}

async function receiptView(
  transaction: Prisma.TransactionClient,
  receiptId: string,
  replayed: boolean,
): Promise<PersistedReceipt> {
  const receipt = await transaction.professionalServiceReceipt.findUnique({
    where: { id: receiptId },
    include: {
      legalProvider: { select: { id: true, type: true, userId: true } },
      series: { select: { code: true } },
    },
  });
  if (!receipt || receipt.sequence === null || receipt.status === "DRAFT") {
    throw new ProfessionalServiceReceiptRepositoryError("NOT_FOUND", "Recibo emitido nao encontrado.");
  }
  return {
    id: receipt.id,
    paymentId: receipt.paymentId,
    provider: {
      id: receipt.legalProvider.id,
      key: providerKey(receipt.legalProvider),
    },
    status: receipt.status,
    series: receipt.series.code,
    sequence: receipt.sequence,
    idempotencyKey: receipt.idempotencyKey,
    requestSha256: receipt.requestSha256,
    replayed,
  };
}

function translateConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ProfessionalServiceReceiptRepositoryError(
      "PERSISTENCE_CONFLICT",
      "A operacao conflita com um registro profissional existente.",
      { cause: error },
    );
  }
  throw error;
}

interface ReceiptListDatabaseRow {
  readonly id: string;
  readonly receiptId: string | null;
  readonly customerName: string;
  readonly customerCode: string;
  readonly providerKey: ServiceReceiptProviderKey;
  readonly status: ProfessionalReceiptListStatus;
  readonly amount: Prisma.Decimal;
  readonly receivedAmount: Prisma.Decimal;
  readonly createdAt: Date;
  readonly series: string | null;
  readonly sequence: number | null;
  readonly paymentCount: bigint;
}

interface ReceiptListSummaryDatabaseRow {
  readonly total: bigint;
  readonly receivedAmount: Prisma.Decimal;
  readonly pending: bigint;
  readonly partial: bigint;
  readonly cancelled: bigint;
  readonly refunded: bigint;
}

function receiptListBase(filters: ProfessionalReceiptListFilters) {
  const conditions: Prisma.Sql[] = [];
  if (filters.query) {
    conditions.push(Prisma.sql`(
      patient."fullName" ILIKE ${`%${filters.query}%`}
      OR patient."clinicalCode" ILIKE ${`%${filters.query}%`}
    )`);
  }
  if (filters.periodStart) conditions.push(Prisma.sql`charge."createdAt" >= ${filters.periodStart}`);
  if (filters.periodEndExclusive) conditions.push(Prisma.sql`charge."createdAt" < ${filters.periodEndExclusive}`);
  if (filters.providerKey === "ACADEMIA_SAULO_FITNESS") {
    conditions.push(Prisma.sql`provider."type" = 'LEGAL_ENTITY'::"ProfessionalServiceProviderType"`);
  } else if (filters.providerKey) {
    const providerOwner = providerUserId[filters.providerKey];
    conditions.push(Prisma.sql`provider."type" = 'INDIVIDUAL'::"ProfessionalServiceProviderType" AND provider."userId" = ${providerOwner}::uuid`);
  }
  if (filters.visibility === "MARIA_PHYSICAL_EDUCATION") {
    const mariaId = BUILT_IN_IDS.users.mariaDeLourdesGomes;
    conditions.push(Prisma.sql`
      NOT EXISTS (
        SELECT 1 FROM "ProfessionalServiceChargeItem" nutrition_item
        WHERE nutrition_item."chargeId" = charge."id"
          AND nutrition_item."kind" IN (
            'NUTRITION_CONSULTATION'::"ProfessionalServiceKind",
            'NUTRITION_FOLLOW_UP'::"ProfessionalServiceKind",
            'NUTRITION_STRATEGY'::"ProfessionalServiceKind",
            'NUTRITION_PLAN'::"ProfessionalServiceKind"
          )
      )
      AND EXISTS (
        SELECT 1
        FROM "ProfessionalServiceChargeItem" physical_item
        JOIN "ProfessionalServiceChargeExecutor" physical_executor
          ON physical_executor."chargeItemId" = physical_item."id"
        JOIN "ServiceProfessionalRegistration" physical_registration
          ON physical_registration."id" = physical_executor."professionalRegistrationId"
        WHERE physical_item."chargeId" = charge."id"
          AND physical_registration."council" = 'CREF'::"ProfessionalCouncil"
          AND physical_registration."status" = 'ACTIVE'::"ProfessionalRegistrationStatus"
      )
      AND (
        provider."userId" = ${mariaId}::uuid
        OR EXISTS (
          SELECT 1
          FROM "ProfessionalServiceChargeItem" maria_item
          JOIN "ProfessionalServiceChargeExecutor" maria_executor
            ON maria_executor."chargeItemId" = maria_item."id"
          WHERE maria_item."chargeId" = charge."id"
            AND maria_executor."professionalUserId" = ${mariaId}::uuid
        )
      )
    `);
  }
  const where = conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;
  return Prisma.sql`
    SELECT
      charge."id",
      latest_receipt."id" AS "receiptId",
      patient."fullName" AS "customerName",
      patient."clinicalCode" AS "customerCode",
      CASE
        WHEN provider."type" = 'LEGAL_ENTITY'::"ProfessionalServiceProviderType" THEN 'ACADEMIA_SAULO_FITNESS'
        WHEN provider."userId" = ${BUILT_IN_IDS.users.sauloXavierVitorino}::uuid THEN 'SAULO_XAVIER_VITORINO'
        ELSE 'MARIA_DE_LOURDES_GOMES'
      END AS "providerKey",
      CASE
        WHEN latest_receipt."status" = 'REFUNDED'::"ProfessionalServiceReceiptStatus" THEN 'REFUNDED'
        WHEN latest_receipt."status" = 'CANCELLED'::"ProfessionalServiceReceiptStatus" THEN 'CANCELLED'
        WHEN charge."status" = 'CANCELLED'::"ProfessionalServiceChargeStatus" THEN 'CANCELLED'
        WHEN charge."status" = 'OPEN'::"ProfessionalServiceChargeStatus" THEN 'DRAFT'
        WHEN charge."status" = 'PARTIALLY_PAID'::"ProfessionalServiceChargeStatus" THEN 'PARTIALLY_PAID'
        WHEN latest_receipt."status" = 'ISSUED'::"ProfessionalServiceReceiptStatus" THEN 'ISSUED'
        ELSE 'PAID'
      END AS "status",
      charge."amountDue" AS "amount",
      CASE WHEN charge."status" = 'CANCELLED'::"ProfessionalServiceChargeStatus"
        THEN 0 ELSE payment_totals."receivedAmount" END AS "receivedAmount",
      payment_totals."paymentCount" AS "paymentCount",
      charge."createdAt",
      latest_receipt."series",
      latest_receipt."sequence"
    FROM "ProfessionalServiceCharge" charge
    JOIN "ProfessionalServiceLegalProvider" provider ON provider."id" = charge."legalProviderId"
    JOIN "MasterRecord" master_record ON master_record."id" = charge."masterRecordId"
    JOIN "Patient" patient ON patient."id" = master_record."patientId"
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(payment."receivedAmount"), 0) - COALESCE(SUM(refund_totals."amount"), 0) AS "receivedAmount",
        COUNT(payment."id") AS "paymentCount"
      FROM "ProfessionalServicePayment" payment
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(refund."amount"), 0) AS "amount"
        FROM "ProfessionalServiceRefund" refund
        WHERE refund."originalPaymentId" = payment."id"
      ) refund_totals ON TRUE
      WHERE payment."chargeId" = charge."id"
    ) payment_totals ON TRUE
    LEFT JOIN LATERAL (
      SELECT receipt."id", receipt."status", series."code" AS "series", receipt."sequence"
      FROM "ProfessionalServiceReceipt" receipt
      JOIN "ProfessionalServicePayment" receipt_payment ON receipt_payment."id" = receipt."paymentId"
      JOIN "ProfessionalServiceReceiptSeries" series ON series."id" = receipt."seriesId"
      WHERE receipt_payment."chargeId" = charge."id"
        AND receipt."status" <> 'DRAFT'::"ProfessionalServiceReceiptStatus"
      ORDER BY COALESCE(receipt."issuedAt", receipt."createdAt") DESC, receipt."id" DESC
      LIMIT 1
    ) latest_receipt ON TRUE
    ${where}
  `;
}

export const professionalServiceReceiptRepository: ProfessionalServiceReceiptRepository = {
  resolveProvider(key) {
    return resolveProviderWith(prisma, key);
  },

  async registerCharge(input) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const provider = await resolveProviderWith(transaction, input.provider.key);
        if (provider.id !== input.provider.id) {
          throw new ProfessionalServiceReceiptRepositoryError("NOT_FOUND", "Prestador legal divergente.");
        }
        const unitEntries = await transaction.professionalServiceCommercialUnit.findMany({
          where: {
            legalProviderId: provider.id,
            code: { in: input.items.flatMap((item) => item.commercialUnit ? [item.commercialUnit] : []) },
            active: true,
          },
          select: { id: true, code: true },
        });
        const unitByCode = new Map(unitEntries.map((unit) => [unit.code, unit.id]));
        const registrations = await transaction.serviceProfessionalRegistration.findMany({
          where: {
            OR: input.items.flatMap((item) => item.executors.map((executor) => ({
              userId: executor.userId,
              council: executor.council,
              status: "ACTIVE" as const,
            }))),
          },
          select: { id: true, userId: true, council: true },
        });
        const registrationByOwner = new Map(registrations.map((registration) => [
          `${registration.userId}:${registration.council}`,
          registration.id,
        ]));
        for (const item of input.items) {
          if (item.commercialUnit && !unitByCode.has(item.commercialUnit)) {
            throw new ProfessionalServiceReceiptRepositoryError("INACTIVE_REFERENCE", "Unidade comercial ativa nao encontrada.");
          }
          for (const executor of item.executors) {
            if (!registrationByOwner.has(`${executor.userId}:${executor.council}`)) {
              throw new ProfessionalServiceReceiptRepositoryError("INACTIVE_REFERENCE", "Registro profissional ativo nao encontrado.");
            }
          }
        }
        const created = await transaction.professionalServiceCharge.create({
          data: {
            legalProviderId: provider.id,
            masterRecordId: input.masterRecordId,
            financialEntryId: input.financialEntryId,
            subtotal: new Prisma.Decimal(input.subtotal),
            discount: new Prisma.Decimal(input.discount),
            surcharge: new Prisma.Decimal(input.surcharge),
            amountDue: new Prisma.Decimal(input.amountDue),
            createdByUserId: input.actorUserId,
            items: {
              create: input.items.map((item) => ({
                id: item.id,
                commercialUnitId: item.commercialUnit ? unitByCode.get(item.commercialUnit) : undefined,
                masterRecordEntryId: item.masterRecordEntryId,
                kind: item.kind,
                description: item.description,
                serviceDate: item.serviceDate,
                grossAmount: new Prisma.Decimal(item.grossAmount),
                executors: {
                  create: item.executors.map((executor) => ({
                    professionalUserId: executor.userId,
                    professionalRegistrationId: registrationByOwner.get(`${executor.userId}:${executor.council}`)!,
                    performedActivity: executor.performedActivity,
                  })),
                },
              })),
            },
          },
          include: chargeInclude,
        });
        return chargeView(created, new Map(input.items.map((item) => [item.id, item.serviceReferenceId])));
      });
    } catch (error) {
      return translateConflict(error);
    }
  },

  async findCharge(chargeId) {
    const charge = await prisma.professionalServiceCharge.findUnique({
      where: { id: chargeId },
      include: chargeInclude,
    });
    return charge ? chargeView(charge) : null;
  },

  async findPaymentByIdempotencyKey(idempotencyKey) {
    const payment = await prisma.professionalServicePayment.findUnique({
      where: { idempotencyKey },
      include: { legalProvider: { select: { id: true, type: true, userId: true } } },
    });
    return payment ? {
      id: payment.id,
      chargeId: payment.chargeId,
      provider: { id: payment.legalProvider.id, key: providerKey(payment.legalProvider) },
      receivedAmount: money(payment.receivedAmount),
      idempotencyKey: payment.idempotencyKey,
      requestSha256: payment.requestSha256,
      replayed: true,
    } : null;
  },

  async recordPayment(input) {
    try {
      return await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`professional-service-payment:${input.idempotencyKey}`}))
        `;
        const existing = await transaction.professionalServicePayment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          if (existing.requestSha256 !== input.requestSha256) {
            throw new ProfessionalServiceReceiptRepositoryError("IDEMPOTENCY_CONFLICT", "A chave de idempotencia pertence a outra requisicao.");
          }
          return {
            id: existing.id,
            chargeId: existing.chargeId,
            provider: input.charge.provider,
            receivedAmount: money(existing.receivedAmount),
            idempotencyKey: existing.idempotencyKey,
            requestSha256: existing.requestSha256,
            replayed: true,
          };
        }
        let financialSettlementId = input.financialSettlementId;
        if (!financialSettlementId) {
          if (input.charge.provider.key === "ACADEMIA_SAULO_FITNESS") {
            throw new ProfessionalServiceReceiptRepositoryError(
              "PERSISTENCE_CONFLICT",
              "A liquidacao financeira da Academia deve ser informada.",
            );
          }
          const paymentReference = {
            PIX: { paymentMethodCode: "PIX", accountCode: "NUBANK" },
            CASH: { paymentMethodCode: "DINHEIRO", accountCode: "CAIXA_FISICO" },
            CARD: { paymentMethodCode: "CREDITO", accountCode: "SUMUP" },
            BANK_TRANSFER: { paymentMethodCode: "TRANSFERENCIA", accountCode: "NUBANK" },
          }[input.method];
          const [businessUnit, financialCategory, financialAccount, paymentMethod] = await Promise.all([
            transaction.businessUnit.findUnique({ where: { code: "PERSONAL" } }),
            transaction.financialCategory.findUnique({ where: { code: "PERSONAL_SERVICOS" } }),
            transaction.financialAccount.findFirst({
              where: { code: paymentReference.accountCode, status: "ACTIVE" },
              orderBy: { createdAt: "asc" },
            }),
            transaction.paymentMethod.findUnique({ where: { code: paymentReference.paymentMethodCode } }),
          ]);
          if (
            !businessUnit || businessUnit.status !== "ACTIVE" ||
            !financialCategory || financialCategory.status !== "ACTIVE" ||
            !financialAccount || financialAccount.status !== "ACTIVE" ||
            !paymentMethod || paymentMethod.status !== "ACTIVE"
          ) {
            throw new ProfessionalServiceReceiptRepositoryError(
              "INACTIVE_REFERENCE",
              "A configuracao financeira canonica do Personal esta incompleta ou inativa.",
            );
          }
          const charge = await transaction.professionalServiceCharge.findUnique({
            where: { id: input.charge.id },
            select: {
              createdAt: true,
              financialEntryId: true,
              masterRecord: { select: { patient: { select: { fullName: true } } } },
              legalProvider: {
                select: {
                  user: { select: { fullName: true } },
                  businessUnit: { select: { legalName: true, tradeName: true } },
                },
              },
              items: { orderBy: { createdAt: "asc" }, select: { description: true } },
            },
          });
          if (!charge) {
            throw new ProfessionalServiceReceiptRepositoryError("NOT_FOUND", "Cobranca nao encontrada.");
          }
          const settlementKey = `professional-service-payment:${input.idempotencyKey}`;
          if (charge.financialEntryId) {
            let settlement = await transaction.financialSettlement.findUnique({
              where: { idempotencyKey: settlementKey },
            });
            if (settlement && settlement.financialEntryId !== charge.financialEntryId) {
              throw new ProfessionalServiceReceiptRepositoryError(
                "PERSISTENCE_CONFLICT",
                "A chave da liquidacao canonica pertence a outro lancamento financeiro.",
              );
            }
            settlement ??= await transaction.financialSettlement.create({
              data: {
                financialEntryId: charge.financialEntryId,
                amount: new Prisma.Decimal(input.receivedAmount),
                settlementDate: new Date(),
                financialAccountId: financialAccount.id,
                paymentMethodId: paymentMethod.id,
                idempotencyKey: settlementKey,
              },
            });
            financialSettlementId = settlement.id;
            const settled = await transaction.financialSettlement.aggregate({
              where: { financialEntryId: charge.financialEntryId },
              _sum: { amount: true },
            });
            await transaction.financialEntry.update({
              where: { id: charge.financialEntryId },
              data: {
                status: new Prisma.Decimal(settled._sum.amount ?? 0).equals(input.charge.amountDue)
                  ? "SETTLED"
                  : "PARTIALLY_SETTLED",
              },
            });
          } else {
            const amount = new Prisma.Decimal(input.receivedAmount);
            const providerName = charge.legalProvider.user?.fullName
              ?? charge.legalProvider.businessUnit?.tradeName
              ?? charge.legalProvider.businessUnit?.legalName;
            const financialEntryDescription = buildProfessionalServiceFinancialEntryDescription({
              serviceDescriptions: charge.items.map((item) => item.description),
              customerName: charge.masterRecord.patient.fullName,
              providerName,
            });
            const entry = await transaction.financialEntry.create({
              data: {
                type: "REVENUE",
                competence: charge.createdAt,
                dueDate: charge.createdAt,
                amount: new Prisma.Decimal(input.charge.amountDue),
                description: financialEntryDescription,
                status: amount.equals(input.charge.amountDue) ? "SETTLED" : "PARTIALLY_SETTLED",
                origin: "INTERNAL_INTEGRATION",
                sourceSystem: "GESTAO_SV",
                managementNature: "REALIZED",
                sourceType: "PROFESSIONAL_SERVICE_CHARGE",
                sourceId: input.charge.id,
                businessUnitId: businessUnit.id,
                financialCategoryId: financialCategory.id,
                financialAccountId: financialAccount.id,
                paymentMethodId: paymentMethod.id,
                settlements: {
                  create: {
                    amount,
                    settlementDate: new Date(),
                    financialAccountId: financialAccount.id,
                    paymentMethodId: paymentMethod.id,
                    idempotencyKey: settlementKey,
                  },
                },
              },
              select: { id: true, settlements: { select: { id: true } } },
            });
            financialSettlementId = entry.settlements[0]?.id;
            if (!financialSettlementId) {
              throw new ProfessionalServiceReceiptRepositoryError(
                "PERSISTENCE_CONFLICT",
                "A liquidacao financeira canonica nao foi criada.",
              );
            }
            await transaction.professionalServiceCharge.update({
              where: { id: input.charge.id },
              data: { financialEntryId: entry.id },
            });
          }
        }
        const payment = await transaction.professionalServicePayment.create({
          data: {
            id: input.id,
            chargeId: input.charge.id,
            legalProviderId: input.charge.provider.id,
            financialSettlementId,
            receivedAmount: new Prisma.Decimal(input.receivedAmount),
            transactionReference: input.transactionReference,
            idempotencyKey: input.idempotencyKey,
            requestSha256: input.requestSha256,
            recordedByUserId: input.actorUserId,
            allocations: {
              create: input.allocations.map((allocation) => ({
                chargeItemId: allocation.chargeItemId,
                amount: new Prisma.Decimal(allocation.amount),
              })),
            },
            proof: input.proof ? {
              create: {
                id: input.proof.id,
                storageKey: input.proof.storageKey,
                originalFileName: input.proof.originalFileName,
                mimeType: input.proof.mimeType,
                byteLength: input.proof.byteLength,
                sha256: input.proof.sha256,
                recordedByUserId: input.actorUserId,
                blob: { create: { content: Buffer.from(input.proof.bytes) } },
              },
            } : undefined,
          },
        });
        return {
          id: payment.id,
          chargeId: payment.chargeId,
          provider: input.charge.provider,
          receivedAmount: money(payment.receivedAmount),
          idempotencyKey: payment.idempotencyKey,
          requestSha256: payment.requestSha256,
          replayed: false,
        };
      });
    } catch (error) {
      return translateConflict(error);
    }
  },

  async issueReceipt(input) {
    try {
      return await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`professional-service-receipt:${input.idempotencyKey}`}))
        `;
        const existing = await transaction.professionalServiceReceipt.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          if (existing.requestSha256 !== input.requestSha256) {
            throw new ProfessionalServiceReceiptRepositoryError("IDEMPOTENCY_CONFLICT", "A chave de idempotencia pertence a outra emissao.");
          }
          return receiptView(transaction, existing.id, true);
        }
        const series = await transaction.professionalServiceReceiptSeries.findUnique({
          where: {
            legalProviderId_code: {
              legalProviderId: input.provider.id,
              code: input.seriesCode,
            },
          },
          select: { id: true },
        });
        if (!series) {
          throw new ProfessionalServiceReceiptRepositoryError("NOT_FOUND", "Serie de recibo nao encontrada.");
        }
        await transaction.professionalServiceReceipt.create({
          data: {
            id: input.id,
            legalProviderId: input.provider.id,
            paymentId: input.paymentId,
            seriesId: series.id,
            sequence: input.expectedSequence,
            status: "ISSUED",
            customerCpfHash: input.customerCpfHash,
            customerCpfEncrypted: input.customerCpfEncrypted,
            receivedAmount: new Prisma.Decimal(input.receivedAmount),
            remainingBalance: new Prisma.Decimal(input.remainingBalance),
            partialPayment: input.partialPayment,
            signatureMode: input.signatureMode,
            electronicSignatureReference: input.electronicSignatureReference,
            manualSignatureSpace: input.manualSignatureSpace,
            customerCpfVisibility: input.customerCpfVisibility,
            idempotencyKey: input.idempotencyKey,
            requestSha256: input.requestSha256,
            snapshotPayloadSha256: input.snapshotPayloadSha256,
            replacesReceiptId: input.replacesReceiptId,
            issuedAt: input.issuedAt,
            issuedByUserId: input.actorUserId,
            createdByUserId: input.actorUserId,
            snapshot: {
              create: {
                schemaVersion: input.snapshotSchemaVersion,
                payloadCiphertext: Buffer.from(input.snapshotPayloadCiphertext),
                encryptionVersion: input.snapshotEncryptionVersion,
                payloadSha256: input.snapshotPayloadSha256,
              },
            },
          },
        });
        return receiptView(transaction, input.id, false);
      });
    } catch (error) {
      return translateConflict(error);
    }
  },

  async findReceipt(receiptId) {
    return prisma.$transaction(async (transaction) => {
      try {
        return await receiptView(transaction, receiptId, false);
      } catch (error) {
        if (error instanceof ProfessionalServiceReceiptRepositoryError && error.code === "NOT_FOUND") return null;
        throw error;
      }
    });
  },

  async findReceiptDetails(receiptId) {
    return prisma.$transaction(async (transaction) => {
      const record = await transaction.professionalServiceReceipt.findUnique({
        where: { id: receiptId },
        include: {
          payment: { include: { charge: { include: chargeInclude } } },
          snapshot: true,
          events: { orderBy: [{ occurredAt: "asc" }, { id: "asc" }] },
        },
      });
      if (!record || !record.snapshot || record.sequence === null || record.status === "DRAFT") return null;
      return {
        receipt: await receiptView(transaction, record.id, false),
        charge: chargeView(record.payment.charge),
        receivedAmount: money(record.receivedAmount),
        remainingBalance: money(record.remainingBalance),
        partialPayment: record.partialPayment,
        snapshot: {
          schemaVersion: record.snapshot.schemaVersion,
          encryptionVersion: record.snapshot.encryptionVersion,
          payloadSha256: record.snapshot.payloadSha256,
          createdAt: record.snapshot.createdAt,
        },
        events: record.events.map((event) => ({
          type: event.type,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          reason: event.reason,
          occurredAt: event.occurredAt,
        })),
      };
    });
  },

  async findReceiptByIdempotencyKey(idempotencyKey) {
    return prisma.$transaction(async (transaction) => {
      const receipt = await transaction.professionalServiceReceipt.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      return receipt ? receiptView(transaction, receipt.id, true) : null;
    });
  },

  async findPrivateProof(receiptId) {
    const record = await prisma.professionalServiceReceipt.findUnique({
      where: { id: receiptId },
      include: {
        payment: {
          include: {
            charge: { include: chargeInclude },
            proof: { include: { blob: true } },
          },
        },
      },
    });
    const proof = record?.payment.proof;
    if (!record || record.status === "DRAFT" || !proof?.blob
      || proof.byteLength !== proof.blob.content.byteLength) return null;
    return {
      receiptId: record.id,
      charge: chargeView(record.payment.charge),
      mimeType: proof.mimeType as PrivatePaymentProof["mimeType"],
      byteLength: proof.byteLength,
      sha256: proof.sha256,
      bytes: Uint8Array.from(proof.blob.content),
    };
  },

  async listReceipts(filters) {
    const base = receiptListBase(filters);
    const statusFilter = filters.status
      ? Prisma.sql`WHERE listed."status" = ${filters.status}`
      : Prisma.empty;
    const offset = (filters.page - 1) * filters.pageSize;
    const [rows, summaries] = await prisma.$transaction([
      prisma.$queryRaw<ReceiptListDatabaseRow[]>(Prisma.sql`
        SELECT listed.* FROM (${base}) listed
        ${statusFilter}
        ORDER BY listed."createdAt" DESC, listed."id" DESC
        LIMIT ${filters.pageSize} OFFSET ${offset}
      `),
      prisma.$queryRaw<ReceiptListSummaryDatabaseRow[]>(Prisma.sql`
        SELECT
          COUNT(*) AS "total",
          COALESCE(SUM(listed."receivedAmount"), 0) AS "receivedAmount",
          COUNT(*) FILTER (WHERE listed."status" = 'DRAFT') AS "pending",
          COUNT(*) FILTER (WHERE listed."status" = 'PARTIALLY_PAID') AS "partial",
          COUNT(*) FILTER (WHERE listed."status" = 'CANCELLED') AS "cancelled",
          COUNT(*) FILTER (WHERE listed."status" = 'REFUNDED') AS "refunded"
        FROM (${base}) listed
        ${statusFilter}
      `),
    ]);
    const summary = summaries[0] ?? {
      total: BigInt(0), receivedAmount: new Prisma.Decimal(0), pending: BigInt(0),
      partial: BigInt(0), cancelled: BigInt(0), refunded: BigInt(0),
    };
    const total = Number(summary.total);
    return {
      items: rows.map((row) => ({
        id: row.id,
        receiptId: row.receiptId,
        customerName: row.customerName,
        customerCode: row.customerCode,
        providerKey: row.providerKey,
        status: row.status,
        amount: money(row.amount),
        receivedAmount: money(row.receivedAmount),
        createdAt: row.createdAt,
        series: row.series,
        sequence: row.sequence,
        paymentCount: Number(row.paymentCount),
      })),
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
      indicators: {
        receivedAmount: money(summary.receivedAmount),
        pending: Number(summary.pending),
        partial: Number(summary.partial),
        cancelled: Number(summary.cancelled),
        refunded: Number(summary.refunded),
      },
    };
  },

  async cancelReceipt(receiptId, actorUserId, reason) {
    return prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`professional-service-receipt-cancel:${receiptId}`}))
      `;
      const current = await transaction.professionalServiceReceipt.findUnique({
        where: { id: receiptId },
        select: { status: true, cancelledByUserId: true, cancellationReason: true },
      });
      if (current?.status === "CANCELLED") {
        if (current.cancelledByUserId !== actorUserId || current.cancellationReason !== reason) {
          throw new ProfessionalServiceReceiptRepositoryError("IDEMPOTENCY_CONFLICT", "O recibo ja foi cancelado por outra solicitacao.");
        }
        return receiptView(transaction, receiptId, true);
      }
      const updated = await transaction.professionalServiceReceipt.updateMany({
        where: { id: receiptId, status: "ISSUED" },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledByUserId: actorUserId,
          cancellationReason: reason,
        },
      });
      if (updated.count !== 1) {
        throw new ProfessionalServiceReceiptRepositoryError("PERSISTENCE_CONFLICT", "Recibo nao esta disponivel para cancelamento.");
      }
      return receiptView(transaction, receiptId, false);
    });
  },

  async refundReceipt(input) {
    try {
      return await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`professional-service-refund:${input.idempotencyKey}`}))
        `;
        const existing = await transaction.professionalServiceRefund.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          if (existing.requestSha256 !== input.requestSha256) {
            throw new ProfessionalServiceReceiptRepositoryError("IDEMPOTENCY_CONFLICT", "A chave de idempotencia pertence a outro estorno.");
          }
          return receiptView(transaction, existing.receiptId, true);
        }
        await transaction.$executeRaw`
          INSERT INTO "ProfessionalServiceRefund" (
            "id", "receiptId", "type", "originalPaymentId", "legalProviderId",
            "financialSettlementId", "amount", "reason", "idempotencyKey",
            "requestSha256", "recordedByUserId"
          ) VALUES (
            ${input.id}::uuid, ${input.receipt.id}::uuid, 'REFUNDED',
            ${input.originalPaymentId}::uuid, ${input.receipt.provider.id}::uuid,
            ${input.financialSettlementId}::uuid, ${new Prisma.Decimal(input.amount)},
            ${input.reason}, ${input.idempotencyKey}, ${input.requestSha256},
            ${input.actorUserId}::uuid
          )
        `;
        return receiptView(transaction, input.receipt.id, false);
      });
    } catch (error) {
      return translateConflict(error);
    }
  },

  async deleteDraftCharge(chargeId) {
    try {
      return await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`professional-service-draft:${chargeId}`}))
        `;
        const charge = await transaction.professionalServiceCharge.findUnique({
          where: { id: chargeId },
          select: {
            id: true,
            status: true,
            payments: { select: { id: true, receipts: { select: { id: true } } } },
          },
        });
        if (!charge) {
          throw new ProfessionalServiceReceiptRepositoryError("NOT_FOUND", "Rascunho nao encontrado.");
        }
        if (charge.status !== "OPEN" || charge.payments.length > 0
          || charge.payments.some((payment) => payment.receipts.length > 0)) {
          throw new ProfessionalServiceReceiptRepositoryError(
            "PERSISTENCE_CONFLICT",
            "Somente rascunho sem pagamento e sem recibo pode ser excluido.",
          );
        }
        await transaction.professionalServiceFinancialEntryClaim.deleteMany({
          where: { professionalServiceChargeId: charge.id },
        });
        await transaction.professionalServiceChargeExecutor.deleteMany({
          where: { chargeItem: { chargeId: charge.id } },
        });
        await transaction.professionalServiceChargeItem.deleteMany({ where: { chargeId: charge.id } });
        await transaction.professionalServiceCharge.delete({ where: { id: charge.id } });
        return { id: charge.id, status: "DELETED", replayed: false };
      });
    } catch (error) {
      return translateConflict(error);
    }
  },

  async cancelPaidCharge(input) {
    try {
      return await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${`professional-service-charge-cancel:${input.chargeId}`}))
        `;
        const charge = await transaction.professionalServiceCharge.findUnique({
          where: { id: input.chargeId },
          include: {
            financialEntry: { select: { id: true, status: true } },
            payments: {
              include: {
                allocations: { select: { id: true } },
                financialSettlement: { select: { id: true } },
                receipts: { select: { id: true } },
              },
            },
          },
        });
        if (!charge) throw new ProfessionalServiceReceiptRepositoryError("NOT_FOUND", "Recebimento nao encontrado.");
        if (charge.status === "CANCELLED") {
          const prior = await transaction.auditEvent.findFirst({
            where: { entityType: "ProfessionalServiceChargeCancellation", entityId: charge.id },
            select: { id: true },
          });
          if (!prior) throw new ProfessionalServiceReceiptRepositoryError("PERSISTENCE_CONFLICT", "Historico de cancelamento nao encontrado.");
          return { id: charge.id, status: "CANCELLED", replayed: true };
        }
        if (!charge.financialEntry || charge.payments.length === 0
          || !["PAID", "PARTIALLY_PAID"].includes(charge.status)
          || charge.payments.some((payment) => payment.receipts.length > 0)) {
          throw new ProfessionalServiceReceiptRepositoryError(
            "PERSISTENCE_CONFLICT",
            "Somente recebimento pago sem recibo pode ser cancelado.",
          );
        }
        const auditModule = await transaction.systemModule.findUnique({ where: { key: "AUDIT" }, select: { id: true } });
        if (!auditModule) throw new ProfessionalServiceReceiptRepositoryError("NOT_FOUND", "Modulo de auditoria nao encontrado.");
        await transaction.professionalServiceCharge.update({
          where: { id: charge.id },
          data: { status: "CANCELLED" },
        });
        await transaction.financialEntry.update({
          where: { id: charge.financialEntry.id },
          data: { status: "CANCELLED" },
        });
        await transaction.auditEvent.create({
          data: {
            entityType: "ProfessionalServiceChargeCancellation",
            entityId: charge.id,
            moduleId: auditModule.id,
            action: "STATUS_CHANGE",
            createdByUserId: input.actorUserId,
            changedByUserId: input.actorUserId,
            reason: input.reason,
            changes: {
              create: [
                { fieldPath: "charge.status", previousValue: charge.status, newValue: "CANCELLED" },
                { fieldPath: "financialEntry.status", previousValue: charge.financialEntry.status, newValue: "CANCELLED" },
                { fieldPath: "idempotencyKey", newValue: input.idempotencyKey },
                { fieldPath: "requestSha256", newValue: input.requestSha256 },
                ...charge.payments.flatMap((payment) => [
                  { fieldPath: `payments.${payment.id}.status`, previousValue: "ACTIVE", newValue: "CANCELLED" },
                  { fieldPath: `settlements.${payment.financialSettlement.id}.status`, previousValue: "ACTIVE", newValue: "CANCELLED" },
                  ...payment.allocations.map((allocation) => ({
                    fieldPath: `allocations.${allocation.id}.status`, previousValue: "ACTIVE", newValue: "CANCELLED",
                  })),
                ]),
              ],
            },
          },
        });
        return { id: charge.id, status: "CANCELLED", replayed: false };
      });
    } catch (error) {
      return translateConflict(error);
    }
  },
};
