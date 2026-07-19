import type { ClinicalCollectionStepKey, ClinicalCollectionView } from "@/features/clinical-collection";
import { clinicalStepLabels } from "@/features/clinical-collection";
import { CheckIcon } from "@/components/ui/icons";

const steps: readonly ClinicalCollectionStepKey[] = ["ANTHROPOMETRY", "BIOIMPEDANCE", "PERIMETRY", "POSTURAL_ASSESSMENT", "SUMMARY"];

function statusOf(step: ClinicalCollectionStepKey, collection: ClinicalCollectionView) {
  if (step === "SUMMARY") return collection.progressPercent === 100 ? "COMPLETED" : "NOT_STARTED";
  const key = { ANTHROPOMETRY: "anthropometry", BIOIMPEDANCE: "bioimpedance", PERIMETRY: "perimetry", POSTURAL_ASSESSMENT: "posturalAssessment" } as const;
  return collection.records[key[step]].status;
}

export function ClinicalFlowStepper({ activeStep, collection, onSelect }: { activeStep: ClinicalCollectionStepKey; collection: ClinicalCollectionView; onSelect: (step: ClinicalCollectionStepKey) => void }) {
  return (
    <nav aria-label="Etapas da coleta clínica" className="rounded-2xl border border-[#dce5e0] bg-white p-2 shadow-[0_8px_24px_rgb(20_55_44/0.03)] lg:p-3">
      <ol className="no-scrollbar flex max-w-full gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {steps.map((step, index) => {
          const active = step === activeStep;
          const completed = statusOf(step, collection) === "COMPLETED";
          return (
            <li className="min-w-[9.5rem] lg:min-w-0" key={step}>
              <button aria-current={active ? "step" : undefined} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold transition ${active ? "bg-[#e7f2ed] text-[#0a4938]" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => onSelect(step)} type="button">
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${completed ? "bg-emerald-600 text-white" : active ? "bg-[#12664f] text-white" : "bg-slate-100 text-slate-500"}`}>{completed ? <CheckIcon className="size-3.5" /> : index + 1}</span>
                <span className="min-w-0"><span className="block leading-4">{clinicalStepLabels[step]}</span>{step === "POSTURAL_ASSESSMENT" ? <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-amber-700">Obrigatória</span> : null}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
