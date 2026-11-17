import { NextResponse } from "next/server";
import { z } from "zod";

import { FinancialError } from "@/features/financial/contracts";
import {
  canUseFinancial,
  financialAccessDenied,
  financialErrorResponse,
} from "@/features/financial/http";
import { financialService } from "@/features/financial/service";

const baseSchema = z.object({
  code: z.string().min(2).max(80),
  name: z.string().min(2).max(160),
});

const schemas = {
  categories: baseSchema.extend({
    type: z.enum(["REVENUE", "EXPENSE"]),
    businessUnitId: z.uuid().optional(),
  }),
  "cost-centers": baseSchema.extend({ businessUnitId: z.uuid() }),
  accounts: baseSchema.extend({
    type: z.enum(["CASH", "BANK", "DIGITAL_WALLET", "OTHER"]),
    businessUnitId: z.uuid(),
  }),
  "payment-methods": baseSchema.extend({
    type: z.enum([
      "CASH",
      "PIX",
      "DEBIT_CARD",
      "CREDIT_CARD",
      "BANK_TRANSFER",
      "BOLETO",
      "OTHER",
    ]),
  }),
} as const;

type Resource = keyof typeof schemas;

function isResource(value: string): value is Resource {
  return value in schemas;
}

function invalidInput() {
  return NextResponse.json(
    { error: "Revise os campos obrigatórios do cadastro." },
    { status: 400 },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  if (!(await canUseFinancial(request))) return financialAccessDenied();

  const { resource } = await context.params;
  if (!isResource(resource)) {
    return NextResponse.json({ error: "Cadastro financeiro inválido." }, { status: 404 });
  }
  const payload: unknown = await request.json();

  try {
    let item;
    if (resource === "categories") {
      const parsed = schemas.categories.safeParse(payload);
      if (!parsed.success) return invalidInput();
      item = await financialService.createCategory(parsed.data);
    } else if (resource === "cost-centers") {
      const parsed = schemas["cost-centers"].safeParse(payload);
      if (!parsed.success) return invalidInput();
      item = await financialService.createCostCenter(parsed.data);
    } else if (resource === "accounts") {
      const parsed = schemas.accounts.safeParse(payload);
      if (!parsed.success) return invalidInput();
      item = await financialService.createAccount(parsed.data);
    } else {
      const parsed = schemas["payment-methods"].safeParse(payload);
      if (!parsed.success) return invalidInput();
      item = await financialService.createPaymentMethod(parsed.data);
    }
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof FinancialError) return financialErrorResponse(error);
    throw error;
  }
}
