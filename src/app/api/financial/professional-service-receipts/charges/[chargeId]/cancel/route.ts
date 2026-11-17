import { professionalReceiptHandlers } from "../../../handlers";

export const runtime = "nodejs";

type Context = { params: Promise<{ chargeId: string }> };

export async function POST(request: Request, context: Context) {
  return professionalReceiptHandlers.cancelPaidCharge(request, (await context.params).chargeId);
}
