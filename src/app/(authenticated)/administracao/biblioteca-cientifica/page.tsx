import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { PatientBreadcrumb } from "@/components/attendance/patient-breadcrumb";
import { ButtonLink, PageState } from "@/components/ui";
import { resolveClinicalMockSessionUser } from "@/features/clinical-collection/mock-data";
import { mvpService } from "@/features/mvp";
import { scientificLibraryService } from "@/features/scientific-library";

export const metadata: Metadata = { title: "Biblioteca Científica | Clínica SV" };

const ScientificLibraryWorkspaceLazy = dynamic(
  () => import("@/components/scientific-library").then((module) => module.ScientificLibraryWorkspace),
  { loading: () => <PageState description="Carregando a Biblioteca Científica." title="Biblioteca Científica" /> },
);

export default async function ScientificLibraryPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const [query, access] = await Promise.all([searchParams, mvpService.getSession()]);
  const viewer = resolveClinicalMockSessionUser(access.user, query.scenario);
  const view = await scientificLibraryService.getView(viewer);

  if (!view) {
    return (
      <PageState
        action={<ButtonLink href="/pacientes" variant="outline">Voltar para pacientes</ButtonLink>}
        description="A Biblioteca Científica é exclusiva de Saulo Xavier Vitorino."
        title="Acesso não autorizado"
        tone="blocked"
      />
    );
  }

  return (
    <>
      <PatientBreadcrumb items={[{ label: "Administração", href: "/administracao/biblioteca-cientifica" }, { label: "Biblioteca Científica" }]} />
      <ScientificLibraryWorkspaceLazy view={view} />
    </>
  );
}
