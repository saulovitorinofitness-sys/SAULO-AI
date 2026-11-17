import { professionalReceiptHandlers } from "../../../handlers";

export const runtime = "nodejs";

type Context = { params: Promise<{ receiptId: string }> };

export async function POST(request: Request, context: Context) {
  return professionalReceiptHandlers.cancelReceipt(request, (await context.params).receiptId);
}
