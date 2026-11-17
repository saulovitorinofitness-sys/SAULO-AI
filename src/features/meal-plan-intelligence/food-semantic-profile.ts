import {
  normalizeFoodSearchText,
  type ProfessionalFood,
} from "@/features/food-database";

export type SemanticMealRole =
  | "BREAKFAST"
  | "SNACK"
  | "LUNCH"
  | "DINNER"
  | "MEAL";
export type FoodMealFunction =
  | "REGIONAL_BASE"
  | "STAPLE"
  | "LEGUME"
  | "PROTEIN"
  | "FRUIT"
  | "DAIRY"
  | "VEGETABLE"
  | "BEVERAGE"
  | "COMPLEMENT"
  | "SEASONING";
export type FoodMealPlacement =
  | "MAIN"
  | "SIDE"
  | "COMPLEMENT"
  | "SEASONING";

export interface FoodSemanticProfile {
  readonly group: string;
  readonly functions: readonly FoodMealFunction[];
  readonly compatibleMeals: readonly SemanticMealRole[];
  readonly culture: "CARIRI_CEARA" | "BRAZIL_COMMON";
  readonly frequency: "HABITUAL" | "EVENTUAL";
  readonly preparation: string;
  readonly householdMeasure: string;
  readonly minimumGrams: number;
  readonly usualGrams: number;
  readonly maximumGrams: number;
  readonly stepGrams: number;
  readonly combinesWith: readonly FoodMealFunction[];
  readonly clinicalRestrictions: readonly string[];
  readonly accessibility: "LOW_COST" | "MODERATE" | "HIGH_COST";
  readonly placement: FoodMealPlacement;
  readonly automaticEligible: boolean;
  readonly rejectionReason?: string;
}

const allMeals: readonly SemanticMealRole[] = [
  "BREAKFAST",
  "SNACK",
  "LUNCH",
  "DINNER",
  "MEAL",
];

function includesAny(value: string, markers: readonly string[]) {
  return markers.some((marker) => value.includes(marker));
}

function profile(
  food: ProfessionalFood,
  patch: Omit<FoodSemanticProfile, "group" | "clinicalRestrictions">,
): FoodSemanticProfile {
  return {
    group: food.foodGroup,
    clinicalRestrictions: [],
    ...patch,
  };
}

export function classifyFoodSemantics(food: ProfessionalFood): FoodSemanticProfile {
  const name = normalizeFoodSearchText(food.officialName);
  const group = normalizeFoodSearchText(food.foodGroup);
  const preparation = normalizeFoodSearchText(
    `${food.preparationState ?? ""} ${food.preparationMethod ?? ""} ${food.foodState ?? ""}`,
  );
  const commercial =
    /®|™|\d+\s*(?:x\s*)?\d*\s?(g|ml)\b/iu.test(food.officialName) ||
    includesAny(name, ["marca ", "sabor artificial"]);
  const driedOrPowdered = includesAny(name, [
    "desidratad",
    "liofilizad",
    "fruta seca",
    "damasco seco",
    "ameixa seca",
    "em po",
  ]);
  const gratedCheese =
    includesAny(name, ["parmesao", "queijo ralado"]) ||
    (name.includes("queijo") && name.includes("ralad"));
  const highlyProcessed = includesAny(name, [
    "doce em barra",
    "doce em pasta",
    "geleia",
    "doce em calda",
    "em calda",
    "empada",
    "salgad",
    "nugget",
    "hamburguer",
    "linguica",
    "salsicha",
    "presunto",
    "peito de peru",
    "mistura para",
    "instantane",
  ]);
  const unsuitablePartOrDerivative = includesAny(name, [
    "casca",
    "semente",
    "broto de feijao",
    "com manteiga",
    "com oleo",
    "c/ pele",
    "com pele",
    "codorna",
  ]);
  const rawUnsuitable =
    includesAny(name, ["jilo cru", "jilo, cru", "carne crua", "frango cru"]) ||
    includesAny(preparation, ["cru", "crua"]);
  if (
    commercial ||
    driedOrPowdered ||
    gratedCheese ||
    highlyProcessed ||
    unsuitablePartOrDerivative ||
    rawUnsuitable
  ) {
    return profile(food, {
      functions: gratedCheese ? ["COMPLEMENT"] : [],
      compatibleMeals: [],
      culture: "BRAZIL_COMMON",
      frequency: "EVENTUAL",
      preparation: preparation || "Não adequada para sugestão automática",
      householdMeasure: "Não aplicável automaticamente",
      minimumGrams: 0,
      usualGrams: 0,
      maximumGrams: 0,
      stepGrams: 1,
      combinesWith: [],
      accessibility: "MODERATE",
      placement: gratedCheese ? "COMPLEMENT" : "SIDE",
      automaticEligible: false,
      rejectionReason: commercial
        ? "Marca ou apresentação comercial não deve ser recomendada automaticamente."
        : driedOrPowdered
          ? "Alimento seco, desidratado ou em pó não pode formar a base automática da refeição."
          : gratedCheese
            ? "Queijo ralado é complemento, não base automática de refeição."
            : highlyProcessed
              ? "Alimento ultraprocessado ou preparação comercial não deve ser padrão automático."
              : unsuitablePartOrDerivative
                ? "Parte ou derivado não usual não deve ser sugerido como alimento padrão."
            : "Forma crua incompatível com sugestão automática.",
    });
  }

  if (includesAny(name, ["cuscuz", "tapioca"]) && !includesAny(name, ["bolo", "pudim", "farinha"])) {
    return profile(food, {
      functions: ["REGIONAL_BASE", "STAPLE"],
      compatibleMeals: ["BREAKFAST", "DINNER"],
      culture: "CARIRI_CEARA",
      frequency: "HABITUAL",
      preparation: "Preparado para consumo",
      householdMeasure: "porção/xícara",
      minimumGrams: 80,
      usualGrams: 120,
      maximumGrams: 180,
      stepGrams: 20,
      combinesWith: ["PROTEIN", "DAIRY", "FRUIT"],
      accessibility: "LOW_COST",
      placement: "MAIN",
      automaticEligible: true,
    });
  }
  if (group.includes("ovos") && includesAny(name, ["cozid", "mexid", "omelete"])) {
    return profile(food, {
      functions: ["PROTEIN"],
      compatibleMeals: ["BREAKFAST", "DINNER"],
      culture: "CARIRI_CEARA",
      frequency: "HABITUAL",
      preparation: "Cozido ou preparado",
      householdMeasure: "unidade",
      minimumGrams: 50,
      usualGrams: 100,
      maximumGrams: 150,
      stepGrams: 50,
      combinesWith: ["REGIONAL_BASE", "STAPLE", "FRUIT"],
      accessibility: "LOW_COST",
      placement: "MAIN",
      automaticEligible: true,
    });
  }
  if (group.includes("frutas") && !includesAny(name, ["suco", "nectar", "acucar"])) {
    return profile(food, {
      functions: ["FRUIT"],
      compatibleMeals: ["BREAKFAST", "SNACK"],
      culture: includesAny(name, ["banana", "mamao", "manga", "goiaba", "melancia"])
        ? "CARIRI_CEARA"
        : "BRAZIL_COMMON",
      frequency: "HABITUAL",
      preparation: "In natura",
      householdMeasure: "unidade/fatia/porção",
      minimumGrams: 80,
      usualGrams: 120,
      maximumGrams: 180,
      stepGrams: 20,
      combinesWith: ["DAIRY", "REGIONAL_BASE", "STAPLE"],
      accessibility: "LOW_COST",
      placement: "COMPLEMENT",
      automaticEligible: true,
    });
  }
  if (
    group.includes("leite") &&
    ((name.includes("iogurte") && name.includes("natural")) ||
      (name.includes("leite") && includesAny(name, ["integral", "desnatado"])))
  ) {
    return profile(food, {
      functions: ["DAIRY", "PROTEIN"],
      compatibleMeals: ["BREAKFAST", "SNACK"],
      culture: "BRAZIL_COMMON",
      frequency: "HABITUAL",
      preparation: "Pronto para consumo",
      householdMeasure: name.includes("iogurte") ? "pote" : "copo",
      minimumGrams: 120,
      usualGrams: name.includes("iogurte") ? 170 : 200,
      maximumGrams: 250,
      stepGrams: 10,
      combinesWith: ["FRUIT", "STAPLE"],
      accessibility: name.includes("grego") ? "HIGH_COST" : "MODERATE",
      placement: "MAIN",
      automaticEligible: true,
    });
  }
  if (group.includes("cereais") && includesAny(name, ["arroz"]) && name.includes("cozid")) {
    return profile(food, {
      functions: ["STAPLE"],
      compatibleMeals: ["LUNCH", "DINNER"],
      culture: "CARIRI_CEARA",
      frequency: "HABITUAL",
      preparation: "Cozido",
      householdMeasure: "colher de servir",
      minimumGrams: 70,
      usualGrams: 100,
      maximumGrams: 160,
      stepGrams: 10,
      combinesWith: ["LEGUME", "PROTEIN", "VEGETABLE"],
      accessibility: "LOW_COST",
      placement: "MAIN",
      automaticEligible: true,
    });
  }
  if (group.includes("leguminosas") && includesAny(name, ["feijao"]) && name.includes("cozid")) {
    return profile(food, {
      functions: ["LEGUME"],
      compatibleMeals: ["LUNCH", "DINNER"],
      culture: "CARIRI_CEARA",
      frequency: "HABITUAL",
      preparation: "Cozido com caldo e grãos",
      householdMeasure: "concha",
      minimumGrams: 60,
      usualGrams: 100,
      maximumGrams: 150,
      stepGrams: 10,
      combinesWith: ["STAPLE", "PROTEIN", "VEGETABLE"],
      accessibility: "LOW_COST",
      placement: "SIDE",
      automaticEligible: true,
    });
  }
  if (
    includesAny(group, ["carnes", "pescados"]) &&
    includesAny(name, ["frango", "carne", "peixe", "tilapia", "sardinha"]) &&
    includesAny(name, ["cozid", "grelhad", "assad", "ensopad", "file", "filé"]) &&
    !includesAny(name, ["peito de peru", "presunto", "embutid", "coracao"])
  ) {
    return profile(food, {
      functions: ["PROTEIN"],
      compatibleMeals: ["LUNCH", "DINNER"],
      culture: "BRAZIL_COMMON",
      frequency: "HABITUAL",
      preparation: "Cozido, grelhado, assado ou ensopado",
      householdMeasure: "filé/porção",
      minimumGrams: 70,
      usualGrams: 100,
      maximumGrams: 150,
      stepGrams: 10,
      combinesWith: ["STAPLE", "LEGUME", "VEGETABLE"],
      accessibility: includesAny(name, ["frango", "sardinha"]) ? "LOW_COST" : "MODERATE",
      placement: "MAIN",
      automaticEligible: true,
    });
  }
  if (includesAny(group, ["verduras", "hortalicas", "legumes"]) && !name.includes("cru")) {
    return profile(food, {
      functions: ["VEGETABLE"],
      compatibleMeals: ["LUNCH", "DINNER"],
      culture: "BRAZIL_COMMON",
      frequency: "HABITUAL",
      preparation: name.includes("cozid") ? "Cozido" : "Preparado como acompanhamento",
      householdMeasure: "colher de servir/porção",
      minimumGrams: 50,
      usualGrams: 80,
      maximumGrams: 150,
      stepGrams: 10,
      combinesWith: ["STAPLE", "LEGUME", "PROTEIN"],
      accessibility: "LOW_COST",
      placement: "SIDE",
      automaticEligible: true,
    });
  }
  if (includesAny(name, ["pao frances", "pao integral"])) {
    return profile(food, {
      functions: ["STAPLE"],
      compatibleMeals: ["BREAKFAST", "SNACK"],
      culture: "BRAZIL_COMMON",
      frequency: "HABITUAL",
      preparation: "Pronto para consumo",
      householdMeasure: "unidade/fatia",
      minimumGrams: 25,
      usualGrams: 50,
      maximumGrams: 100,
      stepGrams: 25,
      combinesWith: ["PROTEIN", "DAIRY", "FRUIT"],
      accessibility: "LOW_COST",
      placement: "MAIN",
      automaticEligible: true,
    });
  }

  return profile(food, {
    functions: [],
    compatibleMeals: allMeals,
    culture: "BRAZIL_COMMON",
    frequency: "EVENTUAL",
    preparation: preparation || "Não classificada",
    householdMeasure: "Não classificada",
    minimumGrams: 0,
    usualGrams: 0,
    maximumGrams: 0,
    stepGrams: 1,
    combinesWith: [],
    accessibility: "MODERATE",
    placement: "COMPLEMENT",
    automaticEligible: false,
    rejectionReason: "Alimento sem classificação culinária suficiente para sugestão automática.",
  });
}

export const MEAL_STRUCTURE: Readonly<
  Record<SemanticMealRole, readonly FoodMealFunction[]>
> = {
  BREAKFAST: ["REGIONAL_BASE", "PROTEIN", "FRUIT"],
  SNACK: ["FRUIT", "DAIRY"],
  LUNCH: ["STAPLE", "LEGUME", "PROTEIN", "VEGETABLE"],
  DINNER: ["STAPLE", "PROTEIN", "VEGETABLE"],
  MEAL: ["STAPLE", "PROTEIN", "VEGETABLE"],
};
