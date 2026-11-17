import type { Metadata } from "next";

import { ExerciseLibraryWorkspace } from "@/components/performance-endurance/exercise-library-workspace";
import { ButtonLink, PageState } from "@/components/ui";
import { canAccess, mvpService } from "@/features/mvp";
import { performanceEnduranceService } from "@/features/performance-endurance";

export const metadata: Metadata = { title: "Biblioteca de Exercícios" };

export default async function ExerciseLibraryPage() {
  const access = await mvpService.getSession();
  if (
    !performanceEnduranceService.canAccess(access.user) ||
    !canAccess(access, "WORKOUT_PLAN", "READ")
  ) {
    return (
      <PageState
        action={<ButtonLink href="/pacientes">Voltar para pacientes</ButtonLink>}
        description="Seu perfil não possui acesso à Biblioteca de Exercícios."
        title="Acesso não autorizado"
        tone="blocked"
      />
    );
  }
  return <ExerciseLibraryWorkspace />;
}
