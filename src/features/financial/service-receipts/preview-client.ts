import type { ProfessionalReceiptPreview } from "./preview";

export type ReceiptPreviewFetch = (input: string, init: RequestInit) => Promise<Pick<Response, "ok" | "json">>;

export async function loadProfessionalReceiptPreview(
  chargeId: string,
  fetcher: ReceiptPreviewFetch,
  headers: HeadersInit,
  signal?: AbortSignal,
): Promise<ProfessionalReceiptPreview> {
  const response = await fetcher(
    `/api/financial/professional-service-receipts/charges/${encodeURIComponent(chargeId)}/preview`,
    { method: "GET", cache: "no-store", credentials: "same-origin", headers, signal },
  );
  const body = await response.json() as { preview?: ProfessionalReceiptPreview; message?: string };
  if (!response.ok || !body.preview) throw new Error(body.message ?? "Prévia não encontrada.");
  return body.preview;
}

export function printProfessionalReceiptPreview(print: () => void): void {
  print();
}
