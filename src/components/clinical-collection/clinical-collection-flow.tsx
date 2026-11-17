"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ClinicalFlowNavigation } from "@/components/nutrition-clinical-flow/clinical-flow-navigation";
import { Button, FormField, Textarea } from "@/components/ui";
import {
  type AnthropometryData,
  type BioimpedanceAvanutriData,
  type ClinicalCollectionScenario,
  type ClinicalCollectionScenarioKey,
  type ClinicalCollectionStepKey,
  type ClinicalCollectionView,
  type CreateHistoricalClinicalAssessmentInput,
  type CreateHistoricalClinicalAssessmentResult,
  type EditableClinicalData,
  type EditableClinicalStepKey,
  type PerimetryData,
  type PosturalAssessmentData,
  type SaveState,
} from "@/features/clinical-collection";
import { httpClinicalCollectionGateway } from "@/features/clinical-collection/http-gateway";
import {
  clinicalStepDraftStorageKey,
  parseClinicalStepDraft,
  serializeClinicalStepDraft,
  type StoredClinicalStepDraft,
} from "@/features/clinical-collection/draft-storage";
import {
  clinicalCollectionStepByFlowStep,
  flowStepByClinicalCollectionStep,
  nutritionClinicalFlowHref,
  type NutritionClinicalFlowStep,
  type NutritionClinicalFlowStepId,
} from "@/features/nutrition-clinical-flow/flow";
import { AnthropometryStep } from "./anthropometry-step";
import { BioimpedanceStep } from "./bioimpedance-step";
import { CollectionSummary } from "./collection-summary";
import { PerimetryStep } from "./perimetry-step";
import { PermissionDeniedState } from "./clinical-states";
import { clinicalInputClass } from "./clinical-field";
import { PosturalStep } from "./postural-step";

const collectionRecordKey = {
  ANTHROPOMETRY: "anthropometry",
  PERIMETRY: "perimetry",
  BIOIMPEDANCE: "bioimpedance",
  POSTURAL_ASSESSMENT: "posturalAssessment",
} as const;

const nextCollectionStep = {
  ANTHROPOMETRY: "PERIMETRY",
  PERIMETRY: "BIOIMPEDANCE",
} as const;

const editableCollectionSteps = [
  "ANTHROPOMETRY",
  "PERIMETRY",
  "BIOIMPEDANCE",
  "POSTURAL_ASSESSMENT",
] as const satisfies readonly EditableClinicalStepKey[];

const historicalAssessmentSteps = [
  "ANTHROPOMETRY",
  "PERIMETRY",
  "BIOIMPEDANCE",
] as const;
type HistoricalAssessmentStep = (typeof historicalAssessmentSteps)[number];

const skipReasonMaxLength = 1_000;
const unsafeSkipMessage =
  "Esta etapa possui informações preenchidas ou alterações não salvas. Salve ou revise os dados antes de marcá-la como não realizada.";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function apiErrorMessage(response: Response) {
  const body: unknown = await response.json().catch(() => null);

  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return undefined;
}

function localISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isHistoricalAssessmentStep(
  step: EditableClinicalStepKey,
): step is HistoricalAssessmentStep {
  return historicalAssessmentSteps.includes(step as HistoricalAssessmentStep);
}

function assessmentDateValidationMessage(value: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "Informe uma data da avaliação válida.";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime()) || localISODate(date) !== value) {
    return "Informe uma data da avaliação válida.";
  }

  if (value > today) return "A data da avaliação não pode ser futura.";
  return undefined;
}

function formatAssessmentDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function historicalRecordsForStep(
  step: HistoricalAssessmentStep,
  data: EditableClinicalData,
): CreateHistoricalClinicalAssessmentInput["records"] {
  if (step === "ANTHROPOMETRY") {
    return { anthropometry: data as AnthropometryData };
  }
  if (step === "PERIMETRY") {
    return { perimetry: data as PerimetryData };
  }
  return { bioimpedance: data as BioimpedanceAvanutriData };
}

function removeStoredDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nada a descartar quando o armazenamento local está indisponível.
  }
}

function storeDraft(key: string, step: EditableClinicalStepKey, data: EditableClinicalData) {
  try {
    window.localStorage.setItem(key, serializeClinicalStepDraft(step, data));
    return true;
  } catch {
    return false;
  }
}

export function ClinicalCollectionFlow({ canCompleteSummary, canContinueSummaryToNutrition, editableSteps, initialCollection, initialFlow, scenarios, initialStep }: { canCompleteSummary: boolean; canContinueSummaryToNutrition: boolean; editableSteps?: readonly EditableClinicalStepKey[]; initialCollection: ClinicalCollectionView; initialFlow: readonly NutritionClinicalFlowStep[]; scenarios: readonly ClinicalCollectionScenario[]; initialStep?: ClinicalCollectionStepKey }) {
  const [collection, setCollection] = useState(initialCollection);
  const [flow, setFlow] = useState(initialFlow);
  const [activeStep, setActiveStep] = useState<ClinicalCollectionStepKey>(initialStep ?? initialCollection.firstIncompleteStep);
  const [saveState, setSaveState] = useState<SaveState>("IDLE");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string>();
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string>();
  const [today] = useState(() => localISODate());
  const [assessmentDate, setAssessmentDate] = useState(() => localISODate());
  const [assessmentDateError, setAssessmentDateError] = useState<string>();
  const [recoverableDrafts, setRecoverableDrafts] = useState<
    Partial<Record<EditableClinicalStepKey, StoredClinicalStepDraft>>
  >({});
  const [renderNonce, setRenderNonce] = useState<
    Partial<Record<EditableClinicalStepKey, number>>
  >({});
  const [completing, setCompleting] = useState(false);
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [skipReasonError, setSkipReasonError] = useState<string>();
  const [skipFeedback, setSkipFeedback] = useState<{
    kind: "ERROR" | "SUCCESS";
    message: string;
    stepId: NutritionClinicalFlowStepId;
  }>();
  const [skipSubmitting, setSkipSubmitting] = useState(false);
  const completionInFlight = useRef(false);
  const saveInFlight = useRef(false);
  const skipRequestInFlight = useRef(false);
  const skipDialogRef = useRef<HTMLElement>(null);
  const autoSaveTimers = useRef(
    new Map<EditableClinicalStepKey, number>(),
  );
  const autoSaveInFlight = useRef(new Set<EditableClinicalStepKey>());
  const queuedAutoSaves = useRef(
    new Map<EditableClinicalStepKey, EditableClinicalData>(),
  );
  const latestDraftFingerprints = useRef(
    new Map<EditableClinicalStepKey, string>(),
  );
  const locallyProtectedSteps = useRef(new Set<EditableClinicalStepKey>());
  const pathname = usePathname();
  const router = useRouter();
  const canCompleteActiveSummary = canCompleteSummary;
  const canContinueActiveSummaryToNutrition =
    canContinueSummaryToNutrition;
  const canEditActiveStep =
    activeStep === "SUMMARY"
      ? true
      : (activeStep === "POSTURAL_ASSESSMENT" || collection.canEdit) &&
        (!editableSteps ||
          editableSteps.includes(activeStep));
  const showsAssessmentDate =
    activeStep !== "SUMMARY" &&
    activeStep !== "POSTURAL_ASSESSMENT";
  const selectedAssessmentDateTime =
    showsAssessmentDate &&
    !assessmentDateValidationMessage(assessmentDate, today)
      ? `${assessmentDate}T00:00:00`
      : undefined;

  const posturalResponsible =
    collection.records.posturalAssessment.audit ??
    collection.connectedProfessional;
  const activeFlowStepId = flowStepByClinicalCollectionStep[activeStep];
  const activeFlowStep = flow.find((step) => step.id === activeFlowStepId);
  const activeStepCanBeSkipped =
    activeStep !== "SUMMARY" &&
    Boolean(activeFlowStep) &&
    activeFlowStep?.status !== "COMPLETED" &&
    activeFlowStep?.status !== "SKIPPED" &&
    activeFlowStep?.status !== "BLOCKED" &&
    canEditActiveStep &&
    uuidPattern.test(collection.patientId) &&
    uuidPattern.test(collection.attendanceId);
  const skipControlsBusy = saveState === "SAVING" || skipSubmitting;

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (saveState === "UNSAVED") { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  useEffect(() => {
    const recovered: Partial<
      Record<EditableClinicalStepKey, StoredClinicalStepDraft>
    > = {};
    for (const step of editableCollectionSteps) {
      const key = clinicalStepDraftStorageKey(
        initialCollection.patientId,
        initialCollection.attendanceId,
        step,
      );
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const draft = parseClinicalStepDraft(raw, step);
        if (!draft) {
          removeStoredDraft(key);
          continue;
        }
        const serverData =
          initialCollection.records[collectionRecordKey[step]].data;
        if (JSON.stringify(draft.data) === JSON.stringify(serverData)) {
          removeStoredDraft(key);
          continue;
        }
        recovered[step] = draft;
      } catch {
        // O fluxo segue com o rascunho persistido no servidor.
      }
    }
    const revealRecovery = window.setTimeout(
      () => setRecoverableDrafts(recovered),
      0,
    );
    return () => window.clearTimeout(revealRecovery);
  }, [initialCollection]);

  useEffect(() => {
    const timers = autoSaveTimers.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);

  if (!collection.canRead) return <PermissionDeniedState />;

  function confirmDiscard() {
    return saveState !== "UNSAVED" || window.confirm("Existem alterações protegidas localmente com autosave pendente. Deseja sair desta etapa enquanto a sincronização continua?");
  }

  function openComparisons(tab: "measures" | "composition") {
    if (!confirmDiscard()) return;
    router.push(
      `/pacientes/${encodeURIComponent(collection.patientId)}/evolucao-avaliacoes?aba=${tab}`,
    );
  }

  function selectStep(step: ClinicalCollectionStepKey) {
    if (!confirmDiscard()) return;
    setActiveStep(step);
    const query = new URLSearchParams(window.location.search);
    query.set("step", step);
    window.history.replaceState(null, "", `${pathname}?${query.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigateToFlowStep(stepId: NutritionClinicalFlowStepId) {
    if (stepId in clinicalCollectionStepByFlowStep) {
      selectStep(
        clinicalCollectionStepByFlowStep[
          stepId as keyof typeof clinicalCollectionStepByFlowStep
        ],
      );
      return;
    }

    if (!confirmDiscard()) return;
    router.push(
      nutritionClinicalFlowHref(stepId, {
        patientId: collection.patientId,
        attendanceId: collection.attendanceId,
        scenario: collection.scenario,
      }),
    );
  }

  function selectScenario(scenario: ClinicalCollectionScenarioKey) {
    if (!confirmDiscard()) return;
    window.location.assign(`${pathname}?scenario=${scenario}`);
  }

  function draftKey(step: EditableClinicalStepKey) {
    return clinicalStepDraftStorageKey(
      collection.patientId,
      collection.attendanceId,
      step,
    );
  }

  function activeStepHasUnsafeDraftOrContent() {
    if (activeStep === "SUMMARY" || !activeFlowStep) return true;

    return (
      activeFlowStep.status !== "NOT_STARTED" ||
      saveState === "UNSAVED" ||
      saveState === "SAVING" ||
      saveState === "ERROR" ||
      saveInFlight.current ||
      autoSaveTimers.current.has(activeStep) ||
      autoSaveInFlight.current.has(activeStep) ||
      queuedAutoSaves.current.has(activeStep) ||
      latestDraftFingerprints.current.has(activeStep) ||
      locallyProtectedSteps.current.has(activeStep) ||
      Boolean(recoverableDrafts[activeStep])
    );
  }

  function openSkipDialog() {
    if (!activeStepCanBeSkipped || skipControlsBusy) return;

    if (activeStepHasUnsafeDraftOrContent()) {
      setSkipFeedback({
        kind: "ERROR",
        message: unsafeSkipMessage,
        stepId: activeFlowStepId,
      });
      return;
    }

    setSkipFeedback(undefined);
    setSkipReason("");
    setSkipReasonError(undefined);
    setSkipDialogOpen(true);
  }

  function closeSkipDialog() {
    if (skipSubmitting || skipRequestInFlight.current) return;
    setSkipDialogOpen(false);
    setSkipReasonError(undefined);
  }

  function handleSkipDialogKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key === "Escape") {
      closeSkipDialog();
      return;
    }

    if (event.key !== "Tab") return;
    const focusableElements = skipDialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusableElements?.length) return;

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function markActiveStepAsSkipped() {
    if (
      !activeStepCanBeSkipped ||
      !activeFlowStep ||
      skipRequestInFlight.current ||
      saveInFlight.current ||
      saveState === "SAVING"
    ) {
      return;
    }

    if (activeStepHasUnsafeDraftOrContent()) {
      setSkipFeedback({
        kind: "ERROR",
        message: unsafeSkipMessage,
        stepId: activeFlowStepId,
      });
      setSkipDialogOpen(false);
      return;
    }

    const normalizedReason = skipReason.trim();
    if (!normalizedReason) {
      setSkipReasonError("Informe o motivo da não realização.");
      return;
    }
    if (normalizedReason.length > skipReasonMaxLength) {
      setSkipReasonError(
        `O motivo deve ter no máximo ${skipReasonMaxLength} caracteres.`,
      );
      return;
    }

    skipRequestInFlight.current = true;
    setSkipSubmitting(true);
    setSkipReasonError(undefined);
    setSkipFeedback(undefined);

    try {
      const response = await fetch(
        `/api/patients/${encodeURIComponent(collection.patientId)}/attendances/${encodeURIComponent(collection.attendanceId)}/clinical-flow/${encodeURIComponent(activeFlowStepId)}/skip`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: normalizedReason }),
        },
      );
      const responseMessage = await apiErrorMessage(response);

      if (!response.ok) {
        throw new Error(
          responseMessage ||
            "Não foi possível marcar a etapa como não realizada.",
        );
      }

      setFlow((current) =>
        current.map((step) =>
          step.id === activeFlowStepId
            ? { ...step, status: "SKIPPED" }
            : step,
        ),
      );
      setSkipFeedback({
        kind: "SUCCESS",
        message: `${activeFlowStep.title} foi registrada como Não realizada neste atendimento.`,
        stepId: activeFlowStepId,
      });
      setSkipDialogOpen(false);
      setSkipReason("");
    } catch (error) {
      setSkipFeedback({
        kind: "ERROR",
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Não foi possível marcar a etapa como não realizada.",
        stepId: activeFlowStepId,
      });
    } finally {
      skipRequestInFlight.current = false;
      setSkipSubmitting(false);
    }
  }

  function changeAssessmentDate(value: string) {
    setAssessmentDate(value);
    setAssessmentDateError(assessmentDateValidationMessage(value, today));
    setSaveErrorMessage(undefined);
    setSaveSuccessMessage(undefined);
    setSaveState("UNSAVED");

    if (value !== today) {
      for (const timer of autoSaveTimers.current.values()) {
        window.clearTimeout(timer);
      }
      autoSaveTimers.current.clear();
    }
  }

  function scheduleDraftSave(
    step: EditableClinicalStepKey,
    data: EditableClinicalData,
  ) {
    const recordKey = collectionRecordKey[step];
    setCollection((current) => ({
      ...current,
      records: {
        ...current.records,
        [recordKey]: {
          ...current.records[recordKey],
          data,
        },
      },
    }) as ClinicalCollectionView);
    const fingerprint = JSON.stringify(data);
    latestDraftFingerprints.current.set(step, fingerprint);
    if (storeDraft(draftKey(step), step, data)) {
      locallyProtectedSteps.current.add(step);
    }
    setSaveErrorMessage(undefined);
    setSaveSuccessMessage(undefined);
    setSaveState("UNSAVED");

    if (
      isHistoricalAssessmentStep(step) &&
      assessmentDate !== today
    ) {
      return;
    }

    const currentTimer = autoSaveTimers.current.get(step);
    if (currentTimer !== undefined) window.clearTimeout(currentTimer);
    autoSaveTimers.current.set(
      step,
      window.setTimeout(() => {
        autoSaveTimers.current.delete(step);
        void flushAutoSave(step, data);
      }, 1_200),
    );
  }

  function markStepDirty(
    step: EditableClinicalStepKey,
    data: EditableClinicalData,
  ) {
    if (recoverableDrafts[step]) return;
    scheduleDraftSave(step, data);
  }

  async function flushAutoSave(
    step: EditableClinicalStepKey,
    data: EditableClinicalData,
  ) {
    if (autoSaveInFlight.current.has(step)) {
      queuedAutoSaves.current.set(step, data);
      return;
    }
    autoSaveInFlight.current.add(step);
    try {
      await saveStep(step, data, false, "AUTOSAVE");
    } finally {
      autoSaveInFlight.current.delete(step);
      const queued = queuedAutoSaves.current.get(step);
      queuedAutoSaves.current.delete(step);
      if (
        queued &&
        JSON.stringify(queued) !== latestDraftFingerprints.current.get(step)
      ) {
        return;
      }
      if (queued) await flushAutoSave(step, queued);
    }
  }

  async function manuallySaveStep(
    step: EditableClinicalStepKey,
    data: EditableClinicalData,
    continueAfterSave: boolean,
  ) {
    const timer = autoSaveTimers.current.get(step);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      autoSaveTimers.current.delete(step);
    }
    latestDraftFingerprints.current.set(step, JSON.stringify(data));
    await saveStep(step, data, continueAfterSave, "MANUAL");
  }

  function recoverDraft(step: EditableClinicalStepKey) {
    const draft = recoverableDrafts[step];
    if (!draft) return;
    const recordKey = collectionRecordKey[step];
    setCollection((current) => ({
      ...current,
      records: {
        ...current.records,
        [recordKey]: {
          ...current.records[recordKey],
          data: draft.data,
        },
      },
    }) as ClinicalCollectionView);
    setRecoverableDrafts((current) => {
      const next = { ...current };
      delete next[step];
      return next;
    });
    setRenderNonce((current) => ({
      ...current,
      [step]: (current[step] ?? 0) + 1,
    }));
    scheduleDraftSave(step, draft.data);
  }

  function discardDraft(step: EditableClinicalStepKey) {
    removeStoredDraft(draftKey(step));
    setRecoverableDrafts((current) => {
      const next = { ...current };
      delete next[step];
      return next;
    });
    if (locallyProtectedSteps.current.size === 0) setSaveState("IDLE");
  }

  async function saveStep(
    step: EditableClinicalStepKey,
    data: EditableClinicalData,
    continueAfterSave = true,
    saveMode: "MANUAL" | "AUTOSAVE" = "MANUAL",
  ) {
    const dateValidationMessage = isHistoricalAssessmentStep(step)
      ? assessmentDateValidationMessage(assessmentDate, today)
      : undefined;
    if (dateValidationMessage) {
      setAssessmentDateError(dateValidationMessage);
      setSaveErrorMessage(dateValidationMessage);
      setSaveSuccessMessage(undefined);
      setSaveState("ERROR");
      return;
    }

    const createsHistoricalAssessment =
      isHistoricalAssessmentStep(step) && assessmentDate < today;
    if (createsHistoricalAssessment && saveMode === "AUTOSAVE") {
      setSaveState("UNSAVED");
      return;
    }
    if (saveInFlight.current) return;

    saveInFlight.current = true;
    setSaveErrorMessage(undefined);
    setSaveSuccessMessage(undefined);
    setSaveState("SAVING");
    try {
      if (createsHistoricalAssessment) {
        const response = await fetch(
          `/api/patients/${encodeURIComponent(collection.patientId)}/clinical-assessments/history`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assessmentDate,
              records: historicalRecordsForStep(step, data),
            } satisfies Omit<
              CreateHistoricalClinicalAssessmentInput,
              "patientId"
            >),
          },
        );
        const responseBody = (await response.json().catch(() => null)) as
          | (CreateHistoricalClinicalAssessmentResult & { message?: string })
          | null;
        if (!response.ok || !responseBody?.assessment.id) {
          throw new Error(
            responseBody?.message ||
              "Não foi possível criar a avaliação histórica.",
          );
        }

        const fingerprint = JSON.stringify(data);
        if (
          latestDraftFingerprints.current.get(step) === fingerprint ||
          !latestDraftFingerprints.current.has(step)
        ) {
          removeStoredDraft(draftKey(step));
          latestDraftFingerprints.current.delete(step);
          locallyProtectedSteps.current.delete(step);
          setRecoverableDrafts((current) => {
            if (!current[step]) return current;
            const next = { ...current };
            delete next[step];
            return next;
          });
        }
        setSaveSuccessMessage(
          `Avaliação histórica de ${formatAssessmentDate(assessmentDate)} criada com sucesso no Prontuário Mestre.`,
        );
        setSaveState(
          locallyProtectedSteps.current.size > 0 ? "UNSAVED" : "SAVED",
        );

        if (step === "PERIMETRY") router.refresh();

        if (!continueAfterSave) return;

        if (step === "BIOIMPEDANCE") {
          const nextStepId = flow.find(
            (flowStep) => flowStep.id === "BIOIMPEDANCE",
          )?.nextStepId;
          if (nextStepId) {
            router.push(
              nutritionClinicalFlowHref(nextStepId, {
                patientId: collection.patientId,
                attendanceId: collection.attendanceId,
                scenario: collection.scenario,
              }),
            );
          }
          return;
        }

        const nextStep = nextCollectionStep[step];
        setActiveStep(nextStep);
        const query = new URLSearchParams(window.location.search);
        query.set("step", nextStep);
        window.history.replaceState(
          null,
          "",
          `${pathname}?${query.toString()}`,
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const result = await httpClinicalCollectionGateway.saveStep({ patientId: collection.patientId, attendanceId: collection.attendanceId, scenario: collection.scenario, step, data, saveMode });
      const recordKey = collectionRecordKey[step];
      setCollection((current) => ({
        ...current,
        ...result.collection,
        records: {
          ...current.records,
          [recordKey]: result.collection.records[recordKey],
        },
      }));
      setFlow((current) =>
        current.map((flowStep) =>
          flowStep.id === step
            ? {
                ...flowStep,
                status:
                  result.collection.records[collectionRecordKey[step]].status,
              }
            : flowStep,
        ),
      );
      const fingerprint = JSON.stringify(data);
      if (
        latestDraftFingerprints.current.get(step) === fingerprint ||
        !latestDraftFingerprints.current.has(step)
      ) {
        removeStoredDraft(draftKey(step));
        latestDraftFingerprints.current.delete(step);
        locallyProtectedSteps.current.delete(step);
        setRecoverableDrafts((current) => {
          if (!current[step]) return current;
          const next = { ...current };
          delete next[step];
          return next;
        });
      }
      setSaveState(
        locallyProtectedSteps.current.size > 0 ? "UNSAVED" : "SAVED",
      );
      setSaveSuccessMessage(
        "Avaliação salva com sucesso no Prontuário Mestre.",
      );

      if (step === "PERIMETRY") router.refresh();

      if (!continueAfterSave) return;

      if (step === "BIOIMPEDANCE") {
        const nextStepId = flow.find(
          (flowStep) => flowStep.id === "BIOIMPEDANCE",
        )?.nextStepId;
        if (nextStepId) {
          router.push(
            nutritionClinicalFlowHref(nextStepId, {
              patientId: collection.patientId,
              attendanceId: collection.attendanceId,
              scenario: collection.scenario,
            }),
          );
        }
        return;
      }

      if (step === "POSTURAL_ASSESSMENT") {
        router.push(
          nutritionClinicalFlowHref("PERFORMANCE", {
            patientId: collection.patientId,
            attendanceId: collection.attendanceId,
            scenario: collection.scenario,
          }),
        );
        return;
      }

      const nextStep = nextCollectionStep[step];
      setActiveStep(nextStep);
      const query = new URLSearchParams(window.location.search);
      query.set("step", nextStep);
      router.replace(`${pathname}?${query.toString()}`, { scroll: true });
    } catch (error) {
      setSaveSuccessMessage(undefined);
      setSaveErrorMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível salvar a avaliação.",
      );
      setSaveState("ERROR");
    } finally {
      saveInFlight.current = false;
    }
  }

  async function complete() {
    if (completionInFlight.current) return;
    if (collection.completed) {
      if (canContinueActiveSummaryToNutrition) {
        router.push(
          nutritionClinicalFlowHref("NUTRITION_STRATEGY", {
            patientId: collection.patientId,
            attendanceId: collection.attendanceId,
            scenario: collection.scenario,
          }),
        );
      }
      return;
    }
    if (!canCompleteActiveSummary) return;

    completionInFlight.current = true;
    setSaveErrorMessage(undefined);
    setCompleting(true);
    try {
      const result = await httpClinicalCollectionGateway.completeCollection({ patientId: collection.patientId, attendanceId: collection.attendanceId, scenario: collection.scenario });
      setCollection(result.collection);
      setFlow((current) =>
        current.map((step) =>
          step.id === "ASSESSMENT_SUMMARY"
            ? { ...step, status: "COMPLETED" }
            : step,
        ),
      );
      setSaveState("SAVED");
      if (canContinueActiveSummaryToNutrition) {
        router.push(
          nutritionClinicalFlowHref("NUTRITION_STRATEGY", {
            patientId: collection.patientId,
            attendanceId: collection.attendanceId,
            scenario: collection.scenario,
          }),
        );
      }
    } catch (error) {
      setSaveErrorMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível confirmar o Resumo da Avaliação.",
      );
      setSaveState("ERROR");
    } finally {
      completionInFlight.current = false;
      setCompleting(false);
    }
  }

  return (
    <ClinicalFlowNavigation
      activeStep={flowStepByClinicalCollectionStep[activeStep]}
      flow={flow}
      onNavigate={navigateToFlowStep}
      patient={{
        id: collection.patientId,
        name: collection.patientName,
        code: collection.patientCode,
      }}
      primaryAction={
        activeStep === "SUMMARY" &&
        (canContinueActiveSummaryToNutrition || !collection.completed)
          ? {
              label: canContinueActiveSummaryToNutrition
                ? "Salvar e continuar"
                : "Confirmar resumo",
              disabled:
                completing ||
                (!collection.completed &&
                  (!canCompleteActiveSummary || !collection.nutritionFlowReady)),
              onClick: complete,
            }
          : activeStep !== "SUMMARY"
            ? {
              label: "Salvar e continuar",
              disabled:
                saveState === "SAVING" ||
                !canEditActiveStep ||
                (showsAssessmentDate &&
                  Boolean(
                    assessmentDateValidationMessage(assessmentDate, today),
                  )),
              form: `clinical-form-${activeStep.toLowerCase()}`,
            }
            : undefined
      }
    >
      <div className="space-y-4">
      {activeStep !== "SUMMARY" && recoverableDrafts[activeStep] ? (
        <div aria-labelledby="recover-clinical-step-title" className="rounded-xl border border-amber-300 bg-amber-50 p-4" role="alertdialog">
          <p className="font-black text-amber-950" id="recover-clinical-step-title">
            Alterações locais recuperáveis nesta etapa
          </p>
          <p className="mt-1 text-sm text-amber-900">
            Uma interrupção impediu a confirmação deste rascunho no servidor. Recupere o conteúdo ou descarte somente as alterações locais desta etapa.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => recoverDraft(activeStep)} type="button">
              Recuperar alterações
            </Button>
            <Button onClick={() => discardDraft(activeStep)} type="button" variant="outline">
              Descartar alterações locais
            </Button>
          </div>
        </div>
      ) : null}
      {saveState === "UNSAVED" ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-900" role="status">
          Alterações protegidas localmente. Autosave pendente…
        </div>
      ) : null}
      {saveState === "SAVED" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900" role="status">
          {saveSuccessMessage ??
            "Avaliação salva com sucesso no Prontuário Mestre."}
        </div>
      ) : null}
      {saveState === "ERROR" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900" role="alert">
          {saveErrorMessage ?? "Não foi possível salvar a avaliação."} A etapa atual foi mantida para nova tentativa.
        </div>
      ) : null}
      {activeStepCanBeSkipped ? (
        <section
          aria-labelledby="skip-step-action-title"
          className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p
              className="text-sm font-black text-amber-950"
              id="skip-step-action-title"
            >
              Esta etapa não foi realizada?
            </p>
            <p className="mt-1 text-sm text-amber-900">
              Registre a decisão somente para este atendimento, sem criar dados
              clínicos vazios.
            </p>
          </div>
          <Button
            className="shrink-0 border-amber-400 text-amber-950 hover:bg-amber-100"
            disabled={skipControlsBusy}
            onClick={openSkipDialog}
            type="button"
            variant="outline"
          >
            Marcar como não realizada
          </Button>
        </section>
      ) : null}
      {skipFeedback?.stepId === activeFlowStepId ? (
        <div
          className={`rounded-xl border p-4 text-sm font-bold ${
            skipFeedback.kind === "SUCCESS"
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
          role={skipFeedback.kind === "SUCCESS" ? "status" : "alert"}
        >
          {skipFeedback.message}
        </div>
      ) : null}
      {scenarios.length > 1 ? <div className="flex flex-col gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-wide text-sky-800">Cenário de validação</p><p className="mt-0.5 text-xs text-sky-700">{scenarios.find((item) => item.key === collection.scenario)?.description}</p></div>
        <label className="text-xs font-bold text-sky-900" htmlFor="scenario">Visualizar cenário<select className="ml-2 min-h-10 rounded-lg border border-sky-200 bg-white px-3 text-xs font-bold outline-none focus:border-sky-500" id="scenario" onChange={(event) => selectScenario(event.target.value as ClinicalCollectionScenarioKey)} value={collection.scenario}>{scenarios.map((scenario) => <option key={scenario.key} value={scenario.key}>{scenario.label}</option>)}</select></label>
      </div> : null}
          {showsAssessmentDate ? (
            <section
              aria-labelledby="assessment-date-heading"
              className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.6fr)] sm:items-end"
            >
              <label
                className="block text-sm font-bold text-slate-700"
                htmlFor="assessmentDate"
              >
                Data da avaliação
                <input
                  aria-describedby={
                    assessmentDateError
                      ? "assessment-date-help assessment-date-error"
                      : "assessment-date-help"
                  }
                  aria-invalid={Boolean(assessmentDateError)}
                  className={`${clinicalInputClass} ${assessmentDateError ? "border-rose-500 ring-2 ring-rose-500/15" : ""}`}
                  disabled={!canEditActiveStep || saveState === "SAVING"}
                  id="assessmentDate"
                  max={today}
                  onChange={(event) =>
                    changeAssessmentDate(event.target.value)
                  }
                  required
                  type="date"
                  value={assessmentDate}
                />
                <span
                  className="mt-1.5 block text-xs font-normal leading-5 text-slate-500"
                  id="assessment-date-help"
                >
                  Informe a data em que esta avaliação foi realizada.
                </span>
                {assessmentDateError ? (
                  <span
                    className="mt-1 block text-xs font-semibold text-rose-700"
                    id="assessment-date-error"
                    role="alert"
                  >
                    {assessmentDateError}
                  </span>
                ) : null}
              </label>
              <div>
                <p
                  className="text-xs font-bold uppercase tracking-wide text-slate-500"
                  id="assessment-date-heading"
                >
                  Data da avaliação
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {assessmentDateValidationMessage(assessmentDate, today)
                    ? "Selecione uma data válida"
                    : formatAssessmentDate(assessmentDate)}
                </p>
              </div>
            </section>
          ) : null}
          {!canEditActiveStep ? <PermissionDeniedState /> : null}
          {canEditActiveStep && activeStep === "ANTHROPOMETRY" ? <AnthropometryStep key={`${collection.scenario}-anthropometry-${renderNonce.ANTHROPOMETRY ?? 0}`} onDirty={(data) => markStepDirty("ANTHROPOMETRY", data)} onSave={(data: AnthropometryData, continueAfterSave: boolean) => manuallySaveStep("ANTHROPOMETRY", data, continueAfterSave)} patientAge={collection.patientAge} patientSex={collection.patientSex} record={collection.records.anthropometry} responsibleProfessional={collection.connectedProfessional} saving={saveState === "SAVING"} /> : null}
          {canEditActiveStep && activeStep === "BIOIMPEDANCE" ? <BioimpedanceStep heightCm={collection.bioimpedanceHeightCm} key={`${collection.scenario}-bio-${renderNonce.BIOIMPEDANCE ?? 0}`} measuredAt={selectedAssessmentDateTime ?? collection.bioimpedanceMeasuredAt} onCompare={() => openComparisons("composition")} onDirty={(data) => markStepDirty("BIOIMPEDANCE", data)} onSave={(data: BioimpedanceAvanutriData, continueAfterSave: boolean) => manuallySaveStep("BIOIMPEDANCE", data, continueAfterSave)} patientAge={collection.patientAge} patientSex={collection.patientSex} record={collection.records.bioimpedance} responsibleProfessional={collection.connectedProfessional} saving={saveState === "SAVING"} /> : null}
          {canEditActiveStep && activeStep === "PERIMETRY" ? <PerimetryStep key={`${collection.scenario}-perimetry-${renderNonce.PERIMETRY ?? 0}`} measuredAt={selectedAssessmentDateTime ?? collection.perimetryMeasuredAt} onCompare={() => openComparisons("measures")} onDirty={(data) => markStepDirty("PERIMETRY", data)} onSave={(data: PerimetryData, continueAfterSave: boolean) => manuallySaveStep("PERIMETRY", data, continueAfterSave)} patientSex={collection.patientSex} previous={collection.previousPerimetry} record={collection.records.perimetry} responsibleProfessional={collection.connectedProfessional} saving={saveState === "SAVING"} /> : null}
          {canEditActiveStep && activeStep === "POSTURAL_ASSESSMENT" ? <PosturalStep assessedAt={collection.posturalAssessedAt} assessmentId={collection.records.posturalAssessment.origin?.entryId} evaluatorName={posturalResponsible.professionalName} key={`${collection.scenario}-postural-${renderNonce.POSTURAL_ASSESSMENT ?? 0}`} onBack={() => selectStep("BIOIMPEDANCE")} onDirty={(data) => markStepDirty("POSTURAL_ASSESSMENT", data)} onSave={(data: PosturalAssessmentData, continueAfterSave: boolean) => manuallySaveStep("POSTURAL_ASSESSMENT", data, continueAfterSave)} operationalStatus={activeFlowStep?.status} patientId={collection.patientId} record={collection.records.posturalAssessment} responsibleProfessional={posturalResponsible} saving={saveState === "SAVING"} /> : null}
          {activeStep === "SUMMARY" ? <CollectionSummary canComplete={canCompleteActiveSummary} canContinueToNutrition={canContinueActiveSummaryToNutrition} collection={collection} completing={completing} onComplete={complete} onCorrect={selectStep} /> : null}
      </div>
      {skipDialogOpen && activeFlowStep ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          onKeyDown={handleSkipDialogKeyDown}
        >
          <section
            aria-describedby="skip-step-description"
            aria-labelledby="skip-step-dialog-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
            ref={skipDialogRef}
            role="dialog"
          >
            <h2
              className="text-lg font-black text-slate-950"
              id="skip-step-dialog-title"
            >
              Marcar {activeFlowStep.title} como não realizada
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-slate-600"
              id="skip-step-description"
            >
              Esta decisão vale somente para este atendimento. Nenhum dado
              clínico vazio será criado.
            </p>
            <form
              className="mt-5 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void markActiveStepAsSkipped();
              }}
            >
              {skipFeedback?.kind === "ERROR" &&
              skipFeedback.stepId === activeFlowStepId ? (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900"
                  role="alert"
                >
                  {skipFeedback.message}
                </div>
              ) : null}
              <FormField
                error={skipReasonError}
                help={
                  skipReasonError
                    ? undefined
                    : `Informe o motivo operacional em até ${skipReasonMaxLength} caracteres.`
                }
                id="skip-step-reason"
                label="Motivo"
                required
              >
                <Textarea
                  aria-describedby="skip-step-reason-description"
                  aria-invalid={Boolean(skipReasonError)}
                  autoFocus
                  disabled={skipSubmitting}
                  id="skip-step-reason"
                  maxLength={skipReasonMaxLength}
                  onChange={(event) => {
                    setSkipReason(event.target.value);
                    if (skipReasonError) setSkipReasonError(undefined);
                  }}
                  placeholder="Descreva por que a etapa não foi realizada"
                  required
                  value={skipReason}
                />
              </FormField>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  disabled={skipSubmitting}
                  onClick={closeSkipDialog}
                  type="button"
                  variant="ghost"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={skipSubmitting}
                  loading={skipSubmitting}
                  type="submit"
                  variant="destructive"
                >
                  {skipSubmitting
                    ? "Registrando..."
                    : "Confirmar como não realizada"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </ClinicalFlowNavigation>
  );
}
