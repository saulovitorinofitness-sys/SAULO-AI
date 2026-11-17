import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccess, mvpService } from "@/features/mvp";
import { isSessionAuthenticationError } from "@/features/mvp/session-authentication";
import {
  StudentPortalAccessError,
  studentPortalService,
} from "@/features/student-portal/service";

const noStoreHeaders = { "Cache-Control": "no-store" } as const;
const patientIdSchema = z.uuid();

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  void request;
  let session: Awaited<ReturnType<typeof mvpService.getSession>>;
  try {
    session = await mvpService.getSession();
  } catch (error) {
    if (isSessionAuthenticationError(error)) {
      return response({ message: "Sessão ausente ou inválida." }, 401);
    }
    return response({ message: "Não foi possível processar a solicitação." }, 500);
  }
  if (!canAccess(session, "PATIENTS", "UPDATE")) {
    return response({ message: "Você não possui permissão para gerar convites." }, 403);
  }

  const parsedPatientId = patientIdSchema.safeParse((await params).patientId);
  if (!parsedPatientId.success) {
    return response({ message: "Identificador do paciente inválido." }, 400);
  }

  try {
    const invitation = await studentPortalService.createInvitation({
      patientId: parsedPatientId.data,
      invitedByUserId: session.user.id,
    });
    return response({
      activationPath: `/portal/ativar?token=${encodeURIComponent(invitation.token)}`,
      expiresAt: invitation.expiresAt.toISOString(),
      singleUse: true,
    }, 201);
  } catch (error) {
    if (error instanceof StudentPortalAccessError) {
      return response({ message: "Paciente ou prontuário não encontrado." }, 404);
    }
    if (error instanceof Error && error.message === "STUDENT_PORTAL_ALREADY_LINKED") {
      return response({ message: "Este paciente já possui acesso ao Portal do Aluno." }, 409);
    }
    return response({ message: "Não foi possível gerar o convite." }, 500);
  }
}
