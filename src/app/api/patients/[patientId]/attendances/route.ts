import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveDevelopmentAccess } from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";
import {
  CLINICAL_ATTENDANCE_TYPES,
  patientRegistrationRepository,
} from "@/features/patient-registration";

const inputSchema = z.object({
  clinicalType: z.enum(CLINICAL_ATTENDANCE_TYPES),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const [{ patientId }, session] = await Promise.all([
    params,
    mvpService.getSession(),
  ]);
  const access = resolveDevelopmentAccess(request, session);

  if (!canAccess(access, "ATTENDANCE", "CREATE")) {
    return NextResponse.json(
      { message: "Seu perfil não permite criar atendimentos." },
      { status: 403 },
    );
  }
  if (!z.uuid().safeParse(patientId).success) {
    return NextResponse.json({ message: "Paciente inválido." }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Selecione um tipo de atendimento válido." },
      { status: 400 },
    );
  }

  try {
    const result = await patientRegistrationRepository.createClinicalAttendance(
      patientId,
      parsed.data.clinicalType,
      access.user.id,
    );
    if (!result.created) {
      return NextResponse.json(
        {
          message: "Já existe um atendimento aberto para este paciente.",
          attendanceId: result.attendanceId,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      FIRST_CONSULTATION_NOT_ALLOWED:
        "Primeira consulta não está disponível para paciente com histórico.",
      PREVIOUS_ATTENDANCE_REQUIRED:
        "Este tipo exige um atendimento anterior concluído.",
      PATIENT_NOT_FOUND: "Paciente ou prontuário ativo não encontrado.",
      PROFESSIONAL_NOT_FOUND: "Profissional autenticado não encontrado.",
    };
    if (messages[code]) {
      return NextResponse.json(
        { message: messages[code] },
        { status: code === "PATIENT_NOT_FOUND" ? 404 : 409 },
      );
    }
    console.error("Falha ao criar atendimento clínico.", error);
    return NextResponse.json(
      { message: "Não foi possível criar o atendimento." },
      { status: 503 },
    );
  }
}
