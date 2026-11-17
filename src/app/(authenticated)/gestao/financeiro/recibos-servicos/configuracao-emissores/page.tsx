import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PatientBreadcrumb } from "@/components/attendance/patient-breadcrumb";
import { IssuerConfigurationWorkspace } from "@/components/financial/issuer-configuration-workspace";
import { PageHeading } from "@/components/ui";
import { mvpService } from "@/features/mvp";
import { BUILT_IN_IDS } from "@/modules/permissions";

export const metadata: Metadata = { title: "Configuração dos emissores | Recibos de Serviços" };

export default async function IssuerConfigurationPage() {
  const access = await mvpService.getSession();
  if (access.user.id !== BUILT_IN_IDS.users.sauloXavierVitorino) notFound();

  return <>
    <PatientBreadcrumb items={[
      { label: "Gestão", href: "/gestao" },
      { label: "Financeiro", href: "/gestao/financeiro" },
      { label: "Recibos de Serviços", href: "/gestao/financeiro/recibos-servicos" },
      { label: "Configuração dos emissores" },
    ]} />
    <PageHeading
      backHref="/gestao/financeiro/recibos-servicos"
      description="Cadastre os dados legais usados pelo novo fluxo. Documentos salvos são protegidos e aparecem apenas parcialmente ocultos."
      eyebrow="Gestão · Financeiro · Recibos de Serviços"
      title="Configuração dos emissores"
    />
    <IssuerConfigurationWorkspace />
  </>;
}
