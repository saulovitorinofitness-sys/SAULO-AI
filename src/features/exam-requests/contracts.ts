import type { InstitutionalDocumentIdentity } from "@/config/institution";

export const EXAM_REQUEST_KIND = "EXAM_REQUEST";
export const EXAM_REQUEST_SCHEMA_VERSION = 3;

export type ExamRequestStatus = "DRAFT" | "PUBLISHED";
export type ExamRequestHistoryAction = "CREATED" | "UPDATED" | "ISSUED";

export interface ExamRequestContent {
  readonly requestedExams: readonly string[];
  readonly justification?: string;
  readonly orientations?: string;
  readonly includePatientCpf?: boolean;
}

export interface ExamRequestHistoryEntry {
  readonly revision: number;
  readonly action: ExamRequestHistoryAction;
  readonly occurredAt: string;
  readonly actorUserId: string;
  readonly actorName: string;
  readonly content: ExamRequestContent;
}

export interface ExamRequestMetadata {
  readonly schemaVersion: 1 | 2 | typeof EXAM_REQUEST_SCHEMA_VERSION;
  readonly requestKey: string;
  readonly content: ExamRequestContent;
  readonly history: readonly ExamRequestHistoryEntry[];
  readonly issuedAt?: string;
  readonly issuedByUserId?: string;
  readonly issuedSnapshot?: ExamRequestIssuedSnapshot;
}

export interface ExamRequestPatient {
  readonly id: string;
  readonly clinicalCode: string;
  readonly fullName: string;
  readonly birthDate: string;
  readonly cpf?: string;
}

export interface ExamRequestProfessional {
  readonly userId: string;
  readonly fullName: string;
  readonly title?: string;
  readonly registrations: readonly string[];
  readonly nutritionTitle?: string;
  readonly crnRegistration?: string;
}

export interface ExamRequestIssuedSnapshot {
  readonly patient: ExamRequestPatient;
  readonly professional: {
    readonly fullName: string;
    readonly nutritionTitle?: string;
    readonly crnRegistration?: string;
  };
  readonly institution?: InstitutionalDocumentIdentity;
}

export interface ExamRequestView {
  readonly id: string;
  readonly masterRecordId: string;
  readonly status: ExamRequestStatus;
  readonly version: number;
  readonly title: string;
  readonly content: ExamRequestContent;
  readonly history: readonly ExamRequestHistoryEntry[];
  readonly patient: ExamRequestPatient;
  readonly responsibleProfessional: ExamRequestProfessional;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly issuedAt?: string;
  readonly issuedSnapshot?: ExamRequestIssuedSnapshot;
}

export interface ExamRequestPatientOption {
  readonly id: string;
  readonly clinicalCode: string;
  readonly fullName: string;
  readonly birthDate?: string;
  readonly cpf?: string;
}

export interface ExamCatalogItem {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly synonyms: readonly string[];
  readonly source: "PERSISTED";
}
