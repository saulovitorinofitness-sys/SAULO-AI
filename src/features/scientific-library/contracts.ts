import type { SessionUser } from "@/features/mvp";

export const SCIENTIFIC_LIBRARY_AREAS = [
  "NUTRITION",
  "PERFORMANCE",
  "POSTURAL",
] as const;
export type ScientificLibraryArea =
  (typeof SCIENTIFIC_LIBRARY_AREAS)[number];

export const SCIENTIFIC_LIBRARY_DOMAINS = ["FOOD", "RECIPE", "DATA_SOURCE", "EQUATION", "ACTIVITY_FACTOR", "PATHOLOGY", "SUPPLEMENT", "FORMULATION", "LABORATORY_EXAM", "EXERCISE", "TRAINING_METHOD", "ASSESSMENT", "POSTURAL_CHANGE", "POSTURAL_CONDITION", "PROTOCOL"] as const;
export type ScientificLibraryDomain = (typeof SCIENTIFIC_LIBRARY_DOMAINS)[number];

export const SCIENTIFIC_LIBRARY_DATA_NATURES = [
  "SCIENTIFIC",
  "OFFICIAL_DATABASE",
  "PROFESSIONAL_PROTOCOL",
  "OPERATIONAL",
  "DEMONSTRATIVE",
  "LEGACY",
] as const;
export type ScientificLibraryDataNature =
  (typeof SCIENTIFIC_LIBRARY_DATA_NATURES)[number];

export const SCIENTIFIC_LIBRARY_STORAGE_KINDS = [
  "PERSISTED",
  "SHARED_DATA",
  "LOCAL_FALLBACK",
  "MOCK",
] as const;
export type ScientificLibraryStorageKind =
  (typeof SCIENTIFIC_LIBRARY_STORAGE_KINDS)[number];

export const SCIENTIFIC_LIBRARY_EDITORIAL_STATUSES = [
  "DRAFT",
  "UNDER_REVIEW",
  "APPROVED",
  "SUPERSEDED",
  "ARCHIVED",
  "REJECTED",
] as const;
export type ScientificLibraryEditorialStatus =
  (typeof SCIENTIFIC_LIBRARY_EDITORIAL_STATUSES)[number];

export const SCIENTIFIC_LIBRARY_PUBLICATION_TYPES = [
  "GUIDELINE_OR_CONSENSUS",
  "SYSTEMATIC_REVIEW_META_ANALYSIS",
  "CLINICAL_TRIAL",
  "OBSERVATIONAL_STUDY",
  "DIAGNOSTIC_STUDY",
  "BIOMECHANICAL_STUDY",
  "TECHNICAL_BOOK_OR_MANUAL",
  "OFFICIAL_DATABASE",
  "PROFESSIONAL_PROTOCOL",
  "OTHER",
  "UNCLASSIFIED",
] as const;
export type ScientificLibraryPublicationType =
  (typeof SCIENTIFIC_LIBRARY_PUBLICATION_TYPES)[number];

export const SCIENTIFIC_LIBRARY_EVIDENCE_CATEGORIES = [
  "GUIDELINE_OR_CONSENSUS",
  "SYSTEMATIC_REVIEW_META_ANALYSIS",
  "CLINICAL_TRIAL",
  "OBSERVATIONAL_STUDY",
  "DIAGNOSTIC_STUDY",
  "BIOMECHANICAL_STUDY",
  "TECHNICAL_REFERENCE",
  "OFFICIAL_DATABASE",
  "PROFESSIONAL_EXPERIENCE",
  "UNCLASSIFIED",
] as const;
export type ScientificLibraryEvidenceCategory =
  (typeof SCIENTIFIC_LIBRARY_EVIDENCE_CATEGORIES)[number];

export type ScientificLibraryUnvalidatedDataNature = Extract<
  ScientificLibraryDataNature,
  "DEMONSTRATIVE" | "LEGACY"
>;

export interface ScientificLibraryReference {
  readonly id: string;
  /** Título estruturado da fonte. */
  readonly title?: string;
  /** Nome legado do título, mantido durante a transição dos consumidores. */
  readonly sourceTitle?: string;
  readonly fullCitation?: string;
  readonly authors?: string;
  readonly institutionOrJournal?: string;
  /** Campo legado combinado; não substitui autores e instituição separados. */
  readonly authorsOrInstitution?: string;
  readonly publicationYear?: number;
  readonly doi?: string;
  readonly pmid?: string;
  readonly isbn?: string;
  readonly officialUrl?: string;
  readonly sourceVersion?: string;
  readonly evidenceDate?: string;
  readonly accessedAt?: string;
  readonly publicationType: ScientificLibraryPublicationType;
  readonly evidenceCategory: ScientificLibraryEvidenceCategory;
  /** Alias público explícito para a categoria/nível de evidência informado. */
  readonly evidenceLevel?: ScientificLibraryEvidenceCategory;
  readonly language?: string;
  readonly notes?: string;
  readonly recommendationStrength?: string;
  readonly evidenceLimitations?: string;
  readonly isPrimary?: boolean;
  readonly sortOrder: number;
}

export interface ScientificLibraryRevision {
  readonly id: string;
  readonly version: number;
  readonly snapshot: unknown;
  readonly changedByUserId?: string;
  readonly createdAt: string;
  readonly changeReason?: string;
  readonly reviewNotes?: string;
  readonly editorialStatus: ScientificLibraryEditorialStatus;
}

export interface ScientificLibraryItem {
  readonly id: string;
  readonly sourceSharedDataId?: string;
  readonly area: ScientificLibraryArea;
  readonly domain: ScientificLibraryDomain;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly source: string;
  readonly tags: readonly string[];
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
  readonly reusableBy: readonly string[];
  /** Presente somente quando houve revisão editorial real. */
  readonly reviewedAt?: string;
  /** Presente somente quando existe um responsável real pela revisão. */
  readonly reviewedBy?: string;
  readonly initiallyFavorite: boolean;
  /** Status operacional legado. ACTIVE não equivale a APPROVED. */
  readonly status?: "DRAFT" | "REVIEW" | "ACTIVE" | "INACTIVE";
  readonly originKind?: "MOCK" | "MANUAL" | "IMPORT" | "EXTERNAL";
  readonly professionalNotes?: string;
  readonly externalCode?: string;
  readonly classificationSystem?: string;
  readonly sourceVersion?: string;
  readonly responsibleProfessional?: string;
  readonly createdAt?: string;
  readonly importFileName?: string;
  /**
   * Ausente somente durante a compatibilidade com contratos legados.
   * Mocks sem classificação explícita devem ser tratados como DEMONSTRATIVE
   * ou LEGACY, nunca como SCIENTIFIC ou conteúdo editorialmente aprovado.
   */
  readonly storageKind?: ScientificLibraryStorageKind;
  readonly dataNature?: ScientificLibraryDataNature;
  readonly editorialStatus?: ScientificLibraryEditorialStatus;
  readonly publicationType?: ScientificLibraryPublicationType;
  readonly evidenceCategory?: ScientificLibraryEvidenceCategory;
  readonly technicalContent?: string;
  readonly professionalApplication?: string;
  readonly targetPopulation?: string;
  readonly indications?: string;
  readonly contraindications?: string;
  readonly precautions?: string;
  readonly limitations?: string;
  readonly submittedForReviewAt?: string;
  readonly approvedAt?: string;
  /** Identificador presente somente quando existe uma revisão real. */
  readonly reviewedByUserId?: string;
  readonly approvedByUserId?: string;
  readonly editorialVersion?: number;
  readonly changeReason?: string;
  readonly reviewNotes?: string;
  readonly references?: readonly ScientificLibraryReference[];
  readonly revisions?: readonly ScientificLibraryRevision[];
}

export interface ScientificLibraryView {
  readonly connectedProfessional: string;
  readonly lastUpdatedAt: string;
  readonly items: readonly ScientificLibraryItem[];
  readonly domains: readonly ScientificLibraryDomain[];
}

export interface ScientificLibraryGateway {
  canAccess(user: SessionUser): boolean;
  getView(user: SessionUser): Promise<ScientificLibraryView | null>;
}
