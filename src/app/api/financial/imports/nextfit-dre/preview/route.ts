import { NextResponse } from "next/server";

import {
  NextFitDreError,
  nextFitDreService,
} from "@/features/financial/nextfit-dre/server";
import {
  canUseFinancial,
  financialAccessDenied,
} from "@/features/financial/http";

export const runtime = "nodejs";

function errorResponse(error: NextFitDreError) {
  const status = error.code === "DUPLICATE_FILE" ? 409 : 400;
  return NextResponse.json({ code: error.code, message: error.message }, { status });
}

export async function POST(request: Request) {
  if (!(await canUseFinancial(request))) return financialAccessDenied();
  const data = await request.formData().catch(() => null);
  const file = data?.get("file");
  const baseYearValue = data?.get("baseYear");
  const baseYear = typeof baseYearValue === "string" && baseYearValue
    ? Number(baseYearValue)
    : undefined;
  const lastClosedMonthValue = data?.get("lastClosedMonth");
  const lastClosedMonth = typeof lastClosedMonthValue === "string" && lastClosedMonthValue
    ? Number(lastClosedMonthValue)
    : undefined;
  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "Selecione o arquivo XLS/XLSX da DRE NextFit." },
      { status: 400 },
    );
  }

  try {
    const preview = await nextFitDreService.inspect(
      file.name,
      new Uint8Array(await file.arrayBuffer()),
      baseYear,
      lastClosedMonth,
    );
    return NextResponse.json({ preview });
  } catch (error) {
    if (error instanceof NextFitDreError) return errorResponse(error);
    console.error("Falha ao gerar prévia da DRE NextFit.", error);
    return NextResponse.json(
      { message: "Não foi possível interpretar a planilha DRE NextFit." },
      { status: 503 },
    );
  }
}
