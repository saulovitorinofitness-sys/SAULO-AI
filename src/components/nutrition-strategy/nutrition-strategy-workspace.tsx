"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge, Button, ButtonLink, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Divider, FormField, Input, NumberInput, Select, StatusBadge, Textarea } from "@/components/ui";
import { calculateMacroTarget, MACRONUTRIENT_KCAL_PER_GRAM } from "@/features/nutrition-strategy/calculations";
import type { NutritionStrategyView } from "@/features/nutrition-strategy/contracts";
import { energyTargetModeOptions, nutritionMethodOptions, nutritionStrategyComplementaryOptions, nutritionStrategyMainObjectiveOptions, nutritionStrategySecondaryObjectiveOptions, nutritionStrategyTypeOptions } from "@/features/nutrition-strategy/mock-data";
import { mockNutritionStrategySelectionAdapter } from "@/features/nutrition-strategy/mock-selection-adapter";
import { NutritionGoalsPanel, type NutritionGoalsDraft } from "./nutrition-goals-panel";

type StrategyDraft = {
  objectiveMain: string;
  secondaryObjectives: string[];
  strategyType: string;
  nutritionGoals: NutritionGoalsDraft;
  mealCount: number;
  mealTimes: string[];
  window: string;
  preTraining: string;
  postTraining: string;
  supper: string;
  complementaryStrategies: string[];
  supplementationNotes: string;
  observations: string;
};

function StrategySection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card className="p-5 md:p-6">
      <CardHeader className="mb-3">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function toggleItem(values: readonly string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function NutritionStrategyWorkspace({ view }: { view: NutritionStrategyView }) {
  const [draft, setDraft] = useState<StrategyDraft>({
    objectiveMain: view.objectiveMain,
    secondaryObjectives: [...view.secondaryObjectives],
    strategyType: view.strategyType,
    nutritionGoals: {
      method: view.nutritionGoals.method,
      energyMode: view.nutritionGoals.energyMode,
      directCalories: view.nutritionGoals.targetCalories,
      percentages: {
        carbohydrates: view.nutritionGoals.carbohydrates.percentage,
        protein: view.nutritionGoals.protein.percentage,
        fats: view.nutritionGoals.fats.percentage,
      },
    },
    mealCount: view.mealDistribution.mealCount,
    mealTimes: [...view.mealDistribution.mealTimes],
    window: view.mealDistribution.window,
    preTraining: view.mealDistribution.preTraining,
    postTraining: view.mealDistribution.postTraining,
    supper: view.mealDistribution.supper,
    complementaryStrategies: [...view.complementaryStrategies],
    supplementationNotes: view.supplementation.map((item) => `${item.name} · ${item.objective}`).join(" | "),
    observations: view.clinicalObservations,
  });
  const [message, setMessage] = useState(
    "Dados demonstrativos editáveis no suporte local temporário.",
  );
  const [browserStateLoaded, setBrowserStateLoaded] = useState(false);
  const canOpenMealPlan = view.canOpenMealPlan;
  const {
    summaryCalories,
    summaryCarbohydrates,
    summaryProtein,
    summaryFats,
  } = useMemo(() => {
    const calories = Math.max(
      0,
      draft.nutritionGoals.energyMode === "BMR"
        ? (view.nutritionGoals.basalMetabolicRateKcal ?? 0)
        : draft.nutritionGoals.directCalories,
    );
    return {
      summaryCalories: calories,
      summaryCarbohydrates: calculateMacroTarget(
        calories,
        draft.nutritionGoals.percentages.carbohydrates,
        MACRONUTRIENT_KCAL_PER_GRAM.carbohydrates,
      ),
      summaryProtein: calculateMacroTarget(
        calories,
        draft.nutritionGoals.percentages.protein,
        MACRONUTRIENT_KCAL_PER_GRAM.protein,
      ),
      summaryFats: calculateMacroTarget(
        calories,
        draft.nutritionGoals.percentages.fats,
        MACRONUTRIENT_KCAL_PER_GRAM.fats,
      ),
    };
  }, [
    draft.nutritionGoals,
    view.nutritionGoals.basalMetabolicRateKcal,
  ]);
  const summaryMethod = nutritionMethodOptions.find(([value]) => value === draft.nutritionGoals.method)?.[1] ?? draft.nutritionGoals.method;
  const summaryEnergyMode = energyTargetModeOptions.find(([value]) => value === draft.nutritionGoals.energyMode)?.[1] ?? draft.nutritionGoals.energyMode;
  const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const saved = mockNutritionStrategySelectionAdapter.readDraft(
        view.patientId,
        view.scenario,
      );
      if (
        saved &&
        saved.selection.masterRecordId === view.masterRecordId
      ) {
        setDraft((current) => ({
          ...current,
          objectiveMain: saved.selection.objectiveMain,
          secondaryObjectives: [...saved.secondaryObjectives],
          strategyType: saved.strategyType,
          nutritionGoals: {
            method: saved.selection.method,
            energyMode: saved.selection.energyMode,
            directCalories: saved.selection.targetCalories,
            percentages: {
              carbohydrates: saved.selection.carbohydrates.percentage,
              protein: saved.selection.protein.percentage,
              fats: saved.selection.fats.percentage,
            },
          },
          mealCount: saved.selection.mealCount,
          mealTimes: [...saved.selection.mealTimes],
          window: saved.window,
          preTraining: saved.preTraining,
          postTraining: saved.postTraining,
          supper: saved.supper,
          complementaryStrategies: [
            ...saved.selection.complementaryStrategies,
          ],
          supplementationNotes: saved.supplementationNotes,
          observations: saved.observations,
        }));
        setMessage(
          "Rascunho demonstrativo restaurado do suporte local temporário.",
        );
      }
      setBrowserStateLoaded(true);
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, [view.masterRecordId, view.patientId, view.scenario]);

  useEffect(() => {
    if (!browserStateLoaded) return;
    mockNutritionStrategySelectionAdapter.storeDraft({
      selection: {
        patientId: view.patientId,
        masterRecordId: view.masterRecordId,
        scenario: view.scenario,
        objectiveMain: draft.objectiveMain,
        method: draft.nutritionGoals.method,
        energyMode: draft.nutritionGoals.energyMode,
        targetCalories: summaryCalories,
        carbohydrates: summaryCarbohydrates,
        protein: summaryProtein,
        fats: summaryFats,
        mealCount: draft.mealCount,
        mealTimes: draft.mealTimes,
        complementaryStrategies: draft.complementaryStrategies,
        updatedAt: new Date().toISOString(),
        demonstrative: true,
      },
      secondaryObjectives: draft.secondaryObjectives,
      strategyType: draft.strategyType,
      window: draft.window,
      preTraining: draft.preTraining,
      postTraining: draft.postTraining,
      supper: draft.supper,
      supplementationNotes: draft.supplementationNotes,
      observations: draft.observations,
    });
  }, [
    browserStateLoaded,
    draft,
    summaryCalories,
    summaryCarbohydrates,
    summaryFats,
    summaryProtein,
    view.masterRecordId,
    view.patientId,
    view.scenario,
  ]);

  return (
    <div className="space-y-6">
      <Card variant="info" className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={view.status === "ACTIVE" ? "completed" : "in_progress"} label={view.summary.statusLabel} />
            <Badge tone="info">Estrutura integrada ao Prontuário Mestre</Badge>
          </div>
          <p className="text-sm font-semibold text-sky-950">{message}</p>
          <p className="text-xs leading-5 text-sky-800">{view.decisionContext}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canOpenMealPlan ? <ButtonLink href={view.mealPlanHref ?? "#"} size="small">Abrir Plano Alimentar</ButtonLink> : <Button disabled size="small" type="button">Plano Alimentar bloqueado</Button>}
          <Button onClick={() => setMessage("Rascunho demonstrativo salvo no suporte local temporário.")} size="small" variant="outline" type="button">Salvar rascunho local</Button>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
        <div className="space-y-6">
          <StrategySection description="Defina o objetivo principal da estratégia antes do Plano Alimentar." title="1. Objetivo principal">
            <FormField id="objective-main" label="Objetivo principal">
              <Select id="objective-main" onChange={(event) => setDraft((current) => ({ ...current, objectiveMain: event.target.value }))} value={draft.objectiveMain}>
                {!nutritionStrategyMainObjectiveOptions.some(([, label]) => label === draft.objectiveMain) ? <option value={draft.objectiveMain}>{draft.objectiveMain}</option> : null}
                {nutritionStrategyMainObjectiveOptions.map(([value, label]) => <option key={value} value={label}>{label}</option>)}
              </Select>
            </FormField>
          </StrategySection>

          <StrategySection description="Selecione os objetivos secundários que sustentam a estratégia." title="2. Objetivos secundários">
            <div className="grid gap-3 sm:grid-cols-2">
              {nutritionStrategySecondaryObjectiveOptions.map((item) => (
                <label className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3 text-sm text-[var(--text-secondary)]" key={item}>
                  <Checkbox checked={draft.secondaryObjectives.includes(item)} onChange={() => setDraft((current) => ({ ...current, secondaryObjectives: toggleItem(current.secondaryObjectives, item) }))} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </StrategySection>

          <StrategySection description="Escolha a estratégia nutricional estruturada pelo profissional." title="3. Estratégia nutricional">
            <FormField id="strategy-type" label="Estratégia nutricional">
              <Select id="strategy-type" onChange={(event) => setDraft((current) => ({ ...current, strategyType: event.target.value }))} value={draft.strategyType}>
                {nutritionStrategyTypeOptions.map(([value, label]) => <option key={value} value={label}>{label}</option>)}
              </Select>
            </FormField>
          </StrategySection>

          <StrategySection description="Defina o método, a energia e a distribuição de macronutrientes antes da montagem do plano." title="4. Estratégia e metas nutricionais">
            <NutritionGoalsPanel assembledDiet={view.assembledDiet} goals={view.nutritionGoals} onChange={(nutritionGoals) => setDraft((current) => ({ ...current, nutritionGoals }))} value={draft.nutritionGoals} />
          </StrategySection>

          <StrategySection description="Distribuição diária das refeições e janela alimentar." title="5. Distribuição das refeições">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="meal-count" label="Número de refeições">
                <NumberInput id="meal-count" min={1} onChange={(event) => setDraft((current) => ({ ...current, mealCount: Number(event.target.value) || 0 }))} value={draft.mealCount} />
              </FormField>
              <FormField id="window" label="Janela alimentar">
                <Input id="window" onChange={(event) => setDraft((current) => ({ ...current, window: event.target.value }))} value={draft.window} />
              </FormField>
              <FormField id="meal-times" label="Horários">
                <Input id="meal-times" onChange={(event) => setDraft((current) => ({ ...current, mealTimes: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) }))} value={draft.mealTimes.join(", ")} />
              </FormField>
              <FormField id="pre-training" label="Pré-treino">
                <Input id="pre-training" onChange={(event) => setDraft((current) => ({ ...current, preTraining: event.target.value }))} value={draft.preTraining} />
              </FormField>
              <FormField id="post-training" label="Pós-treino">
                <Input id="post-training" onChange={(event) => setDraft((current) => ({ ...current, postTraining: event.target.value }))} value={draft.postTraining} />
              </FormField>
              <FormField id="supper" label="Ceia">
                <Input id="supper" onChange={(event) => setDraft((current) => ({ ...current, supper: event.target.value }))} value={draft.supper} />
              </FormField>
            </div>
          </StrategySection>

          <StrategySection description="Estratégias complementares que apoiam o plano futuro." title="6. Estratégias complementares">
            <div className="grid gap-3 sm:grid-cols-2">
              {nutritionStrategyComplementaryOptions.map((item) => (
                <label className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3 text-sm text-[var(--text-secondary)]" key={item}>
                  <Checkbox checked={draft.complementaryStrategies.includes(item)} onChange={() => setDraft((current) => ({ ...current, complementaryStrategies: toggleItem(current.complementaryStrategies, item) }))} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </StrategySection>

          <StrategySection description="Suplementação estruturada com apoio da Biblioteca Científica." title="7. Suplementação">
            <div className="space-y-3">
              {view.supplementation.map((item) => (
                <Card key={item.id} variant="muted" className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-[var(--text-primary)]">{item.name}</p>
                    <Badge tone="info">Biblioteca Científica</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div><p className="text-xs font-bold text-[var(--muted)]">Objetivo</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{item.objective}</p></div>
                    <div><p className="text-xs font-bold text-[var(--muted)]">Horário</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{item.schedule}</p></div>
                    <div><p className="text-xs font-bold text-[var(--muted)]">Observação</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{item.observations}</p></div>
                  </div>
                </Card>
              ))}
              <FormField id="supplementation-notes" label="Notas da suplementação">
                <Textarea id="supplementation-notes" onChange={(event) => setDraft((current) => ({ ...current, supplementationNotes: event.target.value }))} value={draft.supplementationNotes} />
              </FormField>
            </div>
          </StrategySection>

          <StrategySection description="Justificativa clínica e orientações gerais do nutricionista." title="8. Observações clínicas">
            <FormField id="clinical-observations" label="Observações clínicas">
              <Textarea id="clinical-observations" onChange={(event) => setDraft((current) => ({ ...current, observations: event.target.value }))} value={draft.observations} />
            </FormField>
          </StrategySection>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card className="p-5" variant="elevated">
            <CardHeader>
              <CardTitle>9. Resumo</CardTitle>
              <CardDescription>Visão consolidada da estratégia registrada no mock atual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-3 text-sm">
                <div><dt className="text-xs font-bold text-[var(--muted)]">Objetivo</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{draft.objectiveMain}</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Objetivos secundários</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{draft.secondaryObjectives.join(" · ") || "Nenhum selecionado"}</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Estratégia</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{draft.strategyType}</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Método e energia</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{summaryMethod} · {formatNumber(summaryCalories)} kcal</dd><dd className="mt-1 text-xs text-[var(--muted)]">{summaryEnergyMode}</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Macronutrientes</dt><dd className="mt-1 font-black text-[var(--text-primary)]">C {formatNumber(draft.nutritionGoals.percentages.carbohydrates)}% · {formatNumber(summaryCarbohydrates.grams)} g</dd><dd className="mt-1 font-black text-[var(--text-primary)]">P {formatNumber(draft.nutritionGoals.percentages.protein)}% · {formatNumber(summaryProtein.grams)} g</dd><dd className="mt-1 font-black text-[var(--text-primary)]">L {formatNumber(draft.nutritionGoals.percentages.fats)}% · {formatNumber(summaryFats.grams)} g</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Refeições</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{draft.mealCount} · {draft.mealTimes.join(", ") || "Horários não informados"}</dd><dd className="mt-1 text-xs text-[var(--muted)]">Janela: {draft.window || "Não informada"}</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Pré-treino, pós-treino e ceia</dt><dd className="mt-1 text-[var(--text-primary)]">{[draft.preTraining, draft.postTraining, draft.supper].filter(Boolean).join(" · ") || "Não informados"}</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Estratégias complementares</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{draft.complementaryStrategies.join(" · ") || "Nenhuma selecionada"}</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Suplementação</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{draft.supplementationNotes || "Dado ainda não registrado no Prontuário Mestre."}</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Observações clínicas</dt><dd className="mt-1 text-[var(--text-primary)]">{draft.observations || "Nenhuma observação informada"}</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Status</dt><dd className="mt-1"><StatusBadge label={view.summary.statusLabel} status={view.status === "ACTIVE" ? "completed" : "pending"} /></dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Última atualização</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(view.updatedAt))}</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Responsável</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{view.responsibleProfessional}</dd></div>
              </dl>
              <Divider />
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">Integração com a Biblioteca Científica</p>
                <div className="flex flex-wrap gap-2">
                  {view.scientificReferences.map((item) => <Badge key={item.id} tone="neutral">{item.name}</Badge>)}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--primary)]">Ligação com o Plano Alimentar</p>
                <p className="text-sm leading-6 text-[var(--text-secondary)]">{view.planContext}</p>
                <p className="text-xs leading-5 text-[var(--muted)]">{view.canOpenMealPlan ? "O Plano Alimentar já pode ser aberto a partir desta estratégia registrada." : "O Plano Alimentar permanece bloqueado enquanto a estratégia estiver em rascunho."}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="p-5" variant="muted">
            <CardHeader>
              <CardTitle>Referências científicas</CardTitle>
              <CardDescription>Itens da biblioteca reutilizados para apoio estrutural.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {view.scientificReferences.map((item) => (
                <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3" key={item.id}>
                  <p className="text-sm font-black text-[var(--text-primary)]">{item.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{item.domain} · {item.source}</p>
                </article>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
