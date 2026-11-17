import type { Metadata } from "next";

import { PatientForm } from "@/components/patients/patient-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Editar cadastro do paciente" };

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;

  return (
    <>
      <PageHeading
        action={
          <ButtonLink href={`/pacientes/${patientId}`} variant="secondary">
            Voltar ao paciente
          </ButtonLink>
        }
        description="Atualize os dados permanentes do cadastro do paciente, separados dos registros clínicos de atendimento."
        eyebrow="Cadastro permanente"
        title="Editar cadastro do paciente"
      />
      <PatientForm mode="edit" patientId={patientId} />
    </>
  );
}
