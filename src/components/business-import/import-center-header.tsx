import { Button, Card, SectionHeader } from "@/components/ui";
import type { ImportWorkspaceView } from "@/features/business-import";

const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
export function ImportCenterHeader({ view, onNew }: { view: ImportWorkspaceView; onNew: () => void }) {
  const metrics = [["Última importação", formatDate(view.lastImportAt)], ["Arquivos na semana", String(view.importedThisWeek)], ["Registros processados", String(view.processedRecords)], ["Inconsistências", String(view.inconsistencies)]];
  return <Card className="p-5 md:p-6"><SectionHeader action={<Button onClick={onNew}>Nova importação</Button>} description="Selecione, valide e revise relatórios empresariais antes da simulação." eyebrow="Gestão · processamento local" title="Importação de Relatórios" /><dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3.5" key={label}><dt className="text-xs font-bold text-[var(--muted)]">{label}</dt><dd className="mt-1 text-lg font-black text-[var(--text-primary)]">{value}</dd></div>)}</dl></Card>;
}

