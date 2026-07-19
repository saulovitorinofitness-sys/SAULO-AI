import type { Metadata } from "next";
import Link from "next/link";

import { PatientList } from "@/components/patients/patient-list";
import { PlusIcon } from "@/components/ui/icons";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { canAccess, mvpService } from "@/features/mvp";

export const metadata: Metadata = { title: "Pacientes" };

export default async function PatientsPage() {
  const [access, patients] = await Promise.all([mvpService.getSession(), mvpService.searchPatients({})]);

  if (!canAccess(access, "PATIENTS", "READ")) {
    return <PageState description="Seu perfil não possui acesso à lista de pacientes. Solicite a revisão das permissões ao administrador." title="Acesso não permitido" tone="blocked" />;
  }

  return (
    <>
      <PageHeading
        action={canAccess(access, "PATIENTS", "CREATE") ? <Link className="hidden min-h-11 items-center gap-2 rounded-xl bg-[#12664f] px-4 text-sm font-bold text-white hover:bg-[#0a4938] sm:inline-flex" href="/pacientes/novo"><PlusIcon className="size-4" />Novo paciente</Link> : null}
        description="Localize um cadastro único e retome o cuidado do ponto certo."
        eyebrow="Cadastro compartilhado"
        title="Pacientes"
      />
      {patients.length === 0 ? <PageState description="Quando o primeiro cadastro for integrado, ele aparecerá aqui." title="Nenhum paciente cadastrado" /> : <PatientList patients={patients} />}
    </>
  );
}
