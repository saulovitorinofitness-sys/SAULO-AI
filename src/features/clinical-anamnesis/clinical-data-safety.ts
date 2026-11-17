import {
  safeClinicalText,
  safeClinicalTexts,
} from "@/features/clinical-collection/clinical-text-safety";

import type { ClinicalAnamnesisData } from "./contracts";

const text = (value: string) => safeClinicalText(value) ?? "";

export function sanitizeClinicalAnamnesisData(
  data: ClinicalAnamnesisData,
): ClinicalAnamnesisData {
  return {
    ...data,
    chiefComplaint: text(data.chiefComplaint),
    currentIllness: {
      onset: text(data.currentIllness.onset),
      duration: text(data.currentIllness.duration),
      evolution: text(data.currentIllness.evolution),
      previousTreatments: text(data.currentIllness.previousTreatments),
      currentSituation: text(data.currentIllness.currentSituation),
    },
    clinicalHistoryNotes: text(data.clinicalHistoryNotes),
    surgeries: data.surgeries.map((item) => ({
      ...item,
      procedure: text(item.procedure),
      notes: text(item.notes),
    })),
    injuries: data.injuries.map((item) => ({
      ...item,
      region: text(item.region),
      situation: text(item.situation),
      notes: text(item.notes),
    })),
    medications: data.medications.map((item) => ({
      ...item,
      name: text(item.name),
      dose: text(item.dose),
      frequency: text(item.frequency),
      reason: text(item.reason),
    })),
    supplements: data.supplements.map((item) => ({
      ...item,
      name: text(item.name),
      dose: text(item.dose),
      frequency: text(item.frequency),
    })),
    allergies: safeClinicalTexts(data.allergies),
    sleep: {
      hours: text(data.sleep.hours),
      quality: text(data.sleep.quality),
      awakenings: text(data.sleep.awakenings),
    },
    physicalActivity: {
      frequency: text(data.physicalActivity.frequency),
      duration: text(data.physicalActivity.duration),
      modality: text(data.physicalActivity.modality),
    },
    habits: {
      alcohol: text(data.habits.alcohol),
      smoking: text(data.habits.smoking),
      others: text(data.habits.others),
    },
    nutrition: {
      mealsPerDay: text(data.nutrition.mealsPerDay),
      water: text(data.nutrition.water),
      restrictions: text(data.nutrition.restrictions),
      preferences: text(data.nutrition.preferences),
    },
    generalNotes: text(data.generalNotes),
  };
}
