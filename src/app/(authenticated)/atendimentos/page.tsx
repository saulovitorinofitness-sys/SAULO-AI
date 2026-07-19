import type { Metadata } from "next";
import Link from "next/link";

import { ArrowIcon, AttendanceIcon } from "@/components/ui/icons";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { canAccess, mvpService } from "@/features/mvp";

export const metadata: Metadata = { title: "Atendimentos" };

export default async function AttendancesPage() {
  const [access, patients] = await Promise.all([mvpService.getSession(), mvpService.searchPatients({})]);
  if (!canAccess(access, "ATTENDANCE", "READ")) return <PageState description="Seu perfil não possui acesso aos atendimentos. A autorização do servidor permanece obrigatória." title="Acesso não permitido" tone="blocked" />;
  const openAttendances = patients.filter((patient) => patient.openAttendanceId);
  return (
    <>
      <PageHeading description="Atendimentos que podem ser retomados com o contexto do Prontuário Mestre." eyebrow="Continuidade" title="Atendimentos" />
      {openAttendances.length === 0 ? <PageState description="Nenhum atendimento aberto foi disponibilizado pelo serviço." title="Nenhum atendimento em andamento" /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {openAttendances.map((item) => <article className="rounded-2xl border border-[#dce5e0] bg-white p-5 shadow-[0_8px_24px_rgb(20_55_44/0.03)]" key={item.openAttendanceId}><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#e7f2ed] text-[#12664f]"><AttendanceIcon /></span><div><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Em andamento</p><h2 className="mt-1 text-lg font-black text-slate-900">{item.patient.fullName}</h2><p className="mt-1 text-sm text-slate-500">Próxima etapa: {item.nextPendingStep ?? "Não indicada"}</p></div></div><Link className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#12664f] px-4 text-sm font-black text-white hover:bg-[#0a4938]" href={`/pacientes/${item.patient.id}/continuar`}>Continuar atendimento<ArrowIcon className="size-4" /></Link></article>)}
        </div>
      )}
    </>
  );
}
