import { NextResponse } from "next/server";
import { z } from "zod";

import { FinancialError } from "@/features/financial/contracts";
import {
  canUseFinancial,
  financialAccessDenied,
  financialErrorResponse,
} from "@/features/financial/http";
import { financialService } from "@/features/financial/service";

const optionalText = z.string().trim().max(4000).optional();
const settlementSchema = z.object({
  amount: z.union([z.number(), z.string()]),
  settlementDate: z.iso.date(),
  financialAccountId: z.uuid(),
  paymentMethodId: z.uuid(),
  observation: optionalText,
  idempotencyKey: z.string().trim().min(8).max(200),
});
const createEntrySchema = z.object({
  type: z.enum(["REVENUE", "EXPENSE"]),
  competence: z.iso.date(),
  dueDate: z.iso.date(),
  amount: z.union([z.number(), z.string()]),
  description: z.string().trim().min(1).max(300),
  observation: optionalText,
  businessUnitId: z.uuid(),
  financialCategoryId: z.uuid(),
  costCenterId: z.uuid().optional(),
  financialAccountId: z.uuid().optional(),
  paymentMethodId: z.uuid().optional(),
  origin: z.enum(["MANUAL", "EXTERNAL_IMPORT", "INTERNAL_INTEGRATION"]).optional(),
  sourceSystem: z.enum(["NEXTFIT", "CLINICA_SV", "GESTAO_SV"]).optional(),
  managementNature: z.enum(["PLANNED", "FORECAST", "REALIZED"]).optional(),
  sourceType: z.string().trim().max(100).optional(),
  sourceId: z.string().trim().max(200).optional(),
  importBatchId: z.uuid().optional(),
  settlement: settlementSchema.optional(),
});

export async function POST(request: Request) {
  if (!(await canUseFinancial(request))) return financialAccessDenied();

  const parsed = createEntrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Revise os dados do lançamento financeiro." },
      { status: 400 },
    );
  }

  try {
    const { settlement, ...entryInput } = parsed.data;
    const entry = settlement
      ? await financialService.createAndSettle({
          entry: entryInput,
          settlement,
        })
      : await financialService.create(entryInput);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof FinancialError) return financialErrorResponse(error);
    console.error("Falha ao criar lançamento financeiro.", error);
    return NextResponse.json(
      { message: "Não foi possível criar o lançamento financeiro." },
      { status: 503 },
    );
  }
}
