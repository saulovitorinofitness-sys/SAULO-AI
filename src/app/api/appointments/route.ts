import { NextResponse } from "next/server";
import { z } from "zod";

import {
  resolveDevelopmentAccess,
} from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";
import {
  SchedulingError,
  schedulingRepository,
} from "@/features/scheduling/repository";

const createAppointmentSchema = z
  .object({
    masterRecordId: z.uuid().optional(),
    contactName: z.string().trim().min(2).max(180).optional(),
    contactPhone: z.string().trim().min(8).max(30).optional(),
    professionalUserId: z.uuid(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    status: z.enum(["SCHEDULED", "CONFIRMED"]),
    notes: z.string().trim().max(4000).optional(),
  })
  .superRefine((input, context) => {
    if (!input.masterRecordId && (!input.contactName || !input.contactPhone)) {
      context.addIssue({
        code: "custom",
        message:
          "Selecione um paciente cadastrado ou informe nome e telefone do novo contato.",
        path: ["masterRecordId"],
      });
    }
  });

function schedulingErrorResponse(error: SchedulingError) {
  const status =
    error.code === "CONFLICT" || error.code === "VERSION_CONFLICT"
      ? 409
      : error.code === "APPOINTMENT_NOT_FOUND" ||
          error.code === "MASTER_RECORD_NOT_FOUND"
        ? 404
        : 400;

  return NextResponse.json({ message: error.message }, { status });
}

export async function POST(request: Request) {
  const access = resolveDevelopmentAccess(
    request,
    await mvpService.getSession(),
  );

  if (!canAccess(access, "SCHEDULING", "CREATE")) {
    return NextResponse.json(
      { message: "Seu perfil não permite criar agendamentos." },
      { status: 403 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Não foi possível interpretar os dados enviados." },
      { status: 400 },
    );
  }

  const parsed = createAppointmentSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Revise os dados do agendamento." },
      { status: 400 },
    );
  }

  try {
    const { masterRecordId, contactName, contactPhone, ...details } =
      parsed.data;
    const identity = masterRecordId
      ? { masterRecordId }
      : {
          contactName: contactName as string,
          contactPhone: contactPhone as string,
        };
    const appointment = await schedulingRepository.create(
      {
        ...details,
        ...identity,
        notes: details.notes || undefined,
      },
      access.user.id,
    );
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    if (error instanceof SchedulingError) {
      return schedulingErrorResponse(error);
    }

    console.error("Falha ao criar agendamento clínico.", error);
    return NextResponse.json(
      { message: "Não foi possível criar o agendamento." },
      { status: 503 },
    );
  }
}
