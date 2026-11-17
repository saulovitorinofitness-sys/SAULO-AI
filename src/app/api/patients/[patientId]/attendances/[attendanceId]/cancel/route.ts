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
    return NextResponse.json({ message: "Seu perfil não permite cancelar atendimentos." }, { status: 403 });
  }

  try {
    const result = await patientRegistrationRepository.cancelPreparedAttendance(
      parsedParams.data.patientId,
      parsedParams.data.attendanceId,
      access.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ATTENDANCE_NOT_CANCELLABLE" || code === "ATTENDANCE_NOT_EMPTY") {
      return NextResponse.json(
        { message: code === "ATTENDANCE_NOT_EMPTY" ? "O atendimento possui dados associados e não pode ser cancelado como preparado." : "Somente um atendimento preparado e ainda não iniciado pode ser cancelado." },
        { status: 409 },
      );
    }
    console.error("Falha ao cancelar atendimento preparado.", error);
    return NextResponse.json({ message: "Não foi possível cancelar o atendimento." }, { status: 503 });
  }
}
