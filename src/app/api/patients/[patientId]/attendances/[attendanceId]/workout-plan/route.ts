import { NextResponse } from "next/server";

import { canAccess, mvpService } from "@/features/mvp";
import { performanceEnduranceService } from "@/features/performance-endurance";
import { exerciseCatalogRepository } from "@/features/performance-endurance/exercise-catalog-repository";
import {
  performanceWorkoutRepository,
  reopenWorkoutPlanForAdjustment,
} from "@/features/performance-endurance/workout-repository";
import {
  parseWorkoutPlanDraft,
  validateWorkoutPlanFinalization,
  workoutPlanDraftSchema,
} from "@/features/performance-endurance/workout-record";

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
  const action = source.action;
  const expectedRevision = source.expectedRevision;

  if (action === "ADJUST_PLAN") {
    const reason =
      typeof source.reason === "string" ? source.reason.trim() : "";
    const containsForbiddenData = [
      "patientId",
      "attendanceId",
      "draft",
      "content",
      "status",
    ].some((key) => Object.prototype.hasOwnProperty.call(source, key));

    if (
      !reason ||
      typeof expectedRevision !== "number" ||
      !Number.isInteger(expectedRevision) ||
      expectedRevision < 1 ||
      containsForbiddenData
    ) {
      return NextResponse.json(
        { message: "Informe um motivo e uma revisao validos para ajustar o plano." },
        { status: 400 },
      );
    }

    try {
      const record = await reopenWorkoutPlanForAdjustment({
        patientId,
        attendanceId,
        professionalUserId: access.user.id,
        reason,
        expectedRevision,
      });
      if (!record) {
        return NextResponse.json(
          { message: "Nao foi possivel localizar o atendimento ou o plano." },
          { status: 404 },
        );
      }
      return NextResponse.json({ record });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "WORKOUT_PLAN_ADJUST_REASON_REQUIRED"
      ) {
        return NextResponse.json(
          { message: "Informe o motivo profissional do ajuste." },
          { status: 400 },
        );
      }
      if (
        error instanceof Error &&
        [
          "WORKOUT_PLAN_ALREADY_DRAFT",
          "WORKOUT_PLAN_NOT_FINALIZED",
          "WORKOUT_PLAN_REVISION_CONFLICT",
        ].includes(error.message)
      ) {
        return NextResponse.json(
          { message: "O estado ou a revisao do plano foi alterado." },
          { status: 409 },
        );
      }
      console.error("Falha ao reabrir Plano de Treino para ajustes.", error);
      return NextResponse.json(
        { message: "Nao foi possivel reabrir o Plano de Treino." },
        { status: 503 },
      );
    }
  }

  const draftValidation = workoutPlanDraftSchema.safeParse(source.draft);
  const draft = draftValidation.success
    ? parseWorkoutPlanDraft(source.draft)
    : null;
  if (
    !draft ||
    (action !== "SAVE_DRAFT" && action !== "FINALIZE")
  ) {
    const firstIssue = draftValidation.success
      ? undefined
      : draftValidation.error.issues[0];
    const fieldPath = firstIssue?.path.join(".");
    return NextResponse.json(
      {
        message: fieldPath
          ? `Não foi possível salvar porque o campo ${fieldPath} está inválido. As alterações foram preservadas na tela para correção.`
          : "Revise os dados do Plano de Treino. As alterações foram preservadas na tela.",
        issues: draftValidation.success
          ? undefined
          : draftValidation.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
      },
      { status: 400 },
    );
  }
  if (
    typeof expectedRevision !== "number" ||
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 0
  ) {
    return NextResponse.json(
      { message: "Revise a versão do Plano de Treino antes de salvar." },
      { status: 400 },
    );
  }
  try {
    if (action === "FINALIZE") {
      const library = await exerciseCatalogRepository.search({
        professionalUserId: access.user.id,
        active: true,
      });
      const issues = validateWorkoutPlanFinalization(draft, library.items);
      if (issues.length) {
        return NextResponse.json(
          {
            message: issues[0].message,
            issues,
          },
          { status: 400 },
        );
      }
    }
    const record = await performanceWorkoutRepository.save({
      patientId,
      attendanceId,
      professionalUserId: access.user.id,
      draft,
      status: action === "FINALIZE" ? "FINALIZED" : "DRAFT",
      expectedRevision,
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
      error.message === "WORKOUT_PLAN_REVISION_CONFLICT"
    ) {
      return NextResponse.json(
        {
          message:
            "O Plano de Treino foi atualizado em outra sessão. Recarregue a página antes de salvar novamente.",
        },
        { status: 409 },
      );
    }
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
