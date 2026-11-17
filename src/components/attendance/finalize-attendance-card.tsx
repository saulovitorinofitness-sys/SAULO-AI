"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { developmentUserRequestHeaders } from "@/features/development-session";
import { Button, ButtonLink, buttonStyles } from "@/components/ui";

async function responseMessage(response: Response) {
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

export function FinalizeAttendanceCard({
  attendanceId,
  attendanceDate,
  attendanceType = "Atendimento",
  completedSteps = [],
  hasClinicalRecords = true,
  patientClinicalCode,
  patientId,
  patientName,
  pendingSteps = [],
}: {
  attendanceId: string;
  attendanceDate?: string;
  attendanceType?: string;
  completedSteps?: readonly string[];
  hasClinicalRecords?: boolean;
  patientClinicalCode?: string;
  patientId: string;
  patientName: string;
  pendingSteps?: readonly string[];
}) {
  const router = useRouter();
  const [state, setState] = useState<"IDLE" | "CONFIRMING" | "SAVING" | "DONE">("IDLE");
  const [message, setMessage] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [returnType, setReturnType] = useState<"RETURN" | "REASSESSMENT" | "FOLLOW_UP">("RETURN");
  const [returnNotes, setReturnNotes] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [closureObservation, setClosureObservation] = useState("");
  const inFlightRef = useRef(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state === "CONFIRMING") cancelButtonRef.current?.focus();
  }, [state]);

  function openConfirmation() {
    setMessage("");
    setState("CONFIRMING");
  }

  function cancelConfirmation() {
    if (inFlightRef.current) return;
    setMessage("");
    setState("IDLE");
  }

  async function finalize() {
    if (state !== "CONFIRMING" || inFlightRef.current) return;
    inFlightRef.current = true;
    setState("SAVING");
    setMessage("");
    const response = await fetch(
      `/api/patients/${encodeURIComponent(patientId)}/attendances/${encodeURIComponent(attendanceId)}/finalize`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...developmentUserRequestHeaders(),
        },
        body: JSON.stringify({
          closureObservation: closureObservation.trim() || undefined,
          returnPlan: returnDate
            ? {
                date: returnDate,
                time: returnTime || undefined,
                clinicalType: returnType,
                notes: returnNotes.trim() || undefined,
                durationMinutes,
              }
            : undefined,
        }),
      },
    ).catch(() => null);
    const message = response ? await responseMessage(response) : undefined;

    if (!response?.ok) {
      setMessage(message ?? "Não foi possível finalizar o atendimento.");
      inFlightRef.current = false;
      setState("CONFIRMING");
      return;
    }

    setState("DONE");
    router.replace("/atendimentos");
  }

  return (
    <section className="rounded-2xl border border-[#dce5e0] bg-white p-5 shadow-[0_8px_24px_rgb(20_55_44/0.03)] sm:p-6">
      <h2 className="text-lg font-black text-slate-900">Finalizar consulta</h2>
      <p className="mt-2 text-sm text-slate-600">
        Revise o resumo antes de encerrar. Etapas pendentes não impedem a
        finalização, mas permanecerão claramente registradas como não preenchidas.
      </p>
      {state === "DONE" ? (
        <div className="mt-5 space-y-4" role="status">
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
            Atendimento finalizado com sucesso.
          </p>
          <ButtonLink href={`/pacientes/${patientId}`}>Abrir prontuário</ButtonLink>
        </div>
      ) : state === "IDLE" ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            onClick={openConfirmation}
            type="button"
          >
            Finalizar consulta
          </Button>
          <ButtonLink href={`/pacientes/${patientId}/plano-alimentar`} variant="ghost">
            Voltar ao Plano Alimentar
          </ButtonLink>
        </div>
      ) : (
        <div aria-labelledby="finalize-confirmation-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4" role="dialog">
          <div className="my-6 w-full max-w-2xl rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl sm:p-6">
          <h3 className="text-lg font-black text-slate-950" id="finalize-confirmation-title">
            Confirmar finalização do atendimento
          </h3>
          <p className="mt-2 text-sm text-slate-700">
            Este atendimento será encerrado. Confirme somente após revisar as etapas clínicas.
          </p>
          <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
            <div><dt className="text-xs font-bold text-slate-500">Paciente</dt><dd className="mt-1 text-sm font-black text-slate-900">{patientName}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Prontuário</dt><dd className="mt-1 text-sm font-black text-slate-900">{patientClinicalCode ?? patientId}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Tipo</dt><dd className="mt-1 text-sm font-black text-slate-900">{attendanceType}</dd></div>
            <div><dt className="text-xs font-bold text-slate-500">Início</dt><dd className="mt-1 text-sm font-black text-slate-900">{attendanceDate ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(attendanceDate)) : "Não informado"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs font-bold text-slate-500">Identificador do atendimento</dt><dd className="mt-1 break-all font-mono text-xs font-bold text-slate-900">{attendanceId}</dd></div>
          </dl>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3" aria-labelledby="completed-steps-title">
              <h4 className="text-sm font-black text-emerald-900" id="completed-steps-title">Etapas concluídas</h4>
              {completedSteps.length ? <ul className="mt-2 space-y-1 text-xs font-semibold text-emerald-900">{completedSteps.map((step) => <li key={step}>{step}</li>)}</ul> : <p className="mt-2 text-xs text-emerald-900">Nenhuma etapa clínica concluída.</p>}
            </section>
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-3" aria-labelledby="pending-steps-title">
              <h4 className="text-sm font-black text-amber-950" id="pending-steps-title">Sem preenchimento</h4>
              {pendingSteps.length ? <><p className="mt-1 text-xs font-semibold text-amber-900">Estas etapas permanecerão pendentes:</p><ul className="mt-2 space-y-1 text-xs text-amber-900">{pendingSteps.map((step) => <li key={step}>{step}</li>)}</ul></> : <p className="mt-2 text-xs text-amber-900">Nenhuma etapa pendente.</p>}
            </section>
          </div>
          <fieldset className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-white/70 p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-black text-amber-950">Próximo retorno opcional</legend>
            <label className="text-xs font-bold text-slate-700">Data
              <input className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2" onChange={(event) => setReturnDate(event.target.value)} type="date" value={returnDate} />
            </label>
            <label className="text-xs font-bold text-slate-700">Horário
              <input className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2" disabled={!returnDate} onChange={(event) => setReturnTime(event.target.value)} type="time" value={returnTime} />
            </label>
            <label className="text-xs font-bold text-slate-700">Tipo
              <select className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2" disabled={!returnDate} onChange={(event) => setReturnType(event.target.value as typeof returnType)} value={returnType}>
                <option value="RETURN">Retorno</option><option value="REASSESSMENT">Reavaliação</option><option value="FOLLOW_UP">Acompanhamento</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">Duração estimada
              <select className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2" disabled={!returnDate} onChange={(event) => setDurationMinutes(Number(event.target.value))} value={durationMinutes}>
                <option value={30}>30 minutos</option><option value={45}>45 minutos</option><option value={60}>60 minutos</option><option value={90}>90 minutos</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700 sm:col-span-2">Observação curta
              <input className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-2" disabled={!returnDate} maxLength={500} onChange={(event) => setReturnNotes(event.target.value)} value={returnNotes} />
            </label>
          </fieldset>
          <label className="mt-4 block text-sm font-black text-slate-800">Observação de encerramento {!hasClinicalRecords ? <span className="text-rose-700">(obrigatória sem registro clínico)</span> : <span className="font-semibold text-slate-500">(opcional)</span>}
            <textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 p-2 text-sm" maxLength={1000} minLength={hasClinicalRecords ? undefined : 10} onChange={(event) => setClosureObservation(event.target.value)} required={!hasClinicalRecords} value={closureObservation} />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className={buttonStyles({ variant: "outline" })}
              disabled={state === "SAVING"}
              onClick={cancelConfirmation}
              ref={cancelButtonRef}
              type="button"
            >
              Cancelar
            </button>
            <Button
              disabled={state === "SAVING" || (!hasClinicalRecords && closureObservation.trim().length < 10)}
              loading={state === "SAVING"}
              onClick={() => void finalize()}
              type="button"
            >
              Finalizar consulta
            </Button>
          </div>
          {state === "SAVING" ? (
            <p className="mt-3 text-sm font-semibold text-amber-900" role="status">
              Finalizando atendimento...
            </p>
          ) : null}
          </div>
        </div>
      )}
      {message ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
