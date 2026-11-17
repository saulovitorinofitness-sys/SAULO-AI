import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveDevelopmentAccess } from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";

const authenticationErrors = new Set([
  "Autenticação obrigatória.",
  "Sessão inválida, expirada ou revogada.",
]);

const paramsSchema = z
  .object({
    patientId: z.uuid(),
    attendanceId: z.uuid(),
  })
  .strict();

const bodySchema = z.object({
  closureObservation: z.string().trim().max(1000).optional(),
  returnPlan: z
    .object({
      date: z.iso.date(),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
      clinicalType: z.enum(["RETURN", "REASSESSMENT", "FOLLOW_UP"]),
      notes: z.string().trim().max(500).optional(),
      durationMinutes: z.number().int().min(15).max(480).optional(),
    })
    .optional(),
});

function unauthorizedResponse() {
  return NextResponse.json(
    { message: "Sessão ausente ou inválida." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ patientId: string; attendanceId: string }>;
  },
) {
  let sessionAccess: Awaited<ReturnType<typeof mvpService.getSession>>;

  try {
    sessionAccess = await mvpService.getSession();
  } catch (error) {
    if (error instanceof Error && authenticationErrors.has(error.message)) {
      return unauthorizedResponse();
    }

    console.error("Falha ao consultar a sessão atual.", error);
    return NextResponse.json(
      { message: "Não foi possível consultar a sessão atual." },
      { status: 503 },
    );
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { message: "Paciente ou atendimento inválido." },
      { status: 400 },
    );
  }

  const { patientId, attendanceId } = parsedParams.data;
  const activeAccess = resolveDevelopmentAccess(request, sessionAccess);

  if (!canAccess(activeAccess, "ATTENDANCE", "UPDATE")) {
    return NextResponse.json(
      { message: "Seu perfil não permite finalizar o atendimento." },
      { status: 403 },
    );
  }

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Revise os dados do próximo retorno." },
      { status: 400 },
    );
  }

  try {
    const result = await nutritionClinicalFlowRepository.finalizeAttendance(
      patientId,
      attendanceId,
      activeAccess.user.id,
      parsedBody.data.returnPlan,
      parsedBody.data.closureObservation,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ATTENDANCE_EMPTY_CLOSURE_JUSTIFICATION_REQUIRED"
    ) {
      return NextResponse.json(
        {
          message:
            "Informe uma justificativa curta para finalizar sem nenhum registro clínico.",
        },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === "ATTENDANCE_NOT_FOUND") {
      return NextResponse.json(
        { message: "Atendimento não encontrado." },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "ATTENDANCE_PATIENT_MISMATCH"
    ) {
      return NextResponse.json(
        { message: "O atendimento não pertence ao paciente informado." },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      (error.message === "ATTENDANCE_PENDING_CHECK_NOT_FOUND" ||
        error.message === "ATTENDANCE_NOT_FINALIZABLE")
    ) {
      return NextResponse.json(
        { message: "Este atendimento não está disponível para finalização." },
        { status: 409 },
      );
    }

    console.error("Falha ao finalizar atendimento.", error);
    return NextResponse.json(
      { message: "Não foi possível finalizar o atendimento." },
      { status: 503 },
    );
  }
}
