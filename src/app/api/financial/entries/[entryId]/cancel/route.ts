import { NextResponse } from "next/server";
import { z } from "zod";

import { FinancialError } from "@/features/financial/contracts";
import {
  canUseFinancial,
  financialAccessDenied,
  financialErrorResponse,
} from "@/features/financial/http";
import { financialService } from "@/features/financial/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ entryId: string }> },
) {
  if (!(await canUseFinancial(request))) return financialAccessDenied();
  const { entryId } = await context.params;
  if (!z.uuid().safeParse(entryId).success) {
    return NextResponse.json({ message: "Lançamento inválido." }, { status: 400 });
  }

  try {
    const entry = await financialService.cancel(entryId);
    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof FinancialError) return financialErrorResponse(error);
    console.error("Falha ao cancelar lançamento financeiro.", error);
    return NextResponse.json(
      { message: "Não foi possível cancelar o lançamento financeiro." },
      { status: 503 },
    );
  }
}
