import { NextResponse } from "next/server";

import { resolveDevelopmentAccess } from "@/features/development-session";
import { foodRepository } from "@/features/food-database/repository";
import { rankNutritionalEquivalents } from "@/features/meal-plan/substitution-engine";
import { canAccess, mvpService } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";

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
  if (!Number.isFinite(currentGrams) || currentGrams <= 0) {
    return NextResponse.json(
      { message: "Informe uma gramagem válida para calcular equivalências." },
      { status: 400 },
    );
  }

  try {
    const currentFood = await foodRepository.findById(foodId);
    if (!currentFood || currentFood.status !== "ACTIVE") {
      return NextResponse.json(
        { message: "Alimento não encontrado no catálogo ativo." },
        { status: 404 },
      );
    }
    const candidates = await foodRepository.findEquivalencePool(
      currentFood,
    );
    const equivalents = rankNutritionalEquivalents({
      currentFood,
      currentGrams,
      candidates,
    });

    return NextResponse.json({
      sourceFoodId: currentFood.id,
      sourceGrams: currentGrams,
      method: "NUTRITIONAL_PROXIMITY_V1",
      decision: "PROFESSIONAL_CONFIRMATION_REQUIRED",
      equivalents,
    });
  } catch {
    return NextResponse.json(
      { message: "Não foi possível calcular os alimentos equivalentes." },
      { status: 503 },
    );
  }
}
