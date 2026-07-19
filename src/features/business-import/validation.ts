import type { ImportColumn, ImportIssue, ImportPreviewRow, ImportReportType, ImportTargetField, ImportValidation, ParsedImportFile } from "./contracts";
import { requiredFieldsByReport } from "./mock-data";

const dateFields: readonly ImportTargetField[] = ["birth_date", "enrollment_date", "cancellation_date", "last_access_date", "due_date"];
const numberFields: readonly ImportTargetField[] = ["access_count", "plan_value"];
const knownStatuses = ["ativo", "bloqueado", "cancelado", "inadimplente", "em dia", "lead"];
const validDate = (value: unknown) => typeof value === "string" && (/^\d{2}\/\d{2}\/\d{4}$/.test(value) || /^\d{4}-\d{2}-\d{2}/.test(value));

export function buildColumns(headers: readonly string[], reportType: ImportReportType, template?: Readonly<Record<string, ImportTargetField>>): ImportColumn[] {
  const required = requiredFieldsByReport[reportType];
  return headers.map((sourceColumn) => { const targetField = template?.[sourceColumn]; return { sourceColumn, targetField, required: Boolean(targetField && required.includes(targetField)), ignored: false }; });
}

export function validateImport(parsed: ParsedImportFile, columns: readonly ImportColumn[], reportType: ImportReportType): { validation: ImportValidation; preview: ImportPreviewRow[] } {
  const duplicateColumns = parsed.headers.filter((header, index) => parsed.headers.indexOf(header) !== index);
  const issues: ImportIssue[] = duplicateColumns.map((column, index) => ({ id: `duplicate-column-${index}`, column, type: "unmapped_column", message: `Cabeçalho duplicado: ${column}.`, severity: "error" }));
  columns.filter((column) => !column.targetField && !column.ignored).forEach((column, index) => issues.push({ id: `unmapped-${index}`, column: column.sourceColumn, type: "unmapped_column", message: `Coluna ${column.sourceColumn} ainda não foi mapeada.`, severity: "warning" }));
  requiredFieldsByReport[reportType].filter((field) => !columns.some((column) => column.targetField === field && !column.ignored)).forEach((field, index) => issues.push({ id: `required-mapping-${index}`, type: "missing_required_field", message: `O campo obrigatório ${field} ainda não possui coluna associada.`, severity: "error" }));
  const seen = new Set<string>();
  const preview = parsed.rawRows.map((raw, rowIndex): ImportPreviewRow => {
    const rowNumber = rowIndex + 2; const rowIssues: ImportIssue[] = []; const values: Record<string, string | number | null> = {};
    columns.forEach((column) => {
      if (!column.targetField || column.ignored) return;
      const value = raw[column.sourceColumn] ?? null; values[column.targetField] = value;
      if (column.required && (value === null || String(value).trim() === "")) rowIssues.push({ id: `required-${rowNumber}-${column.targetField}`, rowNumber, column: column.sourceColumn, type: "missing_required_field", message: `${column.sourceColumn} é obrigatório para este relatório.`, severity: "error" });
      else if (value === null || String(value).trim() === "") rowIssues.push({ id: `empty-${rowNumber}-${column.targetField}`, rowNumber, column: column.sourceColumn, type: "empty_value", message: `Valor vazio em ${column.sourceColumn}.`, severity: "information" });
      if (value !== null && dateFields.includes(column.targetField) && !validDate(value)) rowIssues.push({ id: `date-${rowNumber}-${column.targetField}`, rowNumber, column: column.sourceColumn, type: "invalid_date", message: `Data inválida em ${column.sourceColumn}.`, severity: "error" });
      if (value !== null && numberFields.includes(column.targetField) && Number.isNaN(Number(String(value).replace(",", ".")))) rowIssues.push({ id: `number-${rowNumber}-${column.targetField}`, rowNumber, column: column.sourceColumn, type: "invalid_number", message: `Número inválido em ${column.sourceColumn}.`, severity: "error" });
      if (column.targetField === "status" && value && !knownStatuses.includes(String(value).toLowerCase())) rowIssues.push({ id: `status-${rowNumber}`, rowNumber, column: column.sourceColumn, type: "unknown_status", message: "Status não reconhecido; requer revisão.", severity: "warning" });
      if (column.targetField === "plan" && String(value).toLowerCase().includes("não reconhecido")) rowIssues.push({ id: `plan-${rowNumber}`, rowNumber, column: column.sourceColumn, type: "unknown_plan", message: "Plano não reconhecido; requer confirmação.", severity: "warning" });
    });
    const key = String(values.customer_code ?? values.cpf ?? "").trim();
    if (key && seen.has(key)) rowIssues.push({ id: `duplicate-${rowNumber}`, rowNumber, type: "duplicate", message: "Registro potencialmente duplicado.", severity: "warning" }); else if (key) seen.add(key);
    const status = rowIssues.some((issue) => issue.type === "duplicate") ? "duplicate" : rowIssues.some((issue) => issue.severity === "error") ? "invalid" : rowIssues.length ? "warning" : "valid";
    return { id: `preview-${rowNumber}`, rowNumber, values, issues: rowIssues, status };
  });
  const allIssues = [...issues, ...preview.flatMap((row) => row.issues)];
  return { validation: { status: allIssues.some((issue) => issue.severity === "error") ? "valid_with_warnings" : allIssues.length ? "awaiting_review" : "valid", rowCount: parsed.rawRows.length, columnCount: parsed.headers.length, emptyRows: 0, duplicateColumns, issues: allIssues }, preview };
}
