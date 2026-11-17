import { NextResponse } from "next/server";
import { z } from "zod";

import {
  PerformanceMonitoringServiceError,
  performanceMonitoringService,
} from "@/features/performance-monitoring/service";

export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store" } as const;

const isoDateTimeSchema = z.iso.datetime({ offset: true }).transform((value) =>
  new Date(value),
);

const executionContextSchema = z
  .object({
    executionId: z.uuid(),
    masterRecordId: z.uuid(),
  })
  .strict();

const updateExecutionSchema = z
  .object({
    action: z.literal("UPDATE"),
    actualStartAt: isoDateTimeSchema.optional(),
    executedDurationSeconds: z.number().int().positive().nullable().optional(),
    executedRpe: z.number().min(0).max(10).nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      input.actualStartAt === undefined &&
      input.executedDurationSeconds === undefined &&
      input.executedRpe === undefined &&
      input.notes === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Informe ao menos um campo da execução para atualizar.",
      });
    }
  });

const completeExecutionSchema = z
  .object({
    action: z.literal("COMPLETE"),
    actualEndAt: isoDateTimeSchema,
    executedDurationSeconds: z.number().int().positive().optional(),
    executedRpe: z.number().min(0).max(10).optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

const cancelExecutionSchema = z
  .object({
    action: z.literal("CANCEL"),
    actualEndAt: isoDateTimeSchema.optional(),
    executedDurationSeconds: z.number().int().positive().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

const executionActionSchema = z.discriminatedUnion("action", [
  updateExecutionSchema,
  completeExecutionSchema,
  cancelExecutionSchema,
]);

function invalidRequestResponse(code: "INVALID_BODY" | "INVALID_QUERY") {
  const message =
    code === "INVALID_QUERY"
      ? "Informe executionId e masterRecordId válidos para consultar a execução."
      : "Revise os dados da operação sobre a execução de treino.";

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
  console.error("Falha não mapeada na API de execução de Performance.");
  return NextResponse.json(
    {
      code: "INTERNAL_ERROR",
      message: "Não foi possível processar a solicitação de Performance.",
    },
    { status: 503, headers: noStoreHeaders },
  );
}

async function executionContext(
  request: Request,
  params: Promise<{ executionId: string }>,
) {
  const { executionId } = await params;
  const url = new URL(request.url);

  return executionContextSchema.safeParse({
    ...Object.fromEntries(url.searchParams),
    executionId,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ executionId: string }> },
) {
  const context = await executionContext(request, params);
  if (!context.success) return invalidRequestResponse("INVALID_QUERY");

  try {
    const execution = await performanceMonitoringService.getExecution({
      id: context.data.executionId,
      masterRecordId: context.data.masterRecordId,
    });

    return NextResponse.json({ execution }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof PerformanceMonitoringServiceError) {
      return serviceErrorResponse(error);
    }
    return unexpectedErrorResponse();
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ executionId: string }> },
) {
  const context = await executionContext(request, params);
  if (!context.success) return invalidRequestResponse("INVALID_QUERY");

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return invalidRequestResponse("INVALID_BODY");
  }

  const parsed = executionActionSchema.safeParse(payload);
  if (!parsed.success) return invalidRequestResponse("INVALID_BODY");

  try {
    let execution: Awaited<
      ReturnType<typeof performanceMonitoringService.getExecution>
    >;

    if (parsed.data.action === "UPDATE") {
      const input = {
        id: context.data.executionId,
        masterRecordId: context.data.masterRecordId,
        changes: {
          actualStartAt: parsed.data.actualStartAt,
          executedDurationSeconds: parsed.data.executedDurationSeconds,
          executedRpe: parsed.data.executedRpe,
          notes: parsed.data.notes,
        },
      } satisfies Parameters<
        typeof performanceMonitoringService.updateInProgressExecution
      >[0];

      execution =
        await performanceMonitoringService.updateInProgressExecution(input);
    } else if (parsed.data.action === "COMPLETE") {
      const input = {
        id: context.data.executionId,
        masterRecordId: context.data.masterRecordId,
        actualEndAt: parsed.data.actualEndAt,
        executedDurationSeconds: parsed.data.executedDurationSeconds,
        executedRpe: parsed.data.executedRpe,
        notes: parsed.data.notes,
      } satisfies Parameters<
        typeof performanceMonitoringService.completeExecution
      >[0];

      execution = await performanceMonitoringService.completeExecution(input);
    } else {
      const input = {
        id: context.data.executionId,
        masterRecordId: context.data.masterRecordId,
        actualEndAt: parsed.data.actualEndAt,
        executedDurationSeconds: parsed.data.executedDurationSeconds,
        notes: parsed.data.notes,
      } satisfies Parameters<
        typeof performanceMonitoringService.cancelExecution
      >[0];

      execution = await performanceMonitoringService.cancelExecution(input);
    }

    return NextResponse.json({ execution }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof PerformanceMonitoringServiceError) {
      return serviceErrorResponse(error);
    }
    return unexpectedErrorResponse();
  }
}
