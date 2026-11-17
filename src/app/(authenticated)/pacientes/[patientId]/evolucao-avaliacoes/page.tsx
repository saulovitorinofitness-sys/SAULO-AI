import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  NutritionFollowUpDashboard,
  type EvaluationComparisonTab,
} from "@/components/nutrition-follow-up/nutrition-follow-up-dashboard";
import { ButtonLink } from "@/components/ui";
import { PageState } from "@/components/ui/page-state";
import { canAccess, mvpService } from "@/features/mvp";
import { nutritionFollowUpService } from "@/features/nutrition-follow-up/service";

export const metadata: Metadata = { title: "Evolução e comparativos" };

function evolutionPermissions(
  access: Awaited<ReturnType<typeof mvpService.getSession>>,
) {
  const canReadMasterRecord = canAccess(access, "MASTER_RECORD", "READ");
  const canReadAssessments =
    canReadMasterRecord &&
    (["PHYSICAL_ASSESSMENT", "PERIMETRY", "BIOIMPEDANCE"] as const).some(
      (module) => canAccess(access, module, "READ"),
    );
  const canReadPerformance =
    canReadMasterRecord && canAccess(access, "WORKOUT_PLAN", "READ");
  return { canReadAssessments, canReadPerformance };
}

function requestedTab(value?: string): EvaluationComparisonTab {
  if (value === "composition" || value === "performance") return value;
  return "measures";
}

export default async function EvaluationEvolutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ scenario?: string; aba?: string }>;
}) {
  const [{ patientId }, query, access] = await Promise.all([
    params,
    searchParams,
    mvpService.getSession(),
  ]);

  const permissions = evolutionPermissions(access);
  if (!permissions.canReadAssessments && !permissions.canReadPerformance) {
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
    evaluations: permissions.canReadAssessments ? view.evaluations : [],
    performance: permissions.canReadPerformance
      ? view.performance
      : { prescriptions: [], scheduledSessions: [], executions: [] },
  };
  const availableTabs: EvaluationComparisonTab[] = [
    ...(permissions.canReadAssessments
      ? (["measures", "composition"] as const)
      : []),
    ...(permissions.canReadPerformance ? (["performance"] as const) : []),
  ];

  return (
    <>
      <header className="mb-5 flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">Evolução e comparativos</p>
          <h1 className="mt-1 truncate text-xl font-black text-[var(--text-primary)]">{visibleView.patient.name}</h1>
          <p className="mt-1 text-xs font-bold text-[var(--text-secondary)]">{visibleView.patient.clinicalCode}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/avaliacoes?view=comparativos" size="small" variant="outline">Trocar pessoa</ButtonLink>
          <ButtonLink href={`/pacientes/${encodeURIComponent(visibleView.patient.id)}`} size="small" variant="secondary">Voltar ao prontuário</ButtonLink>
        </div>
      </header>
      <NutritionFollowUpDashboard
        availableTabs={availableTabs}
        initialTab={requestedTab(query.aba)}
        view={visibleView}
      />
    </>
  );
}
