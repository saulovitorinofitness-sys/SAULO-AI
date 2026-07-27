import type { Metadata } from "next";

import { PatientForm } from "@/components/patients/patient-form";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { canAccess, mvpService } from "@/features/mvp";

export const metadata: Metadata = { title: "Novo paciente" };

export default async function NewPatientPage() {
  const access = await mvpService.getSession();

  if (!canAccess(access, "PATIENTS", "CREATE")) {
    return (
      <PageState
        description="Seu perfil não permite cadastrar pacientes."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  return (
    <>
      <PageHeading
        backHref="/pacientes"
        description="Informe os dados essenciais para criar o prontuário e iniciar automaticamente a consulta."
        eyebrow="Cadastro compartilhado"
        title="Novo paciente"
      />
      <PatientForm />
    </>
  );
}
