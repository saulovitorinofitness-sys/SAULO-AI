import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { ButtonLink, PageState } from "@/components/ui";
import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import { executiveDashboardService } from "@/features/executive-dashboard";
import { mvpService } from "@/features/mvp";
import { PatientBreadcrumb } from "@/components/attendance/patient-breadcrumb";

export const metadata: Metadata = { title: "Dashboard Executivo" };
const DashboardWorkspaceLazy = dynamic(() => import("@/components/executive-dashboard").then((module) => module.DashboardWorkspace), {
  loading: () => <PageState description="Carregando indicadores executivos." title="Dashboard Executivo" />,
});

export default async function ExecutiveDashboardPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const [query, access] = await Promise.all([searchParams, mvpService.getSession()]);
  const viewer = resolveClinicalMockSessionUser(access.user, query.scenario);
  const dashboard = await executiveDashboardService.getDashboard(viewer);
  if (!dashboard) return <PageState action={<ButtonLink href="/pacientes" variant="outline">Voltar para pacientes</ButtonLink>} description="Este módulo executivo é exclusivo de Saulo Xavier Vitorino." title="Acesso não autorizado" tone="blocked" />;
  return <><PatientBreadcrumb items={[{ label: "Gestão" }, { label: "Painel do CEO" }]} /><DashboardWorkspaceLazy dashboard={dashboard} /></>;
}
