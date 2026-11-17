"use client";

import { useEffect, useState } from "react";

import {
  Badge,
  Card,
  CardDescription,
  CardTitle,
  StatusBadge,
} from "@/components/ui";
import type {
  ClinicalEngineSection,
  ClinicalEngineView,
  NutritionCompatibilityStatus,
  NutritionDecisionPriority,
} from "@/features/clinical-engine/contracts";
import { analyzeNutritionDecision } from "@/features/clinical-engine/decision-rules";
import { nutritionMethodOptions } from "@/features/nutrition-strategy/mock-data";
import { mockNutritionStrategySelectionAdapter } from "@/features/nutrition-strategy/mock-selection-adapter";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});
const number = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

const sectionStatus = {
  COMPLETE: { label: "Dados disponíveis", badge: "completed" as const },
  PENDING: { label: "Dados pendentes", badge: "pending" as const },
  RESTRICTED: { label: "Acesso restrito", badge: "unavailable" as const },
};

const priorityLabel: Readonly<
  Record<
    NutritionDecisionPriority,
    { readonly label: string; readonly tone: "danger" | "warning" | "neutral" }
  >
> = {
  HIGH: { label: "Alta", tone: "danger" },
  MEDIUM: { label: "Média", tone: "warning" },
  LOW: { label: "Baixa", tone: "neutral" },
};

const compatibilityLabel: Readonly<
  Record<
    NutritionCompatibilityStatus,
    {
      readonly label: string;
      readonly marker: string;
      readonly tone: "success" | "warning" | "danger" | "neutral";
    }
  >
> = {
  COMPATIBLE: { label: "Compatível", marker: "✓", tone: "success" },
  REVIEW: { label: "Revisar", marker: "⚠", tone: "warning" },
  DIVERGENT: { label: "Divergente", marker: "×", tone: "danger" },
  UNAVAILABLE: {
    label: "Dados insuficientes",
    marker: "—",
    tone: "neutral",
  },
};

function formatValue(value: number | string | undefined, unit?: string) {
  if (value === undefined) return "Não registrado";
  const formatted = typeof value === "number" ? number.format(value) : value;
  return `${formatted}${unit ? ` ${unit}` : ""}`;
}

function numericValue(input: string | undefined) {
  if (!input) return undefined;
  const match = input.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

type LegacyPreviewState = "NONE" | "DISCARDED" | "IGNORED";

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function isIncompatibleLocalPreview(raw: string) {
  try {
    const preview = objectValue(JSON.parse(raw));
    if (!preview) return true;
    if (preview.nutritionDataVersion === 1 || preview.demonstrative === true) {
      return true;
    }
    if (
      typeof preview.nutritionDataVersion !== "number" ||
      preview.nutritionDataVersion < 2 ||
      !Array.isArray(preview.meals)
    ) {
      return true;
    }

    const foods = preview.meals.flatMap((meal) => {
      const candidate = objectValue(meal);
      return candidate && Array.isArray(candidate.foods) ? candidate.foods : [];
    });
    if (!foods.length) return true;

    return foods.some((food) => {
      const candidate = objectValue(food);
      return (
        !candidate ||
        typeof candidate.catalogFoodId !== "string" ||
        !candidate.catalogFoodId.trim() ||
        "scientificLibraryItemId" in candidate
      );
    });
  } catch {
    return true;
  }
}

function discardIncompatibleLocalPreview(
  view: ClinicalEngineView,
): LegacyPreviewState {
  const entries = [
    {
      storage: window.localStorage,
      key: `saulo-ai:meal-plan-draft:v2:${view.patientId}:${view.masterRecordId}:${view.scenario}`,
    },
    {
      storage: window.sessionStorage,
      key: `saulo-ai:assisted-meal-preview:${view.patientId}:${view.scenario}`,
    },
  ] as const;
  let state: LegacyPreviewState = "NONE";

  for (const { storage, key } of entries) {
    try {
      const raw = storage.getItem(key);
      if (!raw || !isIncompatibleLocalPreview(raw)) continue;
      state = "IGNORED";
      storage.removeItem(key);
      state = "DISCARDED";
    } catch {
      state = "IGNORED";
    }
  }

  return state;
}

function localDecisionView(view: ClinicalEngineView): ClinicalEngineView {
  const context = view.runtimeContext;
  const initialStrategy = context.initialStrategy;
  const initialPlan = context.initialPlan;
  if (!initialStrategy && !initialPlan) return view;

  const savedStrategy = initialStrategy
    ? (mockNutritionStrategySelectionAdapter.read(
        view.patientId,
        view.scenario,
      ) ?? initialStrategy)
    : undefined;
  const savedPlan = initialPlan;
  const planStatus = savedPlan?.status;
  const planMeals =
    savedPlan?.meals.map((meal) => ({
        id: meal.id,
        name: meal.name,
        time: meal.time,
        foodCount: meal.foods.length,
      })) ?? [];
  const analyzedAt = new Date().toISOString();
  const analysis = analyzeNutritionDecision({
    objective: context.objective,
    strategy: savedStrategy
      ? {
          status: context.initialStrategyStatus ?? "DRAFT",
          objective: savedStrategy.objectiveMain,
          calories: savedStrategy.targetCalories,
          proteinGrams: savedStrategy.protein.grams,
          carbohydratesGrams: savedStrategy.carbohydrates.grams,
          fatsGrams: savedStrategy.fats.grams,
        }
      : undefined,
    mealPlan: savedPlan
      ? {
          status: planStatus ?? savedPlan.status,
          objective:
            savedStrategy?.objectiveMain ??
            savedPlan.summary.primaryObjective,
          calories: numericValue(savedPlan.summary.plannedCalories),
          proteinGrams: numericValue(savedPlan.summary.protein),
          carbohydratesGrams: numericValue(savedPlan.summary.carbohydrates),
          fatsGrams: numericValue(savedPlan.summary.fats),
          meals: planMeals,
        }
      : undefined,
    anthropometry: context.anthropometry,
    supplementCount: context.supplementCount,
    analyzedAt,
  });
  const method = savedStrategy
    ? (nutritionMethodOptions.find(
        ([key]) => key === savedStrategy.method,
      )?.[1] ?? savedStrategy.method)
    : undefined;
  const sections = view.sections.map((section) => {
    if (section.id === "current-strategy" && savedStrategy) {
      const currentStatus = section.metrics.find(
        (item) => item.label === "Estado",
      );
      return {
        ...section,
        metrics: [
          currentStatus ?? {
            label: "Estado",
            value: context.initialStrategyStatus ?? "DRAFT",
          },
          { label: "Método", value: method ?? "Não registrado" },
          {
            label: "Energia",
            value: `${number.format(savedStrategy.targetCalories)} kcal`,
          },
          {
            label: "Proteína",
            value: `${number.format(savedStrategy.protein.grams)} g`,
          },
          {
            label: "Carboidratos",
            value: `${number.format(savedStrategy.carbohydrates.grams)} g`,
          },
          {
            label: "Lipídios",
            value: `${number.format(savedStrategy.fats.grams)} g`,
          },
        ],
      };
    }
    if (section.id === "meal-plan" && savedPlan) {
      return {
        ...section,
        status: planMeals.length ? ("COMPLETE" as const) : ("PENDING" as const),
        metrics: [
          {
            label: "Estado",
            value: planStatus ?? savedPlan.status,
          },
          { label: "Refeições", value: String(planMeals.length) },
          {
            label: "Energia",
            value: savedPlan.summary.plannedCalories,
          },
          {
            label: "Proteína",
            value: savedPlan.summary.protein,
          },
          {
            label: "Carboidratos",
            value: savedPlan.summary.carbohydrates,
          },
          {
            label: "Lipídios",
            value: savedPlan.summary.fats,
          },
        ],
        items: planMeals.map(
          (meal) =>
            `${meal.time} · ${meal.name} · ${meal.foodCount} alimento(s)`,
        ),
      };
    }
    if (section.id === "alerts") {
      return {
        ...section,
        metrics: [
          {
            label: "Alta prioridade",
            value: String(
              analysis.alerts.filter((item) => item.priority === "HIGH")
                .length,
            ),
          },
          {
            label: "Média prioridade",
            value: String(
              analysis.alerts.filter((item) => item.priority === "MEDIUM")
                .length,
            ),
          },
          {
            label: "Baixa prioridade",
            value: String(
              analysis.alerts.filter((item) => item.priority === "LOW")
                .length,
            ),
          },
        ],
      };
    }
    if (section.id === "assisted-suggestions") {
      return {
        ...section,
        metrics: [
          {
            label: "Sugestões disponíveis",
            value: String(analysis.suggestions.length),
          },
          {
            label: "Decisão final",
            value: "Exclusiva do nutricionista",
          },
        ],
      };
    }
    return section;
  });
  return {
    ...view,
    sections,
    comparisons: analysis.comparisons,
    alerts: analysis.alerts,
    priorities: analysis.priorities,
    suggestions: analysis.suggestions,
    timeline: view.timeline,
    analysisAudit: {
      analyzedAt,
      engineVersion: view.analysisAudit.engineVersion,
      strategyReference: savedStrategy
        ? `${savedStrategy.masterRecordId}:${savedStrategy.updatedAt}`
        : undefined,
      mealPlanReference: savedPlan
        ? `${savedPlan.id}:${savedPlan.updatedAt}`
        : undefined,
    },
  };
}

function InformationCard({ item }: { item: ClinicalEngineSection }) {
  const currentStatus = sectionStatus[item.status];
  return (
    <Card
      aria-labelledby={`clinical-engine-${item.id}`}
      className="min-w-0 p-4 sm:p-5"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle id={`clinical-engine-${item.id}`}>
            {item.title}
          </CardTitle>
          <CardDescription>{item.description}</CardDescription>
        </div>
        <StatusBadge
          label={currentStatus.label}
          status={currentStatus.badge}
        />
      </header>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {item.metrics.map((entry) => (
          <div
            className={`min-w-0 rounded-[var(--radius-medium)] border p-3 ${
              entry.pending
                ? "border-amber-200 bg-amber-50"
                : "border-[var(--line)] bg-[var(--surface-elevated)]"
            }`}
            key={entry.label}
          >
            <dt className="text-xs font-bold text-[var(--muted)]">
              {entry.label}
            </dt>
            <dd className="mt-1 break-words text-sm font-black text-[var(--text-primary)]">
              {entry.value}
            </dd>
          </div>
        ))}
      </dl>

      {item.items?.length ? (
        <ul className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-sm text-[var(--text-secondary)]">
          {item.items.map((entry, index) => (
            <li
              className="flex min-w-0 gap-2 break-words"
              key={`${item.id}-${index}`}
            >
              <span aria-hidden="true" className="text-[var(--primary)]">
                •
              </span>
              <span>{entry}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function StrategyComparison({ view }: { view: ClinicalEngineView }) {
  return (
    <Card
      aria-labelledby="nutrition-strategy-comparison"
      className="p-4 sm:p-5"
    >
      <CardTitle id="nutrition-strategy-comparison">
        Objetivo → Estratégia → Plano
      </CardTitle>
      <CardDescription>
        Comparação explicável com as tolerâncias já utilizadas pelo Plano
        Alimentar. Nenhum valor é alterado pelo motor.
      </CardDescription>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {view.comparisons.map((item) => {
          const status = compatibilityLabel[item.status];
          return (
            <article
              className="rounded-[var(--radius-medium)] border border-[var(--line)] bg-[var(--surface-elevated)] p-3"
              key={item.id}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-black text-[var(--text-primary)]">
                  {item.label}
                </h3>
                <Badge tone={status.tone}>
                  <span aria-hidden="true">{status.marker}</span>
                  {status.label}
                </Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="font-bold text-[var(--muted)]">Estratégia</dt>
                  <dd className="mt-1 font-black text-[var(--text-primary)]">
                    {formatValue(item.target, item.unit)}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--muted)]">Plano</dt>
                  <dd className="mt-1 font-black text-[var(--text-primary)]">
                    {formatValue(item.current, item.unit)}
                  </dd>
                </div>
              </dl>
              {item.difference !== undefined ? (
                <p className="mt-2 text-xs font-bold text-[var(--text-secondary)]">
                  Diferença: {item.difference > 0 ? "+" : ""}
                  {number.format(item.difference)} {item.unit} · Adequação:{" "}
                  {number.format(item.adequacyPercentage ?? 0)}%
                </p>
              ) : null}
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                {item.explanation}
              </p>
            </article>
          );
        })}
      </div>
    </Card>
  );
}

function AlertsCard({ view }: { view: ClinicalEngineView }) {
  return (
    <Card aria-labelledby="nutrition-alerts" className="p-4 sm:p-5">
      <CardTitle id="nutrition-alerts">Alertas</CardTitle>
      <CardDescription>
        Prioridades nutricionais ordenadas para revisão. Elas não modificam o
        plano.
      </CardDescription>
      {view.alerts.length ? (
        <ol className="mt-4 space-y-3">
          {view.alerts.map((item) => {
            const priority = priorityLabel[item.priority];
            return (
              <li
                className="rounded-[var(--radius-medium)] border border-[var(--line)] p-3"
                key={item.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-[var(--text-primary)]">
                    {item.title}
                  </h3>
                  <Badge tone={priority.tone}>
                    Prioridade {priority.label}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {item.description}
                </p>
                <p className="mt-2 text-xs font-bold text-[var(--muted)]">
                  Origem: {item.source}
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 rounded-[var(--radius-medium)] bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
          Nenhuma inconsistência objetiva foi identificada nos dados
          disponíveis.
        </p>
      )}
    </Card>
  );
}

function SuggestionsCard({ view }: { view: ClinicalEngineView }) {
  return (
    <Card aria-labelledby="assisted-suggestions" className="p-4 sm:p-5">
      <CardTitle id="assisted-suggestions">Sugestões Assistidas</CardTitle>
      <CardDescription>
        Sugestões do SAULO AI com motivo, dados utilizados e gatilho visíveis.
        A decisão final permanece com o nutricionista.
      </CardDescription>
      {view.suggestions.length ? (
        <div className="mt-4 space-y-3">
          {view.suggestions.map((item) => {
            const priority = priorityLabel[item.priority];
            return (
              <article
                className="rounded-[var(--radius-medium)] border border-emerald-200 bg-emerald-50/50 p-3"
                key={item.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-emerald-950">
                    {item.title}
                  </h3>
                  <Badge tone={priority.tone}>{priority.label}</Badge>
                </div>
                <dl className="mt-3 space-y-2 text-xs leading-5">
                  <div>
                    <dt className="font-black text-[var(--text-secondary)]">
                      Por que apareceu?
                    </dt>
                    <dd className="text-[var(--text-secondary)]">
                      {item.reason}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-black text-[var(--text-secondary)]">
                      Dados utilizados
                    </dt>
                    <dd className="text-[var(--text-secondary)]">
                      {item.dataUsed.join(" · ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-black text-[var(--text-secondary)]">
                      Informação que gerou o alerta
                    </dt>
                    <dd className="text-[var(--text-secondary)]">
                      {item.trigger}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-[var(--radius-medium)] bg-slate-50 p-3 text-sm text-slate-700">
          Nenhuma sugestão assistida foi gerada com os dados disponíveis.
        </p>
      )}
    </Card>
  );
}

function Timeline({ view }: { view: ClinicalEngineView }) {
  return (
    <Card aria-labelledby="nutrition-decision-timeline" className="p-4 sm:p-5">
      <CardTitle id="nutrition-decision-timeline">
        Linha do tempo clínica
      </CardTitle>
      <CardDescription>
        Somente eventos existentes no Prontuário Mestre, em ordem cronológica.
      </CardDescription>
      {view.timeline.length ? (
        <ol className="relative mt-5 space-y-4 border-l border-[var(--line-strong)] pl-5">
          {view.timeline.map((event) => (
            <li className="relative" key={event.id}>
              <span
                aria-hidden="true"
                className="absolute -left-[1.55rem] top-1 size-3 rounded-full border-2 border-white bg-[var(--primary)] ring-1 ring-[var(--line-strong)]"
              />
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <h3 className="text-sm font-black text-[var(--text-primary)]">
                  {event.title}
                </h3>
                <time
                  className="shrink-0 text-xs font-bold text-[var(--muted)]"
                  dateTime={event.occurredAt}
                >
                  {dateTime.format(new Date(event.occurredAt))}
                </time>
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {event.description}
              </p>
              <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                {event.professionalName} · {event.source}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Nenhum evento existente para exibir.
        </p>
      )}
    </Card>
  );
}

function AnalysisAudit({ view }: { view: ClinicalEngineView }) {
  return (
    <aside
      aria-label="Registro da análise assistida"
      className="self-start xl:sticky xl:top-24"
    >
      <Card className="overflow-hidden" variant="elevated">
        <div className="bg-[var(--primary)] p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">
            Apoio à decisão
          </p>
          <h2 className="mt-1 text-lg font-black">
            Motor de Decisão Nutricional
          </h2>
          <p className="mt-2 text-xs leading-5 text-emerald-50">
            Não diagnostica, não prescreve e não modifica registros
            automaticamente.
          </p>
        </div>
        <dl className="space-y-4 p-5">
          <div>
            <dt className="text-xs font-bold text-[var(--muted)]">
              Análise realizada
            </dt>
            <dd className="mt-1 text-sm font-black text-[var(--text-primary)]">
              {dateTime.format(new Date(view.analysisAudit.analyzedAt))}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-[var(--muted)]">
              Versão do motor
            </dt>
            <dd className="mt-1 text-sm font-black text-[var(--text-primary)]">
              {view.analysisAudit.engineVersion}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-[var(--muted)]">
              Estratégia analisada
            </dt>
            <dd className="mt-1 break-all text-xs text-[var(--text-secondary)]">
              {view.analysisAudit.strategyReference ?? "Não disponível"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-[var(--muted)]">
              Plano analisado
            </dt>
            <dd className="mt-1 break-all text-xs text-[var(--text-secondary)]">
              {view.analysisAudit.mealPlanReference ?? "Não disponível"}
            </dd>
          </div>
          {view.hub.header.code.trim() ? (
            <div className="border-t border-[var(--line)] pt-4">
              <dt className="text-xs font-bold text-[var(--muted)]">
                Código clínico
              </dt>
              <dd className="mt-1 text-xs font-bold text-[var(--text-secondary)]">
                {view.hub.header.code} · versão {view.masterRecordVersion}
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>
    </aside>
  );
}

export function ClinicalEngineWorkspace({
  view,
}: {
  view: ClinicalEngineView;
}) {
  const [effectiveView, setEffectiveView] = useState(view);
  const [legacyPreviewState, setLegacyPreviewState] =
    useState<LegacyPreviewState>("NONE");

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setLegacyPreviewState(discardIncompatibleLocalPreview(view));
      setEffectiveView(localDecisionView(view));
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, [view]);

  const standardSections = effectiveView.sections.filter(
    (item) => item.id !== "alerts" && item.id !== "assisted-suggestions",
  );

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-5">
        {legacyPreviewState !== "NONE" ? (
          <div
            className="rounded-[var(--radius-medium)] border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
            role="alert"
          >
            <strong>Prévia antiga incompatível.</strong> A sugestão local do
            fluxo demonstrativo não é compatível com o catálogo alimentar
            profissional e não será utilizada.
            {legacyPreviewState === "DISCARDED"
              ? " Ela foi removida somente do armazenamento local deste navegador."
              : " O navegador impediu sua remoção, mas ela permanece ignorada."}
            <br />
            Nenhum plano profissional salvo foi perdido. Gere uma nova sugestão
            no Plano Alimentar para continuar.
          </div>
        ) : null}
        {effectiveView.demonstrative ? (
          <div
            className="rounded-[var(--radius-medium)] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
            role="status"
          >
            <strong>Cenário demonstrativo.</strong> A análise utiliza
            exclusivamente os dados mockados já identificados e isolados nos
            adaptadores atuais.
          </div>
        ) : null}
        <div
          className="rounded-[var(--radius-large)] border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950"
          role="note"
        >
          <strong>Decisão exclusivamente profissional.</strong> Este motor
          organiza dados, identifica inconsistências objetivas e apresenta
          sugestões explicáveis. Ele não realiza diagnóstico nem prescrição.
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-2">
          {standardSections.map((item) => (
            <InformationCard item={item} key={item.id} />
          ))}
        </div>

        <StrategyComparison view={effectiveView} />
        <div className="grid min-w-0 gap-5 lg:grid-cols-2">
          <AlertsCard view={effectiveView} />
          <SuggestionsCard view={effectiveView} />
        </div>
        <Timeline view={effectiveView} />
      </div>
      <AnalysisAudit view={effectiveView} />
    </div>
  );
}
