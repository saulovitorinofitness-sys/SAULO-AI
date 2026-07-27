import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { clinicalCollectionRepository } from "@/features/clinical-collection/repository";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";

export const metadata: Metadata = { title: "Continuar atendimento" };

export default async function ContinueAttendancePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const attendanceId =
    await clinicalCollectionRepository.findOpenAttendanceId(patientId);

  if (!attendanceId) notFound();

  const result = await nutritionClinicalFlowRepository.getFlow({
    patientId,
    attendanceId,
  });

  if (!result) notFound();

  redirect(result.resumeStep.href);
}
