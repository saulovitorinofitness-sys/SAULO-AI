import type { MealPlanRecordRecipe } from "@/features/meal-plan/record";

export const NUTRITION_RETURN_ANAMNESIS_ENTRY_TYPE =
  "NUTRITION_RETURN_ANAMNESIS" as const;

export type ReturnRecallDayType =
  | "HABITUAL"
  | "ATYPICAL"
  | "NOT_INFORMED";

export type PreviousPlanAdherenceLevel =
  | "FULL"
  | "PARTIAL"
  | "NONE"
  | "NOT_ASSESSABLE";

export type QuickReturnAdherence =
  | ""
  | "GOOD"
  | "PARTIAL"
  | "LOW"
  | "NOT_ASSESSABLE";

export type QuickReturnDifficulty =
  | ""
  | "ROUTINE_ORGANIZATION"
  | "HUNGER_SATIETY"
  | "FOOD_PREFERENCES"
  | "COST_ACCESS"
  | "SOCIAL_EVENTS"
  | "ALCOHOL"
  | "SYMPTOMS_INTOLERANCE"
  | "NO_DIFFICULTY"
  | "OTHER";

export type QuickReturnConduct =
  | ""
  | "KEEP_CURRENT_STRATEGY"
  | "ADJUST_MEAL_PLAN"
  | "REPLACE_STRATEGY"
  | "REQUEST_ASSESSMENT_EXAMS"
  | "OTHER";

export const QUICK_RETURN_ADHERENCE_OPTIONS = [
  ["GOOD", "Boa"],
  ["PARTIAL", "Parcial"],
  ["LOW", "Baixa"],
  ["NOT_ASSESSABLE", "Não foi possível avaliar"],
] as const satisfies readonly (readonly [
  Exclude<QuickReturnAdherence, "">,
  string,
])[];

export const QUICK_RETURN_DIFFICULTY_OPTIONS = [
  ["ROUTINE_ORGANIZATION", "Organização da rotina"],
  ["HUNGER_SATIETY", "Fome ou saciedade"],
  ["FOOD_PREFERENCES", "Preferências alimentares"],
  ["COST_ACCESS", "Custo ou acesso aos alimentos"],
  ["SOCIAL_EVENTS", "Eventos sociais ou fim de semana"],
  ["ALCOHOL", "Consumo de álcool"],
  ["SYMPTOMS_INTOLERANCE", "Sintomas ou intolerância"],
  ["NO_DIFFICULTY", "Não apresentou dificuldade"],
  ["OTHER", "Outro"],
] as const satisfies readonly (readonly [
  Exclude<QuickReturnDifficulty, "">,
  string,
])[];

export const QUICK_RETURN_CONDUCT_OPTIONS = [
  ["KEEP_CURRENT_STRATEGY", "Manter estratégia atual"],
  ["ADJUST_MEAL_PLAN", "Ajustar plano alimentar"],
  ["REPLACE_STRATEGY", "Substituir estratégia"],
  ["REQUEST_ASSESSMENT_EXAMS", "Solicitar avaliação ou exames"],
  ["OTHER", "Outra conduta"],
] as const satisfies readonly (readonly [
  Exclude<QuickReturnConduct, "">,
  string,
])[];

export interface ReturnRecallFoodNutrients {
  readonly energyKcal: number | null;
  readonly proteinGrams: number | null;
  readonly carbohydratesGrams: number | null;
  readonly fatsGrams: number | null;
  readonly fiberGrams: number | null;
  readonly sodiumMg: number | null;
}

export type ReturnRecallPreparation =
  | ""
  | "NOT_APPLICABLE"
  | "RAW"
  | "COOKED"
  | "ROASTED"
  | "GRILLED"
  | "FRIED"
  | "SAUTEED"
  | "STEAMED"
  | "OTHER";

export type PreviousPlanConsumptionStatus =
  | ""
  | "AS_PRESCRIBED"
  | "DIFFERENT_QUANTITY"
  | "SUBSTITUTED"
  | "NOT_CONSUMED"
  | "ADDED";

export interface PreviousPlanFoodComparison {
  readonly sourcePlanEntryId: string;
  readonly sourceMealId?: string;
  readonly sourceFoodId?: string;
  readonly prescribedFoodName?: string;
  readonly prescribedQuantity?: number;
  readonly prescribedMeasure?: string;
  readonly prescribedAmount?: number;
  readonly prescribedUnit?: "g" | "ml";
  readonly status: PreviousPlanConsumptionStatus;
}

export interface PreviousPlanRecipeComparison {
  readonly sourcePlanEntryId: string;
  readonly sourceMealId?: string;
  readonly sourceRecipeItemId: string;
  readonly status: PreviousPlanConsumptionStatus;
}

export const RETURN_RECALL_PREPARATION_OPTIONS = [
  ["NOT_APPLICABLE", "Não se aplica"],
  ["RAW", "Cru"],
  ["COOKED", "Cozido"],
  ["ROASTED", "Assado"],
  ["GRILLED", "Grelhado"],
  ["FRIED", "Frito"],
  ["SAUTEED", "Refogado"],
  ["STEAMED", "Ao vapor"],
  ["OTHER", "Outro"],
] as const satisfies readonly (readonly [
  Exclude<ReturnRecallPreparation, "">,
  string,
])[];

export interface ReturnRecallMeasureOption {
  readonly id: string;
  readonly label: string;
  readonly measureName: string;
  readonly amountPerMeasure: number;
  readonly unit: "g" | "ml";
  readonly source: string;
  readonly technical: boolean;
}

interface ReturnRecallFoodBase {
  readonly id: string;
  readonly name: string;
  readonly quantity?: number;
  readonly unit: string;
  /** Campos legados permanecem no payload para não perder registros anteriores. */
  readonly preparation: string;
  readonly brand: string;
  readonly observations: string;
  readonly preparationOption?: ReturnRecallPreparation;
  readonly previousPlanComparison?: PreviousPlanFoodComparison;
}

export interface UnselectedRecallFood extends ReturnRecallFoodBase {
  readonly source: "UNSELECTED";
  readonly compositionStatus: "UNSELECTED";
}

export interface LocalDatabaseRecallFood extends ReturnRecallFoodBase {
  readonly source: "LOCAL_DATABASE";
  readonly catalogFoodId: string;
  readonly catalogSource: string;
  readonly catalogSourceKind?: string;
  readonly catalogSourceCode?: string;
  readonly householdMeasureId?: string;
  /** @deprecated Compatibilidade com rascunhos anteriores. */
  readonly gramsPerUnit?: number;
  readonly measureAmountPerUnit?: number;
  readonly measureUnit?: "g" | "ml";
  readonly measureSource?: string;
  readonly nutritionReferenceAmount?: number;
  readonly nutritionReferenceUnit?: "g" | "ml";
  readonly officialPreparation?: string;
  readonly compositionStatus: "AVAILABLE" | "UNAVAILABLE";
  readonly nutrientsPer100g?: ReturnRecallFoodNutrients;
}

export interface ManualRecallFood extends ReturnRecallFoodBase {
  readonly source: "MANUAL";
  readonly compositionStatus: "MANUAL" | "MANUAL_WITH_COMPOSITION";
  readonly consumedWeight?: number;
  readonly consumedWeightUnit?: "g" | "ml";
  readonly nutritionBasis?: "NONE" | "PER_100" | "PER_PORTION";
  readonly nutrients?: ReturnRecallFoodNutrients;
}

export type ReturnRecallFood =
  | UnselectedRecallFood
  | LocalDatabaseRecallFood
  | ManualRecallFood;

export interface ReturnRecallRecipe {
  readonly id: string;
  readonly itemType: "RECIPE";
  readonly source: "RECIPE";
  readonly recipeId: MealPlanRecordRecipe["recipeId"];
  readonly recipeTitle: MealPlanRecordRecipe["recipeTitle"];
  readonly recipeNutritionSnapshotId: MealPlanRecordRecipe["recipeNutritionSnapshotId"];
  readonly recipeNutritionSnapshotVersion: MealPlanRecordRecipe["recipeNutritionSnapshotVersion"];
  readonly prescribedPortion: MealPlanRecordRecipe["portion"];
  /** null significa que o paciente ainda não informou a quantidade consumida. */
  readonly consumedServings: number | null;
  readonly nutritionCompleteness: MealPlanRecordRecipe["nutritionCompleteness"];
  readonly snapshotNutrients: MealPlanRecordRecipe["snapshotNutrients"];
  readonly prescribedNutrients: MealPlanRecordRecipe["prescribedNutrients"];
  readonly missingNutrients: MealPlanRecordRecipe["missingNutrients"];
  readonly previousPlanComparison: PreviousPlanRecipeComparison;
  readonly observations: string;
}

export type ReturnRecallItem = ReturnRecallFood | ReturnRecallRecipe;

interface ReturnRecallMealBase {
  readonly id: string;
  readonly time: string;
  readonly name: string;
  readonly observations: string;
}

export interface ReturnRecallMealItems extends ReturnRecallMealBase {
  readonly items: readonly ReturnRecallItem[];
  /** Espelho opcional apenas durante a migração dos consumidores legados. */
  readonly foods?: readonly ReturnRecallFood[];
}

export interface LegacyReturnRecallMeal extends ReturnRecallMealBase {
  readonly items?: undefined;
  readonly foods: readonly ReturnRecallFood[];
}

export type ReturnRecallMeal =
  | ReturnRecallMealItems
  | LegacyReturnRecallMeal;

export interface ReturnRecall24Hours {
  readonly dayType: ReturnRecallDayType;
  /** Confirmação explícita do nutricionista de que o dia representa o padrão habitual. */
  readonly representativeConfirmed?: boolean;
  readonly referenceDate: string;
  readonly meals: readonly ReturnRecallMeal[];
  readonly water: string;
  readonly beverages: string;
  readonly alcohol: string;
  readonly supplements: string;
}

export interface ReturnFollowUpData {
  readonly evolutionSinceLastVisit: string;
  readonly perceivedPlanAdherence: string;
  readonly difficulties: string;
  readonly intercurrences: string;
  readonly currentSymptoms: string;
  readonly medicationSupplementChanges: string;
  readonly newExams: string;
  readonly routineChanges: string;
  readonly currentSleepStress: string;
  readonly currentPhysicalActivity: string;
  readonly waterIntake: string;
  readonly alcoholConsumption: string;
  readonly perceivedResult: string;
  readonly professionalObservations: string;
  readonly initialReturnPlan: string;
}

export interface PreviousPlanAdherence {
  readonly level: PreviousPlanAdherenceLevel;
  readonly followedMeals: string;
  readonly omittedMeals: string;
  readonly substitutions: string;
  readonly difficultyReasons: string;
  readonly hungerSatietyTolerance: string;
  readonly professionalObservation: string;
}

export interface QuickReturnData {
  readonly evolutionSinceLastVisit: string;
  readonly adherence: QuickReturnAdherence;
  readonly mainDifficulty: QuickReturnDifficulty;
  readonly otherDifficulty: string;
  readonly hadIntercurrence: "" | "NO" | "YES";
  readonly intercurrenceDetails: string;
  readonly conduct: QuickReturnConduct;
  readonly professionalObservation: string;
}

export interface DetailedReturnAdherence {
  readonly followedMeals: string;
  readonly omittedMeals: string;
  readonly substitutions: string;
  readonly hungerSatietyTolerance: string;
  readonly professionalObservation: string;
}

export interface LegacyReturnAnamnesisFields {
  /** Campos da primeira versão, preservados sem perda ao abrir um rascunho antigo. */
  readonly followUp: ReturnFollowUpData;
  readonly previousPlanAdherence: PreviousPlanAdherence;
}

export interface NutritionReturnAnamnesisData {
  readonly schemaVersion: 2;
  readonly quickReturn: QuickReturnData;
  readonly recall24h?: ReturnRecall24Hours;
  readonly detailedAdherence?: DetailedReturnAdherence;
  readonly legacy?: LegacyReturnAnamnesisFields;
}

export interface PreviousEnergyReference {
  readonly entryId?: string;
  readonly recordedAt?: string;
  readonly basalMetabolicRateKcal?: number;
  readonly totalEnergyExpenditureKcal?: number;
  readonly targetCaloriesKcal?: number;
  readonly proteinGrams?: number;
  readonly carbohydratesGrams?: number;
  readonly fatsGrams?: number;
  readonly calculationMethod?: string;
}

export interface PreviousMealPlanReference {
  readonly entryId?: string;
  readonly prescribedAt?: string;
  readonly title?: string;
  readonly meals: readonly string[];
  readonly prescriptionMeals: readonly PreviousMealPlanMealReference[];
}

export interface PreviousMealPlanFoodReference {
  /** Ausente somente nas referências legadas, que sempre representam alimentos. */
  readonly itemType?: "FOOD";
  readonly id: string;
  readonly catalogFoodId: string;
  readonly name: string;
  readonly catalogSource: string;
  readonly catalogSourceKind?: string;
  readonly catalogSourceCode?: string;
  readonly quantity: number;
  readonly householdMeasure: string;
  readonly prescribedAmount: number;
  readonly prescribedUnit: "g" | "ml";
  readonly measureAmountPerUnit: number;
  readonly selectedMeasureId?: string;
  readonly preparation?: string;
  readonly nutrientsPer100g: ReturnRecallFoodNutrients;
}

export type PreviousMealPlanRecipeReference = MealPlanRecordRecipe;

export type PreviousMealPlanItemReference =
  | PreviousMealPlanFoodReference
  | PreviousMealPlanRecipeReference;

interface PreviousMealPlanMealReferenceBase {
  readonly id: string;
  readonly name: string;
  readonly time: string;
}

export interface PreviousMealPlanMealItemsReference
  extends PreviousMealPlanMealReferenceBase {
  readonly items: readonly PreviousMealPlanItemReference[];
  /** Espelho opcional apenas para consumidores legados durante a migração. */
  readonly foods?: readonly PreviousMealPlanFoodReference[];
}

export interface LegacyPreviousMealPlanMealReference
  extends PreviousMealPlanMealReferenceBase {
  readonly items?: undefined;
  readonly foods: readonly PreviousMealPlanFoodReference[];
}

export type PreviousMealPlanMealReference =
  | PreviousMealPlanMealItemsReference
  | LegacyPreviousMealPlanMealReference;

export interface PreviousBodyAssessmentReference {
  readonly entryId?: string;
  readonly assessedAt?: string;
  readonly measurements: readonly string[];
}

export interface PreviousClinicalReference {
  readonly lastConsultationAt?: string;
  readonly complaint?: string;
  readonly objectives: readonly string[];
  readonly diagnosesAndConditions: readonly string[];
  readonly medicationsAndSupplements: readonly string[];
  readonly allergiesAndRestrictions: readonly string[];
  readonly clinicalObservations: readonly string[];
  readonly mealPlan: PreviousMealPlanReference;
  readonly energy: PreviousEnergyReference;
  readonly bodyAssessment: PreviousBodyAssessmentReference;
}

export interface NutritionReturnAnamnesisView {
  readonly patientId: string;
  readonly masterRecordId: string;
  readonly attendanceId: string;
  readonly patientName: string;
  readonly patientCode: string;
  readonly attendanceType: "RETURN";
  readonly attendanceStatus:
    | "DRAFT"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";
  readonly attendanceStartedAt: string;
  readonly status: "DRAFT" | "COMPLETED";
  readonly version: number;
  readonly data: NutritionReturnAnamnesisData;
  readonly previousReference: PreviousClinicalReference;
  readonly audit: {
    readonly professionalUserId: string;
    readonly professionalName: string;
    readonly updatedAt: string;
  };
  readonly canEdit: boolean;
}

export type NutritionReturnAnamnesisSaveMode = "DRAFT" | "COMPLETE";

export function emptyReturnRecall24Hours(): ReturnRecall24Hours {
  return {
    dayType: "NOT_INFORMED",
    representativeConfirmed: false,
    referenceDate: "",
    meals: [],
    water: "",
    beverages: "",
    alcohol: "",
    supplements: "",
  };
}

export function emptyDetailedReturnAdherence(): DetailedReturnAdherence {
  return {
    followedMeals: "",
    omittedMeals: "",
    substitutions: "",
    hungerSatietyTolerance: "",
    professionalObservation: "",
  };
}

export function emptyNutritionReturnAnamnesisData(): NutritionReturnAnamnesisData {
  return {
    schemaVersion: 2,
    quickReturn: {
      evolutionSinceLastVisit: "",
      adherence: "",
      mainDifficulty: "",
      otherDifficulty: "",
      hadIntercurrence: "",
      intercurrenceDetails: "",
      conduct: "",
      professionalObservation: "",
    },
  };
}
