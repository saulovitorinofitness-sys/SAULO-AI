import { NextResponse } from "next/server";

import {
  NextFitReceiptsError,
  nextFitReceiptsService,
} from "@/features/financial/nextfit-receipts/server";
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
  if (!(file instanceof File) || typeof expectedHash !== "string" || !expectedHash) {
    return NextResponse.json(
      { message: "Arquivo ou identificação da prévia ausente." },
      { status: 400 },
    );
  }

  try {
    const access = await resolveFinancialAccess(request);
    const batch = await nextFitReceiptsService.confirm({
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      expectedHash,
      importedByUserId: access.user.id,
    });
    return NextResponse.json(
      { batch },
      { status: batch.operation === "CREATED" ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof NextFitReceiptsError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.code === "DUPLICATE_FILE" ? 409 : 400 },
      );
    }
    console.error("Falha ao confirmar recebimentos NextFit.", error);
    return NextResponse.json(
      { message: "Não foi possível importar os recebimentos NextFit." },
      { status: 503 },
    );
  }
}
