import { institutionalProfessionalFor } from "@/config/institution";

import { professionalResponsibilityService } from "./service";

export interface PhysicalDocumentProfessionalIdentity {
  readonly userId: string;
  readonly fullName: string;
  readonly title?: string;
  readonly registrations: readonly string[];
  readonly phone?: string;
  readonly instagram?: string;
}

function professionalRegistrations(values: readonly string[]) {
  return values
    .flatMap((value) => value.split(/[|;·,]/u))
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Usa os dados profissionais do autor persistido da avaliação ou plano.
 */
export async function physicalDocumentProfessionalIdentity(
  userId: string,
  fallbackName: string,
): Promise<PhysicalDocumentProfessionalIdentity> {
  const [profile, institutional] = await Promise.all([
    professionalResponsibilityService.getProfessional(userId),
    Promise.resolve(institutionalProfessionalFor(userId)),
  ]);
  const registrations = professionalRegistrations([
    ...(profile?.professionalRegistration
      ? [profile.professionalRegistration]
      : []),
    ...(institutional?.registrations ?? []),
  ]).filter((value, index, all) => all.indexOf(value) === index);
  const institutionalTitles = institutional?.qualifications ?? [];
  const profileTitle = profile?.professionalTitle?.trim();
  const title = profileTitle || institutionalTitles.join(" · ") || undefined;

  return {
    userId,
    fullName: profile?.fullName ?? institutional?.fullName ?? fallbackName,
    title,
    registrations,
    phone: profile?.phone,
    instagram: profile?.instagram,
  };
}
