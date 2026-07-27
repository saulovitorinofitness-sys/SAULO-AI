"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ClinicalFlowNavigation } from "@/components/nutrition-clinical-flow/clinical-flow-navigation";
import {
  canDevelopmentUserAccess,
  canDevelopmentUserOperatePostural,
  useDevelopmentSession,
} from "@/features/development-session";
import {
  type AnthropometryData,
  type BioimpedanceAvanutriData,
  type ClinicalCollectionScenario,
  type ClinicalCollectionScenarioKey,
  type ClinicalCollectionStepKey,
  type ClinicalCollectionView,
  type EditableClinicalData,
  type EditableClinicalStepKey,
  type PerimetryData,
  type PosturalAssessmentData,
  type SaveState,
} from "@/features/clinical-collection";
import { httpClinicalCollectionGateway } from "@/features/clinical-collection/http-gateway";
import {
  clinicalCollectionStepByFlowStep,
  flowStepByClinicalCollectionStep,
  nutritionClinicalFlowHref,
  type NutritionClinicalFlowStep,
  type NutritionClinicalFlowStepId,
} from "@/features/nutrition-clinical-flow";
import { AnthropometryStep } from "./anthropometry-step";
import { BioimpedanceStep } from "./bioimpedance-step";
import { CollectionSummary } from "./collection-summary";
import { PerimetryStep } from "./perimetry-step";
import { PermissionDeniedState } from "./clinical-states";
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
  BIOIMPEDANCE: "POSTURAL_ASSESSMENT",
  POSTURAL_ASSESSMENT: "SUMMARY",
} as const satisfies Record<EditableClinicalStepKey, ClinicalCollectionStepKey>;

const moduleByCollectionStep = {
  ANTHROPOMETRY: "PHYSICAL_ASSESSMENT",
  PERIMETRY: "PERIMETRY",
  BIOIMPEDANCE: "BIOIMPEDANCE",
  POSTURAL_ASSESSMENT: "POSTURAL_ASSESSMENT",
} as const;

export function ClinicalCollectionFlow({ editableSteps, initialCollection, initialFlow, scenarios, initialStep }: { editableSteps?: readonly EditableClinicalStepKey[]; initialCollection: ClinicalCollectionView; initialFlow: readonly NutritionClinicalFlowStep[]; scenarios: readonly ClinicalCollectionScenario[]; initialStep?: ClinicalCollectionStepKey }) {
  const { professional } = useDevelopmentSession();
  const [collection, setCollection] = useState(initialCollection);
  const [flow, setFlow] = useState(initialFlow);
  const [activeStep, setActiveStep] = useState<ClinicalCollectionStepKey>(initialStep ?? initialCollection.firstIncompleteStep);
  const [saveState, setSaveState] = useState<SaveState>("IDLE");
  const [completing, setCompleting] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const canEditActiveStep =
    activeStep === "SUMMARY"
      ? true
      : (activeStep !== "POSTURAL_ASSESSMENT" ||
          canDevelopmentUserOperatePostural(professional)) &&
        canDevelopmentUserAccess(
          professional,
          moduleByCollectionStep[activeStep],
          "UPDATE",
        ) &&
        (!editableSteps ||
          editableSteps.includes(activeStep) ||
          activeStep === "POSTURAL_ASSESSMENT");

  const activeCollection = {
    ...collection,
    connectedProfessional: {
      ...collection.connectedProfessional,
      professionalUserId: professional.user.id,
      professionalName: professional.user.fullName,
    },
  };

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (saveState === "UNSAVED") { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  if (!collection.canRead) return <PermissionDeniedState />;

  function confirmDiscard() {
    return saveState !== "UNSAVED" || window.confirm("Existem alterações não salvas. Deseja descartá-las e sair desta etapa?");
  }

  function selectStep(step: ClinicalCollectionStepKey) {
    if (!confirmDiscard()) return;
    setSaveState("IDLE");
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

  async function saveStep(step: EditableClinicalStepKey, data: EditableClinicalData) {
    setSaveState("SAVING");
    try {
      const result = await httpClinicalCollectionGateway.saveStep({ patientId: collection.patientId, attendanceId: collection.attendanceId, scenario: collection.scenario, step, data });
      setCollection(result.collection);
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
      setSaveState("SAVED");
      const nextStep = nextCollectionStep[step];
      setActiveStep(nextStep);
      const query = new URLSearchParams(window.location.search);
      query.set("step", nextStep);
      window.history.replaceState(null, "", `${pathname}?${query.toString()}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSaveState("ERROR");
    }
  }

  async function complete() {
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
      router.push(
        nutritionClinicalFlowHref("NUTRITION_STRATEGY", {
          patientId: collection.patientId,
          attendanceId: collection.attendanceId,
          scenario: collection.scenario,
        }),
      );
    } catch {
      setSaveState("ERROR");
    } finally {
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
        activeStep === "SUMMARY"
          ? {
              label: "Salvar e continuar",
              disabled: completing,
              onClick: complete,
            }
          : {
              label: "Salvar e continuar",
              disabled:
                saveState === "SAVING" || !canEditActiveStep,
              form: `clinical-form-${activeStep.toLowerCase()}`,
            }
      }
    >
      <div className="space-y-4">
      {saveState === "SAVED" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900" role="status">
          Avaliação salva com sucesso no Prontuário Mestre.
        </div>
      ) : null}
      {scenarios.length > 1 ? <div className="flex flex-col gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-wide text-sky-800">Cenário de validação</p><p className="mt-0.5 text-xs text-sky-700">{scenarios.find((item) => item.key === collection.scenario)?.description}</p></div>
        <label className="text-xs font-bold text-sky-900" htmlFor="scenario">Visualizar cenário<select className="ml-2 min-h-10 rounded-lg border border-sky-200 bg-white px-3 text-xs font-bold outline-none focus:border-sky-500" id="scenario" onChange={(event) => selectScenario(event.target.value as ClinicalCollectionScenarioKey)} value={collection.scenario}>{scenarios.map((scenario) => <option key={scenario.key} value={scenario.key}>{scenario.label}</option>)}</select></label>
      </div> : null}
          {!canEditActiveStep ? <PermissionDeniedState /> : null}
          {canEditActiveStep && activeStep === "ANTHROPOMETRY" ? <AnthropometryStep key={`${collection.scenario}-anthropometry-${collection.records.anthropometry.audit?.version ?? 0}`} onDirty={() => setSaveState("UNSAVED")} onSave={(data: AnthropometryData) => saveStep("ANTHROPOMETRY", data)} record={collection.records.anthropometry} saving={saveState === "SAVING"} /> : null}
          {canEditActiveStep && activeStep === "BIOIMPEDANCE" ? <BioimpedanceStep key={`${collection.scenario}-bio-${collection.records.bioimpedance.audit?.version ?? 0}`} onDirty={() => setSaveState("UNSAVED")} onSave={(data: BioimpedanceAvanutriData) => saveStep("BIOIMPEDANCE", data)} record={collection.records.bioimpedance} saving={saveState === "SAVING"} /> : null}
          {canEditActiveStep && activeStep === "PERIMETRY" ? <PerimetryStep key={`${collection.scenario}-perimetry-${collection.records.perimetry.audit?.version ?? 0}`} onDirty={() => setSaveState("UNSAVED")} onSave={(data: PerimetryData) => saveStep("PERIMETRY", data)} previous={collection.previousPerimetry} record={collection.records.perimetry} saving={saveState === "SAVING"} /> : null}
          {canEditActiveStep && activeStep === "POSTURAL_ASSESSMENT" ? <PosturalStep assessmentId={collection.records.posturalAssessment.origin?.entryId} evaluatorName={professional.user.fullName} key={`${collection.scenario}-postural-${collection.records.posturalAssessment.audit?.version ?? 0}`} onDirty={() => setSaveState("UNSAVED")} onSave={(data: PosturalAssessmentData) => saveStep("POSTURAL_ASSESSMENT", data)} patientId={collection.patientId} record={collection.records.posturalAssessment} saving={saveState === "SAVING"} /> : null}
          {activeStep === "SUMMARY" ? <CollectionSummary collection={activeCollection} completing={completing} onComplete={complete} onCorrect={selectStep} /> : null}
      </div>
    </ClinicalFlowNavigation>
  );
}
