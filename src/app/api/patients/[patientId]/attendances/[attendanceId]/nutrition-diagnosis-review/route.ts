import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveDevelopmentAccess } from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";
import { nutritionDiagnosisReviewRepository } from "@/features/nutrition-diagnosis-review/repository";
import { nutritionStrategyService } from "@/features/nutrition-strategy";

const paramsSchema = z.object({
  patientId: z.string().uuid(),
  attendanceId: z.string().uuid(),
});

const diagnosisSchema = z.string().trim().min(1).max(500);
const bodySchema = z.discriminatedUnion("outcome", [
  z.object({
    action: z.literal("SAVE_REVIEW"),
    outcome: z.literal("NO_DIAGNOSIS_ESTABLISHED"),
    diagnoses: z.array(diagnosisSchema).length(0),
  }),
  z.object({
    action: z.literal("SAVE_REVIEW"),
    outcome: z.literal("DIAGNOSES_CONFIRMED"),
    diagnoses: z.array(diagnosisSchema).min(1).max(50),
  }),
]);

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ patientId: string; attendanceId: string }> },
) {
  const [rawParams, rawBody, session] = await Promise.all([
    params,
    request.json().catch(() => null),
    mvpService.getSession(),
  ]);
  const parsedParams = paramsSchema.safeParse(rawParams);
  const parsedBody = bodySchema.safeParse(rawBody);
  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json(
      {
        message:
          "Selecione o resultado da revisão e, quando houver diagnósticos confirmados, informe ao menos um.",
      },
      { status: 400 },
    );
  }

  const access = resolveDevelopmentAccess(request, session);
  if (
    !canAccess(access, "MASTER_RECORD", "UPDATE") ||
    !canAccess(access, "NUTRITION_STRATEGY", "UPDATE") ||
    !nutritionStrategyService.canAccess(access.user)
  ) {
    return NextResponse.json(
      {
        message:
          "Seu perfil não permite revisar o diagnóstico nutricional.",
      },
      { status: 403 },
    );
  }

  try {
    const review = await nutritionDiagnosisReviewRepository.save({
      ...parsedParams.data,
      professionalUserId: access.user.id,
      outcome: parsedBody.data.outcome,
      diagnoses: parsedBody.data.diagnoses,
    });
    return NextResponse.json({ review });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "NUTRITION_DIAGNOSIS_REVIEW_CONTEXT_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          message:
            "O paciente e o atendimento não foram localizados, não estão em andamento ou não pertencem ao mesmo Prontuário Mestre.",
        },
        { status: 409 },
      );
    }
    if (
      error instanceof Error &&
      (error.message === "NUTRITION_DIAGNOSIS_REVIEW_EMPTY" ||
        error.message === "NUTRITION_DIAGNOSIS_REVIEW_CONFLICT")
    ) {
      return NextResponse.json(
        { message: "A revisão não pode ser salva sem conteúdo." },
        { status: 400 },
      );
    }
    console.error("Falha ao salvar a revisão diagnóstica nutricional.", error);
    return NextResponse.json(
      {
        message:
          "Não foi possível persistir a revisão. Nenhum diagnóstico foi alterado.",
      },
      { status: 503 },
    );
  }
}
