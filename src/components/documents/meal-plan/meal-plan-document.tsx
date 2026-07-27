import { DocumentClosingPage } from "@/components/documents/document-closing-page";
import { DocumentHeader } from "@/components/documents/document-header";
import { DocumentLayout } from "@/components/documents/document-layout";
import { DocumentSection } from "@/components/documents/document-section";
import type {
  AssistedMealPreview,
  MealPlanView,
} from "@/features/meal-plan";
import type { AttendanceProfessionalParticipant } from "@/features/professional-responsibility";

import { MealPlanMealCard } from "./meal-plan-meal-card";
import { MealPlanSummary } from "./meal-plan-summary";

export const MEAL_PLAN_DOCUMENT_ID = "meal-plan-professional-document";

export function MealPlanDocument({
  issuedAt,
  patient,
  plan,
  professionals,
  preview,
}: {
  issuedAt: string;
  patient: {
    age?: number;
    sex?: string;
    phone?: string;
  };
  plan: MealPlanView;
  professionals: readonly AttendanceProfessionalParticipant[];
  preview: AssistedMealPreview;
}) {
  const hydration = Array.from(
    new Set(
      plan.meals
        .map((meal) => meal.hydration.trim())
        .filter((value) => value && value !== "Não informado"),
    ),
  );
  const mealTimes = plan.meals
    .map((meal) => `${meal.time} - ${meal.name}`)
    .join(" · ");

  return (
    <DocumentLayout documentId={MEAL_PLAN_DOCUMENT_ID}>
      <div className="px-[12mm] py-[12mm] sm:px-[15mm] sm:py-[14mm]">
        <DocumentHeader
          issuedAt={issuedAt}
          patient={{
            fullName: plan.patientName,
            age: patient.age,
            sex: patient.sex,
            phone: patient.phone,
            objective: plan.summary.primaryObjective,
          }}
        />

        <div className="mt-5 rounded-lg border border-[#ead9aa] bg-[#fffbef] px-3 py-2 text-[9px] font-bold leading-4 text-[#795b1b]">
          Prévia demonstrativa gerada com os dados mockados atuais. Requer
          revisão e validação do nutricionista antes da entrega.
        </div>

        <DocumentSection title="Resumo nutricional">
          <MealPlanSummary plan={plan} />
        </DocumentSection>

        <DocumentSection
          description="Distribuição diária organizada por horário. Valores nutricionais da prévia assistida demonstrativa."
          title="Plano alimentar"
        >
          <div className="space-y-3">
            {preview.meals.map((meal, index) => (
              <MealPlanMealCard
                key={meal.id}
                meal={meal}
                planMeal={
                  plan.meals.find((item) => item.id === meal.id) ??
                  plan.meals[index]
                }
              />
            ))}
          </div>
        </DocumentSection>

        <DocumentSection
          description="Registros existentes no plano atual; não constituem novas recomendações clínicas."
          title="Orientações"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#dfe7e3] p-3">
              <p className="text-[9px] font-black uppercase tracking-wide text-[#718079]">
                Organização dos horários
              </p>
              <p className="mt-2 text-[10px] leading-5 text-[#40564e]">
                {mealTimes}
              </p>
            </div>

            {hydration.length ? (
              <div className="rounded-xl border border-[#dfe7e3] p-3">
                <p className="text-[9px] font-black uppercase tracking-wide text-[#718079]">
                  Hidratação
                </p>
                <p className="mt-2 text-[10px] leading-5 text-[#40564e]">
                  {hydration.join(" · ")}
                </p>
              </div>
            ) : null}

            {plan.summary.observations ? (
              <div className="rounded-xl border border-[#dfe7e3] p-3 sm:col-span-2">
                <p className="text-[9px] font-black uppercase tracking-wide text-[#718079]">
                  Observações profissionais
                </p>
                <p className="mt-2 text-[10px] leading-5 text-[#40564e]">
                  {plan.summary.observations}
                </p>
              </div>
            ) : null}
          </div>
        </DocumentSection>
      </div>

      <DocumentClosingPage professionals={professionals} />
    </DocumentLayout>
  );
}
