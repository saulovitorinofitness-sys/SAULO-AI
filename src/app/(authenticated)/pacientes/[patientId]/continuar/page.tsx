import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContinuityForm } from "@/components/attendance/continuity-form";
import { PatientNavigation } from "@/components/master-record/patient-navigation";
import { PageHeading, PageState } from "@/components/ui";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { canAccess, mvpService } from "@/features/mvp";
import { patientHubService } from "@/features/patient-hub";

export const metadata: Metadata = { title: "Continuar atendimento" };
export default async function ContinueAttendancePage({ params, searchParams }: { params: Promise<{ patientId: string }>; searchParams: Promise<{ scenario?: string }> }) {
  const [{ patientId }, query] = await Promise.all([params, searchParams]); const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? query.scenario as ClinicalCollectionScenarioKey : "complete"; const [access, attendance, hub] = await Promise.all([mvpService.getSession(), mvpService.getAttendanceContinuity(patientId), patientHubService.get({ patientId, scenario })]);
  if (!canAccess(access, "ATTENDANCE", "UPDATE")) return <PageState description="Seu perfil não permite continuar este atendimento. A validação do servidor permanece obrigatória." title="Acesso não permitido" tone="blocked" />;
  if (!attendance || !hub) notFound();
  return <><PatientNavigation currentModule="ATTENDANCES" initialHub={hub} /><PageHeading description="Retome somente as etapas pendentes, usando os dados já disponíveis." eyebrow="Fluxo operacional" title="Continuar atendimento" /><ContinuityForm attendance={attendance} scenario={scenario} /></>;
}
