export interface PersistedProfessionalReference {
  readonly id: string;
  readonly fullName: string;
}

/** Prioriza a autoria imutável da versão; o atualizador é fallback legado. */
export function persistedProfessionalReference(
  versionResponsible: PersistedProfessionalReference | null | undefined,
  legacyUpdatedBy: PersistedProfessionalReference,
): PersistedProfessionalReference {
  return versionResponsible ?? legacyUpdatedBy;
}
