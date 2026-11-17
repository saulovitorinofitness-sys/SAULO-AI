export type BrandContext = "platform" | "clinic" | "academy";

export interface BrandIdentity {
  readonly id: BrandContext;
  readonly internalName: string;
  readonly displayName: string;
  readonly shortName: string;
  readonly subtitle?: string;
  readonly logoPath?: string;
  readonly logoCompactPath?: string;
  readonly faviconPath?: string;
  readonly description?: string;
  readonly isProvisional: boolean;
}

export const BRAND_IDENTITIES = {
  platform: {
    id: "platform",
    internalName: "SAULO AI",
    displayName: "Clínica SV",
    shortName: "SA",
    subtitle: "Plataforma integrada",
    isProvisional: false,
  },
  clinic: {
    id: "clinic",
    internalName: "SAULO AI",
    displayName: "Clínica SV",
    shortName: "SV",
    subtitle: "Prontuário Integrado",
    description: "Continuidade do cuidado em um prontuário único.",
    isProvisional: true,
  },
  academy: {
    id: "academy",
    internalName: "SAULO AI",
    displayName: "Academia Saulo Fitness",
    shortName: "SF",
    subtitle: "Gestão e acompanhamento",
    isProvisional: false,
  },
} as const satisfies Record<BrandContext, BrandIdentity>;

export function getBrandIdentity(context: BrandContext): BrandIdentity {
  return BRAND_IDENTITIES[context];
}
