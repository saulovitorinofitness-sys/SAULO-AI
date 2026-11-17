import { NextResponse } from "next/server";

import { canAccess, mvpService } from "@/features/mvp";
import { performanceEnduranceService } from "@/features/performance-endurance";
import {
  PerformanceMonitoringServiceError,
  performanceMonitoringService,
} from "@/features/performance-monitoring/service";
import { buildRunningPlanningReferenceSet } from "@/features/performance-endurance/running-planning-references";
import { performanceWorkoutRepository } from "@/features/performance-endurance/workout-repository";

export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" } as const;

export async function GET(
  _request: Request,
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
    !canAccess(access, "MASTER_RECORD", "READ") ||
    !canAccess(access, "WORKOUT_PLAN", "READ")
  ) {
    return NextResponse.json(
      { message: "Seu perfil não permite consultar referências de Corrida." },
      { status: 403, headers: noStoreHeaders },
    );
  }

  const view = await performanceWorkoutRepository.get(
    patientId,
    attendanceId,
    access.user.id,
  );
  if (!view) {
    return NextResponse.json(
      { message: "Aluno ou atendimento não encontrado." },
      { status: 404, headers: noStoreHeaders },
    );
  }

  try {
    const executions = await performanceMonitoringService.listExecutionHistory(
      view.masterRecordId,
      { from: new Date(0), to: new Date() },
    );
    const referenceSet = buildRunningPlanningReferenceSet({
      masterRecordId: view.masterRecordId,
      patientId: view.patient.id,
      executions,
      assessments: view.professionalContext?.physicalAssessments ?? [],
      manualReferenceData:
        view.draft.endurance?.running?.configuration.athleteReferenceData,
    });

    return NextResponse.json({ referenceSet }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof PerformanceMonitoringServiceError) {
      const status =
        error.code === "AUTHENTICATION_REQUIRED"
          ? 401
          : error.code === "FORBIDDEN"
            ? 403
            : error.code === "NOT_FOUND"
              ? 404
              : 503;
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status, headers: noStoreHeaders },
      );
    }
    console.error(
      `[running-planning-references] load failure ${JSON.stringify({
        errorName: error instanceof Error ? error.name : typeof error,
      })}`,
    );
    return NextResponse.json(
      {
        code: "REFERENCE_LOAD_FAILED",
        message: "Não foi possível carregar os dados reais para o planejamento.",
      },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
