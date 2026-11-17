import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { canAccess, mvpService } from "@/features/mvp";
import { prisma } from "@/lib/database/prisma";

export const metadata: Metadata = { title: "Avaliações" };

type SearchValue = string | string[] | undefined;
type AssessmentStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
type AssessmentFilter =
  | "all"
  | "in-progress"
  | "physical"
  | "bioimpedance"
  | "perimetry"
  | "postural"
  | "completed";

const assessmentFilters: ReadonlyArray<{
  value: AssessmentFilter;
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "in-progress", label: "Em avaliação" },
  { value: "physical", label: "Avaliação física" },
  { value: "bioimpedance", label: "Bioimpedância" },
  { value: "perimetry", label: "Perimetria" },
  { value: "postural", label: "Avaliação postural" },
  { value: "completed", label: "Concluídos" },
];

const assessmentDefinitions = [
  {
    key: "physical",
    label: "Avaliação física",
    entityType: "ASSESSMENT_ANTHROPOMETRY",
    relation: "physicalAssessment",
    step: "ANTHROPOMETRY",
  },
  {
    key: "bioimpedance",
    label: "Bioimpedância",
    entityType: "ASSESSMENT_BIOIMPEDANCE",
    relation: "bioimpedance",
    step: "BIOIMPEDANCE",
  },
  {
    key: "perimetry",
    label: "Perimetria",
    entityType: "ASSESSMENT_PERIMETRY",
    relation: "perimetry",
    step: "PERIMETRY",
  },
  {
    key: "postural",
    label: "Avaliação postural",
    entityType: "ASSESSMENT_POSTURAL_ASSESSMENT",
    relation: "posturalAssessment",
    step: "POSTURAL_ASSESSMENT",
  },
] as const;

const assessmentFlowDefinitions = [
  assessmentDefinitions[0],
  assessmentDefinitions[2],
  assessmentDefinitions[1],
  assessmentDefinitions[3],
] as const;

const statusPresentation: Readonly<
  Record<AssessmentStatus, { label: string; className: string }>
> = {
  NOT_STARTED: {
    label: "Não iniciado",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  IN_PROGRESS: {
    label: "Em andamento",
    className: "border-sky-200 bg-sky-50 text-sky-800",
  },
  COMPLETED: {
    label: "Concluído",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const primaryActionClass =
  "inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-[#12664f] px-3 text-center text-xs font-black text-white transition hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";
const secondaryActionClass =
  "inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-center text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

function singleValue(value: SearchValue) {
  return typeof value === "string" ? value : undefined;
}

function resolveFilter(value: SearchValue): AssessmentFilter {
  const candidate = singleValue(value);
  return assessmentFilters.some((option) => option.value === candidate)
    ? (candidate as AssessmentFilter)
    : "all";
}

function resolveSearch(value: SearchValue) {
  const search = singleValue(value)?.trim();
  return search ? search.slice(0, 180) : undefined;
}

function centralHref(filter: AssessmentFilter, search?: string) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (search) params.set("query", search);
  const query = params.toString();
  return query ? `/avaliacoes?${query}` : "/avaliacoes";
}

function collectionHref(
  patientId: string,
  attendanceId: string,
  step: string,
) {
  return `/pacientes/${encodeURIComponent(patientId)}/atendimentos/${encodeURIComponent(attendanceId)}/coleta?step=${encodeURIComponent(step)}`;
}

function posturalReportHref(patientId: string, attendanceId: string) {
  const params = new URLSearchParams({
    patientId,
    attendanceId,
    view: "postural",
  });
  return `/clinica/plano-alimentar/entregavel?${params.toString()}`;
}

function StatusBadge({ status }: { status: AssessmentStatus }) {
  const presentation = statusPresentation[status];
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-black ${presentation.className}`}
    >
      {presentation.label}
    </span>
  );
}

export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: SearchValue;
    query?: SearchValue;
    view?: SearchValue;
  }>;
}) {
  const [query, access] = await Promise.all([
    searchParams,
    mvpService.getSession(),
  ]);

  if (!canAccess(access, "MASTER_RECORD", "READ")) {
    return (
      <PageState
        description="Seu perfil não possui acesso aos registros de avaliação."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  const search = resolveSearch(query.query);
  const filter = resolveFilter(query.filter);
  const comparisonMode = singleValue(query.view) === "comparativos";
  const patientWhere = {
    deletedAt: null,
    status: "ACTIVE" as const,
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" as const } },
            { clinicalCode: { contains: search.toUpperCase() } },
          ],
        }
      : {}),
  };

  const [patients, totalPatientCount] = await Promise.all([
    prisma.patient.findMany({
      where: patientWhere,
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      select: {
        id: true,
        fullName: true,
        clinicalCode: true,
        masterRecord: {
          select: {
            attendances: {
              where: { deletedAt: null },
              orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
              select: { id: true, status: true, updatedAt: true },
            },
            entries: {
              where: { deletedAt: null, type: "ASSESSMENT" },
              orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
              select: {
                id: true,
                attendanceId: true,
                updatedAt: true,
                updatedBy: { select: { fullName: true } },
                physicalAssessment: { select: { updatedAt: true } },
                bioimpedance: { select: { updatedAt: true } },
                perimetry: { select: { updatedAt: true } },
                posturalAssessment: { select: { updatedAt: true } },
              },
            },
          },
        },
      },
    }),
    prisma.patient.count({
      where: { deletedAt: null, status: "ACTIVE" },
    }),
  ]);

  const entryIds = patients.flatMap(
    (patient) => patient.masterRecord?.entries.map((entry) => entry.id) ?? [],
  );
  const versions = entryIds.length
    ? await prisma.recordVersion.findMany({
        where: {
          entityId: { in: entryIds },
          entityType: {
            in: assessmentDefinitions.map((definition) => definition.entityType),
          },
        },
        orderBy: [{ createdAt: "desc" }, { version: "desc" }],
        select: {
          entityId: true,
          entityType: true,
          status: true,
          createdAt: true,
          responsible: { select: { fullName: true } },
        },
      })
    : [];
  const latestVersionByStep = new Map<
    string,
    (typeof versions)[number]
  >();
  for (const version of versions) {
    const key = `${version.entityId}:${version.entityType}`;
    if (!latestVersionByStep.has(key)) latestVersionByStep.set(key, version);
  }

  const rows = patients
    .map((patient) => {
      const masterRecord = patient.masterRecord;
      const openAttendance = masterRecord?.attendances.find(
        (attendance) =>
          attendance.status === "DRAFT" || attendance.status === "IN_PROGRESS",
      );
      const selectedEntry = openAttendance
        ? masterRecord?.entries.find(
            (entry) => entry.attendanceId === openAttendance.id,
          )
        : masterRecord?.entries[0];
      const selectedAttendance =
        openAttendance ??
        masterRecord?.attendances.find(
          (attendance) => attendance.id === selectedEntry?.attendanceId,
        );

      const assessments = Object.fromEntries(
        assessmentDefinitions.map((definition) => {
          const persistedRecord = selectedEntry?.[definition.relation];
          const version = selectedEntry
            ? latestVersionByStep.get(
                `${selectedEntry.id}:${definition.entityType}`,
              )
            : undefined;
          const status: AssessmentStatus = !persistedRecord
            ? "NOT_STARTED"
            : version?.status === "COMPLETED"
              ? "COMPLETED"
              : "IN_PROGRESS";

          return [
            definition.key,
            {
              status,
              updatedAt: version?.createdAt ?? persistedRecord?.updatedAt,
              professionalName:
                version?.responsible.fullName ??
                (persistedRecord ? selectedEntry?.updatedBy.fullName : undefined),
            },
          ];
        }),
      ) as Record<
        (typeof assessmentDefinitions)[number]["key"],
        {
          status: AssessmentStatus;
          updatedAt?: Date;
          professionalName?: string;
        }
      >;

      const latestAssessment = Object.values(assessments)
        .filter(
          (assessment): assessment is typeof assessment & { updatedAt: Date } =>
            Boolean(assessment.updatedAt),
        )
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
      const statuses = Object.values(assessments).map(
        (assessment) => assessment.status,
      );
      const noAssessmentStarted = statuses.every(
        (status) => status === "NOT_STARTED",
      );
      const allAssessmentsCompleted = statuses.every(
        (status) => status === "COMPLETED",
      );
      const nextDefinition =
        assessmentFlowDefinitions.find(
          (definition) =>
            assessments[definition.key].status === "IN_PROGRESS",
        ) ??
        assessmentFlowDefinitions.find(
          (definition) =>
            assessments[definition.key].status === "NOT_STARTED",
        );
      const posturalEntry = masterRecord?.entries.find(
        (entry) => entry.posturalAssessment && entry.attendanceId,
      );

      return {
        patientId: patient.id,
        patientName: patient.fullName,
        patientCode: patient.clinicalCode,
        attendanceId: selectedAttendance?.id,
        assessments,
        primaryActionLabel: allAssessmentsCompleted
          ? "Ver avaliações"
          : noAssessmentStarted
            ? "Iniciar avaliação"
            : "Continuar avaliação",
        nextStep: allAssessmentsCompleted
          ? "SUMMARY"
          : (nextDefinition?.step ?? "SUMMARY"),
        updatedAt: latestAssessment?.updatedAt,
        professionalName: latestAssessment?.professionalName,
        posturalReportAttendanceId: posturalEntry?.attendanceId,
      };
    })
    .filter((row) => {
      const statuses = Object.values(row.assessments).map(
        (assessment) => assessment.status,
      );
      if (filter === "in-progress") return statuses.includes("IN_PROGRESS");
      if (filter === "completed") {
        return statuses.every((status) => status === "COMPLETED");
      }
      if (
        filter === "physical" ||
        filter === "bioimpedance" ||
        filter === "perimetry" ||
        filter === "postural"
      ) {
        return row.assessments[filter].status !== "NOT_STARTED";
      }
      return true;
    })
    .sort((left, right) => {
      if (left.updatedAt && right.updatedAt) {
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      }
      if (left.updatedAt) return -1;
      if (right.updatedAt) return 1;
      return left.patientName.localeCompare(right.patientName, "pt-BR");
    });

  function AssessmentActions({ row }: { row: (typeof rows)[number] }) {
    if (!row.attendanceId) {
      return (
        <div className="grid min-w-[9.75rem] gap-2">
          <Link
            className={primaryActionClass}
            href={`/pacientes/${encodeURIComponent(row.patientId)}/evolucao-avaliacoes?aba=measures`}
          >
            Evolução e comparativos
          </Link>
          <Link
            className={secondaryActionClass}
            href={`/pacientes/${encodeURIComponent(row.patientId)}`}
          >
            Abrir prontuário
          </Link>
        </div>
      );
    }

    return (
      <div className="grid min-w-[9.75rem] gap-2">
        <Link
          className={primaryActionClass}
          href={collectionHref(row.patientId, row.attendanceId, row.nextStep)}
        >
          {row.primaryActionLabel}
        </Link>
        <Link
          className={secondaryActionClass}
          href={`/pacientes/${encodeURIComponent(row.patientId)}/evolucao-avaliacoes?aba=measures`}
        >
          Evolução e comparativos
        </Link>
        <details className="group relative">
          <summary className="flex min-h-8 cursor-pointer list-none items-center justify-center rounded-lg px-2 text-[11px] font-black text-[var(--primary)] hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 [&::-webkit-details-marker]:hidden">
            Outras etapas
          </summary>
          <div className="mt-1 grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2">
            {assessmentDefinitions.map((definition) => (
              <Link
                className={secondaryActionClass}
                href={collectionHref(
                  row.patientId,
                  row.attendanceId!,
                  definition.step,
                )}
                key={definition.key}
              >
                {definition.label}
              </Link>
            ))}
            {row.posturalReportAttendanceId ? (
              <Link
                className={secondaryActionClass}
                href={posturalReportHref(
                  row.patientId,
                  row.posturalReportAttendanceId,
                )}
              >
                Abrir relatório postural
              </Link>
            ) : null}
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeading
        description={comparisonMode
          ? "Pesquise por nome ou código e selecione a pessoa para abrir diretamente seus comparativos."
          : "Selecione a pessoa para abrir Evolução e comparativos ou acessar uma avaliação física, composição corporal, perimetria e avaliação postural."}
        eyebrow="Clínica SV"
        title={comparisonMode ? "Evolução e comparativos" : "Avaliações"}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          action="/avaliacoes"
          className="flex flex-col gap-3 md:flex-row md:items-end"
          method="get"
        >
          <label className="grid min-w-0 flex-1 gap-1.5 text-xs font-bold text-slate-700">
            Pesquisar paciente
            <span className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              />
              <input
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                defaultValue={search}
                maxLength={180}
                name="query"
                placeholder="Nome ou código"
                type="search"
              />
            </span>
          </label>
          {filter !== "all" ? (
            <input name="filter" type="hidden" value={filter} />
          ) : null}
          {comparisonMode ? (
            <input name="view" type="hidden" value="comparativos" />
          ) : null}
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12664f] px-5 text-sm font-black text-white transition hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            type="submit"
          >
            Pesquisar
          </button>
        </form>

        {!comparisonMode ? <nav
          aria-label="Filtrar avaliações"
          className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4"
        >
          {assessmentFilters.map((option) => {
            const active = filter === option.value;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-8 items-center rounded-full border px-3 text-[11px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                  active
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:text-emerald-800"
                }`}
                href={centralHref(option.value, search)}
                key={option.value}
              >
                {option.label}
              </Link>
            );
          })}
        </nav> : null}
      </section>

      {rows.length === 0 ? (
        <PageState
          action={
            totalPatientCount === 0 ? (
              <Link className={secondaryActionClass} href="/pacientes">
                Abrir pacientes
              </Link>
            ) : (
              <Link className={secondaryActionClass} href={comparisonMode ? "/avaliacoes?view=comparativos" : "/avaliacoes"}>
                Limpar filtros
              </Link>
            )
          }
          description={
            totalPatientCount === 0
              ? "Os pacientes cadastrados aparecerão aqui quando estiverem disponíveis."
              : "Nenhum paciente corresponde à pesquisa ou ao filtro selecionado."
          }
          title={
            totalPatientCount === 0
              ? "Nenhum paciente cadastrado"
              : "Nenhum paciente encontrado"
          }
        />
      ) : comparisonMode ? (
        <section aria-label="Selecionar pessoa para comparar" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <li key={row.patientId}>
                <Link
                  className="group flex min-h-20 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  href={`/pacientes/${encodeURIComponent(row.patientId)}/evolucao-avaliacoes`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-slate-950">{row.patientName}</span>
                    <span className="mt-1 block text-xs font-bold text-slate-500">{row.patientCode}</span>
                  </span>
                  <span className="shrink-0 text-xs font-black text-sky-800 group-hover:underline">Comparar →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section
          aria-label="Avaliações dos pacientes"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="hidden lg:block">
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="border-b border-slate-200 bg-slate-50/80">
                <tr className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  <th className="w-[20%] px-3 py-3">Paciente</th>
                  <th className="w-[12%] px-2 py-3">Avaliação física</th>
                  <th className="w-[11%] px-2 py-3">Bioimpedância</th>
                  <th className="w-[10%] px-2 py-3">Perimetria</th>
                  <th className="w-[12%] px-2 py-3">Avaliação postural</th>
                  <th className="w-[18%] px-3 py-3">Atualização</th>
                  <th className="w-[17%] px-3 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr className="align-middle" key={row.patientId}>
                    <td className="px-3 py-4">
                      <p className="line-clamp-2 text-sm font-black leading-5 text-slate-900">
                        {row.patientName}
                      </p>
                      <p className="mt-1 text-[11px] font-bold text-slate-500">
                        {row.patientCode}
                      </p>
                    </td>
                    {assessmentDefinitions.map((definition) => (
                      <td className="px-2 py-4" key={definition.key}>
                        <StatusBadge
                          status={row.assessments[definition.key].status}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-4">
                      <p className="text-xs font-bold tabular-nums text-slate-800">
                        {row.updatedAt ? dateFormatter.format(row.updatedAt) : "—"}
                      </p>
                      {row.professionalName ? (
                        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                          {row.professionalName}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-4">
                      <AssessmentActions row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 lg:hidden">
            {rows.map((row) => (
              <article className="space-y-4 p-4 sm:p-5" key={row.patientId}>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    {row.patientName}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {row.patientCode}
                  </p>
                </div>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {assessmentDefinitions.map((definition) => (
                    <div
                      className="flex items-center justify-between gap-3"
                      key={definition.key}
                    >
                      <dt className="text-xs font-bold text-slate-600">
                        {definition.label}
                      </dt>
                      <dd>
                        <StatusBadge
                          status={row.assessments[definition.key].status}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold tabular-nums text-slate-800">
                    Atualização: {row.updatedAt ? dateFormatter.format(row.updatedAt) : "—"}
                  </p>
                  {row.professionalName ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Profissional: {row.professionalName}
                    </p>
                  ) : null}
                </div>
                <AssessmentActions row={row} />
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
