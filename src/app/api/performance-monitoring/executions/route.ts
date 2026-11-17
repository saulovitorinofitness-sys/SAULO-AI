import { NextResponse } from "next/server";
import { z } from "zod";

import { PERFORMANCE_MODALITIES } from "@/features/performance-monitoring/contracts";
import {
  PerformanceMonitoringServiceError,
  performanceMonitoringService,
  type StartExecutionFromScheduledSessionInput,
  type StartManualExecutionInput,
  type StartSpontaneousExecutionInput,
} from "@/features/performance-monitoring/service";

export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" } as const;

const isoDateTimeSchema = z.iso.datetime({ offset: true }).transform((value) =>
  new Date(value),
);

const dateRangeSchema = z
  .object({
    masterRecordId: z.uuid(),
    from: isoDateTimeSchema,
    to: isoDateTimeSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.from.getTime() > input.to.getTime()) {
      context.addIssue({
        code: "custom",
        message: "O início do intervalo não pode ser posterior ao fim.",
        path: ["from"],
      });
    }
  });

const startFromScheduledSessionSchema = z
  .object({
    startMode: z.literal("SCHEDULED_SESSION"),
    masterRecordId: z.uuid(),
    scheduledSessionId: z.uuid(),
    actualStartAt: isoDateTimeSchema,
    notes: z.string().optional(),
  })
  .strict();

const startFromPlanSchema = z
  .object({
    startMode: z.literal("PLAN"),
    masterRecordId: z.uuid(),
    workoutPlanEntryId: z.uuid(),
    workoutPlanVersionId: z.uuid(),
    sessionId: z.uuid().optional(),
    modality: z.enum(PERFORMANCE_MODALITIES),
    actualStartAt: isoDateTimeSchema,
    notes: z.string().optional(),
  })
  .strict();

const startSpontaneousSchema = z
  .object({
    startMode: z.literal("SPONTANEOUS"),
    masterRecordId: z.uuid(),
    modality: z.enum(PERFORMANCE_MODALITIES),
    actualStartAt: isoDateTimeSchema,
    notes: z.string().optional(),
  })
  .strict();

const startExecutionSchema = z.discriminatedUnion("startMode", [
  startFromScheduledSessionSchema,
  startFromPlanSchema,
  startSpontaneousSchema,
]);

function invalidRequestResponse(code: "INVALID_BODY" | "INVALID_QUERY") {
  const message =
    code === "INVALID_QUERY"
      ? "Informe masterRecordId, from e to válidos para consultar o histórico de execuções."
      : "Revise os dados para iniciar a execução de treino.";

  return NextResponse.json(
    { code, message },
    { status: 400, headers: noStoreHeaders },
  );
}

function serviceErrorResponse(error: PerformanceMonitoringServiceError) {
  const statusByCode = {
    AUTHENTICATION_REQUIRED: 401,
    CONFLICT: 409,
    FORBIDDEN: 403,
    INVALID_INPUT: 400,
    INVALID_STATE: 409,
    NOT_FOUND: 404,
    PERSISTENCE_ERROR: 503,
  } as const satisfies Record<
    PerformanceMonitoringServiceError["code"],
    number
  >;

  return NextResponse.json(
    { code: error.code, message: error.message },
    { status: statusByCode[error.code], headers: noStoreHeaders },
  );
}

function unexpectedErrorResponse() {
  console.error("Falha não mapeada na API de execuções de Performance.");
  return NextResponse.json(
    {
      code: "INTERNAL_ERROR",
      message: "Não foi possível processar a solicitação de Performance.",
    },
    { status: 503, headers: noStoreHeaders },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = dateRangeSchema.safeParse(
    Object.fromEntries(url.searchParams),
  );

  if (!parsed.success) return invalidRequestResponse("INVALID_QUERY");

  try {
    const executions =
      await performanceMonitoringService.listExecutionHistory(
        parsed.data.masterRecordId,
        { from: parsed.data.from, to: parsed.data.to },
      );

    return NextResponse.json({ executions }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof PerformanceMonitoringServiceError) {
      return serviceErrorResponse(error);
    }
    return unexpectedErrorResponse();
  }
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return invalidRequestResponse("INVALID_BODY");
  }

  const parsed = startExecutionSchema.safeParse(payload);
  if (!parsed.success) return invalidRequestResponse("INVALID_BODY");

  try {
    let execution: Awaited<
      ReturnType<typeof performanceMonitoringService.startManualExecution>
    >;

    if (parsed.data.startMode === "SCHEDULED_SESSION") {
      const input = {
        masterRecordId: parsed.data.masterRecordId,
        scheduledSessionId: parsed.data.scheduledSessionId,
        actualStartAt: parsed.data.actualStartAt,
        notes: parsed.data.notes,
      } satisfies StartExecutionFromScheduledSessionInput;

      execution =
        await performanceMonitoringService.startExecutionFromScheduledSession(
          input,
        );
    } else if (parsed.data.startMode === "PLAN") {
      const input = {
        masterRecordId: parsed.data.masterRecordId,
        workoutPlanEntryId: parsed.data.workoutPlanEntryId,
        workoutPlanVersionId: parsed.data.workoutPlanVersionId,
        sessionId: parsed.data.sessionId,
        modality: parsed.data.modality,
        actualStartAt: parsed.data.actualStartAt,
        notes: parsed.data.notes,
      } satisfies StartManualExecutionInput;

      execution = await performanceMonitoringService.startManualExecution(
        input,
      );
    } else {
      const input = {
        masterRecordId: parsed.data.masterRecordId,
        modality: parsed.data.modality,
        actualStartAt: parsed.data.actualStartAt,
        notes: parsed.data.notes,
      } satisfies StartSpontaneousExecutionInput;

      execution = await performanceMonitoringService.startSpontaneousExecution(
        input,
      );
    }

    return NextResponse.json(
      { execution },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof PerformanceMonitoringServiceError) {
      return serviceErrorResponse(error);
    }
    return unexpectedErrorResponse();
  }
}
