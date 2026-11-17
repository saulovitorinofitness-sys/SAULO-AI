import { NextResponse } from "next/server";

import { PerformanceMonitoringServiceError } from "@/features/performance-monitoring/service";

export const importNoStoreHeaders = { "Cache-Control": "no-store" } as const;

export function importErrorResponse(error: unknown) {
  if (error instanceof PerformanceMonitoringServiceError) {
    const status = {
      AUTHENTICATION_REQUIRED: 401,
      CONFLICT: 409,
      FORBIDDEN: 403,
      INVALID_INPUT: 400,
      INVALID_STATE: 409,
      NOT_FOUND: 404,
      PERSISTENCE_ERROR: 503,
    }[error.code];
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status, headers: importNoStoreHeaders },
    );
  }
  return NextResponse.json(
    { code: "INTERNAL_ERROR", message: "Não foi possível processar o XML." },
    { status: 503, headers: importNoStoreHeaders },
  );
}

export async function xmlFromFormData(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return { error: "Não foi possível ler o formulário enviado." } as const;
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLocaleLowerCase().endsWith(".xml")) {
    return { error: "Selecione um arquivo XML exportado pelo app Saúde." } as const;
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: "O XML deve ter no máximo 10 MB." } as const;
  }
  return { form, xml: await file.text() } as const;
}
