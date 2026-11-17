"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { developmentUserRequestHeaders } from "@/features/development-session";

async function responseMessage(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string } | null;
  return body?.message;
}

export function AttendanceStateActions({
  attendanceId,
  patientId,
  redirectAfterStart = false,
}: {
  attendanceId: string;
  patientId: string;
  redirectAfterStart?: boolean;
}) {
  const router = useRouter();
  const [action, setAction] = useState<"IDLE" | "STARTING" | "CANCELLING">("IDLE");
  const [message, setMessage] = useState("");

  async function submit(kind: "start" | "cancel") {
    const confirmed = window.confirm(
      kind === "start"
        ? "Confirmar o início deste atendimento?"
        : "Cancelar este atendimento preparado? O registro será mantido como cancelado.",
    );
    if (!confirmed || action !== "IDLE") return;

    setAction(kind === "start" ? "STARTING" : "CANCELLING");
    setMessage("");
    const response = await fetch(
      `/api/patients/${encodeURIComponent(patientId)}/attendances/${encodeURIComponent(attendanceId)}/${kind}`,
      { method: "POST", headers: developmentUserRequestHeaders() },
    ).catch(() => null);

    if (!response?.ok) {
      setMessage(response ? await responseMessage(response) ?? "Não foi possível atualizar o atendimento." : "Não foi possível acessar o servidor.");
      setAction("IDLE");
      return;
    }

    if (kind === "start" && redirectAfterStart) {
      router.push(`/pacientes/${encodeURIComponent(patientId)}`);
    } else if (kind === "cancel") {
      router.push(`/pacientes/${encodeURIComponent(patientId)}`);
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button loading={action === "STARTING"} onClick={() => void submit("start")} size="small" type="button">
          Iniciar atendimento
        </Button>
        <Button disabled={action !== "IDLE"} onClick={() => void submit("cancel")} size="small" type="button" variant="outline">
          Cancelar atendimento preparado
        </Button>
      </div>
      {message ? <p className="mt-2 text-xs font-semibold text-rose-700" role="alert">{message}</p> : null}
    </div>
  );
}
