import { getBrandIdentity } from "./branding";
import { BUILT_IN_IDS } from "@/modules/permissions";

export interface InstitutionalProfessionalConfiguration {
  readonly fullName: string;
  readonly qualifications: readonly string[];
  readonly registrations: readonly string[];
}

export interface InstitutionalAddressConfiguration {
  readonly street: string;
  readonly number: string;
  readonly complement?: string;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
}

export interface InstitutionalContactConfiguration {
  readonly label: string;
  readonly value: string;
}

export interface InstitutionalDocumentIdentity {
  readonly displayName: string;
  readonly shortName: string;
  readonly documentSubtitle: string;
  readonly address: InstitutionalAddressConfiguration;
  readonly contacts: readonly InstitutionalContactConfiguration[];
  readonly website: string;
}

/**
 * Fonte única dos dados institucionais exibidos em entregáveis.
 * Contatos não confirmados permanecem ausentes e nunca recebem placeholders.
 */
export const CLINIC_INSTITUTIONAL_CONFIG = {
  brand: getBrandIdentity("clinic"),
  documentSubtitle: "Sistema Integrado SV",
  address: {
    street: "Rua Raimundo Saraiva Coelho",
    number: "281",
    neighborhood: "Aeroporto",
    city: "Juazeiro do Norte",
    state: "CE",
    postalCode: "63020-730",
  },
  website: "www.saulovitorino.com.br",
  whatsapp: "(88) 98884-7746",
  contacts: [
    { label: "WhatsApp principal", value: "(88) 98884-7746" },
    { label: "WhatsApp adicional", value: "(88) 99999-1074" },
  ],
  socialNetworks: [] as readonly string[],
  professionals: {
    [BUILT_IN_IDS.users.sauloXavierVitorino]: {
      fullName: "Saulo Xavier Vitorino",
      qualifications: ["Nutricionista", "Profissional de Educação Física"],
      registrations: ["CRN 11 — 22529/P-CE", "CREF 3918/G"],
    },
  },
} as const;

export function formatInstitutionalAddress(
  address: InstitutionalAddressConfiguration,
) {
  const street = `${address.street}, ${address.number}`;
  const locality = `${address.neighborhood} · ${address.city}/${address.state}`;
  return [street, address.complement, locality, `CEP ${address.postalCode}`]
    .filter(Boolean)
    .join(" · ");
}

export function clinicInstitutionalDocumentIdentity(): InstitutionalDocumentIdentity {
  return {
    displayName: CLINIC_INSTITUTIONAL_CONFIG.brand.displayName,
    shortName: CLINIC_INSTITUTIONAL_CONFIG.brand.shortName,
    documentSubtitle: CLINIC_INSTITUTIONAL_CONFIG.documentSubtitle,
    address: { ...CLINIC_INSTITUTIONAL_CONFIG.address },
    contacts: CLINIC_INSTITUTIONAL_CONFIG.contacts.map((contact) => ({ ...contact })),
    website: CLINIC_INSTITUTIONAL_CONFIG.website,
  };
}

export function institutionalProfessionalFor(userId?: string) {
  if (!userId) return undefined;
  return CLINIC_INSTITUTIONAL_CONFIG.professionals[
    userId as keyof typeof CLINIC_INSTITUTIONAL_CONFIG.professionals
  ];
}
