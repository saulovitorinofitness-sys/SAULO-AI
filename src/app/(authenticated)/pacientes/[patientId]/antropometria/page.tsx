import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { PatientNavigation, type PatientNavigationModule } from "@/components/master-record/patient-navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { anthropometryPerimetryService } from "@/features/anthropometry-perimetry";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { canAccess, mvpService } from "@/features/mvp";
import { patientHubService } from "@/features/patient-hub";

export const metadata: Metadata = { title: "Antropometria e Perimetria" };

const AnthropometryPerimetryModuleLazy = dynamic(
  () => import("@/components/anthropometry-perimetry/anthropometry-perimetry-module").then((module) => module.AnthropometryPerimetryModule),
  { loading: () => <PageState description="Carregando antropometria e perimetria." title="Antropometria e Perimetria" /> },
);

export default async function AnthropometryPerimetryPage({ params, searchParams }: { params: Promise<{ patientId: string }>; searchParams: Promise<{ scenario?: string; module?: string }> }) {
  const [{ patientId }, query, access] = await Promise.all([params, searchParams, mvpService.getSession()]);
  if (!canAccess(access, "PHYSICAL_ASSESSMENT", "READ") || !canAccess(access, "PERIMETRY", "READ")) {
    return <PageState description="Seu perfil não possui acesso à Antropometria e Perimetria." title="Acesso não permitido" tone="blocked" />;
  }

  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? (query.scenario as ClinicalCollectionScenarioKey) : "complete";
  const summary = await mvpService.getPatientMasterRecord(patientId);
  if (!summary?.patient.openAttendanceId) notFound();

  const [view, hub] = await Promise.all([
    anthropometryPerimetryService.get({ patientId, attendanceId: summary.patient.openAttendanceId, scenario }),
    patientHubService.get({ patientId, scenario }),
  ]);

  if (!view || !hub) notFound();

  const currentModule: PatientNavigationModule = query.module === "perimetry" ? "PERIMETRY" : "ANTHROPOMETRY";

  return (
    <>
      <PatientNavigation currentModule={currentModule} initialHub={hub} />
      <PageHeading description="Medidas corporais estruturadas, vinculadas ao mesmo prontuário e sem interpretação automática." eyebrow="Prontuário Mestre · mock" title="Antropometria e Perimetria" />
      <AnthropometryPerimetryModuleLazy initialView={{ ...view, canEdit: canAccess(access, "PHYSICAL_ASSESSMENT", "UPDATE") && canAccess(access, "PERIMETRY", "UPDATE") && view.canEdit }} />
    </>
  );
}
