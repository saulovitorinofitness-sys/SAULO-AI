import { sharedDataMockItems } from "@/features/shared-data/mock-data";
import type { SharedDataItem } from "@/features/shared-data";
import { BUILT_IN_IDS } from "@/modules/permissions";
import { SCIENTIFIC_LIBRARY_DOMAINS, type ScientificLibraryDomain, type ScientificLibraryGateway, type ScientificLibraryItem } from "./contracts";
import { complementaryScientificItems } from "./mock-data";
import { scientificLibraryRepository } from "./repository";

type ScientificLibraryManagementService = ScientificLibraryGateway & {
  create(
    input: Parameters<typeof scientificLibraryRepository.create>[0],
  ): ReturnType<typeof scientificLibraryRepository.create>;
  updateExercise(
    input: Parameters<typeof scientificLibraryRepository.updateExercise>[0],
  ): ReturnType<typeof scientificLibraryRepository.updateExercise>;
  createMany(
    input: Parameters<typeof scientificLibraryRepository.createMany>[0],
  ): ReturnType<typeof scientificLibraryRepository.createMany>;
};

const supportedSharedDomains = ["FOOD", "RECIPE", "EXERCISE", "LABORATORY_EXAM", "SUPPLEMENT", "CLINICAL_PROTOCOL", "PHYSICAL_ASSESSMENT_PROTOCOL", "POSTURAL_ASSESSMENT_PROTOCOL"] as const;

function mapSharedDomain(domain: SharedDataItem["domain"]): ScientificLibraryDomain | null {
  if (domain === "FOOD" || domain === "RECIPE" || domain === "EXERCISE" || domain === "LABORATORY_EXAM" || domain === "SUPPLEMENT") return domain;
  if (domain === "CLINICAL_PROTOCOL" || domain === "PHYSICAL_ASSESSMENT_PROTOCOL" || domain === "POSTURAL_ASSESSMENT_PROTOCOL") return "PROTOCOL";
  return null;
}

function mapSharedArea(
  domain: (typeof supportedSharedDomains)[number],
): ScientificLibraryItem["area"] {
  if (
    domain === "FOOD" ||
    domain === "RECIPE" ||
    domain === "LABORATORY_EXAM" ||
    domain === "SUPPLEMENT" ||
    domain === "CLINICAL_PROTOCOL"
  ) {
    return "NUTRITION";
  }
  if (domain === "POSTURAL_ASSESSMENT_PROTOCOL") return "POSTURAL";
  return "PERFORMANCE";
}

function trainingProtocolAreaOf(tags: readonly string[]): string {
  if (tags.includes("corrida")) return "Corrida";
  if (tags.includes("ciclismo")) return "Ciclismo";
  if (tags.includes("deload") || tags.includes("reavaliação")) return "Recuperação e reavaliação";
  return "Musculação e condicionamento";
}

function attributesOf(source: SharedDataItem): Readonly<Record<string, string | readonly string[]>> {
  if (source.domain === "FOOD") return { "Grupo alimentar": source.attributes.foodGroup, "Unidade padrão": source.attributes.defaultUnit, "Medida caseira": source.attributes.householdMeasure, "Porção mockada": source.attributes.mockPortion, Sinônimos: source.attributes.synonyms, Observações: source.attributes.observations };
  if (source.domain === "RECIPE") return source.attributes;
  if (source.domain === "EXERCISE") return { "Grupo muscular": source.attributes.muscleGroup, Equipamento: source.attributes.equipment, Objetivo: source.attributes.objective, Execução: source.attributes.instructions, Variações: source.attributes.variations, Contraindicações: source.attributes.professionalContraindications };
  if (source.domain === "LABORATORY_EXAM") return { Categoria: source.attributes.examCategory, Unidade: source.attributes.unit, Descrição: source.attributes.observations };
  if (source.domain === "SUPPLEMENT") return { Categoria: source.attributes.supplementCategory, Apresentação: source.attributes.presentation, Observações: source.attributes.observations };
  if (source.domain === "PHYSICAL_ASSESSMENT_PROTOCOL") {
    const attributes = source.attributes;
    const mesocycleAttributes = Object.fromEntries(
      (attributes.mesocyclePhases ?? []).flatMap((phase, index) => {
        const phaseLabel = `Mesociclo ${index + 1}`;
        return [
          [`${phaseLabel} — Nome`, phase.name] as const,
          [`${phaseLabel} — Objetivo`, phase.objective] as const,
          [`${phaseLabel} — Critérios de progressão`, phase.progressionCriteria] as const,
        ];
      }),
    );

    return {
      Área: trainingProtocolAreaOf(source.tags),
      Versão: attributes.version,
      Etapas: attributes.steps,
      ...(attributes.objective ? { Objetivo: attributes.objective } : {}),
      ...(attributes.targetAudience ? { "Público indicado": attributes.targetAudience } : {}),
      ...(attributes.entryRequirements ? { "Requisitos de entrada": attributes.entryRequirements } : {}),
      ...(attributes.requiredAssessments ? { "Avaliações necessárias": attributes.requiredAssessments } : {}),
      ...(attributes.safetyCriteria ? { "Critérios de segurança": attributes.safetyCriteria } : {}),
      ...(attributes.periodizationModel ? { "Modelo de periodização": attributes.periodizationModel } : {}),
      ...(attributes.macrocycleGuidance ? { "Diretrizes do macrociclo": attributes.macrocycleGuidance } : {}),
      ...mesocycleAttributes,
      ...(attributes.microcycleOrganization ? { "Organização dos microciclos": attributes.microcycleOrganization } : {}),
      ...(attributes.weeklyFrequencyGuidance ? { "Frequência semanal": attributes.weeklyFrequencyGuidance } : {}),
      ...(attributes.intensityGuidance ? { "Diretrizes de intensidade": attributes.intensityGuidance } : {}),
      ...(attributes.volumeGuidance ? { "Diretrizes de volume": attributes.volumeGuidance } : {}),
      ...(attributes.progressionCriteria ? { "Critérios de progressão": attributes.progressionCriteria } : {}),
      ...(attributes.regressionCriteria ? { "Critérios de regressão": attributes.regressionCriteria } : {}),
      ...(attributes.recoveryAndDeload ? { "Recuperação e deload": attributes.recoveryAndDeload } : {}),
      ...(attributes.monitoringIndicators ? { "Indicadores de acompanhamento": attributes.monitoringIndicators } : {}),
      ...(attributes.reassessmentCriteria ? { "Critérios para reavaliação": attributes.reassessmentCriteria } : {}),
      ...(attributes.assistedPlanApplication ? { "Aplicação no Plano de Treino Assistido": attributes.assistedPlanApplication } : {}),
    };
  }
  if (source.domain === "CLINICAL_PROTOCOL" || source.domain === "POSTURAL_ASSESSMENT_PROTOCOL") return { Área: source.attributes.area, Versão: source.attributes.version, Etapas: source.attributes.steps };
  return {};
}

function categoryOf(source: SharedDataItem): string {
  if (source.domain === "FOOD") return source.attributes.foodGroup;
  if (source.domain === "RECIPE") return "Receita cadastrada";
  if (source.domain === "EXERCISE") return source.attributes.muscleGroup;
  if (source.domain === "LABORATORY_EXAM") return source.attributes.examCategory;
  if (source.domain === "SUPPLEMENT") return source.attributes.supplementCategory;
  if (source.domain === "PHYSICAL_ASSESSMENT_PROTOCOL") return trainingProtocolAreaOf(source.tags);
  if (source.domain === "CLINICAL_PROTOCOL" || source.domain === "POSTURAL_ASSESSMENT_PROTOCOL") return source.attributes.area;
  return "Catálogo compartilhado";
}

function adaptSharedItem(source: SharedDataItem): ScientificLibraryItem | null {
  const domain = mapSharedDomain(source.domain);
  if (!domain) return null;
  return {
    id: `scientific-${source.id}`,
    sourceSharedDataId: source.id,
    area: mapSharedArea(source.domain as (typeof supportedSharedDomains)[number]),
    domain,
    name: source.name,
    category: categoryOf(source),
    description: source.description ?? "Registro compartilhado demonstrativo.",
    source: source.source ?? "Central de Dados Compartilhados · mock",
    tags: source.tags,
    attributes: attributesOf(source),
    reusableBy: source.reusableBy,
    revisions: [],
    initiallyFavorite: source.id === "food-1" || source.id === "exercise-1",
    originKind: "MOCK",
    storageKind: "MOCK",
    dataNature: "DEMONSTRATIVE",
    editorialStatus: "DRAFT",
  };
}

function classifyLocalFallback(
  item: ScientificLibraryItem,
): ScientificLibraryItem {
  return {
    ...item,
    reviewedAt: undefined,
    reviewedBy: undefined,
    revisions: [],
    originKind: "MOCK",
    storageKind: "LOCAL_FALLBACK",
    dataNature: item.dataNature === "LEGACY" ? "LEGACY" : "DEMONSTRATIVE",
    editorialStatus: "DRAFT",
  };
}

async function loadPersistedItems(
  professionalUserId: string,
): Promise<readonly ScientificLibraryItem[]> {
  const items = await scientificLibraryRepository.list(professionalUserId);

  return items.map((item) => ({
    ...item,
    storageKind: "PERSISTED",
    dataNature: item.dataNature ?? "DEMONSTRATIVE",
    editorialStatus: item.editorialStatus ?? "DRAFT",
  }));
}

export const scientificLibraryService: ScientificLibraryManagementService = {
  canAccess(user) { return user.id === BUILT_IN_IDS.users.sauloXavierVitorino; },
  create(input) {
    return scientificLibraryRepository.create(input);
  },
  updateExercise(input) {
    return scientificLibraryRepository.updateExercise(input);
  },
  createMany(input) {
    return scientificLibraryRepository.createMany(input);
  },
  async getView(user) {
    if (!this.canAccess(user)) return null;
    const sharedItems = sharedDataMockItems.filter((item) => supportedSharedDomains.some((domain) => domain === item.domain)).map(adaptSharedItem).filter((item): item is ScientificLibraryItem => Boolean(item));
    const persistedItems = await loadPersistedItems(user.id);
    const localFallbackItems = complementaryScientificItems.map(
      classifyLocalFallback,
    );
    return { connectedProfessional: user.fullName, lastUpdatedAt: "2026-07-16T17:40:00-03:00", items: structuredClone([...persistedItems, ...sharedItems, ...localFallbackItems]), domains: SCIENTIFIC_LIBRARY_DOMAINS };
  },
};
