import type {
  HerbalPrescriptionComponent,
  HerbalPrescriptionContent,
  HerbalPrescriptionItem,
  HerbalPrescriptionPatientOption,
  HerbalPrescriptionView,
} from "./contracts";
import { PRESCRIPTION_ITEM_CATEGORIES } from "./contracts";
import { herbalPrescriptionRepository } from "./repository";

const MAX_ITEMS = 30;
const MAX_COMPONENTS = 12;
const MAX_FIELD_LENGTH = 1_000;
const MAX_ORIENTATIONS_LENGTH = 4_000;

export class HerbalPrescriptionValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function objectValue(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HerbalPrescriptionValidationError("INVALID_CONTENT", `${field} inválido.`);
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, field: string, maximum = MAX_FIELD_LENGTH) {
  if (typeof value !== "string") {
    throw new HerbalPrescriptionValidationError("INVALID_CONTENT", `${field} inválido.`);
  }
  if (value.length > maximum) {
    throw new HerbalPrescriptionValidationError("CONTENT_TOO_LONG", `${field} deve ter no máximo ${maximum} caracteres.`);
  }
  return value;
}

function optionalText(value: unknown, field: string, maximum = MAX_FIELD_LENGTH) {
  if (value === undefined || value === null || value === "") return undefined;
  const text = requiredText(value, field, maximum);
  return text.trim() ? text : undefined;
}

function normalizeComponent(value: unknown, index: number): HerbalPrescriptionComponent {
  const component = objectValue(value, `Componente ${index + 1}`);
  return {
    identification: requiredText(component.identification ?? "", `Identificação do componente ${index + 1}`),
    ...(optionalText(component.scientificName, `Nome científico do componente ${index + 1}`) ? { scientificName: component.scientificName as string } : {}),
    ...(optionalText(component.plantPart, `Parte utilizada do componente ${index + 1}`) ? { plantPart: component.plantPart as string } : {}),
    ...(optionalText(component.concentrationStandardization, `Concentração ou padronização do componente ${index + 1}`) ? { concentrationStandardization: component.concentrationStandardization as string } : {}),
  };
}

function normalizeItem(value: unknown, index: number): HerbalPrescriptionItem {
  const item = objectValue(value, `Item ${index + 1}`);
  if (!Array.isArray(item.components)) {
    throw new HerbalPrescriptionValidationError("INVALID_CONTENT", `Composição do item ${index + 1} inválida.`);
  }
  if (item.components.length > MAX_COMPONENTS) {
    throw new HerbalPrescriptionValidationError("TOO_MANY_COMPONENTS", `O item ${index + 1} deve ter no máximo ${MAX_COMPONENTS} componentes.`);
  }
  return {
    category: typeof item.category === "string" && PRESCRIPTION_ITEM_CATEGORIES.includes(item.category as (typeof PRESCRIPTION_ITEM_CATEGORIES)[number])
      ? item.category as HerbalPrescriptionItem["category"]
      : "HERBAL",
    identification: requiredText(item.identification ?? "", `Identificação do item ${index + 1}`),
    ...(optionalText(item.scientificName, `Nome científico do item ${index + 1}`) ? { scientificName: item.scientificName as string } : {}),
    ...(optionalText(item.plantPart, `Parte utilizada do item ${index + 1}`) ? { plantPart: item.plantPart as string } : {}),
    ...(optionalText(item.presentation, `Apresentação do item ${index + 1}`) ? { presentation: item.presentation as string } : {}),
    ...(optionalText(item.concentrationStandardization, `Concentração ou padronização do item ${index + 1}`) ? { concentrationStandardization: item.concentrationStandardization as string } : {}),
    ...(optionalText(item.dose, `Dose do item ${index + 1}`) ? { dose: item.dose as string } : {}),
    ...(optionalText(item.route, `Via do item ${index + 1}`) ? { route: item.route as string } : {}),
    ...(optionalText(item.frequency, `Frequência do item ${index + 1}`) ? { frequency: item.frequency as string } : {}),
    ...(optionalText(item.duration, `Duração do item ${index + 1}`) ? { duration: item.duration as string } : {}),
    ...(optionalText(item.quantity, `Quantidade do item ${index + 1}`) ? { quantity: item.quantity as string } : {}),
    ...(optionalText(item.orientations, `Orientações do item ${index + 1}`, MAX_ORIENTATIONS_LENGTH) ? { orientations: item.orientations as string } : {}),
    components: item.components.map(normalizeComponent),
  };
}

export function normalizeHerbalPrescriptionContent(value: unknown): HerbalPrescriptionContent {
  const content = objectValue(value, "Conteúdo da prescrição");
  if (!Array.isArray(content.items)) {
    throw new HerbalPrescriptionValidationError("INVALID_CONTENT", "Informe os itens da prescrição.");
  }
  if (content.items.length > MAX_ITEMS) {
    throw new HerbalPrescriptionValidationError("TOO_MANY_ITEMS", `Informe no máximo ${MAX_ITEMS} itens.`);
  }
  return { items: content.items.map(normalizeItem) };
}

function requireIdentifiers(patientId: string, prescriptionId?: string) {
  if (!patientId || patientId.length > 100) {
    throw new HerbalPrescriptionValidationError("INVALID_PATIENT", "Pessoa inválida.");
  }
  if (prescriptionId !== undefined && (!prescriptionId || prescriptionId.length > 100)) {
    throw new HerbalPrescriptionValidationError("INVALID_PRESCRIPTION", "Prescrição inválida.");
  }
}

export const herbalPrescriptionService = {
  getPatient(patientId: string): Promise<HerbalPrescriptionPatientOption | null> {
    requireIdentifiers(patientId);
    return herbalPrescriptionRepository.getPatient(patientId);
  },

  searchPatients(query?: string): Promise<readonly HerbalPrescriptionPatientOption[]> {
    return herbalPrescriptionRepository.searchPatients(query);
  },

  list(patientId: string): Promise<readonly HerbalPrescriptionView[]> {
    requireIdentifiers(patientId);
    return herbalPrescriptionRepository.listForPatient(patientId);
  },

  get(patientId: string, prescriptionId: string): Promise<HerbalPrescriptionView | null> {
    requireIdentifiers(patientId, prescriptionId);
    return herbalPrescriptionRepository.get(patientId, prescriptionId);
  },

  saveDraft(input: {
    readonly patientId: string;
    readonly prescriptionId?: string;
    readonly actorUserId: string;
    readonly content: unknown;
  }): Promise<HerbalPrescriptionView> {
    requireIdentifiers(input.patientId, input.prescriptionId);
    const content = normalizeHerbalPrescriptionContent(input.content);
    return input.prescriptionId
      ? herbalPrescriptionRepository.revise({
          patientId: input.patientId,
          prescriptionId: input.prescriptionId,
          actorUserId: input.actorUserId,
          content,
          issue: false,
        })
      : herbalPrescriptionRepository.createDraft({
          patientId: input.patientId,
          actorUserId: input.actorUserId,
          content,
        });
  },

  issue(input: {
    readonly patientId: string;
    readonly prescriptionId: string;
    readonly actorUserId: string;
    readonly content: unknown;
  }): Promise<HerbalPrescriptionView> {
    requireIdentifiers(input.patientId, input.prescriptionId);
    const content = normalizeHerbalPrescriptionContent(input.content);
    if (content.items.length === 0) {
      throw new HerbalPrescriptionValidationError("ITEMS_REQUIRED_TO_ISSUE", "Inclua ao menos um item antes de emitir.");
    }
    if (content.items.some((item) => !item.identification.trim())) {
      throw new HerbalPrescriptionValidationError("ITEM_IDENTIFICATION_REQUIRED", "Identifique todos os itens antes de emitir.");
    }
    if (content.items.some((item) => item.components.some((component) => !component.identification.trim()))) {
      throw new HerbalPrescriptionValidationError("COMPONENT_IDENTIFICATION_REQUIRED", "Identifique todos os componentes antes de emitir.");
    }
    return herbalPrescriptionRepository.revise({
      patientId: input.patientId,
      prescriptionId: input.prescriptionId,
      actorUserId: input.actorUserId,
      content,
      issue: true,
    });
  },
};
