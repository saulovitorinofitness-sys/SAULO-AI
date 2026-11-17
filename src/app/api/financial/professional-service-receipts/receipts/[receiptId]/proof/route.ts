import { professionalReceiptHandlers } from "../../../handlers";

export const runtime = "nodejs";

type Context = { params: Promise<{ receiptId: string }> };

export async function GET(request: Request, context: Context) {
  return professionalReceiptHandlers.getPrivateProof(request, (await context.params).receiptId);
}
