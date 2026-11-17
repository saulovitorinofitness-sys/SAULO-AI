import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccess, mvpService } from "@/features/mvp";
import { isSessionAuthenticationError } from "@/features/mvp/session-authentication";
import {
  StudentPortalAccessError,
  studentPortalService,
} from "@/features/student-portal/service";

const patientIdSchema = z.uuid();
const releaseSchema = z.object({
  contentType: z.enum([
    "DIET",
    "WORKOUT",
    "ASSESSMENTS",
    "POSTURAL_MEDIA",
    "PAYMENTS",
  ]),
  released: z.boolean(),
}).strict();
const headers = { "Cache-Control": "no-store" } as const;

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers });
}

async function authorizedSession(action: "READ" | "UPDATE") {
  try {
    const session = await mvpService.getSession();
    return canAccess(session, "PATIENTS", action)
      ? { session } as const
      : { response: response({ message: "Acesso não permitido." }, 403) } as const;
  } catch (error) {
    return {
      response: response(
        { message: isSessionAuthenticationError(error) ? "Sessão inválida." : "Erro interno." },
        isSessionAuthenticationError(error) ? 401 : 500,
      ),
    } as const;
  }
}

async function patientId(params: Promise<{ patientId: string }>) {
  return patientIdSchema.safeParse((await params).patientId);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  void request;
  const authorization = await authorizedSession("READ");
  if ("response" in authorization) return authorization.response;
  const parsed = await patientId(params);
  if (!parsed.success) return response({ message: "Paciente inválido." }, 400);
  try {
    return response(await studentPortalService.getPatientAccess(parsed.data));
  } catch (error) {
    return response(
      { message: "Paciente não encontrado." },
      error instanceof StudentPortalAccessError ? 404 : 500,
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const authorization = await authorizedSession("UPDATE");
  if ("response" in authorization) return authorization.response;
  const parsedPatientId = await patientId(params);
  if (!parsedPatientId.success) return response({ message: "Paciente inválido." }, 400);
  const parsedBody = releaseSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return response({ message: "Liberação inválida." }, 400);
  try {
    await studentPortalService.setRelease({
      patientId: parsedPatientId.data,
      actorUserId: authorization.session.user.id,
      ...parsedBody.data,
    });
    return response(await studentPortalService.getPatientAccess(parsedPatientId.data));
  } catch (error) {
    return response(
      { message: "Não foi possível atualizar a liberação." },
      error instanceof StudentPortalAccessError ? 404 : 500,
    );
  }
}
