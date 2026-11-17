import type { ManagementReceiptDocument } from "@/features/financial/management-documents/repository";

export type SalaryDocumentPreviewState = "demonstrativo" | "legado" | "recibo-confirmado";

const base = {
  id: "00000000-0000-4000-8000-000000000101",
  businessUnitId: "00000000-0000-4000-8000-000000000102",
  businessUnitName: "Academia Saulo Fitness",
  payrollStatementId: "00000000-0000-4000-8000-000000000103",
  employmentId: "00000000-0000-4000-8000-000000000104",
  employeeId: "00000000-0000-4000-8000-000000000105",
  employeeName: "Funcionária de demonstração",
  employmentCode: "MAT-001",
  jobRole: "Assistente administrativa",
  employmentType: "EMPLOYEE",
  competence: new Date("2026-08-01T00:00:00.000Z"),
  issuedAt: new Date("2026-09-10T15:00:00.000Z"),
  lineItems: [
    { code: "SALARY", description: "SALARY", type: "EARNING" as const, amount: "3200.00" },
    { code: "BENEFIT", description: "Auxílio alimentação", type: "BENEFIT" as const, amount: "350.00" },
    { code: "DEDUCTION", description: "Contribuição previdenciária", type: "DEDUCTION" as const, amount: "286.00" },
  ],
  totals: { gross: "3200.00", benefits: "350.00", deductions: "286.00", adjustments: "0.00", net: "3264.00" },
} as const;

export function salaryDocumentPreviewFixture(state: SalaryDocumentPreviewState): ManagementReceiptDocument {
  if (state === "recibo-confirmado") return {
    ...base,
    documentKind: "SALARY_RECEIPT",
    documentState: "CASH_AWAITING_SIGNATURE",
    documentNumber: "REC-202608-PRÉVIA",
    version: 1,
    employer: {
      unitName: "Academia Saulo Fitness",
      legalName: "Academia Saulo Fitness Ltda. (dado fictício)",
      tradeName: "Academia Saulo Fitness",
      legalTaxIdType: "CNPJ",
      maskedLegalTaxId: "**.***.***/****-00",
      address: "Endereço fictício para validação visual",
    },
    employee: {
      fullName: base.employeeName,
      maskedCpf: "***.***.***-00",
      maskedIdentityDocument: "••••0000",
      maskedSocialSecurityNumber: "••••0000",
      employmentCode: base.employmentCode,
      employmentType: base.employmentType,
      jobRole: base.jobRole,
    },
    payment: {
      paidAt: "2026-09-10",
      method: "CASH",
      amount: base.totals.net,
      bankReference: null,
      proofUrl: null,
    },
  };

  return {
    ...base,
    documentKind: state === "legado" ? "LEGACY_DEMONSTRATIVE" : "DEMONSTRATIVE",
    documentState: state === "legado" ? "LEGACY_UNCONFIRMED" : "DEMONSTRATIVE_AVAILABLE",
    documentNumber: state === "legado" ? "DEM-LEGADO-PRÉVIA" : "DEM-202608-PRÉVIA",
    version: state === "legado" ? 2 : 1,
  };
}
