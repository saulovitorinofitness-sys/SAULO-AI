import { NextResponse } from "next/server";
import { z } from "zod";

import { FinancialError } from "@/features/financial/contracts";
import {
  canUseFinancial,
  financialAccessDenied,
  financialErrorResponse,
} from "@/features/financial/http";
import { financialService } from "@/features/financial/service";

const academyReceiptSchema = z.object({
  receiptDate: z.iso.date(),
  amount: z.union([z.number(), z.string()]),
  description: z.string().trim().min(1).max(300),
  reference: z.string().trim().max(4000).optional(),
  financialAccountId: z.uuid(),
  paymentMethodId: z.uuid(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export async function POST(request: Request) {
  if (!(await canUseFinancial(request))) return financialAccessDenied();

  const parsed = academyReceiptSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Revise os dados do recebimento." },
      { status: 400 },
    );
  }

  try {
    const entry = await financialService.recordAcademyReceipt(parsed.data);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof FinancialError) return financialErrorResponse(error);
    throw error;
  }
}
