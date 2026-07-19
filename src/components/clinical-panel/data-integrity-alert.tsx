import type { DataIntegrityIssue } from "@/features/clinical-collection";
import { CheckIcon } from "@/components/ui/icons";

export function DataIntegrityAlert({ issues }: { issues: readonly DataIntegrityIssue[] }) {
  if (!issues.length) return <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckIcon className="size-4" /></span><div><h2 className="text-sm font-black uppercase tracking-wide">Verificação da coleta</h2><p className="mt-1 text-sm">Coleta concluída e pronta para análise profissional.</p></div></section>;
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="alert"><h2 className="text-sm font-black uppercase tracking-wide text-amber-950">Verificação da coleta</h2><ul className="mt-3 space-y-2">{issues.map((issue) => <li className="flex gap-2 text-sm text-amber-900" key={issue.id}><span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-amber-500" /><span><strong>{issue.section}:</strong> {issue.message}</span></li>)}</ul></section>
  );
}
