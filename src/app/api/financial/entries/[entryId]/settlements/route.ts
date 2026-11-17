import { NextResponse } from "next/server";
import { z } from "zod";

import { FinancialError } from "@/features/financial/contracts";
import {
  canUseFinancial,
  financialAccessDenied,
  financialErrorResponse,
} from "@/features/financial/http";
import { financialService } from "@/features/financial/service";

const settlementSchema = z.object({
  amount: z.union([z.number(), z.string()]),
  settlementDate: z.iso.date(),
  financialAccountId: z.uuid(),
  paymentMethodId: z.uuid(),
  observation: z.string().trim().max(4000).optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ entryId: string }> },
) {
  if (!(await canUseFinancial(request))) return financialAccessDenied();
  const { entryId } = await context.params;
  if (!z.uuid().safeParse(entryId).success) {
    return NextResponse.json({ message: "Lançamento inválido." }, { status: 400 });
  }

  const parsed = settlementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Revise os dados da liquidação." },
      { status: 400 },
    );
  }

  try {
    const entry = await financialService.settle({
      financialEntryId: entryId,
      ...parsed.data,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof FinancialError) return financialErrorResponse(error);
    console.error("Falha ao registrar liquidação financeira.", error);
    return NextResponse.json(
      { message: "Não foi possível registrar a liquidação." },
      { status: 503 },
    );
  }
}
