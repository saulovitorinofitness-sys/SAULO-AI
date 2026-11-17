import { BUILT_IN_IDS } from "@/modules/permissions";

export function salaryProofUserDecision(userId: string | null): "ALLOW" | "UNAUTHENTICATED" | "FORBIDDEN" {
  if (!userId) return "UNAUTHENTICATED";
  return userId === BUILT_IN_IDS.users.sauloXavierVitorino ? "ALLOW" : "FORBIDDEN";
}

export function salaryProofOwnershipMatches(input: {
  readonly receiptId: string;
  readonly evidenceReceiptId: string;
  readonly receiptUnitId: string;
  readonly evidenceUnitId: string;
  readonly statementId: string;
  readonly evidenceStatementId: string;
  readonly statementUnitId: string;
  readonly employmentUnitId: string;
  readonly employeeId: string;
  readonly evidenceEmployeeId: string;
}): boolean {
  return input.receiptId === input.evidenceReceiptId &&
    input.receiptUnitId === input.evidenceUnitId &&
    input.receiptUnitId === input.statementUnitId &&
    input.receiptUnitId === input.employmentUnitId &&
    input.statementId === input.evidenceStatementId &&
    input.employeeId === input.evidenceEmployeeId;
}
