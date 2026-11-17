import { NextResponse } from "next/server";

import {
  ExamRequestValidationError,
  examRequestService,
} from "@/features/exam-requests/service";
import { canAccess, mvpService } from "@/features/mvp";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ code, message }, { status });
}

export async function POST(request: Request) {
  let access: Awaited<ReturnType<typeof mvpService.getSession>>;
  try {
    access = await mvpService.getSession();
  } catch {
    return jsonError("UNAUTHENTICATED", "Entre novamente para continuar.", 401);
  }
  if (
    !canAccess(access, "MASTER_RECORD", "READ") ||
    !canAccess(access, "DELIVERABLES", "CREATE")
  ) {
    return jsonError("FORBIDDEN", "Sem permissão para criar solicitações de exames.", 403);
  }

  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    body = value as Record<string, unknown>;
  } catch {
    return jsonError("INVALID_JSON", "Conteúdo da requisição inválido.", 400);
  }
  const patientId = typeof body.patientId === "string" ? body.patientId : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : undefined;
  const action = body.action;

  try {
    const result = action === "ISSUE"
      ? await examRequestService.issue({
          patientId,
          requestId: requestId ?? "",
          actorUserId: access.user.id,
          content: body.content,
        })
      : action === "SAVE_DRAFT"
        ? await examRequestService.saveDraft({
            patientId,
            requestId,
            actorUserId: access.user.id,
            content: body.content,
          })
        : null;
    if (!result) return jsonError("INVALID_ACTION", "Ação inválida.", 400);
    return NextResponse.json({ request: result });
  } catch (error) {
    if (error instanceof ExamRequestValidationError) {
      return jsonError(error.code, error.message, 400);
    }
    const code = error instanceof Error ? error.message : "EXAM_REQUEST_FAILED";
    if (code === "EXAM_REQUEST_PATIENT_NOT_FOUND") {
      return jsonError(code, "Pessoa não encontrada no prontuário.", 404);
    }
    if (code === "EXAM_REQUEST_DRAFT_NOT_FOUND") {
      return jsonError(code, "O rascunho não existe ou já foi emitido.", 409);
    }
    if (code === "EXAM_REQUEST_EDIT_CONFLICT") {
      return jsonError(code, "O rascunho foi atualizado em outra sessão. Reabra antes de editar.", 409);
    }
    console.error("exam-request", error);
    return jsonError("EXAM_REQUEST_FAILED", "Não foi possível salvar a solicitação.", 500);
  }
}
