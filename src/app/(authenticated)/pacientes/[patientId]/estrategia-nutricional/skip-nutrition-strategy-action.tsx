"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, FormField, Textarea } from "@/components/ui";
import type {
  NutritionClinicalFlowStepId,
  NutritionClinicalFlowStepStatus,
} from "@/features/nutrition-clinical-flow/flow";

const skipReasonMaxLength = 1_000;
const nutritionStrategyFlowStepId =
  "NUTRITION_STRATEGY" satisfies NutritionClinicalFlowStepId;

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

export function SkipNutritionStrategyAction({
  attendanceId,
  children,
  operationalStatus,
  patientId,
}: {
  attendanceId: string;
  children: ReactNode;
  operationalStatus: NutritionClinicalFlowStepStatus;
  patientId: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLElement>(null);
  const requestInFlight = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [requestError, setRequestError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [markedSkipped, setMarkedSkipped] = useState(false);
  const skipped = operationalStatus === "SKIPPED" || markedSkipped;
  const canSkip =
    operationalStatus === "NOT_STARTED" ||
    operationalStatus === "IN_PROGRESS" ||
    operationalStatus === "BLOCKED";

  useEffect(() => {
    if (!dialogOpen) return;

    const previousActiveElement = document.activeElement;
    dialogRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();

    return () => {
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [dialogOpen]);

  function openDialog() {
    if (!canSkip || skipped) return;
    setReason("");
    setReasonError(undefined);
    setRequestError(undefined);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (submitting || requestInFlight.current) return;
    setDialogOpen(false);
    setReasonError(undefined);
    setRequestError(undefined);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      closeDialog();
      return;
    }

    if (event.key !== "Tab") return;
    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
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

  async function submit() {
    if (!canSkip || skipped || requestInFlight.current) return;

    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      setReasonError("Informe o motivo da não realização.");
      return;
    }
    if (normalizedReason.length > skipReasonMaxLength) {
      setReasonError(
        `O motivo deve ter no máximo ${skipReasonMaxLength} caracteres.`,
      );
      return;
    }

    requestInFlight.current = true;
    setSubmitting(true);
    setReasonError(undefined);
    setRequestError(undefined);

    try {
      const response = await fetch(
        `/api/patients/${encodeURIComponent(patientId)}/attendances/${encodeURIComponent(attendanceId)}/clinical-flow/${encodeURIComponent(nutritionStrategyFlowStepId)}/skip`,
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
            "Não foi possível marcar a Estratégia Nutricional como não realizada.",
        );
      }

      setMarkedSkipped(true);
      setDialogOpen(false);
      setReason("");
      router.refresh();
    } catch (error) {
      setRequestError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível marcar a Estratégia Nutricional como não realizada.",
      );
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  }

  if (skipped) {
    return (
      <section
        className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-sm sm:p-6"
        role="status"
      >
        <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
          Atendimento selecionado
        </p>
        <h2 className="mt-2 text-xl font-black">
          Estratégia Nutricional · Não realizada
        </h2>
        <p className="mt-2 text-sm text-amber-900">
          Esta etapa foi registrada como não realizada neste atendimento.
          Nenhuma estratégia vazia foi criada.
        </p>
        <Button
          className="mt-4"
          onClick={() =>
            router.push(
              `/pacientes/${encodeURIComponent(patientId)}/plano-alimentar?attendanceId=${encodeURIComponent(attendanceId)}`,
            )
          }
          type="button"
        >
          Ir para Plano Alimentar
        </Button>
      </section>
    );
  }

  return (
    <>
      {canSkip ? (
        <section
          aria-labelledby="skip-nutrition-strategy-action-title"
          className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p
              className="text-sm font-black text-amber-950"
              id="skip-nutrition-strategy-action-title"
            >
              Estratégia Nutricional não realizada neste atendimento?
            </p>
            <p className="mt-1 text-sm text-amber-900">
              Registre o motivo sem criar uma estratégia clínica vazia.
            </p>
          </div>
          <Button
            className="shrink-0 border-amber-400 text-amber-950 hover:bg-amber-100"
            onClick={openDialog}
            type="button"
            variant="outline"
          >
            Marcar Estratégia Nutricional como não realizada
          </Button>
        </section>
      ) : null}

      {children}

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          onKeyDown={handleDialogKeyDown}
        >
          <section
            aria-describedby="skip-nutrition-strategy-description"
            aria-labelledby="skip-nutrition-strategy-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
            ref={dialogRef}
            role="dialog"
          >
            <h2
              className="text-lg font-black text-slate-950"
              id="skip-nutrition-strategy-title"
            >
              Marcar Estratégia Nutricional como não realizada
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-slate-600"
              id="skip-nutrition-strategy-description"
            >
              Esta decisão vale somente para este atendimento. Nenhuma
              estratégia clínica vazia será criada.
            </p>
            <form
              className="mt-5 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              {requestError ? (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900"
                  role="alert"
                >
                  {requestError}
                </div>
              ) : null}
              <FormField
                error={reasonError}
                help={
                  reasonError
                    ? undefined
                    : `Informe o motivo operacional em até ${skipReasonMaxLength} caracteres.`
                }
                id="skip-nutrition-strategy-reason"
                label="Motivo"
                required
              >
                <Textarea
                  aria-invalid={Boolean(reasonError)}
                  disabled={submitting}
                  id="skip-nutrition-strategy-reason"
                  maxLength={skipReasonMaxLength}
                  onChange={(event) => {
                    setReason(event.target.value);
                    if (reasonError) setReasonError(undefined);
                  }}
                  placeholder="Descreva por que a etapa não foi realizada"
                  required
                  value={reason}
                />
              </FormField>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  disabled={submitting}
                  onClick={closeDialog}
                  type="button"
                  variant="ghost"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={submitting}
                  loading={submitting}
                  type="submit"
                  variant="destructive"
                >
                  {submitting
                    ? "Registrando..."
                    : "Confirmar como não realizada"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
