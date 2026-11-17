import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClinicalPanel } from "@/components/clinical-panel/clinical-panel";
import { NutritionClinicalPanel } from "@/components/nutrition-strategy";
import { NutritionDiagnosisReviewForm } from "@/components/nutrition-strategy/nutrition-diagnosis-review";
import { PatientNavigation } from "@/components/master-record/patient-navigation";
import { ButtonLink } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, clinicalCollectionService, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { canAccess, mvpService } from "@/features/mvp";
import { nutritionDiagnosisReviewRepository } from "@/features/nutrition-diagnosis-review/repository";
import { patientHubService } from "@/features/patient-hub";
import { nutritionClinicalPanelRepository } from "@/features/nutrition-strategy/clinical-panel-repository";
import { nutritionStrategyService } from "@/features/nutrition-strategy";

export const metadata: Metadata = { title: "Painel Clínico Integrado" };

function safeDeliverableReturnHref(
  value: string | undefined,
  patientId: string,
  attendanceId: string,
) {
  if (!value || !value.startsWith("/")) return undefined;
  const url = new URL(value, "http://localhost");
  if (
    url.pathname !== "/clinica/plano-alimentar/entregavel" ||
    url.searchParams.get("patientId") !== patientId ||
    url.searchParams.get("attendanceId") !== attendanceId
  ) {
    return undefined;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export default async function ClinicalPanelPage({ params, searchParams }: { params: Promise<{ patientId: string; attendanceId: string }>; searchParams: Promise<{ scenario?: string; section?: string; returnTo?: string }> }) {
  const [{ patientId, attendanceId }, query, access] = await Promise.all([params, searchParams, mvpService.getSession()]);
  if (!canAccess(access, "MASTER_RECORD", "READ")) return <PageState description="Seu perfil não pode visualizar o Painel Clínico Integrado." title="Acesso não permitido" tone="blocked" />;
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? query.scenario as ClinicalCollectionScenarioKey : "complete";
  const [panel, hub] = await Promise.all([clinicalCollectionService.getClinicalPanel({ patientId, attendanceId, scenario }), patientHubService.get({ patientId, scenario })]);
  if (panel && hub) {
    return <><PatientNavigation currentModule="CLINICAL_PANEL" initialHub={hub} /><PageHeading description="Conferência integrada dos registros existentes, sem nova coleta de dados." eyebrow="Preparação para decisão profissional" title="Painel Clínico Integrado" /><ClinicalPanel initialPanel={panel} /></>;
  }

  if (
    !canAccess(access, "NUTRITION_STRATEGY", "READ") ||
    !nutritionStrategyService.canAccess(access.user)
  ) {
    return <PageState description="Seu perfil não possui acesso ao contexto clínico exclusivo da Nutrição." title="Acesso não permitido" tone="blocked" />;
  }

  const nutritionPanel = await nutritionClinicalPanelRepository.get(
    patientId,
    attendanceId,
  );
  if (!nutritionPanel) notFound();

  const deliverableHref = `/clinica/plano-alimentar/entregavel?patientId=${encodeURIComponent(patientId)}&attendanceId=${encodeURIComponent(attendanceId)}&view=nutrition`;
  const returnHref =
    safeDeliverableReturnHref(query.returnTo, patientId, attendanceId) ??
    deliverableHref;
  const diagnosisReviewHref = `/pacientes/${encodeURIComponent(patientId)}/atendimentos/${encodeURIComponent(attendanceId)}/painel-clinico?scenario=${encodeURIComponent(scenario)}&section=diagnosis-review&returnTo=${encodeURIComponent(returnHref)}#diagnosis-review`;
  const diagnosisReviewOutcome =
    nutritionPanel.inheritedClinicalContext.diagnosisReview?.outcome;
  const canReviewDiagnosis =
    canAccess(access, "MASTER_RECORD", "UPDATE") &&
    canAccess(access, "NUTRITION_STRATEGY", "UPDATE");
  const diagnosisReview =
    query.section === "diagnosis-review"
      ? await nutritionDiagnosisReviewRepository.get(patientId, attendanceId)
      : null;

  return (
    <div className="space-y-5">
      <PageHeading description="Contexto nutricional carregado do Prontuário Mestre para este paciente e atendimento." eyebrow="Preparação para decisão profissional" title="Painel Clínico Integrado" />
      {!diagnosisReviewOutcome ? (
        <PageState
          action={canReviewDiagnosis ? <ButtonLink href={diagnosisReviewHref}>Registrar revisão diagnóstica</ButtonLink> : undefined}
          description="A consulta foi concluída com sucesso, mas este atendimento não possui diagnóstico revisado. A Anamnese de retorno e a confirmação de alergias são registros diferentes e permanecerão inalterados."
          title="Diagnóstico clínico não registrado"
        />
      ) : null}
      {diagnosisReviewOutcome === "NO_DIAGNOSIS_ESTABLISHED" ? (
        <PageState
          description="O profissional concluiu a revisão deste atendimento sem estabelecer diagnóstico. Nenhuma condição foi criada e isso não presume ausência de doença."
          title="Revisão concluída sem diagnóstico estabelecido"
        />
      ) : null}
      <NutritionClinicalPanel view={nutritionPanel} />
      {query.section === "diagnosis-review" ? (
        canReviewDiagnosis ? (
          <NutritionDiagnosisReviewForm
            attendanceId={attendanceId}
            initialReview={diagnosisReview}
            patientId={patientId}
            returnHref={returnHref}
          />
        ) : (
          <PageState
            description="Seu perfil pode consultar o contexto clínico, mas não pode registrar uma revisão diagnóstica."
            title="Revisão não permitida"
            tone="blocked"
          />
        )
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        <ButtonLink href={returnHref} variant="secondary">Voltar ao Entregável sem salvar</ButtonLink>
      </div>
    </div>
  );
}
