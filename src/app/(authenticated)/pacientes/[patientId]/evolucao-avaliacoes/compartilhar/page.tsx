import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EvaluationEvolutionPrintActions } from "@/components/nutrition-follow-up/evaluation-evolution-print-actions";
import {
  NutritionFollowUpDashboard,
  type EvaluationComparisonTab,
} from "@/components/nutrition-follow-up/nutrition-follow-up-dashboard";
import { PageState } from "@/components/ui/page-state";
import { canAccess, mvpService } from "@/features/mvp";
import { nutritionFollowUpService } from "@/features/nutrition-follow-up/service";

export const metadata: Metadata = {
  title: "Apresentação da evolução e comparativos",
};

export default async function ShareEvaluationEvolutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{
    avaliacoes?: string;
    aba?: string;
    medidas?: string;
    performance?: string;
    regiao?: string;
  }>;
}) {
  const [{ patientId }, query, access] = await Promise.all([
    params,
    searchParams,
    mvpService.getSession(),
  ]);
  const canReadMasterRecord = canAccess(access, "MASTER_RECORD", "READ");
  const canReadAssessments =
    canReadMasterRecord &&
    (["PHYSICAL_ASSESSMENT", "PERIMETRY", "BIOIMPEDANCE"] as const).some(
      (module) => canAccess(access, module, "READ"),
    );
  const canReadPerformance =
    canReadMasterRecord && canAccess(access, "WORKOUT_PLAN", "READ");

  if (!canReadAssessments && !canReadPerformance) {
    return (
      <PageState
        description="Seu perfil não possui acesso à evolução desta pessoa."
        title="Acesso não permitido"
        tone="blocked"
      />
    );
  }

  const view = await nutritionFollowUpService.get(patientId);
  if (!view) notFound();
  const visibleView = {
    ...view,
    evaluations: canReadAssessments ? view.evaluations : [],
    performance: canReadPerformance
      ? view.performance
      : { prescriptions: [], scheduledSessions: [], executions: [] },
  };
  const availableTabs: EvaluationComparisonTab[] = [
    ...(canReadAssessments ? (["measures", "composition"] as const) : []),
    ...(canReadPerformance ? (["performance"] as const) : []),
  ];
  const initialTab: EvaluationComparisonTab =
    query.aba === "composition" || query.aba === "performance"
      ? query.aba
      : "measures";
  const requestedIds = query.avaliacoes === undefined
    ? undefined
    : query.avaliacoes
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
  const requestedPerformanceIds = query.performance === undefined
    ? undefined
    : query.performance
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
  const requestedPerimetryKeys = query.medidas === undefined
    ? undefined
    : query.medidas
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);
  const requestedPerimetryRegion = query.regiao?.trim() || undefined;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <EvaluationEvolutionPrintActions patientId={patientId} />
      <NutritionFollowUpDashboard
        availableTabs={availableTabs}
        initialTab={initialTab}
        initialSelectedEvaluationIds={requestedIds}
        initialSelectedPerformanceIds={requestedPerformanceIds}
        initialPerimetryRegionKey={requestedPerimetryRegion}
        initialSelectedPerimetryKeys={requestedPerimetryKeys}
        presentationMode
        view={visibleView}
      />
    </div>
  );
}
