"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, FormField, Textarea } from "@/components/ui";

const skipReasonMaxLength = 1_000;
const mealPlanFlowStepId = "MEAL_PLAN";

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

export function SkipMealPlanAction({
  attendanceId,
  patientId,
}: {
  attendanceId: string;
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
    if (requestInFlight.current) return;

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
        `/api/patients/${encodeURIComponent(patientId)}/attendances/${encodeURIComponent(attendanceId)}/clinical-flow/${encodeURIComponent(mealPlanFlowStepId)}/skip`,
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
            "Não foi possível marcar o Plano Alimentar como não realizado.",
        );
      }

      setDialogOpen(false);
      router.refresh();
    } catch (error) {
      setRequestError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Não foi possível marcar o Plano Alimentar como não realizado.",
      );
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        className="w-full border-amber-400 text-amber-950 hover:bg-amber-100"
        onClick={openDialog}
        type="button"
        variant="outline"
      >
        Marcar Plano Alimentar como não realizado
      </Button>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          onKeyDown={handleDialogKeyDown}
        >
          <section
            aria-describedby="skip-meal-plan-description"
            aria-labelledby="skip-meal-plan-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-5 text-left shadow-2xl sm:p-6"
            ref={dialogRef}
            role="dialog"
          >
            <h2
              className="text-lg font-black text-slate-950"
              id="skip-meal-plan-title"
            >
              Marcar Plano Alimentar como não realizado
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-slate-600"
              id="skip-meal-plan-description"
            >
              Esta decisão vale somente para este atendimento. Nenhum dado
              clínico vazio será criado.
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
                id="skip-meal-plan-reason"
                label="Motivo"
                required
              >
                <Textarea
                  aria-describedby="skip-meal-plan-reason-description"
                  aria-invalid={Boolean(reasonError)}
                  disabled={submitting}
                  id="skip-meal-plan-reason"
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
