import type { SalaryPaymentMethod } from "./salary-receipt-contracts";

export type SalaryPaymentAccountType = "CASH" | "BANK" | "DIGITAL_WALLET" | "OTHER";

export function accountSupportsSalaryPayment(
  method: SalaryPaymentMethod,
  accountType: SalaryPaymentAccountType,
): boolean {
  if (method === "CASH") return accountType === "CASH";
  if (method === "BANK_DEPOSIT") return accountType === "BANK";
  return accountType === "BANK" || accountType === "DIGITAL_WALLET";
}

export function salaryPaymentDescription(employeeName: string, competence: string): string {
  const name = employeeName.trim() || "Funcionário não identificado";
  const month = /^\d{4}-\d{2}/u.test(competence) ? competence.slice(0, 7) : "competência não informada";
  return `Pagamento salarial — ${name} — ${month}`;
}

export function salarySettlementIdempotencyKey(statementId: string, requestId: string): string {
  return `payroll-salary:${statementId}:${requestId}`;
}
