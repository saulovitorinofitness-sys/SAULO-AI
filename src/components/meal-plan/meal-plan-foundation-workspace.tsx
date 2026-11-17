"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, SectionHeader } from "@/components/ui";
import { useClinicalFlowPrimaryActionState } from "@/components/nutrition-clinical-flow/clinical-flow-navigation";
import { developmentUserRequestHeaders } from "@/features/development-session";
import { nutritionClinicalFlowHref } from "@/features/nutrition-clinical-flow";
import type {
  FoodNutrientForms,
  FoodSearchResult,
  ProfessionalFood,
} from "@/features/food-database/contracts";
import { normalizeFoodSearchText } from "@/features/food-database/normalization";
import type { MealPlanPrescriptionView } from "@/features/meal-plan/contracts";
import {
  calculateFoodNutrientsForGrams,
  calculateMealPlanNutritionTotals,
  calculatePrescribedRecipeNutrients,
  formatMealPlanDecimalInput,
  formatRecipePortionDescription,
  type MealPlanNutritionTotalsResult,
  updateMealPlanFoodPortion,
} from "@/features/meal-plan/nutrition-calculations";
import {
  createMealPlanFoodFromMaster,
  directMealPlanMeasureId,
  directMealPlanMeasureUnit,
  mealPlanMeasureDisplayOptions,
  mealPlanMeasureSelectionId,
  selectIbgeMeasureForDisplay,
} from "@/features/meal-plan/food-snapshot";
import {
  calculateNutritionAdequacy,
  FINAL_NUTRITION_TARGET_TOLERANCE_ORIGIN,
  FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT,
  type NutritionAdequacyMetric,
  type NutritionAdequacyStatus,
} from "@/features/meal-plan/adequacy-engine";
import type {
  MealPlanAiDecision,
  MealPlanIbgeMeasureOption,
  MealPlanRecipeNutrients,
  MealPlanRecordFood,
  MealPlanRecordMeal,
  MealPlanRecordRecipe,
  MealPlanRecordSupplement,
  MealPlanReuseMode,
} from "@/features/meal-plan/record";
import {
  isMealPlanFoodItem,
  isMealPlanRecipeItem,
  mapMealPlanRecipeNutrients,
  parseMealPlanRecordDraft,
} from "@/features/meal-plan/record";
import {
  PRESCRIPTION_ACTION_LABELS,
  type PrescriptionHistoryEntry,
} from "@/features/meal-plan/prescription-history";
import {
  attachMealPlanFoodSubstitution,
  createMealPlanSubstitutionReplacement,
  recalculateMealPlanSubstitutions,
  type NutritionalEquivalent,
} from "@/features/meal-plan/substitution-engine";
import { resolveMealPlanObjective } from "@/features/nutrition-strategy/inheritance";
import { mealScheduleCorrectionHref } from "@/features/nutrition-strategy/meal-schedule";
import { parseRecipeContentSnapshot } from "@/features/recipes/recipe-content-snapshot";
import { ENERGY_PROTOCOLS } from "@/lib/nutrition";
import { MealPlanAdequacyTab } from "./meal-plan-adequacy-tab";
import { MealPlanAnalysisTab } from "./meal-plan-analysis-tab";
import {
  calculateMealPlanTargetDeviations,
  evaluateMealPlanCompletion,
  mealPlanContentFingerprint,
  mealPlanTargetDeviationFingerprint,
  targetDeviationAuthorizationMatches,
  type MealPlanProfessionalReview,
  type MealPlanTargetDeviationAuthorization,
} from "@/features/meal-plan/completion-policy";
import { analyzeMealPlanNutrition } from "@/features/meal-plan/plan-nutrition-analysis";
import { selectDietaryReferences, type DietaryReferenceProfile, type DietaryReferenceValue } from "@/features/meal-plan/dietary-reference";
import type {
  SmartPlanDraft,
  SmartPlanGenerationPendingField,
} from "@/features/meal-plan-intelligence/smart-plan-draft-generator";

const STANDARD_MEALS = [
  "Café da manhã",
  "Lanche da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
  "Ceia",
] as const;
const adequacyMetricConfig = {
  energyKcal: { label: "Energia", unit: "kcal" },
  proteinGrams: { label: "Proteínas", unit: "g" },
  carbohydratesGrams: { label: "Carboidratos", unit: "g" },
  fatsGrams: { label: "Lipídios", unit: "g" },
  fiberGrams: { label: "Fibras", unit: "g" },
  waterMl: { label: "Água", unit: "ml" },
} as const;
const adequacyStatusLabels: Record<NutritionAdequacyStatus, string> = {
  ADEQUATE: "Adequado",
  NEAR_TARGET: "Próximo da meta",
  OUTSIDE_TARGET: "Fora da meta",
};
const nutrientLabels: Record<keyof MealPlanRecipeNutrients, string> = {
  energyKcal: "Energia",
  proteinGrams: "Proteínas",
  carbohydratesGrams: "Carboidratos",
  fatsGrams: "Lipídios",
  fiberGrams: "Fibras",
  sugarsGrams: "Açúcares",
  cholesterolMg: "Colesterol",
  saturatedFatsGrams: "Gorduras saturadas",
  transFatsGrams: "Gorduras trans",
  monounsaturatedFatsGrams: "Gorduras monoinsaturadas",
  polyunsaturatedFatsGrams: "Gorduras poli-insaturadas",
  sodiumMg: "Sódio",
  calciumMg: "Cálcio",
  ironMg: "Ferro",
  magnesiumMg: "Magnésio",
  phosphorusMg: "Fósforo",
  potassiumMg: "Potássio",
  zincMg: "Zinco",
  copperMg: "Cobre",
  manganeseMg: "Manganês",
  seleniumMcg: "Selênio",
  vitaminAMcg: "Vitamina A",
  vitaminCMg: "Vitamina C",
  vitaminDMcg: "Vitamina D",
  vitaminEMg: "Vitamina E",
  vitaminKMcg: "Vitamina K",
  thiamineMg: "Tiamina",
  riboflavinMg: "Riboflavina",
  niacinMg: "Niacina",
  vitaminB6Mg: "Vitamina B6",
  folateMcg: "Folato",
  vitaminB12Mcg: "Vitamina B12",
};

interface FoodPortionInputState {
  readonly quantityInput: string;
  readonly gramsInput: string;
  readonly pendingDirectUnit?: "g" | "ml";
  readonly error?: string;
}

interface RecipePortionInputState {
  readonly prescribedServingsInput: string;
  readonly error?: string;
}

interface AccessibleRecipeSnapshot {
  readonly id: string;
  readonly recipeId: string;
  readonly version: number;
  readonly servings: unknown;
  readonly servingSize: unknown;
  readonly servingSizeUnit: "GRAM" | "MILLILITER" | "UNIT" | null;
  readonly recipeContentSnapshot?: unknown;
  readonly [key: string]: unknown;
}

interface AccessibleRecipe {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly nutritionSnapshots: readonly AccessibleRecipeSnapshot[];
}

type ItemPickerMode = "FOOD" | "RECIPE";

interface PendingFoodSubstitution {
  readonly mealId: string;
  readonly foodId: string;
  readonly current: MealPlanRecordFood;
  readonly replacement: MealPlanRecordFood;
  readonly equivalent: NutritionalEquivalent;
}

interface RecipeSnapshotUpdateTarget {
  readonly mealId: string;
  readonly item: MealPlanRecordRecipe;
}

type MealPlanAssemblyMode = "INTELLIGENT" | "MANUAL";
type MealReviewStatus = "PENDING_REVIEW" | "APPROVED" | "EDITED";
type AutoSaveState = "IDLE" | "PENDING" | "SAVING" | "SAVED" | "ERROR";
interface MealPlanDraftSnapshot {
  readonly meals: readonly MealPlanRecordMeal[];
  readonly supplements: readonly MealPlanRecordSupplement[];
  readonly aiDecision: MealPlanAiDecision;
  readonly smartGenerationVersion?: number;
  readonly clinicalJustification: string;
  readonly dietaryReferenceProfile?: DietaryReferenceProfile;
  readonly dietaryReferences?: readonly DietaryReferenceValue[];
  readonly targetDeviationAuthorization?: MealPlanTargetDeviationAuthorization;
}
interface LocalMealPlanDraft {
  readonly schemaVersion: 1;
  readonly patientId: string;
  readonly attendanceId: string;
  readonly savedAt: number;
  readonly baseUpdatedAt: string;
  readonly draft: MealPlanDraftSnapshot;
}
type SmartPlanPreviewState = Pick<
  SmartPlanDraft,
  | "semanticVersion"
  | "generationStatus"
  | "approvalLabel"
  | "requiresProfessionalAdjustment"
  | "warnings"
  | "optionalDataNotProvided"
  | "targetComparison"
  | "meals"
>;

function n(value: number, digits = 1) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
  }).format(value);
}

const recipeNutrientKeys = [
  "energyKcal",
  "proteinGrams",
  "carbohydratesGrams",
  "fatsGrams",
  "fiberGrams",
  "sugarsGrams",
  "cholesterolMg",
  "saturatedFatsGrams",
  "transFatsGrams",
  "monounsaturatedFatsGrams",
  "polyunsaturatedFatsGrams",
  "sodiumMg",
  "calciumMg",
  "ironMg",
  "magnesiumMg",
  "phosphorusMg",
  "potassiumMg",
  "zincMg",
  "copperMg",
  "manganeseMg",
  "seleniumMcg",
  "vitaminAMcg",
  "vitaminCMg",
  "vitaminDMcg",
  "vitaminEMg",
  "vitaminKMcg",
  "thiamineMg",
  "riboflavinMg",
  "niacinMg",
  "vitaminB6Mg",
  "folateMcg",
  "vitaminB12Mcg",
] as const satisfies readonly (keyof MealPlanRecipeNutrients)[];

const recipeMacroKeys = [
  "energyKcal",
  "proteinGrams",
  "carbohydratesGrams",
  "fatsGrams",
] as const satisfies readonly (keyof MealPlanRecipeNutrients)[];

function nullableSnapshotNutrient(value: unknown) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function snapshotNutrients(
  snapshot: AccessibleRecipeSnapshot,
): MealPlanRecipeNutrients {
  return mapMealPlanRecipeNutrients((key) =>
    nullableSnapshotNutrient(snapshot[key]),
  );
}

const snapshotStateKeyByRecipeNutrient = {
  energyKcal: "energyKcal",
  proteinGrams: "proteinGrams",
  carbohydratesGrams: "carbohydratesGrams",
  fatsGrams: "totalFatsGrams",
  fiberGrams: "fiberGrams",
  sugarsGrams: "totalSugarsGrams",
  cholesterolMg: "cholesterolMg",
  saturatedFatsGrams: "saturatedFatsGrams",
  transFatsGrams: "transFatsGrams",
  monounsaturatedFatsGrams: "monounsaturatedFatsGrams",
  polyunsaturatedFatsGrams: "polyunsaturatedFatsGrams",
  sodiumMg: "sodiumMg",
  calciumMg: "calciumMg",
  ironMg: "ironMg",
  magnesiumMg: "magnesiumMg",
  phosphorusMg: "phosphorusMg",
  potassiumMg: "potassiumMg",
  zincMg: "zincMg",
  copperMg: "copperMg",
  manganeseMg: "manganeseMg",
  seleniumMcg: "seleniumMcg",
  vitaminAMcg: "vitaminAMcg",
  vitaminCMg: "vitaminCMg",
  vitaminDMcg: "vitaminDMcg",
  vitaminEMg: "vitaminEMg",
  vitaminKMcg: "vitaminKMcg",
  thiamineMg: "thiamineMg",
  riboflavinMg: "riboflavinMg",
  niacinMg: "niacinMg",
  vitaminB6Mg: "vitaminB6Mg",
  folateMcg: "folateMcg",
  vitaminB12Mcg: "vitaminB12Mcg",
} as const satisfies Readonly<Record<keyof MealPlanRecipeNutrients, string>>;

function snapshotPartialNutrients(
  snapshot: AccessibleRecipeSnapshot,
): readonly (keyof MealPlanRecipeNutrients)[] {
  const additional = snapshot.additionalNutrients;
  if (!isUnknownRecord(additional)) return [];
  const states = additional.nutrientStates;
  if (!isUnknownRecord(states)) return [];
  return recipeNutrientKeys.filter(
    (key) => states[snapshotStateKeyByRecipeNutrient[key]] === "PARTIAL",
  );
}

function snapshotNutrientForms(snapshot: AccessibleRecipeSnapshot): FoodNutrientForms | undefined {
  const additional = snapshot.additionalNutrients;
  if (!isUnknownRecord(additional) || !isUnknownRecord(additional.nutrientForms)) return undefined;
  const forms = additional.nutrientForms;
  if (
    !["RAE", "RE", "RETINOL", "UNSPECIFIED"].includes(String(forms.vitaminAMcg)) ||
    !["DFE", "FOOD_FOLATE", "FOLIC_ACID", "UNSPECIFIED"].includes(String(forms.folateMcg))
  ) return undefined;
  return forms as unknown as FoodNutrientForms;
}

function nutritionDisplay(value: number | null, unit = "") {
  return value === null ? "Indisponível" : `${n(value)}${unit ? ` ${unit}` : ""}`;
}

function recipeNutritionAvailabilityLabel(recipe: MealPlanRecordRecipe) {
  const missingMacros = recipeMacroKeys.filter(
    (key) => recipe.prescribedNutrients[key] === null,
  );
  return missingMacros.length
    ? `Energia/macronutrientes com ${missingMacros.length} ausência(s)`
    : recipe.missingNutrients.length
      ? `Energia e macronutrientes disponíveis · ${recipe.missingNutrients.length} demais ausentes`
      : recipe.partialNutrients?.length
        ? `Valores conhecidos preservados · ${recipe.partialNutrients.length} nutrientes parciais`
        : "Nutrição disponível";
}

function RecipeNutritionAvailability({
  meals,
  nutrition,
}: {
  readonly meals: readonly MealPlanRecordMeal[];
  readonly nutrition: MealPlanNutritionTotalsResult;
}) {
  const groups = new Map<
    string,
    {
      readonly title: string;
      readonly version: number;
      readonly meals: Set<string>;
      readonly missing: Set<keyof MealPlanRecipeNutrients>;
      readonly partial: Set<keyof MealPlanRecipeNutrients>;
    }
  >();
  for (const [kind, contributions] of [
    ["missing", nutrition.missingContributions],
    ["partial", nutrition.partialContributions],
  ] as const) {
    for (const contribution of contributions) {
    const meal = meals.find((candidate) => candidate.id === contribution.mealId);
    const item = meal?.items.find(
      (candidate) => candidate.id === contribution.itemId,
    );
    if (!item || !isMealPlanRecipeItem(item)) continue;
    const key = `${item.recipeId}:${item.recipeNutritionSnapshotVersion}`;
    const group = groups.get(key) ?? {
      title: item.recipeTitle,
      version: item.recipeNutritionSnapshotVersion,
      meals: new Set<string>(),
      missing: new Set<keyof MealPlanRecipeNutrients>(),
      partial: new Set<keyof MealPlanRecipeNutrients>(),
    };
    group.meals.add(meal?.name ?? contribution.mealId);
    group[kind].add(contribution.nutrient);
    groups.set(key, group);
    }
  }
  const groupedRecipes = [...groups.entries()];
  const missingMacros = recipeMacroKeys.filter((key) =>
    nutrition.missingNutrients.includes(key),
  );
  const partialMacros = recipeMacroKeys.filter((key) =>
    nutrition.partialNutrients.includes(key),
  );
  const compactSummary = nutrition.nutritionCompleteness === "COMPLETE"
    ? "Todos os nutrientes do plano estão disponíveis."
    : missingMacros.length
      ? `Energia ou macronutrientes têm ${missingMacros.length} ausência(s); os totais exibem somente valores conhecidos.`
      : `Energia e macronutrientes têm valores numéricos; ${partialMacros.length} deles e ${nutrition.partialNutrients.length - partialMacros.length} demais nutrientes são parciais, e ${nutrition.missingNutrients.length} permanecem ausentes.`;

  return (
    <div
      aria-label="Disponibilidade nutricional do plano"
      className={`rounded-xl border p-3 text-sm ${nutrition.nutritionCompleteness === "COMPLETE" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}
      role="status"
    >
      <p className="font-black">{compactSummary}</p>
      {groupedRecipes.length ? (
        <details className="mt-2">
          <summary className="cursor-pointer font-bold">
            Ver detalhes por receita ({groupedRecipes.length})
          </summary>
          <div className="mt-2 grid gap-2 border-t border-amber-200 pt-2">
            {groupedRecipes.map(([key, group]) => (
              <section className="rounded-lg bg-white/80 p-2" key={key}>
                <p className="font-black">
                  {group.title} · snapshot v{group.version}
                </p>
                <p className="text-xs">Refeições: {[...group.meals].join(", ")}.</p>
                {group.partial.size ? <p className="mt-1 text-xs">
                  Parciais: {[...group.partial]
                    .map((nutrient) => nutrientLabels[nutrient])
                    .join(", ")}.
                </p> : null}
                {group.missing.size ? <p className="mt-1 text-xs">
                  Ausentes: {[...group.missing]
                    .map((nutrient) => nutrientLabels[nutrient])
                    .join(", ")}.
                </p> : null}
              </section>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function prescribedAmount(food: MealPlanRecordFood) {
  return food.prescribedAmount ?? food.grams;
}

function prescribedAmountInput(food: MealPlanRecordFood) {
  const value = prescribedAmount(food);
  return value > 0 ? formatMealPlanDecimalInput(value) : "";
}

function quantityInput(food: MealPlanRecordFood) {
  return food.quantity > 0 ? formatMealPlanDecimalInput(food.quantity) : "";
}

function currentFoodComposition(meals: readonly MealPlanRecordMeal[]) {
  const composition = meals.map((meal) => [
    ...new Set(
      meal.items.filter(isMealPlanFoodItem).flatMap((food) => {
        const foodId = food.catalogFoodId.trim();
        return foodId ? [foodId] : [];
      }),
    ),
  ]);
  return composition.some((mealFoodIds) => mealFoodIds.length > 0)
    ? composition
    : undefined;
}

function isDirectPrescription(
  food: MealPlanRecordFood,
  pendingDirectUnit?: "g" | "ml",
) {
  return Boolean(pendingDirectUnit) || !food.selectedIbgeMeasureId;
}

function prescribedMeasureLabel(food: MealPlanRecordFood) {
  const measure = food.selectedIbgeMeasureId
    ? food.ibgeMeasureOptions?.find(
        (option) => option.id === food.selectedIbgeMeasureId,
      )
    : undefined;
  return measure
    ? `${n(food.quantity, 2)} × ${measure.label} (${n(prescribedAmount(food))} ${food.prescribedUnit ?? measure.unit})`
    : `${n(prescribedAmount(food))} ${food.prescribedUnit ?? "g"}`;
}

function selectedMeasureName(food: MealPlanRecordFood) {
  return food.selectedIbgeMeasureId
    ? food.ibgeMeasureOptions?.find(
        (option) => option.id === food.selectedIbgeMeasureId,
      )?.measureName ?? food.householdMeasure
    : (food.prescribedUnit ?? "g") === "ml"
      ? "Mililitros"
      : "Gramas";
}

function cloneMealRecords(source: readonly MealPlanRecordMeal[]) {
  return source.map((meal) => ({
    ...meal,
    items: meal.items.map((item) =>
      isMealPlanRecipeItem(item)
        ? {
            ...item,
            portion: { ...item.portion },
            snapshotNutrients: { ...item.snapshotNutrients },
            prescribedNutrients: { ...item.prescribedNutrients },
            missingNutrients: [...item.missingNutrients],
            partialNutrients: [...(item.partialNutrients ?? [])],
          }
        : { ...item },
    ),
  }));
}

const foodSubstitutionService = {
  createReplacement: createMealPlanSubstitutionReplacement,
  attach: attachMealPlanFoodSubstitution,
} as const;

function mealPlanDraftFingerprint(draft: MealPlanDraftSnapshot) {
  return JSON.stringify(draft, (key, value) =>
    key === "ibgeMeasureOptions" ? undefined : value,
  );
}

function readLocalDraft(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalDraft(key: string, value: LocalMealPlanDraft) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
  return true;
}

function removeLocalDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // O autosave no servidor continua funcional quando o armazenamento local está indisponível.
  }
}

function historyValue(value: string | null) {
  return value || "Não se aplica";
}

function PrescriptionHistory({
  entries,
}: {
  entries: readonly PrescriptionHistoryEntry[];
}) {
  return (
    <section aria-labelledby="prescription-history-title" className="space-y-4">
      <SectionHeader
        description="Registro técnico interno do prontuário. Estas informações não são incluídas automaticamente no PDF do paciente."
        eyebrow="Auditoria clínica"
        title="Histórico da Prescrição"
      />
      {entries.length ? (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card className="p-0">
                <details>
                  <summary className="flex cursor-pointer list-none flex-col gap-2 rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">
                        {PRESCRIPTION_ACTION_LABELS[entry.type]}
                      </Badge>
                      <span className="text-sm font-black">
                        {entry.professionalName}
                      </span>
                    </span>
                    <time className="text-xs font-semibold text-[var(--muted)]" dateTime={entry.occurredAt}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      }).format(new Date(entry.occurredAt))}
                    </time>
                  </summary>
                  <div className="grid gap-4 border-t border-[var(--line)] p-4 text-sm md:grid-cols-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Valor anterior</p>
                      <p className="mt-1 whitespace-pre-wrap">{historyValue(entry.previousValue)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Valor atual</p>
                      <p className="mt-1 whitespace-pre-wrap">{historyValue(entry.currentValue)}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Justificativa clínica</p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {entry.clinicalJustification ||
                          "Nenhuma observação clínica informada."}
                      </p>
                    </div>
                  </div>
                </details>
              </Card>
            </li>
          ))}
        </ol>
      ) : (
        <Card className="p-6 text-center">
          <p className="font-black">Nenhuma alteração registrada.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            O histórico será criado automaticamente após a primeira alteração salva na prescrição.
          </p>
        </Card>
      )}
    </section>
  );
}

function parseLocalMealPlanDraft(
  raw: string,
  initialPlan: MealPlanPrescriptionView,
): LocalMealPlanDraft | null {
  try {
    const attendanceId = initialPlan.attendanceId;
    if (!attendanceId) return null;
    const candidate = JSON.parse(raw) as Partial<LocalMealPlanDraft>;
    if (
      candidate.schemaVersion !== 1 ||
      candidate.patientId !== initialPlan.patientId ||
      candidate.attendanceId !== attendanceId ||
      typeof candidate.savedAt !== "number" ||
      !Number.isFinite(candidate.savedAt) ||
      typeof candidate.baseUpdatedAt !== "string" ||
      !candidate.draft ||
      typeof candidate.draft.clinicalJustification !== "string" ||
      candidate.draft.clinicalJustification.length > 10_000
    ) {
      return null;
    }
    const parsed = parseMealPlanRecordDraft({
      strategyEntryId: initialPlan.strategyEntryId,
      status: "DRAFT",
      aiDecision: candidate.draft.aiDecision,
      smartGenerationVersion: candidate.draft.smartGenerationVersion,
      meals: candidate.draft.meals,
      supplements: candidate.draft.supplements,
      dietaryReferenceProfile: candidate.draft.dietaryReferenceProfile,
      dietaryReferences: candidate.draft.dietaryReferences,
    });
    if (!parsed || parsed.status !== "DRAFT") return null;
    return {
      schemaVersion: 1,
      patientId: initialPlan.patientId,
      attendanceId,
      savedAt: candidate.savedAt,
      baseUpdatedAt: candidate.baseUpdatedAt,
      draft: {
        meals: parsed.meals,
        supplements: parsed.supplements,
        aiDecision: parsed.aiDecision,
        smartGenerationVersion: parsed.smartGenerationVersion,
        clinicalJustification: candidate.draft.clinicalJustification,
        dietaryReferenceProfile: parsed.dietaryReferenceProfile,
        dietaryReferences: parsed.dietaryReferences,
      },
    };
  } catch {
    return null;
  }
}

export function MealPlanFoundationWorkspace({
  initialPlan,
}: {
  initialPlan: MealPlanPrescriptionView;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [reuseMode, setReuseMode] = useState<MealPlanReuseMode | undefined>(
    initialPlan.reuseMode,
  );
  const [meals, setMeals] = useState<MealPlanRecordMeal[]>(
    cloneMealRecords(initialPlan.prescriptionMeals),
  );
  const [message, setMessage] = useState(
    initialPlan.sourcePlanEntryId
      ? "Cópia de trabalho criada a partir do plano anterior; o original permanece preservado."
      : "Plano vinculado à Estratégia Nutricional aprovada.",
  );
  const [supplements, setSupplements] = useState<
    MealPlanRecordSupplement[]
  >(
    initialPlan.prescriptionSupplements.map((supplement) => ({
      ...supplement,
    })),
  );
  const [clinicalJustification, setClinicalJustification] = useState("");
  const [activeTab, setActiveTab] = useState<"PLAN" | "HISTORY">("PLAN");
  const [workspaceTab, setWorkspaceTab] = useState<"ELABORATION" | "ADEQUACY" | "ANALYSIS">("ELABORATION");
  const [dietaryReferenceProfile, setDietaryReferenceProfile] = useState(initialPlan.dietaryReferenceProfile);
  const [dietaryReferences, setDietaryReferences] = useState(initialPlan.dietaryReferences);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [reviewStatement, setReviewStatement] = useState("");
  const [reviewedDraftFingerprint, setReviewedDraftFingerprint] = useState<string>();
  const [targetDeviationAuthorization, setTargetDeviationAuthorization] =
    useState(initialPlan.targetDeviationAuthorization);
  const [targetDeviationStatement, setTargetDeviationStatement] = useState(
    initialPlan.targetDeviationAuthorization?.statement ?? "",
  );
  const [activeMealId, setActiveMealId] = useState<string | undefined>(
    initialPlan.prescriptionMeals[0]?.id,
  );
  const [showStrategyDetails, setShowStrategyDetails] = useState(false);
  const [showClinicalJustification, setShowClinicalJustification] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentError, setAdjustmentError] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("IDLE");
  const [recoverableDraft, setRecoverableDraft] =
    useState<LocalMealPlanDraft>();
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [smartPreview, setSmartPreview] = useState<SmartPlanPreviewState>();
  const [mealReviewStatus, setMealReviewStatus] = useState<
    Readonly<Record<string, MealReviewStatus>>
  >(() =>
    initialPlan.aiDecision === "APPROVED"
      ? Object.fromEntries(
          initialPlan.prescriptionMeals.map((meal) => [
            meal.id,
            "APPROVED" as const,
          ]),
        )
      : {},
  );
  const [regeneratingMealId, setRegeneratingMealId] = useState<string>();
  const [generationPending, setGenerationPending] = useState<
    readonly SmartPlanGenerationPendingField[]
  >([]);
  const [generationOptional, setGenerationOptional] = useState<
    readonly SmartPlanGenerationPendingField[]
  >([]);
  const [showIntelligentReplacementConfirmation, setShowIntelligentReplacementConfirmation] = useState(false);
  const [aiDecision, setAiDecision] = useState<MealPlanAiDecision>(
    initialPlan.aiDecision,
  );
  const [smartGenerationVersion, setSmartGenerationVersion] = useState(
    initialPlan.smartGenerationVersion,
  );
  const [legacyPreviewDismissed, setLegacyPreviewDismissed] = useState(false);
  const [assemblyMode, setAssemblyMode] = useState<MealPlanAssemblyMode>(
    initialPlan.aiDecision === "SUGGESTION_GENERATED" ||
      initialPlan.aiDecision === "APPROVED"
      ? "INTELLIGENT"
      : "MANUAL",
  );
  const [activePicker, setActivePicker] = useState<{
    mealId: string;
    foodId?: string;
  }>();
  const [pickerMode, setPickerMode] = useState<ItemPickerMode>("FOOD");
  const [query, setQuery] = useState("");
  const [foodResults, setFoodResults] = useState<readonly ProfessionalFood[]>(
    [],
  );
  const [equivalenceFoodId, setEquivalenceFoodId] = useState<string>();
  const [equivalents, setEquivalents] = useState<
    readonly NutritionalEquivalent[]
  >([]);
  const [pendingSubstitution, setPendingSubstitution] =
    useState<PendingFoodSubstitution>();
  const [searching, setSearching] = useState(false);
  const [recipeResults, setRecipeResults] = useState<readonly AccessibleRecipe[]>(
    [],
  );
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>();
  const [selectedRecipeSnapshotId, setSelectedRecipeSnapshotId] =
    useState<string>();
  const [newRecipeServingsInput, setNewRecipeServingsInput] = useState("1");
  const [recipeSelectionError, setRecipeSelectionError] = useState("");
  const [recipeSnapshotUpdateTarget, setRecipeSnapshotUpdateTarget] =
    useState<RecipeSnapshotUpdateTarget>();
  const [portionInputs, setPortionInputs] = useState<
    Readonly<Record<string, FoodPortionInputState>>
  >({});
  const [recipePortionInputs, setRecipePortionInputs] = useState<
    Readonly<Record<string, RecipePortionInputState>>
  >({});
  const autoSaveTimer = useRef<number | undefined>(undefined);
  const autoSaveInFlight = useRef(false);
  const manualSaveInFlight = useRef(false);
  const hydrationComplete = useRef(false);
  const recoveryDecisionPending = useRef(false);
  const queuedAutoSave = useRef<
    | {
        readonly draft: MealPlanDraftSnapshot;
        readonly fingerprint: string;
      }
    | undefined
  >(undefined);
  const autoSaveRunner = useRef<
    | ((draft: MealPlanDraftSnapshot, fingerprint: string) => Promise<boolean>)
    | undefined
  >(undefined);
  const generationInFlight = useRef(false);
  const previewBaselineMeals = useRef<readonly MealPlanRecordMeal[] | null>(null);
  const measureOptionsCache = useRef(
    new Map<string, Promise<readonly MealPlanIbgeMeasureOption[]>>(),
  );
  const equivalenceSearchCache = useRef(
    new Map<string, readonly NutritionalEquivalent[]>(),
  );
  const strategy = plan.strategy;
  const planObjective = strategy
    ? resolveMealPlanObjective(strategy)
    : undefined;
  const finalized = plan.status === "APPROVED";
  const localDraftStorageKey = useMemo(
    () =>
      `saulo-ai:meal-plan-pending:v1:${plan.patientId}:${plan.attendanceId}`,
    [plan.attendanceId, plan.patientId],
  );
  const draftSnapshot = useMemo<MealPlanDraftSnapshot>(
    () => ({
      meals,
      supplements,
      aiDecision,
      smartGenerationVersion,
      clinicalJustification,
      dietaryReferenceProfile,
      dietaryReferences,
      targetDeviationAuthorization,
    }),
    [aiDecision, clinicalJustification, dietaryReferenceProfile, dietaryReferences, meals, smartGenerationVersion, supplements, targetDeviationAuthorization],
  );
  const draftFingerprint = useMemo(
    () => mealPlanDraftFingerprint(draftSnapshot),
    [draftSnapshot],
  );
  const initialFingerprint = useRef(
    mealPlanDraftFingerprint({
      meals: initialPlan.prescriptionMeals,
      supplements: initialPlan.prescriptionSupplements,
      aiDecision: initialPlan.aiDecision,
      smartGenerationVersion: initialPlan.smartGenerationVersion,
      clinicalJustification: "",
      dietaryReferenceProfile: initialPlan.dietaryReferenceProfile,
      dietaryReferences: initialPlan.dietaryReferences,
      targetDeviationAuthorization: initialPlan.targetDeviationAuthorization,
    }),
  );
  const lastConfirmedFingerprint = useRef(initialFingerprint.current);
  const currentDraft = useRef(draftSnapshot);
  const currentDraftFingerprint = useRef(draftFingerprint);
  currentDraft.current = draftSnapshot;
  currentDraftFingerprint.current = draftFingerprint;
  const nutritionTotals = useMemo(
    () => calculateMealPlanNutritionTotals(meals),
    [meals],
  );
  const totals = nutritionTotals.values;
  const planNutritionAnalysis = useMemo(() => analyzeMealPlanNutrition(meals), [meals]);
  const requiredNutritionComplete = (["energyKcal", "proteinGrams", "carbohydratesGrams", "fatsGrams"] as const)
    .every((key) => planNutritionAnalysis.nutrients[key].coverage === "COMPLETE");
  const hasPartialNutrition =
    nutritionTotals.nutritionCompleteness === "PARTIAL";
  const hasFoods = useMemo(
    () => meals.some((meal) => meal.items.length > 0),
    [meals],
  );
  const scheduleCorrectionRequired = Boolean(
    strategy?.mealDistribution.some((meal) => !meal.time.trim()),
  );
  const blockedIntelligentPreview =
    scheduleCorrectionRequired &&
    (assemblyMode === "INTELLIGENT" ||
      initialPlan.aiDecision === "SUGGESTION_GENERATED" ||
      initialPlan.aiDecision === "APPROVED");
  const structurallyRejectedPreview =
    !legacyPreviewDismissed &&
    (initialPlan.aiDecision === "SUGGESTION_GENERATED" ||
      initialPlan.aiDecision === "APPROVED") &&
    (smartGenerationVersion ?? 0) < 2;
  const invalidIntelligentPreview =
    blockedIntelligentPreview || structurallyRejectedPreview;
  const scheduleCorrectionHref = plan.attendanceId
    ? mealScheduleCorrectionHref(plan.patientId, plan.attendanceId)
    : undefined;
  const smartPreviewPersisted = Boolean(
    aiDecision === "SUGGESTION_GENERATED" &&
      draftFingerprint === lastConfirmedFingerprint.current &&
      (autoSaveState === "SAVED" || autoSaveState === "IDLE"),
  );
  const activeMeal = meals.find((meal) => meal.id === activeMealId) ?? meals[0];
  const activeSubstitutionFood = activePicker?.foodId
    ? meals
        .find((meal) => meal.id === activePicker.mealId)
        ?.items.filter(isMealPlanFoodItem)
        .find((food) => food.id === activePicker.foodId)
    : undefined;
  const selectedRecipe = recipeResults.find(
    (recipe) => recipe.id === selectedRecipeId,
  );
  const selectedRecipeSnapshots = useMemo(
    () =>
      [...(selectedRecipe?.nutritionSnapshots ?? [])]
        .filter(
          (snapshot) =>
            snapshot.recipeId === selectedRecipe?.id &&
            typeof snapshot.id === "string" &&
            Number.isInteger(snapshot.version) &&
            Number(snapshot.servings) > 0,
        )
        .sort((left, right) => right.version - left.version),
    [selectedRecipe],
  );
  const filteredRecipeResults = useMemo(() => {
    const normalizedQuery = normalizeFoodSearchText(query);
    if (!normalizedQuery) return recipeResults;
    return recipeResults.filter((recipe) =>
      normalizeFoodSearchText(recipe.title).includes(normalizedQuery),
    );
  }, [query, recipeResults]);
  const rankedFoodResults = useMemo(() => {
    if (equivalenceFoodId) return foodResults;
    const normalizedQuery = normalizeFoodSearchText(query);
    if (!normalizedQuery) return foodResults;
    const score = (food: ProfessionalFood) => {
      const name = food.normalizedName;
      if (name === normalizedQuery) return 0;
      if (name.startsWith(normalizedQuery)) return 1;
      if (name.split(" ").some((word) => word.startsWith(normalizedQuery))) {
        return 2;
      }
      return name.includes(normalizedQuery) ? 3 : 4;
    };
    return [...foodResults].sort(
      (left, right) =>
        score(left) - score(right) ||
        left.officialName.localeCompare(right.officialName, "pt-BR"),
    );
  }, [equivalenceFoodId, foodResults, query]);
  const adequacy = useMemo(
    () =>
      strategy && requiredNutritionComplete ? calculateNutritionAdequacy({
        target: {
          energyKcal: strategy.caloriesKcal,
          proteinGrams: strategy.proteinGrams,
          carbohydratesGrams: strategy.carbohydratesGrams,
          fatsGrams: strategy.fatsGrams,
          fiberGrams: strategy.fiberGrams,
          waterMl: strategy.waterMl,
        },
        actual: {
          ...totals,
          waterMl: strategy.waterMl,
        },
      }) : undefined,
    [requiredNutritionComplete, strategy, totals],
  );
  const targetDeviations = useMemo(
    () => strategy && requiredNutritionComplete
      ? calculateMealPlanTargetDeviations({
          target: {
            energyKcal: strategy.caloriesKcal,
            proteinGrams: strategy.proteinGrams,
            carbohydratesGrams: strategy.carbohydratesGrams,
            fatsGrams: strategy.fatsGrams,
          },
          actual: totals,
        })
      : undefined,
    [requiredNutritionComplete, strategy, totals],
  );
  const targetDeviationsOutsideTolerance = targetDeviations?.filter(
    (deviation) => deviation.outsideTolerance,
  ) ?? [];
  const nutritionTargetsInvalid = targetDeviationsOutsideTolerance.length > 0;
  const targetDeviationAuthorizationValid = Boolean(
    targetDeviations &&
      targetDeviationAuthorizationMatches({
        authorization: targetDeviationAuthorization,
        deviations: targetDeviations,
      }),
  );
  const intelligentReviewRequired =
    assemblyMode === "INTELLIGENT" ||
    initialPlan.aiDecision === "SUGGESTION_GENERATED" ||
    initialPlan.aiDecision === "APPROVED";
  const intelligentPreviewNotApproved =
    intelligentReviewRequired && aiDecision !== "APPROVED";
  const pendingMealReviewCount = intelligentReviewRequired
    ? meals.filter(
        (meal) =>
          (mealReviewStatus[meal.id] ?? "PENDING_REVIEW") !== "APPROVED",
      ).length
    : 0;
  const workflowCompletionBlockedReason = finalized
    ? "Este Plano Alimentar já foi concluído."
    : saving || autoSaveState === "SAVING"
      ? "Aguarde a confirmação do salvamento em andamento."
      : !hasFoods
        ? "Adicione ao menos um alimento ou receita antes de concluir."
        : !requiredNutritionComplete
          ? "Energia e macronutrientes devem estar completos em todos os alimentos e receitas."
        : invalidIntelligentPreview
          ? structurallyRejectedPreview
            ? "A prévia inteligente atual foi rejeitada por incoerência alimentar."
            : "Corrija os horários pendentes antes de concluir esta prévia."
          : pendingMealReviewCount > 0
              ? `${pendingMealReviewCount} ${pendingMealReviewCount === 1 ? "refeição aguarda" : "refeições aguardam"} revisão antes da conclusão.`
              : intelligentPreviewNotApproved
                ? "A prévia inteligente ainda precisa ser aprovada e salva."
                : undefined;
  const preReviewEligibility = evaluateMealPlanCompletion({
    meals,
    planRevision: plan.revision,
    targetDeviations,
    targetDeviationAuthorization,
    additionalBlockingReasons: workflowCompletionBlockedReason
      ? [workflowCompletionBlockedReason]
      : [],
  });
  const proposedProfessionalReview: MealPlanProfessionalReview | undefined =
    reviewAcknowledged &&
    reviewedDraftFingerprint === draftFingerprint &&
    reviewStatement.trim()
      ? {
          reviewedByUserId: plan.responsibleUserId,
          reviewedByName: plan.responsibleProfessional,
          reviewedAt: new Date().toISOString(),
          planRevision: plan.revision,
          contentFingerprint: mealPlanContentFingerprint(meals),
          acknowledgedLimitations: preReviewEligibility.limitations,
          statement: reviewStatement.trim(),
        }
      : undefined;
  const completionEligibility = evaluateMealPlanCompletion({
    meals,
    planRevision: plan.revision,
    review: proposedProfessionalReview,
    targetDeviations,
    targetDeviationAuthorization,
    additionalBlockingReasons: workflowCompletionBlockedReason
      ? [workflowCompletionBlockedReason]
      : [],
  });
  const completionBlockedReason = completionEligibility.blockingReasons[0];
  const completionBlocked = Boolean(completionBlockedReason);

  useClinicalFlowPrimaryActionState({
    disabled: completionBlocked,
    blockedReason: completionBlockedReason,
  });

  useEffect(() => {
    if (!activePicker || equivalenceFoodId || pickerMode !== "FOOD") return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const params = new URLSearchParams({
        scenario: "complete",
        pageSize: "50",
        source: "TACO",
      });
      if (query.trim()) params.set("query", query.trim());
      const response = await fetch(`/api/foods?${params}`, {
        headers: developmentUserRequestHeaders(),
        signal: controller.signal,
      }).catch(() => null);
      if (controller.signal.aborted) return;
      const result = response
        ? ((await response.json().catch(() => null)) as FoodSearchResult | null)
        : null;
      if (controller.signal.aborted) return;
      if (response?.ok && result) {
        setFoodResults(result.items);
      } else setFoodResults([]);
      setSearching(false);
    }, 100);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activePicker, equivalenceFoodId, pickerMode, query]);

  useEffect(() => {
    if (!activePicker || activePicker.foodId || pickerMode !== "RECIPE") return;
    const controller = new AbortController();
    void (async () => {
      setSearching(true);
      setRecipeSelectionError("");
      const response = await fetch("/api/recipes?page=1&pageSize=100", {
        headers: developmentUserRequestHeaders(),
        cache: "no-store",
        signal: controller.signal,
      }).catch(() => null);
      if (controller.signal.aborted) return;
      const result = response
        ? ((await response.json().catch(() => null)) as
            | { recipes?: readonly AccessibleRecipe[]; message?: string }
            | null)
        : null;
      if (controller.signal.aborted) return;
      if (response?.ok && result?.recipes) {
        setRecipeResults(result.recipes);
        if (recipeSnapshotUpdateTarget) {
          const recipe = result.recipes.find(
            (candidate) =>
              candidate.id === recipeSnapshotUpdateTarget.item.recipeId,
          );
          const newest = recipe?.nutritionSnapshots
            .filter(
              (snapshot) =>
                snapshot.recipeId === recipe.id &&
                Number(snapshot.servings) > 0 &&
                snapshot.version >
                  recipeSnapshotUpdateTarget.item.recipeNutritionSnapshotVersion,
            )
            .sort((left, right) => right.version - left.version)[0];
          setSelectedRecipeId(recipe?.id);
          setSelectedRecipeSnapshotId(newest?.id);
          setRecipeSelectionError(
            newest
              ? ""
              : "Não há snapshot mais novo para esta receita. Calcule uma nova versão na página da receita e tente novamente.",
          );
        }
      } else {
        setRecipeResults([]);
        setRecipeSelectionError(
          result?.message ?? "Não foi possível consultar as receitas acessíveis.",
        );
      }
      setSearching(false);
    })();
    return () => controller.abort();
  }, [activePicker, pickerMode, recipeSnapshotUpdateTarget]);

  useEffect(() => {
    if (!activePicker?.foodId || !equivalenceFoodId) return;
    const currentFood = meals
      .find((meal) => meal.id === activePicker.mealId)
      ?.items.filter(isMealPlanFoodItem)
      .find((food) => food.id === activePicker.foodId);
    if (
      !currentFood ||
      currentFood.id !== equivalenceFoodId ||
      !currentFood.catalogFoodId
    ) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => void (async () => {
      setSearching(true);
      const params = new URLSearchParams({
          grams: String(currentFood.grams),
          patientId: plan.patientId,
          attendanceId: plan.attendanceId ?? "",
          energyKcal: String(totals.energyKcal),
          proteinGrams: String(totals.proteinGrams),
          carbohydratesGrams: String(totals.carbohydratesGrams),
          fatsGrams: String(totals.fatsGrams),
          fiberGrams: String(totals.fiberGrams),
        });
      if (query.trim()) params.set("query", query.trim());
      const cacheKey = `${currentFood.catalogFoodId}?${params}`;
      const cachedSuggestions = equivalenceSearchCache.current.get(cacheKey);
      if (cachedSuggestions) {
        setEquivalents(cachedSuggestions);
        setFoodResults(cachedSuggestions.map((item) => item.food));
        setSearching(false);
        setMessage(
          cachedSuggestions.length
            ? `${cachedSuggestions.length} equivalente(s) calculado(s). Selecione para confirmar a substituição.`
            : "Nenhum equivalente nutricional compatível foi encontrado.",
        );
        return;
      }
      const response = await fetch(
        `/api/foods/${currentFood.catalogFoodId}/equivalents?${params}`,
        {
          headers: developmentUserRequestHeaders(),
          signal: controller.signal,
        },
      ).catch(() => null);
      if (controller.signal.aborted) return;
      const result = response
        ? ((await response.json().catch(() => null)) as
            | {
                equivalents?: readonly NutritionalEquivalent[];
                message?: string;
              }
            | null)
        : null;
      if (controller.signal.aborted) return;
      const suggestions =
        response?.ok && result?.equivalents ? result.equivalents : [];
      if (response?.ok) {
        if (equivalenceSearchCache.current.size >= 30) {
          const oldestKey = equivalenceSearchCache.current.keys().next().value;
          if (oldestKey) equivalenceSearchCache.current.delete(oldestKey);
        }
        equivalenceSearchCache.current.set(cacheKey, suggestions);
      }
      setEquivalents(suggestions);
      setFoodResults(suggestions.map((item) => item.food));
      setSearching(false);
      setMessage(
        !response?.ok && result?.message
          ? result.message
          : suggestions.length
          ? `${suggestions.length} equivalente(s) calculado(s). Selecione para confirmar a substituição.`
          : "Nenhum equivalente nutricional compatível foi encontrado.",
      );
    })(), query.trim() ? 120 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activePicker, equivalenceFoodId, meals, plan.attendanceId, plan.patientId, query, totals]);

  useEffect(() => {
    if (!activePicker) return;
    document.getElementById("meal-plan-item-search")?.focus();
  }, [activePicker, equivalenceFoodId, pickerMode]);

  useEffect(() => {
    if (finalized) {
      removeLocalDraft(localDraftStorageKey);
      hydrationComplete.current = true;
      return;
    }
    const raw = readLocalDraft(localDraftStorageKey);
    if (raw) {
      const localDraft = parseLocalMealPlanDraft(raw, initialPlan);
      const serverUpdatedAt = Date.parse(initialPlan.updatedAt);
      if (
        localDraft &&
        localDraft.savedAt > serverUpdatedAt &&
        mealPlanDraftFingerprint(localDraft.draft) !==
          lastConfirmedFingerprint.current
      ) {
        recoveryDecisionPending.current = true;
        setRecoverableDraft(localDraft);
      } else {
        removeLocalDraft(localDraftStorageKey);
      }
    }
    hydrationComplete.current = true;
  }, [finalized, initialPlan, localDraftStorageKey]);

  useEffect(() => {
    if (
      !hydrationComplete.current ||
      recoveryDecisionPending.current ||
      plan.status !== "DRAFT" ||
      !plan.attendanceId
    ) {
      return;
    }
    if (draftFingerprint === lastConfirmedFingerprint.current) {
      removeLocalDraft(localDraftStorageKey);
      return;
    }

    const localDraft: LocalMealPlanDraft = {
      schemaVersion: 1,
      patientId: plan.patientId,
      attendanceId: plan.attendanceId,
      savedAt: Date.now(),
      baseUpdatedAt: plan.updatedAt,
      draft: draftSnapshot,
    };
    writeLocalDraft(localDraftStorageKey, localDraft);
    if (!autoSaveInFlight.current) setAutoSaveState("PENDING");
    if (autoSaveTimer.current !== undefined) {
      window.clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = window.setTimeout(() => {
      void autoSaveRunner.current?.(draftSnapshot, draftFingerprint);
    }, 3_000);
  }, [
    draftFingerprint,
    draftSnapshot,
    localDraftStorageKey,
    plan.attendanceId,
    plan.patientId,
    plan.status,
    plan.updatedAt,
  ]);

  useEffect(
    () => () => {
      if (autoSaveTimer.current !== undefined) {
        window.clearTimeout(autoSaveTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    const foodIds = [...new Set(
      meals.flatMap((meal) =>
        meal.items.filter(isMealPlanFoodItem).flatMap((food) =>
          food.catalogFoodId && food.ibgeMeasureOptions === undefined
            ? [food.catalogFoodId]
            : [],
        ),
      ),
    )];
    if (!foodIds.length) return;
    let cancelled = false;
    void Promise.all(
      foodIds.map(async (foodId) => [
        foodId,
        await loadIbgeMeasureOptions(foodId),
      ] as const),
    ).then((entries) => {
      if (cancelled) return;
      const optionsByFoodId = new Map(entries);
      setMeals((current) => current.map((meal) => ({
        ...meal,
        items: meal.items.map((item) =>
          isMealPlanFoodItem(item)
            ? {
                ...item,
                ibgeMeasureOptions:
                  optionsByFoodId.get(item.catalogFoodId) ??
                  item.ibgeMeasureOptions ??
                  [],
              }
            : item,
        ),
      })));
    });
    return () => {
      cancelled = true;
    };
  }, [meals]);

  function updateMeal(
    mealId: string,
    change: Partial<Pick<MealPlanRecordMeal, "name" | "time" | "observations">>,
  ) {
    const nextMeals = meals.map((meal) =>
      meal.id === mealId ? { ...meal, ...change } : meal,
    );
    setMeals(nextMeals);
    markMealEdited(mealId);
    scheduleAutoSave(nextMeals);
  }

  function markMealEdited(mealId: string) {
    if (assemblyMode !== "INTELLIGENT") return;
    setMealReviewStatus((current) => ({ ...current, [mealId]: "EDITED" }));
    setAiDecision("SUGGESTION_GENERATED");
  }

  function addMeal(name: string) {
    const id = crypto.randomUUID();
    const nextMeals = [
      ...meals,
      {
        id,
        name,
        order: meals.length + 1,
        items: [],
      },
    ];
    setMeals(nextMeals);
    setActiveMealId(id);
    scheduleAutoSave(nextMeals);
  }

  function removeMeal(mealId: string) {
    const nextMeals = meals
      .filter((meal) => meal.id !== mealId)
      .map((meal, index) => ({ ...meal, order: index + 1 }));
    setMeals(nextMeals);
    if (activeMealId === mealId) setActiveMealId(nextMeals[0]?.id);
    scheduleAutoSave(nextMeals);
  }

  function moveMeal(mealId: string, direction: -1 | 1) {
    const index = meals.findIndex((meal) => meal.id === mealId);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= meals.length) return;
    const reordered = [...meals];
    [reordered[index], reordered[destination]] = [
      reordered[destination],
      reordered[index],
    ];
    const nextMeals = reordered.map((meal, order) => ({
      ...meal,
      order: order + 1,
    }));
    setMeals(nextMeals);
    scheduleAutoSave(nextMeals);
  }

  function addFoodLine(mealId: string) {
    setRecipeSnapshotUpdateTarget(undefined);
    setSearching(false);
    setPickerMode("FOOD");
    setQuery("");
    setFoodResults([]);
    setRecipeResults([]);
    setSelectedRecipeId(undefined);
    setSelectedRecipeSnapshotId(undefined);
    setNewRecipeServingsInput("1");
    setRecipeSelectionError("");
    setEquivalenceFoodId(undefined);
    setEquivalents([]);
    setActivePicker({ mealId });
  }

  function openFoodSubstitution(mealId: string, foodId: string) {
    setSearching(false);
    setPickerMode("FOOD");
    setPendingSubstitution(undefined);
    setActivePicker({ mealId, foodId });
    setEquivalenceFoodId(foodId);
    setQuery("");
  }

  async function loadIbgeMeasureOptions(foodId: string) {
    const cached = measureOptionsCache.current.get(foodId);
    if (cached) return cached;
    const request = (async () => {
      const response = await fetch(`/api/foods/${foodId}/household-measures`, {
        headers: developmentUserRequestHeaders(),
        cache: "no-store",
      }).catch(() => null);
      const result = response
        ? ((await response.json().catch(() => null)) as
            | { options?: readonly MealPlanIbgeMeasureOption[] }
            | null)
        : null;
      return response?.ok && result?.options ? result.options : [];
    })();
    measureOptionsCache.current.set(foodId, request);
    return request;
  }

  async function chooseFood(
    food: ProfessionalFood,
    equivalent?: NutritionalEquivalent,
  ) {
    const picker = activePicker;
    if (!picker) return;
    let insertedMeals: readonly MealPlanRecordMeal[] | undefined;
    if (equivalent && picker.foodId) {
      const current = meals
        .find((meal) => meal.id === picker.mealId)
        ?.items.filter(isMealPlanFoodItem)
        .find((item) => item.id === picker.foodId);
      if (!current) return;
      const replacement = foodSubstitutionService.createReplacement({
        current,
        candidate: food,
        equivalent,
        measureOptions: await loadIbgeMeasureOptions(food.id),
        replacementId: crypto.randomUUID(),
      });
      if (!replacement) {
        setMessage(
          "Este alimento não possui composição nutricional válida no Banco Mestre.",
        );
        return;
      }
      setPendingSubstitution({
        mealId: picker.mealId,
        foodId: picker.foodId,
        current,
        replacement,
        equivalent,
      });
      return;
    }
    const baseFood = createMealPlanFoodFromMaster(food);
    if (!baseFood) {
      setMessage(
        "Este alimento não possui composição nutricional válida no Banco Mestre.",
      );
      return;
    }
    const selected = {
      ...baseFood,
      ibgeMeasureOptions: await loadIbgeMeasureOptions(food.id),
    };
    if (picker.foodId) {
      setMeals((current) =>
        current.map((meal) =>
          meal.id !== picker.mealId
            ? meal
            : {
                ...meal,
                items: meal.items.map((item) =>
                  item.id === picker.foodId
                    ? { ...selected, id: item.id }
                    : item,
                ),
              },
        ),
      );
    } else {
      const nextMeals = meals.map((meal) =>
        meal.id === picker.mealId
          ? { ...meal, items: [...meal.items, selected] }
          : meal,
      );
      insertedMeals = nextMeals;
      setMeals(nextMeals);
      setPortionInputs((current) => ({
        ...current,
        [selected.id]: {
          quantityInput: quantityInput(selected),
          gramsInput: prescribedAmountInput(selected),
        },
      }));
      window.setTimeout(() => {
        document
          .getElementById(
            isDirectPrescription(selected)
              ? `food-grams-${selected.id}`
              : `food-quantity-${selected.id}`,
          )
          ?.focus();
      }, 0);
    }
    setActivePicker(undefined);
    setEquivalenceFoodId(undefined);
    setEquivalents([]);
    setQuery("");
    setMessage(
      equivalenceFoodId
        ? "Alimento substituído inline e nutrientes recalculados."
        : "Alimento adicionado e nutrientes recalculados.",
    );
    return insertedMeals;
  }

  function openRecipeSnapshotUpdate(
    mealId: string,
    item: MealPlanRecordRecipe,
  ) {
    setRecipeSnapshotUpdateTarget({ mealId, item });
    setPickerMode("RECIPE");
    setQuery(item.recipeTitle);
    setRecipeResults([]);
    setSelectedRecipeId(undefined);
    setSelectedRecipeSnapshotId(undefined);
    setNewRecipeServingsInput(
      formatMealPlanDecimalInput(item.portion.prescribedServings),
    );
    setRecipeSelectionError("");
    setActivePicker({ mealId });
  }

  function chooseRecipe() {
    const picker = activePicker;
    const recipe = selectedRecipe;
    const snapshot = selectedRecipeSnapshots.find(
      (candidate) => candidate.id === selectedRecipeSnapshotId,
    );
    const prescribedServings = Number(
      newRecipeServingsInput.replace(",", "."),
    );
    const recipeServings = Number(snapshot?.servings);
    if (!picker || picker.foodId || !recipe || !snapshot) {
      setRecipeSelectionError("Selecione uma receita e uma versão nutricional válida.");
      return;
    }
    if (!Number.isFinite(prescribedServings) || prescribedServings <= 0) {
      setRecipeSelectionError("A quantidade de porções deve ser positiva e finita.");
      return;
    }
    if (!Number.isFinite(recipeServings) || recipeServings <= 0) {
      setRecipeSelectionError("O snapshot selecionado não possui número de porções válido.");
      return;
    }
    if (
      recipeSnapshotUpdateTarget &&
      (recipe.id !== recipeSnapshotUpdateTarget.item.recipeId ||
        snapshot.version <=
          recipeSnapshotUpdateTarget.item.recipeNutritionSnapshotVersion)
    ) {
      setRecipeSelectionError(
        "Selecione um snapshot mais novo da mesma receita para atualizar o rascunho.",
      );
      return;
    }

    const trustedSnapshotNutrients = snapshotNutrients(snapshot);
    const recipeContentSnapshot = parseRecipeContentSnapshot(
      snapshot.recipeContentSnapshot,
    );
    const prescribedNutrients = calculatePrescribedRecipeNutrients(
      trustedSnapshotNutrients,
      prescribedServings,
      recipeServings,
    );
    const missingNutrients = recipeNutrientKeys.filter(
      (key) => trustedSnapshotNutrients[key] === null,
    );
    const partialNutrients = snapshotPartialNutrients(snapshot).filter(
      (key) => trustedSnapshotNutrients[key] !== null,
    );
    const item: MealPlanRecordRecipe = {
      itemType: "RECIPE",
      id: recipeSnapshotUpdateTarget?.item.id ?? crypto.randomUUID(),
      recipeId: recipe.id,
      recipeTitle: recipeContentSnapshot?.title ?? recipe.title,
      recipeNutritionSnapshotId: snapshot.id,
      recipeNutritionSnapshotVersion: snapshot.version,
      ...(recipeContentSnapshot ? { recipeContentSnapshot } : {}),
      portion: {
        kind: "SERVINGS",
        prescribedServings,
        recipeServings,
        description: formatRecipePortionDescription(prescribedServings, recipeServings),
      },
      nutritionCompleteness:
        missingNutrients.length || partialNutrients.length
          ? "PARTIAL"
          : "COMPLETE",
      snapshotNutrients: trustedSnapshotNutrients,
      prescribedNutrients,
      missingNutrients,
      partialNutrients,
      nutrientForms: snapshotNutrientForms(snapshot),
    };
    const nextMeals = meals.map((meal) => {
      if (meal.id !== picker.mealId) return meal;
      return {
        ...meal,
        items: recipeSnapshotUpdateTarget
          ? meal.items.map((current) =>
              current.id === recipeSnapshotUpdateTarget.item.id
                ? item
                : current,
            )
          : [...meal.items, item],
      };
    });
    setMeals(nextMeals);
    setRecipePortionInputs((current) => ({
      ...current,
      [item.id]: {
        prescribedServingsInput: formatMealPlanDecimalInput(prescribedServings),
      },
    }));
    markMealEdited(picker.mealId);
    scheduleAutoSave(nextMeals);
    setActivePicker(undefined);
    setRecipeSnapshotUpdateTarget(undefined);
    setQuery("");
    setRecipeSelectionError("");
    setMessage(
      recipeSnapshotUpdateTarget
        ? `Rascunho atualizado explicitamente para o snapshot v${snapshot.version}; a prescrição não foi finalizada.`
        : missingNutrients.length || partialNutrients.length
        ? "Receita adicionada com nutrição parcial; nutrientes indisponíveis foram preservados."
        : "Receita adicionada com o snapshot nutricional selecionado.",
    );
  }

  function updateRecipePortion(
    mealId: string,
    recipe: MealPlanRecordRecipe,
    input: string,
  ) {
    const prescribedServings = Number(input.replace(",", "."));
    const valid = Number.isFinite(prescribedServings) && prescribedServings > 0;
    setRecipePortionInputs((current) => ({
      ...current,
      [recipe.id]: {
        prescribedServingsInput: input,
        error: valid ? undefined : "Informe uma quantidade de porções positiva.",
      },
    }));
    if (!valid) return;

    const nextRecipe: MealPlanRecordRecipe = {
      ...recipe,
      portion: {
        ...recipe.portion,
        prescribedServings,
        description: formatRecipePortionDescription(
          prescribedServings,
          recipe.portion.recipeServings,
        ),
      },
      prescribedNutrients: calculatePrescribedRecipeNutrients(
        recipe.snapshotNutrients,
        prescribedServings,
        recipe.portion.recipeServings,
      ),
    };
    const nextMeals = meals.map((meal) =>
      meal.id === mealId
        ? {
            ...meal,
            items: meal.items.map((item) =>
              item.id === recipe.id ? nextRecipe : item,
            ),
          }
        : meal,
    );
    setMeals(nextMeals);
    markMealEdited(mealId);
    scheduleAutoSave(nextMeals);
  }

  function finishRecipePortionInput(recipe: MealPlanRecordRecipe) {
    const current = recipePortionInputs[recipe.id];
    if (!current?.error) return;
    setRecipePortionInputs((inputs) => ({
      ...inputs,
      [recipe.id]: {
        prescribedServingsInput: formatMealPlanDecimalInput(
          recipe.portion.prescribedServings,
        ),
      },
    }));
    setMessage(current.error);
  }

  function confirmFoodSubstitution() {
    const pending = pendingSubstitution;
    if (!pending) return;
    const nextMeals = foodSubstitutionService.attach({
      meals,
      mealId: pending.mealId,
      foodId: pending.foodId,
      replacement: pending.replacement,
      substitutionId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      responsibleUser: plan.responsibleProfessional,
      suggestionReason: pending.equivalent.suggestionReason,
    }) as MealPlanRecordMeal[];
    setMeals(nextMeals);
    markMealEdited(pending.mealId);
    scheduleAutoSave(nextMeals);
    setPendingSubstitution(undefined);
    setActivePicker(undefined);
    setEquivalenceFoodId(undefined);
    setEquivalents([]);
    setQuery("");
    setMessage("Alternativa vinculada à quantidade prescrita e aguardando salvamento; ela não foi somada ao plano.");
  }

  function updatePendingSubstitutionPortion(
    field: "quantity" | "householdMeasure" | "prescribedAmount",
    value: string,
  ) {
    setPendingSubstitution((current) => {
      if (!current) return current;
      const replacement = current.replacement;
      if (field === "householdMeasure") {
        return {
          ...current,
          replacement: {
            ...replacement,
            selectedIbgeMeasureId: undefined,
            householdMeasure: value,
          },
        };
      }

      const parsed = Number(value.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) return current;
      if (field === "quantity") {
        return {
          ...current,
          replacement: {
            ...replacement,
            selectedIbgeMeasureId: undefined,
            quantity: parsed,
          },
        };
      }

      return {
        ...current,
        replacement: {
          ...replacement,
          selectedIbgeMeasureId: undefined,
          grams: parsed,
          prescribedAmount: parsed,
          nutrients: calculateFoodNutrientsForGrams(
            replacement.nutrientsPer100g,
            parsed,
          ),
        },
      };
    });
  }

  function updateFoodSubstitutionPortion(
    mealId: string,
    foodId: string,
    substitutionId: string,
    field: "quantity" | "householdMeasure" | "prescribedAmount",
    value: string,
  ) {
    const parsed = field === "householdMeasure"
      ? undefined
      : Number(value.replace(",", "."));
    if (field !== "householdMeasure" && (!Number.isFinite(parsed) || Number(parsed) <= 0)) return;
    const nextMeals = meals.map((meal) => meal.id !== mealId ? meal : ({
      ...meal,
      items: meal.items.map((item) => item.id !== foodId || !isMealPlanFoodItem(item) ? item : ({
        ...item,
        substitutions: item.substitutions.map((substitution) => substitution.id !== substitutionId ? substitution : ({
          ...substitution,
          ...(field === "quantity" ? { replacementQuantity: Number(parsed) } : {}),
          ...(field === "householdMeasure" ? { replacementHouseholdMeasure: value } : {}),
          ...(field === "prescribedAmount" ? { replacementPrescribedAmount: Number(parsed) } : {}),
          needsProfessionalReview: false,
        })),
      })),
    }));
    setMeals(nextMeals);
    markMealEdited(mealId);
    scheduleAutoSave(nextMeals);
  }

  function confirmRecalculatedAlternatives(mealId: string, foodId: string) {
    const nextMeals = meals.map((meal) => meal.id !== mealId ? meal : ({
      ...meal,
      items: meal.items.map((item) => item.id !== foodId || !isMealPlanFoodItem(item) ? item : ({
        ...item,
        substitutions: item.substitutions.map((substitution) => ({ ...substitution, needsProfessionalReview: false })),
      })),
    }));
    setMeals(nextMeals);
    markMealEdited(mealId);
    scheduleAutoSave(nextMeals);
    setMessage("Alternativas recalculadas conferidas pelo profissional.");
  }

  function duplicateFood(mealId: string, foodId: string) {
    const nextMeals = meals.map((meal) => {
        if (meal.id !== mealId) return meal;
        const index = meal.items.findIndex((food) => food.id === foodId);
        if (index < 0) return meal;
        const source = meal.items[index];
        if (!source || !isMealPlanFoodItem(source)) return meal;
        const items = [...meal.items];
        items.splice(index + 1, 0, {
          ...source,
          id: crypto.randomUUID(),
          substitutions: [],
        });
        return { ...meal, items };
      });
    setMeals(nextMeals);
    markMealEdited(mealId);
    scheduleAutoSave(nextMeals);
  }

  function updateFoodPortion(
    mealId: string,
    food: MealPlanRecordFood,
    edit: Parameters<typeof updateMealPlanFoodPortion>[1],
  ) {
    const result = updateMealPlanFoodPortion(food, edit);
    const currentInput = portionInputs[food.id] ?? {
      quantityInput: quantityInput(food),
      gramsInput: prescribedAmountInput(food),
    };
    setPortionInputs((current) => ({
      ...current,
      [food.id]: {
        quantityInput:
          edit.field === "quantity"
            ? edit.input
            : result.success
              ? result.quantityInput
              : currentInput.quantityInput,
        gramsInput:
          edit.field === "grams" || edit.field === "directAmount"
            ? edit.input
            : result.success
              ? result.gramsInput
              : currentInput.gramsInput,
        pendingDirectUnit:
          edit.field === "directAmount" && !result.success
            ? edit.unit
            : undefined,
        error: result.success ? undefined : result.message,
      },
    }));
    if (!result.success) return;
    const nextMeals = meals.map((meal) =>
      meal.id !== mealId
        ? meal
        : {
            ...meal,
              items: meal.items.map((item) =>
                item.id === food.id ? recalculateMealPlanSubstitutions(food, result.food) : item,
            ),
          },
    );
    setMeals(nextMeals);
    markMealEdited(mealId);
    scheduleAutoSave(nextMeals);
    return nextMeals;
  }

  function selectIbgeMeasure(
    mealId: string,
    foodId: string,
    selectionId: string,
  ) {
    const directUnit = directMealPlanMeasureUnit(selectionId);
    const currentFood = meals
      .find((meal) => meal.id === mealId)
      ?.items.find(
        (item): item is MealPlanRecordFood =>
          item.id === foodId && isMealPlanFoodItem(item),
      );
    if (!currentFood) return;
    if (
      directUnit &&
      directUnit !== (currentFood.prescribedUnit ?? "g")
    ) {
      setPortionInputs((current) => ({
        ...current,
        [foodId]: {
          quantityInput: "1",
          gramsInput: "",
          pendingDirectUnit: directUnit,
          error: `Informe a nova quantidade em ${directUnit}. O valor em ${currentFood.prescribedUnit ?? "g"} não foi convertido automaticamente.`,
        },
      }));
      window.setTimeout(
        () => document.getElementById(`food-grams-${foodId}`)?.focus(),
        0,
      );
      return;
    }
    const selectedIbgeMeasureId = directUnit ? undefined : selectionId;
    let selectedFood: MealPlanRecordFood | undefined;
    const nextMeals = meals.map((meal) =>
      meal.id !== mealId
        ? meal
        : {
            ...meal,
            items: meal.items.map((item) => {
              if (item.id !== foodId || !isMealPlanFoodItem(item)) return item;
              selectedFood =
                selectIbgeMeasureForDisplay(item, selectedIbgeMeasureId) ?? item;
              return selectedFood;
            }),
          },
    );
    setMeals(nextMeals);
    markMealEdited(mealId);
    if (selectedFood) {
      setPortionInputs((current) => ({
        ...current,
        [foodId]: {
          quantityInput: quantityInput(selectedFood!),
          gramsInput: prescribedAmountInput(selectedFood!),
        },
      }));
    }
    scheduleAutoSave(nextMeals);
  }

  function finishFoodPortionInput(food: MealPlanRecordFood) {
    const current = portionInputs[food.id];
    if (!current?.error) return;
    setPortionInputs((inputs) => ({
      ...inputs,
      [food.id]: {
        quantityInput: quantityInput(food),
        gramsInput: prescribedAmountInput(food),
      },
    }));
    setMessage(current.error);
  }

  function removeFood(mealId: string, foodId: string) {
    const nextMeals = meals.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              items: meal.items.filter((food) => food.id !== foodId),
            }
          : meal,
    );
    setMeals(nextMeals);
    markMealEdited(mealId);
    setPortionInputs((current) => {
      const remaining = { ...current };
      delete remaining[foodId];
      return remaining;
    });
    setRecipePortionInputs((current) => {
      const remaining = { ...current };
      delete remaining[foodId];
      return remaining;
    });
    scheduleAutoSave(nextMeals);
  }

  function confirmFilledPlanReplacement(nextMode: MealPlanAssemblyMode) {
    if (!hasFoods) return true;
    const replacement =
      nextMode === "INTELLIGENT"
        ? "gerar um novo Plano Inteligente"
        : "recomeçar pela montagem manual";
    return window.confirm(
      `O plano já contém alimentos. Ao ${replacement}, a montagem atual será substituída e alterações não salvas poderão ser perdidas. Deseja continuar?`,
    );
  }

  function scheduleAutoSave(nextMeals: readonly MealPlanRecordMeal[]) {
    if (plan.status === "DRAFT" && nextMeals !== meals) {
      setAutoSaveState("PENDING");
    }
  }

  function discardPendingAutoSave() {
    if (autoSaveTimer.current !== undefined) {
      window.clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = undefined;
    }
    queuedAutoSave.current = undefined;
  }

  function activateManualAssembly() {
    setAssemblyMode("MANUAL");
    setAiDecision("IDLE");
    setSmartGenerationVersion(undefined);
    setSmartPreview(undefined);
    setMealReviewStatus({});
    setGenerationPending([]);
    setGenerationOptional([]);
    previewBaselineMeals.current = null;
    if (!hasFoods && activeMeal) addFoodLine(activeMeal.id);
    setMessage(
      hasFoods
        ? "Montagem manual ativa. O plano atual permanece totalmente editável."
        : "Montagem manual ativa. Pesquise e adicione o primeiro alimento.",
    );
  }

  function restartManualAssembly() {
    if (!confirmFilledPlanReplacement("MANUAL")) return;
    discardPendingAutoSave();
    const emptyMeals = meals.map((meal) => ({ ...meal, items: [] }));
    setMeals(emptyMeals);
    setLegacyPreviewDismissed(true);
    setAssemblyMode("MANUAL");
    setAiDecision("IDLE");
    setSmartGenerationVersion(undefined);
    setSmartPreview(undefined);
    setMealReviewStatus({});
    setGenerationPending([]);
    setGenerationOptional([]);
    previewBaselineMeals.current = null;
    setActiveMealId(emptyMeals[0]?.id);
    setActivePicker(undefined);
    setQuery("");
    setEquivalenceFoodId(undefined);
    setEquivalents([]);
    setPortionInputs({});
    setMessage(
      "Nova montagem manual iniciada. A versão anterior não foi preservada.",
    );
  }

  function requestAssistedAssembly() {
    if (generationInFlight.current || generatingPreview) return;
    if (hasFoods) {
      setShowIntelligentReplacementConfirmation(true);
      return;
    }
    void prepareAssistedAssembly();
  }

  async function prepareAssistedAssembly(
    action:
      | "GENERATE_ASSISTED_PREVIEW"
      | "GENERATE_INITIAL_WITHOUT_RECALL" = "GENERATE_ASSISTED_PREVIEW",
  ) {
    if (!plan.attendanceId || generationInFlight.current) return;
    const currentComposition = currentFoodComposition(meals);
    const baseline =
      assemblyMode === "INTELLIGENT" && previewBaselineMeals.current
        ? cloneMealRecords(previewBaselineMeals.current)
        : cloneMealRecords(meals);
    generationInFlight.current = true;
    setShowIntelligentReplacementConfirmation(false);
    setGeneratingPreview(true);
    setGenerationPending([]);
    setGenerationOptional([]);
    setMessage(
      "Gerando Plano Inteligente...",
    );
    try {
      const response = await fetch(
        `/api/patients/${plan.patientId}/attendances/${plan.attendanceId}/meal-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...developmentUserRequestHeaders(),
          },
          body: JSON.stringify({
            action,
            ...(currentComposition ? { currentComposition } : {}),
          }),
        },
      ).catch(() => null);
      const result = response
        ? ((await response.json().catch(() => null)) as
            | {
                meals?: readonly MealPlanRecordMeal[];
                smartPlanDraft?: SmartPlanPreviewState;
                pending?: readonly SmartPlanGenerationPendingField[];
                optionalMissing?: readonly SmartPlanGenerationPendingField[];
                code?: string;
                message?: string;
                notice?: string;
              }
            | null)
        : null;
      if (!response?.ok || !result?.meals?.length || !result.smartPlanDraft) {
        setGenerationPending(result?.pending ?? []);
        setGenerationOptional(result?.optionalMissing ?? []);
        if (
          response?.status === 409 &&
          result?.code === "NO_ADEQUATE_ALTERNATIVE"
        ) {
          setMessage(
            result.message ??
              "Não foi encontrada outra combinação de alimentos adequada aos critérios atuais.",
          );
          return;
        }
        setMessage(
          result?.message ??
            "Não foi possível conectar ao serviço de geração da prévia.",
        );
        return;
      }
      const previewMeals = cloneMealRecords(result.meals);
      discardPendingAutoSave();
      previewBaselineMeals.current = baseline;
      setMeals(previewMeals);
      setGenerationOptional(
        result.optionalMissing ??
          result.smartPlanDraft.optionalDataNotProvided,
      );
      setLegacyPreviewDismissed(false);
      setSmartPreview(result.smartPlanDraft);
      setSmartGenerationVersion(result.smartPlanDraft.semanticVersion);
      setMealReviewStatus(Object.fromEntries(
        previewMeals.map((meal) => [meal.id, "PENDING_REVIEW" as const]),
      ));
      setAssemblyMode("INTELLIGENT");
      setActiveMealId(previewMeals[0]?.id);
      setAiDecision("SUGGESTION_GENERATED");
      setActivePicker(undefined);
      setQuery("");
      setEquivalenceFoodId(undefined);
      setEquivalents([]);
      setMessage(
        result.notice ??
          "Prévia gerada pelo Plano Inteligente — aguardando validação do nutricionista.",
      );
      const previewDraft: MealPlanDraftSnapshot = {
        ...currentDraft.current,
        meals: previewMeals,
        aiDecision: "SUGGESTION_GENERATED",
        smartGenerationVersion: result.smartPlanDraft.semanticVersion,
      };
      const previewFingerprint = mealPlanDraftFingerprint(previewDraft);
      currentDraft.current = previewDraft;
      currentDraftFingerprint.current = previewFingerprint;
      await flushAutoSave(previewDraft, previewFingerprint);
    } finally {
      setGeneratingPreview(false);
      generationInFlight.current = false;
    }
  }

  async function regenerateAssistedMeal(mealId: string) {
    if (!plan.attendanceId || regeneratingMealId) return;
    const mealIndex = meals.findIndex((meal) => meal.id === mealId);
    const currentMeal = meals[mealIndex];
    if (mealIndex < 0 || !currentMeal) return;
    const currentTotals = calculateMealPlanNutritionTotals([currentMeal]).values;
    setRegeneratingMealId(mealId);
    setMessage(`Regenerando somente ${currentMeal.name}...`);
    try {
      const response = await fetch(
        `/api/patients/${plan.patientId}/attendances/${plan.attendanceId}/meal-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...developmentUserRequestHeaders(),
          },
          body: JSON.stringify({
            action: "REGENERATE_ASSISTED_MEAL",
            mealIndex,
            targetTotals: {
              energyKcal: currentTotals.energyKcal,
              proteinGrams: currentTotals.proteinGrams,
              carbohydratesGrams: currentTotals.carbohydratesGrams,
              fatsGrams: currentTotals.fatsGrams,
            },
            previouslyUsedFoodIds: currentMeal.items
              .filter(isMealPlanFoodItem)
              .map((food) => food.catalogFoodId),
          }),
        },
      ).catch(() => null);
      const result = response
        ? ((await response.json().catch(() => null)) as
            | {
                meal?: MealPlanRecordMeal;
                smartPlanMeal?: SmartPlanDraft["meals"][number];
                message?: string;
                notice?: string;
              }
            | null)
        : null;
      if (!response?.ok || !result?.meal || !result.smartPlanMeal) {
        setMessage(result?.message ?? "N\u00e3o foi poss\u00edvel regenerar esta refei\u00e7\u00e3o.");
        return;
      }
      const regeneratedMeal: MealPlanRecordMeal = {
        ...result.meal,
        id: currentMeal.id,
        name: currentMeal.name,
        time: currentMeal.time,
        order: currentMeal.order,
      };
      setMeals((current) => current.map((meal) =>
        meal.id === mealId ? regeneratedMeal : meal,
      ));
      setSmartPreview((current) => current ? {
        ...current,
        meals: current.meals.map((meal, index) =>
          index === mealIndex ? result.smartPlanMeal! : meal,
        ),
      } : current);
      setMealReviewStatus((current) => ({
        ...current,
        [mealId]: "PENDING_REVIEW",
      }));
      setAiDecision("SUGGESTION_GENERATED");
      setPortionInputs({});
      setMessage(result.notice ?? "Refei\u00e7\u00e3o regenerada. Revise antes de aprovar.");
    } finally {
      setRegeneratingMealId(undefined);
    }
  }

  function rejectSmartPreview() {
    discardPendingAutoSave();
    const baseline = previewBaselineMeals.current;
    const restored = baseline ? cloneMealRecords(baseline) : [];
    setMeals(restored);
    setLegacyPreviewDismissed(true);
    setActiveMealId(restored[0]?.id);
    setAssemblyMode("MANUAL");
    setAiDecision("IDLE");
    setSmartGenerationVersion(undefined);
    setSmartPreview(undefined);
    setMealReviewStatus({});
    setGenerationPending([]);
    setGenerationOptional([]);
    previewBaselineMeals.current = null;
    setMessage(
      restored.some((meal) => meal.items.length)
        ? "Prévia rejeitada. O conteúdo anterior foi restaurado."
        : "Prévia rejeitada. Escolha entre Plano Inteligente e Plano Manual.",
    );
  }

  function openAdjustmentDialog() {
    setAdjustmentReason("");
    setAdjustmentError("");
    setAdjustmentOpen(true);
  }

  function closeAdjustmentDialog() {
    if (adjusting) return;
    setAdjustmentOpen(false);
    setAdjustmentReason("");
    setAdjustmentError("");
  }

  async function adjustPlan() {
    if (adjusting || !finalized || !plan.attendanceId) return;

    const reason = adjustmentReason.trim();
    if (!reason) {
      setAdjustmentError("Informe o motivo do ajuste.");
      document.getElementById("adjust-meal-plan-reason")?.focus();
      return;
    }

    setAdjusting(true);
    setAdjustmentError("");
    const response = await fetch(
      `/api/patients/${plan.patientId}/attendances/${plan.attendanceId}/meal-plan`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...developmentUserRequestHeaders(),
        },
        body: JSON.stringify({
          action: "ADJUST_PLAN",
          reason,
          expectedRevision: plan.revision,
        }),
      },
    ).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as
          | {
              record?: {
                revision: number;
                status: "DRAFT";
                updatedAt: string;
                responsibleProfessional: string;
                history: MealPlanPrescriptionView["prescriptionHistory"];
              };
            }
          | null)
      : null;

    if (!response?.ok || !result?.record) {
      setAdjustmentError(
        response?.status === 409
          ? "Este plano foi alterado em outra sessão. Atualize a página antes de continuar."
          : response?.status === 400
            ? "Informe o motivo do ajuste."
            : "Não foi possível abrir o plano para ajustes.",
      );
      setAdjusting(false);
      return;
    }

    setPlan((current) => ({
      ...current,
      revision: result.record!.revision,
      status: "DRAFT",
      updatedAt: result.record!.updatedAt,
      responsibleProfessional: result.record!.responsibleProfessional,
      prescriptionHistory: result.record!.history,
    }));
    lastConfirmedFingerprint.current = currentDraftFingerprint.current;
    setAutoSaveState("IDLE");
    setAdjustmentOpen(false);
    setAdjustmentReason("");
    setMessage(
      "Plano aberto para ajustes. A última entrega oficial foi preservada.",
    );
    setAdjusting(false);
    router.refresh();
  }

  async function savePlan(
    complete = false,
    draftToSave: MealPlanDraftSnapshot = currentDraft.current,
    automatic = false,
  ) {
    if (complete && completionBlockedReason) {
      setMessage(completionBlockedReason);
      return false;
    }
    if (finalized) {
      setMessage("O Plano Alimentar finalizado está protegido contra alterações.");
      return false;
    }
    if (
      !plan.attendanceId ||
      draftToSave.meals.length === 0
    ) {
      setMessage("Adicione ao menos uma refeição antes de salvar.");
      return false;
    }
    const effectiveReuseMode = plan.sourcePlanEntryId
      ? mealPlanDraftFingerprint(draftToSave) === initialFingerprint.current
        ? (reuseMode ?? "KEEP_PREVIOUS")
        : "ADJUSTED_COPY"
      : undefined;
    if (!automatic) {
      manualSaveInFlight.current = true;
      setSaving(true);
      setMessage("Salvando prescrição no Prontuário Mestre.");
    }
    const response = await fetch(
      `/api/patients/${plan.patientId}/attendances/${plan.attendanceId}/meal-plan`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...developmentUserRequestHeaders(),
        },
        body: JSON.stringify({
          strategyEntryId: plan.strategyEntryId,
          status: complete
            ? "APPROVED"
            : plan.status === "PENDING_REVIEW"
              ? "IN_REVIEW"
              : "DRAFT",
          aiDecision: draftToSave.aiDecision,
          smartGenerationVersion: draftToSave.smartGenerationVersion,
          clinicalJustification:
            draftToSave.clinicalJustification || undefined,
          dietaryReferenceProfile: draftToSave.dietaryReferenceProfile,
          dietaryReferences: draftToSave.dietaryReferences,
          professionalReview: complete ? proposedProfessionalReview : undefined,
          targetDeviationAuthorization:
            draftToSave.targetDeviationAuthorization,
          meals: draftToSave.meals.map((meal) => ({
            ...meal,
            items: meal.items.filter((item) =>
              isMealPlanRecipeItem(item)
                ? true
                : Boolean(item.catalogFoodId && item.description.trim()),
            ),
          })),
          supplements: draftToSave.supplements,
          sourcePlanEntryId: plan.sourcePlanEntryId,
          sourcePlanAttendanceId: plan.sourcePlanAttendanceId,
          sourcePlanRevision: plan.sourcePlanRevision,
          reuseMode: effectiveReuseMode,
        }),
      },
    ).catch(() => null);
    if (!response) {
      setMessage(
        "Não foi possível conectar ao serviço. A prévia foi mantida; tente salvar novamente.",
      );
      if (!automatic) {
        manualSaveInFlight.current = false;
        setSaving(false);
      }
      return false;
    }
    const result = (await response.json().catch(() => null)) as
      | {
          record?: {
            revision: number;
            updatedAt: string;
            responsibleProfessional: string;
            history: MealPlanPrescriptionView["prescriptionHistory"];
            status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";
            meals?: readonly MealPlanRecordMeal[];
            targetDeviationAuthorization?: MealPlanTargetDeviationAuthorization;
          };
          message?: string;
        }
      | null;
    if (!response.ok || !result?.record) {
      setMessage(result?.message ?? "Não foi possível salvar o Plano Alimentar.");
      if (!automatic) {
        manualSaveInFlight.current = false;
        setSaving(false);
      }
      return false;
    }
    setPlan((current) => ({
      ...current,
      revision: result.record!.revision,
      strategyUpdateAvailable: false,
      updatedAt: result.record!.updatedAt,
      responsibleProfessional: result.record!.responsibleProfessional,
      prescriptionHistory: result.record!.history,
      status:
        result.record!.status === "IN_REVIEW"
          ? "PENDING_REVIEW"
          : result.record!.status,
      targetDeviationAuthorization:
        result.record!.targetDeviationAuthorization,
      reuseMode: effectiveReuseMode,
    }));
    setTargetDeviationAuthorization(
      result.record.targetDeviationAuthorization,
    );
    setReuseMode(effectiveReuseMode);
    if (
      result.record.meals &&
      (!automatic ||
        currentDraftFingerprint.current ===
          mealPlanDraftFingerprint(draftToSave))
    ) {
      setMeals(cloneMealRecords(result.record.meals));
    }
    const confirmedDraft = automatic
      ? {
          ...draftToSave,
          targetDeviationAuthorization:
            result.record.targetDeviationAuthorization,
        }
      : {
          ...draftToSave,
          clinicalJustification: "",
          targetDeviationAuthorization:
            result.record.targetDeviationAuthorization,
        };
    const confirmedFingerprint = mealPlanDraftFingerprint(confirmedDraft);
    lastConfirmedFingerprint.current = confirmedFingerprint;
    if (
      complete ||
      currentDraftFingerprint.current ===
        mealPlanDraftFingerprint(draftToSave)
    ) {
      removeLocalDraft(localDraftStorageKey);
    }
    if (!automatic) setClinicalJustification("");
    setMessage(
      complete
        ? "Plano Alimentar concluído. Entregáveis liberados."
        : automatic
          ? "Alterações salvas automaticamente."
          : "Plano Alimentar salvo no Prontuário Mestre.",
    );
    if (!automatic) {
      manualSaveInFlight.current = false;
      setSaving(false);
      setAutoSaveState("IDLE");
    }
    if (complete || !automatic) {
      router.refresh();
    }
    return true;
  }

  async function flushAutoSave(
    draftToSave: MealPlanDraftSnapshot,
    fingerprint: string,
  ) {
    if (
      plan.status !== "DRAFT" ||
      fingerprint === lastConfirmedFingerprint.current
    ) {
      setAutoSaveState("IDLE");
      return true;
    }
    if (autoSaveInFlight.current || manualSaveInFlight.current) {
      queuedAutoSave.current = { draft: draftToSave, fingerprint };
      return false;
    }
    autoSaveInFlight.current = true;
    setAutoSaveState("SAVING");
    const saved = await savePlan(false, draftToSave, true);
    autoSaveInFlight.current = false;
    if (saved) {
      if (currentDraftFingerprint.current === fingerprint) {
        removeLocalDraft(localDraftStorageKey);
        setAutoSaveState("SAVED");
      } else {
        setAutoSaveState("PENDING");
      }
    } else {
      setAutoSaveState("ERROR");
    }
    const queued = queuedAutoSave.current;
    queuedAutoSave.current = undefined;
    if (
      queued &&
      queued.fingerprint !== lastConfirmedFingerprint.current
    ) {
      await flushAutoSave(queued.draft, queued.fingerprint);
    }
    return saved;
  }

  autoSaveRunner.current = flushAutoSave;

  function authorizeCurrentTargetDeviations() {
    if (!targetDeviations || targetDeviationsOutsideTolerance.length === 0) {
      setMessage("Não há desvios fora da tolerância que exijam decisão profissional.");
      return;
    }
    const authorization: MealPlanTargetDeviationAuthorization = {
      authorizedByUserId: plan.responsibleUserId,
      authorizedByName: plan.responsibleProfessional,
      authorizedAt: new Date().toISOString(),
      planRevision: plan.revision,
      tolerancePercent: FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT,
      deviationFingerprint:
        mealPlanTargetDeviationFingerprint(targetDeviations),
      deviations: targetDeviations,
      statement: targetDeviationStatement.trim() || undefined,
    };
    setTargetDeviationAuthorization(authorization);
    setReviewAcknowledged(false);
    setReviewedDraftFingerprint(undefined);
    setMessage(
      "Decisão registrada no rascunho. Revise o plano e suas limitações antes de concluir.",
    );
  }

  async function persistSmartPreviewApproval() {
    if (!smartPreviewPersisted) {
      setMessage(
        "A prévia precisa estar salva antes da aprovação profissional.",
      );
      return false;
    }

    const approvedDraft: MealPlanDraftSnapshot = {
      ...currentDraft.current,
      aiDecision: "APPROVED",
    };
    setMessage("Salvando a aprovação da prévia no Prontuário Mestre.");
    const saved = await savePlan(false, approvedDraft);
    if (!saved) {
      setMessage(
        "Não foi possível salvar a aprovação. A prévia continua pendente; tente novamente.",
      );
      return false;
    }

    const confirmedApprovedDraft = {
      ...approvedDraft,
      clinicalJustification: "",
    };
    currentDraft.current = confirmedApprovedDraft;
    currentDraftFingerprint.current = mealPlanDraftFingerprint(
      confirmedApprovedDraft,
    );
    return true;
  }

  async function retrySmartPreviewSave() {
    if (
      autoSaveInFlight.current ||
      manualSaveInFlight.current ||
      autoSaveState === "SAVING"
    ) {
      return;
    }
    if (autoSaveTimer.current !== undefined) {
      window.clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = undefined;
    }
    setMessage("Tentando salvar novamente a prévia do Plano Inteligente.");
    await flushAutoSave(
      currentDraft.current,
      currentDraftFingerprint.current,
    );
  }

  function recoverLocalDraft() {
    if (!recoverableDraft || finalized) return;
    const recovered = recoverableDraft.draft;
    setMeals(cloneMealRecords(recovered.meals));
    setSupplements(recovered.supplements.map((supplement) => ({ ...supplement })));
    setAiDecision(recovered.aiDecision);
    setSmartGenerationVersion(recovered.smartGenerationVersion);
    setMealReviewStatus(
      recovered.aiDecision === "APPROVED"
        ? Object.fromEntries(
            recovered.meals.map((meal) => [meal.id, "APPROVED" as const]),
          )
        : {},
    );
    setClinicalJustification(recovered.clinicalJustification);
    setDietaryReferenceProfile(recovered.dietaryReferenceProfile);
    setDietaryReferences(recovered.dietaryReferences);
    setTargetDeviationAuthorization(recovered.targetDeviationAuthorization);
    setTargetDeviationStatement(
      recovered.targetDeviationAuthorization?.statement ?? "",
    );
    setReviewAcknowledged(false);
    setReviewStatement("");
    setReviewedDraftFingerprint(undefined);
    setAssemblyMode(
      recovered.aiDecision === "SUGGESTION_GENERATED" ||
        recovered.aiDecision === "APPROVED"
        ? "INTELLIGENT"
        : "MANUAL",
    );
    setActiveMealId(recovered.meals[0]?.id);
    recoveryDecisionPending.current = false;
    setRecoverableDraft(undefined);
    setAutoSaveState("PENDING");
  }

  function discardLocalDraft() {
    removeLocalDraft(localDraftStorageKey);
    recoveryDecisionPending.current = false;
    setRecoverableDraft(undefined);
    setAutoSaveState("IDLE");
  }

  return (
    <form
      className="space-y-4 pb-24"
      id="clinical-form-meal-plan"
      onSubmit={(event) => {
        event.preventDefault();
        if (autoSaveTimer.current !== undefined) {
          window.clearTimeout(autoSaveTimer.current);
          autoSaveTimer.current = undefined;
        }
        const submitter = (event.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement | null;
        void savePlan(
          submitter?.name === "mealPlanAction" &&
            submitter.value === "complete",
        );
      }}
    >
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--primary)]">
            Plano Alimentar
          </p>
          <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">
            {strategy
              ? `${planObjective!.label} · ${n(strategy.caloriesKcal, 0)} kcal · ${strategy.mealCount} refeições`
              : "Plano Alimentar manual"}
          </h2>
          <p aria-live="polite" className="mt-1 text-sm text-[var(--muted)]">
            {message}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={finalized ? "success" : "warning"}>
            {finalized ? "Plano concluído" : "Rascunho"}
          </Badge>
          <Badge tone="warning">Decisão do nutricionista</Badge>
          {finalized ? (
            <Button
              disabled={adjusting}
              id="adjust-meal-plan-trigger"
              onClick={openAdjustmentDialog}
              type="button"
            >
              Ajustar plano
            </Button>
          ) : null}
          <Button
            onClick={() => setActiveTab(activeTab === "PLAN" ? "HISTORY" : "PLAN")}
            type="button"
            variant="secondary"
          >
            {activeTab === "PLAN" ? "Histórico" : "Voltar ao plano"}
          </Button>
        </div>
      </div>

      {plan.sourcePlanEntryId ? (
        <Card className="border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-900">
            Plano anterior como base
          </p>
          <p className="mt-1 text-sm text-sky-950">
            Esta é uma cópia vinculada ao atendimento atual. O plano anterior e sua entrega oficial não serão sobrescritos.
          </p>
          <div
            aria-label="Conduta para o plano anterior"
            className="mt-3 flex flex-wrap gap-2"
            role="group"
          >
            <Button
              onClick={() => {
                setReuseMode("KEEP_PREVIOUS");
                setMessage("Plano anterior mantido como prescrição deste retorno.");
              }}
              type="button"
              variant={reuseMode === "KEEP_PREVIOUS" ? "primary" : "secondary"}
            >
              Manter plano anterior
            </Button>
            <Button
              onClick={() => {
                setReuseMode("ADJUSTED_COPY");
                setMessage("Nova versão iniciada a partir do plano anterior. Altere somente o necessário.");
              }}
              type="button"
              variant={reuseMode === "ADJUSTED_COPY" ? "primary" : "secondary"}
            >
              Criar nova versão a partir do anterior
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-900">
            Construção inicial
          </p>
          <p className="mt-1 text-sm text-amber-950">
            Nenhum Plano Alimentar anterior válido foi localizado neste Prontuário Mestre. Será criada uma proposta inicial usando os dados disponíveis.
          </p>
        </Card>
      )}

      {activeTab === "PLAN" && !finalized ? (
        <Card className="border-emerald-200 bg-emerald-50 p-4" id="meal-plan-professional-review">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-900">Revisão profissional para conclusão</p>
              <h2 className="mt-1 text-lg font-black text-emerald-950">Confirmar conteúdo e limitações conhecidas</h2>
              <p className="mt-1 text-sm text-emerald-950">A conclusão não transforma composição parcial em completa. Energia, macronutrientes, quantidades, conversões e snapshots permanecem obrigatórios.</p>
              {strategy && targetDeviations ? (
                <section className={`mt-3 rounded-xl border p-3 ${nutritionTargetsInvalid ? "border-amber-300 bg-amber-50 text-amber-950" : "border-emerald-300 bg-white text-emerald-950"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black">Estratégia × valores planejados</h3>
                      <p className="mt-1 text-xs">{nutritionTargetsInvalid ? `Há ${targetDeviationsOutsideTolerance.length} indicador(es) fora de ±${FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT}%. Isso exige uma decisão explícita, não uma alteração automática.` : `Os quatro indicadores estão dentro de ±${FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT}%.`}</p>
                    </div>
                    {targetDeviationAuthorizationValid ? <Badge tone="success">Continuidade autorizada</Badge> : nutritionTargetsInvalid ? <Badge tone="warning">Decisão pendente</Badge> : null}
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[620px] table-fixed text-left text-xs">
                      <thead><tr className="border-b border-current/20"><th className="w-[24%] py-2 pr-2">Indicador</th><th className="w-[19%] py-2 pr-2">Meta</th><th className="w-[19%] py-2 pr-2">Planejado</th><th className="w-[19%] py-2 pr-2">Diferença</th><th className="w-[19%] py-2">Situação</th></tr></thead>
                      <tbody>{targetDeviations.map((deviation) => {
                        const config = adequacyMetricConfig[deviation.metric];
                        const signedPercent = `${deviation.percentageDifference >= 0 ? "+" : ""}${n(deviation.percentageDifference, 2)}%`;
                        return <tr className="border-b border-current/10 last:border-0" key={deviation.metric}><th className="py-2 pr-2 font-black">{config.label}</th><td className="py-2 pr-2 tabular-nums">{n(deviation.target, 2)} {config.unit}</td><td className="py-2 pr-2 tabular-nums">{n(deviation.planned, 2)} {config.unit}</td><td className="py-2 pr-2 tabular-nums">{n(deviation.absoluteDifference, 2)} {config.unit} · {signedPercent}</td><td className={`py-2 font-bold ${deviation.outsideTolerance ? "text-amber-900" : "text-emerald-800"}`}>{deviation.outsideTolerance ? "Fora da tolerância" : "Dentro da tolerância"}</td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[11px]">{FINAL_NUTRITION_TARGET_TOLERANCE_ORIGIN}: ±{FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT}%. A decisão não modifica a estratégia nem os valores prescritos.</p>
                  {nutritionTargetsInvalid ? <div className="mt-3 space-y-3 border-t border-amber-200 pt-3"><label className="block text-xs font-bold">Observação da decisão <span className="font-normal">(opcional)</span><textarea className="mt-1 min-h-16 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 font-normal" maxLength={2_000} onChange={(event) => setTargetDeviationStatement(event.target.value)} placeholder="Ex.: manutenção temporária para adequação gradual da alimentação." value={targetDeviationStatement} /></label><div className="flex flex-wrap gap-2"><Button onClick={() => { setWorkspaceTab("ELABORATION"); setMessage("Ajuste as quantidades desejadas e confira novamente os desvios."); document.getElementById("meal-plan-tab-elaboration")?.focus(); }} size="small" type="button" variant="secondary">Voltar e ajustar o plano</Button><Button onClick={authorizeCurrentTargetDeviations} size="small" type="button">Manter os valores e continuar</Button></div>{targetDeviationAuthorization && !targetDeviationAuthorizationValid ? <p className="text-xs font-bold text-amber-900">Os desvios mudaram após a autorização anterior. Confira os valores e registre novamente a decisão.</p> : null}</div> : null}
                </section>
              ) : null}
              {completionEligibility.limitations.length ? <details className="mt-3"><summary className="cursor-pointer text-sm font-black text-emerald-950">{completionEligibility.limitations.length} limitações composicionais a reconhecer</summary><ul className="mt-2 max-h-36 list-disc overflow-y-auto pl-5 text-xs text-emerald-950">{completionEligibility.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></details> : <p className="mt-2 text-xs text-emerald-900">Nenhuma limitação composicional adicional foi detectada.</p>}
            </div>
            <div className="space-y-3"><label className="block text-sm font-black text-emerald-950">Registro da revisão<textarea className="mt-1 min-h-20 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 font-normal" maxLength={2_000} onChange={(event) => setReviewStatement(event.target.value)} placeholder="Ex.: Plano e limitações composicionais revisados." value={reviewStatement} /></label><label className="flex items-start gap-2 text-sm font-bold text-emerald-950"><input checked={reviewAcknowledged && reviewedDraftFingerprint === draftFingerprint} className="mt-1 size-4" onChange={(event) => { setReviewAcknowledged(event.target.checked); setReviewedDraftFingerprint(event.target.checked ? draftFingerprint : undefined); }} type="checkbox" />Revisei o plano atual e reconheço as limitações listadas.</label>{reviewAcknowledged && reviewedDraftFingerprint !== draftFingerprint ? <p className="text-xs font-bold text-amber-800">O plano mudou após a revisão. Confira novamente e renove a confirmação.</p> : null}</div>
          </div>
        </Card>
      ) : null}

      {activeTab === "PLAN" ? (
        <>
          <nav aria-label="Etapas do Plano Alimentar" className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--line)] bg-white p-2 sm:grid-cols-3" role="tablist">
            {([
              ["ELABORATION", "Elaboração", "Refeições, itens, medidas e substituições"],
              ["ADEQUACY", "Adequação", "DRI, cobertura e limites"],
              ["ANALYSIS", "Análise", "Distribuição e contribuintes"],
            ] as const).map(([key, label, description]) => <button aria-controls={`meal-plan-panel-${key.toLowerCase()}`} aria-selected={workspaceTab === key} className={`rounded-xl px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${workspaceTab === key ? "bg-emerald-950 text-white" : "bg-[var(--surface)] text-[var(--text-primary)] hover:bg-emerald-50"}`} id={`meal-plan-tab-${key.toLowerCase()}`} key={key} onClick={() => setWorkspaceTab(key)} role="tab" type="button"><span className="block font-black">{label}</span><span className={`mt-0.5 block text-xs ${workspaceTab === key ? "text-emerald-100" : "text-[var(--muted)]"}`}>{description}</span></button>)}
          </nav>
          {workspaceTab === "ELABORATION" ? (
        <fieldset aria-labelledby="meal-plan-tab-elaboration" className="min-w-0 space-y-4" disabled={finalized || saving} id="meal-plan-panel-elaboration" role="tabpanel">
          {strategy ? <Card className="space-y-3 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">
                  Estratégia vinculada
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Referência clínica bloqueada para edição.
                </p>
              </div>
              <Button
                onClick={() => setShowStrategyDetails((current) => !current)}
                size="small"
                type="button"
                variant="secondary"
              >
                {showStrategyDetails ? "Ocultar detalhes" : "Ver detalhes"}
              </Button>
            </div>
            <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Objetivo", planObjective!.label],
                ["VET", `${n(strategy.caloriesKcal, 0)} kcal`],
                ["Proteínas", `${n(strategy.proteinGrams)} g · ${n(strategy.proteinPercentage)}%`],
                ["Carboidratos", `${n(strategy.carbohydratesGrams)} g · ${n(strategy.carbohydratesPercentage)}%`],
                ["Lipídios", `${n(strategy.fatsGrams)} g · ${n(strategy.fatsPercentage)}%`],
              ].map(([label, value]) => (
                <div className="rounded-xl bg-[var(--surface)] px-3 py-2" key={label}>
                  <dt className="text-[11px] font-black uppercase text-[var(--muted)]">{label}</dt>
                  <dd className="mt-1 text-sm font-black">{value}</dd>
                </div>
              ))}
            </dl>
            {showStrategyDetails ? (
              <div className="grid gap-3 border-t border-[var(--line)] pt-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Método", strategy.method],
                  ["Protocolo", ENERGY_PROTOCOLS[strategy.protocol]],
                  ["GET", `${n(strategy.totalEnergyExpenditureKcal, 0)} kcal`],
                  ["Ajuste", `${strategy.calorieAdjustmentPercentage > 0 ? "+" : ""}${n(strategy.calorieAdjustmentPercentage)}%`],
                  ["Fibras", `${n(strategy.fiberGrams)} g`],
                  ["Água", `${n(strategy.waterMl, 0)} ml`],
                  ["Suplementação", strategy.supplementation.length ? strategy.supplementation.map((item) => `${item.name} — ${item.schedule}`).join(" · ") : "Nenhuma"],
                  ["Observações", strategy.clinicalObservations || "Sem observações"],
                ].map(([label, value]) => (
                  <div className="rounded-xl border border-[var(--line)] p-3" key={label}>
                    <p className="text-xs font-black uppercase text-[var(--muted)]">{label}</p>
                    <p className="mt-1 font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </Card> : (
            <Card className="border-amber-200 bg-amber-50 p-4">
              <p className="font-black text-amber-950">Estratégia nutricional não realizada neste atendimento</p>
              <p className="mt-1 text-sm text-amber-900">Elabore o plano manualmente. Nenhuma meta de GET, VET ou macronutrientes será presumida.</p>
            </Card>
          )}

          <Card className="space-y-4 p-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">
                Método de montagem
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {strategy
                  ? "Plano Inteligente e Plano Manual são alternativas equivalentes. Você pode trocar de método a qualquer momento."
                  : "Sem Estratégia aprovada, a elaboração permanece manual e usa a busca e os cálculos reais dos alimentos."}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div
                className={`rounded-xl border p-3 ${
                  assemblyMode === "INTELLIGENT"
                    ? "border-[var(--primary)] bg-emerald-50"
                    : "border-[var(--line)] bg-[var(--surface)]"
                }`}
              >
                <p className="font-black text-[var(--text-primary)]">Plano Inteligente</p>
                <p className="mt-1 min-h-10 text-sm text-[var(--muted)]">
                  {strategy
                    ? "Gera uma nova sugestão para revisão livre do nutricionista."
                    : "Indisponível porque esta opção depende de metas nutricionais aprovadas."}
                </p>
                <Button
                   className="mt-3 w-full"
                   disabled={generatingPreview || !strategy}
                   onClick={requestAssistedAssembly}
                  type="button"
                  variant="outline"
                >
                   {generatingPreview
                     ? "Gerando Plano Inteligente..."
                    : hasFoods
                      ? "Gerar novo Plano Inteligente"
                      : "Iniciar Plano Inteligente"}
                </Button>
              </div>
              <div
                className={`rounded-xl border p-3 ${
                  assemblyMode === "MANUAL"
                    ? "border-[var(--primary)] bg-emerald-50"
                    : "border-[var(--line)] bg-[var(--surface)]"
                }`}
              >
                <p className="font-black text-[var(--text-primary)]">Plano Manual</p>
                <p className="mt-1 min-h-10 text-sm text-[var(--muted)]">
                  Mantém o controle integral da prescrição e permite editar qualquer sugestão.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="flex-1"
                    disabled={generatingPreview}
                    onClick={activateManualAssembly}
                    type="button"
                    variant="outline"
                  >
                    {hasFoods ? "Continuar manualmente" : "Iniciar Plano Manual"}
                  </Button>
                  {hasFoods ? (
                    <Button
                      disabled={generatingPreview}
                      onClick={restartManualAssembly}
                      type="button"
                      variant="outline"
                    >
                      Recomeçar
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
           </Card>

          {generationPending.length ? (
            <Card className="space-y-3 border-red-200 bg-red-50 p-4">
              <p className="font-black text-red-900">
                Impedimentos clínicos
              </p>
              <p className="text-sm text-red-900">Resolva estes itens antes de gerar uma proposta segura.</p>
              <ul className="space-y-2 text-sm text-red-900">
                {generationPending.map((issue) => (
                  <li className="rounded-lg border border-red-200 bg-white p-3" key={`${issue.field}-${issue.expectedSource}`}>
                    <p className="font-black">{issue.message}</p>
                    <p className="mt-1">Campo: {issue.field}</p>
                    <p>Origem esperada: {issue.expectedSource}</p>
                    <p>Motivo: {issue.reason}</p>
                    {issue.field === "allergies" && plan.attendanceId ? (
                      <a
                        className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-red-300 bg-white px-4 font-black text-red-900 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                        href={nutritionClinicalFlowHref("ANAMNESIS", {
                          patientId: plan.patientId,
                          attendanceId: plan.attendanceId,
                        })}
                      >
                        Voltar à Anamnese
                      </a>
                    ) : null}
                    {issue.field === "mealSchedules" && scheduleCorrectionHref ? (
                      <a
                        className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-red-300 bg-white px-4 font-black text-red-900 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
                        href={scheduleCorrectionHref}
                      >
                        Corrigir horários na Estratégia
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {generationOptional.length ? (
            <Card className="space-y-3 border-sky-200 bg-sky-50 p-4">
              <p className="font-black text-sky-950">Dados opcionais não informados</p>
              <p className="text-sm text-sky-900">
                Estes dados refinam a personalização, mas não impedem uma proposta regional simples e acessível.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-sky-950">
                {generationOptional.map((issue) => (
                  <li key={`${issue.field}-${issue.expectedSource}`}>
                    <strong>{issue.message}</strong> {issue.reason}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {!generationPending.length ? (
                  <Button
                    disabled={generatingPreview}
                    onClick={() => void prepareAssistedAssembly("GENERATE_INITIAL_WITHOUT_RECALL")}
                    type="button"
                  >
                    Gerar proposta inicial sem recordatório
                  </Button>
                ) : null}
                {plan.attendanceId ? (
                  <a
                    className="inline-flex min-h-11 items-center rounded-xl border border-sky-300 bg-white px-4 font-black text-sky-950 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700"
                    href={nutritionClinicalFlowHref("ANAMNESIS", {
                      patientId: plan.patientId,
                      attendanceId: plan.attendanceId,
                    })}
                  >
                    Completar dados para maior personalização
                  </a>
                ) : null}
              </div>
            </Card>
          ) : null}

          {invalidIntelligentPreview ? (
            <Card className="space-y-2 border-amber-300 bg-amber-50 p-4">
              <p className="font-black text-amber-950">
                {structurallyRejectedPreview
                  ? "Prévia rejeitada por incoerência alimentar"
                  : "Prévia anterior retirada da área ativa."}
              </p>
              <p className="text-sm text-amber-900">
                {structurallyRejectedPreview
                  ? "A sugestão foi produzida pelo gerador numérico anterior e não pode ser revisada, aprovada ou concluída. O registro permanece no histórico, sem aparecer como plano ativo."
                  : "Os dados anteriores permanecem no histórico clínico, mas seus alimentos e totais não serão apresentados como plano vigente enquanto os horários da Estratégia estiverem pendentes."}
              </p>
              {scheduleCorrectionRequired && scheduleCorrectionHref ? (
                <a
                  className="inline-flex min-h-11 items-center rounded-xl border border-amber-400 bg-white px-4 font-black text-amber-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                  href={scheduleCorrectionHref}
                >
                  Corrigir horários na Estratégia
                </a>
              ) : null}
              {structurallyRejectedPreview ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={generatingPreview}
                    onClick={() => void prepareAssistedAssembly("GENERATE_INITIAL_WITHOUT_RECALL")}
                    type="button"
                  >
                    Gerar proposta inicial sem recordatório
                  </Button>
                  {plan.attendanceId ? (
                    <a
                      className="inline-flex min-h-11 items-center rounded-xl border border-amber-400 bg-white px-4 font-black text-amber-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                      href={nutritionClinicalFlowHref("ANAMNESIS", {
                        patientId: plan.patientId,
                        attendanceId: plan.attendanceId,
                      })}
                    >
                      Completar dados para maior personalização
                    </a>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : null}

          {hasFoods && assemblyMode === "INTELLIGENT" && !invalidIntelligentPreview ? (
            <Card className="space-y-3 p-4" variant="info">
              <div>
                <p className="font-black text-sky-950">
                  {aiDecision === "APPROVED"
                    ? "Prévia do Plano Inteligente revisada pelo nutricionista."
                    : "Prévia gerada pelo Plano Inteligente — aguardando validação do nutricionista."}
                </p>
                <p className="mt-1 text-sm text-sky-800">
                  {aiDecision === "APPROVED"
                    ? "Prévia aprovada e salva no Prontuário Mestre."
                    : smartPreview?.approvalLabel ??
                      "Prévia salva e aguardando validação do nutricionista."}
                </p>
                {smartPreview?.requiresProfessionalAdjustment ? (
                  <p className="mt-2 font-black text-amber-800">
                    Requer ajuste profissional.
                  </p>
                ) : null}
                {smartPreview?.warnings.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-sky-900">
                    {smartPreview.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={
                    generatingPreview ||
                    aiDecision === "APPROVED" ||
                    !smartPreviewPersisted
                  }
                  onClick={async () => {
                    const saved = await persistSmartPreviewApproval();
                    if (!saved) return;
                    setAiDecision("APPROVED");
                    setMealReviewStatus(Object.fromEntries(
                      meals.map((meal) => [meal.id, "APPROVED" as const]),
                    ));
                    setMessage("Prévia aprovada e salva no Prontuário Mestre.");
                  }}
                  type="button"
                >
                  {smartPreviewPersisted
                    ? "Aprovar prévia"
                    : "Aguardando salvamento"}
                </Button>
                {autoSaveState === "ERROR" ? (
                  <Button
                    disabled={saving || autoSaveInFlight.current}
                    onClick={() => void retrySmartPreviewSave()}
                    type="button"
                    variant="secondary"
                  >
                    Tentar salvar novamente
                  </Button>
                ) : null}
                <Button
                  disabled={generatingPreview}
                  onClick={rejectSmartPreview}
                  type="button"
                  variant="secondary"
                >
                  Rejeitar prévia
                </Button>
                <Button
                  disabled={generatingPreview}
                  onClick={requestAssistedAssembly}
                  type="button"
                  variant="secondary"
                >
                  {generatingPreview ? "Gerando Plano Inteligente..." : "Gerar nova prévia"}
                </Button>
                <Button
                  disabled={generatingPreview}
                  onClick={activateManualAssembly}
                  type="button"
                  variant="secondary"
                >
                  Continuar editando manualmente
                </Button>
              </div>
            </Card>
          ) : null}

          <Card className={`${invalidIntelligentPreview ? "hidden " : ""}space-y-4 p-4`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <SectionHeader
                description="Trabalhe em uma refeição por vez. Quantidades e nutrientes são recalculados imediatamente."
                eyebrow="Prescrição"
                title="Refeições"
              />
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Adicionar refeição padrão"
                  className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value) addMeal(event.target.value);
                    event.target.value = "";
                  }}
                >
                  <option value="">Adicionar refeição</option>
                  {STANDARD_MEALS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <Button
                  onClick={() => addMeal(`Refeição personalizada ${meals.length + 1}`)}
                  type="button"
                  variant="secondary"
                >
                  Personalizada
                </Button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto border-b border-[var(--line)] pb-2">
              {meals.map((meal) => (
                <button
                  className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black transition ${
                    activeMeal?.id === meal.id
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--surface)] text-[var(--text-primary)] hover:bg-emerald-50"
                  }`}
                  key={meal.id}
                  onClick={() => setActiveMealId(meal.id)}
                  type="button"
                >
                  {meal.name}
                </button>
              ))}
            </div>

            {activeMeal ? (() => {
              const mealIndex = meals.findIndex((meal) => meal.id === activeMeal.id);
              const mealNutrition = calculateMealPlanNutritionTotals([activeMeal]);
              const mealTotals = mealNutrition.values;
              const smartMeal = smartPreview?.meals[mealIndex];
              const reviewStatus = mealReviewStatus[activeMeal.id] ?? "PENDING_REVIEW";
              const reviewStatusLabel: Record<MealReviewStatus, string> = {
                PENDING_REVIEW: "Pendente de revis\u00e3o",
                APPROVED: "Aprovada pelo nutricionista",
                EDITED: "Editada manualmente",
              };
              return (
                <div className="space-y-4">
                  {assemblyMode === "INTELLIGENT" ? (
                    <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-sky-900">
                            Hip&oacute;tese assistida desta refei&ccedil;&atilde;o
                          </p>
                          <p className="mt-1 text-sm text-sky-900">
                            {smartMeal?.internalJustification ?? "Composi\u00e7\u00e3o em revis\u00e3o pelo nutricionista."}
                          </p>
                          <p className="mt-1 text-xs text-sky-800">
                            Justificativa interna. N&atilde;o integra o material do paciente.
                          </p>
                        </div>
                        <Badge>{reviewStatusLabel[reviewStatus]}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={reviewStatus === "APPROVED" || Boolean(regeneratingMealId)}
                          onClick={() => {
                            setMealReviewStatus((current) => ({
                              ...current,
                              [activeMeal.id]: "APPROVED",
                            }));
                            setMessage(`${activeMeal.name} aprovada pelo nutricionista.`);
                          }}
                          size="small"
                          type="button"
                        >
                          Aprovar refei&ccedil;&atilde;o
                        </Button>
                        <Button
                          disabled={Boolean(regeneratingMealId)}
                          onClick={() => void regenerateAssistedMeal(activeMeal.id)}
                          size="small"
                          type="button"
                          variant="secondary"
                        >
                          {regeneratingMealId === activeMeal.id
                            ? "Regenerando refei\u00e7\u00e3o..."
                            : "Regenerar somente esta refei\u00e7\u00e3o"}
                        </Button>
                        <Button
                          disabled={Boolean(regeneratingMealId)}
                          onClick={() => {
                            markMealEdited(activeMeal.id);
                            document.getElementById(`meal-name-${activeMeal.id}`)?.focus();
                            setMessage("Edi\u00e7\u00e3o manual ativa somente nesta refei\u00e7\u00e3o.");
                          }}
                          size="small"
                          type="button"
                          variant="secondary"
                        >
                          Editar manualmente
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
                    <label className="text-sm font-bold">
                      Nome
                      <input
                        className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 font-normal"
                        id={`meal-name-${activeMeal.id}`}
                        onChange={(event) => updateMeal(activeMeal.id, { name: event.target.value })}
                        value={activeMeal.name}
                      />
                    </label>
                    <label className="text-sm font-bold">
                      Horário
                       <input
                         className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 font-normal"
                         onChange={(event) => updateMeal(activeMeal.id, { time: event.target.value || undefined })}
                         type="time"
                         value={activeMeal.time ?? ""}
                       />
                       {smartPreview && !activeMeal.time ? (
                         <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
                           Não informado
                         </span>
                       ) : null}
                     </label>
                    <div className="flex flex-wrap items-end gap-2">
                      <Button disabled={mealIndex === 0} onClick={() => moveMeal(activeMeal.id, -1)} size="small" type="button" variant="secondary">↑</Button>
                      <Button disabled={mealIndex === meals.length - 1} onClick={() => moveMeal(activeMeal.id, 1)} size="small" type="button" variant="secondary">↓</Button>
                      <Button disabled={meals.length === 1} onClick={() => removeMeal(activeMeal.id)} size="small" type="button" variant="secondary">Remover</Button>
                    </div>
                  </div>

                  <details className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-black">Observações da refeição</summary>
                    <div className="border-t border-[var(--line)] p-3">
                      <textarea
                        className="min-h-20 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
                        onChange={(event) => updateMeal(activeMeal.id, { observations: event.target.value || undefined })}
                        placeholder="Orientações específicas desta refeição"
                        value={activeMeal.observations ?? ""}
                      />
                    </div>
                  </details>

                  <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                    <div className="grid min-w-[1040px] grid-cols-[minmax(180px,2fr)_220px_70px_90px_repeat(4,52px)_200px] gap-2 bg-[var(--surface)] px-3 py-1.5 text-[11px] font-black uppercase text-[var(--muted)]">
                      <span>Alimento</span><span>Medida</span><span>Nº medidas</span><span>Quantidade</span><span>kcal</span><span>P</span><span>C</span><span>L</span><span>Ações</span>
                    </div>
                    <div className="divide-y divide-[var(--line)]">
                      {activeMeal.items.map((item) =>
                        isMealPlanRecipeItem(item) ? (
                          <div className="grid min-w-[1040px] grid-cols-[minmax(180px,2fr)_220px_70px_90px_repeat(4,52px)_200px] items-center gap-2 bg-white px-3 py-1.5" key={item.id}>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-black leading-4">{item.recipeTitle}</p>
                              <p className="truncate text-[11px] text-[var(--muted)]">Receita · snapshot v{item.recipeNutritionSnapshotVersion}</p>
                              {item.nutritionCompleteness === "PARTIAL" ? (
                                <p className="mt-1 text-xs font-bold text-amber-800">{recipeNutritionAvailabilityLabel(item)}</p>
                              ) : null}
                              {recipePortionInputs[item.id]?.error ? <p className="mt-1 text-xs font-bold text-red-700">{recipePortionInputs[item.id].error}</p> : null}
                            </div>
                            <span className="text-xs font-bold text-[var(--muted)]">
                              {formatRecipePortionDescription(
                                item.portion.prescribedServings,
                                item.portion.recipeServings,
                              )}
                            </span>
                            <input
                              aria-invalid={Boolean(recipePortionInputs[item.id]?.error)}
                              aria-label={`Quantidade de porções de ${item.recipeTitle}`}
                              className="w-full rounded-md border border-[var(--line)] px-2 py-1 text-sm tabular-nums"
                              inputMode="decimal"
                              onBlur={() => finishRecipePortionInput(item)}
                              onChange={(event) => updateRecipePortion(activeMeal.id, item, event.target.value)}
                              type="text"
                              value={recipePortionInputs[item.id]?.prescribedServingsInput ?? formatMealPlanDecimalInput(item.portion.prescribedServings)}
                            />
                            <span className="text-center text-xs font-bold text-[var(--muted)]" title="Quantidade técnica não é necessária para prescrição por porções iguais.">Não exigido</span>
                            {([
                              [item.prescribedNutrients.energyKcal, "kcal"],
                              [item.prescribedNutrients.proteinGrams, "g"],
                              [item.prescribedNutrients.carbohydratesGrams, "g"],
                              [item.prescribedNutrients.fatsGrams, "g"],
                            ] as const).map(([value, unit], index) => (
                              <output className={`text-right text-sm font-bold tabular-nums ${value === null ? "text-amber-800" : ""}`} key={index} title={value === null ? "Nutriente indisponível no snapshot registrado." : undefined}>
                                {nutritionDisplay(value, unit)}
                              </output>
                            ))}
                            <div className="flex flex-nowrap gap-1">
                              <Button disabled={saving} onClick={() => openRecipeSnapshotUpdate(activeMeal.id, item)} size="small" type="button" variant="secondary">Atualizar snapshot</Button>
                              <button aria-label={`Remover ${item.recipeTitle}`} className="rounded-md border border-red-200 px-2 text-red-700" disabled={saving} onClick={() => removeFood(activeMeal.id, item.id)} type="button">×</button>
                            </div>
                          </div>
                        ) : (
                        <div className="grid min-w-[1040px] grid-cols-[minmax(180px,2fr)_220px_70px_90px_repeat(4,52px)_200px] items-center gap-2 bg-white px-3 py-1.5" key={item.id}>
                          {(() => {
                            const food = item;
                            const foodPortionInput = portionInputs[food.id];
                            const displayedUnit =
                              foodPortionInput?.pendingDirectUnit ??
                              food.prescribedUnit ??
                              "g";
                            return <>
                          <div className="min-w-0">
                          <button className="w-full min-w-0 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]" onClick={() => openFoodSubstitution(activeMeal.id, food.id)} type="button">
                            <p className="truncate text-[13px] font-black leading-4">{food.description}</p>
                            <p className="truncate text-[11px] text-[var(--muted)]">{food.foodGroup} · {food.source}</p>
                            <p className="truncate text-[11px] text-[var(--muted)]">{food.householdMeasure} · {n(prescribedAmount(food))} {food.prescribedUnit ?? "g"}</p>
                          </button>
                            {food.substitutions.map((alternative) => (
                              <div className="mt-1 rounded-md bg-sky-50 px-2 py-1 text-[10px] leading-4 text-sky-950" key={alternative.id}>
                                <p><strong>Alternativa:</strong> {alternative.replacementDescription} · critério: energia e macronutrientes{alternative.needsProfessionalReview ? " · nova conferência necessária" : ""}</p>
                                <div className="mt-1 grid grid-cols-[3.5rem_minmax(7rem,1fr)_4.5rem] gap-1">
                                  <input aria-label={`Quantidade da alternativa ${alternative.replacementDescription}`} className="min-w-0 rounded border border-sky-200 bg-white px-1 py-0.5 tabular-nums" inputMode="decimal" onChange={(event) => updateFoodSubstitutionPortion(activeMeal.id, food.id, alternative.id, "quantity", event.target.value)} title="Quantidade de medidas" type="text" value={alternative.replacementQuantity === undefined ? "" : formatMealPlanDecimalInput(alternative.replacementQuantity)} />
                                  <input aria-label={`Medida caseira da alternativa ${alternative.replacementDescription}`} className="min-w-0 rounded border border-sky-200 bg-white px-1 py-0.5" onChange={(event) => updateFoodSubstitutionPortion(activeMeal.id, food.id, alternative.id, "householdMeasure", event.target.value)} title="Medida caseira" type="text" value={alternative.replacementHouseholdMeasure ?? ""} />
                                  <span className="flex min-w-0 items-center rounded border border-sky-200 bg-white pr-1">
                                    <input aria-label={`Quantidade total da alternativa ${alternative.replacementDescription}`} className="min-w-0 w-full bg-transparent px-1 py-0.5 tabular-nums outline-none" inputMode="decimal" onChange={(event) => updateFoodSubstitutionPortion(activeMeal.id, food.id, alternative.id, "prescribedAmount", event.target.value)} title="Quantidade total" type="text" value={alternative.replacementPrescribedAmount === undefined ? "" : formatMealPlanDecimalInput(alternative.replacementPrescribedAmount)} />
                                    <span aria-hidden="true">{alternative.replacementPrescribedUnit ?? "g"}</span>
                                  </span>
                                </div>
                              </div>
                            ))}
                            {foodPortionInput?.error ? <p className="mt-1 text-xs font-bold text-red-700">{foodPortionInput.error}</p> : null}
                          </div>
                          <select
                            aria-label={`Medida de ${food.description}`}
                            className="w-full rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs"
                            onChange={(event) =>
                              selectIbgeMeasure(
                                activeMeal.id,
                                food.id,
                                event.target.value,
                              )
                            }
                            value={
                              foodPortionInput?.pendingDirectUnit
                                ? directMealPlanMeasureId(
                                    foodPortionInput.pendingDirectUnit,
                                  )
                                : mealPlanMeasureSelectionId(food)
                            }
                          >
                            {mealPlanMeasureDisplayOptions(food).map((option) => (
                              <option disabled={"disabled" in option && option.disabled} key={option.id} value={option.id}>{option.label}</option>
                            ))}
                          </select>
                          {isDirectPrescription(
                            food,
                            foodPortionInput?.pendingDirectUnit,
                          ) ? (
                            <span
                              className="text-center text-sm font-bold text-[var(--muted)]"
                              title={`Não se aplica à prescrição direta em ${displayedUnit}.`}
                            >
                              <span aria-hidden="true">—</span>
                              <span className="sr-only">
                                Quantidade não aplicável para {food.description};
                                prescrição direta em {displayedUnit}.
                              </span>
                            </span>
                          ) : (
                            <input aria-invalid={Boolean(foodPortionInput?.error)} aria-label={`Número de medidas de ${food.description}`} className="w-full rounded-md border border-[var(--line)] px-2 py-1 text-sm tabular-nums" id={`food-quantity-${food.id}`} inputMode="decimal" onBlur={() => finishFoodPortionInput(food)} onChange={(event) => {
                              updateFoodPortion(activeMeal.id, food, { field: "quantity", input: event.target.value });
                            }} title="Número de medidas caseiras; ao alterar, a quantidade total será recalculada pela equivalência documentada." type="text" value={foodPortionInput?.quantityInput ?? quantityInput(food)} />
                          )}
                          <div className="flex items-center rounded-md border border-[var(--line)] bg-white pr-2 focus-within:border-[var(--primary)]">
                            <input aria-invalid={Boolean(foodPortionInput?.error)} aria-label={`Quantidade total em ${displayedUnit} de ${food.description}`} className="min-w-0 w-full rounded-md bg-transparent px-2 py-1 text-sm tabular-nums outline-none" id={`food-grams-${food.id}`} inputMode="decimal" onBlur={() => finishFoodPortionInput(food)} onChange={(event) => {
                              updateFoodPortion(activeMeal.id, food, foodPortionInput?.pendingDirectUnit ? { field: "directAmount", input: event.target.value, unit: foodPortionInput.pendingDirectUnit } : { field: "grams", input: event.target.value });
                            }} title={food.selectedIbgeMeasureId ? "Quantidade total documentada para a medida selecionada." : `Quantidade total prescrita em ${displayedUnit}.`} type="text" value={foodPortionInput?.gramsInput ?? prescribedAmountInput(food)} />
                            <span aria-hidden="true" className="text-xs font-bold text-[var(--muted)]">{displayedUnit}</span>
                          </div>
                          {[food.nutrients.energyKcal, food.nutrients.proteinGrams, food.nutrients.carbohydratesGrams, food.nutrients.fatsGrams].map((value, index) => <output className="text-right text-sm font-bold tabular-nums" key={index}>{n(value)}</output>)}
                          <div className="flex flex-nowrap gap-1">
                            <Button disabled={saving} onClick={() => openFoodSubstitution(activeMeal.id, food.id)} size="small" type="button" variant="secondary">Adicionar alternativa</Button>{food.substitutions.some((alternative) => alternative.needsProfessionalReview) ? <Button disabled={saving} onClick={() => confirmRecalculatedAlternatives(activeMeal.id, food.id)} size="small" type="button" variant="secondary">Conferir alternativas</Button> : null}<Button disabled={saving} onClick={() => duplicateFood(activeMeal.id, food.id)} size="small" type="button" variant="secondary">Duplicar</Button><button aria-label={`Remover ${food.description}`} className="rounded-md border border-red-200 px-2 text-red-700" disabled={saving} onClick={() => removeFood(activeMeal.id, food.id)} type="button">×</button>
                          </div>
                            </>;
                          })()}
                        </div>
                        ),
                      )}
                      {activeMeal.items.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">Nenhum alimento ou receita adicionado nesta refeição.</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button onClick={() => addFoodLine(activeMeal.id)} type="button" variant="secondary">+ Adicionar alimento ou receita</Button>
                    <p className="text-xs font-bold tabular-nums text-[var(--muted)]">
                      {activeMeal.plannedEnergyKcal ? `Meta ${n(activeMeal.plannedEnergyKcal)} kcal · ` : ""}
                      {mealNutrition.nutritionCompleteness === "COMPLETE" ? "Atual" : "Valores conhecidos · total parcial"} {n(mealTotals.energyKcal)} kcal · {n(mealTotals.proteinGrams)} g P · {n(mealTotals.carbohydratesGrams)} g C · {n(mealTotals.fatsGrams)} g L
                    </p>
                  </div>
                </div>
              );
            })() : null}
          </Card>

          <Card className={`${invalidIntelligentPreview ? "hidden " : ""}space-y-4 p-4`}>
            <SectionHeader
              description={hasPartialNutrition ? "Totais parciais: nutrientes indisponíveis não foram convertidos em zero." : hasFoods ? "Comparação atualizada conforme os itens prescritos." : "Adicione alimentos ou receitas para comparar o plano com a estratégia."}
              eyebrow="Estratégia × Plano"
              title="Resumo nutricional"
            />
            <RecipeNutritionAvailability
              meals={meals}
              nutrition={nutritionTotals}
            />
            {!strategy ? (
              <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
                Totais calculados a partir dos itens selecionados. Sem Estratégia, não há metas para comparar.
              </div>
            ) : !hasFoods || !adequacy ? (
              <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
                Adequação ainda não calculada.
              </div>
            ) : (
              <div className="grid grid-cols-1 auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {(["energyKcal", "proteinGrams", "carbohydratesGrams", "fatsGrams", "fiberGrams"] as NutritionAdequacyMetric[]).map((metric) => {
                  const result = adequacy.metrics[metric];
                  const config = adequacyMetricConfig[metric];
                  return (
                    <div className="flex min-h-32 min-w-0 flex-col rounded-xl border border-[var(--line)] p-3" key={metric}>
                      <div className="min-w-0 space-y-2">
                        <p className="break-words text-xs font-black uppercase leading-5 text-[var(--muted)]">{config.label}</p>
                        <span className={`inline-flex max-w-full rounded-full px-2 py-1 text-xs font-bold leading-none ${result.status === "ADEQUATE" ? "bg-emerald-50 text-emerald-700" : result.status === "NEAR_TARGET" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{adequacyStatusLabels[result.status]}</span>
                      </div>
                      <p className="mt-auto break-words pt-3 text-lg font-black leading-6">{n(result.actual)} / {n(result.target)} {config.unit}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <details className={`${invalidIntelligentPreview ? "hidden " : ""}rounded-2xl border border-[var(--line)] bg-white`} open={showClinicalJustification} onToggle={(event) => setShowClinicalJustification((event.currentTarget as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer list-none px-4 py-4 text-sm font-black">Justificativa clínica das alterações <span className="font-normal text-[var(--muted)]">(opcional)</span></summary>
            <div className="border-t border-[var(--line)] p-4">
              <textarea className="min-h-28 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm" id="clinical-justification" maxLength={10_000} onChange={(event) => setClinicalJustification(event.target.value)} placeholder="Preferência alimentar, intolerância, aderência, rotina ou decisão clínica..." value={clinicalJustification} />
            </div>
          </details>

          <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-[var(--muted)]">
                {invalidIntelligentPreview
                  ? `${structurallyRejectedPreview ? "Prévia rejeitada por incoerência alimentar" : "Prévia anterior inativa enquanto os horários estão pendentes"} · Responsável: ${plan.responsibleProfessional}`
                  : `${hasPartialNutrition ? "Valores conhecidos · total parcial" : "Total do dia"} · ${meals.reduce((sum, meal) => sum + meal.items.length, 0)} itens · ${n(totals.energyKcal)} kcal · ${n(totals.proteinGrams)} g P · ${n(totals.carbohydratesGrams)} g C · ${n(totals.fatsGrams)} g L · Responsável: ${plan.responsibleProfessional}`}
              </p>
              {!finalized && autoSaveState !== "IDLE" ? (
                <p
                  aria-live="polite"
                  className={`mt-1 text-xs font-bold ${autoSaveState === "ERROR" ? "text-red-700" : "text-[var(--primary)]"}`}
                >
                  {autoSaveState === "PENDING"
                    ? "Alterações pendentes"
                    : autoSaveState === "SAVING"
                      ? "Salvando automaticamente…"
                      : autoSaveState === "SAVED"
                        ? "Salvo automaticamente"
                        : "Falha ao salvar — tente novamente"}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              {completionBlockedReason ? (
                <p
                  aria-live="polite"
                  className="max-w-md text-xs font-bold text-amber-800 sm:text-right"
                  id="meal-plan-completion-blocked-reason"
                >
                  {completionBlockedReason}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button disabled={saving || autoSaveState === "SAVING" || meals.length === 0} type="submit" variant="secondary">{saving ? "Salvando…" : "Salvar rascunho"}</Button>
                <Button aria-describedby={completionBlockedReason ? "meal-plan-completion-blocked-reason" : undefined} disabled={completionBlocked} name="mealPlanAction" type="submit" value="complete">Concluir Plano Alimentar</Button>
              </div>
            </div>
          </div>
        </fieldset>
          ) : workspaceTab === "ADEQUACY" ? (
            <section aria-labelledby="meal-plan-tab-adequacy" id="meal-plan-panel-adequacy" role="tabpanel">
              <MealPlanAdequacyTab attendanceDate={plan.attendanceDate} birthDate={plan.patientBirthDate} disabled={finalized || saving} meals={meals} onProfileChange={(profile) => { setDietaryReferenceProfile(profile); setDietaryReferences(selectDietaryReferences(profile) ?? undefined); setReviewAcknowledged(false); setReviewedDraftFingerprint(undefined); setMessage("Perfil de referência ajustado; salve o plano para persistir a configuração."); }} patientSex={plan.patientSex} profile={dietaryReferenceProfile} references={dietaryReferences} />
            </section>
          ) : (
            <section aria-labelledby="meal-plan-tab-analysis" id="meal-plan-panel-analysis" role="tabpanel">
              <MealPlanAnalysisTab meals={meals} strategy={strategy} weightKg={plan.currentWeightKg} />
            </section>
          )}
        </>
      ) : (
        <PrescriptionHistory entries={plan.prescriptionHistory} />
      )}

      {recoverableDraft && !finalized ? (
        <div
          aria-labelledby="recover-meal-plan-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-black" id="recover-meal-plan-title">
              Encontramos alterações não salvas deste plano.
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Escolha se deseja recuperar o conteúdo armazenado neste navegador ou descartá-lo.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button onClick={discardLocalDraft} type="button" variant="secondary">
                Descartar cópia
              </Button>
              <Button onClick={recoverLocalDraft} type="button">
                Recuperar alterações
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {adjustmentOpen ? (
        <div
          aria-labelledby="adjust-meal-plan-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-5"
          role="dialog"
        >
          <section className="w-full rounded-t-3xl bg-white shadow-2xl sm:max-w-xl sm:rounded-3xl">
            <div>
              <div className="border-b border-[var(--line)] p-5 sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">
                  Plano concluído
                </p>
                <h3 className="mt-1 text-xl font-black" id="adjust-meal-plan-title">
                  Ajustar plano
                </h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  A última entrega oficial será preservada. As alterações serão
                  feitas no plano atual.
                </p>
              </div>
              <div className="p-5 sm:p-6">
                <label className="block text-sm font-black" htmlFor="adjust-meal-plan-reason">
                  Motivo do ajuste
                </label>
                <textarea
                  aria-invalid={Boolean(adjustmentError)}
                  aria-required="true"
                  className="mt-2 min-h-28 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  disabled={adjusting}
                  id="adjust-meal-plan-reason"
                  maxLength={10_000}
                  onChange={(event) => {
                    setAdjustmentReason(event.target.value);
                    if (adjustmentError) setAdjustmentError("");
                  }}
                  required
                  value={adjustmentReason}
                />
                {adjustmentError ? (
                  <p aria-live="polite" className="mt-2 text-sm font-bold text-red-700">
                    {adjustmentError}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] p-5 sm:flex-row sm:justify-end sm:p-6">
                <Button
                  disabled={adjusting}
                  onClick={closeAdjustmentDialog}
                  type="button"
                  variant="secondary"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={adjusting}
                  onClick={() => void adjustPlan()}
                  type="button"
                >
                  {adjusting ? "Confirmando…" : "Confirmar ajuste"}
                </Button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {showIntelligentReplacementConfirmation ? (
        <div
          aria-labelledby="replace-intelligent-plan-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-black" id="replace-intelligent-plan-title">
              Substituir conteúdo do plano?
            </h3>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Este plano já possui alimentos. Deseja substituir o conteúdo atual por uma nova prévia inteligente?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                onClick={() => setShowIntelligentReplacementConfirmation(false)}
                type="button"
                variant="secondary"
              >
                Cancelar
              </Button>
              <Button onClick={() => void prepareAssistedAssembly()} type="button">
                Substituir
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {activePicker ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">{equivalenceFoodId ? "Banco Mestre" : pickerMode === "RECIPE" ? "Receitas acessíveis" : "Banco Mestre · TACO"}</p>
                <h3 className="mt-1 text-xl font-black">{equivalenceFoodId ? "Substituir alimento" : recipeSnapshotUpdateTarget ? "Atualizar snapshot da receita" : "Adicionar ao plano"}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{meals.find((meal) => meal.id === activePicker.mealId)?.name}</p>
              </div>
              <button aria-label="Fechar" className="rounded-full border border-[var(--line)] px-3 py-1 text-xl" onClick={() => { setPendingSubstitution(undefined); setRecipeSnapshotUpdateTarget(undefined); setActivePicker(undefined); setEquivalenceFoodId(undefined); setQuery(""); }} type="button">×</button>
            </div>
            <div className="space-y-3 p-4">
              {equivalenceFoodId && activeSubstitutionFood && !pendingSubstitution ? (
                <section aria-label="Alimento atual" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--primary)]">Alimento atual</p>
                  <h4 className="mt-1 font-black">{activeSubstitutionFood.description}</h4>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div><dt className="text-xs font-bold text-[var(--muted)]">Grupo alimentar</dt><dd>{activeSubstitutionFood.foodGroup}</dd></div>
                    <div><dt className="text-xs font-bold text-[var(--muted)]">Fonte nutricional</dt><dd>{activeSubstitutionFood.sourceName}</dd></div>
                    <div><dt className="text-xs font-bold text-[var(--muted)]">Medida utilizada</dt><dd>{selectedMeasureName(activeSubstitutionFood)}</dd></div>
                    <div><dt className="text-xs font-bold text-[var(--muted)]">Quantidade</dt><dd>{n(activeSubstitutionFood.quantity, 2)}</dd></div>
                    <div><dt className="text-xs font-bold text-[var(--muted)]">Quantidade</dt><dd>{n(prescribedAmount(activeSubstitutionFood))} {activeSubstitutionFood.prescribedUnit ?? "g"}</dd></div>
                    <div><dt className="text-xs font-bold text-[var(--muted)]">Macros</dt><dd>{n(activeSubstitutionFood.nutrients.energyKcal)} kcal · {n(activeSubstitutionFood.nutrients.proteinGrams)} g P · {n(activeSubstitutionFood.nutrients.carbohydratesGrams)} g C · {n(activeSubstitutionFood.nutrients.fatsGrams)} g L · {n(activeSubstitutionFood.nutrients.fiberGrams)} g fibras</dd></div>
                  </dl>
                </section>
              ) : null}
              {pendingSubstitution ? (
                <div className="space-y-4" aria-live="polite">
                  <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                    <div className="rounded-xl border border-[var(--line)] p-3">
                      <p className="text-xs font-black uppercase text-[var(--muted)]">Alimento atual</p>
                      <p className="mt-1 font-black">{pendingSubstitution.current.description}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{prescribedMeasureLabel(pendingSubstitution.current)}</p>
                    </div>
                    <span aria-hidden="true" className="text-center text-xl font-black text-[var(--primary)]">→</span>
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3">
                      <p className="text-xs font-black uppercase text-emerald-800">Novo alimento</p>
                      <p className="mt-1 font-black">{pendingSubstitution.replacement.description}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{prescribedMeasureLabel(pendingSubstitution.replacement)} · compatibilidade {n(pendingSubstitution.equivalent.score.total)}%</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-[var(--surface)] text-left text-xs uppercase text-[var(--muted)]">
                        <tr><th className="px-3 py-2">Diferença nutricional</th><th className="px-3 py-2 text-right">Atual</th><th className="px-3 py-2 text-right">Novo</th><th className="px-3 py-2 text-right">Diferença absoluta</th><th className="px-3 py-2 text-right">Diferença percentual</th></tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        {([
                          ["Energia", "energyKcal", "kcal"],
                          ["Proteínas", "proteinGrams", "g"],
                          ["Carboidratos", "carbohydratesGrams", "g"],
                          ["Lipídios", "fatsGrams", "g"],
                          ["Fibras", "fiberGrams", "g"],
                        ] as const).map(([label, key, unit]) => {
                          const currentValue = pendingSubstitution.current.nutrients[key];
                          const replacementValue = pendingSubstitution.replacement.nutrients[key];
                          const difference = replacementValue - currentValue;
                          const percentage = currentValue === 0
                            ? null
                            : (difference / currentValue) * 100;
                          return <tr key={key}><th className="px-3 py-2 text-left font-bold">{label}</th><td className="px-3 py-2 text-right tabular-nums">{n(currentValue)} {unit}</td><td className="px-3 py-2 text-right tabular-nums">{n(replacementValue)} {unit}</td><td className="px-3 py-2 text-right font-black tabular-nums">{difference > 0 ? "+" : ""}{n(difference)} {unit}</td><td className="px-3 py-2 text-right font-black tabular-nums">{percentage === null ? "—" : `${percentage > 0 ? "+" : ""}${n(percentage)}%`}</td></tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
                    <p className="text-xs font-black uppercase text-blue-900">Motivo da sugestão · uso interno</p>
                    <p className="mt-1 text-blue-950">{pendingSubstitution.equivalent.suggestionReason}</p>
                  </div>
                  <fieldset className="grid gap-3 rounded-xl border border-[var(--line)] p-3 sm:grid-cols-[8rem_minmax(0,1fr)_10rem]">
                    <legend className="px-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--primary)]">Porção da alternativa</legend>
                    <label className="text-sm font-black">
                      Quantidade
                      <input aria-label="Quantidade da alternativa" className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2 font-normal tabular-nums" inputMode="decimal" onChange={(event) => updatePendingSubstitutionPortion("quantity", event.target.value)} type="text" value={formatMealPlanDecimalInput(pendingSubstitution.replacement.quantity)} />
                    </label>
                    <label className="text-sm font-black">
                      Medida caseira
                      <input aria-label="Medida caseira da alternativa" className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2 font-normal" onChange={(event) => updatePendingSubstitutionPortion("householdMeasure", event.target.value)} type="text" value={pendingSubstitution.replacement.householdMeasure} />
                    </label>
                    <label className="text-sm font-black">
                      Quantidade total
                      <span className="mt-1 flex items-center rounded-lg border border-[var(--line)] bg-white pr-3 focus-within:border-[var(--primary)]">
                        <input aria-label="Quantidade total da alternativa" className="min-w-0 w-full rounded-lg px-3 py-2 font-normal tabular-nums outline-none" inputMode="decimal" onChange={(event) => updatePendingSubstitutionPortion("prescribedAmount", event.target.value)} type="text" value={formatMealPlanDecimalInput(pendingSubstitution.replacement.prescribedAmount ?? pendingSubstitution.replacement.grams)} />
                        <span aria-hidden="true" className="text-xs font-bold text-[var(--muted)]">{pendingSubstitution.replacement.prescribedUnit ?? "g"}</span>
                      </span>
                    </label>
                  </fieldset>
                  <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--line)] pt-4">
                    <Button onClick={() => setPendingSubstitution(undefined)} type="button" variant="secondary">Voltar à pesquisa</Button>
                    <Button onClick={confirmFoodSubstitution} type="button">Confirmar substituição</Button>
                  </div>
                </div>
              ) : <>
              {!equivalenceFoodId ? (
                <div aria-label="Tipo de item" className="flex gap-2" role="tablist">
                  <Button onClick={() => { setPickerMode("FOOD"); setQuery(""); setRecipeSelectionError(""); }} type="button" variant={pickerMode === "FOOD" ? "primary" : "secondary"}>Alimento</Button>
                  <Button onClick={() => { setPickerMode("RECIPE"); setQuery(""); setFoodResults([]); setRecipeSelectionError(""); }} type="button" variant={pickerMode === "RECIPE" ? "primary" : "secondary"}>Receita</Button>
                </div>
              ) : null}
              <label className="block text-sm font-black">
                {pickerMode === "RECIPE" ? "Receita" : "Alimento"}
                <input autoComplete="off" autoFocus className="mt-1 w-full rounded-xl border border-[var(--line)] px-4 py-2.5 text-base" id="meal-plan-item-search" onChange={(event) => setQuery(event.target.value)} placeholder="Nome completo, parcial ou palavra..." value={query} />
              </label>
              {equivalenceFoodId ? (
                <p className="text-sm font-black">
                  {query.trim() ? "Resultados compatíveis" : "Sugestões automáticas"}
                </p>
              ) : null}
              {pickerMode === "FOOD" ? <div aria-live="polite" className="grid gap-1.5">
                {searching ? <p className="text-sm text-[var(--muted)]">Pesquisando no Banco Mestre…</p> : null}
                {!searching && foodResults.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Nenhum alimento encontrado.</p>
                ) : null}
                {rankedFoodResults.map((food) => (
                  <button className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2 text-left hover:border-[var(--primary)] hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]" key={food.id} onClick={async () => {
                    const equivalent = equivalents.find((item) => item.food.id === food.id);
                    await chooseFood(food, equivalent);
                  }} type="button">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">{food.officialName}</span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{food.foodGroup}</span>
                    </span>
                    <span className="text-right text-xs">
                      <span className="block font-black">{food.source.kind}</span>
                      <span className="mt-0.5 block text-[var(--muted)]">{n(food.referenceServingGrams)} {food.referenceServingUnit ?? "g"}</span>
                    </span>
                    {equivalenceFoodId ? (
                      <span className="col-span-2 text-xs font-bold text-[var(--text-secondary)]">
                        {equivalents.find((item) => item.food.id === food.id)?.suggestedQuantity} {equivalents.find((item) => item.food.id === food.id)?.suggestedHouseholdMeasure} · {n(equivalents.find((item) => item.food.id === food.id)?.suggestedGrams ?? 0)} {food.referenceServingUnit ?? "g"} · compatibilidade {n(equivalents.find((item) => item.food.id === food.id)?.score.total ?? 0)}%
                      </span>
                    ) : null}
                  </button>
                ))}
              </div> : (
                <div aria-live="polite" className="grid gap-2">
                  {searching ? <p className="text-sm text-[var(--muted)]">Consultando receitas acessíveis…</p> : null}
                  {recipeSelectionError ? <p className="text-sm font-bold text-red-700">{recipeSelectionError}</p> : null}
                  {!searching && !recipeSelectionError && filteredRecipeResults.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">Nenhuma receita com acesso disponível.</p>
                  ) : null}
                  {filteredRecipeResults.map((recipe) => {
                    const snapshots = [...recipe.nutritionSnapshots]
                      .filter(
                        (snapshot) =>
                          snapshot.recipeId === recipe.id &&
                          Number(snapshot.servings) > 0,
                      )
                      .sort((left, right) => right.version - left.version);
                    return (
                      <button
                        aria-pressed={selectedRecipeId === recipe.id}
                        className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${selectedRecipeId === recipe.id ? "border-[var(--primary)] bg-emerald-50" : "border-[var(--line)] hover:border-[var(--primary)]"}`}
                        key={recipe.id}
                        onClick={() => {
                          setSelectedRecipeId(recipe.id);
                          setSelectedRecipeSnapshotId(snapshots[0]?.id);
                          setRecipeSelectionError(
                            snapshots.length
                              ? ""
                              : "Esta receita ainda não possui snapshot prescritível. Abra a receita, confirme um número de porções válido e use “Calcular receita”; depois retorne a este seletor.",
                          );
                        }}
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black">{recipe.title}</span>
                          <span className="mt-0.5 block text-xs text-[var(--muted)]">{snapshots.length ? `${snapshots.length} versão(ões) nutricional(is)` : "Sem snapshot prescritível · calcule a receita"}</span>
                        </span>
                        <span className="text-xs font-bold text-[var(--muted)]">{recipe.status}</span>
                      </button>
                    );
                  })}
                  {selectedRecipe && selectedRecipeSnapshots.length ? (
                    <section className="mt-2 grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:grid-cols-2">
                      <label className="text-sm font-black">
                        Versão nutricional
                        <select className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-normal" onChange={(event) => setSelectedRecipeSnapshotId(event.target.value)} value={selectedRecipeSnapshotId ?? ""}>
                          {selectedRecipeSnapshots.map((snapshot) => (
                            <option key={snapshot.id} value={snapshot.id}>Snapshot v{snapshot.version} · {n(Number(snapshot.servings), 2)} porções</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm font-black">
                        Porções prescritas
                        <input className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-normal tabular-nums" inputMode="decimal" onChange={(event) => { setNewRecipeServingsInput(event.target.value); setRecipeSelectionError(""); }} type="text" value={newRecipeServingsInput} />
                      </label>
                      <p className="text-xs text-[var(--muted)] sm:col-span-2">A prescrição divide a receita pelas porções do snapshot. Peso não é obrigatório quando essa divisão não depende dele.</p>
                      <div className="flex justify-end sm:col-span-2">
                        <Button onClick={chooseRecipe} type="button">{recipeSnapshotUpdateTarget ? "Atualizar rascunho" : "Adicionar receita"}</Button>
                      </div>
                    </section>
                  ) : null}
                </div>
              )}
              <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
                <Button onClick={() => { setPendingSubstitution(undefined); setRecipeSnapshotUpdateTarget(undefined); setActivePicker(undefined); setEquivalenceFoodId(undefined); setQuery(""); }} type="button" variant="secondary">Cancelar</Button>
              </div>
              </>}
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
