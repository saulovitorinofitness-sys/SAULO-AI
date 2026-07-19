import type { Metadata } from "next";

import { PatientForm } from "@/components/patients/patient-form";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { canAccess, mvpService } from "@/features/mvp";

export const metadata: Metadata = { title: "Novo paciente" };

export default async function NewPatientPage() {
  const access = await mvpService.getSession();
  if (!canAccess(access, "PATIENTS", "CREATE")) {
    return <PageState description="Seu perfil não permite cadastrar pacientes. A validação no servidor continuará obrigatória quando o endpoint existir." title="Acesso não permitido" tone="blocked" />;
  }
  return (
    <>
      <PageHeading backHref="/pacientes" description="Cadastre os dados estruturais uma única vez para reutilização pelos módulos autorizados." eyebrow="Cadastro compartilhado" title="Novo paciente" />
      <PatientForm />
    </>
  );
}
