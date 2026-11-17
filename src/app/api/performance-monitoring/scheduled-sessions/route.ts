import { NextResponse } from "next/server";
import { z } from "zod";

import { PERFORMANCE_MODALITIES } from "@/features/performance-monitoring/contracts";
import {
  PerformanceMonitoringServiceError,
  performanceMonitoringService,
  type CreateScheduledSessionServiceInput,
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

const timeZoneSchema = z.string().trim().min(1).refine(
  (value) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Informe um fuso horário válido." },
);

const createScheduledSessionSchema = z
  .object({
    masterRecordId: z.uuid(),
    workoutPlanEntryId: z.uuid(),
    workoutPlanVersionId: z.uuid(),
    sessionId: z.uuid().optional(),
    title: z.string().trim().min(1),
    modality: z.enum(PERFORMANCE_MODALITIES),
    scheduledStartAt: isoDateTimeSchema,
    plannedDurationSeconds: z.number().int().positive().optional(),
    timeZone: timeZoneSchema,
    notes: z.string().optional(),
  })
  .strict();

function invalidRequestResponse(code: "INVALID_BODY" | "INVALID_QUERY") {
  const message =
    code === "INVALID_QUERY"
      ? "Informe masterRecordId, from e to válidos para consultar o calendário."
      : "Revise os dados da sessão programada.";

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
  console.error(
    "Falha não mapeada na API de sessões programadas de Performance.",
  );
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
    const scheduledSessions = await performanceMonitoringService.listCalendar(
      parsed.data.masterRecordId,
      { from: parsed.data.from, to: parsed.data.to },
    );

    return NextResponse.json(
      { scheduledSessions },
      { headers: noStoreHeaders },
    );
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

  const parsed = createScheduledSessionSchema.safeParse(payload);
  if (!parsed.success) return invalidRequestResponse("INVALID_BODY");

  const input = parsed.data satisfies CreateScheduledSessionServiceInput;

  try {
    const scheduledSession =
      await performanceMonitoringService.createScheduledSession(input);

    return NextResponse.json(
      { scheduledSession },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof PerformanceMonitoringServiceError) {
      return serviceErrorResponse(error);
    }
    return unexpectedErrorResponse();
  }
}
