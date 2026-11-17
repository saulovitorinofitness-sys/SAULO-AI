"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  NumberInput,
  Select,
  Textarea,
} from "@/components/ui";
import { developmentUserRequestHeaders } from "@/features/development-session";
import type { ProfessionalFood } from "@/features/food-database/contracts";
import { nutritionClinicalFlowHref } from "@/features/nutrition-clinical-flow";
import {
  NUTRITION_OBJECTIVES,
  nutritionStrategyDecisionService,
  nutritionEnergyMissingData,
  resolveInitialNutritionObjective,
  type CalorieAdjustmentPercentage,
  type NutritionDecisionObjective,
} from "@/features/nutrition-strategy/decision-engine";
import {
  CLINICAL_PROTOCOL_OPTIONS,
  ENERGY_GOAL_OPTIONS,
  FASTING_PROTOCOL_OPTIONS,
  NUTRITION_METHOD_OPTIONS,
  NUTRITION_MODIFICATION_OPTIONS,
  SPORTS_OBJECTIVE_OPTIONS,
  SPORTS_PHASE_OPTIONS,
  carbohydrateDayType,
  defaultAdjustmentForEnergyGoal,
  energyGoalFromLegacyValues,
  fastingProtocolDurations,
  sportsDayConfiguration,
  specificConfigurationIssues,
  timeAfterHours,
  type CarbohydrateDayType,
  type FastingProtocol,
  type ClinicalNutritionProtocol,
  type NutritionEnergyGoal,
  type NutritionMethod,
  type NutritionModification,
  type NutritionSpecificConfigurations,
  type NutritionWeekday,
  type SportsDayConfiguration,
  type SportsDayType,
  type SportsNutritionTarget,
} from "@/features/nutrition-strategy/prescription";
import {
  compareHabitualIntakeWithGet,
  type HabitualIntakeEstimate,
  type NutritionEvolutionGoal,
  type PatternEnergySuggestion,
  type QuantifiedRecallItem,
  type VetDecisionState,
} from "@/features/nutrition-strategy/habitual-intake-engine";
import {
  canApproveNutritionStrategy,
  nutritionStrategyApprovalIssues,
  resolveMacronutrientDraftInput,
  type MacronutrientDraftInput,
  type NutritionStrategyDraft,
  type NutritionStrategyMealAllocation,
  type NutritionStrategyRecordView,
  type NutritionStrategySupplement,
} from "@/features/nutrition-strategy/strategy-record";
import { presentMealSchedules } from "@/features/nutrition-strategy/meal-schedule";
import { parseNutritionStrategyDraft } from "@/features/nutrition-strategy/strategy-validation";
import type { NutritionClinicalPanelView } from "@/features/nutrition-strategy/clinical-panel-contracts";
import {
  ACTIVITY_LEVEL_FACTORS,
  ENERGY_PROTOCOLS,
  calculateMacronutrient,
  validateMacroDistribution,
  type EnergyProtocol,
  type MacronutrientCalculation,
} from "@/lib/nutrition";

const NOT_INFORMED = "Não informado";
const energyProtocols = Object.keys(ENERGY_PROTOCOLS) as EnergyProtocol[];
const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});
const macroStatusLabels = {
  ADEQUATE: "Adequado",
  NEAR_TARGET: "Próximo da meta",
  OUTSIDE_TARGET: "Fora da meta",
} as const;
const activityFactorLabels: Readonly<Record<number, string>> = {
  1.2: "Sedentário · 1,20",
  1.375: "Levemente ativo · 1,375",
  1.55: "Moderadamente ativo · 1,55",
  1.725: "Muito ativo · 1,725",
  1.9: "Extremamente ativo · 1,90",
};
const activityFactors: readonly number[] = Object.values(
  ACTIVITY_LEVEL_FACTORS,
) as number[];
const weekdayOptions: readonly [NutritionWeekday, string][] = [
  ["MON", "Seg"], ["TUE", "Ter"], ["WED", "Qua"], ["THU", "Qui"],
  ["FRI", "Sex"], ["SAT", "Sáb"], ["SUN", "Dom"],
];
const exclusiveModificationGroups: readonly (readonly NutritionModification[])[] = [
  ["HIGH_PROTEIN", "NORMAL_PROTEIN", "LOW_PROTEIN"],
  ["HIGH_FIBER", "LOW_FIBER"],
  ["LACTOSE_RESTRICTION", "LACTOSE_FREE"],
];
const strategyAreas = [
  { id: "CLINICAL_SUMMARY", label: "Resumo Clínico" },
  { id: "ENERGY", label: "Gasto Energético" },
  { id: "RECALL", label: "Recordatório" },
  { id: "GOALS", label: "Metas" },
  { id: "PRESCRIPTION", label: "Prescrição" },
] as const;
type StrategyArea = (typeof strategyAreas)[number]["id"];
type AutoSaveState = "IDLE" | "PENDING" | "SAVING" | "SAVED" | "ERROR";

export interface AnamnesisRecallSummary {
  readonly performed: boolean;
  readonly confidence: "HIGH" | "LOW" | "NOT_ESTIMATED";
  readonly totals?: {
    readonly energyKcal?: number | null;
    readonly proteinGrams?: number | null;
    readonly carbohydratesGrams?: number | null;
    readonly fatsGrams?: number | null;
    readonly fiberGrams?: number | null;
  };
  readonly reviewHref: string;
}

interface LocalStrategyDraft {
  readonly draft: NutritionStrategyDraft;
  readonly savedAt: string;
}

function localStrategyDraftKey(patientId: string, attendanceId: string) {
  return `saulo-ai:nutrition-strategy-draft:v1:${encodeURIComponent(patientId)}:${encodeURIComponent(attendanceId)}`;
}

function readLocalStrategyDraft(key: string): LocalStrategyDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw || raw.length > 1_000_000) return null;
    const candidate: unknown = JSON.parse(raw);
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return null;
    }
    const source = candidate as Record<string, unknown>;
    const draft = parseNutritionStrategyDraft(source.draft);
    return draft && typeof source.savedAt === "string"
      ? { draft, savedAt: source.savedAt }
      : null;
  } catch {
    return null;
  }
}

function storeLocalStrategyDraft(key: string, draft: NutritionStrategyDraft) {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ draft, savedAt: new Date().toISOString() }),
    );
  } catch {
    // O autosave do servidor continua funcional sem armazenamento local.
  }
}

function removeLocalStrategyDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nada a descartar quando o armazenamento local está indisponível.
  }
}

function hydrationCoefficient(ageYears: number | undefined) {
  if (ageYears === undefined) return undefined;
  if (ageYears > 65) return 25;
  if (ageYears > 55) return 30;
  return 35;
}

function positive(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function formatted(value: number | undefined, digits = 1) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: digits,
      }).format(value)
    : NOT_INFORMED;
}

function formattedPercentage(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formattedSigned(value: number | undefined) {
  return value !== undefined && Number.isFinite(value)
    ? `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`
    : NOT_INFORMED;
}

function energyValue(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? `${numberFormatter.format(value)} kcal/dia`
    : NOT_INFORMED;
}

function macroSummary(value: MacronutrientCalculation | undefined) {
  return value
    ? `${formatted(value.grams)} g · ${formatted(value.gramsPerKg, 2)} g/kg · ${formatted(value.percentage)}%`
    : NOT_INFORMED;
}

function adjustmentLabel(value: number) {
  if (value === 0) return "0% · Manutenção energética";
  return `${value > 0 ? "+" : ""}${value}%`;
}

function equalMealDistribution(mealCount: number | undefined) {
  if (!mealCount || mealCount < 1) return [];
  const base = Math.floor((100 / mealCount) * 100) / 100;

  return Array.from({ length: mealCount }, (_, index) => {
    const percentage =
      index === mealCount - 1
        ? Number((100 - base * (mealCount - 1)).toFixed(2))
        : base;
    return {
      mealNumber: index + 1,
      name: "",
      time: "",
      vetPercentage: percentage,
      plannedCaloriesKcal: undefined,
    };
  });
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0">
      <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </dt>
      <dd className={`mt-1 text-sm font-black leading-5 ${value === NOT_INFORMED ? "text-slate-400" : "text-slate-900"}`}>
        {value}
      </dd>
    </div>
  );
}

function MacroEditor({
  calculated,
  disabled,
  error,
  input,
  label,
  onChange,
}: {
  calculated: MacronutrientCalculation | undefined;
  disabled: boolean;
  error?: string;
  input: MacronutrientDraftInput;
  label: string;
  onChange: (value: MacronutrientDraftInput) => void;
}) {
  return (
    <div className="grid gap-2 border-b border-slate-100 py-3 last:border-b-0 lg:grid-cols-[minmax(7rem,0.8fr)_minmax(9rem,1fr)_minmax(7rem,0.8fr)_minmax(8rem,0.9fr)_minmax(7rem,0.8fr)] lg:items-center lg:gap-3 lg:px-2">
      <h3 className="text-sm font-black text-[var(--text-primary)]">{label}</h3>
      <div>
        <label className="mb-1 block text-xs font-bold text-slate-500 lg:sr-only" htmlFor={`macro-${label}-mode`}>Modo</label>
        <Select
          disabled={disabled}
          id={`macro-${label}-mode`}
          onChange={(event) => {
            const mode = event.target.value as
              | "GRAMS_PER_KG"
              | "PERCENTAGE"
              | "GRAMS";
            onChange({
              mode,
              value:
                mode === "GRAMS_PER_KG"
                  ? calculated?.gramsPerKg
                  : mode === "GRAMS"
                    ? calculated?.grams
                    : calculated?.percentage,
            });
          }}
          value={input.mode}
        >
          <option value="PERCENTAGE">Percentual (%)</option>
          <option value="GRAMS_PER_KG">g/kg</option>
          <option value="GRAMS">Gramas por dia</option>
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-slate-500 lg:sr-only" htmlFor={`macro-${label}-value`}>Meta ({input.mode === "GRAMS_PER_KG" ? "g/kg" : input.mode === "GRAMS" ? "g/dia" : "%"})</label>
        <NumberInput
          aria-invalid={Boolean(error)}
          disabled={disabled}
          id={`macro-${label}-value`}
          min={0}
          onChange={(event) =>
            onChange({
              mode: input.mode,
              value: positive(event.target.value),
            })
          }
          step={input.mode === "GRAMS_PER_KG" ? "0.01" : "0.1"}
          value={input.value ?? ""}
        />
        {error ? <p className="mt-1 text-xs font-bold text-red-700" role="alert">{error}</p> : null}
      </div>
      <div><span className="mb-1 block text-xs font-bold text-slate-500 lg:sr-only">Gramas calculadas</span><output aria-live="polite" className="block min-h-11 whitespace-nowrap rounded-lg bg-[var(--surface)] px-3 py-3 text-sm font-black text-[var(--text-primary)]">{calculated ? `${formatted(calculated.grams)} g` : NOT_INFORMED}</output></div>
      <div><span className="mb-1 block text-xs font-bold text-slate-500 lg:sr-only">kcal calculadas</span><output className="block min-h-11 whitespace-nowrap rounded-lg bg-[var(--surface)] px-3 py-3 text-sm font-black text-[var(--text-primary)]">{calculated ? `${formatted(calculated.kcal)} kcal` : NOT_INFORMED}</output></div>
    </div>
  );
}

function WeekdaySelector({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: readonly NutritionWeekday[]) => void;
  value: readonly NutritionWeekday[];
}) {
  return (
    <fieldset className="rounded-xl border border-slate-200 p-3">
      <legend className="px-1 text-xs font-black text-slate-700">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {weekdayOptions.map(([code, dayLabel]) => (
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold" key={code}>
            <input
              checked={value.includes(code)}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, code]
                    : value.filter((item) => item !== code),
                )
              }
              type="checkbox"
            />
            {dayLabel}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function inferredFastingProtocol(configuration: NutritionSpecificConfigurations["fasting"]): FastingProtocol | undefined {
  if (configuration?.protocol) return configuration.protocol;
  const matching = FASTING_PROTOCOL_OPTIONS.find(([, , eating, fasting]) =>
    eating === configuration?.eatingWindowHours && fasting === configuration?.fastingWindowHours,
  );
  return matching?.[0] ?? (configuration?.eatingWindowHours || configuration?.fastingWindowHours ? "CUSTOM" : undefined);
}

function cyclingTargetLabel(type: CarbohydrateDayType) {
  return type === "LOW" ? "Baixo" : type === "MODERATE" ? "Moderado" : "Alto";
}

function SportsNutritionTargetEditor({
  baseEnergy,
  baseMacros,
  disabled,
  label,
  onChange,
  target,
  weightKg,
}: {
  baseEnergy: number | undefined;
  baseMacros: { protein: MacronutrientDraftInput; carbohydrates: MacronutrientDraftInput; fats: MacronutrientDraftInput };
  disabled: boolean;
  label: string;
  onChange: (target: SportsNutritionTarget) => void;
  target: SportsNutritionTarget;
  weightKg: number | undefined;
}) {
  const energy = target.energyKcal ?? baseEnergy;
  const macroRows = [
    ["protein", "Proteínas"], ["carbohydrates", "Carboidratos"], ["fats", "Lipídios"],
  ] as const;
  const resolvedMacros = macroRows.map(([key, macroLabel]) => {
    const input = target[key] ?? baseMacros[key];
    const calculated = input.value && energy
      ? calculateMacronutrient(key, input.mode, input.value, energy, weightKg)
      : undefined;
    return { key, macroLabel, input, calculated };
  });
  const percentageMacros = resolvedMacros.filter(({ input }) => input.mode === "PERCENTAGE" && input.value !== undefined);
  const percentageTotal = percentageMacros.reduce((total, { input }) => total + (input.value ?? 0), 0);
  const completePercentageDistribution = percentageMacros.length === resolvedMacros.length && Math.abs(percentageTotal - 100) < 0.01;
  const allMacrosCalculated = resolvedMacros.every(({ calculated }) => calculated !== undefined);
  const calculatedCalories = allMacrosCalculated
    ? resolvedMacros.reduce((total, { calculated }) => total + (calculated?.kcal ?? 0), 0)
    : undefined;
  const calorieDifference = calculatedCalories !== undefined && energy !== undefined
    ? calculatedCalories - energy
    : undefined;
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-black">Metas para {label}</summary>
      <p className="mt-2 text-xs text-slate-500">Campos não personalizados herdam as metas gerais já definidas nesta tela.</p>
      <div className="mt-3 max-w-xs">
        <FormField id={`sports-energy-${label}`} label="Energia (kcal/dia)">
          <NumberInput disabled={disabled} id={`sports-energy-${label}`} min={1} onChange={(event) => onChange({ ...target, energyKcal: positive(event.target.value) })} placeholder={baseEnergy ? `Meta geral: ${formatted(baseEnergy)} kcal` : undefined} value={target.energyKcal ?? ""} />
        </FormField>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="hidden min-w-[46rem] grid-cols-[minmax(7rem,0.8fr)_minmax(9rem,1fr)_minmax(7rem,0.8fr)_minmax(8rem,0.9fr)_minmax(7rem,0.8fr)] gap-3 border-b border-slate-200 px-2 pb-2 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500 lg:grid">
          <span>Nutriente</span><span>Modo</span><span>Meta</span><span>Gramas calculadas</span><span>kcal calculadas</span>
        </div>
        <div className="min-w-0 lg:min-w-[46rem]">
          {resolvedMacros.map(({ key, macroLabel, input, calculated }) => (
            <div className="grid gap-2 border-b border-slate-100 py-3 last:border-b-0 lg:grid-cols-[minmax(7rem,0.8fr)_minmax(9rem,1fr)_minmax(7rem,0.8fr)_minmax(8rem,0.9fr)_minmax(7rem,0.8fr)] lg:items-center lg:gap-3 lg:px-2" key={key}>
              <p className="text-sm font-black text-slate-900">{macroLabel}</p>
              <div><label className="mb-1 block text-xs font-bold text-slate-500 lg:sr-only" htmlFor={`sports-${label}-${key}-mode`}>Modo</label><Select disabled={disabled} id={`sports-${label}-${key}-mode`} onChange={(event) => {
                const mode = event.target.value as MacronutrientDraftInput["mode"];
                onChange({ ...target, [key]: { mode, value: mode === "GRAMS_PER_KG" ? calculated?.gramsPerKg : mode === "GRAMS" ? calculated?.grams : calculated?.percentage } });
              }} value={input.mode}><option value="PERCENTAGE">Percentual (%)</option><option value="GRAMS_PER_KG">g/kg</option><option value="GRAMS">Gramas por dia</option></Select></div>
              <div><label className="mb-1 block text-xs font-bold text-slate-500 lg:sr-only" htmlFor={`sports-${label}-${key}-value`}>Meta</label><NumberInput disabled={disabled} id={`sports-${label}-${key}-value`} min={0} onChange={(event) => onChange({ ...target, [key]: { mode: input.mode, value: positive(event.target.value) } })} step={input.mode === "GRAMS_PER_KG" ? "0.01" : "0.1"} value={input.value ?? ""} /></div>
              <div><span className="mb-1 block text-xs font-bold text-slate-500 lg:sr-only">Gramas calculadas</span><output className="block min-h-11 whitespace-nowrap rounded-lg bg-slate-50 px-3 py-3 text-sm font-black text-slate-900">{calculated ? `${formatted(calculated.grams)} g` : NOT_INFORMED}</output></div>
              <div><span className="mb-1 block text-xs font-bold text-slate-500 lg:sr-only">kcal calculadas</span><output className="block min-h-11 whitespace-nowrap rounded-lg bg-slate-50 px-3 py-3 text-sm font-black text-slate-900">{calculated ? `${formatted(calculated.kcal)} kcal` : NOT_INFORMED}</output></div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-live="polite">
        {percentageMacros.length ? <div className={`rounded-lg px-3 py-2 text-xs font-bold ${completePercentageDistribution ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          <p>Soma dos percentuais: {formattedPercentage(percentageTotal)}%</p>
          <p className="mt-1">{completePercentageDistribution ? "Distribuição completa: 100%" : percentageMacros.length === resolvedMacros.length ? `Atenção: a distribuição difere de 100% em ${formattedPercentage(Math.abs(100 - percentageTotal))} ponto(s) percentual(is).` : "Conferência parcial: há macronutrientes configurados em outro modo."}</p>
        </div> : null}
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
          <p>Total calórico calculado: {calculatedCalories !== undefined ? `${formatted(calculatedCalories)} kcal` : NOT_INFORMED}</p>
          <p className="mt-1">Energia informada: {energy ? `${formatted(energy)} kcal` : NOT_INFORMED}{calorieDifference !== undefined ? ` · Diferença: ${calorieDifference > 0 ? "+" : ""}${formattedPercentage(calorieDifference)} kcal` : ""}</p>
        </div>
      </div>
    </details>
  );
}

function ClinicalProtocolCombobox({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: readonly ClinicalNutritionProtocol[]) => void;
  value: readonly ClinicalNutritionProtocol[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 320, maxHeight: 280 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = "clinical-protocol-listbox";

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .trim();
    if (!normalizedQuery) return CLINICAL_PROTOCOL_OPTIONS;
    return CLINICAL_PROTOCOL_OPTIONS.filter(([, label]) =>
      label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 24);
      setPosition({
        left: Math.min(Math.max(12, rect.left), window.innerWidth - width - 12),
        top: rect.bottom + 8,
        width,
        maxHeight: Math.min(280, Math.max(120, window.innerHeight - rect.bottom - 20)),
      });
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    updatePosition();
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const toggle = (code: ClinicalNutritionProtocol) => {
    onChange(
      value.includes(code)
        ? value.filter((item) => item !== code)
        : [...value, code],
    );
  };

  return (
    <div className="space-y-2">
      <button
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-left text-sm outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 disabled:cursor-not-allowed disabled:bg-slate-100"
        disabled={disabled}
        id="clinical-protocol"
        onClick={() => {
          setQuery("");
          setActiveIndex(0);
          setOpen((current) => !current);
        }}
        ref={triggerRef}
        type="button"
      >
        <span className={value.length ? "font-bold text-slate-900" : "text-slate-500"}>
          {value.length
            ? `${value.length} protocolo${value.length === 1 ? " selecionado" : "s selecionados"}`
            : "Nenhum protocolo selecionado"}
        </span>
        <span aria-hidden="true" className="text-slate-500">&#9662;</span>
      </button>

      {value.length ? (
        <div aria-label="Protocolos clínicos selecionados" className="flex flex-wrap gap-2">
          {value.map((code) => {
            const label = CLINICAL_PROTOCOL_OPTIONS.find(([item]) => item === code)?.[1] ?? code;
            return (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800" key={code}>
                {label}
                {!disabled ? (
                  <button
                    aria-label={`Remover ${label}`}
                    className="rounded-full px-1 text-base leading-none hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                    onClick={() => toggle(code)}
                    type="button"
                  >
                    ×
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>
      ) : null}

      {typeof document !== "undefined" && open
        ? createPortal(
            <div
              className="fixed z-[1000] rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
              ref={panelRef}
              style={{ left: position.left, top: position.top, width: position.width }}
            >
              <label className="sr-only" htmlFor="clinical-protocol-search">Buscar protocolo clínico</label>
              <input
                aria-controls={listboxId}
                aria-expanded={open}
                aria-label="Buscar protocolo clínico"
                className="mb-2 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
                id="clinical-protocol-search"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    const direction = event.key === "ArrowDown" ? 1 : -1;
                    setActiveIndex((current) =>
                      filteredOptions.length
                        ? (current + direction + filteredOptions.length) % filteredOptions.length
                        : 0,
                    );
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    setActiveIndex(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    setActiveIndex(Math.max(filteredOptions.length - 1, 0));
                  } else if (event.key === "Enter" && filteredOptions[activeIndex]) {
                    event.preventDefault();
                    toggle(filteredOptions[activeIndex][0]);
                  }
                }}
                placeholder="Buscar condição…"
                ref={searchRef}
                role="combobox"
                value={query}
              />
              <div
                aria-label="Protocolos clínicos disponíveis"
                aria-multiselectable="true"
                className="overflow-y-auto overscroll-contain"
                id={listboxId}
                role="listbox"
                style={{ maxHeight: position.maxHeight }}
              >
                {filteredOptions.length ? filteredOptions.map(([code, label, description], index) => {
                  const selected = value.includes(code);
                  return (
                    <button
                      aria-selected={selected}
                      className={`block w-full rounded-lg px-3 py-2 text-left ${index === activeIndex ? "bg-slate-100" : "hover:bg-slate-50"}`}
                      key={code}
                      onClick={() => toggle(code)}
                      onMouseEnter={() => setActiveIndex(index)}
                      role="option"
                      type="button"
                    >
                      <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <span aria-hidden="true" className={`flex size-4 items-center justify-center rounded border ${selected ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-slate-300"}`}>
                          {selected ? "✓" : ""}
                        </span>
                        {label}
                      </span>
                      <span className="mt-0.5 block pl-6 text-xs text-slate-500">{description}</span>
                    </button>
                  );
                }) : (
                  <p className="px-3 py-6 text-center text-sm text-slate-500">Nenhuma condição encontrada.</p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function NutritionStrategyDecisionEngine({
  anamnesisRecall,
  clinicalSummary,
  view,
  initialStrategy,
  scheduleCorrection = false,
}: {
  anamnesisRecall: AnamnesisRecallSummary;
  clinicalSummary: ReactNode;
  view: NutritionClinicalPanelView;
  initialStrategy: NutritionStrategyRecordView | null;
  scheduleCorrection?: boolean;
}) {
  const router = useRouter();
  const [activeArea, setActiveArea] = useState<StrategyArea>(
    scheduleCorrection ? "PRESCRIPTION" : "CLINICAL_SUMMARY",
  );
  const [record, setRecord] = useState(initialStrategy);
  const [objective, setObjective] = useState<NutritionDecisionObjective | undefined>(
    resolveInitialNutritionObjective(
      initialStrategy?.objective,
      view.patient.primaryObjective,
    ),
  );
  const [method, setMethod] = useState<
    NutritionMethod | undefined
  >(initialStrategy?.method);
  const [modifications, setModifications] = useState<readonly NutritionModification[]>(
    initialStrategy?.modifications ?? [],
  );
  const [modificationConflictMessage, setModificationConflictMessage] = useState("");
  const [clinicalProtocols, setClinicalProtocols] = useState<readonly ClinicalNutritionProtocol[]>(
    initialStrategy?.clinicalProtocols ??
      (initialStrategy?.clinicalProtocol ? [initialStrategy.clinicalProtocol] : []),
  );
  const [specificConfigurations, setSpecificConfigurations] = useState<NutritionSpecificConfigurations>(
    initialStrategy?.specificConfigurations ?? {},
  );
  const [energyGoal, setEnergyGoal] = useState<NutritionEnergyGoal | undefined>(
    initialStrategy?.energyGoal ??
      energyGoalFromLegacyValues(
        initialStrategy?.calorieAdjustmentPercentage,
        initialStrategy?.manualFinalCaloriesKcal,
      ),
  );
  const [protocol, setProtocol] = useState<EnergyProtocol | undefined>(
    initialStrategy?.protocol,
  );
  const [adjustment, setAdjustment] = useState<
    CalorieAdjustmentPercentage | undefined
  >(
    initialStrategy?.calorieAdjustmentPercentage,
  );
  const [activityFactor, setActivityFactor] = useState<number | undefined>(
    initialStrategy?.activityFactor ?? view.energyDecision?.activityFactor,
  );
  const [manualCalories, setManualCalories] = useState<number | undefined>(
    initialStrategy?.manualFinalCaloriesKcal,
  );
  const [protein, setProtein] = useState<MacronutrientDraftInput>(
    initialStrategy
      ? resolveMacronutrientDraftInput(
          initialStrategy.protein,
          initialStrategy.calculatedMacros.protein,
          "PERCENTAGE",
        )
      : { mode: "PERCENTAGE" },
  );
  const [fats, setFats] = useState<MacronutrientDraftInput>(
    initialStrategy
      ? resolveMacronutrientDraftInput(
          initialStrategy.fats,
          initialStrategy.calculatedMacros.fats,
          "PERCENTAGE",
        )
      : { mode: "PERCENTAGE" },
  );
  const [carbohydrates, setCarbohydrates] = useState<MacronutrientDraftInput>(
    initialStrategy
      ? resolveMacronutrientDraftInput(
          initialStrategy.carbohydrates,
          initialStrategy.calculatedMacros.carbohydrates,
          "PERCENTAGE",
        )
      : { mode: "PERCENTAGE" },
  );
  const [mealCount, setMealCount] = useState<number | undefined>(
    initialStrategy?.mealCount,
  );
  const [mealDistribution, setMealDistribution] = useState(
    initialStrategy?.mealDistribution.length
      ? initialStrategy.mealDistribution.map((meal) => ({ ...meal }))
      : equalMealDistribution(initialStrategy?.mealCount),
  );
  const [fiberGrams, setFiberGrams] = useState<number | undefined>(
    initialStrategy?.fiberGrams,
  );
  const [waterMl, setWaterMl] = useState<number | undefined>(
    initialStrategy?.waterMl,
  );
  const [supplementation, setSupplementation] = useState<
    readonly NutritionStrategySupplement[]
  >(initialStrategy?.supplementation ?? []);
  const [clinicalObservations, setClinicalObservations] = useState(
    initialStrategy?.clinicalObservations ?? "",
  );
  const [recallItems, setRecallItems] = useState<readonly QuantifiedRecallItem[]>(
    initialStrategy?.habitualIntake?.items ?? [],
  );
  const [habitualEstimate, setHabitualEstimate] = useState<HabitualIntakeEstimate | undefined>(
    initialStrategy?.habitualIntake?.estimate,
  );
  const [evolutionGoal, setEvolutionGoal] = useState<NutritionEvolutionGoal | undefined>(
    initialStrategy?.evolutionGoal,
  );
  const [patternSuggestion, setPatternSuggestion] = useState<PatternEnergySuggestion | undefined>(
    initialStrategy?.patternEnergySuggestion,
  );
  const [vetDecisionState, setVetDecisionState] = useState<VetDecisionState | undefined>(
    initialStrategy?.status === "APPROVED"
      ? "APPROVED"
      : initialStrategy?.vetDecisionState,
  );
  // Compatibilidade de rascunhos antigos: os dados permanecem preservados,
  // mas o RecordatÃ³rio agora sÃ³ pode ser editado na Anamnese.
  const [recallQuery, setRecallQuery] = useState("");
  const [recallResults, setRecallResults] = useState<readonly ProfessionalFood[]>([]);
  const [recallSearching, setRecallSearching] = useState(false);
  const [activeRecallMealKey, setActiveRecallMealKey] = useState<string>();
  const [newRecallMealName, setNewRecallMealName] = useState("");
  const quantifyingRecall = false;
  const [saveState, setSaveState] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE");
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("IDLE");
  const [recoverableDraft, setRecoverableDraft] =
    useState<LocalStrategyDraft | null>(null);
  const [message, setMessage] = useState("");
  const [savingMealSchedules, setSavingMealSchedules] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [advancedConfigurationsOpen, setAdvancedConfigurationsOpen] = useState(false);
  const autoSaveTimerRef = useRef<number | undefined>(undefined);
  const autoSaveInFlightRef = useRef(false);
  const manualSaveInFlightRef = useRef(false);
  const recoveryDecisionPendingRef = useRef(false);
  const queuedAutoSaveRef = useRef<
    { draft: NutritionStrategyDraft; fingerprint: string } | undefined
  >(undefined);
  const autoSaveRunnerRef = useRef<
    ((draft: NutritionStrategyDraft, fingerprint: string) => Promise<void>) |
      undefined
  >(undefined);
  const approved = record?.status === "APPROVED";
  const availableProtocols = useMemo(
    () =>
      view.energyDecision
        ? nutritionStrategyDecisionService.availableProtocols(view.energyDecision)
        : [],
    [view.energyDecision],
  );
  const decision = useMemo(
    () =>
      view.energyDecision &&
      protocol
        ? nutritionStrategyDecisionService.calculate({
            energy: {
              ...view.energyDecision,
              activityFactor,
              recordedBasalMetabolicRateKcal:
                view.energyDecision.recordedBasalMetabolicRateKcal ??
                initialStrategy?.basalMetabolicRateKcal,
              recordedTotalEnergyExpenditureKcal:
                view.energyDecision.recordedTotalEnergyExpenditureKcal,
            },
            objective,
            protocol,
            calorieAdjustmentPercentage: adjustment,
            manualFinalCaloriesKcal: manualCalories,
          })
        : undefined,
    [
      activityFactor,
      adjustment,
      initialStrategy?.basalMetabolicRateKcal,
      manualCalories,
      objective,
      protocol,
      view.energyDecision,
    ],
  );
  const weightKg = view.nutritionalStatus.weightKg;
  const waterCoefficientMlPerKg = hydrationCoefficient(view.patient.age);
  const suggestedWaterMl = weightKg && waterCoefficientMlPerKg
    ? Math.round(weightKg * waterCoefficientMlPerKg)
    : undefined;
  const energyMissingData = nutritionEnergyMissingData(
    view.energyDecision,
    protocol,
    activityFactor,
  );
  const totalEnergyExpenditure =
    decision?.totalEnergyExpenditureKcal ??
    initialStrategy?.totalEnergyExpenditureKcal;
  const habitualGetComparison = useMemo(
    () => compareHabitualIntakeWithGet(habitualEstimate, totalEnergyExpenditure),
    [habitualEstimate, totalEnergyExpenditure],
  );
  const recallMealGroups = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; items: QuantifiedRecallItem[] }>();
    for (const item of recallItems) {
      const name = item.mealName.trim();
      const key = name || "__not_informed";
      const group = groups.get(key) ?? { key, name, items: [] };
      group.items.push(item);
      groups.set(key, group);
    }
    if (activeRecallMealKey?.startsWith("draft:")) {
      const name = activeRecallMealKey.slice("draft:".length);
      groups.set(activeRecallMealKey, { key: activeRecallMealKey, name, items: [] });
    }
    return Array.from(groups.values());
  }, [activeRecallMealKey, recallItems]);
  const basalMetabolicRate =
    decision?.basalMetabolicRateKcal ??
    initialStrategy?.basalMetabolicRateKcal ??
    view.bodyComposition.basalMetabolicRateKcal;
  const finalCalories =
    manualCalories ??
    decision?.finalCaloriesKcal ??
    initialStrategy?.finalCaloriesKcal;
  const energyAdjustmentKcal =
    totalEnergyExpenditure !== undefined && adjustment !== undefined
      ? totalEnergyExpenditure * (adjustment / 100)
      : undefined;
  const hasConditionalConfigurations =
    method === "TIME_RESTRICTED_EATING" ||
    method === "CARB_CYCLING" ||
    method === "SPORTS_PERIODIZATION" ||
    method === "KETOGENIC" ||
    method === "VEGETARIAN" ||
    method === "OVO_LACTO_VEGETARIAN" ||
    method === "VEGAN" ||
    modifications.includes("LOW_FODMAP") ||
    clinicalProtocols.includes("RENAL_DISEASE") ||
    clinicalProtocols.includes("OTHER");
  const hasFluidRestriction = modifications.includes("FLUID_RESTRICTION");
  function changeModification(code: NutritionModification, checked: boolean) {
    if (!checked) {
      setModificationConflictMessage("");
      setModifications(modifications.filter((item) => item !== code));
      return;
    }
    const exclusiveGroup = exclusiveModificationGroups.find((group) => group.includes(code));
    const conflicting = exclusiveGroup
      ? modifications.filter((item) => item !== code && exclusiveGroup.includes(item))
      : [];
    if (conflicting.length) {
      const selectedLabel = NUTRITION_MODIFICATION_OPTIONS.find(([option]) => option === code)?.[1] ?? code;
      const removedLabels = conflicting.map((item) => NUTRITION_MODIFICATION_OPTIONS.find(([option]) => option === item)?.[1] ?? item);
      setModificationConflictMessage(`${removedLabels.join(" e ")} ${removedLabels.length > 1 ? "foram desmarcadas" : "foi desmarcada"} porque ${selectedLabel} pertence ao mesmo grupo de alternativas exclusivas.`);
    } else {
      setModificationConflictMessage("");
    }
    setModifications([...modifications.filter((item) => !exclusiveGroup?.includes(item)), code]);
  }
  function setCarbohydrateDay(weekday: NutritionWeekday, type: CarbohydrateDayType | undefined) {
    setSpecificConfigurations((current) => {
      const cycling = current.carbohydrateCycling ?? { lowDays: [], moderateDays: [], highDays: [], linkedToTraining: false };
      const withoutDay = {
        lowDays: cycling.lowDays.filter((day) => day !== weekday),
        moderateDays: cycling.moderateDays.filter((day) => day !== weekday),
        highDays: cycling.highDays.filter((day) => day !== weekday),
      };
      return {
        ...current,
        carbohydrateCycling: {
          ...cycling,
          ...withoutDay,
          lowDays: type === "LOW" ? [...withoutDay.lowDays, weekday] : withoutDay.lowDays,
          moderateDays: type === "MODERATE" ? [...withoutDay.moderateDays, weekday] : withoutDay.moderateDays,
          highDays: type === "HIGH" ? [...withoutDay.highDays, weekday] : withoutDay.highDays,
        },
      };
    });
  }
  function setSportsDay(weekday: NutritionWeekday, type: SportsDayType | undefined) {
    setSpecificConfigurations((current) => {
      const sports = current.sportsPeriodization ?? { trainingDays: [], restDays: [], competitionDays: [] };
      const existing = weekdayOptions
        .map(([day]) => sportsDayConfiguration(sports, day))
        .filter((day): day is SportsDayConfiguration => Boolean(day));
      const previous = existing.find((day) => day.weekday === weekday);
      const days = [
        ...existing.filter((day) => day.weekday !== weekday),
        ...(type ? [{ weekday, type, ...(previous?.type === type ? previous : {}) }] : []),
      ];
      return {
        ...current,
        sportsPeriodization: {
          ...sports,
          days,
          trainingDays: days.filter((day) => day.type === "TRAINING").map((day) => day.weekday),
          restDays: days.filter((day) => day.type === "REST").map((day) => day.weekday),
          competitionDays: days.filter((day) => day.type === "COMPETITION").map((day) => day.weekday),
        },
      };
    });
  }
  function updateSportsDay(weekday: NutritionWeekday, patch: Partial<SportsDayConfiguration>) {
    setSpecificConfigurations((current) => {
      const sports = current.sportsPeriodization;
      if (!sports) return current;
      const days = weekdayOptions
        .map(([day]) => sportsDayConfiguration(sports, day))
        .filter((day): day is SportsDayConfiguration => Boolean(day))
        .map((day) => day.weekday === weekday ? { ...day, ...patch } : day);
      return { ...current, sportsPeriodization: { ...sports, days } };
    });
  }
  const proteinCalculation = useMemo(
    () =>
      protein.value && finalCalories
        ? calculateMacronutrient("protein", protein.mode, protein.value, finalCalories, weightKg)
        : undefined,
    [finalCalories, protein, weightKg],
  );
  const fatsCalculation = useMemo(
    () =>
      fats.value && finalCalories
        ? calculateMacronutrient("fats", fats.mode, fats.value, finalCalories, weightKg)
        : undefined,
    [fats, finalCalories, weightKg],
  );
  const carbohydratesCalculation = useMemo(() => {
    if (!finalCalories || !carbohydrates.value) return undefined;
    return calculateMacronutrient(
      "carbohydrates",
      carbohydrates.mode,
      carbohydrates.value,
      finalCalories,
      weightKg,
    );
  }, [carbohydrates, finalCalories, weightKg]);
  const macroValidation = useMemo(
    () =>
      finalCalories
        ? validateMacroDistribution(finalCalories, [
            proteinCalculation,
            carbohydratesCalculation,
            fatsCalculation,
          ])
        : undefined,
    [carbohydratesCalculation, fatsCalculation, finalCalories, proteinCalculation],
  );
  const generalMacroInputs = [protein, carbohydrates, fats];
  const allGeneralMacrosInPercentage = generalMacroInputs.every((input) => input.mode === "PERCENTAGE");
  const generalPercentageTotal = allGeneralMacrosInPercentage
    ? generalMacroInputs.reduce((total, input) => total + (input.value ?? 0), 0)
    : undefined;
  const generalMacroCalculations = [proteinCalculation, carbohydratesCalculation, fatsCalculation];
  const generalCalculatedCalories = generalMacroCalculations.every((calculation) => calculation !== undefined)
    ? generalMacroCalculations.reduce((total, calculation) => total + (calculation?.kcal ?? 0), 0)
    : undefined;
  const generalCalorieDifference = generalCalculatedCalories !== undefined && finalCalories !== undefined
    ? generalCalculatedCalories - finalCalories
    : undefined;
  const calculatedMealDistribution = useMemo<
    readonly NutritionStrategyMealAllocation[]
  >(
    () =>
      mealDistribution.map((meal) => ({
        ...meal,
        plannedCaloriesKcal: finalCalories
          ? Math.round(
              finalCalories * (meal.vetPercentage / 100) * 10,
            ) / 10
          : undefined,
      })),
    [finalCalories, mealDistribution],
  );
  const presentedMealDistribution = useMemo(
    () => presentMealSchedules(calculatedMealDistribution),
    [calculatedMealDistribution],
  );
  const distributedTotal = mealDistribution.reduce(
    (total, meal) => total + meal.vetPercentage,
    0,
  );
  const distributionDifference = distributedTotal - 100;
  const mealDistributionValid =
    Math.abs(distributionDifference) < 0.01;
  const draft = useMemo<NutritionStrategyDraft>(() => ({
      objective,
      secondaryObjectives:
        initialStrategy?.secondaryObjectives?.length
          ? initialStrategy.secondaryObjectives
          : view.patient.secondaryObjectives,
      method,
      modifications,
      clinicalProtocols,
      specificConfigurations,
      energyGoal,
      protocol,
      calorieAdjustmentPercentage: adjustment,
      activityFactor,
      manualFinalCaloriesKcal: manualCalories,
      finalCaloriesKcal: finalCalories,
      basalMetabolicRateKcal: basalMetabolicRate,
      totalEnergyExpenditureKcal:
        totalEnergyExpenditure,
      habitualIntake: {
        items: recallItems,
        estimate: habitualEstimate,
      },
      evolutionGoal,
      patternEnergySuggestion: patternSuggestion,
      vetDecisionState,
      protein,
      carbohydrates,
      fats,
      calculatedMacros: {
        protein: proteinCalculation,
        carbohydrates: carbohydratesCalculation,
        fats: fatsCalculation,
      },
      macroValidation,
      fiberGrams,
      waterMl,
      mealCount,
      mealDistribution: calculatedMealDistribution,
      supplementation,
      clinicalObservations,
      evaluationEntryId: view.evaluationEntryId,
  }), [
    activityFactor,
    adjustment,
    basalMetabolicRate,
    calculatedMealDistribution,
    carbohydrates,
    carbohydratesCalculation,
    clinicalProtocols,
    clinicalObservations,
    evolutionGoal,
    energyGoal,
    fats,
    fatsCalculation,
    fiberGrams,
    finalCalories,
    habitualEstimate,
    initialStrategy,
    macroValidation,
    manualCalories,
    mealCount,
    method,
    modifications,
    objective,
    patternSuggestion,
    protein,
    proteinCalculation,
    protocol,
    recallItems,
    supplementation,
    specificConfigurations,
    totalEnergyExpenditure,
    vetDecisionState,
    view,
    waterMl,
  ]);
  const canApprove = canApproveNutritionStrategy(draft);
  const approvalIssues = nutritionStrategyApprovalIssues(draft);
  const configurationIssues = specificConfigurationIssues({
    method,
    modifications,
    clinicalProtocols,
    configurations: specificConfigurations,
  });
  const validationErrors = showValidationErrors
    ? {
        objective: objective ? undefined : "Selecione o objetivo nutricional.",
        protocol: protocol ? undefined : "Selecione um protocolo compatível com os dados disponíveis.",
        activityFactor:
          view.energyDecision?.recordedTotalEnergyExpenditureKcal || activityFactor
            ? undefined
            : "Selecione o fator de atividade para calcular o GET.",
        get: totalEnergyExpenditure
          ? undefined
          : energyMissingData.length
            ? `GET não calculado: ${energyMissingData.join("; ")}.`
            : "Informe protocolo e fator de atividade válidos para calcular o GET.",
        method: method ? undefined : "Selecione o método nutricional.",
        adjustment:
          !energyGoal || (energyGoal !== "MANUAL_VET" && adjustment === undefined)
            ? "Selecione e confirme o objetivo energético."
            : undefined,
        vet: finalCalories ? undefined : "Defina o ajuste energético ou um VET manual válido.",
        protein: proteinCalculation ? undefined : "Informe a meta de proteínas.",
        carbohydrates: carbohydratesCalculation ? undefined : "Informe a meta de carboidratos.",
        fats: fatsCalculation ? undefined : "Informe a meta de lipídios.",
        fiber: fiberGrams ? undefined : "Informe a meta diária de fibras.",
        water: waterMl || hasFluidRestriction ? undefined : "Confirme a meta hídrica.",
        meals: mealCount && Number.isInteger(mealCount) && mealCount > 0 ? undefined : "Informe um número inteiro positivo de refeições.",
        distribution: undefined,
      }
    : {};
  const endpoint = `/api/patients/${view.patientId}/attendances/${view.attendanceId}/nutrition-strategy`;
  const localDraftKey = localStrategyDraftKey(
    view.patientId,
    view.attendanceId,
  );
  const draftFingerprint = JSON.stringify(draft);
  const latestDraftRef = useRef(draft);
  const latestFingerprintRef = useRef(draftFingerprint);
  const lastServerFingerprintRef = useRef(draftFingerprint);

  useEffect(() => {
    latestDraftRef.current = draft;
    latestFingerprintRef.current = draftFingerprint;
  }, [draft, draftFingerprint]);

  useEffect(() => {
    if (!scheduleCorrection) return;
    window.requestAnimationFrame(() => {
      document
        .getElementById("daily-meal-distribution")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [scheduleCorrection]);

  useEffect(() => {
    if (approved) {
      removeLocalStrategyDraft(localDraftKey);
      return;
    }
    const stored = readLocalStrategyDraft(localDraftKey);
    if (!stored) return;
    if (JSON.stringify(stored.draft) === lastServerFingerprintRef.current) {
      removeLocalStrategyDraft(localDraftKey);
      return;
    }
    recoveryDecisionPendingRef.current = true;
    setRecoverableDraft(stored);
  }, [approved, localDraftKey]);

  useEffect(() => {
    if (
      approved ||
      recoveryDecisionPendingRef.current ||
      draftFingerprint === lastServerFingerprintRef.current
    ) {
      return;
    }

    const draftSnapshot = latestDraftRef.current;
    if (!draftSnapshot) return;
    storeLocalStrategyDraft(localDraftKey, draftSnapshot);
    setAutoSaveState((current) =>
      current === "SAVING" ? current : "PENDING",
    );
    if (autoSaveTimerRef.current !== undefined) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = undefined;
      void autoSaveRunnerRef.current?.(draftSnapshot, draftFingerprint);
    }, 1_200);

    return () => {
      if (autoSaveTimerRef.current !== undefined) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = undefined;
      }
    };
  }, [approved, draftFingerprint, localDraftKey]);

  function removeRecallItem(itemId: string) {
    setRecallItems((items) => items.filter((item) => item.id !== itemId));
  }

  function applyDraft(recovered: NutritionStrategyDraft) {
    setObjective(
      resolveInitialNutritionObjective(
        recovered.objective,
        view.patient.primaryObjective,
      ),
    );
    setMethod(recovered.method);
    setModifications(recovered.modifications ?? []);
    setClinicalProtocols(
      recovered.clinicalProtocols ??
        (recovered.clinicalProtocol ? [recovered.clinicalProtocol] : []),
    );
    setSpecificConfigurations(recovered.specificConfigurations ?? {});
    setEnergyGoal(
      recovered.energyGoal ??
        energyGoalFromLegacyValues(
          recovered.calorieAdjustmentPercentage,
          recovered.manualFinalCaloriesKcal,
        ),
    );
    setProtocol(recovered.protocol);
    setAdjustment(recovered.calorieAdjustmentPercentage);
    setActivityFactor(recovered.activityFactor);
    setManualCalories(recovered.manualFinalCaloriesKcal);
    setProtein({ ...recovered.protein });
    setCarbohydrates({ ...recovered.carbohydrates });
    setFats({ ...recovered.fats });
    setMealCount(recovered.mealCount);
    setMealDistribution(
      recovered.mealDistribution.map((meal) => ({ ...meal })),
    );
    setFiberGrams(recovered.fiberGrams);
    setWaterMl(recovered.waterMl);
    setSupplementation(
      recovered.supplementation.map((supplement) => ({ ...supplement })),
    );
    setClinicalObservations(recovered.clinicalObservations);
    setRecallItems(
      recovered.habitualIntake?.items.map((item) => ({ ...item })) ?? [],
    );
    setHabitualEstimate(recovered.habitualIntake?.estimate);
    setEvolutionGoal(recovered.evolutionGoal);
    setPatternSuggestion(recovered.patternEnergySuggestion);
    setVetDecisionState(recovered.vetDecisionState);
  }

  function recoverLocalDraft() {
    if (!recoverableDraft || approved) return;
    applyDraft(recoverableDraft.draft);
    recoveryDecisionPendingRef.current = false;
    setRecoverableDraft(null);
    setAutoSaveState("PENDING");
    setMessage("Rascunho local recuperado. O autosave irá sincronizá-lo.");
  }

  function discardLocalDraft() {
    removeLocalStrategyDraft(localDraftKey);
    recoveryDecisionPendingRef.current = false;
    setRecoverableDraft(null);
    setAutoSaveState("IDLE");
    setMessage("Alterações locais descartadas com segurança.");
  }

  async function flushAutoSave(
    draftToSave: NutritionStrategyDraft,
    fingerprint: string,
  ) {
    if (approved) return;
    if (autoSaveInFlightRef.current || manualSaveInFlightRef.current) {
      queuedAutoSaveRef.current = { draft: draftToSave, fingerprint };
      return;
    }
    autoSaveInFlightRef.current = true;
    setAutoSaveState("SAVING");
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...developmentUserRequestHeaders(),
        },
        body: JSON.stringify(draftToSave),
      });
      const result = (await response.json()) as {
        record?: NutritionStrategyRecordView;
      };
      if (!response.ok || !result.record) {
        setAutoSaveState("ERROR");
        return;
      }
      setRecord(result.record);
      lastServerFingerprintRef.current = fingerprint;
      if (latestFingerprintRef.current === fingerprint) {
        removeLocalStrategyDraft(localDraftKey);
        setAutoSaveState("SAVED");
      } else {
        setAutoSaveState("PENDING");
      }
    } catch {
      setAutoSaveState("ERROR");
    } finally {
      autoSaveInFlightRef.current = false;
      const queued = queuedAutoSaveRef.current;
      queuedAutoSaveRef.current = undefined;
      if (queued && queued.fingerprint !== lastServerFingerprintRef.current) {
        await flushAutoSave(queued.draft, queued.fingerprint);
      }
    }
  }

  useEffect(() => {
    autoSaveRunnerRef.current = flushAutoSave;
  });

  async function send(method: "PUT" | "POST", body: unknown) {
    if (saveState === "SAVING" || autoSaveInFlightRef.current) return;
    if (autoSaveTimerRef.current !== undefined) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = undefined;
    }
    manualSaveInFlightRef.current = true;
    const submittedFingerprint = latestFingerprintRef.current;
    setSaveState("SAVING");
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...developmentUserRequestHeaders(),
        },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        record?: NutritionStrategyRecordView;
        message?: string;
      };
      if (!response.ok || !result.record) {
        setSaveState("ERROR");
        setMessage(
          result.message ?? "Não foi possível atualizar a estratégia.",
        );
        return;
      }
      setRecord(result.record);
      setVetDecisionState(
        result.record.status === "APPROVED"
          ? "APPROVED"
          : result.record.vetDecisionState,
      );
      setSaveState("SAVED");
      if (method === "PUT" || result.record.status === "APPROVED") {
        lastServerFingerprintRef.current = submittedFingerprint;
        if (
          result.record.status === "APPROVED" ||
          latestFingerprintRef.current === submittedFingerprint
        ) {
          removeLocalStrategyDraft(localDraftKey);
          setAutoSaveState("SAVED");
        }
      }
      setMessage(
        result.record.status === "APPROVED"
          ? "Estratégia aprovada e bloqueada para alterações acidentais."
          : "Estratégia salva no Prontuário Mestre.",
      );
      if (result.record.status === "APPROVED") {
        router.push(
          nutritionClinicalFlowHref("MEAL_PLAN", {
            patientId: view.patientId,
            attendanceId: view.attendanceId,
          }),
        );
      }
    } catch {
      setSaveState("ERROR");
      setMessage(
        "Não foi possível conectar ao serviço da Estratégia Nutricional.",
      );
    } finally {
      manualSaveInFlightRef.current = false;
      const queued = queuedAutoSaveRef.current;
      queuedAutoSaveRef.current = undefined;
      if (queued && queued.fingerprint !== lastServerFingerprintRef.current) {
        void flushAutoSave(queued.draft, queued.fingerprint);
      }
    }
  }

  function finalizeStrategy() {
    if (canApprove) {
      void send("POST", { action: "APPROVE", strategy: draft });
      return;
    }

    setShowValidationErrors(true);
    const pending = [
      { invalid: !objective, area: "GOALS" as const, id: "strategy-objective" },
      { invalid: !protocol, area: "ENERGY" as const, id: "energy-protocol" },
      {
        invalid: !view.energyDecision?.recordedTotalEnergyExpenditureKcal && !activityFactor,
        area: "ENERGY" as const,
        id: "activity-factor",
      },
      { invalid: !totalEnergyExpenditure, area: "ENERGY" as const, id: "strategy-get-output" },
      { invalid: !method, area: "PRESCRIPTION" as const, id: "nutrition-method" },
      { invalid: configurationIssues.length > 0, area: "PRESCRIPTION" as const, id: "specific-configurations" },
      { invalid: !energyGoal || (energyGoal !== "MANUAL_VET" && adjustment === undefined), area: "PRESCRIPTION" as const, id: "calorie-adjustment" },
      { invalid: !finalCalories, area: "PRESCRIPTION" as const, id: "strategy-vet-output" },
      { invalid: !proteinCalculation, area: "PRESCRIPTION" as const, id: "macro-Proteínas-value" },
      { invalid: !carbohydratesCalculation, area: "PRESCRIPTION" as const, id: "macro-Carboidratos-value" },
      { invalid: !fatsCalculation, area: "PRESCRIPTION" as const, id: "macro-Lipídios-value" },
      { invalid: !mealCount, area: "PRESCRIPTION" as const, id: "strategy-meals" },
      { invalid: !fiberGrams, area: "PRESCRIPTION" as const, id: "fiber-goal" },
      { invalid: !waterMl && !hasFluidRestriction, area: "PRESCRIPTION" as const, id: "water-goal" },
      {
        invalid: !mealCount || !Number.isInteger(mealCount),
        area: "PRESCRIPTION" as const,
        id: "meal-organization-title",
      },
    ].find((item) => item.invalid);

    if (!pending) return;
    setMessage(`Não foi possível finalizar. Pendências: ${approvalIssues.join("; ")}.`);
    focusStrategyField(pending.area, pending.id);
  }

  async function saveApprovedMealSchedules() {
    if (
      !approved ||
      savingMealSchedules ||
      presentedMealDistribution.some((meal) => !meal.time)
    ) {
      setMessage("Informe um horário válido para todas as refeições.");
      return;
    }
    setSavingMealSchedules(true);
    setMessage("Salvando horários na Estratégia concluída.");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...developmentUserRequestHeaders(),
        },
        body: JSON.stringify({
          action: "UPDATE_MEAL_SCHEDULES",
          schedules: presentedMealDistribution.map((meal) => ({
            mealNumber: meal.mealNumber,
            time: meal.time,
          })),
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { record?: NutritionStrategyRecordView; message?: string }
        | null;
      if (!response.ok || !result?.record) {
        setMessage(
          result?.message ?? "Não foi possível salvar os horários das refeições.",
        );
        return;
      }
      setRecord(result.record);
      setMealDistribution(
        result.record.mealDistribution.map((meal) => ({ ...meal })),
      );
      router.push(
        nutritionClinicalFlowHref("MEAL_PLAN", {
          patientId: view.patientId,
          attendanceId: view.attendanceId,
        }),
      );
    } catch {
      setMessage("Não foi possível conectar ao serviço da Estratégia Nutricional.");
    } finally {
      setSavingMealSchedules(false);
    }
  }

  function focusStrategyField(area: StrategyArea, id: string) {
    setActiveArea(area);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const element = document.getElementById(id);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
        element?.focus({ preventScroll: true });
      });
    });
  }

  function focusApprovalIssue(issue: string) {
    if (issue.includes("Objetivo")) {
      focusStrategyField("GOALS", "strategy-objective");
    } else if (issue.includes("Protocolo")) {
      focusStrategyField("ENERGY", "energy-protocol");
    } else if (issue.includes("GET")) {
      focusStrategyField("ENERGY", "strategy-get-output");
    } else if (issue.includes("Objetivo energético")) {
      focusStrategyField("PRESCRIPTION", "calorie-adjustment");
    } else if (issue.includes("VET")) {
      focusStrategyField("PRESCRIPTION", "strategy-vet-output");
    } else if (issue.includes("Proteína")) {
      focusStrategyField("PRESCRIPTION", "macro-Proteínas-value");
    } else if (issue.includes("Carboidrato")) {
      focusStrategyField("PRESCRIPTION", "macro-Carboidratos-value");
    } else if (issue.includes("Lipídio")) {
      focusStrategyField("PRESCRIPTION", "macro-Lipídios-value");
    } else if (issue.includes("Distribuição energética")) {
      focusStrategyField("PRESCRIPTION", "macronutrients-title");
    } else if (issue.includes("fibras")) {
      focusStrategyField("PRESCRIPTION", "fiber-goal");
    } else if (issue.includes("água")) {
      focusStrategyField("PRESCRIPTION", "water-goal");
    } else if (
      issue.includes("Configuração") ||
      issue.includes("cetogênica") ||
      issue.includes("Low FODMAP") ||
      issue.includes("protocolo clínico")
    ) {
      setAdvancedConfigurationsOpen(true);
      focusStrategyField("PRESCRIPTION", "specific-configurations");
    } else {
      focusStrategyField("PRESCRIPTION", "meal-organization-title");
    }
  }

  function openEnergyDataOrigin(item: string) {
    if (item === "Protocolo energético") {
      focusStrategyField("ENERGY", "energy-protocol");
      return;
    }
    if (item === "Fator de atividade") {
      focusStrategyField("ENERGY", "activity-factor");
      return;
    }
    const step =
      item === "Sexo cadastrado para cálculo energético" || item === "Idade"
        ? "PATIENT_REGISTRATION"
        : item === "Massa livre de gordura"
          ? "BIOIMPEDANCE"
          : "ANTHROPOMETRY";
    router.push(
      nutritionClinicalFlowHref(step, {
        patientId: view.patientId,
        attendanceId: view.attendanceId,
      }),
    );
  }

  return (
    <div className="mb-4 space-y-4">
      {recoverableDraft && !approved ? (
        <Card aria-labelledby="recover-strategy-title" className="border-amber-300 bg-amber-50 p-5" role="alertdialog">
          <CardContent className="space-y-3">
            <div>
              <h2 className="font-black text-amber-950" id="recover-strategy-title">
                Alterações locais recuperáveis
              </h2>
              <p className="mt-1 text-sm text-amber-900">
                Este navegador preservou alterações que podem não ter chegado ao servidor após uma interrupção. Escolha recuperar ou descartar com segurança.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={recoverLocalDraft} type="button">
                Recuperar alterações
              </Button>
              <Button onClick={discardLocalDraft} type="button" variant="outline">
                Descartar alterações locais
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <div
        aria-label="Áreas da Estratégia Nutricional"
        className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white p-1.5 shadow-sm"
        role="tablist"
      >
        {strategyAreas.map((area, index) => (
          <button
            aria-controls={`strategy-panel-${area.id}`}
            aria-selected={activeArea === area.id}
            className={`min-w-max rounded-xl px-4 py-2.5 text-sm font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
              activeArea === area.id
                ? "bg-[#103f32] text-white shadow-sm"
                : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"
            }`}
            id={`strategy-tab-${area.id}`}
            key={area.id}
            onClick={() => setActiveArea(area.id)}
            onKeyDown={(event) => {
              const lastIndex = strategyAreas.length - 1;
              const nextIndex =
                event.key === "ArrowRight"
                  ? index === lastIndex
                    ? 0
                    : index + 1
                  : event.key === "ArrowLeft"
                    ? index === 0
                      ? lastIndex
                      : index - 1
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? lastIndex
                        : undefined;
              if (nextIndex === undefined) return;
              event.preventDefault();
              const nextArea = strategyAreas[nextIndex];
              setActiveArea(nextArea.id);
              document.getElementById(`strategy-tab-${nextArea.id}`)?.focus();
            }}
            role="tab"
            tabIndex={activeArea === area.id ? 0 : -1}
            type="button"
          >
            {area.label}
          </button>
        ))}
      </div>

      {activeArea === "CLINICAL_SUMMARY" ? (
        <div
          aria-labelledby="strategy-tab-CLINICAL_SUMMARY"
          className="space-y-4"
          id="strategy-panel-CLINICAL_SUMMARY"
          role="tabpanel"
        >
          {clinicalSummary}
          <Card aria-live="polite" className="p-5" variant="elevated">
        <CardHeader>
          <CardTitle>Estratégia Atual</CardTitle>
          <CardDescription>Decisões clínicas essenciais da estratégia em elaboração.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid border-y border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryItem label="Objetivo" value={objective ? NUTRITION_OBJECTIVES[objective] : NOT_INFORMED} />
            <SummaryItem
              label="Protocolo"
              value={
                decision?.protocolLabel ??
                (protocol ? ENERGY_PROTOCOLS[protocol] : NOT_INFORMED)
              }
            />
            <SummaryItem label="TMB" value={energyValue(basalMetabolicRate)} />
            <SummaryItem label="GET" value={energyValue(draft.totalEnergyExpenditureKcal)} />
            <SummaryItem
              label="VET (Valor Energético Total)"
              value={energyValue(finalCalories)}
            />
            <SummaryItem label="Proteína" value={macroSummary(proteinCalculation)} />
            <SummaryItem label="Carboidrato" value={macroSummary(carbohydratesCalculation)} />
            <SummaryItem label="Lipídio" value={macroSummary(fatsCalculation)} />
            <SummaryItem label="Número de refeições" value={mealCount ? String(mealCount) : NOT_INFORMED} />
            <SummaryItem label="Método principal" value={method ? NUTRITION_METHOD_OPTIONS.find(([code]) => code === method)?.[1] ?? method : NOT_INFORMED} />
            <SummaryItem label="Objetivo energético" value={energyGoal ? ENERGY_GOAL_OPTIONS.find(([code]) => code === energyGoal)?.[1] ?? energyGoal : NOT_INFORMED} />
            <SummaryItem label="Modificações" value={modifications.length ? modifications.map((item) => NUTRITION_MODIFICATION_OPTIONS.find(([code]) => code === item)?.[1] ?? item).join(" · ") : "Nenhuma"} />
            <SummaryItem label="Protocolos clínicos" value={clinicalProtocols.length ? clinicalProtocols.map((item) => CLINICAL_PROTOCOL_OPTIONS.find(([code]) => code === item)?.[1] ?? item).join(" · ") : "Nenhum protocolo selecionado"} />
          </dl>
        </CardContent>
          </Card>
        </div>
      ) : null}

      {activeArea === "RECALL" ? (
        <Card
          aria-labelledby="strategy-tab-RECALL"
          className="p-5"
          id="strategy-panel-RECALL"
          role="tabpanel"
          variant="outlined"
        >
          <CardHeader>
            <CardTitle>Recordat&oacute;rio alimentar de 24 horas</CardTitle>
            <CardDescription>
              Resumo somente para leitura do Recordat&oacute;rio registrado na Anamnese deste atendimento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {anamnesisRecall.performed ? (
              <>
                <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                  {[
                    ["Energia", anamnesisRecall.totals?.energyKcal, "kcal"],
                    ["Proteínas", anamnesisRecall.totals?.proteinGrams, "g"],
                    ["Carboidratos", anamnesisRecall.totals?.carbohydratesGrams, "g"],
                    ["Lipídios", anamnesisRecall.totals?.fatsGrams, "g"],
                    ["Fibras", anamnesisRecall.totals?.fiberGrams, "g"],
                    [
                      "Confiança",
                      anamnesisRecall.confidence === "HIGH"
                        ? "Alta"
                        : anamnesisRecall.confidence === "LOW"
                          ? "Baixa"
                          : "Não estimada",
                      "",
                    ],
                  ].map(([label, value, unit]) => (
                    <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-3" key={String(label)}>
                      <dt className="text-[10px] font-black uppercase text-slate-500">{label}</dt>
                      <dd className="mt-1 text-sm font-black text-slate-900">
                        {typeof value === "number"
                          ? `${numberFormatter.format(value)} ${unit}`
                          : typeof value === "string"
                            ? value
                            : NOT_INFORMED}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-slate-600">
                  Este resumo n&atilde;o substitui o plano prescrito e n&atilde;o &eacute; requisito para finalizar a Estrat&eacute;gia.
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                <p className="font-black text-slate-900">Recordat&oacute;rio n&atilde;o realizado</p>
                <p className="mt-1 text-sm text-slate-600">
                  A Estrat&eacute;gia e o Plano Alimentar podem continuar sem este registro opcional.
                </p>
              </div>
            )}
            <Button
              onClick={() => router.push(anamnesisRecall.reviewHref)}
              type="button"
              variant="outline"
            >
              Revisar na Anamnese
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {false && activeArea === "RECALL" ? (
      <Card
        aria-labelledby="strategy-tab-RECALL"
        className="p-5"
        id="strategy-panel-RECALL"
        role="tabpanel"
        variant="outlined"
      >
        <CardHeader>
          <CardTitle>Resumo do padr&atilde;o alimentar</CardTitle>
          <CardDescription>
            Recordat&oacute;rio quantificado com alimentos reais do Banco Mestre. Nenhuma por&ccedil;&atilde;o &eacute; presumida.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <section aria-labelledby="quantified-recall-title" className="space-y-3">
            <div>
              <h3 className="text-sm font-black text-slate-900" id="quantified-recall-title">
                Recordat&oacute;rio Alimentar Quantificado
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Informe o alimento e a quantidade efetivamente relatada. Itens sem quantidade permanecem fora da estimativa.
              </p>
            </div>
            <div className="space-y-3">
              {recallMealGroups.map((meal) => (
                <section
                  aria-labelledby={`recall-meal-${meal.key}`}
                  className="overflow-hidden rounded-xl border border-[var(--line)]"
                  key={meal.key}
                >
                  <div className="flex flex-col gap-3 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wide text-slate-900" id={`recall-meal-${meal.key}`}>
                        {meal.name || NOT_INFORMED}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Horário: {NOT_INFORMED}
                      </p>
                    </div>
                    {!approved ? (
                      <Button
                        onClick={() => {
                          setActiveRecallMealKey(meal.key);
                          setRecallQuery("");
                          setRecallResults([]);
                        }}
                        size="small"
                        type="button"
                        variant="outline"
                      >
                        + Alimento
                      </Button>
                    ) : null}
                  </div>

                  {activeRecallMealKey === meal.key && !approved ? (
                    <div className="border-t border-[var(--line)] bg-white p-3">
                      <FormField id={`recall-food-search-${meal.key}`} label="Alimento do Banco Mestre">
                        <Input
                          autoComplete="off"
                          id={`recall-food-search-${meal.key}`}
                          onChange={(event) => {
                            setRecallQuery(event.target.value);
                            if (event.target.value.trim().length < 2) {
                              setRecallResults([]);
                              setRecallSearching(false);
                            }
                          }}
                          placeholder="Pesquisar alimento..."
                          value={recallQuery}
                        />
                      </FormField>
                      {recallQuery.trim().length >= 2 ? (
                        <div className="mt-2 grid gap-1 rounded-xl border border-[var(--line)] bg-white p-2 shadow-sm">
                          {recallSearching ? <p className="p-2 text-xs text-slate-500">Pesquisando...</p> : null}
                          {!recallSearching && !recallResults.length ? <p className="p-2 text-xs text-slate-500">Nenhum alimento encontrado.</p> : null}
                          {recallResults.map((food) => (
                            <button
                              className="rounded-lg px-3 py-2 text-left hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                              key={food.id}
                              onClick={() => {
                                setRecallItems((items) => [...items, {
                                  id: crypto.randomUUID(),
                                  foodId: food.id,
                                  foodName: food.officialName,
                                  mealName: meal.name,
                                  unit: food.referenceServingUnit === "ml" ? "ml" : "g",
                                }]);
                                setActiveRecallMealKey(undefined);
                                setRecallQuery("");
                                setRecallResults([]);
                              }}
                              type="button"
                            >
                              <span className="block text-sm font-black">{food.officialName}</span>
                              <span className="block text-xs text-slate-500">{food.foodGroup} &middot; {food.source.kind}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {meal.items.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-[46rem] text-left text-xs">
                        <thead>
                          <tr className="border-y border-slate-200 text-slate-500">
                            <th className="p-3">Alimento</th>
                            <th className="p-3">Quantidade</th>
                            <th className="p-3">Medida caseira</th>
                            <th className="p-3">Gramas</th>
                            {!approved ? <th className="p-3"><span className="sr-only">Ações</span></th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {meal.items.map((item) => (
                            <tr className="border-b border-slate-100 last:border-0" key={item.id}>
                              <th className="p-3 text-sm font-black text-slate-900">{item.foodName}</th>
                              <td className="p-2">
                                <div className="flex items-center gap-2">
                                  <label className="sr-only" htmlFor={`${item.id}-amount`}>Quantidade relatada de {item.foodName}</label>
                                  <NumberInput disabled={approved} id={`${item.id}-amount`} min={0} onChange={(event) => setRecallItems((items) => items.map((current) => current.id === item.id ? { ...current, amount: positive(event.target.value) } : current))} value={item.amount ?? ""} />
                                  <span className="font-bold text-slate-600">{item.unit}</span>
                                </div>
                              </td>
                              <td className="p-3 font-semibold text-slate-400">{NOT_INFORMED}</td>
                              <td className="p-3 font-black text-slate-900">
                                {item.unit === "g" && item.amount ? `${numberFormatter.format(item.amount)} g` : NOT_INFORMED}
                              </td>
                              {!approved ? <td className="p-2 text-right"><Button onClick={() => removeRecallItem(item.id)} size="small" type="button" variant="ghost">Remover</Button></td> : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="border-t border-[var(--line)] p-4 text-sm text-slate-500">
                      Adicione um alimento real para registrar esta refeição.
                    </p>
                  )}
                </section>
              ))}

              {!recallMealGroups.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum alimento quantificado neste atendimento.</p> : null}

              {!approved ? (
                <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 p-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <FormField id="new-recall-meal" label="Nova refeição">
                      <Input id="new-recall-meal" onChange={(event) => setNewRecallMealName(event.target.value)} placeholder="Nome da refeição" value={newRecallMealName} />
                    </FormField>
                  </div>
                  <Button
                    disabled={!newRecallMealName.trim()}
                    onClick={() => {
                      const name = newRecallMealName.trim();
                      if (!name) return;
                      setActiveRecallMealKey(`draft:${name}`);
                      setNewRecallMealName("");
                      setRecallQuery("");
                      setRecallResults([]);
                    }}
                    type="button"
                    variant="outline"
                  >
                    + Refeição
                  </Button>
                </div>
              ) : null}
            </div>
          </section>

          <section aria-live="polite" className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900">Estimativa da ingest&atilde;o habitual</h3>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black">
                {quantifyingRecall
                  ? "Calculando..."
                  : habitualEstimate?.confidence === "HIGH"
                    ? "Confian\u00e7a alta"
                    : habitualEstimate?.confidence === "LOW"
                      ? "Baixa confian\u00e7a"
                      : "N\u00e3o estimado"}
              </span>
            </div>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              {[
                ["Energia habitual", habitualEstimate?.totals.energyKcal, "kcal"],
                ["Prote\u00ednas", habitualEstimate?.totals.proteinGrams, "g"],
                ["Carboidratos", habitualEstimate?.totals.carbohydratesGrams, "g"],
                ["Lip\u00eddios", habitualEstimate?.totals.fatsGrams, "g"],
                ["Fibras", habitualEstimate?.totals.fiberGrams, "g"],
                ["Diferen\u00e7a para o GET", habitualGetComparison?.differenceKcal, "kcal"],
              ].map(([label, value, unit]) => (
                <div className="rounded-lg bg-white p-3" key={String(label)}>
                  <dt className="text-[10px] font-black uppercase text-slate-500">{label}</dt>
                  <dd className="mt-1 text-sm font-black">{typeof value === "number" ? `${label === "Diferen\u00e7a para o GET" ? formattedSigned(value) : numberFormatter.format(value)} ${unit}` : NOT_INFORMED}</dd>
                </div>
              ))}
            </dl>
            {habitualEstimate?.warnings.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-xs font-bold text-amber-900">{habitualEstimate?.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
            {habitualGetComparison?.warning ? <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-black text-amber-950">{habitualGetComparison?.warning}</p> : null}
          </section>

        </CardContent>
      </Card>
      ) : null}

      {activeArea === "GOALS" ? (
      <Card
        aria-labelledby="strategy-tab-GOALS"
        className="p-5"
        id="strategy-panel-GOALS"
        role="tabpanel"
        variant="outlined"
      >
        <CardHeader>
          <CardTitle>Metas</CardTitle>
          <CardDescription>Objetivo da intervenção e evolução definida pelo profissional.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <FormField error={validationErrors.objective} id="strategy-objective" label="Objetivo nutricional" required>
            <Select aria-invalid={Boolean(validationErrors.objective)} disabled={approved} id="strategy-objective" onChange={(event) => setObjective((event.target.value || undefined) as NutritionDecisionObjective | undefined)} value={objective ?? ""}>
              <option value="">Selecione</option>
              {Object.entries(NUTRITION_OBJECTIVES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </FormField>

          <section className="space-y-3 rounded-xl border border-[var(--line)] p-4" aria-labelledby="evolution-goal-title">
            <div>
              <h3 className="text-sm font-black text-slate-900" id="evolution-goal-title">Meta de evolu&ccedil;&atilde;o</h3>
              <p className="mt-1 text-xs text-slate-500">Definida exclusivamente pelo nutricionista.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField id="evolution-direction" label="Dire&ccedil;&atilde;o da meta">
                <Select disabled={approved} id="evolution-direction" onChange={(event) => setEvolutionGoal(event.target.value ? { direction: event.target.value as NutritionEvolutionGoal["direction"] } : undefined)} value={evolutionGoal?.direction ?? ""}>
                  <option value="">Selecione</option>
                  <option value="LOSS">Perda de peso/gordura</option>
                  <option value="GAIN">Ganho de peso/massa</option>
                  <option value="MAINTENANCE">Manuten&ccedil;&atilde;o</option>
                </Select>
              </FormField>
              <FormField id="evolution-target" label="Meta (kg)">
                <NumberInput disabled={approved || evolutionGoal?.direction === "MAINTENANCE"} id="evolution-target" min={0} onChange={(event) => setEvolutionGoal((current) => current ? { ...current, targetKg: positive(event.target.value) } : current)} step="0.1" value={evolutionGoal?.targetKg ?? ""} />
              </FormField>
              <FormField id="evolution-period" label="Per&iacute;odo (dias)">
                <NumberInput disabled={approved || evolutionGoal?.direction === "MAINTENANCE"} id="evolution-period" min={1} onChange={(event) => {
                  const value = positive(event.target.value);
                  setEvolutionGoal((current) => current ? { ...current, periodDays: value ? Math.round(value) : undefined } : current);
                }} value={evolutionGoal?.periodDays ?? ""} />
              </FormField>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black">Defini&ccedil;&atilde;o energ&eacute;tica</h3>
            <p className="mt-1 text-xs text-slate-600">
              GET, ajuste energ&eacute;tico e VET s&atilde;o definidos nas abas Gasto Energ&eacute;tico e Prescri&ccedil;&atilde;o. O Recordat&oacute;rio da Anamnese n&atilde;o substitui essas decis&otilde;es.
            </p>
          </section>
        </CardContent>
      </Card>
      ) : null}

      {activeArea === "ENERGY" || activeArea === "PRESCRIPTION" ? (
      <Card
        aria-labelledby={`strategy-tab-${activeArea}`}
        className="p-5"
        id={`strategy-panel-${activeArea}`}
        role="tabpanel"
        variant="outlined"
      >
        <CardHeader>
          <CardTitle>{activeArea === "ENERGY" ? "Gasto Energético" : "Prescrição"}</CardTitle>
          <CardDescription>
            {activeArea === "ENERGY"
              ? "Parâmetros energéticos reais utilizados na estratégia."
              : "Decisão profissional que orienta o Plano Alimentar."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {activeArea === "ENERGY" ? (
              <>
                <SummaryItem label="Peso utilizado" value={weightKg ? `${numberFormatter.format(weightKg)} kg` : NOT_INFORMED} />
                <SummaryItem label="TMB" value={energyValue(basalMetabolicRate)} />
              </>
            ) : null}
            {activeArea === "PRESCRIPTION" ? (
            <FormField error={validationErrors.method} id="nutrition-method" label="Padrão / método alimentar principal" required>
              <Select aria-invalid={Boolean(validationErrors.method)} disabled={approved} id="nutrition-method" onChange={(event) => setMethod((event.target.value || undefined) as NutritionMethod | undefined)} value={method ?? ""}>
                <option value="">Selecione</option>
                {NUTRITION_METHOD_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              {method ? <p className="mt-1 text-xs text-slate-500">{NUTRITION_METHOD_OPTIONS.find(([code]) => code === method)?.[2]}</p> : null}
            </FormField>
            ) : null}
            {activeArea === "ENERGY" ? (
            <FormField error={validationErrors.protocol} id="energy-protocol" label="Protocolo utilizado" required>
              <Select aria-invalid={Boolean(validationErrors.protocol)} disabled={approved} id="energy-protocol" onChange={(event) => setProtocol((event.target.value || undefined) as EnergyProtocol | undefined)} value={protocol ?? ""}>
                <option value="">Selecione o protocolo validado</option>
                {energyProtocols.map((value) => <option disabled={!availableProtocols.includes(value)} key={value} value={value}>{ENERGY_PROTOCOLS[value]}{availableProtocols.includes(value) ? "" : " · dados insuficientes"}</option>)}
              </Select>
            </FormField>
            ) : null}
            {activeArea === "ENERGY" ? (
            <FormField error={validationErrors.activityFactor} id="activity-factor" label="Fator de atividade" required={!view.energyDecision?.recordedTotalEnergyExpenditureKcal}>
              <Select
                aria-invalid={Boolean(validationErrors.activityFactor)}
                disabled={approved}
                id="activity-factor"
                onChange={(event) =>
                  setActivityFactor(positive(event.target.value))
                }
                value={activityFactor ?? ""}
              >
                <option value="">Selecione</option>
                {activityFactors.map((value) => (
                  <option key={value} value={value}>
                    {activityFactorLabels[value]}
                  </option>
                ))}
              </Select>
            </FormField>
            ) : null}
            {activeArea === "PRESCRIPTION" ? (
            <FormField error={validationErrors.adjustment} id="calorie-adjustment" label="Objetivo energético" required>
              <Select aria-invalid={Boolean(validationErrors.adjustment)} disabled={approved} id="calorie-adjustment" onChange={(event) => {
                const nextGoal = (event.target.value || undefined) as NutritionEnergyGoal | undefined;
                setEnergyGoal(nextGoal);
                if (!nextGoal) {
                  setAdjustment(undefined);
                  setManualCalories(undefined);
                } else if (nextGoal === "MANUAL_VET") {
                  setAdjustment(undefined);
                } else {
                  setManualCalories(undefined);
                  setAdjustment(defaultAdjustmentForEnergyGoal(nextGoal));
                }
                setVetDecisionState("EDITED");
              }} value={energyGoal ?? ""}>
                <option value="">Selecione</option>
                {ENERGY_GOAL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              {energyGoal ? <p className="mt-1 text-xs text-slate-500">{ENERGY_GOAL_OPTIONS.find(([code]) => code === energyGoal)?.[3]}</p> : null}
            </FormField>
            ) : null}
            {activeArea === "ENERGY" ? (
            <div className={`rounded-xl border bg-[var(--surface)] px-3 py-2 ${validationErrors.get ? "border-red-300" : "border-[var(--line)]"}`} id="strategy-get-output" tabIndex={-1}>
              <p className="text-xs font-bold text-[var(--muted)]">GET calculado</p>
              <output className="mt-1 block text-sm font-black text-[var(--text-primary)]">
                {energyValue(totalEnergyExpenditure)}
              </output>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                {view.energyDecision?.recordedTotalEnergyExpenditureKcal
                  ? "Valor real registrado no atendimento atual."
                  : "Calculado somente após protocolo e fator de atividade válidos."}
              </p>
              {validationErrors.get ? <p className="mt-1 text-xs font-bold text-red-700" role="alert">{validationErrors.get}</p> : null}
            </div>
            ) : null}
            {activeArea === "PRESCRIPTION" ? (
            energyGoal === "MANUAL_VET" ? (
            <FormField id="manual-calories" label="VET manual" help="Valor final definido pelo nutricionista; não altera o GET registrado.">
              <NumberInput
                disabled={approved}
                id="manual-calories"
                min={0}
                onChange={(event) => {
                  const nextValue = event.currentTarget.valueAsNumber;
                  setManualCalories(
                    Number.isFinite(nextValue) && nextValue > 0
                      ? nextValue
                      : undefined,
                  );
                  setVetDecisionState("EDITED");
                }}
                value={manualCalories ?? ""}
              />
            </FormField>
            ) : energyGoal && energyGoal !== "MAINTENANCE" ? (
              <FormField id="custom-energy-adjustment" label="Percentual confirmado" help="A sugestão pode ser alterada e deve ser confirmada pelo nutricionista.">
                <NumberInput
                  disabled={approved}
                  id="custom-energy-adjustment"
                  max={energyGoal.startsWith("DEFICIT") ? -0.1 : 100}
                  min={energyGoal.startsWith("DEFICIT") ? -100 : 0.1}
                  onChange={(event) => {
                    const value = event.currentTarget.valueAsNumber;
                    setAdjustment(Number.isFinite(value) ? value : undefined);
                    setVetDecisionState("EDITED");
                  }}
                  step="0.1"
                  value={adjustment ?? ""}
                />
              </FormField>
            ) : null
            ) : null}
            <div className={`rounded-xl border bg-[var(--surface)] px-3 py-2 ${validationErrors.vet ? "border-red-300" : "border-[var(--line)]"}`} id="strategy-vet-output" tabIndex={-1}>
              <p className="text-xs font-bold text-[var(--muted)]">VET utilizado</p>
              <output className="mt-1 block text-sm font-black text-[var(--text-primary)]">
                {energyValue(finalCalories)}
              </output>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                {manualCalories
                  ? "Fonte manual. Macronutrientes e refeições recalculados automaticamente."
                  : adjustment === undefined
                    ? "Selecione o déficit ou superávit para obter uma sugestão."
                    : "Sugestão calculada a partir do GET e do ajuste selecionado."}
              </p>
              {adjustment !== undefined && energyAdjustmentKcal !== undefined ? (
                <p className="mt-1 text-xs font-bold text-slate-700">
                  {adjustmentLabel(adjustment)} · {formattedSigned(energyAdjustmentKcal)} kcal
                </p>
              ) : null}
              {validationErrors.vet ? <p className="mt-1 text-xs font-bold text-red-700" role="alert">{validationErrors.vet}</p> : null}
            </div>
            {activeArea === "ENERGY" ? (
              <SummaryItem
                label="Diferença GET × VET"
                value={
                  totalEnergyExpenditure && finalCalories
                    ? `${formattedSigned(finalCalories - totalEnergyExpenditure)} kcal`
                    : NOT_INFORMED
                }
              />
            ) : null}
          </div>

          {activeArea === "ENERGY" && decision ? (
            <section
              aria-labelledby="energy-calculation-details-title"
              className="rounded-xl border border-sky-200 bg-sky-50 p-4"
            >
              <h3 className="font-black text-sky-950" id="energy-calculation-details-title">
                Memória de cálculo
              </h3>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-5">
                <SummaryItem label="Sexo" value={view.energyDecision?.sex === "FEMALE" ? "Feminino" : "Masculino"} />
                <SummaryItem label="Idade" value={view.energyDecision?.ageYears !== undefined ? `${view.energyDecision.ageYears} anos` : NOT_INFORMED} />
                <SummaryItem label="Peso" value={view.energyDecision?.weightKg ? `${numberFormatter.format(view.energyDecision.weightKg)} kg` : NOT_INFORMED} />
                <SummaryItem label="Altura" value={view.energyDecision?.heightCm ? `${numberFormatter.format(view.energyDecision.heightCm)} cm` : NOT_INFORMED} />
                <SummaryItem label="Fator de atividade" value={activityFactor ? numberFormatter.format(activityFactor) : NOT_INFORMED} />
              </dl>
              <div className="mt-3 space-y-3 text-sm text-sky-950">
                <div>
                  <p className="font-black">TMB · {decision.protocolLabel}</p>
                  <p className="mt-1 font-mono text-xs">{decision.calculationDetails.basalFormula}</p>
                  <p className="mt-1">Substituição: {decision.calculationDetails.basalSubstitution}</p>
                  <p className="font-bold">Resultado: {energyValue(decision.calculationDetails.basalResultKcal)}</p>
                </div>
                {decision.calculationDetails.getFormula ? (
                  <div>
                    <p className="font-black">GET</p>
                    <p className="mt-1 font-mono text-xs">{decision.calculationDetails.getFormula}</p>
                    <p className="mt-1">Substituição: {decision.calculationDetails.getSubstitution}</p>
                    <p className="font-bold">Resultado: {energyValue(decision.calculationDetails.getResultKcal)}</p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeArea === "ENERGY" && energyMissingData.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="status">
              <p className="font-black">Dados necessários para TMB/GET:</p>
              <ul className="mt-2 space-y-1 font-bold">
                {energyMissingData.map((item) => (
                  <li key={item}>
                    <button
                      className="rounded underline decoration-amber-500 underline-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-700"
                      onClick={() => openEnergyDataOrigin(item)}
                      type="button"
                    >
                      {item} · revisar origem
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {activeArea === "PRESCRIPTION" ? (
          <>
          <details className="rounded-xl border border-[var(--line)] p-4">
            <summary className="cursor-pointer font-black text-slate-900">Modificações nutricionais <span className="text-xs font-bold text-slate-500">({modifications.length} selecionadas)</span></summary>
            <p className="mt-2 text-xs text-slate-500">Combinações confirmadas pelo nutricionista. Nenhuma meta é aplicada automaticamente.</p>
            <p className="mt-1 text-xs text-slate-500">Proteínas, fibras e restrições de lactose possuem alternativas mutuamente exclusivas; ao escolher outra opção do mesmo grupo, a anterior será desmarcada.</p>
            {modificationConflictMessage ? <p aria-live="polite" className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900">{modificationConflictMessage}</p> : null}
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {NUTRITION_MODIFICATION_OPTIONS.map(([code, label, description]) => (
                <label className="flex min-h-16 items-start gap-3 rounded-xl border border-slate-200 p-3" key={code}>
                  <input
                    checked={modifications.includes(code)}
                    className="mt-1"
                    disabled={approved}
                    onChange={(event) => changeModification(code, event.target.checked)}
                    type="checkbox"
                  />
                  <span><span className="block text-sm font-black text-slate-900">{label}</span><span className="mt-0.5 block text-xs text-slate-500">{description}</span></span>
                </label>
              ))}
            </div>
          </details>

          <details className="rounded-xl border border-[var(--line)] p-4">
            <summary className="cursor-pointer font-black text-slate-900">Protocolo clínico <span className="text-xs font-bold text-slate-500">(opcional)</span></summary>
            <p className="mt-2 text-xs text-slate-500">Orienta alertas, parâmetros e justificativa profissional; não fecha diagnóstico nem prescreve valores.</p>
            <div className="mt-3 max-w-2xl">
              <FormField id="clinical-protocol" label="Protocolo clínico">
                <ClinicalProtocolCombobox
                  disabled={approved}
                  onChange={(nextProtocols) => {
                    setClinicalProtocols(nextProtocols);
                    if (nextProtocols.includes("OTHER")) {
                      setAdvancedConfigurationsOpen(true);
                    }
                  }}
                  value={clinicalProtocols}
                />
              </FormField>
            </div>
          </details>

          {hasConditionalConfigurations ? (
          <details className="rounded-xl border border-[var(--line)] p-4" onToggle={(event) => setAdvancedConfigurationsOpen(event.currentTarget.open)} open={advancedConfigurationsOpen}>
            <summary className="cursor-pointer font-black text-slate-900">Configurações avançadas necessárias</summary>
            <div className="mt-4 space-y-4" id="specific-configurations" tabIndex={-1}>
              {method === "TIME_RESTRICTED_EATING" ? (
                <section className="space-y-3 rounded-xl bg-slate-50 p-3">
                  <h4 className="text-sm font-black">Janela alimentar e jejum</h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <FormField id="fasting-protocol" label="Protocolo" required>
                      <Select disabled={approved} id="fasting-protocol" onChange={(event) => {
                        const protocol = (event.target.value || undefined) as FastingProtocol | undefined;
                        const durations = fastingProtocolDurations(protocol);
                        setSpecificConfigurations((current) => ({ ...current, fasting: { ...current.fasting, weekdays: current.fasting?.weekdays ?? [], protocol, ...(durations ?? {}) } }));
                      }} value={inferredFastingProtocol(specificConfigurations.fasting) ?? ""}>
                        <option value="">Selecione</option>
                        {FASTING_PROTOCOL_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                      </Select>
                    </FormField>
                    <FormField id="fasting-start-time" label="Horário inicial · início da janela alimentar" required><Input disabled={approved} id="fasting-start-time" onChange={(event) => setSpecificConfigurations((current) => ({ ...current, fasting: { ...current.fasting, weekdays: current.fasting?.weekdays ?? [], startTime: event.target.value } }))} type="time" value={specificConfigurations.fasting?.startTime ?? ""} /></FormField>
                    <FormField id="eating-window-hours" label="Duração da janela alimentar (h)" required><NumberInput disabled={approved || inferredFastingProtocol(specificConfigurations.fasting) !== "CUSTOM"} id="eating-window-hours" max={24} min={0.1} onChange={(event) => setSpecificConfigurations((current) => ({ ...current, fasting: { ...current.fasting, weekdays: current.fasting?.weekdays ?? [], eatingWindowHours: positive(event.target.value) } }))} step="0.1" value={specificConfigurations.fasting?.eatingWindowHours ?? ""} /></FormField>
                    <FormField id="fasting-window-hours" label="Duração do jejum (h)" required><NumberInput disabled={approved || inferredFastingProtocol(specificConfigurations.fasting) !== "CUSTOM"} id="fasting-window-hours" max={24} min={0.1} onChange={(event) => setSpecificConfigurations((current) => ({ ...current, fasting: { ...current.fasting, weekdays: current.fasting?.weekdays ?? [], fastingWindowHours: positive(event.target.value) } }))} step="0.1" value={specificConfigurations.fasting?.fastingWindowHours ?? ""} /></FormField>
                  </div>
                  <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
                    <SummaryItem label="Janela alimentar" value={specificConfigurations.fasting?.eatingWindowHours ? `${formatted(specificConfigurations.fasting.eatingWindowHours)} h` : NOT_INFORMED} />
                    <SummaryItem label="Jejum" value={specificConfigurations.fasting?.fastingWindowHours ? `${formatted(specificConfigurations.fasting.fastingWindowHours)} h` : NOT_INFORMED} />
                    <SummaryItem label="Fim da alimentação" value={timeAfterHours(specificConfigurations.fasting?.startTime, specificConfigurations.fasting?.eatingWindowHours) ?? NOT_INFORMED} />
                    <SummaryItem label="Intervalo completo do jejum" value={specificConfigurations.fasting?.startTime && timeAfterHours(specificConfigurations.fasting.startTime, specificConfigurations.fasting.eatingWindowHours) ? `${timeAfterHours(specificConfigurations.fasting.startTime, specificConfigurations.fasting.eatingWindowHours)}–${specificConfigurations.fasting.startTime} (dia seguinte)` : NOT_INFORMED} />
                  </div>
                  {specificConfigurations.fasting?.eatingWindowHours && specificConfigurations.fasting.fastingWindowHours && Math.abs(specificConfigurations.fasting.eatingWindowHours + specificConfigurations.fasting.fastingWindowHours - 24) > 0.001 ? <p className="text-xs font-bold text-red-700" role="alert">Janela alimentar e jejum devem totalizar 24 horas.</p> : null}
                  <WeekdaySelector disabled={approved} label="Dias da semana" onChange={(weekdays) => setSpecificConfigurations((current) => ({ ...current, fasting: { ...current.fasting, weekdays } }))} value={specificConfigurations.fasting?.weekdays ?? []} />
                </section>
              ) : null}
              {method === "CARB_CYCLING" ? (
                <section className="space-y-4 rounded-xl bg-slate-50 p-3"><h4 className="text-sm font-black">Ciclagem de carboidratos</h4>
                  <div className="grid gap-3 lg:grid-cols-3">
                    {(["LOW", "MODERATE", "HIGH"] as const).map((type) => {
                      const key = type === "LOW" ? "lowTarget" : type === "MODERATE" ? "moderateTarget" : "highTarget";
                      const target = specificConfigurations.carbohydrateCycling?.[key] ?? { mode: "GRAMS_PER_KG" as const };
                      const grams = target.value ? (target.mode === "GRAMS_PER_KG" ? (weightKg ? target.value * weightKg : undefined) : target.value) : undefined;
                      return <div className="rounded-xl border border-slate-200 bg-white p-3" key={type}>
                        <p className="mb-2 text-sm font-black">Dia {cyclingTargetLabel(type).toLowerCase()}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <FormField id={`cycling-${type}-mode`} label="Unidade"><Select disabled={approved} id={`cycling-${type}-mode`} onChange={(event) => setSpecificConfigurations((current) => ({ ...current, carbohydrateCycling: { lowDays: current.carbohydrateCycling?.lowDays ?? [], moderateDays: current.carbohydrateCycling?.moderateDays ?? [], highDays: current.carbohydrateCycling?.highDays ?? [], linkedToTraining: current.carbohydrateCycling?.linkedToTraining ?? false, ...current.carbohydrateCycling, [key]: { mode: event.target.value as "GRAMS_PER_KG" | "GRAMS", value: current.carbohydrateCycling?.[key]?.value } } }))} value={target.mode}><option value="GRAMS_PER_KG">g/kg</option><option value="GRAMS">g/dia</option></Select></FormField>
                          <FormField id={`cycling-${type}-value`} label={target.mode === "GRAMS_PER_KG" ? "Meta (g/kg)" : "Meta (g/dia)"} required><NumberInput disabled={approved} id={`cycling-${type}-value`} min={0.1} onChange={(event) => setSpecificConfigurations((current) => ({ ...current, carbohydrateCycling: { lowDays: current.carbohydrateCycling?.lowDays ?? [], moderateDays: current.carbohydrateCycling?.moderateDays ?? [], highDays: current.carbohydrateCycling?.highDays ?? [], linkedToTraining: current.carbohydrateCycling?.linkedToTraining ?? false, ...current.carbohydrateCycling, [key]: { mode: current.carbohydrateCycling?.[key]?.mode ?? "GRAMS_PER_KG", value: positive(event.target.value) } } }))} step="0.1" value={target.value ?? ""} /></FormField>
                        </div>
                        <output className="mt-2 block text-xs font-bold text-slate-600">Estimativa: {grams ? `${formatted(grams)} g/dia` : target.mode === "GRAMS_PER_KG" && !weightKg ? "peso não disponível" : NOT_INFORMED}</output>
                      </div>;
                    })}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {weekdayOptions.map(([day, label]) => <FormField id={`cycling-day-${day}`} key={day} label={label}><Select disabled={approved} id={`cycling-day-${day}`} onChange={(event) => setCarbohydrateDay(day, (event.target.value || undefined) as CarbohydrateDayType | undefined)} value={carbohydrateDayType(specificConfigurations.carbohydrateCycling, day) ?? ""}><option value="">Não classificado</option><option value="LOW">Baixo</option><option value="MODERATE">Moderado</option><option value="HIGH">Alto</option></Select></FormField>)}
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold"><input checked={specificConfigurations.carbohydrateCycling?.linkedToTraining ?? false} disabled={approved} onChange={(event) => setSpecificConfigurations((current) => ({ ...current, carbohydrateCycling: { lowDays: current.carbohydrateCycling?.lowDays ?? [], moderateDays: current.carbohydrateCycling?.moderateDays ?? [], highDays: current.carbohydrateCycling?.highDays ?? [], ...current.carbohydrateCycling, linkedToTraining: event.target.checked } }))} type="checkbox" /> Vincular aos dias de treino</label>
                  <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Resumo semanal</p><p className="mt-2 text-sm font-bold">{weekdayOptions.map(([day, label]) => `${label}: ${carbohydrateDayType(specificConfigurations.carbohydrateCycling, day) ? cyclingTargetLabel(carbohydrateDayType(specificConfigurations.carbohydrateCycling, day)!) : "—"}`).join(" · ")}</p></div>
                </section>
              ) : null}
              {method === "SPORTS_PERIODIZATION" ? (
                <section className="space-y-4 rounded-xl bg-slate-50 p-3"><h4 className="text-sm font-black">Periodização esportiva</h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <FormField id="sports-phase" label="Fase" required><Select disabled={approved} id="sports-phase" onChange={(event) => setSpecificConfigurations((current) => ({ ...current, sportsPeriodization: { trainingDays: current.sportsPeriodization?.trainingDays ?? [], restDays: current.sportsPeriodization?.restDays ?? [], competitionDays: current.sportsPeriodization?.competitionDays ?? [], ...current.sportsPeriodization, phase: event.target.value || undefined } }))} value={SPORTS_PHASE_OPTIONS.some(([code]) => code === specificConfigurations.sportsPeriodization?.phase) ? specificConfigurations.sportsPeriodization?.phase : specificConfigurations.sportsPeriodization?.phase ? "OTHER" : ""}><option value="">Selecione</option>{SPORTS_PHASE_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</Select></FormField>
                    <FormField id="sports-objective" label="Objetivo" required><Select disabled={approved} id="sports-objective" onChange={(event) => setSpecificConfigurations((current) => ({ ...current, sportsPeriodization: { trainingDays: current.sportsPeriodization?.trainingDays ?? [], restDays: current.sportsPeriodization?.restDays ?? [], competitionDays: current.sportsPeriodization?.competitionDays ?? [], ...current.sportsPeriodization, objective: event.target.value || undefined } }))} value={SPORTS_OBJECTIVE_OPTIONS.some(([code]) => code === specificConfigurations.sportsPeriodization?.objective) ? specificConfigurations.sportsPeriodization?.objective : specificConfigurations.sportsPeriodization?.objective ? "OTHER" : ""}><option value="">Selecione</option>{SPORTS_OBJECTIVE_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</Select></FormField>
                    <FormField id="sports-modality" label="Modalidade esportiva" required><Input disabled={approved} id="sports-modality" onChange={(event) => setSpecificConfigurations((current) => ({ ...current, sportsPeriodization: { trainingDays: current.sportsPeriodization?.trainingDays ?? [], restDays: current.sportsPeriodization?.restDays ?? [], competitionDays: current.sportsPeriodization?.competitionDays ?? [], ...current.sportsPeriodization, sport: event.target.value } }))} value={specificConfigurations.sportsPeriodization?.sport ?? ""} /></FormField>
                    <FormField id="sports-start-date" label="Data inicial" required><Input disabled={approved} id="sports-start-date" onChange={(event) => setSpecificConfigurations((current) => ({ ...current, sportsPeriodization: { trainingDays: current.sportsPeriodization?.trainingDays ?? [], restDays: current.sportsPeriodization?.restDays ?? [], competitionDays: current.sportsPeriodization?.competitionDays ?? [], ...current.sportsPeriodization, startDate: event.target.value } }))} type="date" value={specificConfigurations.sportsPeriodization?.startDate ?? ""} /></FormField>
                    <FormField id="sports-end-date" label="Data final" required><Input disabled={approved} id="sports-end-date" min={specificConfigurations.sportsPeriodization?.startDate} onChange={(event) => setSpecificConfigurations((current) => ({ ...current, sportsPeriodization: { trainingDays: current.sportsPeriodization?.trainingDays ?? [], restDays: current.sportsPeriodization?.restDays ?? [], competitionDays: current.sportsPeriodization?.competitionDays ?? [], ...current.sportsPeriodization, endDate: event.target.value } }))} type="date" value={specificConfigurations.sportsPeriodization?.endDate ?? ""} /></FormField>
                  </div>
                  {(specificConfigurations.sportsPeriodization?.phase === "OTHER" || (specificConfigurations.sportsPeriodization?.phase && !SPORTS_PHASE_OPTIONS.some(([code]) => code === specificConfigurations.sportsPeriodization?.phase))) ? <FormField id="sports-phase-other" label="Outra fase" required><Input disabled={approved} id="sports-phase-other" onChange={(event) => setSpecificConfigurations((current) => ({ ...current, sportsPeriodization: current.sportsPeriodization ? { ...current.sportsPeriodization, phase: "OTHER", phaseOther: event.target.value } : undefined }))} value={specificConfigurations.sportsPeriodization?.phaseOther ?? (specificConfigurations.sportsPeriodization?.phase !== "OTHER" ? specificConfigurations.sportsPeriodization?.phase : "") ?? ""} /></FormField> : null}
                  {(specificConfigurations.sportsPeriodization?.objective === "OTHER" || (specificConfigurations.sportsPeriodization?.objective && !SPORTS_OBJECTIVE_OPTIONS.some(([code]) => code === specificConfigurations.sportsPeriodization?.objective))) ? <FormField id="sports-objective-other" label="Outro objetivo" required><Input disabled={approved} id="sports-objective-other" onChange={(event) => setSpecificConfigurations((current) => ({ ...current, sportsPeriodization: current.sportsPeriodization ? { ...current.sportsPeriodization, objective: "OTHER", objectiveOther: event.target.value } : undefined }))} value={specificConfigurations.sportsPeriodization?.objectiveOther ?? (specificConfigurations.sportsPeriodization?.objective !== "OTHER" ? specificConfigurations.sportsPeriodization?.objective : "") ?? ""} /></FormField> : null}
                  <div className="grid items-start gap-3 md:grid-cols-2">
                    {weekdayOptions.map(([weekday, label]) => {
                      const day = sportsDayConfiguration(specificConfigurations.sportsPeriodization, weekday);
                      return <div className="rounded-xl border border-slate-200 bg-white p-3" key={weekday}>
                        <div className="flex items-center gap-3">
                          <label className="w-10 shrink-0 text-sm font-black text-slate-900" htmlFor={`sports-day-${weekday}`}>{label}</label>
                          <Select className="min-w-0 flex-1" disabled={approved} id={`sports-day-${weekday}`} onChange={(event) => setSportsDay(weekday, (event.target.value || undefined) as SportsDayType | undefined)} value={day?.type ?? ""}><option value="">Não classificado</option><option value="TRAINING">Treino</option><option value="REST">Descanso</option><option value="COMPETITION">Competição</option></Select>
                        </div>
                        {day?.type === "TRAINING" ? <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(8rem,1.4fr)_minmax(6.5rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.9fr)]"><FormField id={`training-type-${weekday}`} label="Tipo do treino" required><Input disabled={approved} id={`training-type-${weekday}`} onChange={(event) => updateSportsDay(weekday, { trainingType: event.target.value })} value={day.trainingType ?? ""} /></FormField><FormField id={`training-time-${weekday}`} label="Horário" required><Input disabled={approved} id={`training-time-${weekday}`} onChange={(event) => updateSportsDay(weekday, { time: event.target.value })} type="time" value={day.time ?? ""} /></FormField><FormField id={`training-duration-${weekday}`} label="Duração (min)" required><NumberInput disabled={approved} id={`training-duration-${weekday}`} min={1} onChange={(event) => updateSportsDay(weekday, { durationMinutes: positive(event.target.value) })} value={day.durationMinutes ?? ""} /></FormField><FormField id={`training-intensity-${weekday}`} label="Intensidade" required><Select disabled={approved} id={`training-intensity-${weekday}`} onChange={(event) => updateSportsDay(weekday, { intensity: (event.target.value || undefined) as SportsDayConfiguration["intensity"] })} value={day.intensity ?? ""}><option value="">Selecione</option><option value="LOW">Baixa</option><option value="MODERATE">Moderada</option><option value="HIGH">Alta</option></Select></FormField></div> : null}
                        {day?.type === "COMPETITION" ? <div className="mt-3 max-w-xs"><FormField id={`competition-time-${weekday}`} label="Horário da competição" required><Input disabled={approved} id={`competition-time-${weekday}`} onChange={(event) => updateSportsDay(weekday, { time: event.target.value })} type="time" value={day.time ?? ""} /></FormField></div> : null}
                      </div>;
                    })}
                  </div>
                  <div className="space-y-2">
                    {(["TRAINING", "REST", "COMPETITION"] as const).map((type) => <SportsNutritionTargetEditor baseEnergy={finalCalories} baseMacros={{ protein, carbohydrates, fats }} disabled={approved} key={type} label={type === "TRAINING" ? "treino" : type === "REST" ? "descanso" : "competição"} onChange={(target) => setSpecificConfigurations((current) => ({ ...current, sportsPeriodization: current.sportsPeriodization ? { ...current.sportsPeriodization, nutritionTargets: { ...current.sportsPeriodization.nutritionTargets, [type]: target } } : undefined }))} target={specificConfigurations.sportsPeriodization?.nutritionTargets?.[type] ?? {}} weightKg={weightKg} />)}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Resumo semanal</p><p className="mt-2 text-sm font-bold">{weekdayOptions.map(([weekday, label]) => { const type = sportsDayConfiguration(specificConfigurations.sportsPeriodization, weekday)?.type; return `${label}: ${type === "TRAINING" ? "Treino" : type === "REST" ? "Descanso" : type === "COMPETITION" ? "Competição" : "—"}`; }).join(" · ")}</p></div>
                </section>
              ) : null}
              {method === "KETOGENIC" ? <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><h4 className="text-sm font-black">Cetogênica</h4><FormField id="ketogenic-carb-limit" label="Limite diário de carboidratos (g)" required><NumberInput disabled={approved} id="ketogenic-carb-limit" min={0.1} onChange={(event) => setSpecificConfigurations((current) => ({ ...current, ketogenic: { monitoringAcknowledged: current.ketogenic?.monitoringAcknowledged ?? false, dailyCarbohydrateLimitGrams: positive(event.target.value) } }))} value={specificConfigurations.ketogenic?.dailyCarbohydrateLimitGrams ?? ""} /></FormField><label className="flex items-start gap-2 text-sm font-bold text-amber-950"><input checked={specificConfigurations.ketogenic?.monitoringAcknowledged ?? false} disabled={approved} onChange={(event) => setSpecificConfigurations((current) => ({ ...current, ketogenic: { dailyCarbohydrateLimitGrams: current.ketogenic?.dailyCarbohydrateLimitGrams, monitoringAcknowledged: event.target.checked } }))} type="checkbox" /> Confirmo a necessidade de acompanhamento clínico e nutricional.</label></section> : null}
              {modifications.includes("LOW_FODMAP") ? <section className="rounded-xl bg-slate-50 p-3"><FormField id="low-fodmap-phase" label="Fase Low FODMAP" required><Select disabled={approved} id="low-fodmap-phase" onChange={(event) => setSpecificConfigurations((current) => ({ ...current, lowFodmap: { phase: (event.target.value || undefined) as "RESTRICTION" | "REINTRODUCTION" | "PERSONALIZATION" | undefined } }))} value={specificConfigurations.lowFodmap?.phase ?? ""}><option value="">Selecione</option><option value="RESTRICTION">Restrição</option><option value="REINTRODUCTION">Reintrodução</option><option value="PERSONALIZATION">Personalização</option></Select></FormField></section> : null}
              {method === "VEGETARIAN" || method === "OVO_LACTO_VEGETARIAN" || method === "VEGAN" ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-950" role="alert">Avaliar profissionalmente proteínas, ferro, vitamina B12, cálcio, vitamina D, zinco e ômega-3 conforme o padrão selecionado. Nenhuma suplementação será criada automaticamente.</p> : null}
              {clinicalProtocols.includes("RENAL_DISEASE") ? <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><h4 className="text-sm font-black">Parâmetros renais configuráveis</h4><p className="text-xs">Preencha somente valores definidos pelo nutricionista; nenhum campo recebe valor presumido.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{([ ["proteinGrams", "Proteína (g)"], ["sodiumMg", "Sódio (mg)"], ["potassiumMg", "Potássio (mg)"], ["phosphorusMg", "Fósforo (mg)"], ["fluidsMl", "Líquidos (ml)"] ] as const).map(([key, label]) => <FormField id={`renal-${key}`} key={key} label={label}><NumberInput disabled={approved} id={`renal-${key}`} min={0.1} onChange={(event) => setSpecificConfigurations((current) => ({ ...current, renal: { ...current.renal, [key]: positive(event.target.value) } }))} value={specificConfigurations.renal?.[key] ?? ""} /></FormField>)}</div></section> : null}
              {clinicalProtocols.includes("OTHER") ? <FormField id="other-protocol-description" label="Descrição do protocolo" required><Textarea disabled={approved} id="other-protocol-description" onChange={(event) => setSpecificConfigurations((current) => ({ ...current, otherProtocolDescription: event.target.value }))} value={specificConfigurations.otherProtocolDescription ?? ""} /></FormField> : null}
            </div>
          </details>
          ) : null}

          <details className="rounded-xl border border-[var(--line)] p-4">
          <summary className="cursor-pointer font-black text-slate-900">Macronutrientes, refeições e metas complementares</summary>
          <div className="mt-4 space-y-5">
          <section aria-labelledby="macronutrients-title">
            <div className="mb-1">
              <h3
                className="text-base font-black text-[var(--text-primary)]"
                id="macronutrients-title"
                tabIndex={-1}
              >
                Macronutrientes
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Escolha um único modo por macronutriente. Gramas e kcal são calculadas automaticamente.
              </p>
              <p className="mt-1 text-xs font-bold text-slate-600">Estas são as metas gerais da estratégia. Quando houver periodização, metas específicas de treino, descanso ou competição substituem estes valores nos respectivos dias.</p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <div className="hidden min-w-[46rem] grid-cols-[minmax(7rem,0.8fr)_minmax(9rem,1fr)_minmax(7rem,0.8fr)_minmax(8rem,0.9fr)_minmax(7rem,0.8fr)] gap-3 border-b border-slate-200 px-2 pb-2 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500 lg:grid"><span>Nutriente</span><span>Modo</span><span>Meta</span><span>Gramas calculadas</span><span>kcal calculadas</span></div>
              <div className="min-w-0 lg:min-w-[46rem]">
                <MacroEditor calculated={proteinCalculation} disabled={approved} error={validationErrors.protein} input={protein} label="Proteínas" onChange={setProtein} />
                <MacroEditor calculated={carbohydratesCalculation} disabled={approved} error={validationErrors.carbohydrates} input={carbohydrates} label="Carboidratos" onChange={setCarbohydrates} />
                <MacroEditor calculated={fatsCalculation} disabled={approved} error={validationErrors.fats} input={fats} label="Lipídios" onChange={setFats} />
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-live="polite">
              <div className={`rounded-lg px-3 py-2 text-xs font-bold ${allGeneralMacrosInPercentage && generalPercentageTotal !== undefined && Math.abs(generalPercentageTotal - 100) < 0.01 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                {allGeneralMacrosInPercentage && generalPercentageTotal !== undefined ? <><p>Soma dos percentuais: {formattedPercentage(generalPercentageTotal)}%</p><p className="mt-1">{Math.abs(generalPercentageTotal - 100) < 0.01 ? "Distribuição completa: 100%" : `Atenção: a distribuição difere de 100% em ${formattedPercentage(Math.abs(100 - generalPercentageTotal))} ponto(s) percentual(is). Os valores foram preservados.`}</p></> : <p>Conferência percentual disponível quando todos os macronutrientes estiverem no modo percentual.</p>}
              </div>
              <div className={`rounded-lg px-3 py-2 text-xs font-bold ${macroValidation?.status === "ADEQUATE" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                <p>Total calórico calculado: {generalCalculatedCalories !== undefined ? `${formatted(generalCalculatedCalories)} kcal` : NOT_INFORMED}</p>
                <p className="mt-1">VET informado: {finalCalories ? `${formatted(finalCalories)} kcal` : NOT_INFORMED}{generalCalorieDifference !== undefined ? ` · Diferença: ${generalCalorieDifference > 0 ? "+" : ""}${formattedPercentage(generalCalorieDifference)} kcal` : ""}</p>
                <p className="mt-1">{macroValidation ? `${macroStatusLabels[macroValidation.status]}. Tolerância para finalizar: diferença energética de até 2% do VET.` : "Preencha os macronutrientes para validar a distribuição energética."}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--line)] p-4" aria-labelledby="meal-organization-title">
            <div className="mb-3">
              <h3 className="text-sm font-black text-slate-900" id="meal-organization-title">
                Organização alimentar
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Defina somente a quantidade de refeições. Horários e alimentos serão organizados no Plano Alimentar.
              </p>
              {method === "TIME_RESTRICTED_EATING" ? <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900">No jejum intermitente, as refeições deverão ser distribuídas dentro da janela alimentar definida.</p> : null}
            </div>
            <div className="max-w-[12rem]">
              <FormField error={validationErrors.meals} id="strategy-meals" label="Número de refeições" required>
                <NumberInput aria-invalid={Boolean(validationErrors.meals)} disabled={approved} id="strategy-meals" inputMode="numeric" min={1} onChange={(event) => {
                  const value = positive(event.target.value);
                  const nextMealCount =
                    value && Number.isInteger(value) ? value : undefined;
                  setMealCount(nextMealCount);
                  setMealDistribution(equalMealDistribution(nextMealCount));
                }} onKeyDown={(event) => { if ([".", ",", "-", "+", "e", "E"].includes(event.key)) event.preventDefault(); }} step={1} value={mealCount ?? ""} />
              </FormField>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--line)] p-4" aria-labelledby="hydration-goal-title">
            <div className="mb-3">
              <h3 className="text-sm font-black text-slate-900" id="hydration-goal-title">
                Metas de fibras e hidratação
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                A referência hídrica considera o peso registrado. A meta confirmada permanece manual e sob responsabilidade do nutricionista; fibras e hidratação não são aplicadas automaticamente.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {hasFluidRestriction ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-950" role="status"><p className="text-xs font-black">Restrição hídrica selecionada</p><p className="mt-1 text-xs font-bold">Meta hídrica deve ser definida individualmente conforme condição clínica e orientação profissional.</p></div> : <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
                <p className="text-xs font-bold text-[var(--muted)]">Sugestão hídrica</p>
                <output className="mt-1 block text-sm font-black text-[var(--text-primary)]">
                  {suggestedWaterMl
                    ? `${numberFormatter.format(suggestedWaterMl)} ml/dia`
                    : NOT_INFORMED}
                </output>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  {weightKg && waterCoefficientMlPerKg
                    ? `${numberFormatter.format(weightKg)} kg × ${waterCoefficientMlPerKg} ml/kg`
                    : "Peso ou idade não informado no Prontuário Mestre."}
                </p>
              </div>}
              <FormField error={validationErrors.fiber} id="fiber-goal" label="Meta diária de fibras (g)" required>
                <NumberInput
                  aria-invalid={Boolean(validationErrors.fiber)}
                  disabled={approved}
                  id="fiber-goal"
                  min={1}
                  onChange={(event) =>
                    setFiberGrams(positive(event.currentTarget.value))
                  }
                  value={fiberGrams ?? ""}
                />
              </FormField>
              <FormField error={hasFluidRestriction ? undefined : validationErrors.water} id="water-goal" label={hasFluidRestriction ? "Meta hídrica individual (ml) — opcional" : "Meta hídrica confirmada (ml)"} required={!hasFluidRestriction}>
                <NumberInput
                  aria-invalid={Boolean(!hasFluidRestriction && validationErrors.water)}
                  disabled={approved}
                  id="water-goal"
                  min={1}
                  onChange={(event) =>
                    setWaterMl(positive(event.currentTarget.value))
                  }
                  value={waterMl ?? ""}
                />
              </FormField>
            </div>
          </section>

          {scheduleCorrection && approved ? (
            <section
              aria-labelledby="daily-meal-distribution-title"
              className="scroll-mt-24 rounded-xl border border-amber-300 bg-amber-50 p-4"
              id="daily-meal-distribution"
            >
              <h3
                className="text-base font-black text-amber-950"
                id="daily-meal-distribution-title"
              >
                Distribuição diária — correção de horários
              </h3>
              <p className="mt-1 text-sm text-amber-900">
                A Estratégia permanece concluída. Somente os horários abaixo
                serão atualizados, com registro de data, profissional,
                atendimento e alterações no histórico.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {presentedMealDistribution.map((meal) => (
                  <FormField
                    id={`schedule-correction-${meal.mealNumber}`}
                    key={meal.mealNumber}
                    label={meal.name}
                    required
                  >
                    <Input
                      id={`schedule-correction-${meal.mealNumber}`}
                      onChange={(event) =>
                        setMealDistribution((current) =>
                          current.map((item) =>
                            item.mealNumber === meal.mealNumber
                              ? { ...item, time: event.target.value }
                              : item,
                          ),
                        )
                      }
                      required
                      type="time"
                      value={meal.time}
                    />
                  </FormField>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  disabled={
                    savingMealSchedules ||
                    presentedMealDistribution.some((meal) => !meal.time)
                  }
                  onClick={() => void saveApprovedMealSchedules()}
                  type="button"
                >
                  {savingMealSchedules
                    ? "Salvando horários..."
                    : "Salvar horários e voltar ao Plano Alimentar"}
                </Button>
                <p aria-live="polite" className="text-sm font-bold text-amber-950">
                  {message}
                </p>
              </div>
            </section>
          ) : null}

          {mealDistribution.length ? (
            <section aria-hidden="true" className="hidden">
              <div className="border-b border-[var(--line)] bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                  Distribuição das Refeições
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Defina nome, horário e participação no VET. As kcal são calculadas automaticamente.
                </p>
              </div>
              <table className="min-w-[48rem] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="p-3">Refeição</th>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Horário</th>
                    <th className="p-3">% do VET</th>
                    <th className="p-3">Meta calculada</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedMealDistribution.map((meal) => (
                    <tr className="border-b border-slate-100 last:border-0" key={meal.mealNumber}>
                      <th className="p-3 font-black">Refeição {meal.mealNumber}</th>
                      <td className="p-2">
                        <label className="sr-only" htmlFor={`meal-${meal.mealNumber}-name`}>
                          Nome da refeição {meal.mealNumber}
                        </label>
                        <Input
                          disabled={approved}
                          id={`meal-${meal.mealNumber}-name`}
                          onChange={(event) =>
                            setMealDistribution((current) =>
                              current.map((item) =>
                                item.mealNumber === meal.mealNumber
                                  ? { ...item, name: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          value={meal.name}
                        />
                      </td>
                      <td className="p-2">
                        <label className="sr-only" htmlFor={`meal-${meal.mealNumber}-time`}>
                          Horário da refeição {meal.mealNumber}
                        </label>
                        <Input
                          disabled={approved}
                          id={`meal-${meal.mealNumber}-time`}
                          onChange={(event) =>
                            setMealDistribution((current) =>
                              current.map((item) =>
                                item.mealNumber === meal.mealNumber
                                  ? { ...item, time: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          type="time"
                          value={meal.time}
                        />
                      </td>
                      <td className="p-2">
                        <label className="sr-only" htmlFor={`meal-${meal.mealNumber}-vet`}>
                          Percentual do VET da refeição {meal.mealNumber}
                        </label>
                        <div className="flex items-center gap-1">
                          <NumberInput
                            disabled={approved}
                            id={`meal-${meal.mealNumber}-vet`}
                            max={100}
                            min={0}
                            onChange={(event) => {
                              const vetPercentage =
                                Number(event.target.value) || 0;
                              setMealDistribution((current) =>
                                current.map((item) =>
                                  item.mealNumber === meal.mealNumber
                                    ? { ...item, vetPercentage }
                                    : item,
                                ),
                              );
                            }}
                            step="0.1"
                            value={meal.vetPercentage}
                          />
                          <span aria-hidden="true">%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <output className="font-black text-slate-900">
                          {finalCalories
                            ? `${formatted(meal.plannedCaloriesKcal)} kcal`
                            : NOT_INFORMED}
                        </output>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                aria-live="polite"
                className={`grid gap-2 border-t px-4 py-3 text-sm sm:grid-cols-2 ${
                  mealDistributionValid
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                <p>
                  Total distribuído:{" "}
                  <strong>{formattedPercentage(distributedTotal)}%</strong>
                </p>
                <p>
                  {mealDistributionValid
                    ? "Distribuição completa."
                    : distributionDifference < 0
                      ? `Faltam: ${formattedPercentage(Math.abs(distributionDifference))}%`
                      : `Excede: ${formattedPercentage(distributionDifference)}%`}
                </p>
              </div>
              {validationErrors.distribution ? (
                <p className="border-t border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700" role="alert">
                  {validationErrors.distribution}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-xl border border-[var(--line)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Suplementação (opcional)</h3>
                <p className="mt-1 text-xs text-slate-500">Itens persistidos como parte da Estratégia Nutricional.</p>
              </div>
              <Button
                disabled={approved}
                onClick={() =>
                  setSupplementation((items) => [
                    ...items,
                    {
                      id: `supplement-${Date.now()}`,
                      name: "",
                      objective: "",
                      schedule: "",
                      observations: "",
                    },
                  ])
                }
                size="small"
                type="button"
                variant="outline"
              >
                Adicionar suplemento
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {supplementation.length ? (
                supplementation.map((item) => (
                  <div className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2" key={item.id}>
                    <FormField id={`${item.id}-name`} label="Suplemento">
                      <Input disabled={approved} id={`${item.id}-name`} onChange={(event) => setSupplementation((items) => items.map((current) => current.id === item.id ? { ...current, name: event.target.value } : current))} value={item.name} />
                    </FormField>
                    <FormField id={`${item.id}-objective`} label="Objetivo">
                      <Input disabled={approved} id={`${item.id}-objective`} onChange={(event) => setSupplementation((items) => items.map((current) => current.id === item.id ? { ...current, objective: event.target.value } : current))} value={item.objective} />
                    </FormField>
                    <FormField id={`${item.id}-schedule`} label="Horário">
                      <Input disabled={approved} id={`${item.id}-schedule`} onChange={(event) => setSupplementation((items) => items.map((current) => current.id === item.id ? { ...current, schedule: event.target.value } : current))} value={item.schedule} />
                    </FormField>
                    <FormField id={`${item.id}-observations`} label="Observações">
                      <Input disabled={approved} id={`${item.id}-observations`} onChange={(event) => setSupplementation((items) => items.map((current) => current.id === item.id ? { ...current, observations: event.target.value } : current))} value={item.observations} />
                    </FormField>
                    <div className="md:col-span-2 md:text-right">
                      <Button disabled={approved} onClick={() => setSupplementation((items) => items.filter((current) => current.id !== item.id))} size="small" type="button" variant="ghost">
                        Excluir suplemento
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs font-semibold text-slate-500">Nenhum suplemento incluído.</p>
              )}
            </div>
          </section>

          <FormField id="clinical-observations" label="Justificativa / conduta profissional">
            <Textarea disabled={approved} id="clinical-observations" onChange={(event) => setClinicalObservations(event.target.value)} value={clinicalObservations} />
          </FormField>
          </div>
          </details>
          </>
          ) : null}

        </CardContent>
      </Card>
      ) : null}

      <Card className="p-5" variant="outlined">
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              disabled={saveState === "SAVING"}
              onClick={() =>
                router.push(
                  nutritionClinicalFlowHref("ASSESSMENT_SUMMARY", {
                    patientId: view.patientId,
                    attendanceId: view.attendanceId,
                  }),
                )
              }
              type="button"
              variant="ghost"
            >
              Voltar
            </Button>
            {approved ? (
              <>
                <Button disabled={saveState === "SAVING"} onClick={() => send("POST", { action: "EDIT" })} type="button" variant="outline">
                  Editar estratégia
                </Button>
                <Button
                  onClick={() =>
                    router.push(
                      nutritionClinicalFlowHref("MEAL_PLAN", {
                        patientId: view.patientId,
                        attendanceId: view.attendanceId,
                      }),
                    )
                  }
                  type="button"
                >
                  Ir para Plano Alimentar
                </Button>
              </>
            ) : (
              <>
                <Button disabled={saveState === "SAVING" || autoSaveState === "SAVING"} onClick={() => send("PUT", draft)} type="button" variant="outline">
                  Salvar estratégia
                </Button>
                <Button disabled={saveState === "SAVING" || autoSaveState === "SAVING"} onClick={finalizeStrategy} type="button">
                  Finalizar estratégia
                </Button>
              </>
            )}
          </div>
          <div aria-live="polite">
            {!approved && autoSaveState !== "IDLE" ? (
              <p className={`mb-1 text-xs font-bold ${autoSaveState === "ERROR" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                {autoSaveState === "PENDING"
                  ? "Alterações protegidas localmente. Autosave pendente…"
                  : autoSaveState === "SAVING"
                    ? "Salvando rascunho automaticamente…"
                    : autoSaveState === "SAVED"
                      ? "Rascunho salvo automaticamente."
                      : "Autosave indisponível. As alterações continuam protegidas neste navegador."}
              </p>
            ) : null}
            {message ? (
              <p className={`text-xs font-bold ${saveState === "ERROR" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                {message}
              </p>
            ) : !approved && approvalIssues.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
                <p className="font-black">
                  Para aprovar a Estratégia, conclua:
                </p>
                <ul className="mt-2 space-y-1 font-bold">
                  {approvalIssues.map((issue) => (
                    <li key={issue}>
                      <button
                        className="rounded text-left underline decoration-amber-500 underline-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-700"
                        onClick={() => focusApprovalIssue(issue)}
                        type="button"
                      >
                        {issue}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
