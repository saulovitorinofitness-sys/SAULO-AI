import Link from "next/link";

import { CheckIcon } from "@/components/ui/icons";
import type {
  InitialConsultationStep,
  RegisteredPatientEntry,
} from "@/features/patient-registration";

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

export function InitialConsultationProgress({
  patient,
  registered,
}: {
  patient: RegisteredPatientEntry;
  registered: boolean;
}) {
  return (
    <div className="space-y-4">
      {registered ? (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900"
          role="status"
        >
          Paciente {patient.clinicalCode} cadastrado com sucesso.
        </div>
      ) : null}

      <section
        aria-labelledby="initial-consultation-title"
        className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-[0_8px_24px_rgb(20_55_44/0.05)]"
      >
        <div className="flex flex-col gap-3 border-b border-emerald-100 bg-emerald-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
              Atendimento iniciado
            </p>
            <h2
              className="mt-1 text-lg font-black text-emerald-950"
              id="initial-consultation-title"
            >
              Consulta Inicial
            </h2>
          </div>
          <p className="text-xs font-semibold text-emerald-800">
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(patient.attendanceStartedAt))}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {patient.steps.map((step) => (
              <Step key={step.key} step={step} />
            ))}
          </ol>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#12664f] px-5 text-sm font-black text-white transition hover:bg-[#0a4938] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              href={`/pacientes/${patient.patientId}/atendimentos/${patient.attendanceId}/coleta`}
            >
              Continuar atendimento
            </Link>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="registered-patient-title"
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              Prontuário Mestre
            </p>
            <h2
              className="mt-1 text-xl font-black text-slate-950"
              id="registered-patient-title"
            >
              {patient.fullName}
            </h2>
          </div>
          <strong className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-base font-black tracking-wide text-emerald-900">
            {patient.clinicalCode}
          </strong>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 px-3.5 py-3">
            <dt className="text-xs font-semibold text-slate-500">Idade</dt>
            <dd className="mt-1 text-sm font-black text-slate-800">
              {patient.age} anos
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3.5 py-3">
            <dt className="text-xs font-semibold text-slate-500">Sexo</dt>
            <dd className="mt-1 text-sm font-black text-slate-800">
              {sexLabels[patient.sex]}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3.5 py-3">
            <dt className="text-xs font-semibold text-slate-500">Telefone</dt>
            <dd className="mt-1 text-sm font-black text-slate-800">
              {patient.phone}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3.5 py-3">
            <dt className="text-xs font-semibold text-slate-500">
              Tipo de consulta
            </dt>
            <dd className="mt-1 text-sm font-black text-slate-800">
              Consulta inicial
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
