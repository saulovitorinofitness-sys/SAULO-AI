import { NextResponse } from "next/server";

import {
  NextFitDreError,
  nextFitDreService,
} from "@/features/financial/nextfit-dre/server";
import {
  canUseFinancial,
  financialAccessDenied,
  resolveFinancialAccess,
} from "@/features/financial/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await canUseFinancial(request))) return financialAccessDenied();
  const data = await request.formData().catch(() => null);
  const file = data?.get("file");
  const expectedHash = data?.get("expectedHash");
  const baseYearValue = data?.get("baseYear");
  const baseYear = typeof baseYearValue === "string" && baseYearValue
    ? Number(baseYearValue)
    : undefined;
  const lastClosedMonthValue = data?.get("lastClosedMonth");
  const lastClosedMonth = typeof lastClosedMonthValue === "string" && lastClosedMonthValue
    ? Number(lastClosedMonthValue)
    : undefined;
  if (!(file instanceof File) || typeof expectedHash !== "string" || !expectedHash) {
    return NextResponse.json(
      { message: "Arquivo ou identificação da prévia ausente." },
      { status: 400 },
    );
  }

  try {
    const access = await resolveFinancialAccess(request);
    const batch = await nextFitDreService.confirm({
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      expectedHash,
      importedByUserId: access.user.id,
      baseYear,
      lastClosedMonth,
    });
    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    if (error instanceof NextFitDreError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.code === "DUPLICATE_FILE" ? 409 : 400 },
      );
    }
    console.error("Falha ao confirmar lote da DRE NextFit.", error);
    return NextResponse.json(
      { message: "Não foi possível registrar o lote da DRE NextFit." },
      { status: 503 },
    );
  }
}
