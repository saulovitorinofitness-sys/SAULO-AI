import { createCipheriv, createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import type { FrontendAccessSnapshot } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";

import { ServiceReceiptLifecycleError } from "./lifecycle";
import { ServiceReceiptProofError } from "./proof-file";
import { IssuerConfigurationServiceError } from "./issuer-configuration-service";
import { ProfessionalServiceReceiptRepositoryError } from "./repository";
import {
  professionalServiceReceiptService,
  ProfessionalServiceReceiptServiceError,
} from "./service";

const noStore = { "Cache-Control": "private, no-store" };
const privateBinaryHeaders = {
  ...noStore,
  "Content-Security-Policy": "default-src 'none'",
  "X-Content-Type-Options": "nosniff",
  "Content-Disposition": "attachment",
};

const uuid = z.uuid();
const money = z.string().regex(/^(0|[1-9]\d*)\.\d{2}$/u);
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const providerKey = z.enum(["ACADEMIA_SAULO_FITNESS", "SAULO_XAVIER_VITORINO", "MARIA_DE_LOURDES_GOMES"]);
const serviceKind = z.enum([
  "ACADEMY_MEMBERSHIP", "ACADEMY_SERVICE", "NUTRITION_CONSULTATION",
  "NUTRITION_FOLLOW_UP", "NUTRITION_STRATEGY", "NUTRITION_PLAN",
  "PERSONAL_TRAINING", "STRENGTH_TRAINING_PLAN", "RUNNING_PLAN",
  "CYCLING_PLAN", "POSTURAL_ASSESSMENT", "PHYSICAL_FOLLOW_UP",
]);

const executorSchema = z.object({
  userId: uuid,
  professionalRegistration: z.enum(["CRN", "CREF"]),
  professionalRegistrationStatus: z.enum(["ACTIVE", "INACTIVE"]),
  performedActivity: requiredText(500),
}).strict();

const itemSchema = z.object({
  serviceReferenceId: requiredText(120),
  kind: serviceKind,
  soldByProviderKey: providerKey,
  legalProviderKey: providerKey,
  commercialUnit: z.object({
    unit: z.enum(["CLINICA_SV", "ACADEMIA_SAULO_FITNESS"]),
    commercialName: requiredText(180).optional(),
    legalProviderKey: z.literal("ACADEMIA_SAULO_FITNESS").optional(),
  }).strict().optional(),
  executors: z.array(executorSchema).max(2),
  grossAmount: money,
}).strict();

const totalsSchema = z.object({
  subtotal: money,
  discount: money,
  surcharge: money,
  amountDue: money,
}).strict();

const candidateSchema = z.object({
  legalProvider: z.discriminatedUnion("key", [
    z.object({
      key: z.literal("ACADEMIA_SAULO_FITNESS"), providerType: z.literal("LEGAL_ENTITY"),
      taxIdType: z.literal("CNPJ").optional(), legalName: requiredText(180).optional(),
      tradeName: requiredText(180).optional(), cnpj: requiredText(18).optional(),
      address: z.object({ formattedAddress: requiredText(500).optional() }).strict().optional(),
    }).strict(),
    z.object({
      key: z.literal("SAULO_XAVIER_VITORINO"), providerType: z.literal("INDIVIDUAL"),
      taxIdType: z.literal("CPF").optional(), fullName: requiredText(180).optional(),
      cpf: requiredText(14).optional(), crn: requiredText(80).optional(), cref: requiredText(80).optional(),
      address: z.object({ formattedAddress: requiredText(500).optional() }).strict().optional(),
    }).strict(),
    z.object({
      key: z.literal("MARIA_DE_LOURDES_GOMES"), providerType: z.literal("INDIVIDUAL"),
      taxIdType: z.literal("CPF").optional(), fullName: requiredText(180).optional(),
      cpf: requiredText(14).optional(), cref: requiredText(80).optional(),
      address: z.object({ formattedAddress: requiredText(500).optional() }).strict().optional(),
    }).strict(),
  ]),
  customerMasterRecordId: uuid,
  items: z.array(itemSchema).min(1),
  totals: totalsSchema,
  payment: z.object({
    method: z.enum(["PIX", "CASH", "CARD", "BANK_TRANSFER"]),
    receivedByProviderKey: providerKey,
    receivedAmount: money,
    previouslyReceivedAmount: money,
    transactionReference: requiredText(120).optional(),
    allocations: z.array(z.object({ serviceReferenceId: requiredText(120), amount: money }).strict()).min(1),
  }).strict(),
  numbering: z.object({ series: requiredText(40), sequence: z.number().int().positive() }).strict(),
  signature: z.object({
    mode: z.enum(["ELECTRONIC", "MANUAL"]), signingProviderKey: providerKey,
    electronicSignatureReference: requiredText(500).optional(), includeManualSignatureSpace: z.boolean(),
  }).strict(),
  privacy: z.object({ customerCpfOnDocument: z.enum(["MASKED", "FULL"]) }).strict(),
  operatorUserId: uuid.optional(),
}).strict();

const validationContextSchema = z.object({
  customerIdentity: z.object({ masterRecordId: uuid, cpf: requiredText(14).optional() }).strict().nullable(),
  numbering: z.object({ seriesProviderKey: providerKey, sequencePreviouslyUsed: z.boolean() }).strict(),
}).strict();

const registerChargeSchema = z.object({
  providerKey,
  masterRecordId: uuid,
  financialEntryId: uuid.nullable().optional(),
  totals: totalsSchema,
  items: z.array(itemSchema.extend({
    description: requiredText(500),
    serviceDate: z.iso.date(),
    masterRecordEntryId: uuid.nullable().optional(),
  }).strict()).min(1),
}).strict();

const paymentSchema = z.object({
  providerKey,
  financialSettlementId: uuid.optional(),
  method: z.enum(["PIX", "CASH", "CARD", "BANK_TRANSFER"]),
  receivedAmount: money,
  transactionReference: requiredText(120).optional(),
  allocations: z.array(z.object({ chargeItemId: uuid, amount: money }).strict()).min(1),
  idempotencyKey: requiredText(120),
  proof: z.object({
    name: requiredText(255),
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    base64: z.string().min(4).max(14_000_000),
  }).strict().optional(),
}).strict();

const assessmentSchema = z.object({ candidate: candidateSchema, validationContext: validationContextSchema }).strict();
const issuanceSchema = assessmentSchema.extend({
  paymentId: uuid,
  idempotencyKey: requiredText(120),
  replacesReceiptId: uuid.nullable().optional(),
}).strict();
const cancellationSchema = z.object({ reason: requiredText(500) }).strict();
const deleteDraftSchema = z.object({ confirmation: z.literal("EXCLUIR_RASCUNHO") }).strict();
const cancelChargeSchema = z.object({
  reason: requiredText(500),
  idempotencyKey: requiredText(120),
}).strict();
const refundSchema = z.object({
  originalPaymentId: uuid,
  financialSettlementId: uuid,
  amount: money,
  reason: requiredText(500),
  idempotencyKey: requiredText(120),
}).strict();
const listQuerySchema = z.object({
  query: z.string().trim().max(180).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  provider: providerKey.optional(),
  status: z.enum(["DRAFT", "PARTIALLY_PAID", "PAID", "ISSUED", "CANCELLED", "REFUNDED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

type ReceiptService = typeof professionalServiceReceiptService;
type AccessResolver = (request: Request) => Promise<FrontendAccessSnapshot>;

export interface ProfessionalReceiptHttpDependencies {
  readonly resolveAccess: AccessResolver;
  readonly service?: ReceiptService;
}

export interface ProfessionalReceiptHttpHandlers {
  listReceipts(request: Request): Promise<Response>;
  createCharge(request: Request): Promise<Response>;
  getCharge(request: Request, chargeId: string): Promise<Response>;
  deleteDraftCharge(request: Request, chargeId: string): Promise<Response>;
  cancelPaidCharge(request: Request, chargeId: string): Promise<Response>;
  recordPayment(request: Request, chargeId: string): Promise<Response>;
  assessCandidate(request: Request, chargeId: string): Promise<Response>;
  issueReceipt(request: Request): Promise<Response>;
  getReceipt(request: Request, receiptId: string): Promise<Response>;
  cancelReceipt(request: Request, receiptId: string): Promise<Response>;
  refundReceipt(request: Request, receiptId: string): Promise<Response>;
  getPrivateProof(request: Request, receiptId: string): Promise<Response>;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: noStore });
}

type AccessResult =
  | { readonly authenticated: true; readonly userId: string }
  | { readonly authenticated: false; readonly response: Response };

async function access(
  dependencies: ProfessionalReceiptHttpDependencies,
  request: Request,
): Promise<AccessResult> {
  let resolved: FrontendAccessSnapshot;
  try {
    resolved = await dependencies.resolveAccess(request);
  } catch {
    return { authenticated: false, response: json({ code: "UNAUTHENTICATED", message: "Entre novamente para continuar." }, 401) };
  }
  if (![BUILT_IN_IDS.users.sauloXavierVitorino, BUILT_IN_IDS.users.mariaDeLourdesGomes].includes(
    resolved.user.id as typeof BUILT_IN_IDS.users.sauloXavierVitorino,
  )) {
    return { authenticated: false, response: json({ code: "FORBIDDEN", message: "Perfil sem acesso ao novo fluxo de recibos." }, 403) };
  }
  return { authenticated: true, userId: resolved.user.id };
}

async function body(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return null; }
}

function errorResponse(error: unknown): Response {
  if (error instanceof IssuerConfigurationServiceError) {
    const status = error.code === "NOT_AUTHORIZED" ? 403 : error.code === "ISSUER_INCOMPLETE" ? 422 : 400;
    return json({ code: error.code, message: error.message }, status);
  }
  if (error instanceof ProfessionalServiceReceiptServiceError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "NOT_AUTHORIZED" ? 403
      : error.code === "VALIDATION_FAILED" ? 422 : 400;
    return json({ code: error.code, message: error.message }, status);
  }
  if (error instanceof ProfessionalServiceReceiptRepositoryError) {
    const status = error.code === "NOT_FOUND" ? 404
      : error.code === "IDEMPOTENCY_CONFLICT" || error.code === "PERSISTENCE_CONFLICT" ? 409 : 422;
    return json({ code: error.code, message: error.message }, status);
  }
  if (error instanceof ServiceReceiptLifecycleError) return json({ code: error.code }, 422);
  if (error instanceof ServiceReceiptProofError) {
    return json({ code: error.code }, error.code === "FILE_TOO_LARGE" ? 413 : 400);
  }
  return json({ code: "UNAVAILABLE", message: "Operacao indisponivel no momento." }, 503);
}

function requestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function encryptionKey() {
  const secret = process.env.PAYROLL_DATA_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) throw new Error("PROTECTION_KEY_UNAVAILABLE");
  return createHash("sha256").update(secret).digest();
}

function protectText(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function protectSnapshot(value: unknown) {
  const plaintext = JSON.stringify(value);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: Uint8Array.from(Buffer.concat([iv, cipher.getAuthTag(), encrypted])),
    sha256: createHash("sha256").update(plaintext).digest("hex"),
  };
}

function safeCharge(charge: Awaited<ReturnType<ReceiptService["getCharge"]>>) {
  return {
    id: charge.id,
    legalProviderKey: charge.provider.key,
    masterRecordId: charge.masterRecordId,
    status: charge.status,
    subtotal: charge.subtotal,
    discount: charge.discount,
    surcharge: charge.surcharge,
    amountDue: charge.amountDue,
    receivedAmount: charge.previouslyReceivedAmount,
    remainingBalance: (
      BigInt(charge.amountDue.replace(".", "")) - BigInt(charge.previouslyReceivedAmount.replace(".", ""))
    ).toString().padStart(3, "0").replace(/(\d{2})$/u, ".$1"),
    items: charge.items,
  };
}

function safeReceipt(details: Awaited<ReturnType<ReceiptService["getReceiptDetails"]>>) {
  return {
    id: details.receipt.id,
    paymentId: details.receipt.paymentId,
    legalProviderKey: details.receipt.provider.key,
    status: details.receipt.status,
    series: details.receipt.series,
    sequence: details.receipt.sequence,
    receivedAmount: details.receivedAmount,
    remainingBalance: details.remainingBalance,
    partialPayment: details.partialPayment,
    snapshot: {
      schemaVersion: details.snapshot.schemaVersion,
      encryptionVersion: details.snapshot.encryptionVersion,
      payloadSha256: details.snapshot.payloadSha256,
      createdAt: details.snapshot.createdAt.toISOString(),
    },
    events: details.events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
  };
}

export function createProfessionalReceiptHttpHandlers(
  dependencies: ProfessionalReceiptHttpDependencies,
): ProfessionalReceiptHttpHandlers {
  const service = dependencies.service ?? professionalServiceReceiptService;
  return {
    async listReceipts(request: Request) {
      const auth = await access(dependencies, request); if (!auth.authenticated) return auth.response;
      const parameters = new URL(request.url).searchParams;
      const parsed = listQuerySchema.safeParse({
        query: parameters.get("query") || undefined,
        from: parameters.get("from") || undefined,
        to: parameters.get("to") || undefined,
        provider: parameters.get("provider") || undefined,
        status: parameters.get("status") || undefined,
        page: parameters.get("page") || undefined,
        pageSize: parameters.get("pageSize") || undefined,
      });
      if (!parsed.success) return json({ code: "INVALID_INPUT", message: "Filtros de consulta invalidos." }, 400);
      try {
        const result = await service.listReceipts({
          query: parsed.data.query,
          periodStart: parsed.data.from,
          periodEnd: parsed.data.to,
          providerKey: parsed.data.provider,
          status: parsed.data.status,
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          actorUserId: auth.userId,
        });
        return json({
          ...result,
          items: result.items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
        });
      } catch (error) { return errorResponse(error); }
    },

    async createCharge(request: Request) {
      const auth = await access(dependencies, request); if (!auth.authenticated) return auth.response;
      const parsed = registerChargeSchema.safeParse(await body(request));
      if (!parsed.success) return json({ code: "INVALID_INPUT", message: "Cobranca invalida." }, 400);
      try {
        const charge = await service.registerCharge({ ...parsed.data, actorUserId: auth.userId });
        return json({ charge: safeCharge(charge) }, 201);
      } catch (error) { return errorResponse(error); }
    },

    async getCharge(request: Request, chargeId: string) {
      const auth = await access(dependencies, request); if (!auth.authenticated) return auth.response;
      if (!uuid.safeParse(chargeId).success) return json({ code: "NOT_FOUND" }, 404);
      try { return json({ charge: safeCharge(await service.getCharge(chargeId, auth.userId)) }); }
      catch (error) { return errorResponse(error); }
    },

    async deleteDraftCharge(request: Request, chargeId: string) {
      const auth = await access(dependencies, request); if (!auth.authenticated) return auth.response;
      if (!uuid.safeParse(chargeId).success) return json({ code: "NOT_FOUND" }, 404);
      const parsed = deleteDraftSchema.safeParse(await body(request));
      if (!parsed.success) return json({ code: "CONFIRMATION_REQUIRED", message: "Confirme a exclusao do rascunho." }, 400);
      try {
        const result = await service.deleteDraftCharge(chargeId, auth.userId);
        return json(result);
      } catch (error) { return errorResponse(error); }
    },

    async cancelPaidCharge(request: Request, chargeId: string) {
      const auth = await access(dependencies, request); if (!auth.authenticated) return auth.response;
      if (!uuid.safeParse(chargeId).success) return json({ code: "NOT_FOUND" }, 404);
      const parsed = cancelChargeSchema.safeParse(await body(request));
      if (!parsed.success) return json({ code: "INVALID_INPUT", message: "Informe o motivo do cancelamento." }, 400);
      try {
        const result = await service.cancelPaidCharge({
          chargeId,
          actorUserId: auth.userId,
          reason: parsed.data.reason,
          idempotencyKey: parsed.data.idempotencyKey,
          requestSha256: requestHash(parsed.data),
        });
        return json(result);
      } catch (error) { return errorResponse(error); }
    },

    async recordPayment(request: Request, chargeId: string) {
      const auth = await access(dependencies, request); if (!auth.authenticated) return auth.response;
      if (!uuid.safeParse(chargeId).success) return json({ code: "NOT_FOUND" }, 404);
      const parsed = paymentSchema.safeParse(await body(request));
      if (!parsed.success) return json({ code: "INVALID_INPUT", message: "Pagamento invalido." }, 400);
      let proof;
      try {
        proof = parsed.data.proof ? {
          name: parsed.data.proof.name,
          mimeType: parsed.data.proof.mimeType,
          bytes: Uint8Array.from(Buffer.from(parsed.data.proof.base64, "base64")),
        } : undefined;
      } catch { return json({ code: "INVALID_INPUT", message: "Comprovante invalido." }, 400); }
      try {
        const payment = await service.recordPayment({
          ...parsed.data,
          proof,
          chargeId,
          requestSha256: requestHash(parsed.data),
          actorUserId: auth.userId,
        });
        return json({ payment: {
          id: payment.id, chargeId: payment.chargeId, receivedAmount: payment.receivedAmount,
          replayed: payment.replayed,
        } }, payment.replayed ? 200 : 201);
      } catch (error) { return errorResponse(error); }
    },

    async assessCandidate(request: Request, chargeId: string) {
      const auth = await access(dependencies, request); if (!auth.authenticated) return auth.response;
      if (!uuid.safeParse(chargeId).success) return json({ code: "NOT_FOUND" }, 404);
      const parsed = assessmentSchema.safeParse(await body(request));
      if (!parsed.success) return json({ code: "INVALID_INPUT", message: "Candidato invalido." }, 400);
      try {
        await service.getCharge(chargeId, auth.userId);
        const candidate = await service.prepareIssuanceCandidate({ ...parsed.data.candidate, operatorUserId: auth.userId });
        return json({ candidate: service.assessIssuanceCandidate(
          candidate,
          parsed.data.validationContext,
          auth.userId,
        ) });
      } catch (error) { return errorResponse(error); }
    },

    async issueReceipt(request: Request) {
      const auth = await access(dependencies, request); if (!auth.authenticated) return auth.response;
      const parsed = issuanceSchema.safeParse(await body(request));
      if (!parsed.success) return json({ code: "INVALID_INPUT", message: "Emissao invalida." }, 400);
      try {
        const candidate = await service.prepareIssuanceCandidate({ ...parsed.data.candidate, operatorUserId: auth.userId });
        const assessment = service.assessIssuanceCandidate(candidate, parsed.data.validationContext, auth.userId);
        if (!assessment.eligible) return json({ code: "PENDING_REQUIREMENTS", issues: assessment.issues }, 422);
        const cpf = parsed.data.validationContext.customerIdentity?.cpf?.replace(/\D/gu, "") ?? "";
        const snapshot = protectSnapshot(candidate);
        const receipt = await service.issueReceipt({
          candidate,
          validationContext: parsed.data.validationContext,
          paymentId: parsed.data.paymentId,
          customerCpfHash: createHash("sha256").update(cpf).digest("hex"),
          customerCpfEncrypted: protectText(cpf),
          snapshotPayloadSha256: snapshot.sha256,
          snapshotPayloadCiphertext: snapshot.ciphertext,
          snapshotSchemaVersion: 1,
          snapshotEncryptionVersion: 1,
          idempotencyKey: parsed.data.idempotencyKey,
          requestSha256: requestHash(parsed.data),
          replacesReceiptId: parsed.data.replacesReceiptId,
        });
        return json({ receipt: {
          id: receipt.id, status: receipt.status, series: receipt.series,
          sequence: receipt.sequence, replayed: receipt.replayed,
        } }, receipt.replayed ? 200 : 201);
      } catch (error) { return errorResponse(error); }
    },

    async getReceipt(request: Request, receiptId: string) {
      const auth = await access(dependencies, request); if (!auth.authenticated) return auth.response;
      if (!uuid.safeParse(receiptId).success) return json({ code: "NOT_FOUND" }, 404);
      try {
        const details = await service.getReceiptDetails(receiptId, auth.userId);
        return json({ receipt: {
          ...safeReceipt(details),
          managementAction: auth.userId === BUILT_IN_IDS.users.sauloXavierVitorino && details.receipt.status === "ISSUED"
            ? "CANCEL_RECEIPT" : null,
        } });
      }
      catch (error) { return errorResponse(error); }
    },

    async cancelReceipt(request: Request, receiptId: string) {
      const auth = await access(dependencies, request); if (!auth.authenticated) return auth.response;
      if (!uuid.safeParse(receiptId).success) return json({ code: "NOT_FOUND" }, 404);
      const parsed = cancellationSchema.safeParse(await body(request));
      if (!parsed.success) return json({ code: "INVALID_INPUT" }, 400);
      try {
        const receipt = await service.cancelReceipt(receiptId, auth.userId, parsed.data.reason);
        return json({ receipt: { id: receipt.id, status: receipt.status } });
      } catch (error) { return errorResponse(error); }
    },

    async refundReceipt(request: Request, receiptId: string) {
      const auth = await access(dependencies, request); if (!auth.authenticated) return auth.response;
      if (!uuid.safeParse(receiptId).success) return json({ code: "NOT_FOUND" }, 404);
      const parsed = refundSchema.safeParse(await body(request));
      if (!parsed.success) return json({ code: "INVALID_INPUT" }, 400);
      try {
        const receipt = await service.refundReceipt({
          ...parsed.data,
          receiptId,
          requestSha256: requestHash(parsed.data),
          actorUserId: auth.userId,
        });
        return json({ receipt: { id: receipt.id, status: receipt.status, replayed: receipt.replayed } }, receipt.replayed ? 200 : 201);
      } catch (error) { return errorResponse(error); }
    },

    async getPrivateProof(request: Request, receiptId: string) {
      const auth = await access(dependencies, request); if (!auth.authenticated) return auth.response;
      if (!uuid.safeParse(receiptId).success) return json({ code: "NOT_FOUND" }, 404);
      try {
        const proof = await service.getPrivateProof(receiptId, auth.userId);
        return new Response(Buffer.from(proof.bytes), {
          headers: {
            ...privateBinaryHeaders,
            "Content-Type": proof.mimeType,
            "Content-Length": String(proof.byteLength),
            ETag: `"${proof.sha256}"`,
          },
        });
      } catch (error) { return errorResponse(error); }
    },
  };
}
