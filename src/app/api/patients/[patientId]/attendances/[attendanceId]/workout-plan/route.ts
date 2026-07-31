import { NextResponse } from "next/server";

import { canAccess, mvpService } from "@/features/mvp";
import { performanceEnduranceService } from "@/features/performance-endurance";
import { performanceWorkoutRepository } from "@/features/performance-endurance/workout-repository";
import { parseWorkoutPlanDraft } from "@/features/performance-endurance/workout-record";

export async function PUT(
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
  if (
    !performanceEnduranceService.canAccess(access.user) ||
    !canAccess(access, "WORKOUT_PLAN", "UPDATE")
  ) {
    return NextResponse.json(
      { message: "Seu perfil não permite editar o Plano de Treino." },
      { status: 403 },
    );
  }
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { message: "Revise os dados do Plano de Treino." },
      { status: 400 },
    );
  }
  const source = body as Record<string, unknown>;
  const draft = parseWorkoutPlanDraft(source.draft);
  const action = source.action;
  if (
    !draft ||
    (action !== "SAVE_DRAFT" && action !== "FINALIZE")
  ) {
    return NextResponse.json(
      { message: "Revise os dados do Plano de Treino." },
      { status: 400 },
    );
  }
  try {
    const record = await performanceWorkoutRepository.save({
      patientId,
      attendanceId,
      professionalUserId: access.user.id,
      draft,
      status: action === "FINALIZE" ? "FINALIZED" : "DRAFT",
    });
    if (!record) {
      return NextResponse.json(
        { message: "Não foi possível localizar o atendimento." },
        { status: 404 },
      );
    }
    return NextResponse.json({ record });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "WORKOUT_PLAN_FINALIZED"
    ) {
      return NextResponse.json(
        { message: "O Plano de Treino já foi finalizado." },
        { status: 409 },
      );
    }
    console.error("Falha ao salvar Plano de Treino.", error);
    return NextResponse.json(
      { message: "Não foi possível salvar o Plano de Treino." },
      { status: 503 },
    );
  }
}
