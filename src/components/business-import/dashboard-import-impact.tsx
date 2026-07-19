import { ButtonLink, Card, SectionHeader } from "@/components/ui";
import type { DashboardImportImpact } from "@/features/business-import";

export function DashboardImportImpactPanel({ impact, active }: { impact: DashboardImportImpact; active: boolean }) {
  const values = [["Alunos ativos", impact.activeStudents], ["Bloqueados", impact.blockedStudents], ["Cancelamentos", impact.cancellations], ["Novas matrículas", impact.newEnrollments], ["Inadimplentes", impact.delinquentStudents], ["Frequência", impact.averageAttendance], ["Receita academia", impact.gymRevenue], ["Ticket médio", impact.averageTicket]];
  return <Card className="p-5 md:p-6" variant={active ? "success" : "muted"}><SectionHeader action={<ButtonLink href="/dashboard" size="small" variant="outline">Abrir Painel do CEO</ButtonLink>} description={active ? "Dados provenientes da última importação demonstrativa desta sessão." : "Prévia do impacto mockado que poderá alimentar o Painel do CEO."} title="Integração demonstrativa com o Painel do CEO" /><dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{values.map(([label, value]) => <div className="rounded-xl bg-white/80 p-3" key={label}><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 font-black">{value}</dd></div>)}</dl></Card>;
}

