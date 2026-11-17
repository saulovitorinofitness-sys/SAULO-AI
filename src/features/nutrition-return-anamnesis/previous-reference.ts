import {
  clinicalHistoryOptions,
  objectiveOptions,
} from "@/features/clinical-anamnesis";
import {
  isMealPlanRecipeItem,
  parseStoredMealPlanPayload,
  type MealPlanRecordItem,
  type MealPlanRecordMeal,
  type MealPlanRecordRecipe,
} from "@/features/meal-plan/record";

import type {
  PreviousClinicalReference,
  PreviousMealPlanItemReference,
} from "./contracts";

type UnknownRecord = Readonly<Record<string, unknown>>;

export interface PreviousClinicalEntrySnapshot {
  readonly id: string;
  readonly type: string;
  readonly status?: "DRAFT" | "FINALIZED" | "SUPERSEDED" | "VOIDED";
  readonly occurredAt: Date | string;
  readonly payload: unknown;
  readonly mealPlan?: {
    readonly title: string;
    readonly content: unknown;
  } | null;
  readonly bioimpedance?: {
    readonly measuredAt: Date | string;
    readonly measurements: unknown;
    readonly notes?: string | null;
  } | null;
  readonly perimetry?: {
    readonly measuredAt: Date | string;
    readonly measurements: unknown;
    readonly notes?: string | null;
  } | null;
  readonly physicalAssessment?: {
    readonly assessedAt: Date | string;
    readonly observations: unknown;
    readonly notes?: string | null;
  } | null;
  readonly posturalAssessment?: {
    readonly assessedAt: Date | string;
    readonly observations: unknown;
    readonly notes?: string | null;
  } | null;
}

const objectiveLabel = new Map<string, string>(objectiveOptions);
const clinicalHistoryLabel = new Map<string, string>(clinicalHistoryOptions);

const measurementLabels: Readonly<Record<string, string>> = {
  weightKg: "Peso",
  heightCm: "Altura",
  bmi: "IMC",
  bodyFatPercentage: "Gordura corporal",
  fatMassKg: "Massa gorda",
  muscleMassKg: "Massa muscular",
  leanMassKg: "Massa magra",
  visceralFat: "Gordura visceral",
  waistCm: "Cintura",
  hipCm: "Quadril",
  waistHipRatio: "Relação cintura/quadril",
  basalMetabolicRateKcal: "Taxa metabólica basal",
};

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function iso(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function humanizeKey(key: string) {
  if (measurementLabels[key]) return measurementLabels[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function measurementUnit(key: string) {
  if (/Percentage$/i.test(key)) return "%";
  if (/Kg$/i.test(key)) return " kg";
  if (/Cm$/i.test(key)) return " cm";
  if (/Kcal$/i.test(key)) return " kcal";
  return "";
}

function primitiveMeasurementLines(
  value: unknown,
  prefix = "",
  depth = 0,
): string[] {
  if (depth > 2) return [];
  const record = asRecord(value);
  if (!record) return [];

  return Object.entries(record).flatMap(([key, item]) => {
    if (/image|photo|url|base64|media/i.test(key)) return [];
    const label = prefix
      ? `${prefix} · ${humanizeKey(key)}`
      : humanizeKey(key);

    if (typeof item === "number" && Number.isFinite(item)) {
      return [`${label}: ${item}${measurementUnit(key)}`];
    }
    if (typeof item === "string" && item.trim() && item.length <= 240) {
      return [`${label}: ${item.trim()}`];
    }
    if (typeof item === "boolean") {
      return [`${label}: ${item ? "Sim" : "Não"}`];
    }
    if (Array.isArray(item)) {
      const values = item
        .filter(
          (entry): entry is string | number =>
            (typeof entry === "string" && entry.trim().length > 0) ||
            (typeof entry === "number" && Number.isFinite(entry)),
        )
        .map(String);
      return values.length ? [`${label}: ${values.join(", ")}`] : [];
    }
    return primitiveMeasurementLines(item, label, depth + 1);
  });
}

function formatPersonItem(value: unknown, kind: "MEDICATION" | "SUPPLEMENT") {
  const item = asRecord(value);
  if (!item) return undefined;
  const name = asText(item.name);
  if (!name) return undefined;
  const details = [
    asText(item.dose),
    asText(item.frequency),
    kind === "MEDICATION" ? asText(item.reason) : undefined,
  ].filter((entry): entry is string => Boolean(entry));
  return details.length ? `${name} · ${details.join(" · ")}` : name;
}

function mealSummary(value: unknown) {
  const meal = asRecord(value);
  if (!meal) return undefined;
  const name = asText(meal.name) ?? "Refeição";
  const time = asText(meal.time);
  const items = asArray(meal.items ?? meal.foods).flatMap((value) => {
    const food = asRecord(value);
    if (!food) return [];
    const description =
      asText(food.description) ?? asText(food.name) ?? asText(food.officialName);
    if (!description) return [];
    const quantity = asNumber(food.quantity);
    const measure =
      asText(food.householdMeasure) ??
      asText(food.primaryHouseholdMeasure) ??
      asText(food.unit);
    const amount =
      quantity !== undefined
        ? `${quantity}${measure ? ` ${measure}` : ""}`
        : measure;
    return [amount ? `${description} (${amount})` : description];
  });
  const heading = time ? `${name} · ${time}` : name;
  return items.length ? `${heading}: ${items.join("; ")}` : heading;
}

function frozenNutrient(
  value: number | null,
  label: string,
  unit: string,
) {
  return value === null
    ? `${label} indisponível`
    : `${label} ${value} ${unit}`;
}

function storedRecipeSummary(recipe: MealPlanRecordRecipe) {
  const nutrients = recipe.prescribedNutrients;
  return [
    recipe.recipeTitle,
    `${recipe.portion.prescribedServings} porção(ões) de ${recipe.portion.recipeServings}`,
    `snapshot ${recipe.recipeNutritionSnapshotId} v${recipe.recipeNutritionSnapshotVersion}`,
    frozenNutrient(nutrients.energyKcal, "energia", "kcal"),
    frozenNutrient(nutrients.proteinGrams, "proteínas", "g"),
    frozenNutrient(nutrients.carbohydratesGrams, "carboidratos", "g"),
    frozenNutrient(nutrients.fatsGrams, "lipídios", "g"),
    frozenNutrient(nutrients.fiberGrams, "fibras", "g"),
    frozenNutrient(nutrients.sodiumMg, "sódio", "mg"),
    recipe.nutritionCompleteness === "PARTIAL"
      ? `${recipe.missingNutrients.length} nutriente(s) indisponível(is)`
      : "nutrição completa",
  ].join(" · ");
}

function storedMealSummary(meal: MealPlanRecordMeal) {
  const heading = meal.time ? `${meal.name} · ${meal.time}` : meal.name;
  const items = meal.items.map((item) => {
    if (isMealPlanRecipeItem(item)) return storedRecipeSummary(item);
    const amount = `${item.quantity} ${item.householdMeasure}`;
    return `${item.description} (${amount})`;
  });
  return items.length ? `${heading}: ${items.join("; ")}` : heading;
}

function previousMealPlanItemReference(
  item: MealPlanRecordItem,
): PreviousMealPlanItemReference {
  if (isMealPlanRecipeItem(item)) return item;

  const prescribedAmount = item.prescribedAmount ?? item.grams;
  const prescribedUnit = item.prescribedUnit ?? "g";
  const selectedMeasure = item.ibgeMeasureOptions?.find(
    (option) => option.id === item.selectedIbgeMeasureId,
  );
  return {
    itemType: "FOOD",
    id: item.id,
    catalogFoodId: item.catalogFoodId,
    name: item.description,
    catalogSource: item.sourceName,
    catalogSourceKind: item.source,
    catalogSourceCode: item.sourceCode,
    quantity: item.quantity,
    householdMeasure: item.householdMeasure,
    prescribedAmount,
    prescribedUnit,
    measureAmountPerUnit:
      selectedMeasure?.amountPerMeasure ??
      (item.quantity > 0
        ? prescribedAmount / item.quantity
        : prescribedAmount),
    selectedMeasureId: item.selectedIbgeMeasureId,
    preparation: selectedMeasure?.preparationName,
    nutrientsPer100g: {
      energyKcal: item.nutrientsPer100g.energyKcal,
      proteinGrams: item.nutrientsPer100g.proteinGrams,
      carbohydratesGrams: item.nutrientsPer100g.carbohydratesGrams,
      fatsGrams: item.nutrientsPer100g.fatsGrams,
      fiberGrams: item.nutrientsPer100g.fiberGrams,
      sodiumMg: item.nutrientsPer100g.sodiumMg,
    },
  };
}

function clinicalReference(entry: PreviousClinicalEntrySnapshot | undefined) {
  const payload = asRecord(entry?.payload);
  const primary = asText(payload?.primaryObjective);
  const secondary = asArray(payload?.secondaryObjectives).flatMap((value) => {
    const objective = asText(value);
    return objective ? [objectiveLabel.get(objective) ?? objective] : [];
  });
  const objectives = primary
    ? [objectiveLabel.get(primary) ?? primary, ...secondary]
    : secondary;
  const diagnoses = asArray(payload?.clinicalHistory).flatMap((value) => {
    const diagnosis = asText(value);
    return diagnosis
      ? [clinicalHistoryLabel.get(diagnosis) ?? diagnosis]
      : [];
  });
  const clinicalNotes = asText(payload?.clinicalHistoryNotes);
  const currentIllness = asRecord(payload?.currentIllness);
  const observations = uniqueReferenceTexts([
    clinicalNotes,
    asText(payload?.generalNotes),
    asText(currentIllness?.evolution),
    asText(currentIllness?.currentSituation),
  ]);

  const medications = asArray(payload?.medications).flatMap((value) => {
    const formatted = formatPersonItem(value, "MEDICATION");
    return formatted ? [formatted] : [];
  });
  const supplements = asArray(payload?.supplements).flatMap((value) => {
    const formatted = formatPersonItem(value, "SUPPLEMENT");
    return formatted ? [formatted] : [];
  });
  const allergies = asArray(payload?.allergies).flatMap((value) => {
    const allergy = asText(value);
    return allergy ? [allergy] : [];
  });
  const nutrition = asRecord(payload?.nutrition);
  const restrictions = asText(nutrition?.restrictions);
  if (restrictions) allergies.push(restrictions);

  return {
    complaint: asText(payload?.chiefComplaint),
    objectives,
    diagnoses,
    observations,
    medicationsAndSupplements: [...medications, ...supplements],
    allergiesAndRestrictions: allergies,
  };
}

function uniqueReferenceTexts(values: readonly (string | undefined)[]) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function energyReference(entry: PreviousClinicalEntrySnapshot | undefined) {
  const payload = asRecord(entry?.payload);
  const calculatedMacros = asRecord(payload?.calculatedMacros);
  const protein = asRecord(calculatedMacros?.protein);
  const carbohydrates = asRecord(calculatedMacros?.carbohydrates);
  const fats = asRecord(calculatedMacros?.fats);
  const method = asText(payload?.method);
  const protocol = asText(payload?.protocol);

  return {
    entryId: entry?.id,
    recordedAt: iso(entry?.occurredAt),
    basalMetabolicRateKcal: asNumber(payload?.basalMetabolicRateKcal),
    totalEnergyExpenditureKcal: asNumber(
      payload?.totalEnergyExpenditureKcal,
    ),
    targetCaloriesKcal: asNumber(payload?.finalCaloriesKcal),
    proteinGrams: asNumber(protein?.grams),
    carbohydratesGrams: asNumber(carbohydrates?.grams),
    fatsGrams: asNumber(fats?.grams),
    calculationMethod: [method, protocol]
      .filter((value): value is string => Boolean(value))
      .join(" · ") || undefined,
  };
}

function mealPlanReference(entry: PreviousClinicalEntrySnapshot | undefined) {
  const payload = asRecord(entry?.mealPlan?.content) ?? asRecord(entry?.payload);
  const storedPlan = parseStoredMealPlanPayload(entry?.mealPlan?.content);
  return {
    entryId: entry?.id,
    prescribedAt: iso(entry?.occurredAt),
    title: entry?.mealPlan?.title,
    meals: storedPlan
      ? storedPlan.meals.map(storedMealSummary)
      : asArray(payload?.meals).flatMap((value) => {
          const summary = mealSummary(value);
          return summary ? [summary] : [];
        }),
    prescriptionMeals: (storedPlan?.meals ?? []).map((meal) => ({
      id: meal.id,
      name: meal.name,
      time: meal.time ?? "",
      items: meal.items.map(previousMealPlanItemReference),
    })),
  };
}

function bodyAssessmentReference(
  entry: PreviousClinicalEntrySnapshot | undefined,
) {
  const records = entry
    ? [
        {
          label: "Antropometria",
          date: entry.physicalAssessment?.assessedAt,
          value: entry.physicalAssessment?.observations,
          notes: entry.physicalAssessment?.notes,
        },
        {
          label: "Bioimpedância",
          date: entry.bioimpedance?.measuredAt,
          value: entry.bioimpedance?.measurements,
          notes: entry.bioimpedance?.notes,
        },
        {
          label: "Perimetria",
          date: entry.perimetry?.measuredAt,
          value: entry.perimetry?.measurements,
          notes: entry.perimetry?.notes,
        },
        {
          label: "Avaliação postural",
          date: entry.posturalAssessment?.assessedAt,
          value: entry.posturalAssessment?.observations,
          notes: entry.posturalAssessment?.notes,
        },
      ]
    : [];
  const assessedAt = records
    .map((record) => iso(record.date))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const measurements = records.flatMap((record) => {
    const lines = primitiveMeasurementLines(record.value).map(
      (line) => `${record.label} · ${line}`,
    );
    const notes = asText(record.notes);
    return notes
      ? [...lines, `${record.label} · Observações: ${notes}`]
      : lines;
  });

  return { entryId: entry?.id, assessedAt, measurements };
}

export function buildPreviousClinicalReference(input: {
  readonly lastConsultationAt?: Date | string;
  readonly entries: readonly PreviousClinicalEntrySnapshot[];
}): PreviousClinicalReference {
  const clinical = input.entries.find(
    (entry) => entry.type === "CLINICAL_ANAMNESIS",
  );
  const strategy = input.entries.find(
    (entry) =>
      entry.type === "NUTRITION_STRATEGY" &&
      (entry.status === undefined ||
        entry.status === "FINALIZED" ||
        entry.status === "SUPERSEDED"),
  );
  const mealPlan = input.entries.find(
    (entry) =>
      entry.type === "MEAL_PLAN" &&
      (entry.status === undefined ||
        entry.status === "FINALIZED" ||
        entry.status === "SUPERSEDED"),
  );
  const assessment = input.entries.find(
    (entry) => entry.type === "ASSESSMENT",
  );
  const previousClinical = clinicalReference(clinical);
  const strategyPayload = asRecord(strategy?.payload);
  const clinicalObservations = uniqueReferenceTexts([
    ...previousClinical.observations,
    asText(strategyPayload?.clinicalObservations),
  ]);

  return {
    lastConsultationAt: iso(input.lastConsultationAt),
    complaint: previousClinical.complaint,
    objectives: previousClinical.objectives,
    diagnosesAndConditions: previousClinical.diagnoses,
    medicationsAndSupplements:
      previousClinical.medicationsAndSupplements,
    allergiesAndRestrictions: previousClinical.allergiesAndRestrictions,
    clinicalObservations,
    mealPlan: mealPlanReference(mealPlan),
    energy: energyReference(strategy),
    bodyAssessment: bodyAssessmentReference(assessment),
  };
}
