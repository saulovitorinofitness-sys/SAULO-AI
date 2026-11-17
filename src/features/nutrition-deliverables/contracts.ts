import type { MealPlanNutritionTotalsResult } from "@/features/meal-plan/nutrition-calculations";
import type { MealPlanRecordRecipe } from "@/features/meal-plan/record";
import type {
  RecipeContentPendingCode,
  RecipeContentSnapshot,
} from "@/features/recipes/recipe-content-snapshot";

export type NutritionDeliverableStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED";

export type DeliverableReviewState =
  | "GENERATED"
  | "EDITED"
  | "APPROVED"
  | "PENDING_REVIEW";

export type DeliverableOptionalSection =
  | "findings"
  | "substitutions"
  | "shoppingList"
  | "supplements"
  | "herbalMedicines"
  | "exams"
  | "guidance"
  | "goals"
  | "finalMessage";

export type ShoppingListPeriod = 7 | 15 | 30 | "CUSTOM";

export type ShoppingQuantityUnit =
  | "g"
  | "kg"
  | "ml"
  | "L"
  | "unit";

export interface DeliverableCover {
  readonly clinicName: string;
  readonly clinicSubtitle: string;
  readonly logoPath?: string;
  readonly patientName: string;
  readonly documentTitle: string;
  /** Data de emissão do documento. */
  readonly date: string;
  /** Data clínica do atendimento, quando registrada. */
  readonly attendanceDate?: string;
  readonly attendanceType: string;
  readonly professionalName: string;
  readonly registrations: readonly string[];
}

export interface DeliverableClinicalDiagnosis {
  readonly content: string;
  readonly state: DeliverableReviewState;
  readonly reviewOutcome?:
    | "NO_DIAGNOSIS_ESTABLISHED"
    | "DIAGNOSES_CONFIRMED";
  readonly sourceReferences: readonly string[];
  readonly sections?: readonly DeliverableClinicalDiagnosisSection[];
}

export interface DeliverableClinicalDiagnosisSection {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly sourceReferences: readonly string[];
  readonly editable: boolean;
}

export interface DeliverableFinding {
  readonly id: string;
  readonly category:
    | "Antropometria"
    | "Perimetria — Tronco"
    | "Perimetria — Membros superiores"
    | "Perimetria — Membros inferiores"
    | "Bioimpedância"
    | "Composição corporal"
    | "Estado nutricional"
    | "Comportamento alimentar"
    | "Rotina"
    | "Sintomas"
    | "Exames"
    | "Atividade física"
    | "Fatores de risco"
    | "Pontos positivos"
    | "Prioridades de intervenção";
  readonly description: string;
  readonly sourceReference: string;
}

export interface DeliverableNutritionStrategy {
  readonly strategyId: string;
  readonly objective: string;
  readonly protocol: string;
  readonly method: string;
  readonly totalEnergyExpenditureKcal: number;
  readonly totalEnergyValueKcal: number;
  readonly calorieAdjustmentPercentage: number;
  readonly protein: {
    readonly grams: number;
    readonly percentage: number;
  };
  readonly carbohydrates: {
    readonly grams: number;
    readonly percentage: number;
  };
  readonly fats: {
    readonly grams: number;
    readonly percentage: number;
  };
  readonly fiberGrams: number;
  readonly waterMl: number;
  readonly mealCount: number;
  readonly justification?: string;
  readonly observations?: string;
  readonly approvedAt: string;
}

export interface DeliverableMealFood {
  /** Ausente apenas em rascunhos legados, que sempre representam alimentos. */
  readonly itemType?: "FOOD";
  readonly id: string;
  readonly catalogFoodId: string;
  readonly name: string;
  readonly householdMeasure: string;
  readonly quantity: number;
  readonly prescribedAmount: number;
  readonly prescribedUnit: "g" | "ml";
  /** Base congelada da fonte nutricional; não é uma unidade de prescrição. */
  readonly nutritionSourceName?: string;
  readonly nutritionReferenceMeasure?: string;
  /** Medida/conversão efetivamente selecionada no plano, quando cadastrada. */
  readonly selectedMeasure?: {
    readonly label: string;
    readonly preparationName?: string;
    readonly amountPerMeasure: number;
    readonly unit: "g" | "ml";
  };
  /** Alternativas congeladas junto ao item principal; não compõem o consumo. */
  readonly substitutions?: readonly DeliverableMealFoodSubstitution[];
}

export interface DeliverableMealFoodSubstitution {
  readonly id: string;
  readonly name: string;
  readonly prescribedAmount?: number;
  readonly prescribedUnit?: "g" | "ml";
  readonly quantity?: number;
  readonly householdMeasure?: string;
}

export interface DeliverableMealRecipe {
  readonly itemType: "RECIPE";
  readonly id: string;
  readonly recipeId: MealPlanRecordRecipe["recipeId"];
  readonly recipeTitle: MealPlanRecordRecipe["recipeTitle"];
  readonly recipeNutritionSnapshotId: MealPlanRecordRecipe["recipeNutritionSnapshotId"];
  readonly recipeNutritionSnapshotVersion: MealPlanRecordRecipe["recipeNutritionSnapshotVersion"];
  readonly portion: MealPlanRecordRecipe["portion"];
  readonly nutritionCompleteness: MealPlanRecordRecipe["nutritionCompleteness"];
  readonly snapshotNutrients: MealPlanRecordRecipe["snapshotNutrients"];
  readonly prescribedNutrients: MealPlanRecordRecipe["prescribedNutrients"];
  readonly missingNutrients: MealPlanRecordRecipe["missingNutrients"];
}

export interface DeliverablePlanRecipe {
  readonly recipeId: MealPlanRecordRecipe["recipeId"];
  readonly recipeTitle: MealPlanRecordRecipe["recipeTitle"];
  readonly recipeNutritionSnapshotId: MealPlanRecordRecipe["recipeNutritionSnapshotId"];
  readonly recipeNutritionSnapshotVersion: MealPlanRecordRecipe["recipeNutritionSnapshotVersion"];
  readonly contentSnapshot?: RecipeContentSnapshot;
  readonly contentPendings: readonly RecipeContentPendingCode[];
}

export type DeliverableMealItem = DeliverableMealFood | DeliverableMealRecipe;

interface DeliverableMealBase {
  readonly id: string;
  readonly name: string;
  readonly time?: string;
  readonly observations?: string;
}

export interface DeliverableMealItems extends DeliverableMealBase {
  readonly items: readonly DeliverableMealItem[];
  /** Espelho opcional durante a leitura de rascunhos antigos. */
  readonly foods?: readonly DeliverableMealFood[];
}

export interface LegacyDeliverableMeal extends DeliverableMealBase {
  readonly items?: undefined;
  readonly foods: readonly DeliverableMealFood[];
}

export type DeliverableMeal = DeliverableMealItems | LegacyDeliverableMeal;

export interface DeliverableMealPlan {
  readonly planId: string;
  readonly status: "DRAFT" | "APPROVED";
  readonly approvedAt: string;
  readonly meals: readonly DeliverableMeal[];
  /** Ausente somente em rascunhos do entregável anteriores ao anexo de receitas. */
  readonly recipes?: readonly DeliverablePlanRecipe[];
  readonly nutritionTotals: MealPlanNutritionTotalsResult;
  /** Indica decisão profissional registrada sem expor a observação interna. */
  readonly targetDeviationAuthorized?: boolean;
}

export interface DeliverableSubstitution {
  readonly id: string;
  readonly mealName: string;
  readonly prescribedFood: string;
  readonly approvedOptions: readonly string[];
}

export type ShoppingListCategory =
  | "Hortifruti"
  | "Açougue e peixaria"
  | "Ovos"
  | "Laticínios"
  | "Padaria"
  | "Cereais e grãos"
  | "Leguminosas"
  | "Mercearia"
  | "Bebidas"
  | "Congelados"
  | "Suplementos"
  | "Outros";

export interface DeliverableShoppingItem {
  readonly id: string;
  readonly catalogFoodId: string;
  readonly name: string;
  readonly category: ShoppingListCategory;
  readonly quantity: number;
  readonly unit: ShoppingQuantityUnit;
  readonly measureLabel?: string;
  /** Forma congelada da medida selecionada; não implica conversão para alimento cru. */
  readonly preparationName?: string;
  readonly displayQuantity: string;
  readonly sourceMealIds: readonly string[];
  readonly alreadyAtHome: boolean;
  readonly excluded: boolean;
  readonly manuallyEdited: boolean;
}

export interface DeliverableShoppingList {
  readonly period: ShoppingListPeriod;
  readonly customDays?: number;
  readonly days: number;
  readonly includeSubstitutions: boolean;
  readonly items: readonly DeliverableShoppingItem[];
}

export type DeliverablePrescriptionStatus =
  | "DRAFT"
  | "APPROVED"
  | "SUSPENDED";

export interface DeliverableSupplement {
  readonly id: string;
  readonly name: string;
  readonly activeIngredient?: string;
  readonly dose: string;
  readonly unit?: string;
  readonly schedule: string;
  readonly administrationRoute?: string;
  readonly duration?: string;
  readonly purpose?: string;
  readonly observations?: string;
  readonly status: DeliverablePrescriptionStatus;
  readonly approved: boolean;
  readonly sourceReference?: string;
}

export interface DeliverableHerbalMedicine {
  readonly id: string;
  readonly popularName: string;
  readonly scientificName?: string;
  readonly preparation?: string;
  readonly concentration?: string;
  readonly dose: string;
  readonly schedule: string;
  readonly administrationRoute?: string;
  readonly duration?: string;
  readonly purpose?: string;
  readonly precautions?: readonly string[];
  readonly contraindications?: readonly string[];
  readonly observations?: string;
  readonly status: DeliverablePrescriptionStatus;
  readonly approved: boolean;
  readonly sourceReference?: string;
}

export type DeliverableExamKind =
  | "EVALUATED"
  | "REQUESTED"
  | "MONITORING";

export type DeliverableExamStatus =
  | "NORMAL"
  | "ALTERED"
  | "ATTENTION"
  | "NOT_CLASSIFIED";

export interface DeliverableExam {
  readonly id: string;
  readonly name: string;
  readonly kind: DeliverableExamKind;
  readonly collectionDate?: string;
  readonly result?: string;
  readonly unit?: string;
  readonly referenceRange?: string;
  readonly status?: DeliverableExamStatus;
  readonly nutritionalInterpretation?: string;
  readonly reasonForRequest?: string;
  readonly monitoringDeadline?: string;
  readonly observations?: string;
  readonly approved: boolean;
  readonly sourceReference?: string;
}

export interface DeliverableGuidance {
  readonly id: string;
  readonly category: string;
  readonly content: string;
  readonly approved: boolean;
  readonly sourceReference?: string;
  readonly approvedAt?: string;
}

export interface DeliverableProfessionalNotes {
  /** Texto opcional escrito pelo profissional especificamente para este relatório. */
  readonly considerations: string;
  /** Orientações opcionais escritas pelo profissional para a paciente. */
  readonly orientations: string;
}

export interface DeliverableGoal {
  readonly id: string;
  readonly description: string;
  readonly indicator: string;
  readonly deadline: string;
  readonly status:
    | "PENDING"
    | "IN_PROGRESS"
    | "ACHIEVED";
  readonly observation: string;
}

export interface DeliverableFinalMessage {
  readonly content: string;
  readonly approved: boolean;
  readonly state: DeliverableReviewState;
}

export interface DeliverableSignature {
  readonly professionalName: string;
  readonly qualifications: readonly string[];
  readonly registrations: readonly string[];
  readonly signatureData?: string;
  readonly date: string;
}

export interface DeliverableContacts {
  readonly whatsapp?: string;
  readonly website?: string;
  readonly socialNetworks: readonly string[];
}

export interface NutritionDeliverableDraft {
  readonly deliverableId: string;
  readonly patientId: string;
  readonly attendanceId: string;
  readonly responsibleProfessional: string;
  readonly generatedAt: string;
  readonly status: NutritionDeliverableStatus;

  readonly cover: DeliverableCover;
  readonly clinicalDiagnosis: DeliverableClinicalDiagnosis;
  /**
   * Decisão exclusiva da composição deste documento. O valor `false`
   * omite a seção sem alterar nem presumir qualquer dado clínico.
   */
  readonly includeClinicalDiagnosis?: boolean;
  readonly findings: readonly DeliverableFinding[];

  readonly nutritionStrategy?: DeliverableNutritionStrategy;
  readonly mealPlan?: DeliverableMealPlan;

  readonly substitutions: readonly DeliverableSubstitution[];
  readonly shoppingList: DeliverableShoppingList;

  /*
   * As novas seções permanecem opcionais durante a transição.
   * Isso evita quebrar rascunhos antigos e o montador atual.
   */
  readonly supplements?: readonly DeliverableSupplement[];
  readonly herbalMedicines?: readonly DeliverableHerbalMedicine[];
  readonly exams?: readonly DeliverableExam[];

  readonly guidance: readonly DeliverableGuidance[];
  /**
   * Conteúdo autoral do relatório. Não altera a Estratégia Nutricional, o
   * Plano Alimentar nem seus snapshots de origem.
   */
  readonly professionalNotes?: DeliverableProfessionalNotes;
  readonly goals: readonly DeliverableGoal[];

  readonly finalMessage?: DeliverableFinalMessage;

  readonly signatures: readonly DeliverableSignature[];
  readonly contacts: DeliverableContacts;
  readonly qrCodeData?: string;

  /*
   * Partial mantém compatibilidade com rascunhos criados antes da inclusão
   * das novas seções. Ausência de chave significa seção inicialmente
   * desativada.
   */
  readonly enabledSections: Readonly<
    Partial<Record<DeliverableOptionalSection, boolean>>
  >;

  readonly optionalSectionOrder:
    readonly DeliverableOptionalSection[];

  readonly warnings: readonly string[];
  readonly missingData: readonly string[];

  readonly savedAt?: string;
  readonly approvedAt?: string;
}
