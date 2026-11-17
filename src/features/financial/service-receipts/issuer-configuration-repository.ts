import { prisma } from "@/lib/database/prisma";
import { BUILT_IN_IDS } from "@/modules/permissions";
import { assertCpfAvailableForPerson } from "@/features/identity/cpf-ownership";

import type { ServiceReceiptCandidate, ServiceReceiptProviderKey } from "./contracts";
import {
  completeAddress,
  emptyAddress,
  formattedAddress,
  isValidCnpj,
  isValidCpf,
  maskCnpj,
  maskCpf,
  maskRegistration,
  onlyDigits,
  parseRegistrationPlaintext,
  protectIssuerValue,
  registrationPlaintext,
  revealIssuerValue,
  type IndividualIssuerConfiguration,
  type IssuerAddress,
  type IssuerConfigurationStatus,
  type IssuerConfigurationView,
  type MaskedProfessionalRegistration,
  type RegistrationDraft,
  type SaveIssuerConfigurationInput,
} from "./issuer-configuration";

const ACADEMY_CODE = "ACADEMIA";
const CLINIC_CODE = "CLINICA_SV";

const userBySection = {
  SAULO: BUILT_IN_IDS.users.sauloXavierVitorino,
  MARIA: BUILT_IN_IDS.users.mariaDeLourdesGomes,
} as const;

type IndividualSection = keyof typeof userBySection;

export class IssuerConfigurationRepositoryError extends Error {
  constructor(readonly code: "NOT_FOUND" | "PERSISTENCE_CONFLICT", message: string) {
    super(message);
    this.name = "IssuerConfigurationRepositoryError";
  }
}

export interface IssuanceLegalProviderProfile {
  readonly status: IssuerConfigurationStatus;
  readonly legalProvider: ServiceReceiptCandidate["legalProvider"] | null;
}

export interface IssuerConfigurationRepository {
  getConfiguration(): Promise<IssuerConfigurationView>;
  saveConfiguration(input: SaveIssuerConfigurationInput): Promise<IssuerConfigurationView>;
  getIssuanceProfile(providerKey: ServiceReceiptProviderKey): Promise<IssuanceLegalProviderProfile>;
}

function addressFrom(record: {
  addressPostalCode?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
} | null | undefined): IssuerAddress {
  if (!record) return emptyAddress();
  return {
    postalCode: record.addressPostalCode ?? "",
    street: record.addressStreet ?? "",
    number: record.addressNumber ?? "",
    complement: record.addressComplement ?? "",
    neighborhood: record.addressNeighborhood ?? "",
    city: record.addressCity ?? "",
    state: record.addressState ?? "",
  };
}

function addressData(address: IssuerAddress) {
  return {
    addressPostalCode: onlyDigits(address.postalCode) || null,
    addressStreet: address.street.trim() || null,
    addressNumber: address.number.trim() || null,
    addressComplement: address.complement.trim() || null,
    addressNeighborhood: address.neighborhood.trim() || null,
    addressCity: address.city.trim() || null,
    addressState: address.state.trim().toUpperCase() || null,
  };
}

function sectionStatus(active: boolean, complete: boolean): IssuerConfigurationStatus {
  if (!active) return "INACTIVE";
  return complete ? "COMPLETE" : "INCOMPLETE";
}

async function ensureAcademyProvider() {
  const unit = await prisma.businessUnit.findUnique({ where: { code: ACADEMY_CODE }, select: { id: true } });
  if (!unit) throw new IssuerConfigurationRepositoryError("NOT_FOUND", "Unidade da Academia nao encontrada.");
  return prisma.professionalServiceLegalProvider.upsert({
    where: { businessUnitId: unit.id },
    create: { type: "LEGAL_ENTITY", businessUnitId: unit.id, status: "ACTIVE" },
    update: {},
    select: { id: true },
  });
}

async function saveRegistration(userId: string, council: "CRN" | "CREF", draft: RegistrationDraft | undefined) {
  if (!draft) return;
  const existing = await prisma.serviceProfessionalRegistration.findFirst({
    where: { userId, council },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!draft.number || !draft.category || !draft.state) {
    if (existing) {
      await prisma.serviceProfessionalRegistration.update({ where: { id: existing.id }, data: { status: draft.status } });
    }
    return;
  }
  const protectedRegistration = protectIssuerValue(registrationPlaintext(draft));
  const data = {
    registrationHash: protectedRegistration.hash,
    registrationEncrypted: protectedRegistration.encrypted,
    regionCode: draft.state.trim().toUpperCase(),
    status: draft.status,
  } as const;
  if (existing) await prisma.serviceProfessionalRegistration.update({ where: { id: existing.id }, data });
  else await prisma.serviceProfessionalRegistration.create({ data: { userId, council, ...data } });
}

async function saveIndividual(input: Extract<SaveIssuerConfigurationInput, { section: IndividualSection }>) {
  const userId = userBySection[input.section];
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new IssuerConfigurationRepositoryError("NOT_FOUND", "Usuario vinculado nao encontrado.");
  const protectedCpf = input.cpf ? protectIssuerValue(onlyDigits(input.cpf)) : null;
  await prisma.$transaction(async (transaction) => {
    if (input.cpf) {
      const currentProvider = await transaction.professionalServiceLegalProvider.findUnique({
        where: { userId },
        select: { id: true, employeeId: true },
      });
      await assertCpfAvailableForPerson(input.cpf, {
        userId,
        providerId: currentProvider?.id,
        employeeId: currentProvider?.employeeId ?? undefined,
      }, transaction);
    }
    await transaction.user.update({ where: { id: userId }, data: { fullName: input.fullName.trim() } });
    await transaction.professionalServiceLegalProvider.upsert({
      where: { userId },
      create: {
        type: "INDIVIDUAL",
        userId,
        taxIdType: protectedCpf ? "CPF" : null,
        taxIdHash: protectedCpf?.hash,
        taxIdEncrypted: protectedCpf?.encrypted,
        ...addressData(input.address),
        status: input.active ? "ACTIVE" : "INACTIVE",
      },
      update: {
        ...(protectedCpf ? { taxIdType: "CPF" as const, taxIdHash: protectedCpf.hash, taxIdEncrypted: protectedCpf.encrypted } : {}),
        ...addressData(input.address),
        status: input.active ? "ACTIVE" : "INACTIVE",
      },
    });
  });
  if (input.section === "SAULO") await saveRegistration(userId, "CRN", input.crn);
  await saveRegistration(userId, "CREF", input.cref);
}

async function readConfiguration(): Promise<IssuerConfigurationView> {
  const [academy, sauloUser, mariaUser] = await Promise.all([
    prisma.businessUnit.findUnique({
      where: { code: ACADEMY_CODE },
      include: {
        professionalServiceProviders: {
          where: { type: "LEGAL_ENTITY" },
          include: { commercialUnits: { where: { code: CLINIC_CODE } } },
          take: 1,
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: userBySection.SAULO },
      include: {
        professionalServiceLegalProviders: { where: { type: "INDIVIDUAL" }, take: 1 },
        serviceProfessionalRegistrations: { where: { council: { in: ["CRN", "CREF"] } }, orderBy: { updatedAt: "desc" } },
      },
    }),
    prisma.user.findUnique({
      where: { id: userBySection.MARIA },
      include: {
        professionalServiceLegalProviders: { where: { type: "INDIVIDUAL" }, take: 1 },
        serviceProfessionalRegistrations: { where: { council: "CREF" }, orderBy: { updatedAt: "desc" } },
      },
    }),
  ]);

  const academyProvider = academy?.professionalServiceProviders[0];
  const clinic = academyProvider?.commercialUnits[0];
  const academyAddress = addressFrom(academy);
  const academyCnpj = revealIssuerValue(academy?.legalTaxIdEncrypted);
  const academyActive = academy?.status === "ACTIVE";
  const academyComplete = Boolean(
    academy?.legalName?.trim() && academy.tradeName?.trim() && academyCnpj && isValidCnpj(academyCnpj)
    && completeAddress(academyAddress),
  );

  function individualView(section: IndividualSection, user: typeof sauloUser): IndividualIssuerConfiguration {
    const provider = user?.professionalServiceLegalProviders[0];
    const cpf = revealIssuerValue(provider?.taxIdEncrypted);
    const address = addressFrom(provider);
    const allowedCouncils = section === "SAULO" ? ["CRN", "CREF"] as const : ["CREF"] as const;
    const registrations = allowedCouncils.map((council): MaskedProfessionalRegistration => {
      const record = user?.serviceProfessionalRegistrations.find((candidate) => candidate.council === council);
      const parsed = parseRegistrationPlaintext(revealIssuerValue(record?.registrationEncrypted));
      return {
        council,
        configured: Boolean(parsed),
        masked: maskRegistration(parsed?.number ?? null),
        category: parsed?.category ?? "",
        state: record?.regionCode ?? "",
        status: record?.status ?? "INACTIVE",
      };
    });
    const active = provider?.status === "ACTIVE";
    const requiredRegistrations = section === "SAULO" ? registrations : registrations.filter((item) => item.council === "CREF");
    const complete = Boolean(
      user && user.status === "ACTIVE" && user.fullName.trim() && cpf && isValidCpf(cpf) && completeAddress(address)
      && requiredRegistrations.every((registration) => registration.configured && registration.status === "ACTIVE"),
    );
    return {
      section,
      userId: userBySection[section],
      userLinked: Boolean(user),
      fullName: user?.fullName ?? "",
      cpf: { configured: Boolean(cpf), masked: maskCpf(cpf) },
      address,
      active,
      registrations,
      status: provider ? sectionStatus(active, complete) : "INCOMPLETE",
    };
  }

  const clinicActive = clinic?.active ?? false;
  const clinicComplete = Boolean(clinic?.commercialName.trim() && clinic.code === CLINIC_CODE && academyProvider && academyComplete);
  return {
    academy: {
      section: "ACADEMY",
      personType: "Pessoa jurídica",
      legalName: academy?.legalName ?? "",
      tradeName: academy?.tradeName ?? "",
      cnpj: { configured: Boolean(academyCnpj), masked: maskCnpj(academyCnpj) },
      address: academyAddress,
      active: academyActive,
      status: academy ? sectionStatus(academyActive, academyComplete) : "INCOMPLETE",
    },
    clinic: {
      section: "CLINIC",
      commercialName: clinic?.commercialName ?? "",
      internalCode: clinic?.code ?? CLINIC_CODE,
      academyLinked: Boolean(academyProvider),
      active: clinicActive,
      status: clinic ? sectionStatus(clinicActive, clinicComplete) : "INCOMPLETE",
    },
    saulo: individualView("SAULO", sauloUser),
    maria: individualView("MARIA", mariaUser),
  };
}

export const issuerConfigurationRepository: IssuerConfigurationRepository = {
  getConfiguration: readConfiguration,

  async saveConfiguration(input) {
    if (input.section === "ACADEMY") {
      const unit = await prisma.businessUnit.findUnique({ where: { code: ACADEMY_CODE }, select: { id: true } });
      if (!unit) throw new IssuerConfigurationRepositoryError("NOT_FOUND", "Unidade da Academia nao encontrada.");
      const protectedCnpj = input.cnpj ? protectIssuerValue(onlyDigits(input.cnpj)) : null;
      await prisma.$transaction(async (transaction) => {
        await transaction.businessUnit.update({
          where: { id: unit.id },
          data: {
            legalName: input.legalName.trim() || null,
            tradeName: input.tradeName.trim() || null,
            ...(protectedCnpj ? { legalTaxIdType: "CNPJ" as const, legalTaxIdEncrypted: protectedCnpj.encrypted } : {}),
            ...addressData(input.address),
            status: input.active ? "ACTIVE" : "INACTIVE",
          },
        });
        await transaction.professionalServiceLegalProvider.upsert({
          where: { businessUnitId: unit.id },
          create: { type: "LEGAL_ENTITY", businessUnitId: unit.id, status: input.active ? "ACTIVE" : "INACTIVE" },
          update: { status: input.active ? "ACTIVE" : "INACTIVE" },
        });
      });
    } else if (input.section === "CLINIC") {
      const provider = await ensureAcademyProvider();
      await prisma.professionalServiceCommercialUnit.upsert({
        where: { legalProviderId_code: { legalProviderId: provider.id, code: CLINIC_CODE } },
        create: { legalProviderId: provider.id, code: CLINIC_CODE, commercialName: input.commercialName.trim(), active: input.active },
        update: { commercialName: input.commercialName.trim(), active: input.active },
      });
    } else {
      await saveIndividual(input);
    }
    return readConfiguration();
  },

  async getIssuanceProfile(providerKey) {
    const configuration = await readConfiguration();
    if (providerKey === "ACADEMIA_SAULO_FITNESS") {
      const cnpj = revealIssuerValue((await prisma.businessUnit.findUnique({ where: { code: ACADEMY_CODE }, select: { legalTaxIdEncrypted: true } }))?.legalTaxIdEncrypted);
      return {
        status: configuration.academy.status,
        legalProvider: cnpj ? {
          key: providerKey,
          providerType: "LEGAL_ENTITY",
          taxIdType: "CNPJ",
          legalName: configuration.academy.legalName,
          tradeName: configuration.academy.tradeName,
          cnpj,
          address: { formattedAddress: formattedAddress(configuration.academy.address) },
        } : null,
      };
    }
    const individual = providerKey === "SAULO_XAVIER_VITORINO" ? configuration.saulo : configuration.maria;
    const provider = await prisma.professionalServiceLegalProvider.findUnique({
      where: { userId: individual.userId },
      select: { taxIdEncrypted: true },
    });
    const registrationRecords = await prisma.serviceProfessionalRegistration.findMany({
      where: { userId: individual.userId, council: { in: ["CRN", "CREF"] }, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: { council: true, registrationEncrypted: true, regionCode: true },
    });
    const cpf = revealIssuerValue(provider?.taxIdEncrypted);
    const registration = (council: "CRN" | "CREF") => {
      const record = registrationRecords.find((candidate) => candidate.council === council);
      const parsed = parseRegistrationPlaintext(revealIssuerValue(record?.registrationEncrypted));
      return parsed ? `${council} ${parsed.number} ${parsed.category}/${record?.regionCode}` : undefined;
    };
    return {
      status: individual.status,
      legalProvider: cpf ? {
        key: providerKey,
        providerType: "INDIVIDUAL",
        taxIdType: "CPF",
        fullName: individual.fullName,
        cpf,
        ...(providerKey === "SAULO_XAVIER_VITORINO" ? { crn: registration("CRN") } : {}),
        cref: registration("CREF"),
        address: { formattedAddress: formattedAddress(individual.address) },
      } : null,
    };
  },
};
