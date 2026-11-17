import { z } from "zod";

import type {
  AnamnesisObjective,
  ClinicalAnamnesisData,
  ClinicalHistoryItem,
  FamilyHistoryItem,
} from "./contracts";
import {
  clinicalHistoryOptions,
  familyHistoryOptions,
  objectiveOptions,
} from "./mock-data";

const INVALID_DATA_MESSAGE =
  "Revise os dados informados para a anamnese clínica.";

const objectiveValues = objectiveOptions.map(([value]) => value) as [
  AnamnesisObjective,
  ...AnamnesisObjective[],
];
const clinicalHistoryValues = clinicalHistoryOptions.map(([value]) =>
  value,
) as [ClinicalHistoryItem, ...ClinicalHistoryItem[]];
const familyHistoryValues = familyHistoryOptions.map(([value]) => value) as [
  FamilyHistoryItem,
  ...FamilyHistoryItem[],
];

const text = z.string({ error: INVALID_DATA_MESSAGE });
const identifiedRow = z.object({
  id: z.string().min(1, { error: "Há um registro sem identificação válida." }),
});

export const clinicalAnamnesisDataSchema = z.object({
  chiefComplaint: text,
  currentIllness: z.object({
    onset: text,
    duration: text,
    evolution: text,
    previousTreatments: text,
    currentSituation: text,
  }),
  primaryObjective: z.union([z.literal(""), z.enum(objectiveValues)], {
    error: "Selecione um objetivo principal válido ou mantenha-o não informado.",
  }),
  secondaryObjectives: z.array(z.enum(objectiveValues)),
  clinicalHistory: z.array(z.enum(clinicalHistoryValues)),
  clinicalHistoryNotes: text,
  familyHistory: z.array(z.enum(familyHistoryValues)),
  surgeries: z.array(
    identifiedRow.extend({ procedure: text, date: text, notes: text }),
  ),
  injuries: z.array(
    identifiedRow.extend({
      region: text,
      date: text,
      situation: text,
      notes: text,
    }),
  ),
  medications: z.array(
    identifiedRow.extend({
      name: text,
      dose: text,
      frequency: text,
      reason: text,
    }),
  ),
  supplements: z.array(
    identifiedRow.extend({ name: text, dose: text, frequency: text }),
  ),
  allergyStatus: z
    .enum(["CONFIRMED", "DENIED", "NOT_INFORMED"])
    .default("NOT_INFORMED"),
  allergies: z.array(text),
  sleep: z.object({ hours: text, quality: text, awakenings: text }),
  stressLevel: z
    .number({ error: "Informe um nível de estresse válido." })
    .min(0, { error: "O nível de estresse deve estar entre 0 e 10." })
    .max(10, { error: "O nível de estresse deve estar entre 0 e 10." }),
  physicalActivity: z.object({
    frequency: text,
    duration: text,
    modality: text,
  }),
  habits: z.object({ alcohol: text, smoking: text, others: text }),
  nutrition: z.object({
    mealsPerDay: text,
    water: text,
    restrictions: text,
    preferences: text,
  }),
  generalNotes: text,
});

export type ClinicalAnamnesisValidationResult =
  | { readonly success: true; readonly data: ClinicalAnamnesisData }
  | { readonly success: false; readonly message: string };

export function validateClinicalAnamnesisData(
  value: unknown,
): ClinicalAnamnesisValidationResult {
  const result = clinicalAnamnesisDataSchema.safeParse(value);
  if (!result.success) {
    return {
      success: false,
      message: result.error.issues[0]?.message ?? INVALID_DATA_MESSAGE,
    };
  }

  const data = result.data as ClinicalAnamnesisData;
  if (data.allergyStatus === "CONFIRMED" && data.allergies.length === 0) {
    return {
      success: false,
      message: "Informe ao menos um alérgeno para confirmar alergia alimentar.",
    };
  }
  if (data.allergyStatus === "DENIED" && data.allergies.length > 0) {
    return {
      success: false,
      message: "Remova os alérgenos registrados antes de confirmar ausência de alergias.",
    };
  }

  return { success: true, data };
}

export class ClinicalAnamnesisValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClinicalAnamnesisValidationError";
  }
}

export function assertClinicalAnamnesisData(
  value: unknown,
): asserts value is ClinicalAnamnesisData {
  const result = validateClinicalAnamnesisData(value);
  if (!result.success) {
    throw new ClinicalAnamnesisValidationError(result.message);
  }
}
