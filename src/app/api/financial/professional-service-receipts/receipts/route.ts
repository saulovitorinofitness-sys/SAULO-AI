import { professionalReceiptHandlers } from "../handlers";

export const runtime = "nodejs";

export const GET = professionalReceiptHandlers.listReceipts;
export const POST = professionalReceiptHandlers.issueReceipt;
