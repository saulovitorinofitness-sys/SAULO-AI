import { NextResponse } from "next/server";
import { z } from "zod";

import {
  patientPermanentRegistrationUpdateSchema,
  patientRegistrationRepository,
} from "@/features/patient-registration";
import { canAccess, mvpService } from "@/features/mvp";
import { isSessionAuthenticationError } from "@/features/mvp/session-authentication";

const noStoreHeaders = { "Cache-Control": "no-store" } as const;
const patientIdSchema = z.uuid();

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStoreHeaders });
}

async function getAuthenticatedSession() {
  try {
    return { session: await mvpService.getSession() } as const;
  } catch (error) {
    if (isSessionAuthenticationError(error)) {
      return {
        response: jsonError("Sessão ausente ou inválida.", 401),
      } as const;
    }

    console.error("Falha inesperada ao autenticar acesso ao cadastro permanente do paciente.");
    return {
      response: jsonError("Não foi possível processar a solicitação.", 500),
    } as const;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  void request;

  const authentication = await getAuthenticatedSession();
  if ("response" in authentication) {
    return authentication.response;
  }

  if (!canAccess(authentication.session, "PATIENTS", "READ")) {
    return jsonError("Você não possui permissão para visualizar este cadastro.", 403);
  }

  const parsedPatientId = patientIdSchema.safeParse((await params).patientId);
  if (!parsedPatientId.success) {
    return jsonError("Identificador do paciente inválido.", 400);
  }

  try {
    const registration = await patientRegistrationRepository.findPermanentRegistration(
      parsedPatientId.data,
      authentication.session.user.id,
    );

    if (!registration) {
      return jsonError("Paciente não encontrado.", 404);
    }

    return NextResponse.json(registration, { headers: noStoreHeaders });
  } catch {
    console.error("Falha inesperada ao consultar o cadastro permanente do paciente.");
    return jsonError("Não foi possível processar a solicitação.", 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const authentication = await getAuthenticatedSession();
  if ("response" in authentication) {
    return authentication.response;
  }

  if (!canAccess(authentication.session, "PATIENTS", "UPDATE")) {
    return jsonError("Você não possui permissão para editar este cadastro.", 403);
  }

  const parsedPatientId = patientIdSchema.safeParse((await params).patientId);
  if (!parsedPatientId.success) {
    return jsonError("Identificador do paciente inválido.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("O corpo da solicitação deve conter JSON válido.", 400);
  }

  const parsedBody = patientPermanentRegistrationUpdateSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError("Revise os dados cadastrais enviados.", 400);
  }

  try {
    const registration = await patientRegistrationRepository.updatePermanentRegistration(
      parsedPatientId.data,
      parsedBody.data,
      authentication.session.user.id,
    );

    if (!registration) {
      return jsonError("Paciente não encontrado.", 404);
    }

    return NextResponse.json(registration, { headers: noStoreHeaders });
  } catch {
    console.error("Falha inesperada ao atualizar o cadastro permanente do paciente.");
    return jsonError("Não foi possível processar a solicitação.", 500);
  }
}
