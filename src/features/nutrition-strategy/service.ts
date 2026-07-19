import { clinicalAnamnesisService, objectiveOptions, clinicalHistoryOptions } from "@/features/clinical-anamnesis";
import { clinicalDecisionService } from "@/features/clinical-decision";
import { mealPlanService } from "@/features/meal-plan";
import { scientificLibraryService } from "@/features/scientific-library";
import { BUILT_IN_IDS } from "@/modules/permissions";
import type { SessionUser } from "@/features/mvp";
import { CLINICAL_DEMO_ATTENDANCE_ID } from "@/features/clinical-collection/mock-data";
import type { GetNutritionStrategyInput, NutritionStrategyScientificReference, NutritionStrategySupplementationItem, NutritionStrategyView } from "./contracts";
import { nutritionStrategyMockPatient, nutritionStrategyScenarioSeeds, nutritionStrategyTypeOptions } from "./mock-data";

function splitLines(value: string): readonly string[] {
  return value.trim() ? value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean) : ["Dado ainda não registrado no Prontuário Mestre."];
}

function strategyTypeLabel(value: string) {
  return nutritionStrategyTypeOptions.find(([key]) => key === value)?.[1] ?? value;
}

function objectiveLabel(value: string | undefined) {
  return objectiveOptions.find(([key]) => key === value)?.[1] ?? value ?? "Dado ainda não registrado no Prontuário Mestre.";
}

function historySummary(historyCount: number, reviewPointsCount: number) {
  if (historyCount === 0) return "Motor de Decisão sem decisão profissional registrada.";
  return `Motor de Decisão com ${reviewPointsCount} pontos de revisão e decisão profissional disponível.`;
}

export const nutritionStrategyService = {
  canAccess(user: SessionUser) {
    return user.id === BUILT_IN_IDS.users.sauloXavierVitorino;
  },

  async get(input: GetNutritionStrategyInput): Promise<NutritionStrategyView | null> {
    if (!this.canAccess(input.user)) return null;

    const [anamnesis, decision, mealPlan, scientificLibrary] = await Promise.all([
      clinicalAnamnesisService.get({ patientId: input.patientId, scenario: input.scenario }),
      clinicalDecisionService.getWorkspace({ patientId: input.patientId, attendanceId: CLINICAL_DEMO_ATTENDANCE_ID, collectionScenario: input.scenario }),
      mealPlanService.get({ patientId: input.patientId, scenario: input.scenario }),
      scientificLibraryService.getView(input.user),
    ]);

    if (!anamnesis || !decision || !mealPlan || !scientificLibrary || !anamnesis.canViewNutrition) return null;

    const seed = nutritionStrategyScenarioSeeds[input.scenario];
    const scientificReferences: NutritionStrategyScientificReference[] = scientificLibrary.items
      .filter((item) => item.domain === "FOOD" || item.domain === "SUPPLEMENT")
      .slice(0, 6)
      .map((item) => ({ id: item.id, domain: item.domain, name: item.name, source: item.source }));

    const supplementation: NutritionStrategySupplementationItem[] = scientificLibrary.items
      .filter((item) => item.domain === "SUPPLEMENT")
      .slice(0, 4)
      .map((item, index) => ({
        id: `strategy-supplement-${index + 1}`,
        supplementId: item.id,
        name: item.name,
        objective: index === 0 ? "Apoio à recuperação" : index === 1 ? "Apoio à adesão" : "Decisão profissional",
        schedule: index === 0 ? "Pré-treino" : index === 1 ? "Pós-treino" : "Conforme rotina",
        observations: "Item demonstrativo reutilizado da Biblioteca Científica.",
      }));

    const mealTimes = mealPlan.meals.map((meal) => meal.time);
    const strategyType = strategyTypeLabel(seed.strategyType);
    const statusLabel = seed.status === "ACTIVE" ? "Estratégia registrada" : "Rascunho em revisão";

    return {
      patientId: input.patientId,
      masterRecordId: nutritionStrategyMockPatient.masterRecordId,
      scenario: input.scenario,
      status: seed.status,
      patient: {
        patientId: input.patientId,
        patientName: nutritionStrategyMockPatient.patientName,
        patientCode: nutritionStrategyMockPatient.patientCode,
        age: nutritionStrategyMockPatient.age,
        primaryObjective: objectiveLabel(anamnesis.data.primaryObjective),
        diagnoses: anamnesis.data.clinicalHistory.length ? anamnesis.data.clinicalHistory.map((entry) => clinicalHistoryOptions.find(([key]) => key === entry)?.[1] ?? entry) : ["Dado ainda não registrado no Prontuário Mestre."],
        restrictions: splitLines(anamnesis.data.nutrition.restrictions),
        allergies: anamnesis.data.allergies.length ? anamnesis.data.allergies : ["Dado ainda não registrado no Prontuário Mestre."],
        preferences: splitLines(anamnesis.data.nutrition.preferences),
        supplementation: anamnesis.data.supplements.length ? anamnesis.data.supplements.map((item) => `${item.name} · ${item.frequency}`) : ["Dado ainda não registrado no Prontuário Mestre."],
        schedules: mealTimes.length ? mealTimes : ["Dado ainda não registrado no Prontuário Mestre."],
        routine: [anamnesis.data.physicalActivity.frequency || "Dado ainda não registrado no Prontuário Mestre.", anamnesis.data.habits.others || "Dado ainda não registrado no Prontuário Mestre."],
      },
      objectiveMain: objectiveLabel(anamnesis.data.primaryObjective),
      secondaryObjectives: anamnesis.data.secondaryObjectives.length ? anamnesis.data.secondaryObjectives.map((item) => objectiveLabel(item)) : seed.secondaryObjectives,
      strategyType,
      mealDistribution: {
        mealCount: mealPlan.meals.length,
        mealTimes,
        window: mealTimes.length ? `${mealTimes[0]} às ${mealTimes.at(-1)}` : "Janela ainda não registrada",
        preTraining: "Estratégia demonstrativa para o pré-treino",
        postTraining: "Estratégia demonstrativa para o pós-treino",
        supper: "Ceia demonstrativa do mock",
      },
      complementaryStrategies: seed.complementaryStrategies,
      supplementation,
      clinicalObservations: seed.clinicalObservations,
      summary: {
        primaryObjective: objectiveLabel(anamnesis.data.primaryObjective),
        strategyType,
        mealCount: mealPlan.meals.length,
        supplementationCount: supplementation.length,
        statusLabel,
        lastUpdatedAt: mealPlan.updatedAt,
        responsibleProfessional: mealPlan.responsibleProfessional,
      },
      scientificReferences,
      updatedAt: mealPlan.updatedAt,
      responsibleProfessional: mealPlan.responsibleProfessional,
      canOpenMealPlan: seed.status === "ACTIVE",
      mealPlanHref: `/pacientes/${input.patientId}/plano-alimentar?scenario=${input.scenario}`,
      decisionContext: historySummary(decision.history.length, decision.reviewPoints.length),
      planContext: seed.status === "ACTIVE" ? "Plano alimentar liberado após a estratégia registrada." : "Plano alimentar bloqueado até a estratégia ser registrada.",
    };
  },
};
