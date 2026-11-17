import type { Metadata } from "next";
import Link from "next/link";

import { ExamRequestWorkspace } from "@/components/exam-requests/exam-request-workspace";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { examRequestService } from "@/features/exam-requests/service";
import { canAccess, mvpService } from "@/features/mvp";
import { physicalDocumentProfessionalIdentity } from "@/features/professional-responsibility/document-identity";
import { scientificLibraryService } from "@/features/scientific-library";

export const metadata: Metadata = { title: "Solicitações de exames" };

type SearchValue = string | string[] | undefined;

function single(value: SearchValue) {
  return typeof value === "string" ? value : undefined;
}

export default async function ExamRequestsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ patientId?: SearchValue; query?: SearchValue }>;
}) {
  const [access, query] = await Promise.all([mvpService.getSession(), searchParams]);
  if (
    !canAccess(access, "MASTER_RECORD", "READ") ||
    !canAccess(access, "DELIVERABLES", "READ")
  ) {
    return <PageState title="Acesso não permitido" description="Seu perfil não possui acesso às solicitações de exames dos Entregáveis." tone="blocked" />;
  }

  const patientId = single(query.patientId);
  const search = single(query.query)?.trim().slice(0, 180);
  const canCreate = canAccess(access, "DELIVERABLES", "CREATE");
  const canManageCatalog = scientificLibraryService.canAccess(access.user);

  if (!patientId) {
    const patients = await examRequestService.searchPatients(search);
    return (
      <div className="min-w-0 space-y-5">
        <PageHeading eyebrow="Clínica SV · Entregáveis" title="Solicitações de exames" description="Selecione uma pessoa do prontuário existente para criar, reabrir ou consultar solicitações. Resultados avaliados permanecem separados deste fluxo." />
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <form action="/entregaveis/solicitacoes-exames" className="flex flex-col gap-3 sm:flex-row" method="get">
            <label className="grid flex-1 gap-1 text-sm font-bold text-slate-800">Pessoa <input className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" defaultValue={search} name="query" placeholder="Buscar por nome ou código" type="search" /></label>
            <button className="min-h-11 self-end rounded-xl bg-[#12664f] px-5 text-sm font-black text-white hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" type="submit">Buscar</button>
          </form>
        </section>
        {patients.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {patients.map((patient) => (
              <li key={patient.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-black text-slate-950">{patient.fullName}</p>
                <p className="mt-1 text-sm text-slate-600">Código {patient.clinicalCode}</p>
                <Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-emerald-700 px-4 text-sm font-black text-emerald-900 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" href={`/entregaveis/solicitacoes-exames?patientId=${encodeURIComponent(patient.id)}`}>Abrir solicitações</Link>
              </li>
            ))}
          </ul>
        ) : <PageState title="Nenhuma pessoa encontrada" description="Revise o nome ou o código informado." />}
      </div>
    );
  }

  const [patient, requests, catalog, professional] = await Promise.all([
    examRequestService.getPatient(patientId),
    examRequestService.list(patientId),
    examRequestService.listCatalog(),
    physicalDocumentProfessionalIdentity(access.user.id, access.user.fullName),
  ]);
  if (!patient) return <PageState title="Pessoa não encontrada" description="O cadastro não existe, está inativo ou não possui prontuário ativo." tone="blocked" />;

  return (
    <div className="min-w-0 space-y-5">
      <PageHeading eyebrow="Clínica SV · Entregáveis" title="Solicitações de exames" description="Rascunhos podem ser reabertos e editados. A emissão exige confirmação explícita e congela o documento para reimpressão." />
      <nav aria-label="Ações da pessoa" className="flex flex-wrap gap-2 text-sm">
        <Link className="font-bold text-emerald-800 underline" href="/entregaveis/solicitacoes-exames">Trocar pessoa</Link>
        <Link className="font-bold text-emerald-800 underline" href={`/pacientes/${encodeURIComponent(patient.id)}`}>Voltar ao prontuário</Link>
        <Link className="font-bold text-emerald-800 underline" href="/entregaveis">Ver todos os Entregáveis</Link>
      </nav>
      <ExamRequestWorkspace
        canCreate={canCreate}
        canManageCatalog={canManageCatalog}
        catalog={catalog}
        initialRequests={requests}
        patientBirthDate={patient.birthDate!}
        patientCode={patient.clinicalCode}
        patientId={patient.id}
        patientName={patient.fullName}
        professionalCrn={professional.registrations.find((registration) => /^CRN(?:\b|[- ])/iu.test(registration))}
        professionalName={professional.fullName}
        professionalNutritionTitle={professional.registrations.some((registration) => /^CRN(?:\b|[- ])/iu.test(registration)) || /nutricionista/iu.test(professional.title ?? "") ? "Nutricionista" : undefined}
      />
    </div>
  );
}
