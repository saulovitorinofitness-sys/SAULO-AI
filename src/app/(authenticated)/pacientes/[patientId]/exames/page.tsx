import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { PatientNavigation } from "@/components/master-record/patient-navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { PageState } from "@/components/ui/page-state";
import { CLINICAL_COLLECTION_SCENARIO_KEYS, type ClinicalCollectionScenarioKey } from "@/features/clinical-collection";
import { canAccess, mvpService } from "@/features/mvp";
import { laboratoryExamsService } from "@/features/laboratory-exams";
import { patientHubService } from "@/features/patient-hub";

export const metadata: Metadata = { title: "Exames Laboratoriais" };

const LaboratoryExamsLazy = dynamic(() => import("@/components/laboratory-exams/laboratory-exams").then((module) => module.LaboratoryExams), {
  loading: () => <PageState description="Carregando os exames laboratoriais." title="Exames" />,
});

export default async function LaboratoryExamsPage({ params, searchParams }: { params: Promise<{ patientId: string }>; searchParams: Promise<{ scenario?: string }> }) {
  const [{ patientId }, query, access] = await Promise.all([params, searchParams, mvpService.getSession()]);
  const scenario = CLINICAL_COLLECTION_SCENARIO_KEYS.includes(query.scenario as ClinicalCollectionScenarioKey) ? (query.scenario as ClinicalCollectionScenarioKey) : "complete";
  const [view, hub] = await Promise.all([
    laboratoryExamsService.get({ patientId, scenario }),
    patientHubService.get({ patientId, scenario }),
  ]);

  if (!view || !hub) notFound();

  return (
    <>
      <PatientNavigation currentModule="LABORATORY_EXAMS" initialHub={hub} />
      <PageHeading description="Organização cronológica dos exames, sem interpretação, diagnóstico ou cálculo de risco." eyebrow="Prontuário Mestre · mock" title="Exames Laboratoriais" />
      <LaboratoryExamsLazy initialView={{ ...view, canEdit: canAccess(access, "MASTER_RECORD", "UPDATE") && view.canEdit }} />
    </>
  );
}
