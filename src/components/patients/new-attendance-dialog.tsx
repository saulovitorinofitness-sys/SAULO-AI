"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { developmentUserRequestHeaders } from "@/features/development-session";
import type { ClinicalAttendanceTypeInput } from "@/features/patient-registration";

const options: ReadonlyArray<{
  value: ClinicalAttendanceTypeInput;
  label: string;
}> = [
  { value: "FIRST_CONSULTATION", label: "Primeira consulta" },
  { value: "RETURN", label: "Retorno" },
  { value: "REASSESSMENT", label: "Reavaliação" },
  { value: "FOLLOW_UP", label: "Acompanhamento" },
  { value: "SINGLE_CONSULTATION", label: "Consulta avulsa" },
];

export function NewAttendanceDialog({
  hasHistory,
  patientId,
  patientName,
}: {
  hasHistory: boolean;
  patientId: string;
  patientName: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [clinicalType, setClinicalType] = useState<ClinicalAttendanceTypeInput>(
    hasHistory ? "RETURN" : "FIRST_CONSULTATION",
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const reset = () => {
      setMessage("");
      setSaving(false);
    };
    dialog?.addEventListener("close", reset);
    return () => dialog?.removeEventListener("close", reset);
  }, []);

  async function createAttendance() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(
      `/api/patients/${encodeURIComponent(patientId)}/attendances`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...developmentUserRequestHeaders(),
        },
        body: JSON.stringify({ clinicalType }),
      },
    ).catch(() => null);
    const body = response
      ? ((await response.json().catch(() => null)) as {
          message?: string;
          attendanceId?: string;
        } | null)
      : null;

    if (!response?.ok) {
      if (response?.status === 409 && body?.attendanceId) {
        router.push(`/pacientes/${encodeURIComponent(patientId)}`);
        return;
      }
      setMessage(body?.message ?? "Não foi possível iniciar o atendimento.");
      setSaving(false);
      return;
    }

    dialogRef.current?.close();
    router.push(`/pacientes/${encodeURIComponent(patientId)}`);
    router.refresh();
  }

  return (
    <>
      <Button
        onClick={() => dialogRef.current?.showModal()}
        size="small"
        type="button"
      >
        Novo atendimento
      </Button>
      <dialog
        aria-labelledby={`new-attendance-${patientId}`}
        className="w-[min(92vw,28rem)] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/40"
        ref={dialogRef}
      >
        <div className="p-5">
          <h2 className="text-lg font-black text-slate-950" id={`new-attendance-${patientId}`}>
            Novo atendimento
          </h2>
          <p className="mt-1 text-sm text-slate-600">{patientName}</p>
          <label className="mt-5 block text-sm font-bold text-slate-800" htmlFor={`clinical-type-${patientId}`}>
            Tipo do atendimento
          </label>
          <select
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
            id={`clinical-type-${patientId}`}
            onChange={(event) => setClinicalType(event.target.value as ClinicalAttendanceTypeInput)}
            value={clinicalType}
          >
            {options
              .filter((option) =>
                hasHistory
                  ? option.value !== "FIRST_CONSULTATION"
                  : option.value === "FIRST_CONSULTATION" || option.value === "SINGLE_CONSULTATION",
              )
              .map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
          </select>
          {message ? <p className="mt-3 text-sm font-semibold text-rose-700" role="alert">{message}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button disabled={saving} onClick={() => dialogRef.current?.close()} type="button" variant="outline">
              Cancelar
            </Button>
            <Button loading={saving} onClick={() => void createAttendance()} type="button">
              Criar atendimento
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
