import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveDevelopmentAccess } from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";
import {
  NUTRITION_CLINICAL_FLOW_STEP_IDS,
  type NutritionClinicalFlowStepId,
} from "@/features/nutrition-clinical-flow/flow";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import { prisma } from "@/lib/database/prisma";
import type { ModuleKey } from "@/modules/shared";

const authenticationErrors = new Set([
  "Autenticação obrigatória.",
  "Sessão inválida, expirada ou revogada.",
]);

const paramsSchema = z
  .object({
    patientId: z.uuid(),
    attendanceId: z.uuid(),
    step: z.enum(NUTRITION_CLINICAL_FLOW_STEP_IDS),
  })
  .strict();

const bodySchema = z
  .object({
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();

type SkippableStepId = Exclude<
  NutritionClinicalFlowStepId,
  "PATIENT_REGISTRATION" | "ANAMNESIS" | "DELIVERABLES"
>;

const moduleByStep = {
  ANTHROPOMETRY: "PHYSICAL_ASSESSMENT",
  PERIMETRY: "PERIMETRY",
  BIOIMPEDANCE: "BIOIMPEDANCE",
  POSTURAL_ASSESSMENT: "POSTURAL_ASSESSMENT",
  ASSESSMENT_SUMMARY: "PHYSICAL_ASSESSMENT",
  PERFORMANCE: "WORKOUT_PLAN",
  NUTRITION_STRATEGY: "NUTRITION_STRATEGY",
  MEAL_PLAN: "MEAL_PLAN",
  FINALIZE_ATTENDANCE: "ATTENDANCE",
} as const satisfies Readonly<Record<SkippableStepId, ModuleKey>>;

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
    params: Promise<{
      patientId: string;
      attendanceId: string;
      step: string;
    }>;
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
      { message: "Paciente, atendimento ou etapa inválidos." },
      { status: 400 },
    );
  }

  const { patientId, attendanceId, step } = parsedParams.data;
  if (step === "DELIVERABLES") {
    return NextResponse.json(
      {
        message:
          "Entregáveis é uma central de documentos e não pode ser marcada como não realizada.",
      },
      { status: 409 },
    );
  }

  if (step === "PATIENT_REGISTRATION" || step === "ANAMNESIS") {
    return NextResponse.json(
      {
        message:
          "Cadastro e Anamnese são etapas obrigatórias e não podem ser marcadas como não realizadas.",
      },
      { status: 409 },
    );
  }

  const access = resolveDevelopmentAccess(request, sessionAccess);
  if (!canAccess(access, moduleByStep[step], "UPDATE")) {
    return NextResponse.json(
      { message: "Seu perfil não permite alterar esta etapa." },
      { status: 403 },
    );
  }

  const parsedBody = bodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Informe um motivo válido com até 1000 caracteres." },
      { status: 400 },
    );
  }

  try {
    const [patient, attendance] = await Promise.all([
      prisma.patient.findFirst({
        where: {
          id: patientId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      }),
      prisma.attendance.findFirst({
        where: {
          id: attendanceId,
          deletedAt: null,
        },
        select: {
          masterRecord: {
            select: {
              patientId: true,
            },
          },
        },
      }),
    ]);

    if (!patient) {
      return NextResponse.json(
        { message: "Paciente não encontrado." },
        { status: 404 },
      );
    }

    if (!attendance) {
      return NextResponse.json(
        { message: "Atendimento não encontrado." },
        { status: 404 },
      );
    }

    if (attendance.masterRecord.patientId !== patient.id) {
      return NextResponse.json(
        { message: "O atendimento não pertence ao paciente informado." },
        { status: 409 },
      );
    }

    const result = await nutritionClinicalFlowRepository.markStepSkipped(
      attendanceId,
      step,
      sessionAccess.user.id,
      parsedBody.data.reason,
    );

    return NextResponse.json({
      step: {
        id: step,
        status: result.status,
        skippedAt: result.skippedAt?.toISOString() ?? null,
        reason: result.skipReason,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SKIP_REASON_REQUIRED") {
      return NextResponse.json(
        { message: "Informe o motivo da não realização." },
        { status: 400 },
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
      error.message === "ATTENDANCE_PENDING_CHECK_NOT_FOUND"
    ) {
      return NextResponse.json(
        { message: "Controle de etapas do atendimento não encontrado." },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === "ATTENDANCE_STEP_NOT_FOUND") {
      return NextResponse.json(
        { message: "Etapa não encontrada neste atendimento." },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "ATTENDANCE_STEP_ALREADY_COMPLETED"
    ) {
      return NextResponse.json(
        { message: "Uma etapa concluída não pode ser marcada como não realizada." },
        { status: 409 },
      );
    }

    console.error("Falha ao marcar etapa como não realizada.", error);
    return NextResponse.json(
      { message: "Não foi possível atualizar a etapa do atendimento." },
      { status: 503 },
    );
  }
}
