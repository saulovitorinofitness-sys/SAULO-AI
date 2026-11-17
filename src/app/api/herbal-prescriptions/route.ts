import { NextResponse } from "next/server";

import {
  HerbalPrescriptionValidationError,
  herbalPrescriptionService,
} from "@/features/herbal-prescriptions/service";
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
    return jsonError("FORBIDDEN", "Sem permissão para criar prescrições de fitoterápicos.", 403);
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
  const prescriptionId = typeof body.prescriptionId === "string" ? body.prescriptionId : undefined;

  try {
    const result = body.action === "ISSUE"
      ? await herbalPrescriptionService.issue({
          patientId,
          prescriptionId: prescriptionId ?? "",
          actorUserId: access.user.id,
          content: body.content,
        })
      : body.action === "SAVE_DRAFT"
        ? await herbalPrescriptionService.saveDraft({
            patientId,
            prescriptionId,
            actorUserId: access.user.id,
            content: body.content,
          })
        : null;
    if (!result) return jsonError("INVALID_ACTION", "Ação inválida.", 400);
    return NextResponse.json({ prescription: result });
  } catch (error) {
    if (error instanceof HerbalPrescriptionValidationError) {
      return jsonError(error.code, error.message, 400);
    }
    const code = error instanceof Error ? error.message : "HERBAL_PRESCRIPTION_FAILED";
    if (code === "HERBAL_PRESCRIPTION_PATIENT_NOT_FOUND") {
      return jsonError(code, "Pessoa não encontrada no prontuário.", 404);
    }
    if (code === "HERBAL_PRESCRIPTION_DRAFT_NOT_FOUND") {
      return jsonError(code, "O rascunho não existe ou já foi emitido.", 409);
    }
    if (code === "HERBAL_PRESCRIPTION_EDIT_CONFLICT") {
      return jsonError(code, "O rascunho foi atualizado em outra sessão. Reabra antes de editar.", 409);
    }
    console.error("herbal-prescription", error);
    return jsonError("HERBAL_PRESCRIPTION_FAILED", "Não foi possível salvar a prescrição.", 500);
  }
}
