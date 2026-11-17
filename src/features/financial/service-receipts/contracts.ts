export type ServiceReceiptProviderKey =
  | "ACADEMIA_SAULO_FITNESS"
  | "SAULO_XAVIER_VITORINO"
  | "MARIA_DE_LOURDES_GOMES";

export type ServiceReceiptProviderType = "LEGAL_ENTITY" | "INDIVIDUAL";

export type ServiceReceiptCommercialUnit =
  | "CLINICA_SV"
  | "ACADEMIA_SAULO_FITNESS";

export type ServiceReceiptKind =
  | "ACADEMY_MEMBERSHIP"
  | "ACADEMY_SERVICE"
  | "NUTRITION_CONSULTATION"
  | "NUTRITION_FOLLOW_UP"
  | "NUTRITION_STRATEGY"
  | "NUTRITION_PLAN"
  | "PERSONAL_TRAINING"
  | "STRENGTH_TRAINING_PLAN"
  | "RUNNING_PLAN"
  | "CYCLING_PLAN"
  | "POSTURAL_ASSESSMENT"
  | "PHYSICAL_FOLLOW_UP";

export type ServiceReceiptPaymentMethod =
  | "PIX"
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER";

export type ServiceReceiptAction =
  | "REGISTER"
  | "ISSUE"
  | "READ"
  | "CANCEL"
  | "REFUND";

export type ServiceReceiptStatus = "ISSUED" | "CANCELLED";

export interface ServiceReceiptLegalAddress {
  readonly formattedAddress?: string;
}

export interface AcademyLegalProfile {
  readonly key: "ACADEMIA_SAULO_FITNESS";
  readonly providerType: "LEGAL_ENTITY";
  readonly taxIdType?: "CNPJ";
  readonly legalName?: string;
  readonly tradeName?: string;
  readonly cnpj?: string;
  readonly address?: ServiceReceiptLegalAddress;
}

export interface SauloLegalProfile {
  readonly key: "SAULO_XAVIER_VITORINO";
  readonly providerType: "INDIVIDUAL";
  readonly taxIdType?: "CPF";
  readonly fullName?: string;
  readonly cpf?: string;
  readonly address?: ServiceReceiptLegalAddress;
  readonly crn?: string;
  readonly cref?: string;
}

export interface MariaLegalProfile {
  readonly key: "MARIA_DE_LOURDES_GOMES";
  readonly providerType: "INDIVIDUAL";
  readonly taxIdType?: "CPF";
  readonly fullName?: string;
  readonly cpf?: string;
  readonly address?: ServiceReceiptLegalAddress;
  readonly cref?: string;
}

export type ServiceReceiptLegalProvider =
  | AcademyLegalProfile
  | SauloLegalProfile
  | MariaLegalProfile;

export interface ClinicCommercialIdentity {
  readonly unit: ServiceReceiptCommercialUnit;
  readonly commercialName?: string;
  readonly legalProviderKey?: "ACADEMIA_SAULO_FITNESS";
}

export interface ServiceReceiptExecutor {
  readonly userId: string;
  readonly professionalRegistration: "CRN" | "CREF";
  readonly professionalRegistrationStatus: "ACTIVE" | "INACTIVE";
  readonly performedActivity: string;
}

export interface ServiceReceiptItemCandidate {
  readonly serviceReferenceId: string;
  readonly kind: ServiceReceiptKind;
  readonly soldByProviderKey: ServiceReceiptProviderKey;
  readonly legalProviderKey: ServiceReceiptProviderKey;
  readonly commercialUnit?: ClinicCommercialIdentity;
  readonly executors: readonly ServiceReceiptExecutor[];
  readonly grossAmount: string;
}

export interface ServiceReceiptPaymentAllocation {
  readonly serviceReferenceId: string;
  readonly amount: string;
}

export interface ServiceReceiptPaymentCandidate {
  readonly method: ServiceReceiptPaymentMethod;
  readonly receivedByProviderKey: ServiceReceiptProviderKey;
  readonly receivedAmount: string;
  readonly previouslyReceivedAmount: string;
  readonly transactionReference?: string;
  readonly allocations: readonly ServiceReceiptPaymentAllocation[];
}

export interface ServiceReceiptTotalsCandidate {
  readonly subtotal: string;
  readonly discount: string;
  readonly surcharge: string;
  readonly amountDue: string;
}

export interface ServiceReceiptNumberingCandidate {
  readonly series: string;
  readonly sequence: number;
}

export interface ServiceReceiptSignatureCandidate {
  readonly mode: "ELECTRONIC" | "MANUAL";
  readonly signingProviderKey: ServiceReceiptProviderKey;
  readonly electronicSignatureReference?: string;
  readonly includeManualSignatureSpace: boolean;
}

export interface ServiceReceiptPrivacyCandidate {
  readonly customerCpfOnDocument: "MASKED" | "FULL";
}

export interface ServiceReceiptCustomerIdentity {
  readonly masterRecordId: string;
  readonly cpf?: string;
}

export interface ServiceReceiptCandidate {
  readonly legalProvider: ServiceReceiptLegalProvider;
  readonly customerMasterRecordId: string;
  readonly items: readonly ServiceReceiptItemCandidate[];
  readonly totals: ServiceReceiptTotalsCandidate;
  readonly payment: ServiceReceiptPaymentCandidate;
  readonly numbering: ServiceReceiptNumberingCandidate;
  readonly signature: ServiceReceiptSignatureCandidate;
  readonly privacy: ServiceReceiptPrivacyCandidate;
  readonly operatorUserId: string;
}

export interface ServiceReceiptAuthorizationContext {
  readonly legalProviderKey: ServiceReceiptProviderKey;
  readonly serviceKinds: readonly ServiceReceiptKind[];
  readonly executorUserIds: readonly string[];
  readonly activeProfessionalCouncils: readonly ("CRN" | "CREF")[];
}

export type ServiceReceiptChargeStatus =
  | "OPEN"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED";

export type ServiceReceiptEventType =
  | "DRAFT_CREATED"
  | "ISSUED"
  | "CORRECTION_ISSUED"
  | "CANCELLED"
  | "REFUNDED";

export interface IssuedServiceReceiptReference {
  readonly id: string;
  readonly legalProviderKey: ServiceReceiptProviderKey;
  readonly status: ServiceReceiptStatus;
  readonly series: string;
  readonly sequence: number;
}

export interface ServiceReceiptCancellationCommand {
  readonly receipt: IssuedServiceReceiptReference;
  readonly actorUserId: string;
  readonly reason: string;
}

export interface ServiceReceiptCorrectionLink {
  readonly cancelledReceiptId: string;
  readonly replacementReceiptId: string;
}

export interface ServiceReceiptRefundCommand {
  readonly originalPaymentReferenceId: string;
  readonly actorUserId: string;
  readonly amount: string;
  readonly reason: string;
}

export interface ServiceReceiptProofCandidate {
  readonly name: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}
