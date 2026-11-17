import type { InstitutionalDocumentIdentity } from "@/config/institution";

export const HERBAL_PRESCRIPTION_KIND = "HERBAL_PRESCRIPTION";
export const HERBAL_PRESCRIPTION_SCHEMA_VERSION = 2;

export const PRESCRIPTION_ITEM_CATEGORIES = [
  "HERBAL",
  "SUPPLEMENT",
  "OTHER_FORMULATION",
] as const;
export type PrescriptionItemCategory =
  (typeof PRESCRIPTION_ITEM_CATEGORIES)[number];

export type HerbalPrescriptionStatus = "DRAFT" | "PUBLISHED";
export type HerbalPrescriptionHistoryAction = "CREATED" | "UPDATED" | "ISSUED";

export interface HerbalPrescriptionComponent {
  readonly identification: string;
  readonly scientificName?: string;
  readonly plantPart?: string;
  readonly concentrationStandardization?: string;
}

export interface HerbalPrescriptionItem {
  readonly category: PrescriptionItemCategory;
  readonly identification: string;
  readonly scientificName?: string;
  readonly plantPart?: string;
  readonly presentation?: string;
  readonly concentrationStandardization?: string;
  readonly dose?: string;
  readonly route?: string;
  readonly frequency?: string;
  readonly duration?: string;
  readonly quantity?: string;
  readonly orientations?: string;
  readonly components: readonly HerbalPrescriptionComponent[];
}

export interface HerbalPrescriptionContent {
  readonly items: readonly HerbalPrescriptionItem[];
}

export interface HerbalPrescriptionHistoryEntry {
  readonly revision: number;
  readonly action: HerbalPrescriptionHistoryAction;
  readonly occurredAt: string;
  readonly actorUserId: string;
  readonly actorName: string;
  readonly content: HerbalPrescriptionContent;
}

export interface HerbalPrescriptionPatient {
  readonly id: string;
  readonly clinicalCode: string;
  readonly fullName: string;
  readonly birthDate: string;
}

export interface HerbalPrescriptionProfessional {
  readonly userId: string;
  readonly fullName: string;
  readonly nutritionTitle?: string;
  readonly crnRegistration?: string;
}

export interface HerbalPrescriptionIssuedSnapshot {
  readonly patient: HerbalPrescriptionPatient;
  readonly professional: Omit<HerbalPrescriptionProfessional, "userId">;
  readonly institution: InstitutionalDocumentIdentity;
}

export interface HerbalPrescriptionMetadata {
  readonly schemaVersion: 1 | typeof HERBAL_PRESCRIPTION_SCHEMA_VERSION;
  readonly prescriptionKey: string;
  readonly content: HerbalPrescriptionContent;
  readonly history: readonly HerbalPrescriptionHistoryEntry[];
  readonly issuedAt?: string;
  readonly issuedByUserId?: string;
  readonly issuedSnapshot?: HerbalPrescriptionIssuedSnapshot;
}

export interface HerbalPrescriptionView {
  readonly id: string;
  readonly masterRecordId: string;
  readonly status: HerbalPrescriptionStatus;
  readonly version: number;
  readonly title: string;
  readonly content: HerbalPrescriptionContent;
  readonly history: readonly HerbalPrescriptionHistoryEntry[];
  readonly patient: HerbalPrescriptionPatient;
  readonly responsibleProfessional: HerbalPrescriptionProfessional;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly issuedAt?: string;
  readonly issuedSnapshot?: HerbalPrescriptionIssuedSnapshot;
}

export interface HerbalPrescriptionPatientOption {
  readonly id: string;
  readonly clinicalCode: string;
  readonly fullName: string;
  readonly birthDate?: string;
}
