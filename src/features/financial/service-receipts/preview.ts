import { prisma } from "@/lib/database/prisma";
import { BUILT_IN_IDS } from "@/modules/permissions";

import type { ServiceReceiptProviderKey } from "./contracts";
import { parseRegistrationPlaintext, revealIssuerValue } from "./issuer-configuration";
import { issuerConfigurationService } from "./issuer-configuration-service";
import {
  professionalServiceReceiptService,
  ProfessionalServiceReceiptServiceError,
} from "./service";

export interface ProfessionalReceiptPreview {
  readonly chargeId: string;
  readonly documentNumber: "Não emitido";
  readonly customer: { readonly fullName: string; readonly clinicalCode: string; readonly cpf: string | null };
  readonly issuer: {
    readonly key: ServiceReceiptProviderKey;
    readonly name: string;
    readonly documentLabel: "CPF" | "CNPJ";
    readonly document: string | null;
    readonly address: string | null;
    readonly registrations: readonly {
      readonly council: "CRN" | "CREF";
      readonly number: string | null;
      readonly category: string | null;
      readonly state: string | null;
    }[];
  };
  readonly services: readonly {
    readonly description: string;
    readonly serviceDate: string;
    readonly executorName: string | null;
    readonly performedActivity: string | null;
  }[];
  readonly amount: string | null;
  readonly payment: { readonly method: string | null; readonly recordedAt: string | null; readonly transactionReference: string | null };
  readonly missingData: readonly string[];
}

export interface ProfessionalReceiptPreviewSource {
  readonly chargeId: string;
  readonly status: string;
  readonly existingReceiptId: string | null;
  readonly customer: ProfessionalReceiptPreview["customer"];
  readonly issuer: ProfessionalReceiptPreview["issuer"];
  readonly services: ProfessionalReceiptPreview["services"];
  readonly payment: {
    readonly receivedAmount: string;
    readonly method: string | null;
    readonly recordedAt: string;
    readonly transactionReference: string | null;
  } | null;
}

export interface ProfessionalReceiptPreviewReader {
  findPreviewSource(chargeId: string): Promise<ProfessionalReceiptPreviewSource | null>;
}

function maskedCpf(value: string | null): string | null {
  const digits = value?.replace(/\D/gu, "") ?? "";
  return digits.length === 11 ? `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**` : null;
}

function addressLine(address: { readonly street: string; readonly number: string; readonly complement: string; readonly neighborhood: string; readonly city: string; readonly state: string; readonly postalCode: string }): string | null {
  const complete = [address.street, address.number, address.neighborhood, address.city].every((value) => value.trim())
    && /^\d{8}$/u.test(address.postalCode.replace(/\D/gu, ""))
    && /^[A-Z]{2}$/u.test(address.state.trim().toUpperCase());
  if (!complete) return null;
  const street = [address.street, address.number].filter(Boolean).join(", ");
  const locality = [address.neighborhood, [address.city, address.state].filter(Boolean).join("/")].filter(Boolean).join(" · ");
  const parts = [street, address.complement, locality, address.postalCode ? `CEP ${address.postalCode}` : ""].filter(Boolean);
  return parts.join(" · ");
}

const paymentMethodLabel: Record<string, string | null> = {
  CASH: "Dinheiro", PIX: "PIX", DEBIT_CARD: "Cartão de débito", CREDIT_CARD: "Cartão de crédito",
  BANK_TRANSFER: "Transferência bancária", BANK_DEPOSIT: "Depósito bancário", BOLETO: "Boleto", OTHER: "Outro",
};

function providerKey(provider: { type: string; userId: string | null }): ServiceReceiptProviderKey {
  if (provider.type === "LEGAL_ENTITY") return "ACADEMIA_SAULO_FITNESS";
  return provider.userId === BUILT_IN_IDS.users.sauloXavierVitorino ? "SAULO_XAVIER_VITORINO" : "MARIA_DE_LOURDES_GOMES";
}

export function createProfessionalReceiptPreviewService(
  reader: ProfessionalReceiptPreviewReader,
  authorizeRead: (chargeId: string, actorUserId: string) => Promise<unknown>,
) {
  return {
    async getPreview(chargeId: string, actorUserId: string): Promise<ProfessionalReceiptPreview> {
      await authorizeRead(chargeId, actorUserId);
      const source = await reader.findPreviewSource(chargeId);
      if (!source) throw new ProfessionalServiceReceiptServiceError("NOT_FOUND", "Recebimento não encontrado.");
      if (source.existingReceiptId) throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", "Este recebimento já possui recibo emitido; abra o documento oficial.");
      if (source.status === "CANCELLED") throw new ProfessionalServiceReceiptServiceError("VALIDATION_FAILED", "Recebimento cancelado não possui prévia de recibo.");

      const missingData: string[] = [];
      if (!source.customer.cpf) missingData.push("CPF do cliente");
      if (!source.issuer.document) missingData.push(`${source.issuer.documentLabel} da emissora`);
      if (!source.issuer.address) missingData.push("Endereço completo da emissora");
      if (source.issuer.registrations.some((item) => !item.number || !item.category || !item.state)) missingData.push("Registro profissional da emissora");
      if (source.services.length === 0) missingData.push("Serviço vinculado à cobrança");
      if (!source.payment) missingData.push("Pagamento do recebimento");
      if (source.payment && !source.payment.method) missingData.push("Forma de pagamento");

      return {
        chargeId: source.chargeId,
        documentNumber: "Não emitido",
        customer: source.customer,
        issuer: source.issuer,
        services: source.services,
        amount: source.payment?.receivedAmount ?? null,
        payment: { method: source.payment?.method ?? null, recordedAt: source.payment?.recordedAt ?? null, transactionReference: source.payment?.transactionReference ?? null },
        missingData,
      };
    },
  };
}

export const professionalReceiptPreviewReader: ProfessionalReceiptPreviewReader = {
  async findPreviewSource(chargeId) {
    const [charge, configuration] = await Promise.all([
      prisma.professionalServiceCharge.findUnique({
        where: { id: chargeId },
        include: {
          legalProvider: { select: { type: true, userId: true } },
          masterRecord: { select: { patient: { select: { fullName: true, clinicalCode: true, cpf: true } } } },
          items: { orderBy: { createdAt: "asc" }, include: { executors: { include: { professional: { select: { fullName: true } } } } } },
          payments: { orderBy: { recordedAt: "asc" }, include: {
            financialSettlement: { include: { paymentMethod: { select: { type: true } } } },
            receipts: { where: { status: { not: "DRAFT" } }, select: { id: true } },
          } },
        },
      }),
      issuerConfigurationService.getConfiguration(BUILT_IN_IDS.users.sauloXavierVitorino),
    ]);
    if (!charge) return null;
    const key = providerKey(charge.legalProvider);
    const profile = key === "ACADEMIA_SAULO_FITNESS" ? configuration.academy : key === "SAULO_XAVIER_VITORINO" ? configuration.saulo : configuration.maria;
    const payment = charge.payments.find((item) => item.receipts.length === 0) ?? null;
    const isAcademy = profile.section === "ACADEMY";
    const registrationRecords = charge.legalProvider.userId ? await prisma.serviceProfessionalRegistration.findMany({
      where: { userId: charge.legalProvider.userId, council: { in: key === "SAULO_XAVIER_VITORINO" ? ["CRN", "CREF"] : ["CREF"] } },
      orderBy: { updatedAt: "desc" },
      select: { council: true, registrationEncrypted: true, regionCode: true },
    }) : [];
    const expectedCouncils = key === "SAULO_XAVIER_VITORINO" ? ["CRN", "CREF"] as const : ["CREF"] as const;
    return {
      chargeId: charge.id,
      status: charge.status,
      existingReceiptId: charge.payments.flatMap((item) => item.receipts)[0]?.id ?? null,
      customer: { fullName: charge.masterRecord.patient.fullName, clinicalCode: charge.masterRecord.patient.clinicalCode, cpf: maskedCpf(charge.masterRecord.patient.cpf) },
      issuer: {
        key,
        name: isAcademy ? profile.legalName : profile.fullName,
        documentLabel: isAcademy ? "CNPJ" : "CPF",
        document: isAcademy ? profile.cnpj.masked : profile.cpf.masked,
        address: addressLine(profile.address),
        registrations: isAcademy ? [] : expectedCouncils.map((council) => {
          const record = registrationRecords.find((candidate) => candidate.council === council);
          const saved = parseRegistrationPlaintext(revealIssuerValue(record?.registrationEncrypted));
          return {
            council,
            number: saved?.number || null,
            category: saved?.category || null,
            state: record?.regionCode || null,
          };
        }),
      },
      services: charge.items.map((item) => ({ description: item.description, serviceDate: item.serviceDate.toISOString(), executorName: item.executors[0]?.professional.fullName ?? null, performedActivity: item.executors[0]?.performedActivity ?? null })),
      payment: payment ? {
        receivedAmount: payment.receivedAmount.toFixed(2),
        method: paymentMethodLabel[payment.financialSettlement.paymentMethod.type] ?? null,
        recordedAt: payment.recordedAt.toISOString(),
        transactionReference: payment.transactionReference,
      } : null,
    };
  },
};

export const professionalReceiptPreviewService = createProfessionalReceiptPreviewService(
  professionalReceiptPreviewReader,
  (chargeId, actorUserId) => professionalServiceReceiptService.getCharge(chargeId, actorUserId),
);
