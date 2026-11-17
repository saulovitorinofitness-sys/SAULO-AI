import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveDevelopmentAccess } from "@/features/development-session";
import { canAccess, mvpService } from "@/features/mvp";
import { patientRegistrationRepository } from "@/features/patient-registration";

const paramsSchema = z.object({
  patientId: z.uuid(),
  attendanceId: z.uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ patientId: string; attendanceId: string }> },
) {
  const [parsedParams, session] = await Promise.all([
    paramsSchema.safeParseAsync(await params),
    mvpService.getSession(),
  ]);
  if (!parsedParams.success) {
    return NextResponse.json({ message: "Paciente ou atendimento inválido." }, { status: 400 });
  }
  const access = resolveDevelopmentAccess(request, session);
  if (!canAccess(access, "ATTENDANCE", "UPDATE")) {
    return NextResponse.json({ message: "Seu perfil não permite iniciar atendimentos." }, { status: 403 });
  }

  try {
    const result = await patientRegistrationRepository.startClinicalAttendance(
      parsedParams.data.patientId,
      parsedParams.data.attendanceId,
      access.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ATTENDANCE_NOT_FOUND") {
      return NextResponse.json({ message: "Atendimento preparado não encontrado." }, { status: 404 });
    }
    console.error("Falha ao iniciar atendimento preparado.", error);
    return NextResponse.json({ message: "Não foi possível iniciar o atendimento." }, { status: 503 });
  }
}
