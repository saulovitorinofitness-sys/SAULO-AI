import type {
  AuditableRecord,
  EntityId,
  ISODateTime,
  JsonValue,
} from "../shared";

export type DocumentStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "GENERATING"
  | "READY"
  | "FAILED"
  | "ARCHIVED";

export type DocumentKind =
  | "NUTRITION"
  | "PHYSICAL_ASSESSMENT"
  | "POSTURAL_ASSESSMENT"
  | "PERFORMANCE"
  | "INTEGRATED";

export type DocumentModule =
  | "NUTRITION"
  | "PHYSICAL_ASSESSMENT"
  | "POSTURAL_ASSESSMENT"
  | "PERFORMANCE";

export type DocumentSectionStatus =
  | "NOT_AVAILABLE"
  | "PENDING"
  | "DRAFT"
  | "APPROVED"
  | "EXCLUDED";

export type DocumentOutputFormat =
  | "PDF"
  | "HTML";

export interface DocumentSection {
  readonly id: string;
  readonly module: DocumentModule;
  readonly key: string;
  readonly title: string;
  readonly sequence: number;
  readonly status: DocumentSectionStatus;

  /*
   * Referência ao dado original.
   * O Motor de Documentos não deve duplicar nem substituir
   * o registro clínico do módulo responsável.
   */
  readonly sourceEntityId?: EntityId;
  readonly sourceEntityType?: string;
  readonly sourceVersion?: number;

  /*
   * Conteúdo preparado somente para apresentação.
   */
  readonly content?: JsonValue;

  readonly approvedByUserId?: EntityId;
  readonly approvedAt?: ISODateTime;
}

export interface DocumentProfessional {
  readonly userId: EntityId;
  readonly fullName: string;
  readonly qualifications: readonly string[];
  readonly registrations: readonly string[];
  readonly responsibilities: readonly DocumentModule[];
  readonly signatureData?: string;
}

export interface DocumentInstitution {
  readonly displayName: string;
  readonly subtitle?: string;
  readonly logoPath?: string;
  readonly whatsapp?: string;
  readonly website?: string;
  readonly socialNetworks: readonly string[];
}

export interface DocumentFailure {
  readonly code: string;
  readonly message: string;
  readonly occurredAt: ISODateTime;
}

export interface ClinicalDocument extends AuditableRecord {
  readonly masterRecordId: EntityId;
  readonly patientId: EntityId;
  readonly attendanceId?: EntityId;

  readonly requestedByUserId: EntityId;
  readonly kind: DocumentKind;
  readonly title: string;

  /*
   * Apenas módulos realmente realizados e aprovados devem entrar.
   * Não criar páginas vazias.
   */
  readonly includedModules: readonly DocumentModule[];

  readonly sections: readonly DocumentSection[];
  readonly professionals: readonly DocumentProfessional[];
  readonly institution: DocumentInstitution;

  readonly parameters?: JsonValue;
  readonly outputFormat?: DocumentOutputFormat;
  readonly status: DocumentStatus;

  readonly requestedAt: ISODateTime;
  readonly approvedAt?: ISODateTime;
  readonly generatedAt?: ISODateTime;

  readonly storageKey?: string;
  readonly failure?: DocumentFailure;

  /*
   * Permite detectar se algum módulo foi alterado após a montagem
   * do documento.
   */
  readonly sourceVersions: Readonly<
    Partial<Record<DocumentModule, number>>
  >;
}

export interface CreateClinicalDocumentInput {
  readonly masterRecordId: EntityId;
  readonly patientId: EntityId;
  readonly attendanceId?: EntityId;
  readonly requestedByUserId: EntityId;
  readonly kind: DocumentKind;
  readonly title: string;
  readonly includedModules: readonly DocumentModule[];
  readonly parameters?: JsonValue;
}

export interface DocumentRepository {
  findById(id: EntityId): Promise<ClinicalDocument | null>;

  findByAttendanceId(
    attendanceId: EntityId,
  ): Promise<readonly ClinicalDocument[]>;

  create(
    input: CreateClinicalDocumentInput,
  ): Promise<ClinicalDocument>;

  updateStatus(
    id: EntityId,
    status: DocumentStatus,
  ): Promise<ClinicalDocument>;
}