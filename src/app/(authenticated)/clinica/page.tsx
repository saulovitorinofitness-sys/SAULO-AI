import type { Metadata } from "next";
import Link from "next/link";
import {
  Apple,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Database,
  FlaskConical,
  Search,
  UserPlus,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import {
  mvpService,
  type PatientListItem,
  type PatientWorkflowStatus,
} from "@/features/mvp";

export const metadata: Metadata = {
  title: "Clínica SV",
};

type EtapaClinica = {
  codigo: string;
  titulo: string;
  descricao: string;
  href?: string;
  icone: LucideIcon;
};

const etapasClinicas: EtapaClinica[] = [
  {
    codigo: "01",
    titulo: "Pacientes",
    descricao: "Localize ou acesse o cadastro do paciente.",
    href: "/pacientes",
    icone: Users,
  },
  {
    codigo: "02",
    titulo: "Atendimentos",
    descricao: "Consulte e acompanhe os atendimentos.",
    href: "/atendimentos",
    icone: CalendarDays,
  },
  {
    codigo: "03",
    titulo: "Motor Clínico",
    descricao: "Reúna o contexto clínico do paciente.",
    icone: BrainCircuit,
  },
  {
    codigo: "04",
    titulo: "Estratégia Nutricional",
    descricao: "Estruture o direcionamento nutricional.",
    icone: Apple,
  },
  {
    codigo: "05",
    titulo: "Plano Alimentar",
    descricao: "Organize o planejamento alimentar.",
    icone: UtensilsCrossed,
  },
  {
    codigo: "06",
    titulo: "Exames",
    descricao: "Acompanhe os registros de exames.",
    icone: FlaskConical,
  },
];

const workflowLabels: Readonly<Record<PatientWorkflowStatus, string>> = {
  NOT_STARTED: "Não iniciado",
  IN_PROGRESS: "Em andamento",
  WAITING_PROFESSIONAL: "Aguardando profissional",
  PENDING_REVIEW: "Aguardando revisão",
  COMPLETED: "Concluído",
};

function criarEtapasClinicas(
  paciente?: PatientListItem,
): EtapaClinica[] {
  if (!paciente) {
    return etapasClinicas;
  }

  const patientId = encodeURIComponent(paciente.patient.id);
  const patientBase = `/pacientes/${patientId}`;

  return etapasClinicas.map((etapa) => {
    switch (etapa.codigo) {
      case "01":
        return {
          ...etapa,
          descricao: "Acesse o prontuário do paciente selecionado.",
          href: patientBase,
        };
      case "02":
        return {
          ...etapa,
          descricao: paciente.openAttendanceId
            ? "Continue o atendimento em andamento."
            : "Consulte ou inicie um atendimento.",
          href: paciente.openAttendanceId
            ? `${patientBase}/continuar`
            : "/atendimentos",
        };
      case "03":
        return {
          ...etapa,
          href: `${patientBase}/motor-clinico`,
        };
      case "04":
        return {
          ...etapa,
          href: `${patientBase}/estrategia-nutricional`,
        };
      case "05":
        return {
          ...etapa,
          href: `${patientBase}/plano-alimentar`,
        };
      case "06":
        return {
          ...etapa,
          href: `${patientBase}/exames`,
        };
      default:
        return etapa;
    }
  });
}

function EtapaCard({
  etapa,
  ultima,
}: {
  etapa: EtapaClinica;
  ultima: boolean;
}) {
  const Icone = etapa.icone;
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf4ee] text-[#1f6a4d]">
          <Icone aria-hidden="true" className="h-5 w-5" strokeWidth={1.9} />
        </div>

        <span className="text-[11px] font-bold tracking-[0.12em] text-[#a58132]">
          {etapa.codigo}
        </span>
      </div>

      <div className="mt-4">
        <h3 className="text-[15px] font-bold leading-tight text-slate-900">
          {etapa.titulo}
        </h3>

        <p className="mt-1.5 text-xs leading-5 text-slate-500">
          {etapa.descricao}
        </p>
      </div>

      <div className="mt-auto pt-4">
        {etapa.href ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1f6a4d]">
            Acessar etapa
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="text-[11px] font-semibold leading-4 text-slate-500">
            Selecione um paciente para acessar
          </span>
        )}
      </div>
    </>
  );

  const classes =
    "relative flex min-h-[190px] flex-col rounded-[22px] border border-[#dce2dd] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]";

  return (
    <div className="relative min-w-0">
      {etapa.href ? (
        <Link
          aria-label={`Acessar ${etapa.titulo}`}
          className={`${classes} group transition duration-200 hover:-translate-y-1 hover:border-[#9fc6ae] hover:shadow-[0_12px_28px_rgba(31,106,77,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2`}
          href={etapa.href}
        >
          {conteudo}
        </Link>
      ) : (
        <article className={classes}>{conteudo}</article>
      )}

      {!ultima ? (
        <span
          aria-hidden="true"
          className="absolute -right-3 top-1/2 z-10 hidden h-px w-6 bg-[#cfb66f] 2xl:block"
        >
          <ArrowRight className="absolute -right-0.5 -top-1.5 h-3 w-3 text-[#a58132]" />
        </span>
      ) : null}
    </div>
  );
}

export default async function ClinicaPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  const query = await searchParams;
  const requestedPatientId = query.patientId?.trim();
  const masterRecord = requestedPatientId
    ? await mvpService.getPatientMasterRecord(requestedPatientId)
    : null;
  const paciente = masterRecord?.patient;
  const pacienteNaoEncontrado = Boolean(
    requestedPatientId && !paciente,
  );
  const etapas = criarEtapasClinicas(paciente);

  return (
    <div className="min-w-0">
      <header className="overflow-hidden rounded-[26px] border border-[#dce2dd] bg-white shadow-sm">
        <div className="h-1 bg-gradient-to-r from-[#123d2d] via-[#1f6a4d] to-[#d1ad52]" />

        <div className="flex flex-col gap-6 px-5 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#123d2d] to-[#1f6a4d] text-sm font-bold tracking-[0.12em] text-[#e4c878] shadow-lg shadow-emerald-950/10">
              SV
            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1f6a4d]">
                Centro Clínico de Nutrição
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Clínica SV
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Gestão integrada do atendimento nutricional
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#b9c8be] bg-white px-4 text-sm font-bold text-[#174f3a] transition hover:border-[#1f6a4d] hover:bg-[#f4faf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2"
              href="/pacientes?returnTo=/clinica"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
              Localizar paciente
            </Link>

            <Link
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1f6a4d] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#174f3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2"
              href="/pacientes/novo"
            >
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              Novo paciente
            </Link>
          </div>
        </div>

        <div className="border-t border-[#e5ebe7] bg-[#fbfdfb] px-5 py-4 sm:px-7 lg:px-8">
          {paciente ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1f6a4d]">
                  Paciente selecionado
                </p>

                <p className="mt-1 truncate text-base font-bold text-slate-900">
                  {paciente.patient.fullName}
                </p>
              </div>

              {paciente.mainObjective || paciente.workflowStatus ? (
                <dl className="flex flex-wrap gap-x-6 gap-y-2">
                  {paciente.mainObjective ? (
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Objetivo principal
                      </dt>

                      <dd className="mt-0.5 text-xs font-bold text-slate-700">
                        {paciente.mainObjective}
                      </dd>
                    </div>
                  ) : null}

                  {paciente.workflowStatus ? (
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Status
                      </dt>

                      <dd className="mt-0.5 text-xs font-bold text-[#1f6a4d]">
                        {workflowLabels[paciente.workflowStatus]}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>
          ) : pacienteNaoEncontrado ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a58132]">
                  Contexto do atendimento
                </p>

                <p className="mt-1 text-sm font-bold text-slate-900">
                  Paciente não encontrado
                </p>
              </div>

              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#b9c8be] bg-white px-4 text-xs font-bold text-[#174f3a] transition hover:border-[#1f6a4d] hover:bg-[#f4faf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2"
                href="/pacientes?returnTo=/clinica"
              >
                Selecionar outro paciente
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Contexto do atendimento
              </p>

              <p className="mt-1 text-sm font-bold text-slate-700">
                Nenhum paciente selecionado
              </p>
            </div>
          )}
        </div>
      </header>

      <div>
        <section aria-labelledby="fluxo-clinico" className="mt-6">
          <div className="rounded-2xl border border-[#dce5df] bg-[#f4faf6] px-4 py-3 sm:px-5">
            <p className="flex items-start gap-2 text-sm font-medium text-[#174f3a]">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#d1ad52]"
              />
              {paciente
                ? `Atendimento clínico de ${paciente.patient.fullName}.`
                : pacienteNaoEncontrado
                  ? "Paciente não encontrado. Selecione outro cadastro para continuar."
                  : "Selecione ou cadastre um paciente para iniciar o atendimento clínico."}
            </p>
          </div>

          <div className="mb-4 mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1f6a4d]">
              Jornada do atendimento
            </p>

            <h2
              className="mt-1 text-xl font-bold text-slate-900"
              id="fluxo-clinico"
            >
              Fluxo Clínico Integrado
            </h2>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {etapas.map((etapa, index) => (
              <EtapaCard
                etapa={etapa}
                key={etapa.codigo}
                ultima={index === etapas.length - 1}
              />
            ))}
          </div>
        </section>

      </div>

      <footer className="mt-8 border-t border-slate-200 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">
              Conhecimento e suporte
            </p>

            <p className="mt-0.5 text-xs text-slate-500">
              Recursos complementares do Sistema Integrado SV
            </p>
          </div>

          <nav
            aria-label="Conhecimento e suporte"
            className="flex flex-wrap items-center gap-x-5 gap-y-2"
          >
            <Link
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 transition hover:text-[#1f6a4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2"
              href="/administracao/biblioteca-cientifica"
            >
              <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
              Biblioteca Científica
            </Link>

            <Link
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 transition hover:text-[#1f6a4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6a4d] focus-visible:ring-offset-2"
              href="/central-de-dados"
            >
              <Database aria-hidden="true" className="h-3.5 w-3.5" />
              Central de Dados
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
