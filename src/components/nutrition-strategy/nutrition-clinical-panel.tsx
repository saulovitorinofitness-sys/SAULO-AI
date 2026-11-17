import type { NutritionClinicalPanelView } from "@/features/nutrition-strategy/clinical-panel-contracts";

const NOT_INFORMED = "Não informado";

function textValue(value?: string) {
  return value?.trim() || NOT_INFORMED;
}

function numberValue(
  value: number | undefined,
  unit?: string,
  digits = 2,
) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return NOT_INFORMED;
  }
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function ClinicalValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-slate-100 py-3 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0">
      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm font-black ${
          value === NOT_INFORMED ? "text-slate-400" : "text-slate-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function DecisionList({
  items,
  title,
}: {
  items: readonly string[];
  title: string;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-xs font-black uppercase tracking-wide text-slate-600">
        {title}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li className="flex gap-2 text-xs leading-5 text-slate-700" key={item}>
            <span
              aria-hidden="true"
              className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-600"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InheritedList({
  items,
  title,
}: {
  items: readonly string[];
  title: string;
}) {
  return (
    <div>
      <h3 className="text-xs font-black uppercase tracking-wide text-slate-600">
        {title}
      </h3>
      {items.length ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((item, index) => (
            <li className="text-xs leading-5 text-slate-700" key={`${item}-${index}`}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs font-semibold text-slate-400">
          {NOT_INFORMED}
        </p>
      )}
    </div>
  );
}

export function NutritionClinicalPanel({
  activityFactor,
  view,
}: {
  activityFactor?: number;
  view: NutritionClinicalPanelView;
}) {
  const resolvedActivityFactor =
    activityFactor ?? view.energyDecision?.activityFactor;

  return (
    <section
      aria-labelledby="nutrition-clinical-context"
      className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-[0_10px_30px_rgb(15_23_42/0.04)]"
    >
      <header className="flex flex-col gap-3 bg-[#103f32] px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-200">
            Contexto clínico do paciente
          </p>
          <h2
            className="mt-1 text-xl font-black tracking-tight"
            id="nutrition-clinical-context"
          >
            {view.patient.name}
          </h2>
          <p className="mt-1 text-sm font-semibold text-emerald-100">
            {view.patient.code} · {view.patient.age !== undefined
              ? `${view.patient.age} anos`
              : NOT_INFORMED} · {view.patient.sex}
          </p>
        </div>
        <div className="max-w-xl text-sm sm:text-right">
          <p className="font-black">
            {textValue(view.patient.primaryObjective)}
          </p>
          <p className="mt-1 text-xs text-emerald-100">
            Profissional responsável: {textValue(view.responsibleProfessional)}
          </p>
        </div>
      </header>

      <div className="px-5">
        <dl className="grid border-b border-slate-200 sm:grid-cols-3 lg:grid-cols-6">
          <ClinicalValue
            label="Peso"
            value={numberValue(view.nutritionalStatus.weightKg, "kg")}
          />
          <ClinicalValue
            label="Altura"
            value={numberValue(view.nutritionalStatus.heightM, "m")}
          />
          <ClinicalValue
            label="IMC"
            value={numberValue(view.nutritionalStatus.bmi, "kg/m²")}
          />
          <ClinicalValue
            label="Gordura corporal"
            value={numberValue(view.bodyComposition.bodyFatPercent, "%")}
          />
          <ClinicalValue
            label="Massa muscular"
            value={numberValue(view.bodyComposition.muscleMassKg, "kg")}
          />
          <ClinicalValue
            label="Fator de atividade"
            value={numberValue(resolvedActivityFactor, undefined, 3)}
          />
        </dl>

        <div className="grid gap-4 border-b border-slate-200 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <InheritedList
            items={view.inheritedClinicalContext.diagnoses}
            title="Diagnósticos e patologias"
          />
          <InheritedList
            items={view.inheritedClinicalContext.allergies}
            title="Alergias"
          />
          <InheritedList
            items={view.inheritedClinicalContext.restrictions}
            title="Restrições e intolerâncias"
          />
          <InheritedList
            items={view.inheritedClinicalContext.foodPreferences}
            title="Preferências e aversões"
          />
          <InheritedList
            items={view.inheritedClinicalContext.medications}
            title="Medicamentos"
          />
          <InheritedList
            items={view.inheritedClinicalContext.supplements}
            title="Suplementos registrados"
          />
          <InheritedList
            items={view.inheritedClinicalContext.injuriesAndLimitations}
            title="Lesões e limitações"
          />
          <InheritedList
            items={view.inheritedClinicalContext.laboratoryExams}
            title="Exames laboratoriais reais"
          />
        </div>

        {view.decisionSupport.positivePoints.length ||
        view.decisionSupport.attentionPoints.length ||
        view.decisionSupport.pendingData.length ? (
          <div className="grid gap-4 py-4 md:grid-cols-3">
            <DecisionList
              items={view.decisionSupport.positivePoints}
              title="Pontos relevantes"
            />
            <DecisionList
              items={view.decisionSupport.attentionPoints}
              title="Pontos de atenção"
            />
            <DecisionList
              items={view.decisionSupport.pendingData}
              title="Dados pendentes"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
