import {
  isMealPlanFoodItem,
  type MealPlanRecordMeal,
} from "@/features/meal-plan/record";

import type {
  DeliverableShoppingItem,
  DeliverableShoppingList,
  ShoppingListCategory,
  ShoppingListPeriod,
} from "./contracts";

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function shoppingCategoryFor(
  foodName: string,
  foodGroup: string,
): ShoppingListCategory {
  const name = normalized(foodName);
  const group = normalized(foodGroup);
  const value = `${name} ${group}`;
  if (/suplement|whey|creatina/.test(value)) return "Suplementos";
  if (/ovo/.test(value)) return "Ovos";
  if (/leite|iogurte|queijo|laticin/.test(value)) return "Laticínios";
  if (/carne|frango|peixe|pescado|bovino|suino|aves/.test(value)) {
    return "Açougue e peixaria";
  }
  if (/pao|padaria|torrada/.test(value)) return "Padaria";
  if (/feijao|lentilha|grao-de-bico|leguminosa/.test(value)) {
    return "Leguminosas";
  }
  if (/arroz|aveia|cereal|milho|trigo|macarrao|grao/.test(value)) {
    return "Cereais e grãos";
  }
  if (/\b(agua|suco|cafe|cha|bebida)s?\b/.test(name)) return "Bebidas";
  if (
    /\bfrutas?\b/.test(group) ||
    /\b(banana|maca|abacaxi|mamao|abacate|acerola)\b/.test(name)
  ) {
    return "Hortifruti";
  }
  if (/\b(agua|suco|cafe|cha|bebida)s?\b/.test(group)) return "Bebidas";
  if (/congelad/.test(value)) return "Congelados";
  if (/verdura|legume|hortalica/.test(value)) {
    return "Hortifruti";
  }
  if (/oleo|azeite|acucar|farinha|mercearia/.test(value)) return "Mercearia";
  return "Outros";
}

function daysFor(period: ShoppingListPeriod, customDays?: number) {
  if (period !== "CUSTOM") return period;
  return customDays && Number.isInteger(customDays) && customDays > 0
    ? customDays
    : 7;
}

function displayQuantity(value: number, unit: "g" | "ml" | "unit", measure?: string) {
  const formatter = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  });
  if (unit === "g" && value >= 1_000) {
    return `${formatter.format(value / 1_000)} kg`;
  }
  if (unit === "ml" && value >= 1_000) {
    return `${formatter.format(value / 1_000)} L`;
  }
  if (unit === "unit") {
    return `${formatter.format(value)} ${measure || "unidades"}`;
  }
  return `${formatter.format(value)} ${unit}`;
}

function isCountableMeasure(measure: string) {
  return /\b(unidades?|fatias?|rodelas?|pedacos?|pedaços?|bandas?|porcoes?|porções?|colheres?|xicaras?|xícaras?|copos?|conchas?)\b/i.test(
    measure,
  );
}

export function createShoppingList(input: {
  readonly meals: readonly MealPlanRecordMeal[];
  readonly period?: ShoppingListPeriod;
  readonly customDays?: number;
  readonly includeSubstitutions?: boolean;
}): DeliverableShoppingList {
  const period = input.period ?? 7;
  const days = daysFor(period, input.customDays);
  const consolidated = new Map<string, DeliverableShoppingItem>();

  for (const meal of input.meals) {
    for (const food of meal.items) {
      if (!isMealPlanFoodItem(food)) continue;
      if (!food.catalogFoodId || !food.description.trim()) continue;
      const prescribedUnit = food.prescribedUnit ?? "g";
      const countable = isCountableMeasure(food.householdMeasure);
      const baseQuantity = countable
        ? food.quantity
        : (food.prescribedAmount ?? food.grams);
      if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) continue;
      const unit: "g" | "ml" | "unit" = countable
        ? "unit"
        : prescribedUnit;
      const measureLabel = countable ? food.householdMeasure : undefined;
      const selectedMeasure = food.selectedIbgeMeasureId
        ? food.ibgeMeasureOptions?.find(
            (option) => option.id === food.selectedIbgeMeasureId,
          )
        : undefined;
      const preparationName = selectedMeasure?.preparationName.trim() || undefined;
      const key = `${food.catalogFoodId}:${unit}:${normalized(measureLabel ?? "")}:${food.selectedIbgeMeasureId ?? ""}`;
      const existing = consolidated.get(key);
      const quantity = baseQuantity * days + (existing?.quantity ?? 0);
      const sourceMealIds = Array.from(
        new Set([...(existing?.sourceMealIds ?? []), meal.id]),
      );
      consolidated.set(key, {
        id: existing?.id ?? `shopping:${key}`,
        catalogFoodId: food.catalogFoodId,
        name: food.description,
        category: shoppingCategoryFor(food.description, food.foodGroup),
        quantity,
        unit:
          unit === "g" && quantity >= 1_000
            ? "kg"
            : unit === "ml" && quantity >= 1_000
              ? "L"
              : unit,
        measureLabel,
        preparationName,
        displayQuantity: displayQuantity(quantity, unit, measureLabel),
        sourceMealIds,
        alreadyAtHome: false,
        excluded: false,
        manuallyEdited: false,
      });
    }
  }

  return {
    period,
    customDays: period === "CUSTOM" ? days : undefined,
    days,
    includeSubstitutions: input.includeSubstitutions ?? false,
    items: [...consolidated.values()].sort(
      (left, right) =>
        left.category.localeCompare(right.category, "pt-BR") ||
        left.name.localeCompare(right.name, "pt-BR"),
    ),
  };
}
