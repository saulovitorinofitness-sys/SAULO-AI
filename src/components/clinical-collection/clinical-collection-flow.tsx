"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  clinicalCollectionService,
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
import { AnthropometryStep } from "./anthropometry-step";
import { BioimpedanceStep } from "./bioimpedance-step";
import { ClinicalFlowStepper } from "./clinical-flow-stepper";
import { CollectionSummary } from "./collection-summary";
import { PatientContextHeader } from "./patient-context-header";
import { PerimetryStep } from "./perimetry-step";
import { PermissionDeniedState } from "./clinical-states";
import { PosturalStep } from "./postural-step";

const collectionRecordKey = {
  ANTHROPOMETRY: "anthropometry",
  BIOIMPEDANCE: "bioimpedance",
  PERIMETRY: "perimetry",
  POSTURAL_ASSESSMENT: "posturalAssessment",
} as const;

export function ClinicalCollectionFlow({ initialCollection, scenarios, initialStep }: { initialCollection: ClinicalCollectionView; scenarios: readonly ClinicalCollectionScenario[]; initialStep?: ClinicalCollectionStepKey }) {
  const [collection, setCollection] = useState(initialCollection);
  const [activeStep, setActiveStep] = useState<ClinicalCollectionStepKey>(initialStep ?? initialCollection.firstIncompleteStep);
  const [saveState, setSaveState] = useState<SaveState>("IDLE");
  const [completing, setCompleting] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;
    void clinicalCollectionService.getCollection({ patientId: initialCollection.patientId, attendanceId: initialCollection.attendanceId, scenario: initialCollection.scenario }).then((stored) => {
      if (!active || !stored) return;
      setCollection(stored);
      if (!initialStep) setActiveStep(stored.firstIncompleteStep);
    });
    return () => { active = false; };
  }, [initialCollection, initialStep]);

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
    const query = new URLSearchParams(searchParams.toString());
    query.set("step", step);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectScenario(scenario: ClinicalCollectionScenarioKey) {
    if (!confirmDiscard()) return;
    window.location.assign(`${pathname}?scenario=${scenario}`);
  }

  async function saveStep(step: EditableClinicalStepKey, data: EditableClinicalData) {
    setSaveState("SAVING");
    try {
      const result = await clinicalCollectionService.saveStep({ patientId: collection.patientId, attendanceId: collection.attendanceId, scenario: collection.scenario, step, data });
      setCollection(result.collection);
      setSaveState("SAVED");
      if (result.collection.records[collectionRecordKey[step]].status === "COMPLETED") {
        const nextStep = result.collection.firstIncompleteStep;
        setActiveStep(nextStep);
        const query = new URLSearchParams(searchParams.toString());
        query.set("step", nextStep);
        router.replace(`${pathname}?${query.toString()}`, { scroll: false });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setSaveState("ERROR");
    }
  }

  async function complete() {
    setCompleting(true);
    try {
      const result = await clinicalCollectionService.completeCollection({ patientId: collection.patientId, attendanceId: collection.attendanceId, scenario: collection.scenario });
      setCollection(result.collection);
      setSaveState("SAVED");
    } catch {
      setSaveState("ERROR");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PatientContextHeader collection={collection} saveState={saveState} />
      <div className="flex flex-col gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-wide text-sky-800">Cenário de validação</p><p className="mt-0.5 text-xs text-sky-700">{scenarios.find((item) => item.key === collection.scenario)?.description}</p></div>
        <label className="text-xs font-bold text-sky-900" htmlFor="scenario">Visualizar cenário<select className="ml-2 min-h-10 rounded-lg border border-sky-200 bg-white px-3 text-xs font-bold outline-none focus:border-sky-500" id="scenario" onChange={(event) => selectScenario(event.target.value as ClinicalCollectionScenarioKey)} value={collection.scenario}>{scenarios.map((scenario) => <option key={scenario.key} value={scenario.key}>{scenario.label}</option>)}</select></label>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <div className="min-w-0"><ClinicalFlowStepper activeStep={activeStep} collection={collection} onSelect={selectStep} /></div>
        <div className="min-w-0">
          {activeStep === "ANTHROPOMETRY" ? <AnthropometryStep key={`${collection.scenario}-anthropometry-${collection.records.anthropometry.audit?.version ?? 0}`} onDirty={() => setSaveState("UNSAVED")} onSave={(data: AnthropometryData) => saveStep("ANTHROPOMETRY", data)} record={collection.records.anthropometry} saving={saveState === "SAVING"} /> : null}
          {activeStep === "BIOIMPEDANCE" ? <BioimpedanceStep key={`${collection.scenario}-bio-${collection.records.bioimpedance.audit?.version ?? 0}`} onDirty={() => setSaveState("UNSAVED")} onSave={(data: BioimpedanceAvanutriData) => saveStep("BIOIMPEDANCE", data)} record={collection.records.bioimpedance} saving={saveState === "SAVING"} /> : null}
          {activeStep === "PERIMETRY" ? <PerimetryStep key={`${collection.scenario}-perimetry-${collection.records.perimetry.audit?.version ?? 0}`} onDirty={() => setSaveState("UNSAVED")} onSave={(data: PerimetryData) => saveStep("PERIMETRY", data)} previous={collection.previousPerimetry} record={collection.records.perimetry} saving={saveState === "SAVING"} /> : null}
          {activeStep === "POSTURAL_ASSESSMENT" ? <PosturalStep key={`${collection.scenario}-postural-${collection.records.posturalAssessment.audit?.version ?? 0}`} onDirty={() => setSaveState("UNSAVED")} onSave={(data: PosturalAssessmentData) => saveStep("POSTURAL_ASSESSMENT", data)} record={collection.records.posturalAssessment} saving={saveState === "SAVING"} /> : null}
          {activeStep === "SUMMARY" ? <CollectionSummary collection={collection} completing={completing} onComplete={complete} onCorrect={selectStep} /> : null}
        </div>
      </div>
    </div>
  );
}
