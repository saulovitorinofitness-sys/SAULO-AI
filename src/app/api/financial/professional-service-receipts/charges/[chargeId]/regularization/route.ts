import { z } from "zod";

import { resolveFinancialAccess } from "@/features/financial/http";
import {
  professionalReceiptRegularizationService,
  ProfessionalServiceReceiptServiceError,
} from "@/features/financial/service-receipts";

export const runtime = "nodejs";

type Context = { params: Promise<{ chargeId: string }> };

const uuid = z.uuid();
const correction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("UPDATE_CUSTOMER_CPF"), cpf: z.string().min(1).max(20) }).strict(),
  z.object({ action: z.literal("CONFIGURE_SERIES"), series: z.string().min(1).max(40) }).strict(),
]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function actor(request: Request) {
  try { return (await resolveFinancialAccess(request)).user.id; }
  catch { return null; }
}

function failure(error: unknown) {
  if (error instanceof ProfessionalServiceReceiptServiceError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "NOT_AUTHORIZED" ? 403 : 422;
    return json({ code: error.code, message: error.message }, status);
  }
  return json({ code: "UNAVAILABLE", message: "Não foi possível regularizar este recebimento." }, 503);
}

export async function GET(request: Request, context: Context) {
  const userId = await actor(request);
  if (!userId) return json({ code: "UNAUTHENTICATED", message: "Entre novamente para continuar." }, 401);
  const { chargeId } = await context.params;
  if (!uuid.safeParse(chargeId).success) return json({ code: "NOT_FOUND" }, 404);
  try { return json({ regularization: await professionalReceiptRegularizationService.overview(chargeId, userId) }); }
  catch (error) { return failure(error); }
}

export async function PATCH(request: Request, context: Context) {
  const userId = await actor(request);
  if (!userId) return json({ code: "UNAUTHENTICATED", message: "Entre novamente para continuar." }, 401);
  const { chargeId } = await context.params;
  if (!uuid.safeParse(chargeId).success) return json({ code: "NOT_FOUND" }, 404);
  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const parsed = correction.safeParse(body);
  if (!parsed.success) return json({ code: "INVALID_INPUT", message: "Revise os dados informados." }, 400);
  try {
    const regularization = parsed.data.action === "UPDATE_CUSTOMER_CPF"
      ? await professionalReceiptRegularizationService.updateCustomerCpf(chargeId, parsed.data.cpf, userId)
      : await professionalReceiptRegularizationService.configureSeries(chargeId, parsed.data.series, userId);
    return json({ regularization });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, context: Context) {
  const userId = await actor(request);
  if (!userId) return json({ code: "UNAUTHENTICATED", message: "Entre novamente para continuar." }, 401);
  const { chargeId } = await context.params;
  if (!uuid.safeParse(chargeId).success) return json({ code: "NOT_FOUND" }, 404);
  try { return json(await professionalReceiptRegularizationService.retryIssuance(chargeId, userId)); }
  catch (error) { return failure(error); }
}
