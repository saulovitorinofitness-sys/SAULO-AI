import { clinicalHistoryOptions, clinicalAnamnesisService, objectiveOptions } from "@/features/clinical-anamnesis";
import { mealPlanService } from "@/features/meal-plan";
import { scientificLibraryService } from "@/features/scientific-library";
import type { GetNutritionPrescriptionInput, NutritionPatientContext, NutritionPrescriptionView } from "./contracts";

const notRegistered = "Dado ainda não registrado no Prontuário Mestre.";

function splitValue(value: string): readonly string[] {
  return value.trim() ? value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean) : [notRegistered];
}

export const nutritionPrescriptionService = {
  async get(input: GetNutritionPrescriptionInput): Promise<NutritionPrescriptionView | null> {
    const [plan, anamnesis, library] = await Promise.all([
      mealPlanService.get({ patientId: input.patientId, scenario: input.scenario }),
      clinicalAnamnesisService.get({ patientId: input.patientId, scenario: input.scenario }),
      scientificLibraryService.getView(input.user),
    ]);
    if (!plan || !anamnesis || !library || !anamnesis.canViewNutrition) return null;
    const objective = objectiveOptions.find(([value]) => value === anamnesis.data.primaryObjective)?.[1] ?? plan.summary.primaryObjective;
    const diagnoses = anamnesis.data.clinicalHistory.length ? anamnesis.data.clinicalHistory.map((entry) => clinicalHistoryOptions.find(([value]) => value === entry)?.[1] ?? entry) : [notRegistered];
    const supplements = anamnesis.data.supplements.length ? anamnesis.data.supplements.map((entry) => `${entry.name} · ${entry.frequency}`) : splitValue(plan.summary.supplementation);
    const patient: NutritionPatientContext = {
      patientId: plan.patientId,
      patientName: plan.patientName,
      masterRecordId: plan.masterRecordId,
      objective,
      diagnoses,
      restrictions: splitValue(anamnesis.data.nutrition.restrictions),
      allergies: anamnesis.data.allergies.length ? anamnesis.data.allergies : [notRegistered],
      preferences: splitValue(anamnesis.data.nutrition.preferences),
      aversions: [notRegistered],
      supplementation: supplements,
      schedules: plan.meals.map((meal) => `${meal.name} · ${meal.time}`),
      routine: [anamnesis.data.physicalActivity.frequency || notRegistered, anamnesis.data.habits.others || notRegistered],
    };
    return {
      scenario: input.scenario,
      patient,
      meals: plan.meals.map((meal) => ({ id: meal.id, name: meal.name, time: meal.time })),
      foods: library.items.filter((item) => item.domain === "FOOD"),
      recipes: library.items.filter((item) => item.domain === "RECIPE"),
      supplements: library.items.filter((item) => item.domain === "SUPPLEMENT"),
      responsibleProfessional: plan.responsibleProfessional,
      lastEditedAt: plan.updatedAt,
    };
  },
};

