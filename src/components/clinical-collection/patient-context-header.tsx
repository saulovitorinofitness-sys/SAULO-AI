import type {
  ClinicalCollectionView,
  SaveState,
} from "@/features/clinical-collection";
import { clinicalStepLabels } from "@/features/clinical-collection";

import { SaveStatus } from "./save-status";

const consultationLabels = {
  INITIAL: "Consulta inicial",
  FOLLOW_UP: "Retorno",
  PHYSICAL_ASSESSMENT: "Avaliação física",
  POSTURAL_ASSESSMENT: "Avaliação postural",
  TRAINING: "Treinamento",
  NUTRITION: "Nutrição",
} as const;

const sexLabels = {
  FEMALE: "Feminino",
  MALE: "Masculino",
  INTERSEX: "Intersexo",
  NOT_INFORMED: "Não informado",
} as const;

export function PatientContextHeader({
  collection,
  activeStepOrder,
  flowProgress,
  saveState,
}: {
  collection: ClinicalCollectionView;
  activeStepOrder: number;
  flowProgress: number;
  saveState: SaveState;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-[#103f32] px-5 py-4 text-white shadow-[0_10px_26px_rgb(10_73_56/0.12)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 break-words text-lg font-black text-white">
              {collection.patientName}
            </h1>

            <span className="shrink-0 rounded-md bg-white/15 px-2 py-1 text-xs font-black text-emerald-100">
              {collection.patientCode}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-emerald-200">
            {collection.patientAge !== undefined ? (
              <span>{collection.patientAge} anos</span>
            ) : null}

            {collection.patientSex ? (
              <span>{sexLabels[collection.patientSex]}</span>
            ) : null}

            {collection.patientPhone ? (
              <span>{collection.patientPhone}</span>
            ) : null}

            <span>{consultationLabels[collection.consultationType]}</span>

            <span>
              Profissional:{" "}
              <strong className="text-white">
                {collection.connectedProfessional.professionalName}
              </strong>
            </span>

            <span>
              Última etapa:{" "}
              <strong className="text-white">
                {collection.lastSavedStep
                  ? clinicalStepLabels[collection.lastSavedStep]
                  : "nenhuma"}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center xl:min-w-[22rem]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-emerald-200">
                Etapa {activeStepOrder} de 10
              </span>

              <strong className="font-black text-white">
                {flowProgress}%
              </strong>
            </div>

            <div
              aria-label={`${flowProgress}% do fluxo clínico concluído`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={flowProgress}
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
            >
              <span
                className="block h-full rounded-full bg-[#75d4b3] transition-all"
                style={{ width: `${flowProgress}%` }}
              />
            </div>
          </div>

          <div className="shrink-0 rounded-lg border border-white/10 bg-white/10 px-3 py-2">
            <SaveStatus state={saveState} />
          </div>
        </div>
      </div>
    </section>
  );
}
