import { NextResponse } from "next/server";
import { z } from "zod";

import { FinancialError } from "@/features/financial/contracts";
import {
  canUseFinancial,
  financialAccessDenied,
  financialErrorResponse,
} from "@/features/financial/http";
import { financialService } from "@/features/financial/service";

const updateEntrySchema = z.object({
  type: z.enum(["REVENUE", "EXPENSE"]).optional(),
  competence: z.iso.date().optional(),
  dueDate: z.iso.date().optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  description: z.string().trim().min(1).max(300).optional(),
  observation: z.string().trim().max(4000).nullable().optional(),
  businessUnitId: z.uuid().optional(),
  financialCategoryId: z.uuid().optional(),
  costCenterId: z.uuid().nullable().optional(),
  financialAccountId: z.uuid().nullable().optional(),
  paymentMethodId: z.uuid().nullable().optional(),
  managementNature: z.enum(["PLANNED", "FORECAST", "REALIZED"]).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ entryId: string }> },
) {
  if (!(await canUseFinancial(request))) return financialAccessDenied();
  const { entryId } = await context.params;
  if (!z.uuid().safeParse(entryId).success) {
    return NextResponse.json({ message: "Lançamento inválido." }, { status: 400 });
  }

  const parsed = updateEntrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Revise os dados do lançamento financeiro." },
      { status: 400 },
    );
  }

  try {
    const entry = await financialService.update(entryId, parsed.data);
    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof FinancialError) return financialErrorResponse(error);
    console.error("Falha ao atualizar lançamento financeiro.", error);
    return NextResponse.json(
      { message: "Não foi possível atualizar o lançamento financeiro." },
      { status: 503 },
    );
  }
}
