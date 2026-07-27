import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClinicalCollectionFlow } from "@/components/clinical-collection/clinical-collection-flow";
import type { ClinicalCollectionStepKey } from "@/features/clinical-collection";
import { clinicalCollectionStepByFlowStep } from "@/features/nutrition-clinical-flow";
import { nutritionClinicalFlowRepository } from "@/features/nutrition-clinical-flow/repository";
import { canAccess, mvpService } from "@/features/mvp";
import { canOperatePosturalAssessment } from "@/features/professional-responsibility";

export const metadata: Metadata = {
  title: "Avaliação",
};

const validSteps: readonly ClinicalCollectionStepKey[] = [
  "ANTHROPOMETRY",
  "PERIMETRY",
  "BIOIMPEDANCE",
  "POSTURAL_ASSESSMENT",
  "SUMMARY",
];

export default async function ClinicalCollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{
    patientId: string;
    attendanceId: string;
  }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ patientId, attendanceId }, query, access] = await Promise.all([
    params,
    searchParams,
    mvpService.getSession(),
  ]);
  const requestedStep = validSteps.includes(
    query.step as ClinicalCollectionStepKey,
  )
    ? (query.step as ClinicalCollectionStepKey)
    : undefined;
  const result = await nutritionClinicalFlowRepository.getFlow({
    patientId,
    attendanceId,
  });

  if (!result) notFound();
  const { collection } = result;
  const resumedCollectionStep =
    result.resumeStep.id in clinicalCollectionStepByFlowStep
      ? clinicalCollectionStepByFlowStep[
          result.resumeStep
            .id as keyof typeof clinicalCollectionStepByFlowStep
        ]
      : "SUMMARY";
  const initialStep = requestedStep ?? resumedCollectionStep;

  return (
    <ClinicalCollectionFlow
      editableSteps={validSteps.filter(
        (step): step is Exclude<ClinicalCollectionStepKey, "SUMMARY"> =>
          step !== "SUMMARY" &&
          (step !== "POSTURAL_ASSESSMENT" ||
            canOperatePosturalAssessment(access.user.id)) &&
          canAccess(
            access,
            step === "ANTHROPOMETRY"
              ? "PHYSICAL_ASSESSMENT"
              : step,
            "UPDATE",
          ),
      )}
      initialCollection={{
        ...collection,
        connectedProfessional: {
          professionalUserId: access.user.id,
          professionalName: access.user.fullName,
          updatedAt: new Date().toISOString(),
          version: collection.connectedProfessional.version,
        },
      }}
      initialFlow={result.flow}
      initialStep={initialStep}
      scenarios={[]}
    />
  );
}
