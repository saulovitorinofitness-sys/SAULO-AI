import Link from "next/link";

import { AttendanceStateActions } from "@/components/attendance/attendance-state-actions";
import { CheckIcon } from "@/components/ui/icons";
import type {
  InitialConsultationStep,
  RegisteredPatientEntry,
} from "@/features/patient-registration";
import { clinicalAttendanceTypeLabel } from "@/features/patient-registration/attendance-presentation";
import {
  isVisibleNutritionClinicalFlowStep,
  nutritionClinicalFlowProgress,
  type NutritionClinicalFlowStep,
} from "@/features/nutrition-clinical-flow";

const sexLabels = {
  FEMALE: "Feminino",
  MALE: "Masculino",
  INTERSEX: "Intersexo",
  NOT_INFORMED: "Não informado",
} as const;

function Step({ step }: { step: InitialConsultationStep }) {
  const completed = step.status === "COMPLETED";

  return (
    <li className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className={[
          "grid size-7 shrink-0 place-items-center rounded-full border",
          completed
            ? "border-emerald-700 bg-emerald-700 text-white"
            : "border-slate-300 bg-white text-slate-400",
        ].join(" ")}
      >
        {completed ? (
          <CheckIcon className="size-4" />
        ) : (
          <span className="size-2 rounded-full border border-current" />
        )}
      </span>

      <span
        className={[
          "text-sm font-bold",
          completed ? "text-emerald-900" : "text-slate-600",
        ].join(" ")}
      >
        {step.label}
      </span>
    </li>
  );
}

function RecordField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  const hasValue = value !== null && value !== undefined && value !== "";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-black text-slate-800">
        {hasValue ? value : "Não informado"}
      </dd>
    </div>
  );
}

function ModuleStatus({
  label,
  description,
  href,
  ready,
}: {
  label: string;
  description: string;
  href?: string;
  ready: boolean;
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900">{label}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {description}
          </p>
        </div>

        <span
          className={[
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black",
            ready
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800",
          ].join(" ")}
        >
          {ready ? "Disponível" : "Pendente"}
        </span>
      </div>

      {href ? (
        <Link
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-black text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-900"
          href={href}
        >
          Abrir módulo
        </Link>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-center text-xs font-bold text-slate-500">
          Integração ainda sem rota vinculada
        </p>
      )}
    </article>
  );
}

export function InitialConsultationProgress({
  flow = [],
  patient,
  registered,
}: {
  flow?: readonly NutritionClinicalFlowStep[];
  patient: RegisteredPatientEntry;
  registered: boolean;
}) {
  const activeAttendance = patient.activeAttendance;
  const historicalAttendance = patient.historicalAttendance;
  const activeFlow = flow.filter(isVisibleNutritionClinicalFlowStep);
  const currentAttendanceClinicalFlow = activeFlow.filter(
    (step) => step.id !== "PATIENT_REGISTRATION",
  );
  const progressPercent = nutritionClinicalFlowProgress(flow);
  const collectionCompleted = progressPercent === 100;
  const displayedSteps: readonly InitialConsultationStep[] = currentAttendanceClinicalFlow.length
    ? currentAttendanceClinicalFlow.map((step) => ({
        key: "ASSESSMENT",
        label: step.title,
        status: step.status === "COMPLETED" ? "COMPLETED" : "PENDING",
      }))
    : patient.steps.filter((step) => step.key !== "PATIENT_REGISTRATION");

  return (
    <div className="space-y-5">
      {registered ? (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900"
          role="status"
        >
          Paciente {patient.clinicalCode} cadastrado com sucesso. O Prontuário
          Mestre foi iniciado com os dados efetivamente registrados.
        </div>
      ) : null}

      <section
        aria-labelledby="master-record-title"
        className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-[0_8px_24px_rgb(20_55_44/0.05)]"
      >
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 px-4 py-5 text-white sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-200">
                Prontuário Mestre
              </p>
              <h1
                className="mt-1 text-2xl font-black"
                id="master-record-title"
              >
                {patient.fullName}
              </h1>
              <p className="mt-2 text-sm font-semibold text-emerald-100">
                Registro central do paciente e origem dos dados compartilhados
                entre os módulos autorizados.
              </p>
            </div>

            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:min-w-64 sm:items-end">
              <strong className="w-fit rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-base font-black tracking-wide text-white">
                {patient.clinicalCode}
              </strong>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                Ação principal
              </p>
              <Link
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-300 px-5 text-center text-sm font-black text-emerald-950 shadow-sm transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-900"
                href={`/pacientes/${patient.patientId}/evolucao-avaliacoes`}
              >
                Evolução e comparativos
              </Link>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <RecordField label="Idade" value={`${patient.age} anos`} />
            <RecordField label="Sexo" value={sexLabels[patient.sex]} />
            <RecordField label="Telefone" value={patient.phone} />
            <RecordField
              label="Situação do atendimento"
              value={activeAttendance ? activeAttendance.status === "DRAFT" ? "Preparado" : "Em andamento" : historicalAttendance ? "Concluído" : "Sem atendimento"}
            />
          </dl>

          {activeAttendance ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                  Atendimento atual
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  {clinicalAttendanceTypeLabel(activeAttendance.clinicalType)}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {activeAttendance.status === "DRAFT"
                    ? `Preparado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(activeAttendance.preparedAt))}. A consulta ainda não foi iniciada.`
                    : `Em andamento desde ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(activeAttendance.startedAt!))}`}
                </p>
              </div>

              <span className="w-fit rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">
                {progressPercent}% concluído
              </span>
            </div>

            <div
              aria-label={`${progressPercent}% do atendimento concluído`}
              className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progressPercent}
            >
              <div
                className="h-full rounded-full bg-emerald-700 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div> : (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Atendimento atual</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Nenhum atendimento registrado</h2>
              <p className="mt-1 text-sm text-slate-600">Os dados cadastrais permanentes continuam concluídos e disponíveis.</p>
            </div>
          )}

          {historicalAttendance ? <section aria-labelledby="previous-attendance-title" className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Histórico anterior</p>
            <h2 className="mt-1 text-base font-black text-slate-900" id="previous-attendance-title">{clinicalAttendanceTypeLabel(historicalAttendance.clinicalType)} · Atendimento concluído</h2>
            <p className="mt-1 text-sm text-slate-600">Iniciado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(historicalAttendance.startedAt ?? historicalAttendance.preparedAt))}. Visualização histórica em modo somente leitura; o registro anterior permanece preservado.</p>
          </section> : null}
        </div>
      </section>

      {activeAttendance ? <section
        aria-labelledby="collection-progress-title"
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              {clinicalAttendanceTypeLabel(activeAttendance.clinicalType)}
            </p>
            <h2
              className="mt-1 text-lg font-black text-slate-950"
              id="collection-progress-title"
            >
              Etapas do registro clínico
            </h2>
          </div>

          {activeAttendance.status === "DRAFT" ? (
            <AttendanceStateActions attendanceId={activeAttendance.id} patientId={patient.patientId} />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12664f] px-5 text-sm font-black text-white transition hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                href={`/pacientes/${patient.patientId}/continuar`}
              >
                Continuar atendimento
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-5 text-sm font-black text-sky-800 transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                href={`/atendimentos?action=finalize&attendanceId=${encodeURIComponent(activeAttendance.id)}&patientId=${encodeURIComponent(patient.patientId)}`}
              >
                Finalizar consulta
              </Link>
            </div>
          )}
        </div>

        <p className="mt-5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm font-semibold text-sky-900">
          <strong>Cadastro permanente reutilizado.</strong> Os dados permanecem
          disponíveis no Prontuário Mestre e não compõem o progresso clínico
          deste atendimento.
        </p>

        <ol className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {displayedSteps.map((step, index) => (
            <Step key={`${step.key}-${index}`} step={step} />
          ))}
        </ol>
      </section> : null}

      {activeAttendance?.status === "IN_PROGRESS" ? <section
        aria-labelledby="inheritance-status-title"
        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
      >
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
            Integração clínica
          </p>
          <h2
            className="mt-1 text-lg font-black text-slate-950"
            id="inheritance-status-title"
          >
            Preparação para herança automática
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Os módulos abaixo deverão consumir apenas informações registradas e
            válidas no Prontuário Mestre. Dados ausentes permanecem como “Não
            informado”.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <ModuleStatus
            description="Receberá objetivos e dados clínicos válidos após a conclusão da coleta necessária."
            href={`/pacientes/${patient.patientId}/estrategia-nutricional`}
            label="Estratégia Nutricional"
            ready={collectionCompleted}
          />
          <ModuleStatus
            description="Será vinculado à estratégia aprovada e aos dados persistidos do paciente."
            href={`/pacientes/${patient.patientId}/plano-alimentar`}
            label="Plano Alimentar Profissional"
            ready={collectionCompleted}
          />
          <ModuleStatus
            description="Receberá somente os dados necessários à prescrição de treino e às limitações relevantes."
            label="Performance"
            ready={collectionCompleted}
          />
        </div>
      </section> : null}
    </div>
  );
}
