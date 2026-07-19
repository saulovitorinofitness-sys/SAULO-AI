import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { PatientBreadcrumb } from "@/components/attendance/patient-breadcrumb";
import { ButtonLink, PageState } from "@/components/ui";
import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import { mvpService } from "@/features/mvp";
import { performanceEnduranceService } from "@/features/performance-endurance";

export const metadata: Metadata = { title: "Performance Endurance SV" };

const PerformanceEnduranceWorkspaceLazy = dynamic(
  () => import("@/components/performance-endurance").then((module) => module.PerformanceEnduranceWorkspace),
  { loading: () => <PageState description="Carregando a área de performance." title="Performance Endurance" /> },
);

export default async function PerformanceEndurancePage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const [query, access] = await Promise.all([searchParams, mvpService.getSession()]);
  const viewer = resolveClinicalMockSessionUser(access.user, query.scenario);
  const view = await performanceEnduranceService.getView(viewer);

  if (!view) {
    return (
      <PageState
        action={<ButtonLink href="/pacientes" variant="outline">Voltar para pacientes</ButtonLink>}
        description="O núcleo Performance Endurance SV é exclusivo de Saulo Xavier Vitorino."
        title="Acesso não autorizado"
        tone="blocked"
      />
    );
  }

  return (
    <>
      <PatientBreadcrumb items={[{ label: "Performance", href: "/performance-endurance" }, { label: `Atleta · ${view.athlete.name}` }]} />
      <PerformanceEnduranceWorkspaceLazy view={view} />
    </>
  );
}
