"use client";

import { useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  NumberInput,
  SectionHeader,
  Select,
  Textarea,
} from "@/components/ui";
import {
  PERFORMANCE_SERVICE_LABELS,
  PERFORMANCE_SERVICE_OPTIONS,
  PHYSICAL_VALENCE_OPTIONS,
  PROGRAM_PHASE_OPTIONS,
  WORKOUT_START_MODE_LABELS,
  WORKOUT_START_MODES,
  type ExerciseLibraryItemView,
  type PerformanceWorkoutView,
  type PeriodizationCycle,
  type TrainingMethodDefinition,
  type WorkoutExercise,
  type WorkoutPlanDraft,
  type WorkoutSession,
} from "@/features/performance-endurance/workout-contracts";
import {
  STANDARD_TRAINING_METHODS,
  buildWorkoutMethodGlossary,
} from "@/features/performance-endurance/workout-record";

function emptyExercise(
  name: string,
  libraryExerciseId?: string,
): WorkoutExercise {
  return {
    id: crypto.randomUUID(),
    order: 1,
    name,
    libraryExerciseId,
    prescription: "",
    sets: "",
    repetitions: "",
    load: "",
    intensityType: "",
    intensityValue: "",
    restInterval: "",
    cadence: "",
    rangeOfMotion: "",
    methodId: "",
    observations: "",
    substituteExercise: "",
  };
}

function emptySession(name: string): WorkoutSession {
  return {
    id: crypto.randomUUID(),
    name,
    objective: "",
    observations: "",
    exercises: [],
  };
}

function emptyCycle(): PeriodizationCycle {
  return {
    id: crypto.randomUUID(),
    level: "MESOCYCLE",
    name: "",
    startDate: "",
    endDate: "",
    objective: "",
    observations: "",
  };
}

function emptyCustomMethod(): TrainingMethodDefinition {
  return {
    id: `custom-${crypto.randomUUID()}`,
    name: "",
    studentExplanation: "",
    executionInstruction: "",
    objective: "",
    professionalObservation: "",
    custom: true,
  };
}

function libraryMatch(
  library: readonly ExerciseLibraryItemView[],
  name: string,
) {
  const normalized = name.trim().toLocaleLowerCase("pt-BR");
  return library.find(
    (item) => item.name.toLocaleLowerCase("pt-BR") === normalized,
  );
}

export function PerformanceWorkoutWorkspace({
  initialView,
}: {
  initialView: PerformanceWorkoutView;
}) {
  const [draft, setDraft] = useState<WorkoutPlanDraft>(initialView.draft);
  const [status, setStatus] = useState(initialView.status);
  const [version, setVersion] = useState(initialView.version);
  const [updatedAt, setUpdatedAt] = useState(initialView.updatedAt);
  const [library, setLibrary] = useState([
    ...initialView.exerciseLibrary,
  ]);
  const [newActivity, setNewActivity] = useState("");
  const [customValence, setCustomValence] = useState("");
  const [customSessionName, setCustomSessionName] = useState("");
  const [exerciseNames, setExerciseNames] = useState<
    Record<string, string>
  >({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const finalized = status === "FINALIZED";
  const allMethods = useMemo(
    () => [...STANDARD_TRAINING_METHODS, ...draft.customMethods],
    [draft.customMethods],
  );
  const glossary = useMemo(
    () => buildWorkoutMethodGlossary(draft),
    [draft],
  );

  function updateService(
    change: Partial<WorkoutPlanDraft["service"]>,
  ) {
    setDraft((current) => ({
      ...current,
      service: { ...current.service, ...change },
    }));
  }

  function updateStrategy(
    change: Partial<WorkoutPlanDraft["strategy"]>,
  ) {
    setDraft((current) => ({
      ...current,
      strategy: { ...current.strategy, ...change },
    }));
  }

  function updateSession(
    sessionId: string,
    change: Partial<WorkoutSession>,
  ) {
    setDraft((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId ? { ...session, ...change } : session,
      ),
    }));
  }

  function updateExercise(
    sessionId: string,
    exerciseId: string,
    change: Partial<WorkoutExercise>,
  ) {
    setDraft((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              exercises: session.exercises.map((exercise) =>
                exercise.id === exerciseId
                  ? { ...exercise, ...change }
                  : exercise,
              ),
            }
          : session,
      ),
    }));
  }

  function addExercise(
    sessionId: string,
    name: string,
    libraryExerciseId?: string,
  ) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setDraft((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              exercises: [
                ...session.exercises,
                {
                  ...emptyExercise(trimmed, libraryExerciseId),
                  order: session.exercises.length + 1,
                },
              ],
            }
          : session,
      ),
    }));
    setExerciseNames((current) => ({ ...current, [sessionId]: "" }));
  }

  async function addExerciseAndSave(sessionId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const response = await fetch("/api/performance/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const result = (await response.json().catch(() => null)) as
      | { exercise?: ExerciseLibraryItemView; message?: string }
      | null;
    if (!response.ok || !result?.exercise) {
      setMessage(
        result?.message ?? "Não foi possível salvar o exercício.",
      );
      setSaving(false);
      return;
    }
    setLibrary((current) =>
      current.some((item) => item.id === result.exercise!.id)
        ? current
        : [...current, result.exercise!].sort((left, right) =>
            left.name.localeCompare(right.name, "pt-BR"),
          ),
    );
    addExercise(sessionId, result.exercise.name, result.exercise.id);
    setMessage("Exercício incluído no treino e salvo na biblioteca.");
    setSaving(false);
  }

  function moveExercise(
    sessionId: string,
    exerciseId: string,
    direction: -1 | 1,
  ) {
    setDraft((current) => ({
      ...current,
      sessions: current.sessions.map((session) => {
        if (session.id !== sessionId) return session;
        const exercises = [...session.exercises];
        const index = exercises.findIndex(
          (exercise) => exercise.id === exerciseId,
        );
        const target = index + direction;
        if (index < 0 || target < 0 || target >= exercises.length) {
          return session;
        }
        [exercises[index], exercises[target]] = [
          exercises[target],
          exercises[index],
        ];
        return {
          ...session,
          exercises: exercises.map((exercise, exerciseIndex) => ({
            ...exercise,
            order: exerciseIndex + 1,
          })),
        };
      }),
    }));
  }

  async function save(action: "SAVE_DRAFT" | "FINALIZE") {
    if (
      action === "FINALIZE" &&
      !window.confirm(
        "Finalizar este Plano de Treino? Depois disso ele ficará protegido contra alterações acidentais.",
      )
    ) {
      return;
    }
    setSaving(true);
    setMessage(
      action === "FINALIZE"
        ? "Finalizando Plano de Treino..."
        : "Salvando rascunho...",
    );
    const response = await fetch(
      `/api/patients/${initialView.patient.id}/attendances/${initialView.attendanceId}/workout-plan`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, draft }),
      },
    );
    const result = (await response.json().catch(() => null)) as
      | { record?: PerformanceWorkoutView; message?: string }
      | null;
    if (!response.ok || !result?.record) {
      setMessage(
        result?.message ?? "Não foi possível salvar o Plano de Treino.",
      );
      setSaving(false);
      return;
    }
    setDraft(result.record.draft);
    setStatus(result.record.status);
    setVersion(result.record.version);
    setUpdatedAt(result.record.updatedAt);
    setMessage(
      action === "FINALIZE"
        ? "Plano de Treino finalizado pelo profissional."
        : "Rascunho salvo no Prontuário Mestre.",
    );
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden" variant="elevated">
        <div className="bg-[var(--primary)] px-5 py-6 text-white md:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">
                Performance · Prescrição de treino
              </p>
              <h1 className="mt-2 text-2xl font-black md:text-3xl">
                {initialView.patient.name}
              </h1>
              <p className="mt-1 text-sm text-emerald-50">
                {initialView.patient.code} · Atendimento vinculado ao
                Prontuário Mestre
              </p>
            </div>
            <Badge tone={finalized ? "success" : "warning"}>
              {finalized ? "Finalizado" : "Rascunho"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-xs text-[var(--muted)]">
          <span>
            Responsável: {initialView.responsibleProfessional} · versão{" "}
            {version}
          </span>
          <span>
            {updatedAt
              ? `Atualizado em ${new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(updatedAt))}`
              : "Ainda não salvo"}
          </span>
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <SectionHeader
          description="Somente dados reais do prontuário que podem alterar a prescrição. Informações ausentes não são inferidas."
          title="Contexto clínico herdado"
        />
        <dl className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {initialView.inheritedFacts.map((fact) => (
            <div
              className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4"
              key={fact.key}
            >
              <dt className="text-xs font-black text-[var(--muted)]">
                {fact.label}
              </dt>
              <dd className="mt-2 whitespace-pre-wrap text-sm font-semibold text-[var(--text-primary)]">
                {fact.value}
              </dd>
              <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-[var(--primary)]">
                Origem: {fact.source}
              </p>
            </div>
          ))}
        </dl>
      </Card>

      <fieldset className="space-y-6" disabled={finalized}>
        <Card className="p-5 md:p-6">
          <SectionHeader
            description="A prescrição deste módulo modifica somente o serviço contratado. Outras práticas são registradas apenas como carga externa relevante."
            title="Serviço e contexto do treino"
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FormField id="performance-service" label="Serviço contratado">
              <Select
                id="performance-service"
                onChange={(event) =>
                  updateService({
                    contractedService:
                      (event.target.value ||
                        undefined) as WorkoutPlanDraft["service"]["contractedService"],
                  })
                }
                value={draft.service.contractedService ?? ""}
              >
                <option value="">Não informado</option>
                {PERFORMANCE_SERVICE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {PERFORMANCE_SERVICE_LABELS[option]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="performance-plan-type" label="Tipo de plano">
              <Input
                id="performance-plan-type"
                onChange={(event) =>
                  updateService({ planType: event.target.value })
                }
                value={draft.service.planType}
              />
            </FormField>
            <FormField id="performance-objective" label="Objetivo do treino">
              <Input
                id="performance-objective"
                onChange={(event) =>
                  updateService({ trainingObjective: event.target.value })
                }
                value={draft.service.trainingObjective}
              />
            </FormField>
            <FormField id="performance-modality" label="Modalidade principal">
              <Input
                id="performance-modality"
                onChange={(event) =>
                  updateService({ primaryModality: event.target.value })
                }
                value={draft.service.primaryModality}
              />
            </FormField>
          </div>
          <div className="mt-5 rounded-xl border border-[var(--line)] p-4">
            <h3 className="text-sm font-black">Outras atividades praticadas</h3>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Nova atividade externa"
                onChange={(event) => setNewActivity(event.target.value)}
                placeholder="Ex.: corrida realizada por conta própria"
                value={newActivity}
              />
              <Button
                disabled={!newActivity.trim()}
                onClick={() => {
                  updateService({
                    otherActivities: [
                      ...draft.service.otherActivities,
                      {
                        id: crypto.randomUUID(),
                        name: newActivity.trim(),
                        supervision: "",
                      },
                    ],
                  });
                  setNewActivity("");
                }}
                type="button"
                variant="secondary"
              >
                Adicionar
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {draft.service.otherActivities.map((activity) => (
                <div
                  className="grid gap-2 rounded-lg bg-[var(--surface-elevated)] p-3 md:grid-cols-[1fr_15rem_auto]"
                  key={activity.id}
                >
                  <Input
                    aria-label="Nome da atividade externa"
                    onChange={(event) =>
                      updateService({
                        otherActivities:
                          draft.service.otherActivities.map((item) =>
                            item.id === activity.id
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                      })
                    }
                    value={activity.name}
                  />
                  <Select
                    aria-label={`Acompanhamento de ${activity.name}`}
                    onChange={(event) =>
                      updateService({
                        otherActivities:
                          draft.service.otherActivities.map((item) =>
                            item.id === activity.id
                              ? {
                                  ...item,
                                  supervision: event.target
                                    .value as typeof activity.supervision,
                                }
                              : item,
                          ),
                      })
                    }
                    value={activity.supervision}
                  >
                    <option value="">Não informado</option>
                    <option value="PROFESSIONAL">
                      Acompanhada pelo profissional
                    </option>
                    <option value="SELF_DIRECTED">Por conta própria</option>
                  </Select>
                  <Button
                    onClick={() =>
                      updateService({
                        otherActivities:
                          draft.service.otherActivities.filter(
                            (item) => item.id !== activity.id,
                          ),
                      })
                    }
                    type="button"
                    variant="ghost"
                  >
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <SectionHeader
            description="Seleção profissional livre. Sugestões nunca substituem esta decisão."
            title="Valências físicas"
          />
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PHYSICAL_VALENCE_OPTIONS.map((valence) => (
              <label
                className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] px-3 text-sm font-bold"
                key={valence}
              >
                <input
                  checked={draft.valences.includes(valence)}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      valences: event.target.checked
                        ? [...current.valences, valence]
                        : current.valences.filter(
                            (item) => item !== valence,
                          ),
                    }))
                  }
                  type="checkbox"
                />
                {valence}
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Valência personalizada"
              onChange={(event) => setCustomValence(event.target.value)}
              placeholder="Valência personalizada"
              value={customValence}
            />
            <Button
              disabled={!customValence.trim()}
              onClick={() => {
                if (!draft.valences.includes(customValence.trim())) {
                  setDraft((current) => ({
                    ...current,
                    valences: [...current.valences, customValence.trim()],
                  }));
                }
                setCustomValence("");
              }}
              type="button"
              variant="secondary"
            >
              Adicionar personalizada
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.valences
              .filter(
                (item) =>
                  !PHYSICAL_VALENCE_OPTIONS.some(
                    (standard) => standard === item,
                  ),
              )
              .map((item) => (
                <button
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-bold"
                  key={item}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      valences: current.valences.filter(
                        (value) => value !== item,
                      ),
                    }))
                  }
                  type="button"
                >
                  {item} ×
                </button>
              ))}
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <SectionHeader
            description="A periodização formal é opcional. Todos os campos podem permanecer incompletos no rascunho."
            title="Estratégia e periodização"
          />
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField id="program-name" label="Nome do programa">
              <Input
                id="program-name"
                onChange={(event) =>
                  updateStrategy({ programName: event.target.value })
                }
                value={draft.strategy.programName}
              />
            </FormField>
            <FormField id="program-start" label="Data inicial">
              <Input
                id="program-start"
                onChange={(event) =>
                  updateStrategy({ startDate: event.target.value })
                }
                type="date"
                value={draft.strategy.startDate}
              />
            </FormField>
            <FormField id="program-duration" label="Duração prevista">
              <Input
                id="program-duration"
                onChange={(event) =>
                  updateStrategy({ expectedDuration: event.target.value })
                }
                placeholder="Ex.: 8 semanas"
                value={draft.strategy.expectedDuration}
              />
            </FormField>
            <FormField id="weekly-frequency" label="Frequência semanal">
              <NumberInput
                id="weekly-frequency"
                min={1}
                onChange={(event) =>
                  updateStrategy({
                    weeklyFrequency: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
                value={draft.strategy.weeklyFrequency ?? ""}
              />
            </FormField>
            <FormField id="cycle-objective" label="Objetivo do ciclo">
              <Input
                id="cycle-objective"
                onChange={(event) =>
                  updateStrategy({ cycleObjective: event.target.value })
                }
                value={draft.strategy.cycleObjective}
              />
            </FormField>
            <FormField id="training-split" label="Divisão do treino">
              <Input
                id="training-split"
                onChange={(event) =>
                  updateStrategy({ trainingSplit: event.target.value })
                }
                placeholder="Ex.: A/B/C ou personalizada"
                value={draft.strategy.trainingSplit}
              />
            </FormField>
            <FormField id="current-phase" label="Fase atual">
              <Input
                id="current-phase"
                list="performance-phase-options"
                onChange={(event) =>
                  updateStrategy({ currentPhase: event.target.value })
                }
                value={draft.strategy.currentPhase}
              />
              <datalist id="performance-phase-options">
                {PROGRAM_PHASE_OPTIONS.map((phase) => (
                  <option key={phase} value={phase} />
                ))}
              </datalist>
            </FormField>
            <FormField id="current-week" label="Semana atual">
              <NumberInput
                id="current-week"
                min={1}
                onChange={(event) =>
                  updateStrategy({
                    currentWeek: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
                value={draft.strategy.currentWeek ?? ""}
              />
            </FormField>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              ["priorities", "Prioridades"],
              ["restrictions", "Restrições"],
              ["macrocycle", "Macrociclo"],
              ["mesocycle", "Mesociclo"],
              ["microcycle", "Microciclo"],
              ["observations", "Observações"],
            ].map(([key, label]) => (
              <FormField id={`strategy-${key}`} key={key} label={label}>
                <Textarea
                  id={`strategy-${key}`}
                  onChange={(event) =>
                    updateStrategy({
                      [key]: event.target.value,
                    } as Partial<WorkoutPlanDraft["strategy"]>)
                  }
                  value={
                    draft.strategy[
                      key as
                        | "priorities"
                        | "restrictions"
                        | "macrocycle"
                        | "mesocycle"
                        | "microcycle"
                        | "observations"
                    ]
                  }
                />
              </FormField>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black">Ciclos</h3>
            <Button
              onClick={() =>
                updateStrategy({
                  cycles: [...draft.strategy.cycles, emptyCycle()],
                })
              }
              type="button"
              variant="secondary"
            >
              Criar ciclo
            </Button>
          </div>
          <div className="mt-3 space-y-3">
            {draft.strategy.cycles.map((cycle) => (
              <div
                className="grid gap-3 rounded-xl border border-[var(--line)] p-4 md:grid-cols-2 xl:grid-cols-6"
                key={cycle.id}
              >
                <Select
                  aria-label="Nível do ciclo"
                  onChange={(event) =>
                    updateStrategy({
                      cycles: draft.strategy.cycles.map((item) =>
                        item.id === cycle.id
                          ? {
                              ...item,
                              level: event.target
                                .value as PeriodizationCycle["level"],
                            }
                          : item,
                      ),
                    })
                  }
                  value={cycle.level}
                >
                  <option value="MACROCYCLE">Macrociclo</option>
                  <option value="MESOCYCLE">Mesociclo</option>
                  <option value="MICROCYCLE">Microciclo</option>
                </Select>
                {(["name", "startDate", "endDate", "objective"] as const).map(
                  (field) => (
                    <Input
                      aria-label={`${field} do ciclo`}
                      key={field}
                      onChange={(event) =>
                        updateStrategy({
                          cycles: draft.strategy.cycles.map((item) =>
                            item.id === cycle.id
                              ? {
                                  ...item,
                                  [field]: event.target.value,
                                }
                              : item,
                          ),
                        })
                      }
                      type={
                        field === "startDate" || field === "endDate"
                          ? "date"
                          : "text"
                      }
                      value={cycle[field]}
                    />
                  ),
                )}
                <Button
                  onClick={() =>
                    updateStrategy({
                      cycles: draft.strategy.cycles.filter(
                        (item) => item.id !== cycle.id,
                      ),
                    })
                  }
                  type="button"
                  variant="ghost"
                >
                  Excluir
                </Button>
                <Textarea
                  aria-label="Observações do ciclo"
                  className="md:col-span-2 xl:col-span-6"
                  onChange={(event) =>
                    updateStrategy({
                      cycles: draft.strategy.cycles.map((item) =>
                        item.id === cycle.id
                          ? {
                              ...item,
                              observations: event.target.value,
                            }
                          : item,
                      ),
                    })
                  }
                  placeholder="Observações do ciclo"
                  value={cycle.observations}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <SectionHeader
            description="O Modo livre é independente de IA, protocolos ou biblioteca."
            title="Modo de montagem"
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WORKOUT_START_MODES.map((mode) => (
              <label
                className={`rounded-xl border p-4 text-sm font-black ${
                  draft.startMode === mode
                    ? "border-[var(--primary)] bg-[var(--secondary)] text-[var(--primary)]"
                    : "border-[var(--line)]"
                }`}
                key={mode}
              >
                <input
                  checked={draft.startMode === mode}
                  className="mr-2"
                  name="workout-start-mode"
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      startMode: mode,
                    }))
                  }
                  type="radio"
                />
                {WORKOUT_START_MODE_LABELS[mode]}
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader
              description="Métodos personalizados ficam disponíveis imediatamente na prescrição e alimentam o glossário do PDF."
              title="Métodos de treinamento"
            />
            <Button
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  customMethods: [
                    ...current.customMethods,
                    emptyCustomMethod(),
                  ],
                }))
              }
              type="button"
              variant="secondary"
            >
              Criar método personalizado
            </Button>
          </div>
          <div className="mt-5 space-y-3">
            {draft.customMethods.map((method) => (
              <div
                className="grid gap-3 rounded-xl border border-[var(--line)] p-4 md:grid-cols-2"
                key={method.id}
              >
                {[
                  ["name", "Nome"],
                  ["studentExplanation", "Explicação para o aluno"],
                  ["executionInstruction", "Instrução de execução"],
                  ["objective", "Objetivo"],
                  ["professionalObservation", "Observação profissional"],
                ].map(([field, label]) => (
                  <FormField
                    id={`${method.id}-${field}`}
                    key={field}
                    label={label}
                  >
                    <Input
                      id={`${method.id}-${field}`}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          customMethods: current.customMethods.map((item) =>
                            item.id === method.id
                              ? {
                                  ...item,
                                  [field]: event.target.value,
                                }
                              : item,
                          ),
                        }))
                      }
                      value={
                        method[
                          field as
                            | "name"
                            | "studentExplanation"
                            | "executionInstruction"
                            | "objective"
                            | "professionalObservation"
                        ]
                      }
                    />
                  </FormField>
                ))}
                <div className="md:col-span-2 md:text-right">
                  <Button
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        customMethods: current.customMethods.filter(
                          (item) => item.id !== method.id,
                        ),
                        sessions: current.sessions.map((session) => ({
                          ...session,
                          exercises: session.exercises.map((exercise) =>
                            exercise.methodId === method.id
                              ? { ...exercise, methodId: "" }
                              : exercise,
                          ),
                        })),
                      }))
                    }
                    type="button"
                    variant="ghost"
                  >
                    Excluir método
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader
              description="Prescrição manual aberta. Nenhum parâmetro obriga o preenchimento dos demais."
              title="Construtor de treino"
            />
            <div className="flex flex-wrap gap-2">
              {["Treino A", "Treino B", "Treino C", "Treino D"].map(
                (name) => (
                  <Button
                    key={name}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        sessions: [
                          ...current.sessions,
                          emptySession(name),
                        ],
                      }))
                    }
                    type="button"
                    variant="secondary"
                  >
                    + {name}
                  </Button>
                ),
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Nome personalizado do treino"
              onChange={(event) =>
                setCustomSessionName(event.target.value)
              }
              placeholder="Nome personalizado"
              value={customSessionName}
            />
            <Button
              disabled={!customSessionName.trim()}
              onClick={() => {
                setDraft((current) => ({
                  ...current,
                  sessions: [
                    ...current.sessions,
                    emptySession(customSessionName.trim()),
                  ],
                }));
                setCustomSessionName("");
              }}
              type="button"
              variant="secondary"
            >
              Criar treino personalizado
            </Button>
          </div>

          <datalist id="exercise-library-options">
            {library.map((exercise) => (
              <option key={exercise.id} value={exercise.name} />
            ))}
          </datalist>

          <div className="mt-5 space-y-5">
            {draft.sessions.map((session) => {
              const exerciseName = exerciseNames[session.id] ?? "";
              const match = libraryMatch(library, exerciseName);
              return (
                <section
                  className="rounded-2xl border border-[var(--line)] p-4"
                  key={session.id}
                >
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <FormField
                      id={`${session.id}-name`}
                      label="Nome do treino"
                    >
                      <Input
                        id={`${session.id}-name`}
                        onChange={(event) =>
                          updateSession(session.id, {
                            name: event.target.value,
                          })
                        }
                        value={session.name}
                      />
                    </FormField>
                    <FormField
                      id={`${session.id}-objective`}
                      label="Objetivo"
                    >
                      <Input
                        id={`${session.id}-objective`}
                        onChange={(event) =>
                          updateSession(session.id, {
                            objective: event.target.value,
                          })
                        }
                        value={session.objective}
                      />
                    </FormField>
                    <div className="self-end">
                      <Button
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            sessions: current.sessions.filter(
                              (item) => item.id !== session.id,
                            ),
                          }))
                        }
                        type="button"
                        variant="ghost"
                      >
                        Excluir treino
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-[var(--surface-elevated)] p-3">
                    <label
                      className="text-xs font-black"
                      htmlFor={`${session.id}-exercise-search`}
                    >
                      Pesquisar ou digitar qualquer exercício
                    </label>
                    <div className="mt-2 flex flex-col gap-2 lg:flex-row">
                      <Input
                        id={`${session.id}-exercise-search`}
                        list="exercise-library-options"
                        onChange={(event) =>
                          setExerciseNames((current) => ({
                            ...current,
                            [session.id]: event.target.value,
                          }))
                        }
                        placeholder="Nome livre do exercício"
                        value={exerciseName}
                      />
                      <Button
                        disabled={!exerciseName.trim()}
                        onClick={() =>
                          addExercise(
                            session.id,
                            exerciseName,
                            match?.id,
                          )
                        }
                        type="button"
                        variant="secondary"
                      >
                        Adicionar apenas neste treino
                      </Button>
                      {!match && exerciseName.trim() ? (
                        <Button
                          disabled={saving}
                          onClick={() =>
                            void addExerciseAndSave(
                              session.id,
                              exerciseName,
                            )
                          }
                          type="button"
                        >
                          Adicionar e salvar na biblioteca
                        </Button>
                      ) : null}
                    </div>
                    {exerciseName.trim() && !match ? (
                      <p className="mt-2 text-xs font-bold text-amber-800">
                        Este exercício não está na biblioteca.
                      </p>
                    ) : match ? (
                      <p className="mt-2 text-xs font-bold text-emerald-700">
                        Exercício localizado na biblioteca.
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-4">
                    {session.exercises.map((exercise, exerciseIndex) => (
                      <article
                        className="rounded-xl border border-[var(--line)] p-4"
                        key={exercise.id}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-black">
                            {exercise.order}.{" "}
                            {exercise.name || "Exercício sem nome"}
                          </h4>
                          <div className="flex gap-2">
                            <Button
                              aria-label={`Mover ${exercise.name} para cima`}
                              disabled={exerciseIndex === 0}
                              onClick={() =>
                                moveExercise(
                                  session.id,
                                  exercise.id,
                                  -1,
                                )
                              }
                              type="button"
                              variant="secondary"
                            >
                              ↑
                            </Button>
                            <Button
                              aria-label={`Mover ${exercise.name} para baixo`}
                              disabled={
                                exerciseIndex ===
                                session.exercises.length - 1
                              }
                              onClick={() =>
                                moveExercise(
                                  session.id,
                                  exercise.id,
                                  1,
                                )
                              }
                              type="button"
                              variant="secondary"
                            >
                              ↓
                            </Button>
                            <Button
                              onClick={() =>
                                updateSession(session.id, {
                                  exercises: session.exercises
                                    .filter(
                                      (item) =>
                                        item.id !== exercise.id,
                                    )
                                    .map((item, index) => ({
                                      ...item,
                                      order: index + 1,
                                    })),
                                })
                              }
                              type="button"
                              variant="ghost"
                            >
                              Remover
                            </Button>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {[
                            ["name", "Exercício"],
                            ["prescription", "Prescrição livre"],
                            ["sets", "Séries"],
                            ["repetitions", "Repetições ou faixa"],
                            ["load", "Carga"],
                            ["restInterval", "Intervalo"],
                            ["cadence", "Cadência"],
                            ["rangeOfMotion", "Amplitude"],
                            ["substituteExercise", "Exercício substituto"],
                          ].map(([field, label]) => (
                            <FormField
                              id={`${exercise.id}-${field}`}
                              key={field}
                              label={label}
                            >
                              <Input
                                id={`${exercise.id}-${field}`}
                                onChange={(event) =>
                                  updateExercise(
                                    session.id,
                                    exercise.id,
                                    {
                                      [field]: event.target.value,
                                    },
                                  )
                                }
                                placeholder={
                                  field === "prescription"
                                    ? "Ex.: 3 séries até RIR 2"
                                    : undefined
                                }
                                value={
                                  exercise[
                                    field as
                                      | "name"
                                      | "prescription"
                                      | "sets"
                                      | "repetitions"
                                      | "load"
                                      | "restInterval"
                                      | "cadence"
                                      | "rangeOfMotion"
                                      | "substituteExercise"
                                  ]
                                }
                              />
                            </FormField>
                          ))}
                          <FormField
                            id={`${exercise.id}-intensity-type`}
                            label="Tipo de intensidade"
                          >
                            <Select
                              id={`${exercise.id}-intensity-type`}
                              onChange={(event) =>
                                updateExercise(
                                  session.id,
                                  exercise.id,
                                  {
                                    intensityType: event.target
                                      .value as WorkoutExercise["intensityType"],
                                  },
                                )
                              }
                              value={exercise.intensityType}
                            >
                              <option value="">Não utilizada</option>
                              <option value="PERCENT_1RM">% de 1RM</option>
                              <option value="RPE">RPE</option>
                              <option value="RIR">RIR</option>
                            </Select>
                          </FormField>
                          <FormField
                            id={`${exercise.id}-intensity-value`}
                            label="Intensidade"
                          >
                            <Input
                              id={`${exercise.id}-intensity-value`}
                              onChange={(event) =>
                                updateExercise(
                                  session.id,
                                  exercise.id,
                                  {
                                    intensityValue: event.target.value,
                                  },
                                )
                              }
                              value={exercise.intensityValue}
                            />
                          </FormField>
                          <FormField
                            id={`${exercise.id}-method`}
                            label="Método"
                          >
                            <Select
                              id={`${exercise.id}-method`}
                              onChange={(event) =>
                                updateExercise(
                                  session.id,
                                  exercise.id,
                                  { methodId: event.target.value },
                                )
                              }
                              value={exercise.methodId}
                            >
                              <option value="">Sem método específico</option>
                              {allMethods.map((method) => (
                                <option key={method.id} value={method.id}>
                                  {method.name || "Método sem nome"}
                                </option>
                              ))}
                            </Select>
                          </FormField>
                          <FormField
                            id={`${exercise.id}-observations`}
                            label="Observações"
                          >
                            <Input
                              id={`${exercise.id}-observations`}
                              onChange={(event) =>
                                updateExercise(
                                  session.id,
                                  exercise.id,
                                  { observations: event.target.value },
                                )
                              }
                              value={exercise.observations}
                            />
                          </FormField>
                        </div>
                      </article>
                    ))}
                  </div>
                  <FormField
                    id={`${session.id}-observations`}
                    label="Observações do treino"
                  >
                    <Textarea
                      id={`${session.id}-observations`}
                      onChange={(event) =>
                        updateSession(session.id, {
                          observations: event.target.value,
                        })
                      }
                      value={session.observations}
                    />
                  </FormField>
                </section>
              );
            })}
          </div>
        </Card>
      </fieldset>

      <Card className="p-5 md:p-6">
        <SectionHeader
          description="Estrutura pronta para o gerador de PDF. Somente métodos realmente usados são incluídos, sem duplicação."
          title="Como executar os métodos deste treino"
        />
        {glossary.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {glossary.map((method) => (
              <article
                className="rounded-xl border border-[var(--line)] p-4"
                key={method.methodId}
              >
                <h3 className="font-black">{method.name}</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {method.studentExplanation}
                </p>
                <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                  Execução: {method.executionInstruction}
                </p>
                <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                  Objetivo: {method.objective}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Nenhum método específico utilizado no treino.
          </p>
        )}
      </Card>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white/95 p-3 shadow-[var(--shadow-medium)] backdrop-blur">
        <p
          aria-live="polite"
          className="text-xs font-bold text-[var(--text-secondary)]"
        >
          {message ||
            "O rascunho pode ser salvo incompleto e continuado depois."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={saving || finalized}
            onClick={() => void save("SAVE_DRAFT")}
            type="button"
            variant="secondary"
          >
            {saving ? "Salvando..." : "Salvar rascunho"}
          </Button>
          <Button
            disabled={saving || finalized}
            onClick={() => void save("FINALIZE")}
            type="button"
          >
            Finalizar Plano de Treino
          </Button>
        </div>
      </div>
    </div>
  );
}
