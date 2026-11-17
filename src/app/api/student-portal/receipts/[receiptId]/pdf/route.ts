import { createStudentReceiptPdf } from "@/features/student-portal/receipt-pdf";
import {
  StudentPortalAccessError,
  studentPortalService,
} from "@/features/student-portal/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ receiptId: string }> },
) {
  try {
    const receipt = await studentPortalService.getReceipt((await params).receiptId);
    const pdf = createStudentReceiptPdf(receipt);
    const suffix = receipt.number ? String(receipt.number) : receipt.id.replace(/[^a-zA-Z0-9_-]/gu, "-");
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="recibo-clinica-sv-${suffix}.pdf"`,
        "Content-Length": String(pdf.length),
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof StudentPortalAccessError) {
      return Response.json(
        { message: error.reason === "UNAUTHENTICATED" ? "Autenticação necessária." : "Recibo não encontrado." },
        { status: error.reason === "UNAUTHENTICATED" ? 401 : 404 },
      );
    }
    throw error;
  }
}
