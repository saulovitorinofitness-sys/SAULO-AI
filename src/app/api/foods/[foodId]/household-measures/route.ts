import { NextResponse } from "next/server";

import { resolveDevelopmentAccess } from "@/features/development-session";
import { householdMeasureRepository } from "@/features/food-database/household-measure-repository";
import { foodRepository } from "@/features/food-database/repository";
import { canAccess, mvpService } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ foodId: string }> },
) {
  const access = resolveDevelopmentAccess(request, await mvpService.getSession());
  if (
    access.user.id === BUILT_IN_IDS.users.mariaDeLourdesGomes ||
    !canAccess(access, "MEAL_PLAN", "READ")
  ) {
    return NextResponse.json({ message: "Acesso não permitido." }, { status: 403 });
  }

  const { foodId } = await params;
  try {
    const food = await foodRepository.findById(foodId);
    if (
      !food ||
      food.status !== "ACTIVE" ||
      food.source.origin === "DEMONSTRATIVE"
    ) {
      return NextResponse.json(
        { options: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const options = await householdMeasureRepository.findConfirmedOptionsByFoodId(food.id);
    return NextResponse.json(
      { options },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Falha ao consultar medidas confirmadas do alimento.", error);
    return NextResponse.json(
      { options: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
