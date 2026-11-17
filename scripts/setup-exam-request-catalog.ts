import { Prisma } from "../src/generated/prisma/client";
import {
  LABORATORY_EXAM_CATALOG,
  normalizeLaboratoryExamCatalogName,
} from "../src/features/exam-requests/laboratory-exam-catalog";
import { prisma } from "../src/lib/database/prisma";
import { BUILT_IN_IDS } from "../src/modules/permissions";

const professionalUserId = BUILT_IN_IDS.users.sauloXavierVitorino;
const confirmedCrn = "CRN 11 — 22529/P-CE";

function registrationParts(value: string | null | undefined) {
  return (value ?? "")
    .split(/[|;,·]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function catalogMetadata(category: string, synonyms: readonly string[]): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify({
    category,
    synonyms,
    attributes: { category, synonyms },
    reusableBy: ["Solicitações de exames"],
    catalogPurpose: "Seleção manual; sem decisão clínica automática",
  })) as Prisma.InputJsonValue;
}

const duplicateNames = LABORATORY_EXAM_CATALOG
  .map((item) => normalizeLaboratoryExamCatalogName(item.name))
  .filter((name, index, all) => all.indexOf(name) !== index);
if (duplicateNames.length) throw new Error(`Nomes duplicados no catálogo: ${duplicateNames.join(", ")}`);

const professional = await prisma.user.findUnique({
  where: { id: professionalUserId },
  select: {
    id: true,
    fullName: true,
    profile: { select: { professionalRegistration: true, professionalTitle: true } },
  },
});
if (!professional) throw new Error("Profissional Saulo Xavier Vitorino não encontrado.");

const preservedRegistrations = registrationParts(professional.profile?.professionalRegistration)
  .filter((registration) => !/^CRN(?:\b|[- ])/iu.test(registration));
const professionalRegistration = [confirmedCrn, ...preservedRegistrations].join(" | ");

await prisma.userProfile.update({
  where: { userId: professional.id },
  data: {
    professionalTitle: "Nutricionista",
    professionalRegistration,
  },
});

const normalizedNames = LABORATORY_EXAM_CATALOG.map((item) =>
  normalizeLaboratoryExamCatalogName(item.name),
);
const existing = await prisma.scientificLibraryRecord.findMany({
  where: {
    createdByUserId: professional.id,
    area: "NUTRITION",
    domain: "LABORATORY_EXAM",
    normalizedName: { in: normalizedNames },
  },
  select: { normalizedName: true },
});
const existingNames = new Set(existing.map((item) => item.normalizedName));

for (const item of LABORATORY_EXAM_CATALOG) {
  const normalizedName = normalizeLaboratoryExamCatalogName(item.name);
  await prisma.scientificLibraryRecord.upsert({
    where: {
      createdByUserId_area_domain_normalizedName: {
        createdByUserId: professional.id,
        area: "NUTRITION",
        domain: "LABORATORY_EXAM",
        normalizedName,
      },
    },
    create: {
      createdByUserId: professional.id,
      updatedByUserId: professional.id,
      area: "NUTRITION",
      domain: "LABORATORY_EXAM",
      name: item.name,
      normalizedName,
      description: "Nome padronizado para seleção manual em solicitações de exames.",
      tags: [...item.synonyms],
      source: "Catálogo operacional da Biblioteca Científica",
      status: "ACTIVE",
      originKind: "MANUAL",
      metadata: catalogMetadata(item.category, item.synonyms),
      dataNature: "OPERATIONAL",
      editorialStatus: "DRAFT",
    },
    update: {
      updatedByUserId: professional.id,
      name: item.name,
      description: "Nome padronizado para seleção manual em solicitações de exames.",
      tags: [...item.synonyms],
      source: "Catálogo operacional da Biblioteca Científica",
      status: "ACTIVE",
      metadata: catalogMetadata(item.category, item.synonyms),
      dataNature: "OPERATIONAL",
    },
  });
}

console.log(JSON.stringify({
  professional: {
    fullName: professional.fullName,
    title: "Nutricionista",
    registration: professionalRegistration,
  },
  catalog: {
    available: LABORATORY_EXAM_CATALOG.length,
    created: normalizedNames.filter((name) => !existingNames.has(name)).length,
    updated: normalizedNames.filter((name) => existingNames.has(name)).length,
    categories: new Set(LABORATORY_EXAM_CATALOG.map((item) => item.category)).size,
  },
}, null, 2));
