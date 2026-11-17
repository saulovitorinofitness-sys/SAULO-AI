import type { ProfessionalFood } from "@/features/food-database";

import type {
  LocalDatabaseRecallFood,
  PreviousMealPlanItemReference,
  PreviousMealPlanReference,
  ReturnRecall24Hours,
  ReturnRecallFood,
  ReturnRecallFoodNutrients,
  ReturnRecallItem,
  ReturnRecallMeasureOption,
  UnselectedRecallFood,
} from "./contracts";

type ConfirmedMeasure = {
  readonly id: string;
  readonly label: string;
  readonly measureName: string;
  readonly amountPerMeasure: number;
  readonly unit: "g" | "ml";
  readonly source: string;
};

const PREPARATION_PATTERN =
  /\b(cru|crua|cozid[oa]s?|assad[oa]s?|grelhad[oa]s?|frit[oa]s?|refogad[oa]s?|ao vapor|torrad[oa]s?|defumad[oa]s?|desidratad[oa]s?)\b/i;

function coreNutrientsAreAvailable(
  nutrients: ProfessionalFood["nutrients"],
) {
  return Boolean(
    nutrients &&
      [
        nutrients.energyKcal,
        nutrients.proteinGrams,
        nutrients.carbohydratesGrams,
        nutrients.fatsGrams,
      ].every((value) => typeof value === "number" && Number.isFinite(value)),
  );
}

export function recallNutrientsFromCatalog(
  food: ProfessionalFood,
): ReturnRecallFoodNutrients | undefined {
  if (!food.nutrients) return undefined;
  return {
    energyKcal: food.nutrients.energyKcal,
    proteinGrams: food.nutrients.proteinGrams,
    carbohydratesGrams: food.nutrients.carbohydratesGrams,
    fatsGrams: food.nutrients.fatsGrams,
    fiberGrams: food.nutrients.fiberGrams,
    sodiumMg: food.nutrients.sodiumMg,
  };
}

export function officialFoodPreparation(food: Pick<
  ProfessionalFood,
  "officialName" | "preparationState" | "preparationMethod" | "foodState"
>) {
  const explicit = [
    food.preparationState,
    food.preparationMethod,
    food.foodState,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (explicit.length) return explicit.join(" · ");
  const match = food.officialName.match(PREPARATION_PATTERN);
  return match?.[0];
}

export function officialNameAlreadyDefinesPreparation(name: string) {
  return PREPARATION_PATTERN.test(name);
}

export function createUnselectedRecallFood(id: string): UnselectedRecallFood {
  return {
    id,
    source: "UNSELECTED",
    name: "",
    unit: "",
    preparation: "",
    brand: "",
    observations: "",
    compositionStatus: "UNSELECTED",
  };
}

export function createLocalRecallFoodFromCatalog(
  food: ProfessionalFood,
  current: ReturnRecallFood,
): LocalDatabaseRecallFood {
  const nutrients = recallNutrientsFromCatalog(food);
  const referenceUnit = food.referenceServingUnit === "ml" ? "ml" : "g";
  const officialPreparation = officialFoodPreparation(food);

  return {
    id: current.id,
    source: "LOCAL_DATABASE",
    catalogFoodId: food.id,
    catalogSource: food.source.name,
    catalogSourceKind: food.source.kind,
    catalogSourceCode: food.sourceCode,
    name: food.officialName,
    quantity: current.quantity,
    unit: referenceUnit,
    measureAmountPerUnit: 1,
    measureUnit: referenceUnit,
    measureSource: "Medida técnica",
    nutritionReferenceAmount: 100,
    nutritionReferenceUnit: referenceUnit,
    officialPreparation,
    preparation: current.preparation,
    preparationOption: current.preparationOption,
    brand: current.brand,
    observations: current.observations,
    previousPlanComparison: current.previousPlanComparison,
    compositionStatus: coreNutrientsAreAvailable(food.nutrients)
      ? "AVAILABLE"
      : "UNAVAILABLE",
    nutrientsPer100g: nutrients,
  };
}

export function createRecallFromPreviousPlan(
  previousPlan: PreviousMealPlanReference,
  createId: () => string,
): ReturnRecall24Hours {
  if (!previousPlan.entryId) {
    return {
      dayType: "NOT_INFORMED",
      referenceDate: "",
      meals: [],
      water: "",
      beverages: "",
      alcohol: "",
      supplements: "",
    };
  }
  const sourcePlanEntryId = previousPlan.entryId;

  function createRecallItem(
    item: PreviousMealPlanItemReference,
    sourceMealId: string,
  ): ReturnRecallItem {
    if (item.itemType === "RECIPE") {
      return {
        id: createId(),
        itemType: "RECIPE",
        source: "RECIPE",
        recipeId: item.recipeId,
        recipeTitle: item.recipeTitle,
        recipeNutritionSnapshotId: item.recipeNutritionSnapshotId,
        recipeNutritionSnapshotVersion: item.recipeNutritionSnapshotVersion,
        prescribedPortion: item.portion,
        consumedServings: null,
        nutritionCompleteness: item.nutritionCompleteness,
        snapshotNutrients: item.snapshotNutrients,
        prescribedNutrients: item.prescribedNutrients,
        missingNutrients: item.missingNutrients,
        previousPlanComparison: {
          sourcePlanEntryId,
          sourceMealId,
          sourceRecipeItemId: item.id,
          status: "",
        },
        observations: "",
      };
    }
    return {
      id: createId(),
      source: "LOCAL_DATABASE",
      catalogFoodId: item.catalogFoodId,
      catalogSource: item.catalogSource,
      catalogSourceKind: item.catalogSourceKind,
      catalogSourceCode: item.catalogSourceCode,
      name: item.name,
      quantity: item.quantity,
      unit: item.householdMeasure,
      householdMeasureId: item.selectedMeasureId,
      measureAmountPerUnit: item.measureAmountPerUnit,
      measureUnit: item.prescribedUnit,
      measureSource: "Plano alimentar anterior",
      nutritionReferenceAmount: 100,
      nutritionReferenceUnit: item.prescribedUnit,
      officialPreparation: item.preparation,
      preparation: item.preparation ?? "",
      brand: "",
      observations: "",
      compositionStatus: "AVAILABLE",
      nutrientsPer100g: item.nutrientsPer100g,
      previousPlanComparison: {
        sourcePlanEntryId,
        sourceMealId,
        sourceFoodId: item.id,
        prescribedFoodName: item.name,
        prescribedQuantity: item.quantity,
        prescribedMeasure: item.householdMeasure,
        prescribedAmount: item.prescribedAmount,
        prescribedUnit: item.prescribedUnit,
        status: "",
      },
    };
  }

  return {
    dayType: "NOT_INFORMED",
    referenceDate: "",
    meals: previousPlan.prescriptionMeals.map((meal) => {
      const base = {
        id: createId(),
        time: meal.time,
        name: meal.name,
        observations: "",
      };
      if (meal.items) {
        return {
          ...base,
          items: meal.items.map((item) => createRecallItem(item, meal.id)),
        };
      }
      return {
        ...base,
        foods: meal.foods.map((food) => {
          const recallItem = createRecallItem(food, meal.id);
          if (recallItem.source === "RECIPE") {
            throw new Error("Referência legada de alimento contém receita.");
          }
          return recallItem;
        }),
      };
    }),
    water: "",
    beverages: "",
    alcohol: "",
    supplements: "",
  };
}

export function recallMeasureOptions(
  food: Pick<LocalDatabaseRecallFood, "nutritionReferenceUnit">,
  confirmed: readonly ConfirmedMeasure[],
): readonly ReturnRecallMeasureOption[] {
  const technicalUnit = food.nutritionReferenceUnit === "ml" ? "ml" : "g";
  return [
    {
      id: "TECHNICAL",
      label: technicalUnit === "ml" ? "Mililitros (ml)" : "Gramas (g)",
      measureName: technicalUnit,
      amountPerMeasure: 1,
      unit: technicalUnit,
      source: "Medida técnica",
      technical: true,
    },
    ...confirmed.map((option) => ({
      id: option.id,
      label: option.label,
      measureName: option.measureName,
      amountPerMeasure: option.amountPerMeasure,
      unit: option.unit,
      source: option.source,
      technical: false,
    })),
  ];
}

export function selectRecallMeasure(
  food: LocalDatabaseRecallFood,
  option: ReturnRecallMeasureOption,
): LocalDatabaseRecallFood {
  return {
    ...food,
    unit: option.measureName,
    householdMeasureId: option.technical ? undefined : option.id,
    gramsPerUnit: undefined,
    measureAmountPerUnit: option.amountPerMeasure,
    measureUnit: option.unit,
    measureSource: option.source,
  };
}
