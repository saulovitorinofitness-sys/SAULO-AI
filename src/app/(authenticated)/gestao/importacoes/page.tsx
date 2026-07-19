import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { PatientBreadcrumb } from "@/components/attendance/patient-breadcrumb";
import { ButtonLink, PageHeading, PageState } from "@/components/ui";
import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import { businessImportService } from "@/features/business-import";
import { mvpService } from "@/features/mvp";

export const metadata: Metadata = { title: "Importação de Relatórios" };

const ImportWorkspaceLazy = dynamic(
  () => import("@/components/business-import").then((module) => module.ImportWorkspace),
  { loading: () => <PageState description="Carregando a área de importação demonstrativa." title="Importações" /> },
);

export default async function BusinessImportPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const [query, access] = await Promise.all([searchParams, mvpService.getSession()]);
  const viewer = resolveClinicalMockSessionUser(access.user, query.scenario);
  const workspace = await businessImportService.getWorkspace(viewer);

  if (!workspace) {
    return (
      <PageState
        action={<ButtonLink href="/pacientes" variant="outline">Voltar para pacientes</ButtonLink>}
        description="A Central de Importações é exclusiva de Saulo Xavier Vitorino nesta Sprint."
        title="Acesso não autorizado"
        tone="blocked"
      />
    );
  }

  return (
    <>
      <PatientBreadcrumb items={[{ label: "Gestão", href: "/dashboard" }, { label: "Importações" }]} />
      <PageHeading backHref="/dashboard" description="Valide arquivos do Next Fit localmente antes de simular dados no Painel do CEO." eyebrow="SAULO AI · Gestão empresarial" title="Central de Importação de Dados" />
      <ImportWorkspaceLazy initialView={workspace} />
    </>
  );
}
