import type { Metadata } from "next";
import Link from "next/link";

import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import {
  documentIndexRepository,
  type DocumentIndexItem,
  type DocumentIndexStatus,
  type DocumentIndexType,
} from "@/features/deliverables/document-index-repository";
import { canAccess, mvpService } from "@/features/mvp";
import type { ConsultationType } from "@/modules/attendance";

export const metadata: Metadata = { title: "Entregáveis" };

type SearchValue = string | string[] | undefined;
type SearchParams = {
  patient?: SearchValue;
  type?: SearchValue;
  status?: SearchValue;
  from?: SearchValue;
  to?: SearchValue;
  page?: SearchValue;
};

const typeOptions = [
  { value: "nutrition", label: "Relatório Nutricional", permission: "MEAL_PLAN" },
  { value: "postural", label: "Relatório de Avaliação Postural", permission: "POSTURAL_ASSESSMENT" },
  { value: "performance", label: "Plano de Treino/Performance", permission: "WORKOUT_PLAN" },
] as const;

const statusOptions = [
  { value: "nutrition-approved", label: "Relatório nutricional aprovado" },
  { value: "nutrition-ready", label: "Plano Alimentar finalizado" },
  { value: "postural-completed", label: "Avaliação postural concluída" },
  { value: "performance-finalized", label: "Plano de treino finalizado" },
] as const;

const consultationTypeLabels: Readonly<Record<ConsultationType, string>> = {
  INITIAL: "Consulta inicial",
  FOLLOW_UP: "Retorno",
  PHYSICAL_ASSESSMENT: "Avaliação física",
  POSTURAL_ASSESSMENT: "Avaliação postural",
  TRAINING: "Treinamento",
  NUTRITION: "Nutrição",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const controlClass =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

function singleValue(value: SearchValue) {
  return typeof value === "string" ? value : undefined;
}

function validDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
    ? parsed
    : undefined;
}

function attendanceLabel(item: DocumentIndexItem) {
  const dateAndTime = dateFormatter.format(item.attendanceDate);
  const type = item.consultationType
    ? consultationTypeLabels[item.consultationType]
    : undefined;
  return type ? `${type} · ${dateAndTime}` : dateAndTime;
}

function officialHref(item: DocumentIndexItem) {
  const isFinalizedMealPlan =
    item.type === "nutrition" && !item.documentId;
  const params = new URLSearchParams({
    patientId: item.patientId,
    attendanceId: item.attendanceId,
    view: isFinalizedMealPlan ? "meal-plan" : item.type,
    source: "global-deliverables",
  });
  if (item.type !== "nutrition") {
    params.set("masterRecordId", item.masterRecordId);
    params.set("entryId", item.id);
    if (item.versionId) params.set("versionId", item.versionId);
  } else if (item.documentId) {
    params.set("deliverableId", item.documentId);
  } else {
    params.set("entryId", item.id);
    if (item.versionId) params.set("versionId", item.versionId);
  }
  return `/clinica/plano-alimentar/entregavel?${params.toString()}`;
}

function completeNutritionPreviewHref(item: DocumentIndexItem) {
  const params = new URLSearchParams({
    patientId: item.patientId,
    attendanceId: item.attendanceId,
    view: "nutrition",
    source: "global-deliverables",
  });
  return `/clinica/plano-alimentar/entregavel?${params.toString()}`;
}

function documentPrintHref(
  item: DocumentIndexItem,
  intent: "PRINT" | "SAVE_PDF",
) {
  const params = new URLSearchParams({
    patientId: item.patientId,
    attendanceId: item.attendanceId,
    documentType:
      item.type === "nutrition"
        ? item.documentId ? "nutrition-report" : "meal-plan"
        : item.type,
    intent,
  });
  if (item.type !== "nutrition") {
    params.set("masterRecordId", item.masterRecordId);
    params.set("entryId", item.id);
    if (item.versionId) params.set("versionId", item.versionId);
  } else if (item.documentId) {
    params.set("deliverableId", item.documentId);
  } else {
    params.set("entryId", item.id);
    if (item.versionId) params.set("versionId", item.versionId);
  }
  return `/clinica/plano-alimentar/entregavel/imprimir?${params.toString()}`;
}

function pageHref(query: SearchParams, page: number) {
  const params = new URLSearchParams();
  for (const key of ["patient", "type", "status", "from", "to"] as const) {
    const value = singleValue(query[key]);
    if (value) params.set(key, value);
  }
  params.set("page", String(page));
  return `/entregaveis?${params.toString()}`;
}

export default async function DeliverablesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [query, access] = await Promise.all([
    searchParams,
    mvpService.getSession(),
  ]);

  if (!canAccess(access, "MASTER_RECORD", "READ")) {
    return (
      <PageState
        description="Seu perfil não possui acesso à leitura do prontuário mestre."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  const allowedTypes: DocumentIndexType[] = typeOptions
    .filter((option) => canAccess(access, option.permission, "READ"))
    .map((option) => option.value);
  const canReadExamRequests = canAccess(access, "DELIVERABLES", "READ");
  if (allowedTypes.length === 0 && !canReadExamRequests) {
    return (
      <PageState
        description="Seu perfil não possui permissão de leitura dos entregáveis."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  const patient = singleValue(query.patient)?.trim().slice(0, 180);
  const rawType = singleValue(query.type);
  const type = typeOptions.find((option) => option.value === rawType)?.value;
  const rawStatus = singleValue(query.status);
  const status = statusOptions.find((option) => option.value === rawStatus)?.value as DocumentIndexStatus | undefined;
  const fromValue = singleValue(query.from);
  const toValue = singleValue(query.to);
  const from = validDate(fromValue);
  const to = validDate(toValue);
  const toExclusive = to ? new Date(to.getTime() + 86_400_000) : undefined;
  const rawPage = singleValue(query.page);
  const parsedPage = rawPage && /^\d{1,6}$/.test(rawPage) ? Number(rawPage) : 1;
  const page = parsedPage > 0 ? parsedPage : 1;

  const result = await documentIndexRepository.list({
    patient,
    type,
    status,
    from,
    toExclusive,
    page,
    allowedTypes,
  });

  return (
    <div className="min-w-0 space-y-5">
      <PageHeading
        eyebrow="Clínica SV"
        title="Entregáveis"
        description="Localize documentos oficiais e prévias completas de Nutrição, Avaliações e Performance. Ações sobre documentos oficiais preservam a versão selecionada."
      />

      {canReadExamRequests ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-black text-emerald-950">Solicitações de exames</h2>
              <p className="mt-1 text-sm text-emerald-900">Crie rascunhos, revise, emita e reimprima pedidos vinculados ao prontuário real.</p>
            </div>
            <Link className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#12664f] px-4 text-sm font-black text-white hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" href="/entregaveis/solicitacoes-exames">Abrir solicitações</Link>
          </section>
          <section className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-black text-emerald-950">Fitoterápicos</h2>
              <p className="mt-1 text-sm text-emerald-900">Crie e acompanhe prescrições manuais no mesmo histórico de Entregáveis.</p>
            </div>
            <Link className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#12664f] px-4 text-sm font-black text-white hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" href="/entregaveis/fitoterapicos">Abrir fitoterápicos</Link>
          </section>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form action="/entregaveis" method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6 xl:items-end">
          <label className="grid gap-1 text-xs font-bold text-slate-700 xl:col-span-2">
            Paciente
            <input className={controlClass} name="patient" type="search" maxLength={180} defaultValue={patient} placeholder="Nome ou código" />
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-700">
            Tipo
            <select className={controlClass} name="type" defaultValue={type ?? "all"}>
              <option value="all">Todos</option>
              {typeOptions.filter((option) => allowedTypes.includes(option.value)).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-700">
            Status
            <select className={controlClass} name="status" defaultValue={status ?? "all"}>
              <option value="all">Todos</option>
              {statusOptions.filter((option) => allowedTypes.includes(option.value.split("-")[0] as DocumentIndexType)).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-700">
            Atualizado de
            <input className={controlClass} name="from" type="date" defaultValue={from ? fromValue : undefined} />
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-700">
            Até
            <input className={controlClass} name="to" type="date" defaultValue={to ? toValue : undefined} />
          </label>
          <button className="min-h-11 rounded-xl bg-[#12664f] px-5 text-sm font-black text-white hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 xl:col-span-6" type="submit">
            Pesquisar e filtrar
          </button>
        </form>
      </section>

      {result.items.length === 0 ? (
        <PageState title="Nenhum entregável encontrado" description="Não há documentos reais disponíveis para os filtros selecionados." />
      ) : (
        <section aria-label="Documentos disponíveis" className="space-y-3">
          <p className="text-sm text-slate-600">{result.total} {result.total === 1 ? "resultado" : "resultados"}</p>
          <ul className="grid gap-3">
            {result.items.map((item) => (
              <li key={`${item.attendanceId}:${item.type}:${item.id}`} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0 space-y-2">
                  <div>
                    <h2 className="text-base font-black text-slate-900">{item.patientName}</h2>
                    <p className="text-xs font-bold text-slate-500">Código {item.patientCode}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {item.type === "nutrition" && !item.documentId
                      ? "Plano Alimentar isolado · base do entregável completo"
                      : typeOptions.find((option) => option.value === item.type)?.label}
                  </p>
                  {item.type === "nutrition" && !item.documentId ? (
                    <p className="text-xs font-semibold text-amber-800">
                      O entregável completo está disponível para conferência, mas ainda não foi publicado.
                    </p>
                  ) : null}
                  <p className="text-sm text-slate-700">{statusOptions.find((option) => option.value === item.status)?.label}</p>
                  <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                    <div><dt className="inline font-bold">Atendimento: </dt><dd className="inline">{attendanceLabel(item)}</dd></div>
                    {item.version !== undefined ? <div><dt className="inline font-bold">{item.status === "nutrition-ready" ? "Versão do plano: " : "Versão do documento: "}</dt><dd className="inline">{item.version}</dd></div> : null}
                    <div><dt className="inline font-bold">Responsável: </dt><dd className="inline">{item.professionalName}</dd></div>
                    <div><dt className="inline font-bold">Atualizado: </dt><dd className="inline">{dateFormatter.format(item.updatedAt)}</dd></div>
                  </dl>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-4 text-center text-sm font-black text-sky-900 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:col-span-2 lg:col-span-1 xl:col-span-2"
                    href={`/pacientes/${encodeURIComponent(item.patientId)}/evolucao-avaliacoes?aba=${item.type === "performance" ? "performance" : "measures"}`}
                  >
                    Evolução e comparativos
                  </Link>
                  {item.type === "nutrition" && !item.documentId ? (
                    <Link href={completeNutritionPreviewHref(item)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12664f] px-4 text-center text-sm font-black text-white hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                      Visualizar entregável completo
                    </Link>
                  ) : null}
                  <Link href={officialHref(item)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-700 bg-white px-4 text-center text-sm font-black text-emerald-900 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                    {item.type === "nutrition" && !item.documentId ? "Visualizar plano" : "Visualizar"}
                  </Link>
                  <Link href={documentPrintHref(item, "PRINT")} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12664f] px-4 text-center text-sm font-black text-white hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                    {item.type === "nutrition" && !item.documentId ? "Imprimir plano" : "Imprimir"}
                  </Link>
                  <Link href={documentPrintHref(item, "SAVE_PDF")} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-700 bg-white px-4 text-center text-sm font-black text-emerald-900 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                    {item.type === "nutrition" && !item.documentId ? "Salvar plano em PDF" : "Salvar em PDF"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.totalPages > 1 ? (
        <nav aria-label="Paginação dos entregáveis" className="flex items-center justify-between gap-3 text-sm">
          {result.page > 1 ? <Link href={pageHref(query, result.page - 1)} className="font-bold text-emerald-800 underline">Anterior</Link> : <span />}
          <span>Página {result.page} de {result.totalPages}</span>
          {result.page < result.totalPages ? <Link href={pageHref(query, result.page + 1)} className="font-bold text-emerald-800 underline">Próxima</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
