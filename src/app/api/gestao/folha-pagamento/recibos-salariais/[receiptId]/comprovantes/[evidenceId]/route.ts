import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveFinancialAccess } from "@/features/financial/http";
import { salaryProofOwnershipMatches, salaryProofUserDecision } from "@/features/financial/payroll/salary-payment-access";
import { createPrivatePayrollProofResponse } from "@/features/financial/payroll/salary-payment-proof-stream";
import { prisma } from "@/lib/database/prisma";

export const runtime = "nodejs";

type Context = { params: Promise<{ receiptId: string; evidenceId: string }> };
type ProofRow = Parameters<typeof salaryProofOwnershipMatches>[0] & {
  mimeType: "application/pdf" | "image/jpeg" | "image/png"; byteLength: number;
};
type ChunkRow = { chunk: Uint8Array };

const secureHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request, context: Context) {
  let access;
  try { access = await resolveFinancialAccess(request); }
  catch { return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401, headers: secureHeaders }); }
  if (salaryProofUserDecision(access.user.id) !== "ALLOW") {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403, headers: secureHeaders });
  }
  const params = await context.params;
  if (!z.uuid().safeParse(params.receiptId).success || !z.uuid().safeParse(params.evidenceId).success) {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404, headers: secureHeaders });
  }
  let found: ProofRow[];
  try {
    found = await prisma.$queryRaw<ProofRow[]>`
      SELECT e."mimeType", e."byteLength", r."id" AS "receiptId", e."receiptId" AS "evidenceReceiptId",
        r."businessUnitId" AS "receiptUnitId", e."businessUnitId" AS "evidenceUnitId",
        s."id" AS "statementId", e."payrollStatementId" AS "evidenceStatementId",
        s."businessUnitId" AS "statementUnitId", v."businessUnitId" AS "employmentUnitId",
        v."employeeId" AS "employeeId", e."employeeId" AS "evidenceEmployeeId"
      FROM "PayrollReceiptEvidence" e
      JOIN "PayrollReceipt" r ON r."id" = e."receiptId" AND r."kind" = 'SALARY_RECEIPT'
      JOIN "PayrollStatement" s ON s."id" = r."payrollStatementId" AND s."businessUnitId" = r."businessUnitId"
      JOIN "Employment" v ON v."id" = s."employmentId" AND v."businessUnitId" = s."businessUnitId"
      JOIN "PayrollPaymentEvidenceBlob" b ON b."evidenceId" = e."id"
      WHERE r."id" = ${params.receiptId}::uuid AND e."id" = ${params.evidenceId}::uuid
        AND e."kind" = 'BANK_PROOF' AND e."businessUnitId" = r."businessUnitId"
        AND e."payrollStatementId" = s."id" AND e."employeeId" = v."employeeId"
        AND e."byteLength" = OCTET_LENGTH(b."content")`;
  } catch {
    return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503, headers: secureHeaders });
  }
  const proof = found[0];
  if (!proof || !salaryProofOwnershipMatches(proof) ||
    !["application/pdf", "image/jpeg", "image/png"].includes(proof.mimeType) ||
    proof.byteLength < 1 || proof.byteLength > 10 * 1024 * 1024) {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404, headers: secureHeaders });
  }

  return createPrivatePayrollProofResponse(proof, async (offset, length) => {
    const rows = await prisma.$queryRaw<ChunkRow[]>`
      SELECT SUBSTRING(b."content" FROM ${offset} FOR ${length}) AS "chunk"
      FROM "PayrollPaymentEvidenceBlob" b
      JOIN "PayrollReceiptEvidence" e ON e."id" = b."evidenceId"
      JOIN "PayrollReceipt" r ON r."id" = e."receiptId" AND r."kind" = 'SALARY_RECEIPT'
      JOIN "PayrollStatement" s ON s."id" = r."payrollStatementId" AND s."businessUnitId" = r."businessUnitId"
      JOIN "Employment" v ON v."id" = s."employmentId" AND v."businessUnitId" = s."businessUnitId"
      WHERE r."id" = ${params.receiptId}::uuid AND e."id" = ${params.evidenceId}::uuid
        AND e."kind" = 'BANK_PROOF' AND e."businessUnitId" = r."businessUnitId"
        AND e."payrollStatementId" = s."id" AND e."employeeId" = v."employeeId"`;
    return rows[0]?.chunk ?? new Uint8Array();
  });
}
