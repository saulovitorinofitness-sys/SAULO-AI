import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import { BUILT_IN_IDS } from "@/modules/permissions";
import type { SharedDataDomain, SharedDataDraft, SharedDataGateway, SharedDataItem, SharedDataItemBase } from "./contracts";
import { sharedDataCategories, sharedDataMockItems, sharedDataTags } from "./mock-data";

const mariaDomains: readonly SharedDataDomain[] = ["EXERCISE", "PHYSICAL_ASSESSMENT_PROTOCOL", "POSTURAL_ASSESSMENT_PROTOCOL", "DOCUMENT_TEMPLATE", "CATEGORY_TAG"];

export const sharedDataService: SharedDataGateway = {
  async getWorkspace(input) {
    const viewer = resolveClinicalMockSessionUser(input.defaultUser, input.scenario); const maria = viewer.id === BUILT_IN_IDS.users.mariaDeLourdesGomes; const allowedDomains = maria ? mariaDomains : (["FOOD", "EXERCISE", "LABORATORY_EXAM", "SUPPLEMENT", "RECIPE", "CLINICAL_PROTOCOL", "PHYSICAL_ASSESSMENT_PROTOCOL", "POSTURAL_ASSESSMENT_PROTOCOL", "DOCUMENT_TEMPLATE", "MARKETING_CAMPAIGN", "OPERATIONAL_PROCEDURE", "CATEGORY_TAG"] satisfies readonly SharedDataDomain[]);
    const items = sharedDataMockItems.filter((item) => allowedDomains.includes(item.domain) && (!maria || item.visibility !== "NUTRITION"));
    return { scenario: input.scenario, connectedProfessional: viewer.fullName, items: structuredClone(items), categories: structuredClone(sharedDataCategories.filter((category) => allowedDomains.includes(category.domain))), tags: structuredClone(sharedDataTags.filter((tag) => !maria || tag.id !== "nutrition")), permissions: { canRead: true, canCreate: true, canEdit: true, canArchive: !maria, canRestore: !maria, canManageCategories: !maria, allowedDomains }, lastUpdatedAt: "2026-07-16T15:30:00-03:00" };
  },
  async create(item) { return structuredClone(item); },
  async update(item) { return structuredClone(item); },
  async archive(item) { return structuredClone({ ...item, status: "ARCHIVED" } as SharedDataItem); },
  async restore(item) { return structuredClone({ ...item, status: "ACTIVE" } as SharedDataItem); },
};

export function createLocalSharedDataItem(draft: SharedDataDraft, professionalName: string, sequence: number): SharedDataItem {
  const timestamp = "2026-07-16T16:00:00-03:00"; const common: SharedDataItemBase = { id: `local-shared-${sequence}`, domain: draft.domain, visibility: draft.domain === "FOOD" || draft.domain === "SUPPLEMENT" || draft.domain === "RECIPE" ? "NUTRITION" : draft.domain === "EXERCISE" || draft.domain === "PHYSICAL_ASSESSMENT_PROTOCOL" || draft.domain === "POSTURAL_ASSESSMENT_PROTOCOL" ? "PHYSICAL" : draft.domain === "MARKETING_CAMPAIGN" ? "ADMINISTRATIVE" : "SHARED", name: draft.name, code: draft.code, description: draft.description, categoryId: draft.categoryId, tags: draft.tags, status: draft.status, source: draft.source, notes: draft.notes, audit: { createdBy: professionalName, createdAt: timestamp, updatedBy: professionalName, updatedAt: timestamp, reviewStatus: "PENDING" }, history: [{ id: `history-local-${sequence}`, occurredAt: timestamp, professionalName, description: "Item criado no estado local demonstrativo." }], reusableBy: ["Integração futura a definir"] };
  if (draft.domain === "FOOD") return { ...common, domain: "FOOD", attributes: { foodGroup: "A confirmar", defaultUnit: "A confirmar", householdMeasure: "A confirmar", mockPortion: "Mock", synonyms: [], observations: draft.notes } };
  if (draft.domain === "EXERCISE") return { ...common, domain: "EXERCISE", attributes: { muscleGroup: "A confirmar", equipment: "A confirmar", level: "A confirmar", objective: "A confirmar", instructions: draft.description, variations: [], professionalContraindications: "A confirmar" } };
  if (draft.domain === "LABORATORY_EXAM") return { ...common, domain: "LABORATORY_EXAM", attributes: { unit: "A confirmar", examCategory: "A confirmar", observations: draft.notes, mockInformativeReference: "Referência informativa não cadastrada" } };
  if (draft.domain === "SUPPLEMENT") return { ...common, domain: "SUPPLEMENT", attributes: { supplementCategory: "A confirmar", presentation: "A confirmar", observations: draft.notes, professionalUse: "Sem recomendação de dose" } };
  if (draft.domain === "CLINICAL_PROTOCOL" || draft.domain === "PHYSICAL_ASSESSMENT_PROTOCOL" || draft.domain === "POSTURAL_ASSESSMENT_PROTOCOL") return { ...common, domain: draft.domain, attributes: { area: draft.domain, version: "rascunho", steps: [], responsibleProfessional: professionalName } };
  return { ...common, domain: draft.domain, attributes: { finalidade: draft.description || "A confirmar" } };
}
