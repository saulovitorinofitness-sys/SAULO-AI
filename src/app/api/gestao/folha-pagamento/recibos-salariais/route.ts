import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveFinancialAccess } from "@/features/financial/http";
import {
  confirmSalaryPayment,
  getSalaryPaymentCandidate,
  SalaryPaymentError,
} from "@/features/financial/payroll/salary-payment-backend";
import { MAX_PAYROLL_PROOF_BYTES, PayrollProofError } from "@/features/financial/payroll/salary-payment-file";
import { BUILT_IN_IDS } from "@/modules/permissions";

export const runtime = "nodejs";

const inputSchema = z.object({
  businessUnitId: z.uuid(),
  payrollStatementId: z.uuid(),
  financialAccountId: z.uuid(),
  paymentMethodId: z.uuid(),
  idempotencyKey: z.uuid(),
  paidAt: z.iso.date(),
  method: z.enum(["CASH", "PIX", "BANK_TRANSFER", "BANK_DEPOSIT"]),
  paidAmount: z.string().regex(/^(0|[1-9]\d*)\.\d{2}$/),
  bankReference: z.string().trim().min(1).max(180).regex(/^[^\u0000-\u001f\u007f]+$/u).nullable(),
}).strict();

const querySchema = z.object({
  businessUnitId: z.uuid(),
  payrollStatementId: z.uuid(),
}).strict();

const noStore = { "Cache-Control": "private, no-store" };
const MAX_MULTIPART_BYTES = MAX_PAYROLL_PROOF_BYTES + 64 * 1024;

async function boundedFormData(request: Request): Promise<FormData | null> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;") || !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_MULTIPART_BYTES) throw new PayrollProofError("FILE_TOO_LARGE");
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: bytes }).formData();
}

function salaryPaymentErrorResponse(error: SalaryPaymentError) {
  const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404
    : error.code === "DUPLICATE" || error.code === "IDEMPOTENCY_CONFLICT" ? 409 : 400;
  const messages: Record<SalaryPaymentError["code"], string> = {
    FORBIDDEN: "Seu perfil não pode confirmar pagamentos salariais.",
    NOT_FOUND: "O demonstrativo não foi encontrado nesta unidade.",
    INVALID_PAYMENT: "O pagamento não atende aos requisitos do recibo salarial.",
    DUPLICATE: "Este pagamento já possui recibo ou comprovante registrado.",
    IDEMPOTENCY_CONFLICT: "A tentativa de emissão não corresponde à solicitação original.",
    INVALID_IDENTITY: "Não foi possível validar os dados legais protegidos.",
  };
  return NextResponse.json(
    { code: error.code, message: messages[error.code] },
    { status, headers: noStore },
  );
}

export async function GET(request: Request) {
  let access;
  try { access = await resolveFinancialAccess(request); }
  catch {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "Entre novamente para continuar." },
      { status: 401, headers: noStore },
    );
  }
  if (access.user.id !== BUILT_IN_IDS.users.sauloXavierVitorino) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Seu perfil não pode confirmar pagamentos salariais." },
      { status: 403, headers: noStore },
    );
  }
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { code: "INVALID_INPUT", message: "Informe a unidade e o demonstrativo válidos." },
      { status: 400, headers: noStore },
    );
  }
  try {
    const candidate = await getSalaryPaymentCandidate({
      ...parsed.data,
      actorUserId: access.user.id,
    });
    return NextResponse.json({ candidate }, { headers: noStore });
  } catch (error) {
    if (error instanceof SalaryPaymentError) return salaryPaymentErrorResponse(error);
    return NextResponse.json(
      { code: "UNAVAILABLE", message: "Não foi possível validar o pagamento agora." },
      { status: 503, headers: noStore },
    );
  }
}

export async function POST(request: Request) {
  let access;
  try { access = await resolveFinancialAccess(request); }
  catch { return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401, headers: noStore }); }
  if (access.user.id !== BUILT_IN_IDS.users.sauloXavierVitorino) {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403, headers: noStore });
  }
  let form: FormData | null;
  try { form = await boundedFormData(request); }
  catch (error) {
    return NextResponse.json({ code: error instanceof PayrollProofError ? error.code : "INVALID_INPUT" },
      { status: error instanceof PayrollProofError ? 413 : 400, headers: noStore });
  }
  const payload = form?.get("payload");
  const proofFile = form?.get("proof");
  let payloadValue: unknown = null;
  if (typeof payload === "string") {
    try { payloadValue = JSON.parse(payload); } catch { payloadValue = null; }
  }
  const parsed = inputSchema.safeParse(payloadValue);
  if (!parsed.success || (proofFile !== null && proofFile !== undefined && !(proofFile instanceof File))) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400, headers: noStore });
  }
  if (proofFile instanceof File && proofFile.size > MAX_PAYROLL_PROOF_BYTES) {
    return NextResponse.json({ code: "FILE_TOO_LARGE" }, { status: 413, headers: noStore });
  }
  try {
    const result = await confirmSalaryPayment({
      ...parsed.data,
      actorUserId: access.user.id,
      proof: proofFile instanceof File ? {
        name: proofFile.name, mimeType: proofFile.type,
        bytes: new Uint8Array(await proofFile.arrayBuffer()),
      } : null,
    });
    return NextResponse.json(result, { status: result.repeated ? 200 : 201, headers: noStore });
  } catch (error) {
    if (error instanceof PayrollProofError) {
      return NextResponse.json({ code: error.code }, { status: error.code === "FILE_TOO_LARGE" ? 413 : 400, headers: noStore });
    }
    if (error instanceof SalaryPaymentError) {
      return salaryPaymentErrorResponse(error);
    }
    return NextResponse.json(
      { code: "UNAVAILABLE", message: "Não foi possível emitir o recibo agora." },
      { status: 503, headers: noStore },
    );
  }
}
