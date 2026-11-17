import { z } from "zod";

import { resolveFinancialAccess } from "@/features/financial/http";
import { professionalReceiptPreviewService, ProfessionalServiceReceiptServiceError } from "@/features/financial/service-receipts";

export const runtime = "nodejs";

type Context = { params: Promise<{ chargeId: string }> };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request, context: Context) {
  let userId: string;
  try { userId = (await resolveFinancialAccess(request)).user.id; }
  catch { return json({ code: "UNAUTHENTICATED", message: "Entre novamente para continuar." }, 401); }
  const { chargeId } = await context.params;
  if (!z.uuid().safeParse(chargeId).success) return json({ code: "NOT_FOUND" }, 404);
  try {
    return json({ preview: await professionalReceiptPreviewService.getPreview(chargeId, userId) });
  } catch (error) {
    if (error instanceof ProfessionalServiceReceiptServiceError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "NOT_AUTHORIZED" ? 403 : 422;
      return json({ code: error.code, message: error.message }, status);
    }
    return json({ code: "UNAVAILABLE", message: "Não foi possível abrir a prévia do recibo." }, 503);
  }
}
