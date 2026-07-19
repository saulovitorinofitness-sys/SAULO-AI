import { Card, SectionHeader } from "@/components/ui";
import type { ImportValidation } from "@/features/business-import";
import { ImportStatusBadge } from "./import-status-badge";

export function FileValidationSummary({ validation }: { validation: ImportValidation }) {
  const fields = [["Linhas", validation.rowCount], ["Colunas", validation.columnCount], ["Linhas vazias", validation.emptyRows], ["Cabeçalhos duplicados", validation.duplicateColumns.length], ["Inconsistências", validation.issues.length]] as const;
  return <Card className="p-5 md:p-6"><SectionHeader action={<ImportStatusBadge status={validation.status} />} description="Validação estrutural, sem interpretação empresarial." title="3. Validação do arquivo" /><dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">{fields.map(([label, value]) => <div className="rounded-xl bg-[var(--surface-elevated)] p-3" key={label}><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 text-xl font-black">{value}</dd></div>)}</dl></Card>;
}
