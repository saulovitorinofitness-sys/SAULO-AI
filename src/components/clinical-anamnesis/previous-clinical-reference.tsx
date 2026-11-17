import { SectionCard } from "@/components/clinical-collection/section-card";
import type { PreviousClinicalReference } from "@/features/nutrition-return-anamnesis/contracts";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function textOrMissing(value: string | undefined) {
  return value?.trim() || "Não informado";
}

function dateOrMissing(value: string | undefined) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Não informado"
    : dateTime.format(parsed);
}

function numberOrMissing(value: number | undefined, unit: string) {
  return value === undefined
    ? "Não informado"
    : `${new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 1,
      }).format(value)} ${unit}`;
}

function ReadOnlyList({ values }: { readonly values: readonly string[] }) {
  return values.length ? (
    <ul className="space-y-1 text-sm leading-5 text-slate-700">
      {values.map((value, index) => (
        <li className="flex gap-2" key={`${value}-${index}`}>
          <span aria-hidden="true" className="text-emerald-700">
            •
          </span>
          <span>{value}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-slate-500">Não informado</p>
  );
}

function ReferenceBlock({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
      <h3 className="mb-1.5 text-xs font-black uppercase tracking-wide text-slate-600">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function PreviousClinicalReferenceCard({
  reference,
}: {
  readonly reference: PreviousClinicalReference;
}) {
  return (
    <SectionCard
      collapsible
      defaultOpen={false}
      description="Resumo permanente anterior. Nenhum dado deste bloco pode ser editado aqui."
      title="Referência clínica anterior — somente leitura"
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <ReferenceBlock title="Última consulta">
          <p className="text-sm text-slate-700">
            {dateOrMissing(reference.lastConsultationAt)}
          </p>
        </ReferenceBlock>

        <ReferenceBlock title="Objetivo anterior">
          <ReadOnlyList values={reference.objectives} />
        </ReferenceBlock>

        <ReferenceBlock title="Diagnósticos e condições">
          <ReadOnlyList values={reference.diagnosesAndConditions} />
        </ReferenceBlock>

        <ReferenceBlock title="Medicamentos e suplementos">
          <ReadOnlyList values={reference.medicationsAndSupplements} />
        </ReferenceBlock>

        <ReferenceBlock title="Alergias e restrições">
          <ReadOnlyList values={reference.allergiesAndRestrictions} />
        </ReferenceBlock>

        <ReferenceBlock title="Observações clínicas anteriores">
          <ReadOnlyList values={reference.clinicalObservations} />
        </ReferenceBlock>

        <ReferenceBlock title="Resumo do último plano alimentar">
          <p className="mb-2 text-sm font-bold text-slate-700">
            {textOrMissing(reference.mealPlan.title)}
          </p>
          <ReadOnlyList values={reference.mealPlan.meals.slice(0, 4)} />
          {reference.mealPlan.meals.length > 4 ? (
            <p className="mt-1 text-xs text-slate-500">
              + {reference.mealPlan.meals.length - 4}{" "}
              {reference.mealPlan.meals.length - 4 === 1
                ? "refeição"
                : "refeições"}{" "}
              no plano anterior.
            </p>
          ) : null}
          {reference.mealPlan.prescribedAt ? (
            <p className="mt-2 text-xs text-slate-500">
              Prescrito em {dateOrMissing(reference.mealPlan.prescribedAt)}
            </p>
          ) : null}
        </ReferenceBlock>

        <ReferenceBlock title="Cálculo energético e metas anteriores">
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold text-slate-500">Método</dt>
              <dd className="text-slate-700">
                {textOrMissing(reference.energy.calculationMethod)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500">
                Taxa metabólica basal
              </dt>
              <dd className="text-slate-700">
                {numberOrMissing(
                  reference.energy.basalMetabolicRateKcal,
                  "kcal",
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500">
                Gasto energético total
              </dt>
              <dd className="text-slate-700">
                {numberOrMissing(
                  reference.energy.totalEnergyExpenditureKcal,
                  "kcal",
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500">
                Meta calórica
              </dt>
              <dd className="text-slate-700">
                {numberOrMissing(
                  reference.energy.targetCaloriesKcal,
                  "kcal",
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500">Proteínas</dt>
              <dd className="text-slate-700">
                {numberOrMissing(reference.energy.proteinGrams, "g")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500">
                Carboidratos
              </dt>
              <dd className="text-slate-700">
                {numberOrMissing(reference.energy.carbohydratesGrams, "g")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500">Gorduras</dt>
              <dd className="text-slate-700">
                {numberOrMissing(reference.energy.fatsGrams, "g")}
              </dd>
            </div>
          </dl>
        </ReferenceBlock>

        {reference.bodyAssessment.measurements.length ? (
          <ReferenceBlock title="Avaliação corporal anterior">
            <ReadOnlyList values={reference.bodyAssessment.measurements} />
            {reference.bodyAssessment.assessedAt ? (
              <p className="mt-2 text-xs text-slate-500">
                Avaliação de {dateOrMissing(reference.bodyAssessment.assessedAt)}
              </p>
            ) : null}
          </ReferenceBlock>
        ) : null}
      </div>
    </SectionCard>
  );
}
