"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  NutritionDiagnosisReview,
  NutritionDiagnosisReviewOutcome,
} from "@/features/nutrition-diagnosis-review/repository";

export function NutritionDiagnosisReviewForm({
  attendanceId,
  initialReview,
  patientId,
  returnHref,
}: {
  readonly attendanceId: string;
  readonly initialReview: NutritionDiagnosisReview | null;
  readonly patientId: string;
  readonly returnHref: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState(
    initialReview?.diagnoses.join("\n") ?? "",
  );
  const [outcome, setOutcome] = useState<
    NutritionDiagnosisReviewOutcome | undefined
  >(initialReview?.outcome);
  const [state, setState] = useState<"IDLE" | "SAVING" | "ERROR">("IDLE");
  const [message, setMessage] = useState<string>();
  const diagnoses = content
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  async function saveReview() {
    if (
      !outcome ||
      (outcome === "DIAGNOSES_CONFIRMED" && !diagnoses.length) ||
      state === "SAVING"
    ) return;
    setState("SAVING");
    setMessage(undefined);
    try {
      const response = await fetch(
        `/api/patients/${encodeURIComponent(patientId)}/attendances/${encodeURIComponent(attendanceId)}/nutrition-diagnosis-review`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "SAVE_REVIEW",
            outcome,
            diagnoses:
              outcome === "DIAGNOSES_CONFIRMED" ? diagnoses : [],
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        readonly message?: string;
        readonly review?: NutritionDiagnosisReview;
      } | null;
      if (!response.ok || !payload?.review) {
        setState("ERROR");
        setMessage(
          payload?.message ??
            "Não foi possível salvar a revisão. Nenhum diagnóstico foi alterado.",
        );
        return;
      }

      router.push(returnHref);
      router.refresh();
    } catch {
      setState("ERROR");
      setMessage(
        "Não foi possível acessar o serviço de revisão. Nenhum diagnóstico foi alterado.",
      );
    }
  }

  return (
    <section
      aria-labelledby="nutrition-diagnosis-review-title"
      className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
      id="diagnosis-review"
    >
      <h2
        className="text-lg font-black text-amber-950"
        id="nutrition-diagnosis-review-title"
      >
        Revisão profissional do diagnóstico
      </h2>
      <p className="mt-2 text-sm leading-6 text-amber-950">
        Selecione o resultado da revisão deste atendimento. Esta ação não
        altera nem reabre a Anamnese de retorno, não modifica o Plano
        Alimentar e não aprova o relatório.
      </p>
      <fieldset className="mt-4 space-y-2">
        <legend className="text-sm font-black text-slate-800">
          Resultado da revisão
        </legend>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-800">
          <input
            checked={outcome === "NO_DIAGNOSIS_ESTABLISHED"}
            className="mt-1"
            name="diagnosis-review-outcome"
            onChange={() => setOutcome("NO_DIAGNOSIS_ESTABLISHED")}
            type="radio"
          />
          <span>
            Revisão realizada, sem diagnóstico estabelecido neste atendimento
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-800">
          <input
            checked={outcome === "DIAGNOSES_CONFIRMED"}
            className="mt-1"
            name="diagnosis-review-outcome"
            onChange={() => setOutcome("DIAGNOSES_CONFIRMED")}
            type="radio"
          />
          <span>Revisão realizada, com diagnósticos confirmados</span>
        </label>
      </fieldset>
      {outcome === "DIAGNOSES_CONFIRMED" ? (
        <>
          <label
            className="mt-4 block text-sm font-black text-slate-800"
            htmlFor="nutrition-diagnosis-review-content"
          >
            Diagnósticos e condições revisados
          </label>
          <textarea
            aria-describedby="nutrition-diagnosis-review-help"
            className="mt-2 min-h-36 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200"
            id="nutrition-diagnosis-review-content"
            onChange={(event) => {
              setContent(event.target.value);
              if (state === "ERROR") {
                setState("IDLE");
                setMessage(undefined);
              }
            }}
            placeholder="Uma condição confirmada por linha"
            value={content}
          />
        </>
      ) : null}
      <p className="mt-2 text-xs font-semibold text-slate-600" id="nutrition-diagnosis-review-help">
        Nenhum texto da Anamnese anterior é copiado automaticamente. A opção
        sem diagnóstico registra somente a decisão profissional e não presume
        que o paciente esteja saudável.
      </p>
      {initialReview ? (
        <p className="mt-3 text-xs font-bold text-slate-600">
          Revisão {initialReview.revision} registrada por {initialReview.responsibleName}.
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-900" role="alert">
          {message}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          disabled={
            !outcome ||
            (outcome === "DIAGNOSES_CONFIRMED" && !diagnoses.length) ||
            state === "SAVING"
          }
          loading={state === "SAVING"}
          onClick={() => void saveReview()}
          type="button"
        >
          Salvar revisão e voltar ao Entregável
        </Button>
      </div>
    </section>
  );
}
