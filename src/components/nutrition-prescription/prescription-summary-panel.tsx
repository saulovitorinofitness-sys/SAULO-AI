import { Card, SectionHeader, StatusBadge } from "@/components/ui";
import type { PrescriptionMealDraft } from "@/features/nutrition-prescription";

const formatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });

export function PrescriptionSummaryPanel({ drafts, responsibleProfessional, lastEditedAt }: { drafts: readonly PrescriptionMealDraft[]; responsibleProfessional: string; lastEditedAt: string }) {
  const entryCount = drafts.reduce((total, draft) => total + draft.entries.length, 0);
  const substitutionCount = drafts.reduce((total, draft) => total + draft.entries.reduce((sum, entry) => sum + entry.substitutions.length, 0), 0);
  const observations = drafts.filter((draft) => draft.observations.trim()).length;
  const metrics = [["Número de refeições", drafts.length], ["Quantidade de itens", entryCount], ["Substituições", substitutionCount], ["Refeições com observações", observations]] as const;
  return <Card className="p-5 md:p-6"><SectionHeader action={<StatusBadge label="Rascunho local" status="in_progress" />} description="Resumo estrutural, sem calorias, macros ou recomendação automática." eyebrow="Painel 4" title="Resumo da prescrição" /><dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(([label, value]) => <div className="rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface-elevated)] p-4" key={label}><dt className="text-xs font-bold text-[var(--muted)]">{label}</dt><dd className="mt-1 text-xl font-black text-[var(--text-primary)]">{value}</dd></div>)}</dl><div className="mt-4 grid gap-3 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-2"><p><span className="font-bold text-[var(--muted)]">Última edição:</span> <strong>{formatter.format(new Date(lastEditedAt))}</strong></p><p><span className="font-bold text-[var(--muted)]">Responsável:</span> <strong>{responsibleProfessional}</strong></p></div></Card>;
}

