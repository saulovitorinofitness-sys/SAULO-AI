import { NextResponse } from "next/server";

import { resolveDevelopmentAccess } from "@/features/development-session";
import { foodRepository } from "@/features/food-database/repository";
import { householdMeasureRepository } from "@/features/food-database/household-measure-repository";
import { normalizeFoodSearchText } from "@/features/food-database";
import {
  createNutritionalEquivalenceContext,
  foodSubstitutionService,
} from "@/features/meal-plan/substitution-engine";
import type { MealPlanNutritionValues } from "@/features/meal-plan/record";
import { canAccess, mvpService } from "@/features/mvp";
import { nutritionClinicalPanelRepository } from "@/features/nutrition-strategy/clinical-panel-repository";
import { nutritionStrategyInheritanceService } from "@/features/nutrition-strategy/inheritance-service";
import { BUILT_IN_IDS } from "@/modules/permissions";

const totalKeys = [
  "energyKcal",
  "proteinGrams",
  "carbohydratesGrams",
  "fatsGrams",
  "fiberGrams",
] as const;

function planTotals(url: URL): MealPlanNutritionValues | null {
  const values = Object.fromEntries(
    totalKeys.map((key) => [key, Number(url.searchParams.get(key))]),
  ) as unknown as MealPlanNutritionValues;
  return totalKeys.every(
    (key) => Number.isFinite(values[key]) && values[key] >= 0,
  )
    ? values
    : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ foodId: string }> },
) {
  const access = resolveDevelopmentAccess(
    request,
    await mvpService.getSession(),
  );
  if (
    access.user.id === BUILT_IN_IDS.users.mariaDeLourdesGomes ||
    !canAccess(access, "MEAL_PLAN", "READ")
  ) {
    return NextResponse.json(
      { message: "Acesso não permitido." },
      { status: 403 },
    );
  }

  const { foodId } = await params;
  const url = new URL(request.url);
  const currentGrams = Number(url.searchParams.get("grams"));
  const patientId = url.searchParams.get("patientId");
  const attendanceId = url.searchParams.get("attendanceId");
  const currentTotals = planTotals(url);
  const query = url.searchParams.get("query")?.trim() ?? "";
  const startedAt = performance.now();
  if (!Number.isFinite(currentGrams) || currentGrams <= 0) {
    return NextResponse.json(
      { message: "Informe uma gramagem válida para calcular equivalências." },
      { status: 400 },
    );
  }
  if (!patientId || !attendanceId || !currentTotals) {
    return NextResponse.json(
      { message: "Informe o atendimento e os totais atuais do plano." },
      { status: 400 },
    );
  }

  try {
    const [currentFood, clinicalContext, strategy] = await Promise.all([
      foodRepository.findById(foodId),
      nutritionClinicalPanelRepository.get(patientId, attendanceId),
      nutritionStrategyInheritanceService.getForMealPlan(
        patientId,
        attendanceId,
      ),
    ]);
    if (!clinicalContext || !strategy) {
      return NextResponse.json(
        { message: "Finalize primeiro a Estratégia Nutricional." },
        { status: 409 },
      );
    }
    if (!currentFood || currentFood.status !== "ACTIVE") {
      return NextResponse.json(
        { message: "Alimento não encontrado no catálogo ativo." },
        { status: 404 },
      );
    }
    const candidates = query
      ? await foodRepository.searchSubstitutionCandidates(query)
      : await foodRepository.findEquivalencePool(currentFood);
    const confirmedMeasures =
      await householdMeasureRepository.findConfirmedOptionsByFoodIds(
        candidates.map((candidate) => candidate.id),
      );
    const candidatesWithConfirmedMeasures = candidates.map((candidate) => ({
      ...candidate,
      householdMeasures: [
        ...candidate.householdMeasures,
        ...(confirmedMeasures.get(candidate.id) ?? [])
          .map((measure, index) => ({
            id: measure.id,
            name: measure.measureName,
            normalizedName: normalizeFoodSearchText(measure.measureName),
            quantity: 1,
            grams: measure.amountPerMeasure,
            source: measure.source,
            isDefault: index === 0 && candidate.householdMeasures.length === 0,
            active: true,
          })),
      ],
    }));
    const equivalents = foodSubstitutionService.rank({
      currentFood,
      currentGrams,
      candidates: candidatesWithConfirmedMeasures,
      context: createNutritionalEquivalenceContext({
        foodPreferences:
          clinicalContext.inheritedClinicalContext.foodPreferences,
        clinicalRestrictions:
          clinicalContext.inheritedClinicalContext.restrictions,
        allergies: clinicalContext.inheritedClinicalContext.allergies,
      }),
      planContext: {
        objective: strategy.objective,
        target: {
          energyKcal: strategy.caloriesKcal,
          proteinGrams: strategy.proteinGrams,
          carbohydratesGrams: strategy.carbohydratesGrams,
          fatsGrams: strategy.fatsGrams,
          fiberGrams: strategy.fiberGrams,
        },
        currentTotals,
      },
      limit: query ? 20 : 8,
    });

    return NextResponse.json({
      sourceFoodId: currentFood.id,
      sourceGrams: currentGrams,
      method: "NUTRITIONAL_PROXIMITY_V1",
      decision: "PROFESSIONAL_CONFIRMATION_REQUIRED",
      clinicalContext: "APPLIED",
      query: query || undefined,
      responseTimeMs: Math.round((performance.now() - startedAt) * 10) / 10,
      equivalents,
    });
  } catch {
    return NextResponse.json(
      { message: "Não foi possível calcular os alimentos equivalentes." },
      { status: 503 },
    );
  }
}
