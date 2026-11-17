import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveDevelopmentAccess } from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";
import {
  parseReturnFoodSafetyInput,
  returnFoodSafetyRepository,
} from "@/features/nutrition-return-anamnesis/food-safety-update";
import { BUILT_IN_IDS } from "@/modules/permissions";

const paramsSchema = z.object({
  patientId: z.string().uuid(),
  attendanceId: z.string().uuid(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ patientId: string; attendanceId: string }> },
) {
  const [rawParams, session] = await Promise.all([
    params,
    mvpService.getSession(),
  ]);
  const identifiers = paramsSchema.safeParse(rawParams);
  const access = resolveDevelopmentAccess(request, session);
  if (!identifiers.success) {
    return NextResponse.json({ message: "Atendimento inválido." }, { status: 400 });
  }
  if (
    access.user.id === BUILT_IN_IDS.users.mariaDeLourdesGomes ||
    !canAccess(access, "MASTER_RECORD", "UPDATE") ||
    !canAccess(access, "NUTRITION_STRATEGY", "UPDATE")
  ) {
    return NextResponse.json({ message: "Acesso não permitido." }, { status: 403 });
  }

  const data = parseReturnFoodSafetyInput(await request.json().catch(() => null));
  if (!data) {
    return NextResponse.json(
      {
        message:
          "Confirme conscientemente a ausência de alergias ou informe ao menos um alérgeno.",
      },
      { status: 400 },
    );
  }
  try {
    const update = await returnFoodSafetyRepository.save({
      ...identifiers.data,
      professionalUserId: access.user.id,
      data,
    });
    return NextResponse.json({ update });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RETURN_FOOD_SAFETY_CONTEXT_NOT_FOUND"
    ) {
      return NextResponse.json(
        { message: "O atendimento de retorno em andamento não foi encontrado." },
        { status: 409 },
      );
    }
    console.error("Falha ao atualizar segurança alimentar do retorno.", error);
    return NextResponse.json(
      { message: "Não foi possível salvar a atualização de segurança alimentar." },
      { status: 503 },
    );
  }
}
