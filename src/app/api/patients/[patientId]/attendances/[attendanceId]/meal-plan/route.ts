import { NextResponse } from "next/server";

import {
  calculatePersistedMealPlanTotals,
  mealPlanRepository,
} from "@/features/meal-plan/repository";
import { FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT } from "@/features/meal-plan/adequacy-engine";
import {
  calculatePrescribedRecipeNutrients,
  formatRecipePortionDescription,
} from "@/features/meal-plan/nutrition-calculations";
import {
  isMealPlanFoodItem,
  isMealPlanRecipeItem,
  mealPlanClinicalJustificationSchema,
  mapMealPlanRecipeNutrients,
  parseMealPlanRecordDraft,
  type MealPlanRecipeNutrients,
  type MealPlanRecordDraft,
  type MealPlanRecordRecipe,
} from "@/features/meal-plan/record";
import {
  canonicalizeMealPlanDraftFoods,
  diagnoseMealPlanDraftFoodCanonicalization,
} from "@/features/meal-plan/food-snapshot";
import {
  createNutritionalEquivalenceContext,
  isFoodCompatibleWithClinicalContext,
} from "@/features/meal-plan/substitution-engine";
import { nutritionClinicalPanelRepository } from "@/features/nutrition-strategy/clinical-panel-repository";
import { nutritionStrategyInheritanceService } from "@/features/nutrition-strategy/inheritance-service";
import { foodRepository } from "@/features/food-database/repository";
import type { FoodNutrientForms } from "@/features/food-database/contracts";
import { householdMeasureRepository } from "@/features/food-database/household-measure-repository";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import {
  optionalPatientContextFields,
  patientContextService,
} from "@/features/meal-plan-intelligence/patient-context-service";
import { nutritionalDecisionEngine } from "@/features/meal-plan-intelligence/nutritional-decision-engine";
import {
  smartPlanDraftGenerator,
  type SmartPlanFoodComposition,
} from "@/features/meal-plan-intelligence/smart-plan-draft-generator";
import {
  mealPlanMealsToSmartPlanDraft,
  smartPlanDraftMealToMealPlanMeal,
  smartPlanDraftToMealPlanMeals,
} from "@/features/meal-plan-intelligence/smart-plan-draft-meal-plan-adapter";
import {
  adjustPreviousPlanMeals,
  inheritMissingMealSchedules,
} from "@/features/meal-plan-intelligence/return-plan-adjustment";
import { canAccess, mvpService } from "@/features/mvp";
import { resolveDevelopmentAccess } from "@/features/development-session";
import {
  ClinicContextError,
  resolveClinicRecipesContext,
} from "@/features/recipes/clinic-context";
import {
  RecipeServiceError,
  recipeService,
  type RecipeNutritionSnapshotView,
} from "@/features/recipes/service";
import { parseRecipeContentSnapshot } from "@/features/recipes/recipe-content-snapshot";
import {
  calculateMealPlanTargetDeviations,
  evaluateMealPlanCompletion,
  mealPlanContentFingerprint,
  mealPlanTargetDeviationFingerprint,
  targetDeviationAuthorizationMatches,
} from "@/features/meal-plan/completion-policy";
import { selectDietaryReferences } from "@/features/meal-plan/dietary-reference";

const MAX_CURRENT_COMPOSITION_MEALS = 12;
const MAX_CURRENT_COMPOSITION_FOODS_PER_MEAL = 30;

const mealPlanRecipeNutrientKeys = [
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

const snapshotStateKeyByMealPlanNutrient = {
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
} as const satisfies Readonly<
  Record<keyof MealPlanRecipeNutrients, string>
>;

class MealPlanRecipeValidationError extends Error {
  constructor(
    readonly code:
      | "RECIPE_NOT_ACCESSIBLE"
      | "RECIPE_SNAPSHOT_NOT_FOUND"
      | "RECIPE_SNAPSHOT_MISMATCH"
      | "RECIPE_SNAPSHOT_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "MealPlanRecipeValidationError";
  }
}

function finiteNonnegativeSnapshotValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new MealPlanRecipeValidationError(
      "RECIPE_SNAPSHOT_INVALID",
      "O snapshot nutricional da receita possui valor incompatível.",
    );
  }
  return numeric;
}

function snapshotNutrients(
  snapshot: RecipeNutritionSnapshotView,
): MealPlanRecipeNutrients {
  return mapMealPlanRecipeNutrients((key) =>
    finiteNonnegativeSnapshotValue(snapshot[key]),
  );
}

function snapshotPartialNutrients(
  snapshot: RecipeNutritionSnapshotView,
): readonly (keyof MealPlanRecipeNutrients)[] {
  const additional = snapshot.additionalNutrients;
  if (!isUnknownRecord(additional)) return [];
  const states = additional.nutrientStates;
  if (!isUnknownRecord(states)) return [];
  return mealPlanRecipeNutrientKeys.filter(
    (key) => states[snapshotStateKeyByMealPlanNutrient[key]] === "PARTIAL",
  );
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function snapshotNutrientForms(snapshot: RecipeNutritionSnapshotView): FoodNutrientForms | undefined {
  const additional = snapshot.additionalNutrients;
  if (!isUnknownRecord(additional) || !isUnknownRecord(additional.nutrientForms)) return undefined;
  const forms = additional.nutrientForms;
  if (
    !["RAE", "RE", "RETINOL", "UNSPECIFIED"].includes(String(forms.vitaminAMcg)) ||
    !["DFE", "FOOD_FOLATE", "FOLIC_ACID", "UNSPECIFIED"].includes(String(forms.folateMcg))
  ) return undefined;
  return forms as unknown as FoodNutrientForms;
}

function validatedServingSize(
  snapshot: RecipeNutritionSnapshotView,
  recipeServings: number,
) {
  const finalYieldAmount = finiteNonnegativeSnapshotValue(
    snapshot.finalYieldAmount,
  );
  const servingSize = finiteNonnegativeSnapshotValue(snapshot.servingSize);
  if (
    finalYieldAmount === null ||
    finalYieldAmount <= 0 ||
    servingSize === null ||
    servingSize <= 0 ||
    snapshot.finalYieldUnit !== snapshot.servingSizeUnit ||
    snapshot.servingSizeUnit === null ||
    !["GRAM", "MILLILITER"].includes(snapshot.servingSizeUnit) ||
    Math.abs(servingSize * recipeServings - finalYieldAmount) > 0.001
  ) {
    return undefined;
  }
  return {
    amount: servingSize,
    unit: snapshot.servingSizeUnit === "MILLILITER"
      ? ("ml" as const)
      : ("g" as const),
  };
}

async function canonicalizeMealPlanRecipes(
  draft: MealPlanRecordDraft,
): Promise<MealPlanRecordDraft> {
  const recipeItems = draft.meals.flatMap((meal) =>
    meal.items.filter(isMealPlanRecipeItem),
  );
  if (!recipeItems.length) return draft;

  const context = await resolveClinicRecipesContext("READ");
  const accessibleRecipes = new Map<
    string,
    Awaited<ReturnType<typeof recipeService.get>>
  >();

  for (const recipeId of new Set(recipeItems.map((item) => item.recipeId))) {
    try {
      accessibleRecipes.set(
        recipeId,
        await recipeService.get(context, recipeId),
      );
    } catch (error) {
      if (
        error instanceof RecipeServiceError &&
        ["NOT_FOUND", "FORBIDDEN"].includes(error.code)
      ) {
        throw new MealPlanRecipeValidationError(
          "RECIPE_NOT_ACCESSIBLE",
          "A receita informada não existe ou não está acessível nesta unidade.",
        );
      }
      throw error;
    }
  }

  const canonicalRecipe = (item: MealPlanRecordRecipe) => {
    const recipe = accessibleRecipes.get(item.recipeId);
    if (!recipe) {
      throw new MealPlanRecipeValidationError(
        "RECIPE_NOT_ACCESSIBLE",
        "A receita informada não existe ou não está acessível nesta unidade.",
      );
    }
    const snapshotById = recipe.nutritionSnapshots.find(
      (candidate) => candidate.id === item.recipeNutritionSnapshotId,
    );
    if (!snapshotById) {
      throw new MealPlanRecipeValidationError(
        "RECIPE_SNAPSHOT_NOT_FOUND",
        "O snapshot nutricional selecionado não existe ou não pertence à receita acessível.",
      );
    }
    if (
      snapshotById.recipeId !== item.recipeId ||
      snapshotById.version !== item.recipeNutritionSnapshotVersion
    ) {
      throw new MealPlanRecipeValidationError(
        "RECIPE_SNAPSHOT_MISMATCH",
        "O ID, a versão e o vínculo do snapshot nutricional não correspondem à receita selecionada.",
      );
    }

    const prescribedServings = item.portion.prescribedServings;
    const recipeServings = Number(snapshotById.servings);
    if (
      !Number.isFinite(prescribedServings) ||
      prescribedServings <= 0 ||
      !Number.isFinite(recipeServings) ||
      recipeServings <= 0
    ) {
      throw new MealPlanRecipeValidationError(
        "RECIPE_SNAPSHOT_INVALID",
        "A quantidade prescrita e o número de porções do snapshot devem ser positivos e finitos.",
      );
    }
    if (item.portion.recipeServings !== recipeServings) {
      throw new MealPlanRecipeValidationError(
        "RECIPE_SNAPSHOT_MISMATCH",
        "O número de porções informado não corresponde ao snapshot nutricional selecionado.",
      );
    }

    const trustedSnapshotNutrients = snapshotNutrients(snapshotById);
    const trustedRecipeContentSnapshot = parseRecipeContentSnapshot(
      snapshotById.recipeContentSnapshot,
    );
    const trustedPrescribedNutrients = calculatePrescribedRecipeNutrients(
      trustedSnapshotNutrients,
      prescribedServings,
      recipeServings,
    );
    const missingNutrients = mealPlanRecipeNutrientKeys.filter(
      (key) =>
        trustedSnapshotNutrients[key] === null ||
        trustedPrescribedNutrients[key] === null,
    );
    const partialNutrients = snapshotPartialNutrients(snapshotById).filter(
      (key) => trustedSnapshotNutrients[key] !== null,
    );
    const servingSize = validatedServingSize(snapshotById, recipeServings);

    return {
      ...item,
      recipeTitle: trustedRecipeContentSnapshot?.title ?? item.recipeTitle,
      recipeContentSnapshot: trustedRecipeContentSnapshot,
      nutrientForms: snapshotNutrientForms(snapshotById),
      portion: {
        ...item.portion,
        recipeServings,
        description: formatRecipePortionDescription(
          prescribedServings,
          recipeServings,
        ),
        servingSize,
      },
      nutritionCompleteness: missingNutrients.length || partialNutrients.length
        ? ("PARTIAL" as const)
        : ("COMPLETE" as const),
      snapshotNutrients: trustedSnapshotNutrients,
      prescribedNutrients: trustedPrescribedNutrients,
      missingNutrients,
      partialNutrients,
    } satisfies MealPlanRecordRecipe;
  };

  return {
    ...draft,
    meals: draft.meals.map((meal) => ({
      ...meal,
      items: meal.items.map((item) =>
        isMealPlanRecipeItem(item) ? canonicalRecipe(item) : item,
      ),
    })),
  };
}

function foodOnlyMealPlanDraft(
  draft: MealPlanRecordDraft,
): MealPlanRecordDraft {
  return {
    ...draft,
    meals: draft.meals.map((meal) => ({
      ...meal,
      items: meal.items.filter(isMealPlanFoodItem),
    })),
  };
}

function recomposeMealPlanItems(
  validatedDraft: MealPlanRecordDraft,
  canonicalFoodDraft: MealPlanRecordDraft,
): MealPlanRecordDraft | null {
  const canonicalMealsById = new Map(
    canonicalFoodDraft.meals.map((meal) => [meal.id, meal] as const),
  );
  const meals = validatedDraft.meals.map((meal) => {
    const canonicalMeal = canonicalMealsById.get(meal.id);
    if (!canonicalMeal) return null;

    const canonicalFoodsById = new Map(
      canonicalMeal.items
        .filter(isMealPlanFoodItem)
        .map((item) => [item.id, item] as const),
    );
    const expectedFoodCount = meal.items.filter(isMealPlanFoodItem).length;
    if (canonicalFoodsById.size !== expectedFoodCount) return null;

    const items = meal.items.map((item) =>
      isMealPlanRecipeItem(item) ? item : canonicalFoodsById.get(item.id),
    );
    if (items.some((item) => !item)) return null;

    return {
      ...meal,
      items: items as typeof meal.items,
    };
  });

  if (
    meals.some((meal) => !meal) ||
    canonicalMealsById.size !== validatedDraft.meals.length
  ) {
    return null;
  }

  return {
    ...validatedDraft,
    meals: meals as MealPlanRecordDraft["meals"],
  };
}

function recipeValidationResponse(error: unknown) {
  if (error instanceof MealPlanRecipeValidationError) {
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status: error.code === "RECIPE_NOT_ACCESSIBLE" ? 403 : 409 },
    );
  }
  if (error instanceof ClinicContextError) {
    return NextResponse.json(
      {
        code: "RECIPE_UNIT_ACCESS_FORBIDDEN",
        message: "Não foi possível autorizar o acesso às receitas desta unidade.",
      },
      { status: error.code === "AUTHENTICATION_REQUIRED" ? 401 : 403 },
    );
  }
  if (error instanceof RecipeServiceError) {
    return NextResponse.json(
      {
        code: "RECIPE_ACCESS_VALIDATION_FAILED",
        message: "Não foi possível validar o acesso à receita selecionada.",
      },
      { status: error.code === "AUTHENTICATION_REQUIRED" ? 401 : 403 },
    );
  }
  return null;
}

function parseCurrentComposition(
  value: unknown,
): SmartPlanFoodComposition | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_CURRENT_COMPOSITION_MEALS
  ) {
    return null;
  }
  const composition: string[][] = [];
  let foodCount = 0;
  for (const mealFoodIds of value) {
    if (
      !Array.isArray(mealFoodIds) ||
      mealFoodIds.length > MAX_CURRENT_COMPOSITION_FOODS_PER_MEAL
    ) {
      return null;
    }
    const normalizedFoodIds: string[] = [];
    for (const foodId of mealFoodIds) {
      if (
        typeof foodId !== "string" ||
        !foodId.trim() ||
        foodId.length > 200
      ) {
        return null;
      }
      normalizedFoodIds.push(foodId.trim());
      foodCount += 1;
    }
    composition.push(normalizedFoodIds);
  }
  return foodCount > 0 ? composition : null;
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ patientId: string; attendanceId: string }>;
  },
) {
  const [{ patientId, attendanceId }, sessionAccess] = await Promise.all([
    params,
    mvpService.getSession(),
  ]);
  const access = resolveDevelopmentAccess(request, sessionAccess);
  if (!canAccess(access, "MEAL_PLAN", "UPDATE")) {
    return NextResponse.json(
      { message: "Seu perfil não permite gerar a prévia do Plano Alimentar." },
      { status: 403 },
    );
  }
  const body = (await request.json().catch(() => null)) as
    | {
        action?: unknown;
        mealIndex?: unknown;
        targetTotals?: unknown;
        previouslyUsedFoodIds?: unknown;
        currentComposition?: unknown;
      }
    | null;
  if (
    body?.action !== "GENERATE_ASSISTED_PREVIEW" &&
    body?.action !== "GENERATE_INITIAL_WITHOUT_RECALL" &&
    body?.action !== "REGENERATE_ASSISTED_MEAL"
  ) {
    return NextResponse.json(
      { message: "Ação inválida para o Plano Alimentar." },
      { status: 400 },
    );
  }
  const currentCompositionProvided = body.currentComposition !== undefined;
  const currentComposition = currentCompositionProvided
    ? parseCurrentComposition(body.currentComposition)
    : undefined;
  if (currentCompositionProvided && !currentComposition) {
    return NextResponse.json(
      {
        code: "INVALID_CURRENT_COMPOSITION",
        message:
          "currentComposition deve conter os IDs dos alimentos agrupados por índice de refeição.",
      },
      { status: 400 },
    );
  }
  if (
    currentCompositionProvided &&
    body.action === "REGENERATE_ASSISTED_MEAL"
  ) {
    return NextResponse.json(
      {
        code: "INVALID_CURRENT_COMPOSITION",
        message:
          "currentComposition é aceito somente na geração completa do Plano Inteligente.",
      },
      { status: 400 },
    );
  }

  try {
    const previousPlan = await mealPlanRepository.getLatestDeliveredForAttendanceMasterRecord(
      patientId,
      attendanceId,
    );
    const contextResult = await patientContextService.get(patientId, attendanceId, {
      allowMissingMealSchedules: Boolean(previousPlan),
    });
    if (!contextResult.success) {
      return NextResponse.json(
        {
          message:
            contextResult.pending[0]?.message ??
            "Os dados obrigatórios do Plano Inteligente não estão completos.",
          pending: contextResult.pending,
          optionalMissing: contextResult.optionalMissing,
        },
        { status: 409 },
      );
    }
    const inheritedPatientContext = previousPlan
      ? inheritMissingMealSchedules(
          contextResult.patientContext,
          previousPlan.meals,
        )
      : contextResult.patientContext;
    const patientContext =
      body.action === "GENERATE_INITIAL_WITHOUT_RECALL"
        ? {
            ...inheritedPatientContext,
            clinical: {
              ...inheritedPatientContext.clinical,
              habitualFoods: [],
              habitualIntakeBasis: "NOT_INFORMED" as const,
            },
          }
        : inheritedPatientContext;
    if (currentComposition) {
      if (
        currentComposition.length !==
        patientContext.nutritionStrategy.dailyDistribution.length
      ) {
        return NextResponse.json(
          {
            code: "INVALID_CURRENT_COMPOSITION",
            message:
              "currentComposition deve possuir exatamente uma lista de alimentos para cada refeição da Estratégia Nutricional.",
          },
          { status: 400 },
        );
      }
      const catalogFoodIds = new Set(
        patientContext.foodCatalog.foods.map((food) => food.id),
      );
      if (
        currentComposition.some((mealFoodIds) =>
          mealFoodIds.some((foodId) => !catalogFoodIds.has(foodId)),
        )
      ) {
        return NextResponse.json(
          {
            code: "INVALID_CURRENT_COMPOSITION",
            message:
              "currentComposition contém alimento que não pertence ao Banco Mestre disponível para este plano.",
          },
          { status: 400 },
        );
      }
    }
    const optionalMissing = optionalPatientContextFields(patientContext.clinical);
    const eligibleFoods = nutritionalDecisionEngine.evaluate(patientContext);
    if (body.action === "REGENERATE_ASSISTED_MEAL") {
      if (!Number.isInteger(body.mealIndex) || Number(body.mealIndex) < 0) {
        return NextResponse.json(
          { message: "Selecione uma refei\u00e7\u00e3o v\u00e1lida para regenerar." },
          { status: 400 },
        );
      }
      const rawTargets = body.targetTotals;
      const targetTotals = rawTargets && typeof rawTargets === "object" && !Array.isArray(rawTargets)
        ? rawTargets as {
            energyKcal: number;
            proteinGrams: number;
            carbohydratesGrams: number;
            fatsGrams: number;
          }
        : undefined;
      const previouslyUsedFoodIds = Array.isArray(body.previouslyUsedFoodIds)
        ? body.previouslyUsedFoodIds
            .filter((value): value is string => typeof value === "string")
            .slice(0, 20)
        : [];
      const generation = smartPlanDraftGenerator.regenerateMeal({
        patientContext,
        eligibleFoods,
        mealIndex: Number(body.mealIndex),
        targetTotals,
        previouslyUsedFoodIds,
      });
      if (!generation.success) {
        return NextResponse.json(
          {
            message: generation.pending[0]?.message ?? "N\u00e3o foi poss\u00edvel regenerar esta refei\u00e7\u00e3o.",
            pending: generation.pending,
          },
          { status: 409 },
        );
      }
      const meal = smartPlanDraftMealToMealPlanMeal(
        generation.smartPlanMeal,
        patientContext,
        Number(body.mealIndex),
      );
      if (!meal) {
        return NextResponse.json(
          { message: "A hip\u00f3tese foi calculada, mas cont\u00e9m alimento sem correspond\u00eancia can\u00f4nica." },
          { status: 409 },
        );
      }
      return NextResponse.json({
        meal,
        smartPlanMeal: generation.smartPlanMeal,
        notice: "Refei\u00e7\u00e3o regenerada como hip\u00f3tese \u2014 aguardando revis\u00e3o do nutricionista.",
      });
    }
    if (previousPlan && !currentComposition) {
      const currentPlan = await mealPlanRepository.get(patientId, attendanceId);
      const baseMeals =
        currentPlan?.sourcePlanEntryId === previousPlan.id
          ? currentPlan.meals
          : previousPlan.meals;
      const adjustment = adjustPreviousPlanMeals({
        context: patientContext,
        previousMeals: baseMeals,
        catalogFoods: patientContext.foodCatalog.foods,
        eligibleFoods,
      });
      if (!adjustment.success) {
        return NextResponse.json(
          {
            message: adjustment.message,
            pending: adjustment.missing.map((item) => ({
              field: "previousPlan",
              expectedSource: "Último Plano Alimentar válido",
              reason: item,
              message: adjustment.message,
            })),
          },
          { status: 409 },
        );
      }
      return NextResponse.json({
        meals: adjustment.meals,
        smartPlanDraft: mealPlanMealsToSmartPlanDraft(
          adjustment.meals,
          patientContext,
        ),
        optionalMissing,
        notice: adjustment.notice,
        sourcePlan: {
          id: previousPlan.id,
          attendanceId: previousPlan.attendanceId,
          revision: previousPlan.revision,
        },
      });
    }

    const generation = smartPlanDraftGenerator.generate({
      patientContext,
      eligibleFoods,
      currentComposition: currentComposition ?? undefined,
    });
    if (!generation.success) {
      const alternativeCompositionPending = generation.pending.find(
        (item) => item.field === "alternativeComposition",
      );
      if (alternativeCompositionPending) {
        return NextResponse.json(
          {
            code: "NO_ADEQUATE_ALTERNATIVE",
            message: alternativeCompositionPending.message,
            pending: generation.pending,
            optionalMissing,
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          message:
            generation.pending[0]?.message ??
            "Os dados obrigatórios do Plano Inteligente não estão completos.",
          pending: generation.pending,
          optionalMissing,
        },
        { status: 409 },
      );
    }
    const meals = smartPlanDraftToMealPlanMeals(
      generation.smartPlanDraft,
      patientContext,
    );
    if (!meals?.length) {
      return NextResponse.json(
        {
          message:
            "A prévia foi calculada, mas não pôde ser apresentada com os alimentos canônicos do Banco Mestre.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({
      meals,
      smartPlanDraft: {
        ...generation.smartPlanDraft,
        warnings: currentComposition
          ? generation.smartPlanDraft.warnings
          : [
              "Nenhum plano anterior válido foi localizado; esta é uma construção inicial.",
              ...generation.smartPlanDraft.warnings,
            ],
      },
      optionalMissing: generation.smartPlanDraft.optionalDataNotProvided,
      notice: currentComposition
        ? "Combinação alternativa gerada pelo Plano Inteligente — aguardando validação do nutricionista."
        : "Construção inicial gerada pelo Plano Inteligente — nenhum plano anterior válido foi localizado; aguardando validação do nutricionista.",
    });
  } catch (error) {
    console.error("Falha ao gerar prévia assistida do Plano Alimentar.", error);
    return NextResponse.json(
      { message: "Não foi possível consultar os dados reais para gerar a prévia." },
      { status: 503 },
    );
  }
}

export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ patientId: string; attendanceId: string }>;
  },
) {
  const [{ patientId, attendanceId }, sessionAccess] = await Promise.all([
    params,
    mvpService.getSession(),
  ]);
  const access = resolveDevelopmentAccess(request, sessionAccess);
  if (!canAccess(access, "MEAL_PLAN", "UPDATE")) {
    return NextResponse.json(
      { message: "Seu perfil não permite editar o Plano Alimentar." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const source =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;

  if (source?.action === "ADJUST_PLAN") {
    const reason = typeof source.reason === "string" ? source.reason.trim() : "";
    const expectedRevision = source.expectedRevision;
    const containsForbiddenData = [
      "patientId",
      "attendanceId",
      "content",
      "draft",
      "meals",
      "supplements",
      "status",
    ].some((key) => Object.prototype.hasOwnProperty.call(source, key));

    if (
      !reason ||
      typeof expectedRevision !== "number" ||
      !Number.isInteger(expectedRevision) ||
      expectedRevision < 1 ||
      containsForbiddenData
    ) {
      return NextResponse.json(
        { message: "Informe o motivo e a revisão válidos para ajustar o plano." },
        { status: 400 },
      );
    }

    try {
      const record = await mealPlanRepository.reopenForAdjustment({
        patientId,
        attendanceId,
        professionalUserId: access.user.id,
        reason,
        expectedRevision,
      });
      if (!record) {
        return NextResponse.json(
          { message: "Plano Alimentar não encontrado." },
          { status: 404 },
        );
      }
      return NextResponse.json({ record });
    } catch (error) {
      if (
        error instanceof Error &&
        [
          "MEAL_PLAN_ALREADY_DRAFT",
          "MEAL_PLAN_NOT_FINALIZED",
          "MEAL_PLAN_REVISION_CONFLICT",
        ].includes(error.message)
      ) {
        return NextResponse.json(
          { message: "O estado ou a revisão do plano foi alterado." },
          { status: 409 },
        );
      }
      if (
        error instanceof Error &&
        error.message === "MEAL_PLAN_ADJUST_REASON_REQUIRED"
      ) {
        return NextResponse.json(
          { message: "Informe o motivo do ajuste." },
          { status: 400 },
        );
      }
      console.error("Falha ao reabrir o Plano Alimentar para ajustes.", error);
      return NextResponse.json(
        { message: "Não foi possível abrir o Plano Alimentar para ajustes." },
        { status: 503 },
      );
    }
  }

  const draft = parseMealPlanRecordDraft(body);
  const justification = mealPlanClinicalJustificationSchema.safeParse(
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).clinicalJustification
      : undefined,
  );
  if (
    !draft ||
    !justification.success ||
    !["DRAFT", "IN_REVIEW", "APPROVED"].includes(draft.status)
  ) {
    return NextResponse.json(
      { message: "Revise a estrutura do Plano Alimentar." },
      { status: 400 },
    );
  }

  if (
    draft.status === "APPROVED" &&
    draft.aiDecision !== "IDLE" &&
    (draft.smartGenerationVersion ?? 0) < 2
  ) {
    return NextResponse.json(
      {
        message:
          "Esta prévia foi rejeitada por incoerência alimentar. Gere uma nova sugestão antes de concluir o Plano Alimentar.",
      },
      { status: 409 },
    );
  }

  try {
    const [strategy, clinicalContext, currentRecord, clinicalFlow] = await Promise.all([
      nutritionStrategyInheritanceService.getForMealPlan(
        patientId,
        attendanceId,
      ),
      nutritionClinicalPanelRepository.get(patientId, attendanceId),
      mealPlanRepository.get(patientId, attendanceId),
      nutritionClinicalFlowRepository.getFlow({ patientId, attendanceId }),
    ]);
    const strategySkipped = clinicalFlow?.flow.some(
      (step) => step.id === "NUTRITION_STRATEGY" && step.status === "SKIPPED",
    );
    const validApprovedStrategy = Boolean(
      strategy && strategy.sourceStrategyId === draft.strategyEntryId,
    );
    const validManualPlan = Boolean(
      strategySkipped && !strategy && !draft.strategyEntryId,
    );
    if (!validApprovedStrategy && !validManualPlan) {
      return NextResponse.json(
        {
          message: "Finalize primeiro a Estratégia Nutricional.",
        },
        { status: 409 },
      );
    }

    if (!clinicalContext || !currentRecord) {
      return NextResponse.json(
        { message: "Não foi possível validar o contexto clínico do plano." },
        { status: 409 },
      );
    }
    if (
      currentRecord.patientId !== patientId ||
      currentRecord.attendanceId !== attendanceId
    ) {
      return NextResponse.json(
        {
          code: "MEAL_PLAN_CONTEXT_FORBIDDEN",
          message:
            "O Plano Alimentar não pertence ao paciente e atendimento informados.",
        },
        { status: 403 },
      );
    }

    let recipeValidatedDraft: MealPlanRecordDraft;
    try {
      recipeValidatedDraft = await canonicalizeMealPlanRecipes(draft);
    } catch (error) {
      const response = recipeValidationResponse(error);
      if (response) return response;
      throw error;
    }

    const foodOnlyDraft = foodOnlyMealPlanDraft(recipeValidatedDraft);

    const catalogFoods = await foodRepository.findManyByIds(
      foodOnlyDraft.meals.flatMap((meal) =>
        meal.items
          .filter(isMealPlanFoodItem)
          .map((item) => item.catalogFoodId),
      ),
    );
    const ibgeMeasureOptions = await householdMeasureRepository.findConfirmedOptionsByFoodIds(
      catalogFoods.map((food) => food.id),
    );
    const canonicalFoodDraft = canonicalizeMealPlanDraftFoods(
      foodOnlyDraft,
      catalogFoods,
      ibgeMeasureOptions,
      currentRecord.meals.map((meal) => ({
        ...meal,
        items: meal.items.filter(isMealPlanFoodItem),
      })),
    );
    if (!canonicalFoodDraft) {
      console.warn("Rascunho do Plano Alimentar rejeitado na canonicalização.", JSON.stringify({
        patientId,
        attendanceId,
        planId: currentRecord.id,
        foodCount: foodOnlyDraft.meals.reduce(
          (total, meal) => total + meal.items.length,
          0,
        ),
        issues: diagnoseMealPlanDraftFoodCanonicalization(
          foodOnlyDraft,
          catalogFoods,
          ibgeMeasureOptions,
        ),
      }));
      return NextResponse.json(
        {
          message:
            "Um ou mais alimentos ou medidas caseiras não pertencem ao catálogo ativo. Revise a porção selecionada.",
        },
        { status: 409 },
      );
    }
    const canonicalDraft = recomposeMealPlanItems(
      recipeValidatedDraft,
      canonicalFoodDraft,
    );
    if (!canonicalDraft) {
      return NextResponse.json(
        {
          code: "MEAL_PLAN_ITEM_RECOMPOSITION_FAILED",
          message:
            "Não foi possível preservar a ordem e os identificadores dos itens do Plano Alimentar.",
        },
        { status: 409 },
      );
    }
    const currentFoods = new Map(
      currentRecord.meals.flatMap((meal) =>
        meal.items
          .filter(isMealPlanFoodItem)
          .map((food) => [food.id, food.catalogFoodId] as const),
      ),
    );
    const changedCatalogIds = new Set(
      canonicalDraft.meals.flatMap((meal) =>
        meal.items
          .filter(isMealPlanFoodItem)
          .flatMap((food) =>
            currentFoods.get(food.id) !== food.catalogFoodId
              ? [food.catalogFoodId]
              : [],
          ),
      ),
    );
    const equivalenceContext = createNutritionalEquivalenceContext({
      foodPreferences:
        clinicalContext.inheritedClinicalContext.foodPreferences,
      clinicalRestrictions:
        clinicalContext.inheritedClinicalContext.restrictions,
      allergies: clinicalContext.inheritedClinicalContext.allergies,
    });
    if (
      catalogFoods.some(
        (food) =>
          changedCatalogIds.has(food.id) &&
          !isFoodCompatibleWithClinicalContext(food, equivalenceContext),
      )
    ) {
      return NextResponse.json(
        {
          message:
            "O alimento selecionado conflita com alergias, restrições ou recusas registradas.",
        },
        { status: 409 },
      );
    }

    let securedDraft: MealPlanRecordDraft = canonicalDraft;
    if (canonicalDraft.dietaryReferenceProfile) {
      const profile = canonicalDraft.dietaryReferenceProfile;
      const selectedReferences = selectDietaryReferences(profile);
      if (!selectedReferences && profile.lifeStage !== "UNKNOWN") {
        return NextResponse.json(
          { message: "O perfil de referência DRI não corresponde a uma faixa etária e fase de vida válidas." },
          { status: 400 },
        );
      }
      securedDraft = {
        ...securedDraft,
        dietaryReferences: selectedReferences &&
          JSON.stringify(profile) === JSON.stringify(currentRecord.dietaryReferenceProfile) &&
          currentRecord.dietaryReferences?.length
            ? currentRecord.dietaryReferences
            : selectedReferences ?? undefined,
        dietaryReferenceProfile: profile.origin === "PROFESSIONAL_ADJUSTMENT" ||
          profile.origin === "PROFESSIONAL_CONFIRMATION"
          ? { ...profile, adjustedByUserId: access.user.id, adjustedAt: new Date().toISOString() }
          : profile,
      };
    }
    if (securedDraft.status === "APPROVED" && securedDraft.professionalReview) {
      const eligibility = evaluateMealPlanCompletion({
        meals: securedDraft.meals,
        planRevision: currentRecord.revision,
      });
      securedDraft = {
        ...securedDraft,
        professionalReview: {
          reviewedByUserId: access.user.id,
          reviewedByName: access.user.fullName,
          reviewedAt: new Date().toISOString(),
          planRevision: currentRecord.revision,
          contentFingerprint: mealPlanContentFingerprint(securedDraft.meals),
          acknowledgedLimitations: eligibility.limitations,
          statement: securedDraft.professionalReview.statement,
        },
      };
    }
    const targetDeviations = validApprovedStrategy && strategy
      ? calculateMealPlanTargetDeviations({
          target: {
            energyKcal: strategy.caloriesKcal,
            proteinGrams: strategy.proteinGrams,
            carbohydratesGrams: strategy.carbohydratesGrams,
            fatsGrams: strategy.fatsGrams,
          },
          actual: calculatePersistedMealPlanTotals(securedDraft.meals),
        })
      : undefined;
    const currentDeviationFingerprint = targetDeviations
      ? mealPlanTargetDeviationFingerprint(targetDeviations)
      : undefined;
    const submittedTargetAuthorization =
      securedDraft.targetDeviationAuthorization;
    const currentTargetAuthorization =
      currentRecord.targetDeviationAuthorization;
    const reusableTargetAuthorization =
      targetDeviations &&
      currentTargetAuthorization &&
      submittedTargetAuthorization?.statement ===
        currentTargetAuthorization.statement &&
      targetDeviationAuthorizationMatches({
        authorization: currentTargetAuthorization,
        deviations: targetDeviations,
      })
        ? currentTargetAuthorization
        : undefined;
    let securedTargetDeviationAuthorization:
      MealPlanRecordDraft["targetDeviationAuthorization"];
    if (
      targetDeviations?.some((deviation) => deviation.outsideTolerance) &&
      submittedTargetAuthorization &&
      currentDeviationFingerprint &&
      submittedTargetAuthorization.deviationFingerprint ===
        currentDeviationFingerprint
    ) {
      securedTargetDeviationAuthorization =
        reusableTargetAuthorization ?? {
          authorizedByUserId: access.user.id,
          authorizedByName: access.user.fullName,
          authorizedAt: new Date().toISOString(),
          planRevision: currentRecord.revision,
          tolerancePercent: FINAL_NUTRITION_TARGET_TOLERANCE_PERCENT,
          deviationFingerprint: currentDeviationFingerprint,
          deviations: targetDeviations,
          statement:
            submittedTargetAuthorization.statement?.trim() || undefined,
        };
    }
    securedDraft = {
      ...securedDraft,
      targetDeviationAuthorization: securedTargetDeviationAuthorization,
    };

    const record = await mealPlanRepository.save(
      patientId,
      attendanceId,
      securedDraft,
      access.user.id,
      validApprovedStrategy ? (strategy ?? undefined) : undefined,
      justification.data,
    );
    return NextResponse.json({ record });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "MEAL_PLAN_PREVIEW_NOT_APPROVED"
    ) {
      return NextResponse.json(
        {
          message:
            "Revise todas as refeições e aprove a prévia antes de concluir o Plano Alimentar.",
        },
        { status: 409 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "MEAL_PLAN_TARGET_DEVIATION_AUTHORIZATION_REQUIRED"
    ) {
      return NextResponse.json(
        {
          code: "MEAL_PLAN_TARGET_DEVIATION_AUTHORIZATION_REQUIRED",
          message:
            "Há valores fora da tolerância da estratégia. Volte para ajustar o plano ou autorize explicitamente a continuidade com os valores apresentados.",
        },
        { status: 409 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "MEAL_PLAN_COMPLETION_REVIEW_REQUIRED"
    ) {
      return NextResponse.json(
        {
          code: "MEAL_PLAN_COMPLETION_REVIEW_REQUIRED",
          message:
            "Revise os requisitos obrigatórios e registre a revisão profissional explícita das limitações nutricionais antes de concluir.",
        },
        { status: 409 },
      );
    }
    if (
      error instanceof Error &&
      (error.message === "MEAL_PLAN_STRATEGY_NOT_APPROVED" ||
        error.message === "MEAL_PLAN_STRATEGY_MISMATCH" ||
        error.message === "MEAL_PLAN_STRATEGY_UPDATE_DECISION_REQUIRED")
    ) {
      return NextResponse.json(
        {
          message: "Finalize primeiro a Estratégia Nutricional.",
        },
        { status: 409 },
      );
    }
    console.error(
      `Falha ao salvar o rascunho do Plano Alimentar para patientId=${patientId} attendanceId=${attendanceId}.`,
      error,
    );
    return NextResponse.json(
      {
        message:
          "Não foi possível salvar o Plano Alimentar. A prévia foi mantida; tente novamente.",
      },
      { status: 503 },
    );
  }
}
