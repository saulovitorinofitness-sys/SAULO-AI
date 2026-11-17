type SalaryPresentationType = "EARNING" | "BENEFIT" | "DEDUCTION" | "ADJUSTMENT_CREDIT" | "ADJUSTMENT_DEBIT";

const internalCodeLabels: Readonly<Record<string, string>> = {
  SALARY: "Salário base",
  SALARIO_BASE: "Salário base",
  EARNING: "Provento salarial",
  BENEFIT: "Benefício",
  DEDUCTION: "Desconto",
  ADJUSTMENT_CREDIT: "Ajuste de crédito",
  ADJUSTMENT_DEBIT: "Ajuste de débito",
};

const fallbackLabels: Readonly<Record<SalaryPresentationType, string>> = {
  EARNING: "Provento salarial",
  BENEFIT: "Benefício",
  DEDUCTION: "Desconto",
  ADJUSTMENT_CREDIT: "Ajuste de crédito",
  ADJUSTMENT_DEBIT: "Ajuste de débito",
};

function normalizedInternalCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/gu, "_");
}

function looksLikeInternalCode(value: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/u.test(value);
}

export function salaryLineDescription(input: {
  readonly code: string;
  readonly description: string;
  readonly type: SalaryPresentationType;
}): string {
  const description = input.description.trim();
  const normalizedDescription = normalizedInternalCode(description);
  const mappedDescription = internalCodeLabels[normalizedDescription];
  if (mappedDescription) return mappedDescription;
  if (description && normalizedDescription !== normalizedInternalCode(input.code) && !looksLikeInternalCode(description)) return description;
  return internalCodeLabels[normalizedInternalCode(input.code)] ?? fallbackLabels[input.type];
}

export function employmentTypeLabel(value: string): string {
  return value === "EMPLOYEE" ? "Empregado" : "Vínculo empregatício";
}
