import { AttendanceStateActions } from "@/components/attendance/attendance-state-actions";
import { NewAttendanceDialog } from "@/components/patients/new-attendance-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlusIcon, SearchIcon } from "@/components/ui/icons";
import { PageState } from "@/components/ui/page-state";
import type { PatientListItem } from "@/features/mvp";
import type { PatientListPage } from "@/features/patient-registration";
import type { PatientStatus } from "@/modules/patients";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const clinicalStatus = {
  NO_ATTENDANCE: { label: "Sem atendimento", tone: "neutral" },
  PREPARED: { label: "Preparado", tone: "info" },
  IN_PROGRESS: { label: "Em andamento", tone: "warning" },
  COMPLETED: { label: "Concluído", tone: "success" },
  RETURN_SCHEDULED: { label: "Retorno agendado", tone: "info" },
} as const;

function patientListHref(input: {
  page?: number;
  query?: string;
  returnTo?: string;
  status?: PatientStatus;
}) {
  const params = new URLSearchParams();
  if (input.query) params.set("query", input.query);
  if (input.status) params.set("status", input.status);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  if (input.returnTo) params.set("returnTo", input.returnTo);
  const search = params.toString();
  return search ? `/pacientes?${search}` : "/pacientes";
}

function formatDate(value?: string) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function PatientRow({ item }: { item: PatientListItem }) {
  const status = clinicalStatus[item.clinicalStatus ?? "NO_ATTENDANCE"];
  return (
    <article className="grid gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm lg:grid-cols-[minmax(14rem,1.5fr)_9rem_9rem_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-sm font-black text-slate-950">{item.patient.fullName}</h2>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {item.code}{typeof item.age === "number" ? ` · ${item.age} anos` : ""}
        </p>
      </div>
      <dl>
        <dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">Último atendimento</dt>
        <dd className="mt-1 text-xs font-bold text-slate-700">{formatDate(item.lastAttendanceAt)}</dd>
      </dl>
      <dl>
        <dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">Próximo retorno</dt>
        <dd className="mt-1 text-xs font-bold text-slate-700">{formatDate(item.nextReturnAt)}</dd>
      </dl>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <ButtonLink href={`/pacientes/${item.patient.id}`} size="small">
            Abrir prontuário
          </ButtonLink>
          <ButtonLink
            href={`/pacientes/${item.patient.id}/editar`}
            size="small"
            variant="outline"
          >
            Editar cadastro
          </ButtonLink>
        </div>
        {item.openAttendanceId && item.openAttendanceStatus === "DRAFT" ? (
          <AttendanceStateActions attendanceId={item.openAttendanceId} patientId={item.patient.id} redirectAfterStart />
        ) : item.openAttendanceId ? (
          <ButtonLink href={`/pacientes/${item.patient.id}/atendimentos/${item.openAttendanceId}/coleta`} size="small">
            Continuar atendimento
          </ButtonLink>
        ) : (
          <NewAttendanceDialog hasHistory={item.hasAttendanceHistory ?? false} patientId={item.patient.id} patientName={item.patient.fullName} />
        )}
      </div>
    </article>
  );
}

export function PatientList({ pagination, query, returnTo, status }: {
  pagination: PatientListPage;
  query?: string;
  returnTo?: string;
  status?: PatientStatus;
}) {
  const clearHref = patientListHref({ returnTo });
  const firstPatient = pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const lastPatient = Math.min(firstPatient + pagination.items.length - 1, pagination.total);
  return (
    <>
      <Card className="mb-4 p-3">
        <form action="/pacientes" className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]" method="get">
          {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
          <label className="sr-only" htmlFor="patient-search">Pesquisar pacientes</label>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-emerald-600/20">
            <SearchIcon className="shrink-0 text-slate-400" />
            <input className="min-h-11 w-full bg-transparent text-sm outline-none" defaultValue={query} id="patient-search" name="query" placeholder="Nome, CPF, telefone ou código" type="search" />
          </div>
          <label className="sr-only" htmlFor="patient-status-filter">Filtrar por situação cadastral</label>
          <select className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" defaultValue={status ?? ""} id="patient-status-filter" name="status">
            <option value="">Todas as situações</option>
            <option value="ACTIVE">Ativos</option>
            <option value="INACTIVE">Inativos</option>
            <option value="ARCHIVED">Arquivados</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit">Buscar</Button>
            {query || status ? <ButtonLink href={clearHref} size="small" variant="link">Limpar</ButtonLink> : null}
          </div>
        </form>
      </Card>
      <p aria-live="polite" className="mb-3 px-1 text-sm font-semibold text-slate-600">
        {pagination.total} {pagination.total === 1 ? "paciente" : "pacientes"}
      </p>
      {pagination.items.length ? (
        <div className="grid gap-2">{pagination.items.map((item) => <PatientRow item={item} key={item.patient.id} />)}</div>
      ) : (
        <PageState action={<ButtonLink href={clearHref} size="small" variant="link">Limpar pesquisa e filtros</ButtonLink>} description="Tente outro nome, CPF, telefone ou código." title="Nenhum paciente encontrado" />
      )}
      {pagination.total > 0 ? (
        <nav aria-label="Paginação de pacientes" className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <p className="text-sm font-semibold text-slate-600">{firstPatient}–{lastPatient} de {pagination.total}</p>
          <div className="flex gap-2">
            {pagination.page > 1 ? <ButtonLink href={patientListHref({ page: pagination.page - 1, query, returnTo, status })} size="small" variant="outline">Anterior</ButtonLink> : <Button disabled size="small" type="button" variant="outline">Anterior</Button>}
            {pagination.page < pagination.totalPages ? <ButtonLink href={patientListHref({ page: pagination.page + 1, query, returnTo, status })} size="small" variant="outline">Próxima</ButtonLink> : <Button disabled size="small" type="button" variant="outline">Próxima</Button>}
          </div>
        </nav>
      ) : null}
      <ButtonLink aria-label="Novo paciente" className="fixed bottom-20 right-4 z-10 size-14 rounded-full p-0 shadow-lg sm:hidden" href="/pacientes/novo" size="icon"><PlusIcon /></ButtonLink>
    </>
  );
}
