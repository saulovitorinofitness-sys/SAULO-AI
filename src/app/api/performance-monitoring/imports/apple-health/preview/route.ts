import { NextResponse } from "next/server";

import { performanceMonitoringService } from "@/features/performance-monitoring/service";
import {
  importErrorResponse,
  importNoStoreHeaders,
  xmlFromFormData,
} from "../route-helpers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await xmlFromFormData(request);
  if ("error" in parsed) {
    return NextResponse.json(
      { code: "INVALID_FILE", message: parsed.error },
      { status: 400, headers: importNoStoreHeaders },
    );
  }
  try {
    const workouts = await performanceMonitoringService.previewAppleHealthImport(
      parsed.xml,
    );
    return NextResponse.json({ workouts }, { headers: importNoStoreHeaders });
  } catch (error) {
    return importErrorResponse(error);
  }
}
