import Link from "next/link";

import { ArrowIcon, CheckIcon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import type { MasterRecordSummaryView } from "@/features/mvp";
import type { ClinicalCollectionScenario, CurrentAttendanceView } from "@/features/clinical-collection";
import { CurrentAttendanceCard } from "@/components/attendance/current-attendance-card";
import { PageState } from "@/components/ui/page-state";
import { ClinicalDecisionEntryCard } from "@/components/clinical-decision/clinical-decision-entry-card";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" });

const consultationLabels = {
  INITIAL: "Consulta inicial", FOLLOW_UP: "Retorno", PHYSICAL_ASSESSMENT: "Avaliação física",
  POSTURAL_ASSESSMENT: "Avaliação postural", TRAINING: "Treinamento", NUTRITION: "Nutrição",
} as const;

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#dce5e0] bg-white p-5 shadow-[0_8px_24px_rgb(20_55_44/0.03)] ${className}`}><h2 className="mb-4 text-sm font-black uppercase tracking-[0.1em] text-slate-500">{title}</h2>{children}</section>;
}

export function MasterRecordSummary({ summary, currentAttendance, scenarios }: { summary: MasterRecordSummaryView; currentAttendance: CurrentAttendanceView | null; scenarios: readonly ClinicalCollectionScenario[] }) {
  const { patient } = summary;
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl bg-[#103f32] text-white shadow-[0_16px_38px_rgb(10_73_56/0.14)]">
        <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/12 text-lg font-black">{patient.patient.fullName.slice(0, 2).toUpperCase()}</span>
            <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-black sm:text-2xl">{patient.patient.fullName}</h1><Badge tone="success">Ativo</Badge></div><p className="mt-2 text-sm font-semibold text-emerald-100">{patient.code} · {patient.age} anos · CPF {summary.cpfMasked}</p></div>
          </div>
          {currentAttendance ? <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-[#0a4938] hover:bg-emerald-50" href="#atendimento-atual">Ver atendimento atual<ArrowIcon className="size-4" /></Link> : null}
        </div>
      </section>

      {currentAttendance ? <CurrentAttendanceCard initialAttendance={currentAttendance} scenarios={scenarios} /> : <PageState description="Nenhum atendimento ativo foi disponibilizado para este paciente." title="Sem atendimento ativo" />}
      {currentAttendance ? <ClinicalDecisionEntryCard attendance={currentAttendance} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Identificação">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-xs font-semibold text-slate-400">Nome completo</dt><dd className="mt-1 text-sm font-bold text-slate-800">{patient.patient.fullName}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-400">Nascimento</dt><dd className="mt-1 text-sm font-bold text-slate-800">{dateFormatter.format(new Date(`${summary.birthDate}T00:00:00Z`))}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-400">Telefone principal</dt><dd className="mt-1 text-sm font-bold text-slate-800">{patient.primaryPhone}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs font-semibold text-slate-400">E-mail</dt><dd className="mt-1 break-all text-sm font-bold text-slate-800">{summary.email}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-400">Prontuário Mestre</dt><dd className="mt-1 text-sm font-bold text-slate-800">Vinculado</dd></div>
          </dl>
        </Card>

        <Card title="Alertas">
          {summary.alerts.length ? <ul className="space-y-2">{summary.alerts.map((alert) => <li className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900" key={alert}>{alert}</li>)}</ul> : <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-bold text-slate-700">Nenhum alerta disponibilizado</p><p className="mt-1 text-xs leading-5 text-slate-500">A tela não presume ausência clínica; apenas não recebeu alertas do serviço.</p></div>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Continuidade atual">
          <dl className="space-y-4">
            <div><dt className="text-xs font-semibold text-slate-400">Última atividade</dt><dd className="mt-1 text-sm font-bold text-slate-800">{summary.lastActivityAt ? dateTimeFormatter.format(new Date(summary.lastActivityAt)) : "Sem atividade"}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-400">Profissional responsável</dt><dd className="mt-1 text-sm font-bold text-slate-800">{summary.responsibleProfessionalName}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-400">Último atendimento</dt><dd className="mt-1 text-sm font-bold text-slate-800">{summary.lastConsultationType ? consultationLabels[summary.lastConsultationType] : "Não disponibilizado"}</dd></div>
          </dl>
        </Card>

        <Card className="lg:col-span-2" title="Etapas do cuidado">
          <div className="grid gap-5 sm:grid-cols-2">
            <div><p className="mb-3 text-xs font-black uppercase tracking-wide text-emerald-700">Concluídas · {summary.completedSteps.length}</p><ul className="space-y-2">{summary.completedSteps.map((step) => <li className="flex items-center gap-2 text-sm font-semibold text-slate-700" key={step.id}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckIcon className="size-3.5" /></span>{step.title}</li>)}</ul></div>
            <div><p className="mb-3 text-xs font-black uppercase tracking-wide text-amber-700">Pendentes · {summary.pendingSteps.length}</p><ul className="space-y-2">{summary.pendingSteps.map((step) => <li className="flex items-center gap-2 text-sm font-semibold text-slate-700" key={step.id}><span className="size-2 shrink-0 rounded-full bg-amber-400" />{step.title}</li>)}</ul></div>
          </div>
          <div className="mt-5 rounded-xl border border-[#cce1d8] bg-[#edf6f2] p-4"><p className="text-xs font-black uppercase tracking-wide text-[#397563]">Próxima etapa sugerida</p><p className="mt-1 text-sm font-black text-[#183029]">{summary.nextSuggestedStep?.title ?? "Nenhuma sugestão disponível"}</p></div>
        </Card>
      </div>

      <Card title="Linha do tempo resumida">
        {summary.timeline.length ? <ol className="relative ml-2 border-l border-[#cbdcd5] pl-6">{[...summary.timeline].reverse().map((item) => <li className="relative pb-6 last:pb-0" key={item.id}><span className="absolute -left-[1.82rem] top-1 size-3 rounded-full border-2 border-white bg-[#3b9b7d] ring-1 ring-[#b7d3c8]" /><div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><p className="text-sm font-black text-slate-800">{item.title}</p><time className="text-xs font-semibold text-slate-400">{dateTimeFormatter.format(new Date(item.occurredAt))}</time></div>{item.detail ? <p className="mt-1 text-sm text-slate-500">{item.detail}</p> : null}<p className="mt-1 text-xs font-semibold text-slate-400">Por {item.actorName}</p></li>)}</ol> : <p className="text-sm text-slate-500">Nenhuma atividade disponibilizada.</p>}
      </Card>
    </div>
  );
}
