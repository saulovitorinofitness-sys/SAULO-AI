import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Droplets,
  Sparkles,
  UserRound,
} from "lucide-react";

import type { NutritionClinicalPanelView } from "@/features/nutrition-strategy/clinical-panel-contracts";

const NOT_INFORMED = "NÃO INFORMADO";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

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

function Metric({
  label,
  value,
  featured = false,
}: {
  label: string;
  value: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        featured
          ? "border-emerald-200 bg-emerald-50/70"
          : "border-slate-200 bg-slate-50/70"
      }`}
    >
      <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
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

function SupportCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: readonly string[];
  tone: "positive" | "attention" | "pending";
}) {
  const style = {
    positive: {
      shell: "border-emerald-200 bg-emerald-50/60",
      icon: "bg-emerald-100 text-emerald-700",
      Icon: CheckCircle2,
      empty: "Nenhum ponto positivo registrado.",
    },
    attention: {
      shell: "border-amber-200 bg-amber-50/60",
      icon: "bg-amber-100 text-amber-700",
      Icon: AlertTriangle,
      empty: "Nenhum ponto de atenção registrado.",
    },
    pending: {
      shell: "border-sky-200 bg-sky-50/60",
      icon: "bg-sky-100 text-sky-700",
      Icon: CircleHelp,
      empty: "Nenhum dado pendente.",
    },
  }[tone];
  const Icon = style.Icon;

  return (
    <article className={`rounded-2xl border p-4 ${style.shell}`}>
      <div className="flex items-center gap-3">
        <span className={`grid size-9 place-items-center rounded-xl ${style.icon}`}>
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
      </div>
      {items.length ? (
        <ul className="mt-3 space-y-1.5">
          {items.map((item) => (
            <li className="flex gap-2 text-xs leading-5 text-slate-700" key={item}>
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-full bg-current opacity-40"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs font-semibold text-slate-500">{style.empty}</p>
      )}
    </article>
  );
}

export function NutritionClinicalPanel({
  view,
}: {
  view: NutritionClinicalPanelView;
}) {
  const evaluationDate = view.patient.evaluationDate
    ? new Intl.DateTimeFormat("pt-BR").format(
        new Date(view.patient.evaluationDate),
      )
    : NOT_INFORMED;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[1.4rem] border border-emerald-900/10 bg-gradient-to-br from-[#103f32] via-[#125643] to-[#14755b] text-white shadow-[0_18px_45px_rgb(16_63_50/0.16)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[auto_minmax(0,1fr)_minmax(17rem,0.7fr)] lg:items-center lg:p-6">
          <div>
            <div className="grid size-20 place-items-center rounded-2xl border border-white/20 bg-white/10 text-2xl font-black">
              {initials(view.patient.name)}
            </div>
            <span className="mt-1.5 block text-center text-[9px] font-bold uppercase tracking-wide text-emerald-200">
              Foto não informada
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-100">
                Paciente
              </span>
              <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-black">
                {view.patient.code}
              </span>
            </div>
            <h2 className="mt-3 break-words text-2xl font-black tracking-tight sm:text-3xl">
              {view.patient.name}
            </h2>
            <p className="mt-1 text-sm font-semibold text-emerald-100">
              {view.patient.age} anos · {view.patient.sex}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/10 p-4">
            <div>
              <dt className="text-[9px] font-black uppercase text-emerald-200">
                Avaliação
              </dt>
              <dd className="mt-1 text-sm font-black">
                {view.patient.evaluationNumber
                  ? `Nº ${view.patient.evaluationNumber}`
                  : NOT_INFORMED}
              </dd>
            </div>
            <div>
              <dt className="text-[9px] font-black uppercase text-emerald-200">
                Data
              </dt>
              <dd className="mt-1 text-sm font-black">{evaluationDate}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[9px] font-black uppercase text-emerald-200">
                Profissão
              </dt>
              <dd className="mt-1 text-sm font-black">
                {textValue(view.patient.profession)}
              </dd>
            </div>
          </dl>
        </div>
        <dl className="grid gap-4 border-t border-white/10 bg-black/10 px-5 py-4 sm:grid-cols-2 lg:px-6">
          <div>
            <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200">
              Objetivo principal
            </dt>
            <dd className="mt-1 text-sm font-bold">
              {textValue(view.patient.primaryObjective)}
            </dd>
          </div>
          <div>
            <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200">
              Objetivos secundários
            </dt>
            <dd className="mt-1 text-sm font-bold">
              {view.patient.secondaryObjectives.join(" · ") || NOT_INFORMED}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgb(15_23_42/0.04)]">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <Activity aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                Área 2
              </p>
              <h2 className="text-lg font-black text-slate-900">
                Estado nutricional
              </h2>
            </div>
          </div>
          <dl className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <Metric featured label="Peso" value={numberValue(view.nutritionalStatus.weightKg, "kg")} />
            <Metric featured label="Altura" value={numberValue(view.nutritionalStatus.heightM, "m")} />
            <Metric featured label="IMC" value={numberValue(view.nutritionalStatus.bmi, "kg/m²")} />
            <Metric label="Classificação IMC" value={view.nutritionalStatus.bmiClassification?.toUpperCase() ?? NOT_INFORMED} />
            <Metric label="RCQ" value={numberValue(view.nutritionalStatus.waistHipRatio)} />
            <Metric label="Circunferência abdominal" value={numberValue(view.nutritionalStatus.abdomenCm, "cm")} />
          </dl>
          <div className="my-5 h-px bg-slate-100" />
          <div className="flex items-center gap-2">
            <Droplets aria-hidden="true" className="size-4 text-sky-600" />
            <h3 className="text-xs font-black uppercase tracking-[0.13em] text-slate-700">
              Composição corporal
            </h3>
          </div>
          <dl className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Massa muscular" value={numberValue(view.bodyComposition.muscleMassKg, "kg")} />
            <Metric label="Massa gorda" value={numberValue(view.bodyComposition.fatMassKg, "kg")} />
            <Metric label="Percentual de gordura" value={numberValue(view.bodyComposition.bodyFatPercent, "%")} />
            <Metric label="Água corporal" value={numberValue(view.bodyComposition.bodyWaterL, "L")} />
            <Metric label="TMB" value={numberValue(view.bodyComposition.basalMetabolicRateKcal, "kcal/dia", 0)} />
            <Metric label="GET" value={numberValue(view.bodyComposition.totalEnergyExpenditureKcal, "kcal/dia", 0)} />
          </dl>
        </section>

        <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgb(15_23_42/0.04)]">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-700">
              <Sparkles aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">
                Área 3
              </p>
              <h2 className="text-lg font-black text-slate-900">Apoio à decisão</h2>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Síntese de registros existentes. Nenhuma IA ou sugestão clínica foi aplicada.
          </p>
          <div className="mt-4 grid gap-3">
            <SupportCard items={view.decisionSupport.positivePoints} title="Pontos Positivos" tone="positive" />
            <SupportCard items={view.decisionSupport.attentionPoints} title="Pontos de Atenção" tone="attention" />
            <SupportCard items={view.decisionSupport.pendingData} title="Dados Pendentes" tone="pending" />
          </div>
        </section>
      </div>

      <p className="flex items-center justify-center gap-2 text-center text-[11px] font-semibold text-slate-400">
        <UserRound aria-hidden="true" className="size-3.5" />
        Dados vinculados ao mesmo paciente e ao mesmo Prontuário Mestre.
      </p>
    </div>
  );
}
