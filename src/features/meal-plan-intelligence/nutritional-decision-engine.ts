import {
  normalizeFoodSearchText,
  type ProfessionalFood,
} from "@/features/food-database";

import type { PatientContext } from "./patient-context-service";

export type FoodEligibilityStatus = "APROVADO" | "RESTRITO" | "BLOQUEADO";

export interface EligibleFood {
  readonly foodId: string;
  readonly name: string;
  readonly group: string;
  readonly status: FoodEligibilityStatus;
  readonly reason: string;
}

type ClinicalRuleKind = "ALLERGY" | "INTOLERANCE" | "RESTRICTION" | "REFUSAL";

interface ClinicalRule {
  readonly kind: ClinicalRuleKind;
  readonly original: string;
  readonly normalized: string;
}

const clinicalStopWords = new Set([
  "a",
  "alergia",
  "alergico",
  "alergica",
  "ao",
  "aos",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "intolerancia",
  "intolerante",
  "nao",
  "paciente",
  "para",
  "possui",
  "recusa",
  "recusado",
  "recusada",
  "restricao",
  "sem",
]);

const animalFoodGroups = new Set([
  "carnes e derivados",
  "pescados e frutos do mar",
]);

const animalFoodTerms = new Set([
  "atum",
  "bacon",
  "bovino",
  "camarao",
  "carne",
  "frango",
  "galinha",
  "linguica",
  "peixe",
  "peru",
  "porco",
  "presunto",
  "sardinha",
  "suino",
]);

const glutenFoodTerms = new Set([
  "aveia",
  "cevada",
  "centeio",
  "farinha",
  "macarrao",
  "pao",
  "trigo",
]);

function words(value: string) {
  return normalizeFoodSearchText(value).split(/[^a-z0-9]+/).filter(Boolean);
}

function foodWords(food: ProfessionalFood) {
  return new Set(
    words(
      [
        food.officialName,
        ...food.synonyms,
        food.category,
        food.foodGroup,
        food.preparationState,
        food.presentation,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  );
}

function includesAny(haystack: ReadonlySet<string>, needles: ReadonlySet<string>) {
  return [...needles].some((needle) => haystack.has(needle));
}

function isDairy(food: ProfessionalFood, tokens: ReadonlySet<string>) {
  const group = normalizeFoodSearchText(food.foodGroup);
  return (
    group === "leite e derivados" ||
    includesAny(tokens, new Set(["leite", "queijo", "iogurte", "coalhada", "requeijao", "manteiga"]))
  );
}

function isEgg(food: ProfessionalFood, tokens: ReadonlySet<string>) {
  return (
    normalizeFoodSearchText(food.foodGroup) === "ovos e derivados" ||
    tokens.has("ovo") ||
    tokens.has("ovos")
  );
}

function isGlutenSource(tokens: ReadonlySet<string>) {
  return includesAny(tokens, glutenFoodTerms);
}

function matchesRule(
  food: ProfessionalFood,
  tokens: ReadonlySet<string>,
  rule: ClinicalRule,
) {
  const ruleTokens = new Set(words(rule.normalized));
  if (ruleTokens.has("leite") || ruleTokens.has("lactose") || ruleTokens.has("laticinios")) {
    return isDairy(food, tokens);
  }
  if (ruleTokens.has("ovo") || ruleTokens.has("ovos")) return isEgg(food, tokens);
  if (ruleTokens.has("gluten")) return isGlutenSource(tokens);

  const meaningful = [...ruleTokens].filter(
    (token) => token.length >= 3 && !clinicalStopWords.has(token),
  );
  return meaningful.length > 0 && meaningful.every((token) => tokens.has(token));
}

function rules(kind: ClinicalRuleKind, values: readonly string[]) {
  return values
    .map((original) => ({
      kind,
      original: original.trim(),
      normalized: normalizeFoodSearchText(original),
    }))
    .filter((rule) => rule.original && !/^(nenhum|nenhuma|nega|sem restricoes)$/i.test(rule.normalized));
}

function hasMarker(values: readonly string[], markers: readonly string[]) {
  const text = normalizeFoodSearchText(values.join(" "));
  return markers.some((marker) => text.includes(normalizeFoodSearchText(marker)));
}

function isVegetarianFoodBlocked(food: ProfessionalFood, tokens: ReadonlySet<string>) {
  const group = normalizeFoodSearchText(food.foodGroup);
  if (group === "ovos e derivados" || group === "leite e derivados") return false;
  return (
    animalFoodGroups.has(group) ||
    includesAny(tokens, animalFoodTerms)
  );
}

function matchingPreference(
  food: ProfessionalFood,
  tokens: ReadonlySet<string>,
  preferences: readonly string[],
) {
  return preferences.find((preference) =>
    matchesRule(food, tokens, {
      kind: "RESTRICTION",
      original: preference,
      normalized: normalizeFoodSearchText(preference),
    }),
  );
}

function classifyFood(
  food: ProfessionalFood,
  context: PatientContext,
): EligibleFood {
  const tokens = foodWords(food);
  const clinical = context.clinical;
  const blockingRules = [
    ...rules("ALLERGY", clinical.allergies),
    ...rules("REFUSAL", clinical.refusedFoods),
  ];
  const restrictingRules = [
    ...rules("INTOLERANCE", clinical.intolerances),
    ...rules("RESTRICTION", clinical.restrictions),
  ];

  const blockingRule = blockingRules.find((rule) => matchesRule(food, tokens, rule));
  if (blockingRule) {
    const prefix = blockingRule.kind === "ALLERGY" ? "Alergia registrada" : "Alimento recusado";
    return {
      foodId: food.id,
      name: food.officialName,
      group: food.foodGroup,
      status: "BLOQUEADO",
      reason: `${prefix}: ${blockingRule.original}.`,
    };
  }

  const strategyMarkers = [
    String(context.nutritionStrategy.protocol),
    context.nutritionStrategy.observations,
    ...clinical.restrictions,
  ];
  const vegetarian = hasMarker(strategyMarkers, ["vegetariano", "vegetariana"]);
  if (vegetarian && isVegetarianFoodBlocked(food, tokens)) {
    return {
      foodId: food.id,
      name: food.officialName,
      group: food.foodGroup,
      status: "BLOQUEADO",
      reason: "Padrão alimentar vegetariano registrado.",
    };
  }

  const celiacDisease = hasMarker(clinical.pathologies, ["doenca celiaca", "celiaca", "celiaco"]);
  if (celiacDisease && isGlutenSource(tokens)) {
    return {
      foodId: food.id,
      name: food.officialName,
      group: food.foodGroup,
      status: "BLOQUEADO",
      reason: "Doença celíaca registrada.",
    };
  }

  const restrictingRule = restrictingRules.find((rule) => matchesRule(food, tokens, rule));
  if (restrictingRule) {
    const prefix = restrictingRule.kind === "INTOLERANCE" ? "Intolerância registrada" : "Restrição registrada";
    return {
      foodId: food.id,
      name: food.officialName,
      group: food.foodGroup,
      status: "RESTRITO",
      reason: `${prefix}: ${restrictingRule.original}.`,
    };
  }

  if (hasMarker(strategyMarkers, ["low fodmap", "baixo fodmap"])) {
    return {
      foodId: food.id,
      name: food.officialName,
      group: food.foodGroup,
      status: "RESTRITO",
      reason: "Protocolo low FODMAP exige validação específica do alimento.",
    };
  }

  if (!context.patient.objective.trim()) {
    return {
      foodId: food.id,
      name: food.officialName,
      group: food.foodGroup,
      status: "RESTRITO",
      reason: "Objetivo clínico não definido.",
    };
  }

  const preference = matchingPreference(food, tokens, clinical.preferredFoods);
  return {
    foodId: food.id,
    name: food.officialName,
    group: food.foodGroup,
    status: "APROVADO",
    reason: preference
      ? `Preferência registrada: ${preference}.`
      : "Sem restrições aplicáveis.",
  };
}

export const nutritionalDecisionEngine = {
  evaluate(patientContext: PatientContext): readonly EligibleFood[] {
    return patientContext.foodCatalog.foods.map((food) =>
      classifyFood(food, patientContext),
    );
  },
};
