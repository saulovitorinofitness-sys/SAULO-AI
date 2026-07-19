import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { PatientBreadcrumb } from "@/components/attendance/patient-breadcrumb";
import { ButtonLink, PageState } from "@/components/ui";
import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import { executiveIntelligenceService } from "@/features/executive-intelligence";
import { mvpService } from "@/features/mvp";

export const metadata: Metadata = { title: "Central de Inteligência | Clínica SV" };

const ExecutiveDashboardLazy = dynamic(
  () => import("@/components/executive-intelligence").then((module) => module.ExecutiveDashboard),
  { loading: () => <PageState description="Carregando a Central de Inteligência." title="Central de Inteligência" /> },
);

export default async function ExecutiveIntelligencePage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const [query, access] = await Promise.all([searchParams, mvpService.getSession()]);
  const viewer = resolveClinicalMockSessionUser(access.user, query.scenario);
  const view = await executiveIntelligenceService.getView(viewer);

  if (!view) {
    return (
      <PageState
        action={<ButtonLink href="/pacientes" variant="outline">Voltar para pacientes</ButtonLink>}
        description="A Central de Inteligência é exclusiva de Saulo Xavier Vitorino."
        title="Acesso não autorizado"
        tone="blocked"
      />
    );
  }

  return (
    <>
      <PatientBreadcrumb items={[{ label: "Gestão", href: "/dashboard" }, { label: "Central de Inteligência" }]} />
      <ExecutiveDashboardLazy view={view} />
    </>
  );
}
