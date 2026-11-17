import { NextResponse } from "next/server";
import { z } from "zod";

import { FinancialError } from "@/features/financial/contracts";
import {
  canUseFinancial,
  financialAccessDenied,
  financialErrorResponse,
} from "@/features/financial/http";
import { financialService } from "@/features/financial/service";

const updateSchema = z
  .object({
    code: z.string().min(2).max(80).optional(),
    name: z.string().min(2).max(160).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

const resources = [
  "categories",
  "cost-centers",
  "accounts",
  "payment-methods",
] as const;
type Resource = (typeof resources)[number];

function isResource(value: string): value is Resource {
  return resources.includes(value as Resource);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ resource: string; referenceId: string }> },
) {
  if (!(await canUseFinancial(request))) return financialAccessDenied();

  const { resource, referenceId } = await context.params;
  if (!isResource(resource) || !z.uuid().safeParse(referenceId).success) {
    return NextResponse.json({ error: "Cadastro financeiro inválido." }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Nenhuma alteração válida foi informada." }, { status: 400 });
  }

  try {
    const item =
      resource === "categories"
        ? await financialService.updateCategory(referenceId, parsed.data)
        : resource === "cost-centers"
          ? await financialService.updateCostCenter(referenceId, parsed.data)
          : resource === "accounts"
            ? await financialService.updateAccount(referenceId, parsed.data)
            : await financialService.updatePaymentMethod(referenceId, parsed.data);
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof FinancialError) return financialErrorResponse(error);
    throw error;
  }
}
