import { Badge, Button, ButtonLink } from "@/components/ui";
import type { ExecutiveDashboardView } from "@/features/executive-dashboard";

export function DashboardHeader({ dashboard, refreshedAt, onRefresh, onOpenMeeting }: { dashboard: ExecutiveDashboardView; refreshedAt: string; onRefresh: () => void; onOpenMeeting: () => void }) {
  return (
    <header className="rounded-[var(--radius-large)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-subtle)] md:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">Gestão integrada · dados demonstrativos</p>
          <h1 className="mt-2 text-2xl font-black text-[var(--text-primary)] md:text-3xl">{dashboard.greeting}</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Visão executiva consolidada da Clínica SV e Academia Saulo Fitness.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="info">{dashboard.weekLabel}</Badge>
            <Badge>{dashboard.epidemiologicalWeek}</Badge>
            <Badge>{dashboard.commercialWeek}</Badge>
          </div>
          <p aria-live="polite" className="mt-3 text-xs text-[var(--muted)]">Última atualização visual: {refreshedAt}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink href="/gestao/importacoes" variant="outline">Importar relatórios</ButtonLink>
          <Button onClick={onRefresh} variant="outline">Atualizar</Button>
          <Button onClick={onOpenMeeting}>Reunião Semanal</Button>
        </div>
      </div>
    </header>
  );
}
