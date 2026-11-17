"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import {
  calculatePosturalEvolutionIndicators,
  comparePosturalFindings,
  filterPosturalHistory,
  generatePosturalEvolutionSummary,
  generatePosturalTechnicalSummary,
  type PosturalEvolutionClassification,
  type PosturalHistoryFilter,
  type PosturalHistoryItem,
  type PosturalSegmentAssessment,
  type PosturalSymmetrograph,
  type PosturalViewKey,
  type SavedPosturalEvolutionComparison,
} from "@/features/clinical-collection";
import { developmentUserRequestHeaders } from "@/features/development-session";

import {
  DEFAULT_POSTURAL_VIEWPORT_STATE,
  PosturalImageInspectionViewer,
  type PosturalViewportState,
} from "./postural-image-viewer";

interface EvolutionPayload {
  readonly history: readonly PosturalHistoryItem[];
  readonly comparisons: readonly SavedPosturalEvolutionComparison[];
}

const viewLabels: Readonly<Record<PosturalViewKey, string>> = {
  ANTERIOR: "Vista anterior",
  POSTERIOR: "Vista posterior",
  RIGHT_LATERAL: "Vista lateral direita",
  LEFT_LATERAL: "Vista lateral esquerda",
};

const classificationLabels: Readonly<
  Record<PosturalEvolutionClassification, string>
> = {
  PROGRESS: "Aparentemente melhor",
  PARTIAL_PROGRESS: "Aparentemente melhor",
  STABLE: "Aparentemente estável",
  REGRESSION: "Aparentemente mais evidente",
  NOT_COMPARABLE: "Não comparável",
  NOT_INFORMED: "Não informado",
};

const situationLabels = {
  RESOLVED: "Achado não observado no registro atual",
  IMPROVED: "Redução aparente do grau registrado",
  UNCHANGED: "Sem alteração observada",
  WORSENED: "Aumento aparente do grau registrado",
  NEW: "Novo achado registrado",
  CHANGED: "Registro diferente, requer avaliação profissional",
  NOT_COMPARABLE: "Não comparável",
  NOT_INFORMED: "Não informado em uma das avaliações",
} as const;

type ComparisonFindingFilter =
  | "ALL"
  | "CHANGES"
  | "PROGRESS"
  | "STABLE"
  | "REGRESSION"
  | "NOT_COMPARABLE";

const comparisonFilterLabels: Readonly<
  Record<ComparisonFindingFilter, string>
> = {
  ALL: "Todos os segmentos",
  CHANGES: "Apenas alterações",
  PROGRESS: "Apenas melhora aparente",
  STABLE: "Apenas estabilidade aparente",
  REGRESSION: "Apenas maior evidência",
  NOT_COMPARABLE: "Apenas não comparáveis",
};

const filterLabels: Readonly<Record<PosturalHistoryFilter, string>> = {
  ALL: "Todas as avaliações",
  COMPLETED: "Apenas concluídas",
  LAST_30_DAYS: "Últimos 30 dias",
  LAST_90_DAYS: "Últimos 90 dias",
  LAST_YEAR: "Último ano",
  CUSTOM: "Intervalo personalizado",
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function shortDate(value?: string) {
  return value
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(value))
    : "Não informado";
}

function statusLabel(item: PosturalHistoryItem) {
  return item.status === "FINALIZED" ||
    item.data.completionStatus === "COMPLETED"
    ? "Concluída"
    : "Em andamento";
}

function optionalFindingValue(value?: string) {
  return value?.trim() || "Não informado";
}

function gradeLabel(value?: PosturalSegmentAssessment["grade"]) {
  return value
    ? {
        DISCREET: "Discreto",
        MODERATE: "Moderado",
        ACCENTUATED: "Acentuado",
      }[value]
    : "Não informado";
}

function relevanceLabel(
  value?: PosturalSegmentAssessment["relevance"],
) {
  return value
    ? {
        NONE: "Sem relevância",
        LOW: "Baixa",
        MODERATE: "Moderada",
        HIGH: "Alta",
      }[value]
    : "Não informado";
}

function intervalLabel(first: string, second: string) {
  const milliseconds = Math.abs(
    new Date(second).getTime() - new Date(first).getTime(),
  );
  const days = Math.floor(milliseconds / 86_400_000);
  if (days < 1) {
    const hours = Math.max(1, Math.round(milliseconds / 3_600_000));
    return `${hours} hora${hours === 1 ? "" : "s"}`;
  }
  return `${days} dia${days === 1 ? "" : "s"}`;
}

function PhotoPair({
  current,
  currentDate,
  previous,
  previousDate,
  synchronized,
  title,
}: {
  current: PosturalHistoryItem["data"]["views"][PosturalViewKey];
  currentDate: string;
  previous: PosturalHistoryItem["data"]["views"][PosturalViewKey];
  previousDate: string;
  synchronized: boolean;
  title: string;
}) {
  const [previousViewport, setPreviousViewport] =
    useState<PosturalViewportState>(DEFAULT_POSTURAL_VIEWPORT_STATE);
  const [currentViewport, setCurrentViewport] =
    useState<PosturalViewportState>(DEFAULT_POSTURAL_VIEWPORT_STATE);
  const [previousGrid, setPreviousGrid] = useState<PosturalSymmetrograph>(
    previous.symmetrograph ?? { enabled: false, opacity: 0.35 },
  );
  const [currentGrid, setCurrentGrid] = useState<PosturalSymmetrograph>(
    current.symmetrograph ?? { enabled: false, opacity: 0.35 },
  );

  function viewport(
    side: "previous" | "current",
    value: PosturalViewportState,
  ) {
    if (synchronized) {
      setPreviousViewport(value);
      setCurrentViewport(value);
    } else if (side === "previous") setPreviousViewport(value);
    else setCurrentViewport(value);
  }

  function grid(
    side: "previous" | "current",
    value: PosturalSymmetrograph,
  ) {
    if (synchronized) {
      setPreviousGrid(value);
      setCurrentGrid(value);
    } else if (side === "previous") setPreviousGrid(value);
    else setCurrentGrid(value);
  }

  const panels = [
    {
      key: "previous" as const,
      label: "Antes",
      assessedAt: previousDate,
      image: previous.image,
      grid: previousGrid,
      viewport: previousViewport,
    },
    {
      key: "current" as const,
      label: "Atual",
      assessedAt: currentDate,
      image: current.image,
      grid: synchronized ? previousGrid : currentGrid,
      viewport: synchronized ? previousViewport : currentViewport,
    },
  ];

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h3 className="text-base font-black text-slate-900">{title}</h3>
      <div className="grid gap-4 xl:grid-cols-2">
        {panels.map((panel) => (
          <div className="space-y-3" key={panel.key}>
            <p className="text-center text-xs font-black uppercase tracking-wide text-slate-500">
              {panel.label} · {dateTime(panel.assessedAt)}
            </p>
            {panel.image ? (
              <PosturalImageInspectionViewer
                imageUrl={panel.image.dataUrl}
                inspection
                onViewportChange={(value) =>
                  viewport(panel.key, value)
                }
                symmetrograph={panel.grid}
                title={`${title} · ${panel.label}`}
                viewportState={panel.viewport}
              />
            ) : (
              <div className="flex min-h-80 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                Fotografia não registrada nesta avaliação.
              </div>
            )}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input
                  checked={panel.grid.enabled}
                  onChange={(event) =>
                    grid(panel.key, {
                      ...panel.grid,
                      enabled: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                Exibir Simetrógrafo
              </label>
              <input
                aria-label={`Transparência do simetrógrafo ${panel.label}`}
                className="mt-2 w-full accent-[#12664f]"
                disabled={!panel.grid.enabled}
                max="1"
                min="0.1"
                onChange={(event) =>
                  grid(panel.key, {
                    ...panel.grid,
                    opacity: Number(event.target.value),
                  })
                }
                step="0.05"
                type="range"
                value={panel.grid.opacity}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AssessmentViewer({
  assessment,
  onClose,
}: {
  assessment: PosturalHistoryItem;
  onClose: () => void;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () =>
      document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 p-[5vh_5vw]"
      role="dialog"
    >
      <div className="mx-auto max-w-6xl space-y-5 rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              Avaliação postural
            </h2>
            <p className="text-sm text-slate-600">
              {dateTime(assessment.assessedAt)} ·{" "}
              {assessment.audit.professionalName}
            </p>
          </div>
          <Button onClick={onClose} type="button" variant="outline">
            Fechar
          </Button>
        </div>
        {(Object.keys(viewLabels) as PosturalViewKey[]).map((view) =>
          assessment.data.views[view].image ? (
            <section className="space-y-2" key={view}>
              <h3 className="font-black text-slate-800">
                {viewLabels[view]}
              </h3>
              <PosturalImageInspectionViewer
                imageUrl={assessment.data.views[view].image!.dataUrl}
                inspection
                symmetrograph={
                  assessment.data.views[view].symmetrograph ?? {
                    enabled: false,
                    opacity: 0.35,
                  }
                }
                title={viewLabels[view]}
              />
            </section>
          ) : null,
        )}
        <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-sm leading-6 text-slate-700">
          {assessment.data.technicalSummary?.editedSummary ??
            assessment.data.technicalSummary?.generatedOriginal ??
            "Resumo não registrado."}
        </pre>
      </div>
    </div>
  );
}

function TextViewer({
  content,
  onClose,
  title,
}: {
  content: string;
  onClose: () => void;
  title: string;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () =>
      document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
      role="dialog"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-black text-slate-900">{title}</h2>
          <Button onClick={onClose} type="button" variant="outline">
            Fechar
          </Button>
        </div>
        <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-sm leading-6 text-slate-700">
          {content}
        </pre>
      </div>
    </div>
  );
}

function ComparisonWorkspace({
  initialCurrentId,
  initialPreviousId,
  payload,
  patientId,
  onClose,
  onSaved,
}: {
  initialCurrentId: string;
  initialPreviousId: string;
  payload: EvolutionPayload;
  patientId: string;
  onClose: () => void;
  onSaved: (value: SavedPosturalEvolutionComparison) => void;
}) {
  const [previousId, setPreviousId] = useState(initialPreviousId);
  const [currentId, setCurrentId] = useState(initialCurrentId);
  const [synchronized, setSynchronized] = useState(false);
  const previous = payload.history.find(
    (item) => item.assessmentId === previousId,
  )!;
  const current = payload.history.find(
    (item) => item.assessmentId === currentId,
  )!;
  const stored = payload.comparisons.find(
    (item) =>
      item.previousAssessmentId === previousId &&
      item.currentAssessmentId === currentId,
  );
  const comparisons = useMemo(
    () => comparePosturalFindings(previous.data, current.data),
    [previous, current],
  );
  const [classifications, setClassifications] = useState<
    Record<string, PosturalEvolutionClassification>
  >({});
  const [generatedSummary, setGeneratedSummary] = useState("");
  const [summary, setSummary] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [summaryEdited, setSummaryEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [findingFilter, setFindingFilter] =
    useState<ComparisonFindingFilter>("ALL");
  const [segmentSearch, setSegmentSearch] = useState("");

  const classifiedComparisons = useMemo(
    () =>
      comparisons.map((comparison) => ({
        ...comparison,
        classification:
          classifications[comparison.key] ??
          comparison.suggestedClassification,
      })),
    [classifications, comparisons],
  );
  const filteredComparisons = useMemo(
    () =>
      classifiedComparisons.filter((comparison) => {
        const matchesSearch = comparison.segmentName
          .toLocaleLowerCase("pt-BR")
          .includes(segmentSearch.trim().toLocaleLowerCase("pt-BR"));
        if (!matchesSearch) return false;
        if (findingFilter === "ALL") return true;
        if (findingFilter === "CHANGES") {
          return comparison.classification !== "STABLE";
        }
        if (findingFilter === "PROGRESS") {
          return (
            comparison.classification === "PROGRESS" ||
            comparison.classification === "PARTIAL_PROGRESS"
          );
        }
        return comparison.classification === findingFilter;
      }),
    [classifiedComparisons, findingFilter, segmentSearch],
  );
  const indicators = useMemo(
    () => ({
      total: classifiedComparisons.length,
      progress: classifiedComparisons.filter(
        (item) =>
          item.classification === "PROGRESS" ||
          item.classification === "PARTIAL_PROGRESS",
      ).length,
      stable: classifiedComparisons.filter(
        (item) => item.classification === "STABLE",
      ).length,
      regression: classifiedComparisons.filter(
        (item) => item.classification === "REGRESSION",
      ).length,
      notComparable: classifiedComparisons.filter(
        (item) => item.classification === "NOT_COMPARABLE",
      ).length,
      notInformed: classifiedComparisons.filter(
        (item) => item.classification === "NOT_INFORMED",
      ).length,
    }),
    [classifiedComparisons],
  );

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () =>
      document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setClassifications(
        stored?.classifications ??
          Object.fromEntries(
            comparisons.map((item) => [
              item.key,
              item.suggestedClassification,
            ]),
          ),
      );
      setGeneratedSummary(stored?.generatedSummary ?? "");
      setSummary(
        stored?.editedSummary ?? stored?.generatedSummary ?? "",
      );
      setConclusion(stored?.evaluatorConclusion ?? "");
      setSynchronized(
        stored?.visualSettings?.synchronized ?? false,
      );
      setSummaryEdited(
        Boolean(
          stored?.editedSummary &&
            stored.editedSummary !== stored.generatedSummary,
        ),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [comparisons, stored]);

  function generateSummary() {
    if (
      summaryEdited &&
      !window.confirm(
        "O resumo possui alterações manuais. Deseja substituí-lo por uma nova versão gerada a partir dos achados atuais?",
      )
    ) {
      return;
    }
    const generated =
      generatePosturalEvolutionSummary(
        comparisons,
        classifications,
        {
          previousAssessedAt: previous.assessedAt,
          currentAssessedAt: current.assessedAt,
        },
      ) ?? "";
    setGeneratedSummary(generated);
    setSummary(generated);
    setSummaryEdited(false);
  }

  async function save(section: "COMPARISON" | "SUMMARY" | "CONCLUSION") {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/patients/${patientId}/postural-evolution`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...developmentUserRequestHeaders(),
          },
          body: JSON.stringify({
            previousAssessmentId: previousId,
            currentAssessmentId: currentId,
            classifications,
            visualSettings: { synchronized },
            generatedSummary: generatedSummary || undefined,
            editedSummary: summary || undefined,
            evaluatorConclusion: conclusion || undefined,
            generatedAt: generatedSummary
              ? new Date().toISOString()
              : undefined,
          }),
        },
      );
      const body = (await response.json()) as
        | SavedPosturalEvolutionComparison
        | { message?: string };
      if (!response.ok) {
        throw new Error(
          "message" in body
            ? body.message
            : "Não foi possível salvar.",
        );
      }
      onSaved(body as SavedPosturalEvolutionComparison);
      setSummaryEdited(false);
      setMessage(
        section === "SUMMARY"
          ? "Resumo da evolução salvo e versionado."
          : section === "CONCLUSION"
            ? "Conclusão da evolução salva e versionada."
            : "Comparação salva.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 p-[3vh_3vw]"
      role="dialog"
    >
      <div className="mx-auto max-w-[1500px] space-y-5 rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              Comparação da evolução postural
            </h2>
            <p className="text-sm text-slate-600">
              Avaliação A × Avaliação B
            </p>
          </div>
          <Button onClick={onClose} type="button" variant="outline">
            Fechar
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-black text-slate-700">
            Avaliação A
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
              onChange={(event) => setPreviousId(event.target.value)}
              value={previousId}
            >
              {payload.history
                .filter((item) => item.assessmentId !== currentId)
                .map((item) => (
                  <option key={item.assessmentId} value={item.assessmentId}>
                    {dateTime(item.assessedAt)}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm font-black text-slate-700">
            Avaliação B
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
              onChange={(event) => setCurrentId(event.target.value)}
              value={currentId}
            >
              {payload.history
                .filter((item) => item.assessmentId !== previousId)
                .map((item) => (
                  <option key={item.assessmentId} value={item.assessmentId}>
                    {dateTime(item.assessedAt)}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div>
            <p className="text-xs font-black uppercase text-slate-500">
              Avaliação inicial
            </p>
            <p className="font-black text-slate-900">
              {dateTime(previous.assessedAt)}
            </p>
            <p className="text-sm text-slate-600">
              {previous.audit.professionalName}
            </p>
          </div>
          <p className="text-center text-sm font-black text-[#12664f]">
            Intervalo:{" "}
            {intervalLabel(previous.assessedAt, current.assessedAt)}
          </p>
          <div className="md:text-right">
            <p className="text-xs font-black uppercase text-slate-500">
              Avaliação comparativa
            </p>
            <p className="font-black text-slate-900">
              {dateTime(current.assessedAt)}
            </p>
            <p className="text-sm text-slate-600">
              {current.audit.professionalName}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-950">
          <input
            checked={synchronized}
            onChange={(event) => setSynchronized(event.target.checked)}
            type="checkbox"
          />
          Sincronizar comparação (zoom, pan e simetrógrafo)
        </label>

        {(Object.keys(viewLabels) as PosturalViewKey[]).map((view) => (
          <PhotoPair
            current={current.data.views[view]}
            currentDate={current.assessedAt}
            key={`${previousId}:${currentId}:${view}`}
            previous={previous.data.views[view]}
            previousDate={previous.assessedAt}
            synchronized={synchronized}
            title={viewLabels[view]}
          />
        ))}

        <section className="space-y-3">
          <h3 className="text-lg font-black text-slate-900">
            Comparação dos achados
          </h3>
          <p className="text-sm text-slate-600">
            Classificações observacionais de apoio. A interpretação
            permanece sob responsabilidade da profissional.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ["Segmentos comparados", indicators.total],
              ["Melhora aparente", indicators.progress],
              ["Estabilidade aparente", indicators.stable],
              ["Maior evidência", indicators.regression],
              ["Não comparáveis", indicators.notComparable],
              ["Não informados", indicators.notInformed],
            ].map(([label, value]) => (
              <div
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                key={label}
              >
                <p className="text-xs font-black uppercase text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-black text-slate-700">
              Filtrar comparação
              <select
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
                onChange={(event) =>
                  setFindingFilter(
                    event.target.value as ComparisonFindingFilter,
                  )
                }
                value={findingFilter}
              >
                {Object.entries(comparisonFilterLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-sm font-black text-slate-700">
              Buscar segmento corporal
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"
                onChange={(event) => setSegmentSearch(event.target.value)}
                placeholder="Ex.: ombros"
                type="search"
                value={segmentSearch}
              />
            </label>
          </div>
          {comparisons.length ? (
            <div className="space-y-3">
              {filteredComparisons.map((comparison) => (
                <article
                  className="space-y-4 rounded-xl border border-slate-200 p-4"
                  key={comparison.key}
                >
                  <p className="font-black text-slate-900">
                    {viewLabels[comparison.view]} ·{" "}
                    {comparison.segmentName}
                  </p>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {[
                      ["Avaliação inicial", comparison.previous],
                      ["Avaliação comparativa", comparison.current],
                    ].map(([label, finding]) => {
                      const value = finding as
                        | PosturalSegmentAssessment
                        | undefined;
                      return (
                        <div
                          className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600"
                          key={String(label)}
                        >
                          <p className="font-black text-slate-800">
                            {String(label)}
                          </p>
                          <p>
                            Achado:{" "}
                            {optionalFindingValue(value?.selectedOption)}
                          </p>
                          <p>Graduação: {gradeLabel(value?.grade)}</p>
                          <p>
                            Observações:{" "}
                            {optionalFindingValue(value?.observation)}
                          </p>
                          <p>
                            Relevância:{" "}
                            {relevanceLabel(value?.relevance)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2 lg:items-end">
                    <p className="text-sm text-slate-600">
                      Apoio observacional:{" "}
                      <strong>
                        {situationLabels[comparison.situation]}
                      </strong>
                      . Requer nova investigação quando não houver dados
                      comparáveis.
                    </p>
                    <label className="text-sm font-black text-slate-700">
                      Classificação editável
                      <select
                        className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
                        onChange={(event) =>
                          setClassifications((value) => ({
                            ...value,
                            [comparison.key]: event.target
                              .value as PosturalEvolutionClassification,
                          }))
                        }
                        value={comparison.classification}
                      >
                        {Object.entries(classificationLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                </article>
              ))}
              {filteredComparisons.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                  Nenhum segmento corresponde aos filtros selecionados.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              Não existem achados registrados nas avaliações selecionadas.
            </p>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-black text-slate-700">
            Resumo da evolução
            <textarea
              className="mt-1 min-h-52 w-full resize-y rounded-xl border border-slate-300 p-3 font-normal"
              onChange={(event) => {
                setSummary(event.target.value);
                setSummaryEdited(
                  event.target.value !== generatedSummary,
                );
              }}
              value={summary}
            />
            <Button
              className="mt-2"
              disabled={!comparisons.length}
              onClick={generateSummary}
              type="button"
              variant="outline"
            >
              Gerar resumo evolutivo
            </Button>
            <Button
              className="ml-2 mt-2"
              disabled={!summary.trim()}
              loading={saving}
              onClick={() => save("SUMMARY")}
              type="button"
              variant="outline"
            >
              Confirmar e salvar resumo
            </Button>
          </label>
          <label className="text-sm font-black text-slate-700">
            Conclusão evolutiva
            <textarea
              className="mt-1 min-h-52 w-full resize-y rounded-xl border border-slate-300 p-3 font-normal"
              onChange={(event) => setConclusion(event.target.value)}
              placeholder="Campo manual e opcional do avaliador."
              value={conclusion}
            />
            <Button
              className="mt-2"
              disabled={!conclusion.trim()}
              loading={saving}
              onClick={() => save("CONCLUSION")}
              type="button"
              variant="outline"
            >
              Salvar conclusão
            </Button>
          </label>
        </section>

        {stored ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Última revisão: <strong>{stored.professionalName}</strong>
            {stored.professionalTitle
              ? ` · ${stored.professionalTitle}`
              : ""}
            {stored.professionalRegistration
              ? ` · ${stored.professionalRegistration}`
              : ""}
            {` · ${dateTime(stored.updatedAt)}`}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {message ? (
            <p aria-live="polite" className="text-sm font-bold text-slate-600">
              {message}
            </p>
          ) : null}
          <Button
            loading={saving}
            onClick={() => save("COMPARISON")}
            type="button"
          >
            Salvar comparação
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PosturalEvolutionSection({
  patientId,
}: {
  patientId: string;
}) {
  const [payload, setPayload] = useState<EvolutionPayload>();
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<PosturalHistoryFilter>("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewing, setViewing] = useState<PosturalHistoryItem>();
  const [viewingText, setViewingText] = useState<{
    title: string;
    content: string;
  }>();
  const [selectedPreviousId, setSelectedPreviousId] = useState("");
  const [selectedCurrentId, setSelectedCurrentId] = useState("");
  const [comparisonPair, setComparisonPair] = useState<{
    previousId: string;
    currentId: string;
  }>();

  useEffect(() => {
    let active = true;
    fetch(`/api/patients/${patientId}/postural-evolution`, {
      headers: developmentUserRequestHeaders(),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message);
        return body as EvolutionPayload;
      })
      .then((body) => {
        if (active) {
          setPayload(body);
          if (body.history.length >= 2) {
            setSelectedPreviousId(body.history[0]!.assessmentId);
            setSelectedCurrentId(body.history.at(-1)!.assessmentId);
          }
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar o histórico.",
          );
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  const visibleHistory = useMemo(
    () =>
      filterPosturalHistory(payload?.history ?? [], filter, new Date(), {
        from: from || undefined,
        to: to || undefined,
      }),
    [filter, from, payload?.history, to],
  );
  const indicators = useMemo(
    () => calculatePosturalEvolutionIndicators(payload?.history ?? []),
    [payload?.history],
  );
  const recentHistory = useMemo(
    () => [...visibleHistory].reverse(),
    [visibleHistory],
  );

  function compareWith(item: PosturalHistoryItem) {
    if (!payload || payload.history.length < 2) return;
    const initial = payload.history[0];
    const current = payload.history.at(-1)!;
    setComparisonPair({
      previousId:
        item.assessmentId === initial.assessmentId
          ? initial.assessmentId
          : initial.assessmentId,
      currentId:
        item.assessmentId === initial.assessmentId
          ? current.assessmentId
          : item.assessmentId,
    });
  }

  if (error) {
    return (
      <p className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800">
        {error}
      </p>
    );
  }
  if (!payload) {
    return (
      <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
        Carregando histórico postural...
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Primeira avaliação", shortDate(indicators.firstAssessmentAt)],
          ["Última avaliação", shortDate(indicators.latestAssessmentAt)],
          ["Número de avaliações", String(indicators.assessmentCount)],
          ["Achados ativos", String(indicators.activeFindings)],
          ["Achados resolvidos", String(indicators.resolvedFindings)],
          ["Novos achados", String(indicators.newFindings)],
        ].map(([label, value]) => (
          <div className="rounded-xl border border-slate-200 p-3" key={label}>
            <p className="text-xs font-black uppercase text-slate-500">
              {label}
            </p>
            <p className="mt-1 font-black text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <h3 className="font-black text-emerald-950">
          Selecionar avaliações para comparação
        </h3>
        {payload.history.length >= 2 ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-black text-slate-700">
                Avaliação inicial
                <select
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
                  onChange={(event) =>
                    setSelectedPreviousId(event.target.value)
                  }
                  value={selectedPreviousId}
                >
                  {payload.history
                    .filter(
                      (item) =>
                        item.assessmentId !== selectedCurrentId,
                    )
                    .map((item) => (
                      <option
                        key={item.assessmentId}
                        value={item.assessmentId}
                      >
                        {dateTime(item.assessedAt)} ·{" "}
                        {item.audit.professionalName}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm font-black text-slate-700">
                Avaliação comparativa
                <select
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
                  onChange={(event) =>
                    setSelectedCurrentId(event.target.value)
                  }
                  value={selectedCurrentId}
                >
                  {payload.history
                    .filter(
                      (item) =>
                        item.assessmentId !== selectedPreviousId,
                    )
                    .map((item) => (
                      <option
                        key={item.assessmentId}
                        value={item.assessmentId}
                      >
                        {dateTime(item.assessedAt)} ·{" "}
                        {item.audit.professionalName}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-emerald-900">
                Intervalo:{" "}
                {intervalLabel(
                  payload.history.find(
                    (item) =>
                      item.assessmentId === selectedPreviousId,
                  )!.assessedAt,
                  payload.history.find(
                    (item) =>
                      item.assessmentId === selectedCurrentId,
                  )!.assessedAt,
                )}
              </p>
              <Button
                onClick={() =>
                  setComparisonPair({
                    previousId: selectedPreviousId,
                    currentId: selectedCurrentId,
                  })
                }
                type="button"
              >
                Comparar avaliações
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm font-semibold text-emerald-900">
            É necessário possuir ao menos duas avaliações salvas para
            realizar uma comparação.
          </p>
        )}
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm font-black text-slate-700">
          Filtrar histórico
          <select
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
            onChange={(event) =>
              setFilter(event.target.value as PosturalHistoryFilter)
            }
            value={filter}
          >
            {Object.entries(filterLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {filter === "CUSTOM" ? (
          <>
            <label className="text-sm font-black text-slate-700">
              Data inicial
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"
                onChange={(event) => setFrom(event.target.value)}
                type="date"
                value={from}
              />
            </label>
            <label className="text-sm font-black text-slate-700">
              Data final
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"
                onChange={(event) => setTo(event.target.value)}
                type="date"
                value={to}
              />
            </label>
          </>
        ) : null}
      </div>

      <section>
        <h3 className="text-base font-black uppercase tracking-wide text-slate-900">
          Linha do tempo
        </h3>
        <ol className="mt-3 border-l-2 border-emerald-200 pl-5">
          {visibleHistory.map((item) => (
            <li className="relative pb-5" key={item.assessmentId}>
              <span className="absolute -left-[1.68rem] top-1 size-3 rounded-full bg-[#12664f]" />
              <p className="font-black text-slate-900">
                {item.evolutionPosition.initial
                  ? "Avaliação inicial"
                  : item.evolutionPosition.currentOrFinal
                    ? "Avaliação atual"
                    : `${payload.history.findIndex(
                        (historyItem) =>
                          historyItem.assessmentId ===
                          item.assessmentId,
                      )}ª reavaliação`}
              </p>
              <p className="text-sm text-slate-600">
                {dateTime(item.assessedAt)} ·{" "}
                {item.audit.professionalName} · {statusLabel(item)}
              </p>
              <button
                className="mt-1 text-sm font-black text-[#12664f] underline"
                onClick={() => setViewing(item)}
                type="button"
              >
                Abrir
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3 className="text-base font-black uppercase tracking-wide text-slate-900">
          Histórico de avaliações posturais
        </h3>
        <div className="mt-3 space-y-3">
          {recentHistory.map((item) => {
            const generated = generatePosturalTechnicalSummary(item.data);
            const photoCount = Object.values(item.data.views).filter(
              (view) => view.image,
            ).length;
            const officialDocumentAvailable = Boolean(
              item.attendanceId &&
              (item.status === "FINALIZED" ||
                item.data.completionStatus === "COMPLETED"),
            );
            const officialParams = officialDocumentAvailable
              ? new URLSearchParams({
                  patientId,
                  attendanceId: item.attendanceId!,
                  masterRecordId: item.masterRecordId,
                  entryId: item.assessmentId,
                })
              : undefined;
            if (item.versionId) officialParams?.set("versionId", item.versionId);
            const viewHref = officialParams
              ? `/clinica/plano-alimentar/entregavel?${new URLSearchParams({
                  ...Object.fromEntries(officialParams),
                  view: "postural",
                  source: "global-deliverables",
                }).toString()}`
              : undefined;
            const printHref = officialParams
              ? `/clinica/plano-alimentar/entregavel/imprimir?${new URLSearchParams({
                  ...Object.fromEntries(officialParams),
                  documentType: "postural",
                  intent: "PRINT",
                }).toString()}`
              : undefined;
            const pdfHref = printHref?.replace("intent=PRINT", "intent=SAVE_PDF");
            return (
              <article
                className="rounded-xl border border-slate-200 p-4"
                key={item.assessmentId}
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="font-black text-slate-900">
                      {dateTime(item.assessedAt)}
                    </p>
                    <p className="text-sm text-slate-600">
                      {item.audit.professionalName}
                    </p>
                  </div>
                  <div className="text-sm text-slate-600">
                    <p>Status: {statusLabel(item)}</p>
                    <p>Fotografias: {photoCount}</p>
                    <p>Achados registrados: {generated.findingCount}</p>
                  </div>
                  <p className="line-clamp-4 text-sm text-slate-600 xl:col-span-2">
                    {item.data.notes ||
                      item.data.technicalSummary?.editedSummary ||
                      item.data.technicalSummary?.generatedOriginal ||
                      "Não informado"}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() => setViewing(item)}
                    size="small"
                    type="button"
                    variant="outline"
                  >
                    Abrir
                  </Button>
                  <Button
                    disabled={
                      !item.data.technicalSummary?.editedSummary &&
                      !item.data.technicalSummary?.generatedOriginal
                    }
                    onClick={() =>
                      setViewingText({
                        title: `Resumo técnico · ${dateTime(item.assessedAt)}`,
                        content:
                          item.data.technicalSummary?.editedSummary ??
                          item.data.technicalSummary?.generatedOriginal ??
                          "",
                      })
                    }
                    size="small"
                    type="button"
                    variant="ghost"
                  >
                    Visualizar resumo
                  </Button>
                  <Button
                    disabled={!item.data.evaluatorConclusion}
                    onClick={() =>
                      setViewingText({
                        title: `Conclusão · ${dateTime(item.assessedAt)}`,
                        content: item.data.evaluatorConclusion ?? "",
                      })
                    }
                    size="small"
                    type="button"
                    variant="ghost"
                  >
                    Visualizar conclusão
                  </Button>
                  <Button
                    disabled={payload.history.length < 2}
                    onClick={() => compareWith(item)}
                    size="small"
                    type="button"
                    variant="outline"
                  >
                    Comparar
                  </Button>
                  {viewHref && printHref && pdfHref ? (
                    <>
                      <ButtonLink href={viewHref} size="small" variant="outline">Visualizar documento</ButtonLink>
                      <ButtonLink href={printHref} size="small">Imprimir</ButtonLink>
                      <ButtonLink href={pdfHref} size="small" variant="outline">Salvar em PDF</ButtonLink>
                    </>
                  ) : (
                    <span className="inline-flex min-h-9 items-center rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-500">
                      Documento disponível após concluir a avaliação
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {viewing ? (
        <AssessmentViewer
          assessment={viewing}
          onClose={() => setViewing(undefined)}
        />
      ) : null}
      {viewingText ? (
        <TextViewer
          content={viewingText.content}
          onClose={() => setViewingText(undefined)}
          title={viewingText.title}
        />
      ) : null}
      {comparisonPair ? (
        <ComparisonWorkspace
          initialCurrentId={comparisonPair.currentId}
          initialPreviousId={comparisonPair.previousId}
          onClose={() => setComparisonPair(undefined)}
          onSaved={(saved) =>
            setPayload((current) =>
              current
                ? {
                    ...current,
                    comparisons: [
                      saved,
                      ...current.comparisons.filter(
                        (item) => item.id !== saved.id,
                      ),
                    ],
                  }
                : current,
            )
          }
          patientId={patientId}
          payload={payload}
        />
      ) : null}
    </div>
  );
}
