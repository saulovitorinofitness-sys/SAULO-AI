import { professionalReceiptHandlers } from "../../handlers";

export const runtime = "nodejs";

type Context = { params: Promise<{ chargeId: string }> };

export async function GET(request: Request, context: Context) {
  return professionalReceiptHandlers.getCharge(request, (await context.params).chargeId);
}

export async function DELETE(request: Request, context: Context) {
  return professionalReceiptHandlers.deleteDraftCharge(request, (await context.params).chargeId);
}
