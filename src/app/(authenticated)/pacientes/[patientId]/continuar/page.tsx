import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";

export const metadata: Metadata = {
  title: "Continuar atendimento",
};

export default async function ContinueAttendancePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;

  const attendance =
    await clinicalCollectionRepository.findOpenAttendance(patientId);

  if (!attendance || attendance.status === "DRAFT") {
    redirect(`/pacientes/${patientId}`);
  }

  const attendanceId = attendance.id;

  const result = await nutritionClinicalFlowRepository.getFlow({
    patientId,
    attendanceId,
  });

  if (!result) {
    redirect(`/pacientes/${patientId}`);
  }

  /*
   * Em prontuários antigos pode existir uma etapa anterior ainda marcada
   * como IN_PROGRESS, mesmo depois de o atendimento ter avançado para
   * módulos posteriores. Nessa situação, "Continuar atendimento" deve
   * retomar a etapa mais avançada que já está em andamento, e não voltar
   * para um rascunho clínico antigo.
   */
  const latestInProgressStep = [...result.flow]
    .reverse()
    .find((step) => step.status === "IN_PROGRESS");

  redirect((latestInProgressStep ?? result.resumeStep).href);
}
