import { NextResponse } from "next/server";
import { z } from "zod";

import { foodRepository } from "@/features/food-database/repository";
import {
  CLINICAL_COLLECTION_SCENARIO_KEYS,
  type ClinicalCollectionScenarioKey,
} from "@/features/clinical-collection";
import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import { canAccess, mvpService } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";

const updateSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ foodId: string }> },
) {
  const access = await mvpService.getSession();
  const url = new URL(request.url);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(
    url.searchParams.get("scenario") as ClinicalCollectionScenarioKey,
  )
    ? (url.searchParams.get("scenario") as ClinicalCollectionScenarioKey)
    : "complete";
  const viewer = resolveClinicalMockSessionUser(access.user, scenario);
  if (
    viewer.id === BUILT_IN_IDS.users.mariaDeLourdesGomes ||
    !canAccess(access, "MEAL_PLAN", "MANAGE")
  ) {
    return NextResponse.json({ message: "Acesso não permitido." }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Alteração inválida." }, { status: 400 });
  }

  try {
    const { foodId } = await params;
    const food = await foodRepository.setStatus(foodId, parsed.data.status);
    if (!food) {
      return NextResponse.json({ message: "Alimento não encontrado." }, { status: 404 });
    }
    return NextResponse.json(food);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "OFFICIAL_FOOD_READ_ONLY"
    ) {
      return NextResponse.json(
        { message: "Alimentos de fonte oficial são protegidos contra edição." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: "Não foi possível atualizar o alimento." },
      { status: 503 },
    );
  }
}
