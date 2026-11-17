import { NextResponse } from "next/server";

import {
  NextFitReceiptsError,
  nextFitReceiptsService,
} from "@/features/financial/nextfit-receipts/server";
import {
  canUseFinancial,
  financialAccessDenied,
} from "@/features/financial/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await canUseFinancial(request))) return financialAccessDenied();
  const data = await request.formData().catch(() => null);
  const file = data?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "Selecione o relatório XLS/XLSX de recebimentos NextFit." },
      { status: 400 },
    );
  }

  try {
    const preview = await nextFitReceiptsService.inspect(
      file.name,
      new Uint8Array(await file.arrayBuffer()),
    );
    return NextResponse.json({ preview });
  } catch (error) {
    if (error instanceof NextFitReceiptsError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.code === "DUPLICATE_FILE" ? 409 : 400 },
      );
    }
    console.error("Falha ao gerar prévia dos recebimentos NextFit.", error);
    return NextResponse.json(
      { message: "Não foi possível interpretar o relatório de recebimentos NextFit." },
      { status: 503 },
    );
  }
}
