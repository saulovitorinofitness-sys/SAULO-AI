import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { PatientBreadcrumb } from "@/components/attendance/patient-breadcrumb";
import { ButtonLink, PageState } from "@/components/ui";
import { canAccess, mvpService } from "@/features/mvp";
import { performanceEnduranceService } from "@/features/performance-endurance";

export const metadata: Metadata = { title: "Performance" };

const PerformanceWorkoutWorkspaceLazy = dynamic(
  () =>
    import("@/components/performance-endurance").then(
      (module) => module.PerformanceWorkoutWorkspace,
    ),
  {
    loading: () => (
      <PageState
        description="Carregando o Plano de Treino."
        title="Performance"
      />
    ),
  },
);

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{
    patientId?: string;
    scenario?: string;
    devUser?: string;
  }>;
}) {
  const [query, access] = await Promise.all([
    searchParams,
    mvpService.getSession(),
  ]);
  if (
    !performanceEnduranceService.canAccess(access.user) ||
    !canAccess(access, "WORKOUT_PLAN", "READ")
  ) {
    return (
      <PageState
        action={
          <ButtonLink href="/pacientes" variant="outline">
            Voltar para pacientes
          </ButtonLink>
        }
        description="Seu perfil não possui acesso à prescrição de treino."
        title="Acesso não autorizado"
        tone="blocked"
      />
    );
  }
  const patientId = query.patientId?.trim();
  if (!patientId) {
    return (
      <PageState
        action={<ButtonLink href="/pacientes">Selecionar paciente</ButtonLink>}
        description="Selecione um paciente para abrir o módulo Performance."
        title="Nenhum paciente selecionado"
      />
    );
  }
  const view = await performanceEnduranceService.getWorkout(
    access.user,
    patientId,
  );
  if (!view) {
    return (
      <PageState
        action={
          <ButtonLink href={`/pacientes/${patientId}`}>
            Voltar ao prontuário
          </ButtonLink>
        }
        description="O paciente precisa possuir um atendimento em andamento para receber uma prescrição de treino."
        title="Atendimento não localizado"
        tone="blocked"
      />
    );
  }
  const preservedParams = new URLSearchParams();
  if (query.scenario) preservedParams.set("scenario", query.scenario);
  if (query.devUser) preservedParams.set("devUser", query.devUser);
  preservedParams.set("patientId", patientId);
  const performanceHref = `/performance-endurance?${preservedParams.toString()}`;

  return (
    <>
      <PatientBreadcrumb
        items={[
          { label: "Performance", href: performanceHref },
          { label: view.patient.name },
        ]}
      />
      <PerformanceWorkoutWorkspaceLazy initialView={view} />
    </>
  );
}
