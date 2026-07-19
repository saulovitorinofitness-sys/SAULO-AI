import type { BusinessDataImport, DashboardImportImpact, ImportReportType, ImportWorkspaceView, MappingTemplate } from "./contracts";

export const importTargetFields = [
  ["name", "Nome do aluno"], ["customer_code", "Código do cliente"], ["cpf", "CPF"], ["phone", "Telefone"], ["email", "E-mail"], ["birth_date", "Data de nascimento"], ["sex", "Sexo"], ["status", "Status"], ["plan", "Plano"], ["enrollment_date", "Data de matrícula"], ["cancellation_date", "Data de cancelamento"], ["last_access_date", "Data do último acesso"], ["access_count", "Quantidade de acessos"], ["plan_value", "Valor do plano"], ["due_date", "Vencimento"], ["financial_status", "Situação financeira"], ["lead_source", "Origem do lead"], ["unit", "Unidade"], ["notes", "Observações"],
] as const;

export const reportTypeLabels: Readonly<Record<ImportReportType, string>> = {
  active_students: "Alunos ativos", blocked_students: "Alunos bloqueados", cancelled_students: "Alunos cancelados", new_enrollments: "Novas matrículas", attendance: "Frequência", delinquency: "Inadimplência", accounts_receivable: "Contas a receber", receipts: "Recebimentos", cancellations: "Cancelamentos", plans: "Planos", crm_leads: "CRM e leads", schedule: "Agenda", general_customers: "Relatório geral de clientes",
};

export const requiredFieldsByReport: Readonly<Record<ImportReportType, readonly string[]>> = {
  active_students: ["name", "customer_code", "status"], blocked_students: ["name", "customer_code", "status"], cancelled_students: ["name", "customer_code", "cancellation_date"], new_enrollments: ["name", "customer_code", "enrollment_date"], attendance: ["name", "customer_code", "last_access_date", "access_count"], delinquency: ["name", "customer_code", "financial_status"], accounts_receivable: ["customer_code", "plan_value", "due_date"], receipts: ["customer_code", "plan_value"], cancellations: ["name", "customer_code", "cancellation_date"], plans: ["plan", "plan_value"], crm_leads: ["name", "phone", "lead_source"], schedule: ["name", "customer_code"], general_customers: ["name", "customer_code"],
};

export const mappingTemplates: readonly MappingTemplate[] = [
  { id: "tpl-active", name: "Next Fit — Alunos ativos", reportType: "active_students", mappings: { "Nome do cliente": "name", "Código": "customer_code", "CPF": "cpf", "Telefone": "phone", "Status": "status", "Plano": "plan", "Data de matrícula": "enrollment_date" } },
  { id: "tpl-blocked", name: "Next Fit — Bloqueados", reportType: "blocked_students", mappings: { "Cliente": "name", "Código": "customer_code", "Situação": "status", "Plano": "plan" } },
  { id: "tpl-cancel", name: "Next Fit — Cancelamentos", reportType: "cancelled_students", mappings: { "Cliente": "name", "Código": "customer_code", "Data cancelamento": "cancellation_date", "Observação": "notes" } },
  { id: "tpl-attendance", name: "Next Fit — Frequência", reportType: "attendance", mappings: { "Cliente": "name", "Código": "customer_code", "Último acesso": "last_access_date", "Acessos": "access_count" } },
  { id: "tpl-finance", name: "Next Fit — Financeiro", reportType: "accounts_receivable", mappings: { "Código": "customer_code", "Valor": "plan_value", "Vencimento": "due_date", "Situação": "financial_status" } },
  { id: "tpl-crm", name: "Next Fit — CRM", reportType: "crm_leads", mappings: { "Nome": "name", "Telefone": "phone", "E-mail": "email", "Origem": "lead_source", "Status": "status" } },
];

const demoNames = ["Ana Martins", "Bruno Almeida", "Carla Nogueira", "Daniel Souza", "Elisa Ribeiro", "Felipe Lima"];
export function getDemoRows(reportType: ImportReportType): { headers: string[]; rows: Record<string, string | number | null>[] } {
  const rows = demoNames.map((name, index) => ({ "Nome do cliente": name, Código: `NF-${101 + index}`, CPF: index === 4 ? null : `000.000.00${index}-00`, Telefone: `(11) 90000-000${index}`, Status: index === 3 ? "Status não cadastrado" : "Ativo", Plano: index === 5 ? "Plano não reconhecido" : "Mensal", "Data de matrícula": index === 2 ? "data inválida" : `0${index + 1}/07/2026`, "Último acesso": `1${index}/07/2026`, Acessos: index === 1 ? "N/A" : index + 3, Valor: index === 4 ? null : 199.9, Vencimento: `2${index}/07/2026`, Origem: "Instagram" }));
  if (reportType === "attendance") return { headers: ["Nome do cliente", "Código", "Último acesso", "Acessos"], rows };
  if (reportType === "accounts_receivable" || reportType === "receipts" || reportType === "delinquency") return { headers: ["Nome do cliente", "Código", "Valor", "Vencimento", "Status"], rows };
  if (reportType === "crm_leads") return { headers: ["Nome do cliente", "Telefone", "Origem", "Status"], rows };
  return { headers: ["Nome do cliente", "Código", "CPF", "Telefone", "Status", "Plano", "Data de matrícula"], rows: [...rows, { ...rows[0] }] };
}

const history: readonly BusinessDataImport[] = [
  { id: "import-001", source: "nextfit", reportType: "active_students", fileName: "alunos_ativos_semana_28.xlsx", fileFormat: "xlsx", status: "completed_with_warnings", totalRows: 218, validRows: 211, warningRows: 7, invalidRows: 0, duplicates: 2, period: "06 a 12/07/2026", importedAt: "2026-07-13T08:42:00-03:00", importedBy: "Saulo Xavier Vitorino" },
  { id: "import-002", source: "nextfit", reportType: "attendance", fileName: "frequencia_julho.csv", fileFormat: "csv", status: "completed", totalRows: 194, validRows: 194, warningRows: 0, invalidRows: 0, duplicates: 0, period: "01 a 15/07/2026", importedAt: "2026-07-15T18:10:00-03:00", importedBy: "Saulo Xavier Vitorino" },
  { id: "import-003", source: "nextfit", reportType: "accounts_receivable", fileName: "financeiro_1607.xls", fileFormat: "xls", status: "review", totalRows: 42, validRows: 36, warningRows: 4, invalidRows: 2, duplicates: 0, period: "Julho/2026", importedAt: "2026-07-16T09:20:00-03:00", importedBy: "Saulo Xavier Vitorino" },
];

export const dashboardImportImpactMock: DashboardImportImpact = { activeStudents: 214, blockedStudents: 9, cancellations: 5, newEnrollments: 18, delinquentStudents: 12, averageAttendance: "3,4 acessos/semana", gymRevenue: "R$ 42.780", averageTicket: "R$ 199" };
export const importWorkspaceMock: ImportWorkspaceView = { professionalName: "Saulo Xavier Vitorino", lastImportAt: "2026-07-16T09:20:00-03:00", importedThisWeek: 3, processedRecords: 454, inconsistencies: 13, history, templates: mappingTemplates, dashboardImpact: dashboardImportImpactMock };

