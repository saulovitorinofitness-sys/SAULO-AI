import { NextResponse } from "next/server";

import { mealPlanRepository } from "@/features/meal-plan/repository";
import { parseMealPlanRecordDraft } from "@/features/meal-plan/record";
import { canonicalizeMealPlanDraftFoods } from "@/features/meal-plan/food-snapshot";
import { nutritionStrategyInheritanceService } from "@/features/nutrition-strategy/inheritance-service";
import { foodRepository } from "@/features/food-database/repository";
import { canAccess, mvpService } from "@/features/mvp";
import { resolveDevelopmentAccess } from "@/features/development-session";

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

  const draft = parseMealPlanRecordDraft(
    await request.json().catch(() => null),
  );
  if (!draft || !["DRAFT", "IN_REVIEW"].includes(draft.status)) {
    return NextResponse.json(
      { message: "Revise a estrutura do Plano Alimentar." },
      { status: 400 },
    );
  }

  try {
    const strategy =
      await nutritionStrategyInheritanceService.getForMealPlan(
        patientId,
        attendanceId,
      );
    if (!strategy || strategy.sourceStrategyId !== draft.strategyEntryId) {
      return NextResponse.json(
        {
          message:
            "A Estratégia Nutricional vinculada precisa estar aprovada.",
        },
        { status: 409 },
      );
    }

    const catalogFoods = await foodRepository.findManyByIds(
      draft.meals.flatMap((meal) =>
        meal.items.map((item) => item.catalogFoodId),
      ),
    );
    const canonicalDraft = canonicalizeMealPlanDraftFoods(
      draft,
      catalogFoods,
    );
    if (!canonicalDraft) {
      return NextResponse.json(
        {
          message:
            "Um ou mais alimentos não estão ativos no catálogo definitivo. Selecione-os novamente.",
        },
        { status: 409 },
      );
    }

    const record = await mealPlanRepository.save(
      patientId,
      attendanceId,
      canonicalDraft,
      access.user.id,
      strategy,
    );
    return NextResponse.json({ record });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "MEAL_PLAN_STRATEGY_NOT_APPROVED" ||
        error.message === "MEAL_PLAN_STRATEGY_MISMATCH" ||
        error.message === "MEAL_PLAN_STRATEGY_UPDATE_DECISION_REQUIRED")
    ) {
      return NextResponse.json(
        {
          message:
            "A Estratégia Nutricional vinculada precisa estar aprovada.",
        },
        { status: 409 },
      );
    }
    console.error("Falha ao salvar o rascunho do Plano Alimentar.", error);
    return NextResponse.json(
      { message: "Não foi possível salvar o Plano Alimentar." },
      { status: 503 },
    );
  }
}
