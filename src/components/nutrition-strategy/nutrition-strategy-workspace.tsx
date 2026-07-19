"use client";

import { useState, type ReactNode } from "react";
import { Badge, Button, ButtonLink, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Divider, FormField, Input, NumberInput, Select, StatusBadge, Textarea } from "@/components/ui";
import type { NutritionStrategyView } from "@/features/nutrition-strategy";
import { nutritionStrategyComplementaryOptions, nutritionStrategyMainObjectiveOptions, nutritionStrategySecondaryObjectiveOptions, nutritionStrategyTypeOptions } from "@/features/nutrition-strategy";

type StrategyDraft = {
  objectiveMain: string;
  secondaryObjectives: string[];
  strategyType: string;
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

function labelFromOption(options: readonly (readonly [string, string])[], value: string) {
  return options.find(([key]) => key === value)?.[1] ?? value;
}

export function NutritionStrategyWorkspace({ view }: { view: NutritionStrategyView }) {
  const [draft, setDraft] = useState<StrategyDraft>({
    objectiveMain: view.objectiveMain,
    secondaryObjectives: [...view.secondaryObjectives],
    strategyType: view.strategyType,
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
  const [message, setMessage] = useState("Dados mockados e editáveis apenas em memória local.");
  const canOpenMealPlan = view.canOpenMealPlan;

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
          <Button onClick={() => setMessage("Alterações mantidas somente no estado local deste mock.")} size="small" variant="outline" type="button">Salvar rascunho local</Button>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
        <div className="space-y-6">
          <StrategySection description="Defina o objetivo principal da estratégia antes do Plano Alimentar." title="1. Objetivo principal">
            <FormField id="objective-main" label="Objetivo principal">
              <Select id="objective-main" onChange={(event) => setDraft({ ...draft, objectiveMain: labelFromOption(nutritionStrategyMainObjectiveOptions, event.target.value) })} value={draft.objectiveMain}>
                {nutritionStrategyMainObjectiveOptions.map(([value, label]) => <option key={value} value={label}>{label}</option>)}
              </Select>
            </FormField>
          </StrategySection>

          <StrategySection description="Selecione os objetivos secundários que sustentam a estratégia." title="2. Objetivos secundários">
            <div className="grid gap-3 sm:grid-cols-2">
              {nutritionStrategySecondaryObjectiveOptions.map((item) => (
                <label className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3 text-sm text-[var(--text-secondary)]" key={item}>
                  <Checkbox checked={draft.secondaryObjectives.includes(item)} onChange={() => setDraft({ ...draft, secondaryObjectives: toggleItem(draft.secondaryObjectives, item) })} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </StrategySection>

          <StrategySection description="Escolha a estratégia nutricional estruturada pelo profissional." title="3. Estratégia nutricional">
            <FormField id="strategy-type" label="Estratégia nutricional">
              <Select id="strategy-type" onChange={(event) => setDraft({ ...draft, strategyType: event.target.value })} value={draft.strategyType}>
                {nutritionStrategyTypeOptions.map(([value, label]) => <option key={value} value={label}>{label}</option>)}
              </Select>
            </FormField>
          </StrategySection>

          <StrategySection description="Distribuição diária das refeições e janela alimentar." title="4. Distribuição das refeições">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="meal-count" label="Número de refeições">
                <NumberInput id="meal-count" min={1} onChange={(event) => setDraft({ ...draft, mealCount: Number(event.target.value) || 0 })} value={draft.mealCount} />
              </FormField>
              <FormField id="window" label="Janela alimentar">
                <Input id="window" onChange={(event) => setDraft({ ...draft, window: event.target.value })} value={draft.window} />
              </FormField>
              <FormField id="meal-times" label="Horários">
                <Input id="meal-times" onChange={(event) => setDraft({ ...draft, mealTimes: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} value={draft.mealTimes.join(", ")} />
              </FormField>
              <FormField id="pre-training" label="Pré-treino">
                <Input id="pre-training" onChange={(event) => setDraft({ ...draft, preTraining: event.target.value })} value={draft.preTraining} />
              </FormField>
              <FormField id="post-training" label="Pós-treino">
                <Input id="post-training" onChange={(event) => setDraft({ ...draft, postTraining: event.target.value })} value={draft.postTraining} />
              </FormField>
              <FormField id="supper" label="Ceia">
                <Input id="supper" onChange={(event) => setDraft({ ...draft, supper: event.target.value })} value={draft.supper} />
              </FormField>
            </div>
          </StrategySection>

          <StrategySection description="Estratégias complementares que apoiam o plano futuro." title="5. Estratégias complementares">
            <div className="grid gap-3 sm:grid-cols-2">
              {nutritionStrategyComplementaryOptions.map((item) => (
                <label className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3 text-sm text-[var(--text-secondary)]" key={item}>
                  <Checkbox checked={draft.complementaryStrategies.includes(item)} onChange={() => setDraft({ ...draft, complementaryStrategies: toggleItem(draft.complementaryStrategies, item) })} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </StrategySection>

          <StrategySection description="Suplementação estruturada com apoio da Biblioteca Científica." title="6. Suplementação">
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
                <Textarea id="supplementation-notes" onChange={(event) => setDraft({ ...draft, supplementationNotes: event.target.value })} value={draft.supplementationNotes} />
              </FormField>
            </div>
          </StrategySection>

          <StrategySection description="Justificativa clínica e orientações gerais do nutricionista." title="7. Observações clínicas">
            <FormField id="clinical-observations" label="Observações clínicas">
              <Textarea id="clinical-observations" onChange={(event) => setDraft({ ...draft, observations: event.target.value })} value={draft.observations} />
            </FormField>
          </StrategySection>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card className="p-5" variant="elevated">
            <CardHeader>
              <CardTitle>8. Resumo</CardTitle>
              <CardDescription>Visão consolidada da estratégia registrada no mock atual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="space-y-3 text-sm">
                <div><dt className="text-xs font-bold text-[var(--muted)]">Objetivo</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{draft.objectiveMain}</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Estratégia</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{draft.strategyType}</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Refeições</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{draft.mealCount}</dd></div>
                <div><dt className="text-xs font-bold text-[var(--muted)]">Suplementação</dt><dd className="mt-1 font-black text-[var(--text-primary)]">{draft.supplementationNotes || "Dado ainda não registrado no Prontuário Mestre."}</dd></div>
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
