import { NextResponse } from "next/server";

import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { resolveDevelopmentAccess } from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ patientId: string; attendanceId: string }>;
  },
) {
  const [{ patientId, attendanceId }, access] = await Promise.all([
    params,
    mvpService.getSession(),
  ]);
  const activeAccess = resolveDevelopmentAccess(request, access);

  if (!canAccess(activeAccess, "MASTER_RECORD", "UPDATE")) {
    return NextResponse.json(
      { message: "Seu perfil não permite concluir esta avaliação." },
      { status: 403 },
    );
  }

  try {
    const result = await clinicalCollectionRepository.completeCollection(
      patientId,
      attendanceId,
      activeAccess.user.id,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "SUMMARY_DATA_UNAVAILABLE"
    ) {
      return NextResponse.json(
        {
          message:
            "A Anamnese deste atendimento não pôde ser consolidada. Revise o registro antes de confirmar o resumo.",
        },
        { status: 409 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "MANDATORY_STEPS_PENDING"
    ) {
      return NextResponse.json(
        { message: "Existem campos obrigatórios pendentes." },
        { status: 409 },
      );
    }

    console.error("Falha ao concluir avaliação.", error);
    return NextResponse.json(
      { message: "Não foi possível concluir a avaliação." },
      { status: 503 },
    );
  }
}
