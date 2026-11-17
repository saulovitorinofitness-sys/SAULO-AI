import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ClinicalCollectionFlow } from "@/components/clinical-collection/clinical-collection-flow";
import { PermissionDeniedState } from "@/components/clinical-collection/clinical-states";
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
  if (
    requestedStep === "POSTURAL_ASSESSMENT" &&
    (!canAccess(access, "POSTURAL_ASSESSMENT", "READ") ||
      !canOperatePosturalAssessment(access.user.id))
  ) {
    return <PermissionDeniedState />;
  }
  if (
    requestedStep === "SUMMARY" &&
    !canAccess(access, "MASTER_RECORD", "READ")
  ) {
    return <PermissionDeniedState />;
  }

  const result = await nutritionClinicalFlowRepository.getFlow({
    patientId,
    attendanceId,
  });

  if (!result) notFound();
  const { collection } = result;
  const resumeIsCollectionStep =
    result.resumeStep.id in clinicalCollectionStepByFlowStep;

  if (!requestedStep && !resumeIsCollectionStep) {
    redirect(result.resumeStep.href);
  }

  const resumedCollectionStep =
    resumeIsCollectionStep
      ? clinicalCollectionStepByFlowStep[
          result.resumeStep
            .id as keyof typeof clinicalCollectionStepByFlowStep
        ]
      : "ANTHROPOMETRY";
  const initialStep = requestedStep ?? resumedCollectionStep;

  return (
    <ClinicalCollectionFlow
      canCompleteSummary={canAccess(access, "MASTER_RECORD", "UPDATE")}
      canContinueSummaryToNutrition={canAccess(
        access,
        "NUTRITION_STRATEGY",
        "READ",
      )}
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
      initialCollection={collection}
      initialFlow={result.flow}
      initialStep={initialStep}
      scenarios={[]}
    />
  );
}
