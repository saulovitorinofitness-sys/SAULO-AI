import { sharedDataMockItems } from "@/features/shared-data/mock-data";
import type { SharedDataItem } from "@/features/shared-data";
import { BUILT_IN_IDS } from "@/modules/permissions";
import { SCIENTIFIC_LIBRARY_DOMAINS, type ScientificLibraryDomain, type ScientificLibraryGateway, type ScientificLibraryItem } from "./contracts";
import { complementaryScientificItems } from "./mock-data";

const supportedSharedDomains = ["FOOD", "RECIPE", "EXERCISE", "LABORATORY_EXAM", "SUPPLEMENT", "CLINICAL_PROTOCOL", "PHYSICAL_ASSESSMENT_PROTOCOL", "POSTURAL_ASSESSMENT_PROTOCOL"] as const;

function mapSharedDomain(domain: SharedDataItem["domain"]): ScientificLibraryDomain | null {
  if (domain === "FOOD" || domain === "RECIPE" || domain === "EXERCISE" || domain === "LABORATORY_EXAM" || domain === "SUPPLEMENT") return domain;
  if (domain === "CLINICAL_PROTOCOL" || domain === "PHYSICAL_ASSESSMENT_PROTOCOL" || domain === "POSTURAL_ASSESSMENT_PROTOCOL") return "PROTOCOL";
  return null;
}

function attributesOf(source: SharedDataItem): Readonly<Record<string, string | readonly string[]>> {
  if (source.domain === "FOOD") return { "Grupo alimentar": source.attributes.foodGroup, "Unidade padrão": source.attributes.defaultUnit, "Medida caseira": source.attributes.householdMeasure, "Porção mockada": source.attributes.mockPortion, Sinônimos: source.attributes.synonyms, Observações: source.attributes.observations };
  if (source.domain === "RECIPE") return source.attributes;
  if (source.domain === "EXERCISE") return { "Grupo muscular": source.attributes.muscleGroup, Equipamento: source.attributes.equipment, Objetivo: source.attributes.objective, Execução: source.attributes.instructions, Variações: source.attributes.variations, Contraindicações: source.attributes.professionalContraindications };
  if (source.domain === "LABORATORY_EXAM") return { Categoria: source.attributes.examCategory, Unidade: source.attributes.unit, Descrição: source.attributes.observations };
  if (source.domain === "SUPPLEMENT") return { Categoria: source.attributes.supplementCategory, Apresentação: source.attributes.presentation, Observações: source.attributes.observations };
  if (source.domain === "CLINICAL_PROTOCOL" || source.domain === "PHYSICAL_ASSESSMENT_PROTOCOL" || source.domain === "POSTURAL_ASSESSMENT_PROTOCOL") return { Área: source.attributes.area, Versão: source.attributes.version, Etapas: source.attributes.steps };
  return {};
}

function categoryOf(source: SharedDataItem): string {
  if (source.domain === "FOOD") return source.attributes.foodGroup;
  if (source.domain === "RECIPE") return "Receita cadastrada";
  if (source.domain === "EXERCISE") return source.attributes.muscleGroup;
  if (source.domain === "LABORATORY_EXAM") return source.attributes.examCategory;
  if (source.domain === "SUPPLEMENT") return source.attributes.supplementCategory;
  if (source.domain === "CLINICAL_PROTOCOL" || source.domain === "PHYSICAL_ASSESSMENT_PROTOCOL" || source.domain === "POSTURAL_ASSESSMENT_PROTOCOL") return source.attributes.area;
  return "Catálogo compartilhado";
}

function adaptSharedItem(source: SharedDataItem): ScientificLibraryItem | null {
  const domain = mapSharedDomain(source.domain);
  if (!domain) return null;
  return {
    id: `scientific-${source.id}`,
    sourceSharedDataId: source.id,
    domain,
    name: source.name,
    category: categoryOf(source),
    description: source.description ?? "Registro científico compartilhado.",
    source: source.source ?? "Central de Dados Compartilhados · mock",
    tags: source.tags,
    attributes: attributesOf(source),
    reusableBy: source.reusableBy,
    reviewedAt: source.audit.updatedAt,
    reviewedBy: source.audit.reviewedBy ?? source.audit.updatedBy,
    initiallyFavorite: source.id === "food-1" || source.id === "exercise-1",
  };
}

export const scientificLibraryService: ScientificLibraryGateway = {
  canAccess(user) { return user.id === BUILT_IN_IDS.users.sauloXavierVitorino; },
  async getView(user) {
    if (!this.canAccess(user)) return null;
    const sharedItems = sharedDataMockItems.filter((item) => supportedSharedDomains.some((domain) => domain === item.domain)).map(adaptSharedItem).filter((item): item is ScientificLibraryItem => Boolean(item));
    return { connectedProfessional: user.fullName, lastUpdatedAt: "2026-07-16T17:40:00-03:00", items: structuredClone([...sharedItems, ...complementaryScientificItems]), domains: SCIENTIFIC_LIBRARY_DOMAINS };
  },
};
