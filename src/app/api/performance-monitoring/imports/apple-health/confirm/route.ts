import { NextResponse } from "next/server";
import { z } from "zod";

import { performanceMonitoringService } from "@/features/performance-monitoring/service";
import {
  importErrorResponse,
  importNoStoreHeaders,
  xmlFromFormData,
} from "../route-helpers";

export const runtime = "nodejs";

const masterRecordIdSchema = z.uuid();

export async function POST(request: Request) {
  const parsed = await xmlFromFormData(request);
  if ("error" in parsed) {
    return NextResponse.json(
      { code: "INVALID_FILE", message: parsed.error },
      { status: 400, headers: importNoStoreHeaders },
    );
  }
  const masterRecordId = masterRecordIdSchema.safeParse(
    parsed.form.get("masterRecordId"),
  );
  const selectedIds = parsed.form
    .getAll("selectedId")
    .filter((value): value is string => typeof value === "string");
  if (!masterRecordId.success || selectedIds.length === 0) {
    return NextResponse.json(
      { code: "INVALID_INPUT", message: "Selecione o aluno e ao menos um treino." },
      { status: 400, headers: importNoStoreHeaders },
    );
  }

  try {
    const result = await performanceMonitoringService.importAppleHealthWorkouts({
      xml: parsed.xml,
      selectedIds,
      masterRecordId: masterRecordId.data,
    });
    return NextResponse.json(result, { headers: importNoStoreHeaders });
  } catch (error) {
    return importErrorResponse(error);
  }
}
