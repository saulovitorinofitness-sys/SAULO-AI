import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveFinancialAccess } from "@/features/financial/http";
import { reverseSalaryPayment, SalaryPaymentError } from "@/features/financial/payroll/salary-payment-backend";
import { isSessionAuthenticationError } from "@/features/mvp/session-authentication";
import { BUILT_IN_IDS } from "@/modules/permissions";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const inputSchema = z.object({
  businessUnitId: z.uuid(),
  idempotencyKey: z.uuid(),
  reason: z.string().trim().min(10).max(500).regex(/^[^\u0000-\u001f\u007f]+$/u),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ receiptId: string }> }) {
  let access;
  try { access = await resolveFinancialAccess(request); }
  catch (error) {
    return NextResponse.json({ code: isSessionAuthenticationError(error) ? "UNAUTHENTICATED" : "SESSION_UNAVAILABLE" },
      { status: isSessionAuthenticationError(error) ? 401 : 503, headers: noStore });
  }
  if (access.user.id !== BUILT_IN_IDS.users.sauloXavierVitorino) {
    return NextResponse.json({ code: "FORBIDDEN", message: "Seu perfil não pode estornar pagamentos salariais." }, { status: 403, headers: noStore });
  }
  const [{ receiptId }, payload] = await Promise.all([context.params, request.json().catch(() => null)]);
  const parsed = z.uuid().safeParse(receiptId);
  const input = inputSchema.safeParse(payload);
  if (!parsed.success || !input.success) {
    return NextResponse.json({ code: "INVALID_INPUT", message: "Informe um motivo com pelo menos 10 caracteres." }, { status: 400, headers: noStore });
  }
  try {
    const result = await reverseSalaryPayment({ ...input.data, receiptId: parsed.data, actorUserId: access.user.id });
    return NextResponse.json(result, { status: result.repeated ? 200 : 201, headers: noStore });
  } catch (error) {
    if (!(error instanceof SalaryPaymentError)) {
      return NextResponse.json({ code: "UNAVAILABLE", message: "Não foi possível concluir o estorno com segurança." }, { status: 503, headers: noStore });
    }
    const messages: Record<SalaryPaymentError["code"], string> = {
      FORBIDDEN: "Seu perfil não pode estornar pagamentos salariais.",
      NOT_FOUND: "O recibo salarial não foi encontrado nesta unidade.",
      INVALID_PAYMENT: "Os vínculos do pagamento não permitem um estorno seguro.",
      DUPLICATE: "Já existe outra operação para este pagamento.",
      IDEMPOTENCY_CONFLICT: "A repetição não corresponde ao pedido original.",
      INVALID_IDENTITY: "Não foi possível validar a identidade protegida.",
      ALREADY_REVERSED: "Este pagamento já foi estornado anteriormente.",
    };
    return NextResponse.json({ code: error.code, message: messages[error.code] },
      { status: error.code === "NOT_FOUND" ? 404 : error.code === "ALREADY_REVERSED" ? 409 : 400, headers: noStore });
  }
}
